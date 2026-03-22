/**
 * Token encryption utilities for secure access token storage.
 *
 * Uses AES-GCM (Web Crypto API) to encrypt tokens before storing in localStorage.
 * The encryption key lives in sessionStorage (cleared when all tabs close).
 *
 * This means:
 *   - Page reload: key survives → token decrypts → no re-login needed
 *   - New tab: key survives (same session) → works
 *   - Browser restart: sessionStorage cleared → key lost → must re-login
 *   - XSS attack: localStorage contains ciphertext only, key is in separate storage scope
 *
 * In Electron: delegates to safeStorage via IPC (OS keychain — never expires).
 */

const KEY_STORAGE_KEY = 'mesh_token_enc_key';
const ALGO = 'AES-GCM';
const KEY_LENGTH = 256;

// ── Electron safeStorage bridge ─────────────────────────────────────────────

function isElectronSafeStorage(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.electron &&
    typeof (window.electron as ElectronAPIWithSafeStorage).safeStorageEncrypt === 'function'
  );
}

interface ElectronAPIWithSafeStorage {
  safeStorageEncrypt: (plaintext: string) => Promise<string>;
  safeStorageDecrypt: (encrypted: string) => Promise<string | null>;
}

// ── Web Crypto key management ───────────────────────────────────────────────

async function getOrCreateKey(): Promise<CryptoKey | null> {
  try {
    // Try to load existing key from sessionStorage
    const stored = sessionStorage.getItem(KEY_STORAGE_KEY);
    if (stored) {
      const jwk = JSON.parse(stored) as JsonWebKey;
      return await crypto.subtle.importKey('jwk', jwk, ALGO, true, ['encrypt', 'decrypt']);
    }

    // Generate new key
    const key = await crypto.subtle.generateKey(
      { name: ALGO, length: KEY_LENGTH },
      true, // extractable — needed to serialize to JWK
      ['encrypt', 'decrypt'],
    );

    // Persist to sessionStorage
    const jwk = await crypto.subtle.exportKey('jwk', key);
    sessionStorage.setItem(KEY_STORAGE_KEY, JSON.stringify(jwk));

    return key;
  } catch {
    // Web Crypto not available (e.g. insecure context)
    return null;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Encrypt a token string. Returns a Base64-encoded string containing IV + ciphertext.
 * In Electron with safeStorage: delegates to OS keychain.
 */
export async function encryptToken(token: string): Promise<string | null> {
  // Electron path: use OS keychain
  if (isElectronSafeStorage()) {
    try {
      return await (window.electron as unknown as ElectronAPIWithSafeStorage).safeStorageEncrypt(token);
    } catch {
      return null;
    }
  }

  // Web Crypto path
  const key = await getOrCreateKey();
  if (!key) return null;

  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(token);
    const ciphertext = await crypto.subtle.encrypt({ name: ALGO, iv }, key, encoded);

    // Concatenate IV + ciphertext and encode as Base64
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch {
    return null;
  }
}

/**
 * Decrypt a previously encrypted token string.
 * Returns null if decryption fails (key lost, tampered, etc.).
 * In Electron with safeStorage: delegates to OS keychain.
 */
export async function decryptToken(encrypted: string): Promise<string | null> {
  // Electron path: use OS keychain
  if (isElectronSafeStorage()) {
    try {
      return await (window.electron as unknown as ElectronAPIWithSafeStorage).safeStorageDecrypt(encrypted);
    } catch {
      return null;
    }
  }

  // Web Crypto path
  const key = await getOrCreateKey();
  if (!key) return null;

  try {
    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt({ name: ALGO, iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

/**
 * Clear the encryption key from sessionStorage.
 * Called on logout to ensure clean state.
 */
export function clearEncryptionKey(): void {
  sessionStorage.removeItem(KEY_STORAGE_KEY);
}
