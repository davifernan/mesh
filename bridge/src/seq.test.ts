/**
 * Focused tests for per-room seq ordering and snapshot/stream replay correctness.
 *
 * Covers:
 *   1. Seq is monotonically increasing within a room across join/set/remove.
 *   2. Seq is independent across rooms.
 *   3. clearRoom does NOT reset seq (reconcile safety).
 *   4. Seq is embedded in all broadcast payloads (join, update, left).
 *   5. snapshot_end sentinel carries the correct snapshotSeq.
 *   6. Live events with seq ≤ snapshotSeq are discarded by the client logic.
 *   7. Live events with seq > snapshotSeq are applied in order.
 *   8. Legacy payloads without seq fall back to updatedAt comparison.
 */

import { describe, expect, it, beforeEach } from 'bun:test';
import { InMemoryVoiceStateStore } from './store.js';
import { SSEManager } from './sseManager.js';
import type { BridgeStats, ParticipantPresence } from './types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ROOM = '!room:server.com';
const ROOM2 = '!room2:server.com';
const USER = '@alice:server.com';
const ID1 = `${USER}_DEVICE1`;
const ID2 = `${USER}_DEVICE2`;

function makePresence(overrides: Partial<ParticipantPresence> = {}): ParticipantPresence {
  return {
    isMicMuted: false,
    isCameraOn: false,
    isScreenSharing: false,
    isDeafened: false,
    updatedAt: Date.now(),
    seq: 0,
    type: 'update',
    ...overrides,
  };
}

function makeStats(): BridgeStats {
  return {
    webhooksReceived: 0,
    webhooksRejected: 0,
    webhookEventCounts: {},
    sseConnectionsTotal: 0,
    sseConnectionsActive: 0,
    storeBackend: 'memory',
    redisConnected: false,
    reconcileEnabled: false,
    lastReconcileAt: 0,
    startupRoomsReconciled: 0,
  };
}

// ── 1. Seq monotonicity ───────────────────────────────────────────────────────

describe('seq — monotonicity', () => {
  let store: InMemoryVoiceStateStore;

  beforeEach(() => {
    store = new InMemoryVoiceStateStore();
  });

  it('join assigns seq=1 to first participant', async () => {
    const result = await store.joinPresence(ROOM, ID1, USER, makePresence());
    expect(result.seq).toBe(1);
  });

  it('second join increments seq to 2', async () => {
    await store.joinPresence(ROOM, ID1, USER, makePresence());
    const result = await store.joinPresence(ROOM, ID2, USER, makePresence());
    expect(result.seq).toBe(2);
  });

  it('setPresence increments seq on change', async () => {
    await store.joinPresence(ROOM, ID1, USER, makePresence({ isMicMuted: false }));
    const result = await store.setPresence(ROOM, ID1, USER, { isMicMuted: true });
    expect(result?.changed).toBe(true);
    expect(result?.next.seq).toBe(2);
  });

  it('setPresence does NOT increment seq when nothing changed', async () => {
    await store.joinPresence(ROOM, ID1, USER, makePresence({ isMicMuted: true }));
    const result = await store.setPresence(ROOM, ID1, USER, { isMicMuted: true });
    expect(result?.changed).toBe(false);
    // seq stays at 1 (no new seq allocated)
    expect(result?.next.seq).toBe(1);
    expect(store._roomSeq.get(ROOM)).toBe(1);
  });

  it('removePresence increments seq', async () => {
    await store.joinPresence(ROOM, ID1, USER, makePresence());
    const result = await store.removePresence(ROOM, ID1, USER);
    expect(result?.seq).toBe(2);
  });

  it('seq is strictly increasing across join → set → remove', async () => {
    const r1 = await store.joinPresence(ROOM, ID1, USER, makePresence({ isMicMuted: false }));
    expect(r1.seq).toBe(1);

    const r2 = await store.setPresence(ROOM, ID1, USER, { isMicMuted: true });
    expect(r2?.next.seq).toBe(2);

    const r3 = await store.setPresence(ROOM, ID1, USER, { isCameraOn: true });
    expect(r3?.next.seq).toBe(3);

    const r4 = await store.removePresence(ROOM, ID1, USER);
    expect(r4?.seq).toBe(4);
  });

  it('snapshot reflects the latest seq after multiple operations', async () => {
    await store.joinPresence(ROOM, ID1, USER, makePresence());
    await store.setPresence(ROOM, ID1, USER, { isMicMuted: true });
    await store.setPresence(ROOM, ID1, USER, { isCameraOn: true });

    const snap = (await store.getRoomSnapshot(ROOM)).get(USER);
    expect(snap?.seq).toBe(3);
  });
});

// ── 2. Seq independence across rooms ─────────────────────────────────────────

