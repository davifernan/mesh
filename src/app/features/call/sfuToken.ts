import type { MatrixClient } from 'matrix-js-sdk';

export interface SFUConfig {
  url: string;
  jwt: string;
  livekitAlias: string;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 800;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, BASE_DELAY_MS * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

/** Retries only on network-level errors (TypeError from fetch), not on HTTP error responses. */
async function withNetworkRetry<T>(fn: () => Promise<T>, maxAttempts = 3, baseDelayMs = 1000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof TypeError)) throw err; // not a network error — do not retry
      lastError = err;
      if (attempt < maxAttempts - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, baseDelayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

function parseLivekitAlias(jwt: string, fallback: string): string {
  try {
    const payload = jwt.split('.')[1];
    if (!payload) return fallback;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded?.video?.room ?? fallback;
  } catch {
    return fallback;
  }
}

export async function getSFUConfigWithOpenID(
  mx: MatrixClient,
  userId: string,
  deviceId: string,
  serviceUrl: string,
  roomId: string,
  memberId?: string,
): Promise<SFUConfig> {
  const resolvedMemberId = memberId ?? `${userId}_${deviceId}`;

  const openIdToken = await withRetry(() => mx.getOpenIdToken());

  const baseUrl = serviceUrl.replace(/\/$/, '');

  // Try new endpoint first; fall back to legacy on 404, 5xx, or network errors (#51, #52)
  let url: string;
  let jwt: string;

  let newEndpointResponse: Response | null = null;
  let newEndpointNetworkError = false;

  try {
    newEndpointResponse = await withNetworkRetry(() =>
      fetch(`${baseUrl}/get_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          slot_id: 'm.call#ROOM',
          openid_token: openIdToken,
          member: {
            id: resolvedMemberId,
            claimed_user_id: userId,
            claimed_device_id: deviceId,
          },
        }),
      }),
    );
  } catch {
    // Network error after all retries exhausted — fall back to legacy
    newEndpointNetworkError = true;
  }

  const shouldFallback =
    newEndpointNetworkError ||
    !newEndpointResponse ||
    newEndpointResponse.status === 404 ||
    newEndpointResponse.status >= 500;

  if (shouldFallback) {
    // Fall back to legacy endpoint with retry for transient failures
    const legacyResponse = await withNetworkRetry(() =>
      fetch(`${baseUrl}/sfu/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: roomId,
          openid_token: openIdToken,
          device_id: deviceId,
        }),
      }),
    );

    if (!legacyResponse.ok) {
      throw new Error(
        `Legacy SFU token endpoint failed: ${legacyResponse.status} ${legacyResponse.statusText}`,
      );
    }

    const legacyData = (await legacyResponse.json()) as { url: string; jwt: string };
    url = legacyData.url;
    jwt = legacyData.jwt;
  } else {
    if (!newEndpointResponse!.ok) {
      throw new Error(
        `SFU token endpoint failed: ${newEndpointResponse!.status} ${newEndpointResponse!.statusText}`,
      );
    }

    const newData = (await newEndpointResponse!.json()) as { url: string; jwt: string };
    url = newData.url;
    jwt = newData.jwt;
  }

  const livekitAlias = parseLivekitAlias(jwt, roomId);

  return { url, jwt, livekitAlias };
}
