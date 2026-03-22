import { Room, RoomEvent } from 'livekit-client';
import type { RemoteParticipant } from 'livekit-client';

export const SOUNDBOARD_TOPIC = 'bettercord.soundboard';

export interface SoundboardClipEvent {
  type: 'start' | 'stop';
  clipName: string;
  clipId?: string;
  timestamp: number;
}

// ── E2EE helpers (AES-GCM 256-bit) ────────────────────────────────────────────
//
// LiveKit's frame-level E2EE applies only to audio/video tracks. Data channel
// messages are protected by DTLS at the transport layer but are readable by the
// SFU. When a Matrix room has E2EE enabled we apply an additional application-
// layer AES-GCM layer over the clip metadata (NOT the audio — that is already
// encrypted by the LiveKit E2EE worker via the mic track).
//
// Key derivation uses the Matrix room ID as a shared secret. Because the SFU
// also knows the room ID this provides obfuscation rather than true E2EE, but
// it prevents casual observation of clip names by infrastructure operators.
// A follow-up (see issue #88) should feed the LiveKit per-participant key
// material here for genuine end-to-end protection.

const E2EE_SALT = new TextEncoder().encode('bettercord.soundboard.v1');

/**
 * Derives a stable AES-GCM 256-bit key from a shared secret via PBKDF2.
 * Pass the Matrix room ID so all participants in the same call share the key.
 */
export async function deriveSoundboardAesKey(sharedSecret: string): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(sharedSecret);
  const keyMaterial = await crypto.subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: E2EE_SALT, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptPayload(key: CryptoKey, plaintext: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  // Cast plaintext to Uint8Array<ArrayBuffer> — SharedArrayBuffer is disallowed in crypto APIs (Spectre mitigation)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext as Uint8Array<ArrayBuffer>);
  const out = new Uint8Array(12 + ciphertext.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ciphertext), 12);
  return out;
}

async function decryptPayload(key: CryptoKey, data: Uint8Array): Promise<Uint8Array | null> {
  if (data.byteLength < 13) return null;
  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext));
  } catch {
    return null; // wrong key or tampered payload
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Broadcast a soundboard clip event to all other call participants. */
export async function publishSoundboardEvent(
  room: Room,
  event: SoundboardClipEvent,
  encryptionKey?: CryptoKey | null,
): Promise<void> {
  let payload = new TextEncoder().encode(JSON.stringify(event));
  if (encryptionKey) {
    payload = await encryptPayload(encryptionKey, payload);
  }
  await room.localParticipant.publishData(payload, {
    reliable: true,
    topic: SOUNDBOARD_TOPIC,
  });
}

/**
 * Subscribe to soundboard events sent by other participants.
 * Returns an unsubscribe function that removes the listener.
 */
export function subscribeSoundboardEvents(
  room: Room,
  onClipEvent: (identity: string, event: SoundboardClipEvent) => void,
  encryptionKey?: CryptoKey | null,
): () => void {
  const handler = async (
    payload: Uint8Array,
    participant?: RemoteParticipant,
    _kind?: unknown,
    topic?: string,
  ) => {
    if (topic !== SOUNDBOARD_TOPIC) return;
    try {
      let data: Uint8Array = payload;
      if (encryptionKey) {
        const decrypted = await decryptPayload(encryptionKey, payload);
        if (!decrypted) {
          console.warn('[Soundboard] Failed to decrypt data channel message — wrong key or tampered data');
          return;
        }
        data = decrypted;
      }
      const event: SoundboardClipEvent = JSON.parse(new TextDecoder().decode(data));
      const identity = participant?.identity ?? 'unknown';
      onClipEvent(identity, event);
    } catch (err) {
      console.warn('[Soundboard] Failed to parse data channel event:', err);
    }
  };

  room.on(RoomEvent.DataReceived, handler as any);
  return () => room.off(RoomEvent.DataReceived, handler as any);
}
