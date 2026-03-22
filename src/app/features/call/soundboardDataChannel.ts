/**
 * soundboardDataChannel.ts — #80
 *
 * Broadcasts and receives soundboard clip metadata over the LiveKit data channel.
 * Other participants see a visual indicator when someone plays a clip.
 *
 * Protocol:
 *   topic:   'soundboard'
 *   payload: JSON encoded SoundboardMessage
 */

import type { Room } from 'livekit-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SoundboardMessage =
  | {
      type: 'clip_start';
      clipId: string;
      clipName: string;
      volume: number;
    }
  | {
      type: 'clip_stop';
      clipId: string;
    };

export type SoundboardActivity = {
  participantIdentity: string;
  clipName: string;
  clipId: string;
};

// ─── Sender ───────────────────────────────────────────────────────────────────

const TOPIC = 'soundboard';
const encoder = new TextEncoder();

/**
 * Publish a soundboard_clip_start message to all room participants.
 */
export async function publishClipStart(
  room: Room,
  clipId: string,
  clipName: string,
  volume: number,
): Promise<void> {
  const msg: SoundboardMessage = { type: 'clip_start', clipId, clipName, volume };
  await room.localParticipant.publishData(
    encoder.encode(JSON.stringify(msg)),
    { reliable: true, topic: TOPIC },
  );
}

/**
 * Publish a soundboard_clip_stop message to all room participants.
 */
export async function publishClipStop(room: Room, clipId: string): Promise<void> {
  const msg: SoundboardMessage = { type: 'clip_stop', clipId };
  await room.localParticipant.publishData(
    encoder.encode(JSON.stringify(msg)),
    { reliable: true, topic: TOPIC },
  );
}

// ─── Receiver helper ─────────────────────────────────────────────────────────

const decoder = new TextDecoder();

/**
 * Parses a raw DataReceived payload for the 'soundboard' topic.
 * Returns null if the payload is not a valid SoundboardMessage.
 */
export function parseSoundboardMessage(
  payload: Uint8Array,
  topic: string | undefined,
): SoundboardMessage | null {
  if (topic !== TOPIC) return null;
  try {
    const parsed = JSON.parse(decoder.decode(payload)) as SoundboardMessage;
    if (parsed.type !== 'clip_start' && parsed.type !== 'clip_stop') return null;
    return parsed;
  } catch {
    return null;
  }
}
