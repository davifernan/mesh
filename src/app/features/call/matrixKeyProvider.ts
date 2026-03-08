import { BaseKeyProvider } from 'livekit-client';
import type { MatrixRTCSession } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import { MatrixRTCSessionEvent } from 'matrix-js-sdk/lib/matrixrtc';

export class MatrixKeyProvider extends BaseKeyProvider {
  private session: MatrixRTCSession | undefined;

  constructor() {
    super({ ratchetWindowSize: 10, keyringSize: 256 });
  }

  setRTCSession(session: MatrixRTCSession): void {
    if (this.session) {
      this.session.off(MatrixRTCSessionEvent.EncryptionKeyChanged, this.onEncryptionKeyChanged);
    }
    this.session = session;
    this.session.on(MatrixRTCSessionEvent.EncryptionKeyChanged, this.onEncryptionKeyChanged);
    this.session.reemitEncryptionKeys();
  }

  dispose(): void {
    if (this.session) {
      this.session.off(MatrixRTCSessionEvent.EncryptionKeyChanged, this.onEncryptionKeyChanged);
      this.session = undefined;
    }
  }

  private onEncryptionKeyChanged = (
    encryptionKey: Uint8Array,
    encryptionKeyIndex: number,
    participantId: string,
  ): void => {
    crypto.subtle
      .importKey('raw', new Uint8Array(encryptionKey), 'HKDF', false, ['deriveBits', 'deriveKey'])
      .then((keyMaterial) => {
        this.onSetEncryptionKey(keyMaterial, participantId, encryptionKeyIndex);
      })
      .catch((err) => {
        console.error('[MatrixKeyProvider] Failed to import encryption key:', err);
      });
  };
}
