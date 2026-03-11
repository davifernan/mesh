/**
 * Voice state store — pluggable async interface + in-memory implementation.
 *
 * The interface is async so that Redis-backed (or any other remote) implementations
 * can be dropped in without touching any other module.
 *
 * Design notes:
 *   - Two-map structure for multi-device support (Fix F from original):
 *       identityState: roomId → identity → { userId, presence }
 *       roomState:     roomId → userId   → aggregated presence
 *   - setPresence skips broadcast when nothing changed (Fix E).
 *   - removePresence recomputes aggregated state across remaining devices.
 *   - All interface methods return Promise so Redis/network stores work cleanly.
 *   - Per-room monotonic seq counter: incremented on every join/set/remove that
 *     produces a state change. Never reset on clearRoom so reconcile cannot
 *     cause seq regression on connected clients.
 */

import type { ParticipantPresence } from './types.js';

// ── Store interface ───────────────────────────────────────────────────────────

export interface VoiceStateStore {
  /**
   * Upsert presence for a specific identity (device) within a room.
   * Returns the new **aggregated** presence for the userId (across all devices),
   * or null if nothing changed.
   *
   * `next` is always the aggregated user-level state, never the raw device state.
   * `next.seq` is the freshly allocated room-level sequence number.
   */
  setPresence(
    roomId: string,
    identity: string,
    userId: string,
    patch: Partial<ParticipantPresence>,
  ): Promise<{ changed: boolean; next: ParticipantPresence } | null>;

  /**
   * Remove a specific identity from a room.
   * Returns:
   *   - `null` when the identity/userId was never tracked (no-op, no broadcast needed).
   *   - `{ userId, remaining: 0, aggregated: null, seq }` when the last device left.
   *     `seq` is the freshly allocated room-level counter for the departure event.
   *   - `{ userId, remaining: N, aggregated: ParticipantPresence, seq }` when N devices remain
   *     (aggregated reflects the updated user-level state after removal; seq is embedded in aggregated).
   */
  removePresence(
    roomId: string,
    identity: string,
    userId: string,
  ): Promise<{
    userId: string;
    remaining: number;
    aggregated: ParticipantPresence | null;
    /** Room-level seq allocated for this removal event. */
    seq: number;
  } | null>;

  /**
   * Initialise presence for a newly joined identity.
   * Always sets the entry (no change-detection skip).
   * Returns the stored presence (with seq assigned).
   */
  joinPresence(
    roomId: string,
    identity: string,
    userId: string,
    initial: ParticipantPresence,
  ): Promise<ParticipantPresence>;

  /**
   * Return the aggregated presence snapshot for a room.
   * Keys are userId strings.
   */
  getRoomSnapshot(roomId: string): Promise<Map<string, ParticipantPresence>>;

  /** Total number of rooms with at least one participant. */
  roomCount(): Promise<number>;

  /** List known room IDs currently tracked by the store. */
  listRoomIds(): Promise<string[]>;

  /** Remove all state for a room. Used by reconcile to drop stale snapshots. */
  clearRoom(roomId: string): Promise<void>;
}

// ── Default presence ──────────────────────────────────────────────────────────

const DEFAULT_PRESENCE: Omit<ParticipantPresence, 'updatedAt' | 'type' | 'seq'> = {
  isMicMuted: false,
  isCameraOn: false,
  isScreenSharing: false,
  isDeafened: false,
};

function aggregatePresences(candidates: ParticipantPresence[]): ParticipantPresence | null {
  if (candidates.length === 0) return null;

  const newestUpdatedAt = Math.max(...candidates.map((presence) => presence.updatedAt));
  const highestSeq = Math.max(...candidates.map((presence) => presence.seq ?? 0));

  return {
    isMicMuted: candidates.every((presence) => presence.isMicMuted),
    isCameraOn: candidates.some((presence) => presence.isCameraOn),
    isScreenSharing: candidates.some((presence) => presence.isScreenSharing),
    isDeafened: candidates.some((presence) => presence.isDeafened),
    updatedAt: newestUpdatedAt,
    seq: highestSeq,
    type: 'update',
  };
}

// ── In-memory implementation ──────────────────────────────────────────────────

export class InMemoryVoiceStateStore implements VoiceStateStore {
  /** identity → { userId, presence } per room */
  private readonly identityState = new Map<
    string,
    Map<string, { userId: string; presence: ParticipantPresence }>
  >();

  /** userId → aggregated presence per room (derived, for fast reads) */
  private readonly roomState = new Map<string, Map<string, ParticipantPresence>>();

  /**
   * Per-room monotonic sequence counter.
   * Intentionally NOT cleared on clearRoom — seq must never regress for
   * clients that stay connected across a reconcile cycle.
   */
  private readonly roomSeq = new Map<string, number>();

  // ── Private helpers ─────────────────────────────────────────────────────────

  private nextSeq(roomId: string): number {
    const current = this.roomSeq.get(roomId) ?? 0;
    const next = current + 1;
    this.roomSeq.set(roomId, next);
    return next;
  }

  private ensureRoom(roomId: string): Map<string, ParticipantPresence> {
    if (!this.roomState.has(roomId)) this.roomState.set(roomId, new Map());
    return this.roomState.get(roomId)!;
  }

  private ensureIdentityRoom(
    roomId: string,
  ): Map<string, { userId: string; presence: ParticipantPresence }> {
    if (!this.identityState.has(roomId)) this.identityState.set(roomId, new Map());
    return this.identityState.get(roomId)!;
  }

