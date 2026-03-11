/**
 * Shared types for the BetterCord Presence Bridge.
 *
 * These types are the contract between all bridge modules and are also
 * the wire format consumed by BridgePresenceProvider on the frontend.
 */

// ── Presence payload ──────────────────────────────────────────────────────────

export type ParticipantPresence = {
  isMicMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isDeafened: boolean;
  updatedAt: number;
  /**
   * Monotonic per-room sequence number. Assigned by the store on every
   * join/set/remove operation. Strictly increasing within a room; never
   * reset when the room is cleared (reconcile). Consumers use this to
   * deduplicate and order events even when wall-clock timestamps collide.
   */
  seq: number;
  /** Protocol discriminator — 'update' for live state, 'left' when participant departs. */
  type: 'update' | 'left';
};

// ── SSE wire event ────────────────────────────────────────────────────────────

/**
 * Sentinel event sent after the initial snapshot replay on a new SSE stream.
 * Clients use this to know that all snapshot events have been delivered and
 * any subsequent events are live updates (seq > snapshotSeq).
 */
export type SnapshotEndEvent = {
  type: 'snapshot_end';
  /** The highest seq seen in the snapshot (0 when snapshot was empty). */
  seq: number;
};

// ── LiveKit track source ──────────────────────────────────────────────────────

export type TrackSource =
  | 'UNKNOWN'
  | 'CAMERA'
  | 'MICROPHONE'
  | 'SCREEN_SHARE'
  | 'SCREEN_SHARE_AUDIO';

// ── SSE send function ─────────────────────────────────────────────────────────

/** Function that pushes a raw SSE payload string to a connected client. */
export type SendFn = (payload: string) => void;

// ── Bridge stats (exposed on /health) ────────────────────────────────────────

export type BridgeStats = {
  webhooksReceived: number;
  webhooksRejected: number;
  webhookEventCounts: Record<string, number>;
  sseConnectionsTotal: number;
  sseConnectionsActive: number;
  /** Which store backend is active. */
  storeBackend: 'memory' | 'redis';
  /** Whether a Redis connection is currently healthy (only meaningful when storeBackend=redis). */
  redisConnected: boolean;
  /** Whether LiveKit reconcile is enabled (LIVEKIT_URL is set). */
  reconcileEnabled: boolean;
  /** Timestamp (ms) of the last successful reconcile, or 0 if never. */
  lastReconcileAt: number;
  /** Number of rooms reconciled on startup. */
  startupRoomsReconciled: number;
};
