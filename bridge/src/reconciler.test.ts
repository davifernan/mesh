/**
 * Unit tests for reconciler.ts
 *
 * Uses a mock RoomServiceClient to avoid real LiveKit connections.
 * Tests cover:
 *   - reconcileAll: seeds store from all active rooms
 *   - reconcileRoom: lazy reconcile for a single room
 *   - Participant → presence mapping (mic, camera, screenshare, deafen)
 *   - Error resilience (LiveKit unreachable)
 */

import { describe, expect, it, beforeEach, mock, spyOn } from 'bun:test';
import { InMemoryVoiceStateStore } from './store.js';
import type { BridgeStats } from './types.js';

// ── Minimal stats fixture ─────────────────────────────────────────────────────

function makeStats(): BridgeStats {
  return {
    webhooksReceived: 0,
    webhooksRejected: 0,
    webhookEventCounts: {},
    sseConnectionsTotal: 0,
    sseConnectionsActive: 0,
    storeBackend: 'memory',
    redisConnected: false,
    reconcileEnabled: true,
    lastReconcileAt: 0,
    startupRoomsReconciled: 0,
  };
}

// ── Mock LiveKit participant builder ──────────────────────────────────────────

import { TrackSource as LKTrackSource } from '@livekit/protocol';

function makeParticipant(
  identity: string,
  opts: {
    micMuted?: boolean;
    cameraOn?: boolean;
    screenSharing?: boolean;
    isDeafened?: boolean;
  } = {},
) {
  const tracks: Array<{ source: number; muted: boolean }> = [];

  if (opts.micMuted !== undefined) {
    tracks.push({ source: LKTrackSource.MICROPHONE, muted: opts.micMuted });
  }
  if (opts.cameraOn !== undefined) {
    tracks.push({ source: LKTrackSource.CAMERA, muted: !opts.cameraOn });
  }
  if (opts.screenSharing !== undefined) {
    tracks.push({ source: LKTrackSource.SCREEN_SHARE, muted: !opts.screenSharing });
  }

  return {
    identity,
    tracks,
    attributes: opts.isDeafened ? { isDeafened: '1' } : {},
  };
}