  /**
   * Recompute the aggregated roomState entry for userId across all active
   * identities/devices, then stamp the result with the provided seq.
   *
   * Aggregation semantics:
   *   - micMuted      => true only when ALL active devices are muted
   *   - cameraOn      => true when ANY active device has camera on
   *   - screenSharing => true when ANY active device is sharing
   *   - deafened      => true when ANY active device is deafened
   *   - updatedAt     => latest device update timestamp
   *   - seq           => caller-provided room-level counter
   */
  private recompute(roomId: string, userId: string, seq: number): ParticipantPresence | null {
    const idRoom = this.identityState.get(roomId);
    const candidates: ParticipantPresence[] = [];

    if (idRoom) {
      for (const entry of idRoom.values()) {
        if (entry.userId === userId) candidates.push(entry.presence);
      }
    }

    if (candidates.length === 0) {
      // No identities remain — clean up roomState
      const room = this.roomState.get(roomId);
      if (room) {
        room.delete(userId);
        if (room.size === 0) this.roomState.delete(roomId);
      }
      return null;
    }

    const aggregated = aggregatePresences(candidates);
    if (!aggregated) return null;
    // Override seq with the freshly allocated room-level counter
    aggregated.seq = seq;
    this.ensureRoom(roomId).set(userId, aggregated);
    return aggregated;
  }

  // ── VoiceStateStore implementation ─────────────────────────────────────────

  async joinPresence(
    roomId: string,
    identity: string,
    userId: string,
    initial: ParticipantPresence,
  ): Promise<ParticipantPresence> {
    const seq = this.nextSeq(roomId);
    const withSeq: ParticipantPresence = { ...initial, seq };
    this.ensureIdentityRoom(roomId).set(identity, { userId, presence: withSeq });
    return this.recompute(roomId, userId, seq) ?? withSeq;
  }

  async setPresence(
    roomId: string,
    identity: string,
    userId: string,
    patch: Partial<ParticipantPresence>,
  ): Promise<{ changed: boolean; next: ParticipantPresence } | null> {
    const idRoom = this.ensureIdentityRoom(roomId);
    const existing = idRoom.get(identity);
    const prev: ParticipantPresence = existing?.presence ?? {
      ...DEFAULT_PRESENCE,
      updatedAt: 0,
      seq: 0,
      type: 'update',
    };

    const next: ParticipantPresence = {
      ...prev,
      ...patch,
      updatedAt: Date.now(),
      // seq placeholder — will be overwritten by recompute on change
      seq: prev.seq,
      type: 'update',
    };

    // Skip if nothing meaningful changed (Fix E)
    const changed =
      next.isMicMuted !== prev.isMicMuted ||
      next.isCameraOn !== prev.isCameraOn ||
      next.isScreenSharing !== prev.isScreenSharing ||
      next.isDeafened !== prev.isDeafened;

    if (!changed) {
      // Return the current aggregated state (not the raw device state)
      const currentAggregated = this.roomState.get(roomId)?.get(userId) ?? prev;
      return { changed: false, next: currentAggregated };
    }

    idRoom.set(identity, { userId, presence: next });
    const seq = this.nextSeq(roomId);
    const aggregated = this.recompute(roomId, userId, seq);
    return { changed: true, next: aggregated ?? { ...next, seq } };
  }

  async removePresence(
    roomId: string,
    identity: string,
    userId: string,
  ): Promise<{
    userId: string;
    remaining: number;
    aggregated: ParticipantPresence | null;
    seq: number;
  } | null> {
    const idRoom = this.identityState.get(roomId);

    // Clean up identity entry
    if (idRoom) {
      idRoom.delete(identity);
      if (idRoom.size === 0) this.identityState.delete(roomId);
    }

    // Guard: if userId was never tracked, return null so callers don't broadcast spurious events
    const room = this.roomState.get(roomId);
    if (!room?.has(userId)) {
      return null;
    }

    // Count remaining identities for this userId (idRoom was mutated above)
    const remaining = idRoom
      ? Array.from(idRoom.values()).filter((e) => e.userId === userId).length
      : 0;

    const seq = this.nextSeq(roomId);

    // recompute cleans up roomState when remaining === 0
    const aggregated = this.recompute(roomId, userId, seq);
    return { userId, remaining, aggregated, seq };
  }

  async getRoomSnapshot(roomId: string): Promise<Map<string, ParticipantPresence>> {
    return this.roomState.get(roomId) ?? new Map();
  }

  async roomCount(): Promise<number> {
    return this.roomState.size;
  }

  async listRoomIds(): Promise<string[]> {
    return Array.from(this.roomState.keys());
  }

  async clearRoom(roomId: string): Promise<void> {
    // NOTE: roomSeq is intentionally NOT cleared here.
    // Seq must never regress for clients connected across a reconcile cycle.
    this.roomState.delete(roomId);
    this.identityState.delete(roomId);
  }

  // ── Test-only accessors ─────────────────────────────────────────────────────

  /** @internal Exposed for unit tests only. */
  get _identityState() {
    return this.identityState;
  }

  /** @internal Exposed for unit tests only. */
  get _roomState() {
    return this.roomState;
  }

  /** @internal Exposed for unit tests only. */
  get _roomSeq() {
    return this.roomSeq;
  }
}
