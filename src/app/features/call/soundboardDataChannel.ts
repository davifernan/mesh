import { Room, RoomEvent } from 'livekit-client';
import type { RemoteParticipant } from 'livekit-client';

const SOUNDBOARD_TOPIC = 'bettercord.soundboard';

export interface SoundboardClipEvent {
  type: 'start' | 'stop';
  clipName: string;
  clipId?: string;
  timestamp: number;
}

/** Broadcast a soundboard clip event to all other call participants. */
export async function publishSoundboardEvent(
  room: Room,
  event: SoundboardClipEvent
): Promise<void> {
  const payload = new TextEncoder().encode(JSON.stringify(event));
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
  onClipEvent: (identity: string, event: SoundboardClipEvent) => void
): () => void {
  const handler = (
    payload: Uint8Array,
    participant?: RemoteParticipant,
    _kind?: unknown,
    topic?: string
  ) => {
    if (topic !== SOUNDBOARD_TOPIC) return;
    try {
      const event: SoundboardClipEvent = JSON.parse(new TextDecoder().decode(payload));
      const identity = participant?.identity ?? 'unknown';
      onClipEvent(identity, event);
    } catch (err) {
      console.warn('[Soundboard] Failed to parse data channel event:', err);
    }
  };

  room.on(RoomEvent.DataReceived, handler as any);
  return () => room.off(RoomEvent.DataReceived, handler as any);
}
