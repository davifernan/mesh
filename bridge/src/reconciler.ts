/**
 * LiveKit reconciler — keeps the voice state store authoritative by querying
 * the LiveKit RoomServiceClient for ground truth.
 *
 * Two reconcile modes:
 *
 *   1. Startup reconcile  — called once at boot; iterates all active LiveKit
 *      rooms and seeds the store with current participant state.
 *
 *   2. Lazy reconcile     — called before serving an empty snapshot for a room;
 *      queries LiveKit for that specific room and populates the store if
 *      participants are found. Prevents stale-empty responses after bridge
 *      restarts.
 *
 * Both modes are no-ops when LIVEKIT_URL is not set (reconcileEnabled = false).
 *
 * Participant → presence mapping mirrors the webhook handler logic so that
 * reconciled state is identical to what a fresh webhook stream would produce.
 */

import { RoomServiceClient } from 'livekit-server-sdk';
import type { ParticipantInfo } from '@livekit/protocol';
import { TrackSource as LKTrackSource } from '@livekit/protocol';
import type { VoiceStateStore } from './store.js';
import type { BridgeStats, ParticipantPresence } from './types.js';
import { resolveMatrixUserId } from './identity.js';

// ── Reconciler ────────────────────────────────────────────────────────────────

export class Reconciler {
  private readonly client: RoomServiceClient;
  private readonly store: VoiceStateStore;
  private readonly stats: BridgeStats;

  constructor(livekitUrl: string, apiKey: string, apiSecret: string, store: VoiceStateStore, stats: BridgeStats) {
    this.client = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
    this.store = store;
    this.stats = stats;
  }

  /**
   * Startup reconcile: list all active rooms from LiveKit and seed the store.
   * Called once at bridge startup. Errors are logged but do not crash the bridge.
   */
  async reconcileAll(): Promise<void> {
    let rooms: Awaited<ReturnType<RoomServiceClient['listRooms']>>;
    try {
      rooms = await this.client.listRooms();
    } catch (err) {
      console.warn('[reconciler] startup reconcileAll failed — LiveKit unreachable?', (err as Error).message);
      return;
    }

    const activeRoomIds = new Set(rooms.map((room) => room.name).filter((name): name is string => Boolean(name)));
    const knownRoomIds = await this.store.listRoomIds();

    for (const roomId of knownRoomIds) {
      if (!activeRoomIds.has(roomId)) {
        await this.store.clearRoom(roomId);
      }
    }

    let reconciled = 0;
    for (const room of rooms) {
      if (!room.name) continue;
      try {
        await this._reconcileRoom(room.name);
        reconciled++;
      } catch (err) {
        console.warn(`[reconciler] failed to reconcile room ${room.name}:`, (err as Error).message);
      }
    }

    this.stats.lastReconcileAt = Date.now();
    this.stats.startupRoomsReconciled = reconciled;
    console.log(`[reconciler] startup reconcile complete — ${reconciled} room(s) seeded`);
  }

  /**
   * Lazy reconcile: reconcile a single room before serving an empty snapshot.
   * Returns true if any participants were found and seeded.
   */
  async reconcileRoom(roomId: string): Promise<boolean> {
    try {
      const count = await this._reconcileRoom(roomId);
      if (count > 0) {
        this.stats.lastReconcileAt = Date.now();
        console.log(`[reconciler] lazy reconcile for ${roomId} — ${count} participant(s) seeded`);
      }
      return count > 0;
    } catch (err) {
      console.warn(`[reconciler] lazy reconcile for ${roomId} failed:`, (err as Error).message);
      return false;
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async _reconcileRoom(roomId: string): Promise<number> {
    const participants = await this.client.listParticipants(roomId);
    await this.store.clearRoom(roomId);
    if (participants.length === 0) return 0;

    for (const p of participants) {
      const presence = participantToPresence(p);
      await this.store.joinPresence(roomId, p.identity, presence.userId, presence.state);
    }

    return participants.length;
  }
}

// ── Participant → presence mapping ────────────────────────────────────────────

/**
 * Convert a LiveKit ParticipantInfo (from RoomServiceClient) into the
 * identity + presence pair used by the store.
 *
 * Mirrors the participant_joined branch in webhookHandler.ts.
 */
function participantToPresence(p: ParticipantInfo): {
  userId: string;
  state: ParticipantPresence;
} {
  const attrs = p.attributes as Record<string, string> | undefined;
  const meta = typeof p.metadata === 'string' ? p.metadata : undefined;
  const userId = resolveMatrixUserId(p.identity, attrs, meta);

  const state: ParticipantPresence = {
    isMicMuted: false,
    isCameraOn: false,
    isScreenSharing: false,
    isDeafened: attrs?.isDeafened === '1',
    updatedAt: Date.now(),
    type: 'update',
  };

  for (const track of p.tracks) {
    // TrackSource is a numeric enum from @livekit/protocol
    if (track.source === LKTrackSource.MICROPHONE) {
      state.isMicMuted = track.muted;
    } else if (track.source === LKTrackSource.CAMERA) {
      state.isCameraOn = !track.muted;
    } else if (track.source === LKTrackSource.SCREEN_SHARE) {
      state.isScreenSharing = !track.muted;
    }
  }

  return { userId, state };
}
