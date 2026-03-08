/// <reference lib="WebWorker" />

export type {};
declare const self: ServiceWorkerGlobalScope;

type SessionInfo = {
  accessToken: string;
  baseUrl: string;
};

/**
 * Store session per client (tab)
 */
const sessions = new Map<string, SessionInfo>();

const clientToResolve = new Map<string, (value: SessionInfo | undefined) => void>();
const clientToSessionPromise = new Map<string, Promise<SessionInfo | undefined>>();

async function cleanupDeadClients() {
  const activeClients = await self.clients.matchAll();
  const activeIds = new Set(activeClients.map((c) => c.id));

  Array.from(sessions.keys()).forEach((id) => {
    if (!activeIds.has(id)) {
      sessions.delete(id);
      clientToResolve.delete(id);
      clientToSessionPromise.delete(id);
    }
  });
}

function setSession(clientId: string, accessToken: any, baseUrl: any) {
  if (typeof accessToken === 'string' && typeof baseUrl === 'string') {
    sessions.set(clientId, { accessToken, baseUrl });
  } else {
    // Logout or invalid session
    sessions.delete(clientId);
  }

  const resolveSession = clientToResolve.get(clientId);
  if (resolveSession) {
    resolveSession(sessions.get(clientId));
    clientToResolve.delete(clientId);
    clientToSessionPromise.delete(clientId);
  }
}

function requestSession(client: Client): Promise<SessionInfo | undefined> {
  const promise =
    clientToSessionPromise.get(client.id) ??
    new Promise((resolve) => {
      clientToResolve.set(client.id, resolve);
      client.postMessage({ type: 'requestSession' });
    });

  if (!clientToSessionPromise.has(client.id)) {
    clientToSessionPromise.set(client.id, promise);
  }

  return promise;
}

async function requestSessionWithTimeout(
  clientId: string,
  timeoutMs = 3000
): Promise<SessionInfo | undefined> {
  const client = await self.clients.get(clientId);
  if (!client) return undefined;

  const sessionPromise = requestSession(client);

  const timeout = new Promise<undefined>((resolve) => {
    setTimeout(() => resolve(undefined), timeoutMs);
  });

  return Promise.race([sessionPromise, timeout]);
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await cleanupDeadClients();
    })()
  );
});

/**
 * Receive session updates from clients
 */
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const client = event.source as Client | null;
  if (!client) return;

  const { type, accessToken, baseUrl } = event.data || {};

  if (type === 'setSession') {
    setSession(client.id, accessToken, baseUrl);
    cleanupDeadClients();
  }
});

const MEDIA_PATHS = ['/_matrix/client/v1/media/download', '/_matrix/client/v1/media/thumbnail'];

// ---------------------------------------------------------------------------
// CacheFirst for Matrix media
// ---------------------------------------------------------------------------
const MEDIA_CACHE = 'matrix-media-v1';
const MEDIA_CACHE_MAX = 200;
const MEDIA_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

/**
 * Try to serve the request from the media cache first.
 * Returns the cached Response if it exists and is within TTL, otherwise null.
 */
async function getFromMediaCache(request: Request): Promise<Response | null> {
  const cache = await caches.open(MEDIA_CACHE);
  const cached = await cache.match(request);
  if (!cached) return null;
  const cachedAt = cached.headers.get('sw-cached-at');
  if (!cachedAt || Date.now() - Number(cachedAt) >= MEDIA_CACHE_TTL) {
    // Stale — delete and re-fetch
    await cache.delete(request);
    return null;
  }
  return cached;
}

/**
 * Store a successful media response in the cache, injecting a timestamp header.
 * Enforces a max-entries limit by deleting the oldest entry when over MEDIA_CACHE_MAX.
 */
async function putInMediaCache(request: Request, response: Response): Promise<void> {
  if (response.status !== 200) return;
  try {
    const cache = await caches.open(MEDIA_CACHE);

    // Clone and inject the cache timestamp as a custom header
    const headersInit: Record<string, string> = { 'sw-cached-at': String(Date.now()) };
    response.headers.forEach((value, key) => {
      headersInit[key] = value;
    });
    const cachedResponse = new Response(await response.clone().arrayBuffer(), {
      status: response.status,
      statusText: response.statusText,
      headers: headersInit,
    });

    await cache.put(request, cachedResponse);

    // Evict oldest entry if over limit
    const keys = await cache.keys();
    if (keys.length > MEDIA_CACHE_MAX) {
      await cache.delete(keys[0]);
    }
  } catch {
    // Cache write failure is non-fatal
  }
}

function mediaPath(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    return MEDIA_PATHS.some((p) => pathname.startsWith(p));
  } catch {
    return false;
  }
}

function validMediaRequest(url: string, baseUrl: string): boolean {
  return MEDIA_PATHS.some((p) => {
    const validUrl = new URL(p, baseUrl);
    return url.startsWith(validUrl.href);
  });
}

function fetchConfig(token: string): RequestInit {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'default',
  };
}

/**
 * Fetch media with auth header, cache the result, and return the response.
 */
async function fetchAndCacheMedia(request: Request, token: string): Promise<Response> {
  // Cache-first: serve from cache when available
  const fromCache = await getFromMediaCache(request);
  if (fromCache) return fromCache;

  // Network fetch
  const response = await fetch(request.url, fetchConfig(token));

  // Cache successful responses in the background (don't await to avoid delaying the response)
  if (response.ok) {
    void putInMediaCache(request, response.clone());
  }

  return response;
}

self.addEventListener('fetch', (event: FetchEvent) => {
  const { url, method } = event.request;

  if (method !== 'GET' || !mediaPath(url)) return;

  const { clientId } = event;
  if (!clientId) return;

  const session = sessions.get(clientId);
  if (session) {
    if (validMediaRequest(url, session.baseUrl)) {
      event.respondWith(fetchAndCacheMedia(event.request, session.accessToken));
    }
    return;
  }

  event.respondWith(
    requestSessionWithTimeout(clientId).then((s) => {
      if (s && validMediaRequest(url, s.baseUrl)) {
        return fetchAndCacheMedia(event.request, s.accessToken);
      }
      return fetch(event.request);
    })
  );
});