describe('seq — room independence', () => {
  let store: InMemoryVoiceStateStore;

  beforeEach(() => {
    store = new InMemoryVoiceStateStore();
  });

  it('seq counters are independent per room', async () => {
    const r1 = await store.joinPresence(ROOM, ID1, USER, makePresence());
    const r2 = await store.joinPresence(ROOM2, ID1, USER, makePresence());

    expect(r1.seq).toBe(1);
    expect(r2.seq).toBe(1); // independent counter for ROOM2
  });

  it('operations in one room do not affect seq in another', async () => {
    await store.joinPresence(ROOM, ID1, USER, makePresence());
    await store.setPresence(ROOM, ID1, USER, { isMicMuted: true });
    await store.setPresence(ROOM, ID1, USER, { isCameraOn: true });

    const r = await store.joinPresence(ROOM2, ID1, USER, makePresence());
    expect(r.seq).toBe(1); // ROOM2 starts fresh
  });
});

// ── 3. clearRoom does NOT reset seq ──────────────────────────────────────────

describe('seq — clearRoom safety', () => {
  let store: InMemoryVoiceStateStore;

  beforeEach(() => {
    store = new InMemoryVoiceStateStore();
  });

  it('clearRoom does not reset the seq counter', async () => {
    await store.joinPresence(ROOM, ID1, USER, makePresence());
    await store.setPresence(ROOM, ID1, USER, { isMicMuted: true });
    // seq is now 2
    expect(store._roomSeq.get(ROOM)).toBe(2);

    await store.clearRoom(ROOM);

    // seq counter must survive clearRoom
    expect(store._roomSeq.get(ROOM)).toBe(2);
  });

  it('after clearRoom, next join gets seq=3 (not seq=1)', async () => {
    await store.joinPresence(ROOM, ID1, USER, makePresence());
    await store.setPresence(ROOM, ID1, USER, { isMicMuted: true });
    await store.clearRoom(ROOM);

    const result = await store.joinPresence(ROOM, ID1, USER, makePresence());
    expect(result.seq).toBe(3); // continues from where it left off
  });
});

// ── 4. Seq in broadcast payloads ─────────────────────────────────────────────

describe('seq — broadcast payloads', () => {
  let store: InMemoryVoiceStateStore;
  let stats: BridgeStats;

  beforeEach(() => {
    store = new InMemoryVoiceStateStore();
    stats = makeStats();
  });

  it('broadcast payload includes seq from store result', () => {
    const sse = new SSEManager(stats);
    const captured: string[] = [];
    sse.subscribe(ROOM, (payload) => captured.push(payload));

    const presence: ParticipantPresence = {
      isMicMuted: true,
      isCameraOn: false,
      isScreenSharing: false,
      isDeafened: false,
      updatedAt: Date.now(),
      seq: 42,
      type: 'update',
    };

    sse.broadcast(ROOM, USER, presence, 'update');

    expect(captured).toHaveLength(1);
    const parsed = JSON.parse(captured[0]);
    expect(parsed.seq).toBe(42);
    expect(parsed.type).toBe('update');
    expect(parsed.userId).toBe(USER);
  });

  it('left broadcast includes seq', () => {
    const sse = new SSEManager(stats);
    const captured: string[] = [];
    sse.subscribe(ROOM, (payload) => captured.push(payload));

    const leftPresence: ParticipantPresence = {
      isMicMuted: false,
      isCameraOn: false,
      isScreenSharing: false,
      isDeafened: false,
      updatedAt: Date.now(),
      seq: 7,
      type: 'left',
    };

    sse.broadcast(ROOM, USER, leftPresence, 'left');

    const parsed = JSON.parse(captured[0]);
    expect(parsed.seq).toBe(7);
    expect(parsed.type).toBe('left');
  });
});

// ── 5. snapshot_end sentinel ──────────────────────────────────────────────────

describe('seq — snapshot_end sentinel', () => {
  it('sendSnapshotEnd sends correct sentinel payload', () => {
    const stats = makeStats();
    const sse = new SSEManager(stats);
    const captured: string[] = [];

    sse.sendSnapshotEnd((payload) => captured.push(payload), 15);

    expect(captured).toHaveLength(1);
    const parsed = JSON.parse(captured[0]);
    expect(parsed.type).toBe('snapshot_end');
    expect(parsed.seq).toBe(15);
  });

  it('sendSnapshotEnd with seq=0 for empty snapshot', () => {
    const stats = makeStats();
    const sse = new SSEManager(stats);
    const captured: string[] = [];

    sse.sendSnapshotEnd((payload) => captured.push(payload), 0);

    const parsed = JSON.parse(captured[0]);
    expect(parsed.type).toBe('snapshot_end');
    expect(parsed.seq).toBe(0);
  });
});

// ── 6–8. Client-side dedup/ordering logic ────────────────────────────────────
// These tests exercise the isNewer() logic extracted from BridgePresenceProvider
// as a pure function to verify the ordering rules without a DOM environment.

/**
 * Extracted isNewer logic (mirrors BridgePresenceProvider.tsx exactly).
 * Pass hasExisting=false to simulate no existing entry in the presence map.
 */
