/**
 * LiveKit webhook handler.
 *
 * Receives verified LiveKit webhook events, updates the voice state store,
 * and broadcasts changes via the SSE manager.
 *
 * Handled events:
 *   participant_joined              — initialise presence from track list + attributes
 *   participant_left                — remove identity, broadcast 'left' if last device
 *   track_muted / track_unmuted     — update mic/camera/screenshare state
 *   track_published / track_unpublished — handle stopMicTrackOnMute:false republish pattern
 *   participant_attributes_changed  — sync isDeafened from participant attributes
 */

import { WebhookReceiver } from 'livekit-server-sdk';
import type { Context } from 'hono';
import type { VoiceStateStore } from './store.js';
import type { SSEManager } from './sseManager.js';
import type { BridgeStats, ParticipantPresence, TrackSource } from './types.js';
import { resolveMatrixUserId } from './identity.js';

// ── Webhook handler factory ───────────────────────────────────────────────────

export function createWebhookHandler(
  store: VoiceStateStore,
  sse: SSEManager,
  stats: BridgeStats,
  apiKey: string,
  apiSecret: string,
) {
  const receiver = new WebhookReceiver(apiKey, apiSecret);

  return async function handleWebhook(c: Context): Promise<Response> {
    const body = await c.req.text();
    const authHeader = c.req.header('Authorization') ?? '';

    let event: Awaited<ReturnType<typeof receiver.receive>>;
    try {
      event = await receiver.receive(body, authHeader);
    } catch (err) {
      stats.webhooksRejected += 1;
      console.warn(
        '[webhook] Signature verification FAILED — LiveKit credentials may be wrong.',
        'Error:', (err as Error).message,
        'Tip: check LIVEKIT_API_KEY and LIVEKIT_API_SECRET match your LiveKit dashboard.',
      );
      return c.text('Unauthorized', 401);
    }

    stats.webhooksReceived += 1;
    // Cast to string: the SDK's WebhookEventNames union is incomplete (missing track_muted,
    // track_unmuted, participant_attributes_changed which are valid LiveKit webhook events).
    const eventName = (event.event ?? 'unknown') as string;
    stats.webhookEventCounts[eventName] = (stats.webhookEventCounts[eventName] ?? 0) + 1;

    const roomId = event.room?.name;
    if (!roomId) return c.text('ok');

    const p = event.participant;
    const identity = p?.identity;
    if (!identity) return c.text('ok');

    const pAttrs = p?.attributes as Record<string, string> | undefined;
    const pMeta = typeof p?.metadata === 'string' ? p.metadata : undefined;
    const userId = resolveMatrixUserId(identity, pAttrs, pMeta);
    const track = event.track;
    // The protocol TrackSource is a numeric enum but JSON payloads carry string values;
    // cast via unknown to our local string-union type.
    const source = track?.source as unknown as TrackSource | undefined;

    switch (eventName) {
      case 'participant_joined': {
        const initial: ParticipantPresence = {
          isMicMuted: false,
          isCameraOn: false,
          isScreenSharing: false,
          isDeafened: pAttrs?.isDeafened === '1',
          updatedAt: Date.now(),
          type: 'update',
        };

        // Seed state from the track list included in the join event.
        // Cast via unknown: protocol TrackSource is numeric but JSON payloads carry strings.
        for (const t of (p?.tracks ?? []) as unknown as Array<{ source: TrackSource; muted?: boolean }>) {
          if (t.source === 'MICROPHONE') initial.isMicMuted = t.muted ?? false;
          if (t.source === 'CAMERA') initial.isCameraOn = !(t.muted ?? true);
          if (t.source === 'SCREEN_SHARE') initial.isScreenSharing = !(t.muted ?? true);
        }

        const stored = await store.joinPresence(roomId, identity, userId, initial);
        sse.broadcast(roomId, userId, stored, 'update');
        console.log(`[join] ${userId} in ${roomId} (identity: ${identity})`);
        break;
      }

      case 'participant_left': {
        const result = await store.removePresence(roomId, identity, userId);
        if (result) {
          if (result.remaining === 0) {
            // Last device left — broadcast full departure with the allocated seq
            sse.broadcast(
              roomId,
              userId,
              {
                isMicMuted: false,
                isCameraOn: false,
                isScreenSharing: false,
                isDeafened: false,
                updatedAt: Date.now(),
                seq: result.seq,
                type: 'left',
              },
              'left',
            );
          } else if (result.aggregated) {
            // One of multiple devices left — broadcast updated aggregated user-state
            // (seq is already embedded in result.aggregated by the store)
            sse.broadcast(roomId, userId, result.aggregated, 'update');
          }
        }
        console.log(`[left] ${userId} in ${roomId} (identity: ${identity})`);
        break;
      }

      case 'track_muted':
        await applyTrackMute(store, sse, roomId, identity, userId, source, true);
        await syncDeafenFromAttrs(store, sse, roomId, identity, userId, pAttrs);
        break;

      case 'track_unmuted':
        await applyTrackMute(store, sse, roomId, identity, userId, source, false);
        await syncDeafenFromAttrs(store, sse, roomId, identity, userId, pAttrs);
        break;

      case 'track_published':
        // stopMicTrackOnMute:false means LiveKit re-/unpublishes the mic track instead of
        // sending track_muted/track_unmuted — handle MICROPHONE here too.
        await applyTrackPublish(store, sse, roomId, identity, userId, source, track?.muted ?? false);
        await syncDeafenFromAttrs(store, sse, roomId, identity, userId, pAttrs);
        break;

      case 'track_unpublished':
        // Mirror of track_published: MICROPHONE unpublish = muted.
        await applyTrackPublish(store, sse, roomId, identity, userId, source, true);
        await syncDeafenFromAttrs(store, sse, roomId, identity, userId, pAttrs);
        break;

      case 'participant_attributes_changed': {
        const attrs = (p?.attributes ?? {}) as Record<string, string>;
        await applyPatch(store, sse, roomId, identity, userId, { isDeafened: attrs.isDeafened === '1' });
        console.debug(`[attrs] ${userId} isDeafened=${attrs.isDeafened} in ${roomId}`);
        break;
      }

      default:
        if (eventName) {
          console.debug(`[webhook] Unhandled event type: ${eventName}`);
        }
        break;
    }

    return c.text('ok');
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

async function applyPatch(
  store: VoiceStateStore,
  sse: SSEManager,
  roomId: string,
  identity: string,
  userId: string,
  patch: Partial<ParticipantPresence>,
): Promise<void> {
  const result = await store.setPresence(roomId, identity, userId, patch);
  // result.next is always the aggregated user-level state (contract from store interface)
  if (result?.changed) {
    sse.broadcast(roomId, userId, result.next, 'update');
  }
}

async function applyTrackMute(
  store: VoiceStateStore,
  sse: SSEManager,
  roomId: string,
  identity: string,
  userId: string,
  source: TrackSource | undefined,
  muted: boolean,
): Promise<void> {
  if (source === 'MICROPHONE') {
    await applyPatch(store, sse, roomId, identity, userId, { isMicMuted: muted });
    console.debug(`[${muted ? 'muted' : 'unmuted'}] ${userId} source=MICROPHONE in ${roomId}`);
  } else if (source === 'CAMERA') {
    await applyPatch(store, sse, roomId, identity, userId, { isCameraOn: !muted });
    console.debug(`[${muted ? 'muted' : 'unmuted'}] ${userId} source=CAMERA in ${roomId}`);
  } else if (source === 'SCREEN_SHARE') {
    await applyPatch(store, sse, roomId, identity, userId, { isScreenSharing: !muted });
    console.debug(`[${muted ? 'muted' : 'unmuted'}] ${userId} source=SCREEN_SHARE in ${roomId}`);
  }
}

async function applyTrackPublish(
  store: VoiceStateStore,
  sse: SSEManager,
  roomId: string,
  identity: string,
  userId: string,
  source: TrackSource | undefined,
  trackMuted: boolean,
): Promise<void> {
  if (source === 'MICROPHONE') {
    await applyPatch(store, sse, roomId, identity, userId, { isMicMuted: trackMuted });
    console.debug(`[published] ${userId} source=MICROPHONE muted=${trackMuted} in ${roomId}`);
  } else if (source === 'CAMERA') {
    await applyPatch(store, sse, roomId, identity, userId, { isCameraOn: !trackMuted });
    console.debug(`[published] ${userId} source=CAMERA muted=${trackMuted} in ${roomId}`);
  } else if (source === 'SCREEN_SHARE') {
    await applyPatch(store, sse, roomId, identity, userId, { isScreenSharing: !trackMuted });
    console.debug(`[published] ${userId} source=SCREEN_SHARE muted=${trackMuted} in ${roomId}`);
  }
}

/**
 * If the participant's attributes contain an explicit `isDeafened` key,
 * sync the deafen state into the presence entry.
 * A missing key is NOT treated as "not deafened" — only an explicit value is applied.
 */
async function syncDeafenFromAttrs(
  store: VoiceStateStore,
  sse: SSEManager,
  roomId: string,
  identity: string,
  userId: string,
  attrs: Record<string, string> | undefined,
): Promise<void> {
  if (!attrs || !('isDeafened' in attrs)) return;
  await applyPatch(store, sse, roomId, identity, userId, { isDeafened: attrs.isDeafened === '1' });
}
