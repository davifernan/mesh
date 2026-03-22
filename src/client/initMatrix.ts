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
function patchFetchForOTKConflicts(): void {
  const _fetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await _fetch(input, init);

    if (response.status !== 400) return response;

    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
    if (!url.includes('/keys/upload')) return response;

    let body: Record<string, unknown> = {};
    try {
      body = await response.clone().json();
    } catch {
      return response;
    }

    const error = typeof body.error === 'string' ? body.error : '';
    if (!error.includes('already exists')) return response;

    // Key is already on the server — treat as success so the SDK moves on.
    console.debug('[initMatrix] OTK already exists on server, returning synthetic 200');
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
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
  patchFetchForOTKConflicts();
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

  await Promise.all([
    indexedDBStore.startup(),
    mx.initRustCrypto(dbNames.rustCrypto ? { cryptoDatabasePrefix: dbNames.rustCrypto } : {}),
  ]);

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
  const slotStr = sessionStorage.getItem('bettercord-account-slot');
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
      sessionStorage.removeItem('bettercord-account-slot');
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
