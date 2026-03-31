import { createClient, MatrixClient, IndexedDBStore, IndexedDBCryptoStore } from 'matrix-js-sdk';

import { cryptoCallbacks } from './secretStorageKeys';

/**
 * Patch the global fetch to handle duplicate one-time key uploads gracefully.
 *
 * Background: The matrix-rust-crypto SDK generates one-time key IDs sequentially
 * starting at 0. After clearing browser storage (IndexedDB), the counter resets —
 * but the old keys are still on the server. Synapse rejects re-uploads of the same
 * key ID with 400 "One time key already exists". The SDK does not handle this error
 * and retries it on every sync, blocking the entire outgoing-request queue including
 * room-key distribution → E2EE audio decryption fails.
 *
 * Fix: Intercept the 400 and return a synthetic 200 with an empty success body.
 * Security: The old key remains on the server — identical to the situation where
 * the upload succeeded the first time. No new attack surface is introduced.
 *
 * This workaround can be removed once matrix-rust-crypto handles "key already exists"
 * gracefully (upstream issue: https://github.com/matrix-org/matrix-rust-sdk/issues).
 */
function patchFetch(): void {
  const _fetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await _fetch(input, init);
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';

    // ── Patch 1: OTK conflict (400 on /keys/upload) ──────────────────────────
    // After clearing storage the Rust crypto counter resets and re-uploads the
    // same key IDs. Synapse rejects with 400 "already exists". Treat as success
    // so the SDK moves on instead of blocking the entire outgoing-request queue.
    if (response.status === 400 && url.includes('/keys/upload')) {
      let body: Record<string, unknown> = {};
      try {
        body = await response.clone().json();
      } catch {
        return response;
      }
      const error = typeof body.error === 'string' ? body.error : '';
      if (error.includes('already exists')) {
        console.debug('[initMatrix] OTK already exists on server, returning synthetic 200');
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Patch 2: Missing key backup entry (404 on /room_keys/keys/) ──────────
    // The SDK fetches individual keys from backup when it can't decrypt a message.
    // 404 is the normal response when that key was never backed up (e.g. from a
    // device that had backup disabled). Suppress the console error — it's noise.
    if (response.status === 404 && url.includes('/room_keys/keys/')) {
      return new Response(JSON.stringify({ errcode: 'M_NOT_FOUND', error: 'Key not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return response;
  };
}
import { clearNavToActivePathStore } from '../app/state/navToActivePath';
import { pushSessionToSW } from '../sw-session';
import { removeSecondarySession } from '../app/state/sessions';

type Session = {
  baseUrl: string;
  accessToken: string;
  userId: string;
  deviceId: string;
  fallbackSdkStores?: boolean;
};

const getSessionDbNames = (session: Session) => {
  if (session.fallbackSdkStores) {
    return { sync: 'web-sync-store', crypto: 'crypto-store', rustCrypto: undefined };
  }
  return {
    sync: `sync${session.userId}`,
    crypto: `crypto${session.userId}`,
    rustCrypto: `matrix-js-sdk${session.userId}`,
  };
};

export const initClient = async (session: Session): Promise<MatrixClient> => {
  patchFetch();
  const dbNames = getSessionDbNames(session);

  const indexedDBStore = new IndexedDBStore({
    indexedDB: global.indexedDB,
    localStorage: global.localStorage,
    dbName: dbNames.sync,
  });

  const legacyCryptoStore = new IndexedDBCryptoStore(global.indexedDB, dbNames.crypto);

  const mx = createClient({
    baseUrl: session.baseUrl,
    accessToken: session.accessToken,
    userId: session.userId,
    store: indexedDBStore,
    cryptoStore: legacyCryptoStore,
    deviceId: session.deviceId,
    timelineSupport: true,
    threadSupport: true,
    cryptoCallbacks: cryptoCallbacks as any,
    verificationMethods: ['m.sas.v1'],
  });

  const initRustCrypto = () =>
    mx.initRustCrypto(dbNames.rustCrypto ? { cryptoDatabasePrefix: dbNames.rustCrypto } : {});

  try {
    await Promise.all([indexedDBStore.startup(), initRustCrypto()]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("account in the store doesn't match")) {
      // The rust crypto store was created with a different device ID (e.g. after
      // re-login without clearing storage). Delete all IndexedDB databases that
      // belong to this user's rust crypto store and retry with a fresh one.
      console.warn('[initMatrix] Crypto store device mismatch — wiping rust crypto store and retrying');
      const allDbs = await window.indexedDB.databases().catch(() => [] as IDBDatabaseInfo[]);
      const prefix = dbNames.rustCrypto ?? 'matrix-js-sdk';
      await Promise.all(
        allDbs
          .filter((db) => db.name?.startsWith(prefix))
          .map(
            (db) =>
              new Promise<void>((resolve) => {
                const req = window.indexedDB.deleteDatabase(db.name!);
                req.onsuccess = () => resolve();
                req.onerror = () => resolve(); // best-effort
              })
          )
      );
      await initRustCrypto();
    } else {
      throw err;
    }
  }

  mx.setMaxListeners(50);

  return mx;
};

export const startClient = async (mx: MatrixClient) => {
  await mx.startClient({
    lazyLoadMembers: true,
    initialSyncLimit: 1,
  });
};

export const clearCacheAndReload = async (mx: MatrixClient) => {
  mx.stopClient();
  clearNavToActivePathStore(mx.getSafeUserId());
  await mx.store.deleteAllData();
  window.location.reload();
};

export const logoutClient = async (mx: MatrixClient) => {
  const slotStr = sessionStorage.getItem('mesh-account-slot');
  const slot = slotStr !== null ? parseInt(slotStr, 10) : null;
  const isSecondary =
    window.location.pathname.startsWith('/account/') || slot !== null;

  pushSessionToSW();
  mx.stopClient();
  try {
    await mx.logout();
  } catch {
    // ignore if failed to logout
  }
  await mx.clearStores();

  if (isSecondary) {
    if (slot !== null) {
      removeSecondarySession(slot);
      sessionStorage.removeItem('mesh-account-slot');
    } else {
      const pathSlotMatch = window.location.pathname.match(/^\/account\/(\d+)/);
      if (pathSlotMatch) removeSecondarySession(parseInt(pathSlotMatch[1], 10));
    }
    window.location.assign('/');
  } else {
    window.localStorage.clear();
    window.location.reload();
  }
};

export const clearLoginData = async () => {
  const dbs = await window.indexedDB.databases();

  dbs.forEach((idbInfo) => {
    const { name } = idbInfo;
    if (name) {
      window.indexedDB.deleteDatabase(name);
    }
  });

  window.localStorage.clear();
  window.location.reload();
};
