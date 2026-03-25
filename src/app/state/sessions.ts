// import { atom } from 'jotai';
// import {
//   atomWithLocalStorage,
//   getLocalStorageItem,
//   setLocalStorageItem,
// } from './utils/atomWithLocalStorage';

import { encryptToken, decryptToken, clearEncryptionKey, hasEncryptionKey } from './tokenCrypto';

export type Session = {
  baseUrl: string;
  userId: string;
  deviceId: string;
  accessToken: string;
  expiresInMs?: number;
  refreshToken?: string;
  fallbackSdkStores?: boolean;
};

export type Sessions = Session[];
export type SessionStoreName = {
  sync: string;
  crypto: string;
};

/**
 * Token storage mode — configurable via config.json (tokenStorageMode).
 *
 * - "local": plaintext in localStorage (legacy, least secure)
 * - "encrypted-local": AES-GCM encrypted in localStorage, key in sessionStorage (default)
 * - "session": plaintext in sessionStorage only (strictest — lost on browser close)
 *
 * Electron apps with safeStorage always use OS keychain regardless of this setting.
 */
export type TokenStorageMode = 'local' | 'encrypted-local' | 'session';

// Resolved at init time from config.json. Default: 'encrypted-local'.
let _tokenStorageMode: TokenStorageMode = 'encrypted-local';

/** Call once at startup (before any session read) to set the mode from config.json */
export function setTokenStorageMode(mode: TokenStorageMode | undefined): void {
  if (mode === 'local' || mode === 'encrypted-local' || mode === 'session') {
    _tokenStorageMode = mode;
  }
}

/**
 * Detect if we are running inside Electron with safeStorage support.
 * If true, we always use the safeStorage path (OS keychain) regardless of mode.
 */
function isElectronSafeStorage(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.electron &&
    typeof (window.electron as Record<string, unknown>).safeStorageEncrypt === 'function'
  );
}

// ── Token write ─────────────────────────────────────────────────────────────

/**
 * Store access token using the configured storage mode.
 * Async because encryption and Electron safeStorage are async.
 */
async function writeToken(token: string): Promise<void> {
  // Electron safeStorage always wins
  if (isElectronSafeStorage()) {
    const encrypted = await encryptToken(token);
    if (encrypted) {
      localStorage.setItem('mesh_access_token_enc', encrypted);
    }
    return;
  }

  switch (_tokenStorageMode) {
    case 'local':
      localStorage.setItem('mesh_access_token', token);
      break;

    case 'session':
      sessionStorage.setItem('mesh_access_token', token);
      break;

    case 'encrypted-local':
    default: {
      const encrypted = await encryptToken(token);
      if (encrypted) {
        localStorage.setItem('mesh_access_token_enc', encrypted);
        // Remove plaintext key if it exists (migration from old mode)
        localStorage.removeItem('mesh_access_token');
      } else {
        // Fallback to plaintext if encryption not available (insecure context)
        localStorage.setItem('mesh_access_token', token);
      }
      break;
    }
  }
}

// ── Token read ──────────────────────────────────────────────────────────────

/**
 * Read access token using the configured storage mode.
 * Async because decryption and Electron safeStorage are async.
 */
async function readToken(): Promise<string | null> {
  // Electron safeStorage always wins
  if (isElectronSafeStorage()) {
    const encrypted = localStorage.getItem('mesh_access_token_enc');
    if (encrypted) return decryptToken(encrypted);
    // Migration: if old plaintext token exists, encrypt it
    const plain = localStorage.getItem('mesh_access_token');
    if (plain) {
      await writeToken(plain);
      localStorage.removeItem('mesh_access_token');
      return plain;
    }
    return null;
  }

  switch (_tokenStorageMode) {
    case 'local':
      return localStorage.getItem('mesh_access_token');

    case 'session':
      return sessionStorage.getItem('mesh_access_token');

    case 'encrypted-local':
    default: {
      // Try encrypted first
      const encrypted = localStorage.getItem('mesh_access_token_enc');
      if (encrypted) return decryptToken(encrypted);
      // Migration: if old plaintext token exists, encrypt it for next time
      const plain = localStorage.getItem('mesh_access_token');
      if (plain) {
        await writeToken(plain);
        localStorage.removeItem('mesh_access_token');
        return plain;
      }
      return null;
    }
  }
}

