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

  // Try new endpoint first
  let url: string;
  let jwt: string;

  const newEndpointResponse = await fetch(`${baseUrl}/get_token`, {
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
  });

  if (newEndpointResponse.status === 404) {
    // Fall back to legacy endpoint
    const legacyResponse = await fetch(`${baseUrl}/sfu/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: roomId,
        openid_token: openIdToken,
        device_id: deviceId,
      }),
    });

    if (!legacyResponse.ok) {
      throw new Error(
        `Legacy SFU token endpoint failed: ${legacyResponse.status} ${legacyResponse.statusText}`,
      );
    }

    const legacyData = (await legacyResponse.json()) as { url: string; jwt: string };
    url = legacyData.url;
    jwt = legacyData.jwt;
  } else {
    if (!newEndpointResponse.ok) {
      throw new Error(
        `SFU token endpoint failed: ${newEndpointResponse.status} ${newEndpointResponse.statusText}`,
      );
    }

    const newData = (await newEndpointResponse.json()) as { url: string; jwt: string };
    url = newData.url;
    jwt = newData.jwt;
  }

  const livekitAlias = parseLivekitAlias(jwt, roomId);

  return { url, jwt, livekitAlias };
}