function isNewer(
  inSeq: number | undefined,
  inUpdatedAt: number,
  exSeq: number | undefined,
  exUpdatedAt: number,
  snapshotSeq: number,
  hasExisting = true,
): boolean {
  // After snapshot_end: discard live events that were already in the snapshot.
  // This check fires BEFORE the !existing guard — matches provider behaviour.
  if (snapshotSeq >= 0 && inSeq !== undefined && inSeq <= snapshotSeq) {
    return false;
  }

  if (!hasExisting) return true; // no existing entry

  if (inSeq !== undefined && exSeq !== undefined && exSeq > 0) {
    return inSeq > exSeq;
  }
  if (inSeq !== undefined && (exSeq === undefined || exSeq === 0)) {
    return true; // incoming has seq, existing doesn't — incoming is newer
  }
  // Fallback: wall-clock comparison (legacy payloads without seq)
  return inUpdatedAt >= exUpdatedAt;
}

describe('client isNewer — seq-based ordering', () => {
  it('higher seq wins over lower seq', () => {
    expect(isNewer(5, 1000, 3, 1000, -1)).toBe(true);
    expect(isNewer(3, 1000, 5, 1000, -1)).toBe(false);
  });

  it('equal seq is not newer', () => {
    expect(isNewer(5, 1000, 5, 1000, -1)).toBe(false);
  });

  it('incoming with seq beats existing without seq', () => {
    expect(isNewer(1, 500, 0, 1000, -1)).toBe(true);
  });

  it('fallback to updatedAt when neither has seq', () => {
    expect(isNewer(undefined, 2000, undefined, 1000, -1)).toBe(true);
    expect(isNewer(undefined, 1000, undefined, 2000, -1)).toBe(false);
    expect(isNewer(undefined, 1000, undefined, 1000, -1)).toBe(true); // equal ts: accept
  });

  it('discards event with seq ≤ snapshotSeq (snapshot dedup)', () => {
    // snapshotSeq = 10; incoming seq = 8 → discard
    expect(isNewer(8, 9999, 5, 1000, 10)).toBe(false);
    // incoming seq = 10 → discard (equal)
    expect(isNewer(10, 9999, 5, 1000, 10)).toBe(false);
    // incoming seq = 11 → accept (live update)
    expect(isNewer(11, 9999, 5, 1000, 10)).toBe(true);
  });

  it('accepts all events during snapshot replay (snapshotSeq = -1)', () => {
    // snapshotSeq = -1 means snapshot_end not yet received
    expect(isNewer(1, 1000, undefined, 0, -1)).toBe(true);
    expect(isNewer(5, 1000, 3, 500, -1)).toBe(true);
  });

  it('no existing entry: accept when no snapshotSeq filter applies', () => {
    // During snapshot replay (snapshotSeq=-1): no existing entry → accept
    expect(isNewer(5, 1000, undefined, 0, -1, false)).toBe(true);
    // After snapshot_end (snapshotSeq=10): seq=5 ≤ 10 → discard even with no existing entry
    // (snapshotSeq check fires before !existing guard)
    expect(isNewer(5, 1000, undefined, 0, 10, false)).toBe(false);
    // After snapshot_end: seq=11 > 10 → accept (new user joined after snapshot)
    expect(isNewer(11, 1000, undefined, 0, 10, false)).toBe(true);
  });
});

// ── Integration: store seq flows through to snapshot ─────────────────────────

describe('seq — end-to-end store flow', () => {
  let store: InMemoryVoiceStateStore;

  beforeEach(() => {
    store = new InMemoryVoiceStateStore();
  });

  it('snapshot contains correct seq after multiple operations', async () => {
    // Simulate: join, mute, camera on, second device joins
    await store.joinPresence(ROOM, ID1, USER, makePresence({ isMicMuted: false }));
    await store.setPresence(ROOM, ID1, USER, { isMicMuted: true });
    await store.setPresence(ROOM, ID1, USER, { isCameraOn: true });
    await store.joinPresence(ROOM, ID2, USER, makePresence({ isMicMuted: false }));

    const snap = (await store.getRoomSnapshot(ROOM)).get(USER);
    // 4 operations → seq = 4
    expect(snap?.seq).toBe(4);
  });

  it('after clearRoom + rejoin, snapshot seq continues from pre-clear value', async () => {
    await store.joinPresence(ROOM, ID1, USER, makePresence());
    await store.setPresence(ROOM, ID1, USER, { isMicMuted: true });
    // seq = 2 before clear

    await store.clearRoom(ROOM);

    await store.joinPresence(ROOM, ID1, USER, makePresence());
    const snap = (await store.getRoomSnapshot(ROOM)).get(USER);
    // seq continues: 3
    expect(snap?.seq).toBe(3);
  });

  it('multi-device: aggregated seq is the freshly allocated counter, not max of device seqs', async () => {
    // Both devices join with seq=0 (as if seeded by reconciler)
    await store.joinPresence(ROOM, ID1, USER, makePresence({ seq: 0 }));
    // seq counter = 1 after first join
    await store.joinPresence(ROOM, ID2, USER, makePresence({ seq: 0 }));
    // seq counter = 2 after second join

    const snap = (await store.getRoomSnapshot(ROOM)).get(USER);
    // Aggregated seq should be 2 (the freshly allocated counter from second join)
    expect(snap?.seq).toBe(2);
  });
});