// ── Token clear ─────────────────────────────────────────────────────────────

function clearToken(): void {
  localStorage.removeItem('mesh_access_token');
  localStorage.removeItem('mesh_access_token_enc');
  sessionStorage.removeItem('mesh_access_token');
  clearEncryptionKey();
}

// ── Session read (sync) — used for synchronous checks (route guards etc.) ──

/**
 * Synchronous session read — returns the token from whichever storage is
 * available WITHOUT async decryption. Used for route guards and initial checks
 * where async is not possible.
 *
 * For encrypted-local mode: checks if an encrypted token exists (returns a
 * placeholder) or falls back to plaintext. The actual token value is resolved
 * via getSessionAsync().
 */
function readTokenSync(): string | null {
  // Check all possible locations — whichever has data
  const plain = localStorage.getItem('mesh_access_token');
  if (plain) return plain;

  const session = sessionStorage.getItem('mesh_access_token');
  if (session) return session;

  // For encrypted-local: the encrypted blob exists but we can't decrypt synchronously.
  // However, the decryption key lives in sessionStorage — if the browser was restarted,
  // sessionStorage is cleared and the key is gone. In that case the encrypted token is
  // useless (can never be decrypted) and the session is stale.
  const encrypted = localStorage.getItem('mesh_access_token_enc');
  if (encrypted) {
    if (!hasEncryptionKey()) {
      // Key lost (browser restart). Clean up the stale session data so the router
      // correctly redirects to /login instead of hanging on "Heating up".
      removeFallbackSession();
      return null;
    }
    return '__encrypted__';
  }

  return null;
}

/**
 * Migration code for old session
 */
// const FALLBACK_STORE_NAME: SessionStoreName = {
//   sync: 'web-sync-store',
//   crypto: 'crypto-store',
// } as const;

export async function setFallbackSession(
  accessToken: string,
  deviceId: string,
  userId: string,
  baseUrl: string
): Promise<void> {
  await writeToken(accessToken);
  localStorage.setItem('mesh_device_id', deviceId);
  localStorage.setItem('mesh_user_id', userId);
  localStorage.setItem('mesh_hs_base_url', baseUrl);
}
export const removeFallbackSession = () => {
  localStorage.removeItem('mesh_hs_base_url');
  localStorage.removeItem('mesh_user_id');
  localStorage.removeItem('mesh_device_id');
  clearToken();
};
let sessionOverride: Session | undefined;
export const setSessionOverride = (session: Session) => {
  sessionOverride = session;
};

/**
 * Synchronous session getter — for route guards and quick existence checks.
 * The accessToken may be a sentinel ('__encrypted__') when using encrypted-local mode.
 * Use getSessionAsync() when you need the actual token value.
 */
export const getFallbackSession = (): Session | undefined => {
  if (sessionOverride) return sessionOverride;

  const baseUrl = localStorage.getItem('mesh_hs_base_url');
  const userId = localStorage.getItem('mesh_user_id');
  const deviceId = localStorage.getItem('mesh_device_id');
  const accessToken = readTokenSync();

  if (baseUrl && userId && deviceId && accessToken) {
    const session: Session = {
      baseUrl,
      userId,
      deviceId,
      accessToken,
      fallbackSdkStores: true,
    };

    return session;
  }

  return undefined;
};

/**
 * Async session getter — resolves the actual decrypted access token.
 * Use this when you need the real token value (e.g. for Matrix SDK init).
 */
export const getSessionAsync = async (): Promise<Session | undefined> => {
  if (sessionOverride) return sessionOverride;

  const baseUrl = localStorage.getItem('mesh_hs_base_url');
  const userId = localStorage.getItem('mesh_user_id');
  const deviceId = localStorage.getItem('mesh_device_id');
  const accessToken = await readToken();

  if (baseUrl && userId && deviceId && accessToken) {
    return {
      baseUrl,
      userId,
      deviceId,
      accessToken,
      fallbackSdkStores: true,
    };
  }

  return undefined;
};
/**
 * End of migration code for old session
 */