function makePresence() {
  return {
    isMicMuted: false,
    isCameraOn: false,
    isScreenSharing: false,
    isDeafened: false,
    updatedAt: Date.now(),
    seq: 0,
    type: 'update' as const,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Reconciler', () => {
  let store: InMemoryVoiceStateStore;
  let stats: BridgeStats;

  beforeEach(() => {
    store = new InMemoryVoiceStateStore();
    stats = makeStats();
  });

  it('reconcileAll seeds store from all active rooms', async () => {
    // Dynamically import so we can mock the RoomServiceClient constructor
    const { Reconciler } = await import('./reconciler.js');
    const { RoomServiceClient } = await import('livekit-server-sdk');

    const mockListRooms = mock(async () => [{ name: '!room1:server' }, { name: '!room2:server' }]);
    const mockListParticipants = mock(async (roomId: string) => {
      if (roomId === '!room1:server') {
        return [makeParticipant('@alice:server.com_DEVICE1', { micMuted: true })];
      }
      if (roomId === '!room2:server') {
        return [makeParticipant('@bob:server.com_DEVICE1', { cameraOn: true })];
      }
      return [];
    });

    // Patch prototype methods
    const proto = RoomServiceClient.prototype as unknown as Record<string, unknown>;
    const origListRooms = proto.listRooms;
    const origListParticipants = proto.listParticipants;
    proto.listRooms = mockListRooms;
    proto.listParticipants = mockListParticipants;

    try {
      const reconciler = new Reconciler('http://lk.test', 'key', 'secret', store, stats);
      await reconciler.reconcileAll();

      expect(stats.startupRoomsReconciled).toBe(2);
      expect(stats.lastReconcileAt).toBeGreaterThan(0);

      const snap1 = await store.getRoomSnapshot('!room1:server');
      expect(snap1.get('@alice:server.com')?.isMicMuted).toBe(true);

      const snap2 = await store.getRoomSnapshot('!room2:server');
      expect(snap2.get('@bob:server.com')?.isCameraOn).toBe(true);
    } finally {
      proto.listRooms = origListRooms;
      proto.listParticipants = origListParticipants;
    }
  });

  it('reconcileRoom seeds a single room and returns true when participants found', async () => {
    const { Reconciler } = await import('./reconciler.js');
    const { RoomServiceClient } = await import('livekit-server-sdk');

    const proto = RoomServiceClient.prototype as unknown as Record<string, unknown>;
    const origListParticipants = proto.listParticipants;
    proto.listParticipants = mock(async () => [
      makeParticipant('@carol:server.com_DEV', { micMuted: false, cameraOn: false, isDeafened: true }),
    ]);

    try {
      const reconciler = new Reconciler('http://lk.test', 'key', 'secret', store, stats);
      const found = await reconciler.reconcileRoom('!room:server');

      expect(found).toBe(true);
      const snap = await store.getRoomSnapshot('!room:server');
      expect(snap.get('@carol:server.com')?.isDeafened).toBe(true);
    } finally {
      proto.listParticipants = origListParticipants;
    }
  });

  it('reconcileRoom returns false when room is empty', async () => {
    const { Reconciler } = await import('./reconciler.js');
    const { RoomServiceClient } = await import('livekit-server-sdk');

    const proto = RoomServiceClient.prototype as unknown as Record<string, unknown>;
    const origListParticipants = proto.listParticipants;
    proto.listParticipants = mock(async () => []);

    try {
      const reconciler = new Reconciler('http://lk.test', 'key', 'secret', store, stats);
      const found = await reconciler.reconcileRoom('!empty:server');
      expect(found).toBe(false);
    } finally {
      proto.listParticipants = origListParticipants;
    }
  });

  it('reconcileAll is resilient to LiveKit being unreachable', async () => {
    const { Reconciler } = await import('./reconciler.js');
    const { RoomServiceClient } = await import('livekit-server-sdk');

    const proto = RoomServiceClient.prototype as unknown as Record<string, unknown>;
    const origListRooms = proto.listRooms;
    proto.listRooms = mock(async () => { throw new Error('ECONNREFUSED'); });

    try {
      const reconciler = new Reconciler('http://lk.test', 'key', 'secret', store, stats);
      // Should not throw
      await expect(reconciler.reconcileAll()).resolves.toBeUndefined();
      // Stats should remain at defaults
      expect(stats.startupRoomsReconciled).toBe(0);
    } finally {
      proto.listRooms = origListRooms;
    }
  });

  it('maps screenshare track correctly', async () => {
    const { Reconciler } = await import('./reconciler.js');
    const { RoomServiceClient } = await import('livekit-server-sdk');

    const proto = RoomServiceClient.prototype as unknown as Record<string, unknown>;
    const origListParticipants = proto.listParticipants;
    proto.listParticipants = mock(async () => [
      makeParticipant('@dave:server.com_DEV', { screenSharing: true }),
    ]);

    try {
      const reconciler = new Reconciler('http://lk.test', 'key', 'secret', store, stats);
      await reconciler.reconcileRoom('!room:server');
      const snap = await store.getRoomSnapshot('!room:server');
      expect(snap.get('@dave:server.com')?.isScreenSharing).toBe(true);
    } finally {
      proto.listParticipants = origListParticipants;
    }
  });

  it('clears stale rooms that no longer exist in LiveKit', async () => {
    await store.joinPresence('!stale:server', '@stale:server_DEV', '@stale:server', makePresence());

    const { Reconciler } = await import('./reconciler.js');
    const { RoomServiceClient } = await import('livekit-server-sdk');

    const proto = RoomServiceClient.prototype as unknown as Record<string, unknown>;
    const origListRooms = proto.listRooms;
    const origListParticipants = proto.listParticipants;
    proto.listRooms = mock(async () => [{ name: '!fresh:server' }]);
    proto.listParticipants = mock(async () => []);

    try {
      const reconciler = new Reconciler('http://lk.test', 'key', 'secret', store, stats);
      await reconciler.reconcileAll();

      expect((await store.getRoomSnapshot('!stale:server')).size).toBe(0);
      expect(await store.listRoomIds()).not.toContain('!stale:server');
    } finally {
      proto.listRooms = origListRooms;
      proto.listParticipants = origListParticipants;
    }
  });
});