const SECONDARY_SESSIONS_KEY = 'mesh_sessions';

export const getSecondarySessions = (): Array<{ slot: number; session: Session }> => {
  try {
    return JSON.parse(localStorage.getItem(SECONDARY_SESSIONS_KEY) ?? '[]');
  } catch {
    return [];
  }
};

export const addSecondarySession = (session: Session): number => {
  const sessions = getSecondarySessions();
  // If this userId already has a secondary session (e.g. stale from a previous logout
  // that wasn't fully cleaned up), reuse its slot and update the credentials.
  const existing = sessions.find((s) => s.session.userId === session.userId);
  if (existing) {
    existing.session = session;
    localStorage.setItem(SECONDARY_SESSIONS_KEY, JSON.stringify(sessions));
    return existing.slot;
  }
  const usedSlots = new Set(sessions.map((s) => s.slot));
  let slot = 1;
  while (usedSlots.has(slot)) slot++;
  sessions.push({ slot, session });
  localStorage.setItem(SECONDARY_SESSIONS_KEY, JSON.stringify(sessions));
  return slot;
};

export const removeSecondarySession = (slot: number) => {
  const sessions = getSecondarySessions().filter((s) => s.slot !== slot);
  localStorage.setItem(SECONDARY_SESSIONS_KEY, JSON.stringify(sessions));
};

export const getSessionForSlot = (slot: number): Session | undefined => {
  const entry = getSecondarySessions().find((s) => s.slot === slot);
  if (!entry) return undefined;
  // Strip fallbackSdkStores so secondary accounts always use per-user IndexedDB names
  const { fallbackSdkStores: _ignored, ...rest } = entry.session;
  return rest;
};

// export const getSessionStoreName = (session: Session): SessionStoreName => {
//   if (session.fallbackSdkStores) {
//     return FALLBACK_STORE_NAME;
//   }

//   return {
//     sync: `sync${session.userId}`,
//     crypto: `crypto${session.userId}`,
//   };
// };

// export const MATRIX_SESSIONS_KEY = 'matrixSessions';
// const baseSessionsAtom = atomWithLocalStorage<Sessions>(
//   MATRIX_SESSIONS_KEY,
//   (key) => {
//     const defaultSessions: Sessions = [];
//     const sessions = getLocalStorageItem(key, defaultSessions);

//     // Before multi account support session was stored
//     // as multiple item in local storage.
//     // So we need these migration code.
//     const fallbackSession = getFallbackSession();
//     if (fallbackSession) {
//       removeFallbackSession();
//       sessions.push(fallbackSession);
//       setLocalStorageItem(key, sessions);
//     }
//     return sessions;
//   },
//   (key, value) => {
//     setLocalStorageItem(key, value);
//   }
// );

// export type SessionsAction =
//   | {
//       type: 'PUT';
//       session: Session;
//     }
//   | {
//       type: 'DELETE';
//       session: Session;
//     };

// export const sessionsAtom = atom<Sessions, [SessionsAction], undefined>(
//   (get) => get(baseSessionsAtom),
//   (get, set, action) => {
//     if (action.type === 'PUT') {
//       const sessions = [...get(baseSessionsAtom)];
//       const sessionIndex = sessions.findIndex(
//         (session) => session.userId === action.session.userId
//       );
//       if (sessionIndex === -1) {
//         sessions.push(action.session);
//       } else {
//         sessions.splice(sessionIndex, 1, action.session);
//       }
//       set(baseSessionsAtom, sessions);
//       return;
//     }
//     if (action.type === 'DELETE') {
//       const sessions = get(baseSessionsAtom).filter(
//         (session) => session.userId !== action.session.userId
//       );
//       set(baseSessionsAtom, sessions);
//     }
//   }
// );
