/**
 * Unit tests for webhookHandler.ts — authoritative bridge aggregation contract.
 *
 * Verifies that:
 *   1. Webhook broadcasts always send aggregated user-state, never raw device-state.
 *   2. participant_left broadcasts an 'update' (not silence) when other devices remain.
 *   3. participant_left broadcasts 'left' only when the last device leaves.
 *   4. track_muted / track_unmuted broadcast the aggregated state across all devices.
 *
 * Uses a real InMemoryVoiceStateStore and a spy SSEManager to capture broadcasts.
 * WebhookReceiver signature verification is bypassed by mocking the receiver.
 */

import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { InMemoryVoiceStateStore } from './store.js';
import { SSEManager } from './sseManager.js';
import type { BridgeStats, ParticipantPresence } from './types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

/** Minimal Hono Context stub that captures the response. */
function makeCtx(body: string, authHeader = '') {
  return {
    req: {
      text: async () => body,
      header: (name: string) => (name === 'Authorization' ? authHeader : undefined),
    },
    text: (msg: string, status?: number) => ({ msg, status }),
  } as unknown as import('hono').Context;
}

/** Build a raw webhook event body (no real signature needed — we mock the receiver). */
function makeEventBody(
  eventName: string,
  roomName: string,
  identity: string,
  /** For participant_joined: participant.tracks array. For track_muted/unmuted/published: top-level track object. */
  trackOrTracks: Array<{ source: string; muted?: boolean }> | { source: string; muted?: boolean } | null = null,
  attributes: Record<string, string> = {},
): string {
  const participantTracks = Array.isArray(trackOrTracks) ? trackOrTracks : [];
  const topLevelTrack = trackOrTracks && !Array.isArray(trackOrTracks) ? trackOrTracks : undefined;

  return JSON.stringify({
    event: eventName,
    room: { name: roomName },
    participant: { identity, tracks: participantTracks, attributes },
    ...(topLevelTrack ? { track: topLevelTrack } : {}),
  });
}

// ── Broadcast capture ─────────────────────────────────────────────────────────

type CapturedBroadcast = {
  roomId: string;
  userId: string;
  presence: ParticipantPresence;
  type: 'update' | 'left';
};

function makeSpySSE(stats: BridgeStats): { sse: SSEManager; broadcasts: CapturedBroadcast[] } {
  const broadcasts: CapturedBroadcast[] = [];
  const sse = new SSEManager(stats);
  const origBroadcast = sse.broadcast.bind(sse);
  sse.broadcast = (roomId, userId, presence, type) => {
    broadcasts.push({ roomId, userId, presence, type });
    origBroadcast(roomId, userId, presence, type);
  };
  return { sse, broadcasts };
}

// ── Mock WebhookReceiver ──────────────────────────────────────────────────────
// We bypass signature verification by mocking the receiver to return the parsed body.

async function buildHandler(store: InMemoryVoiceStateStore, sse: SSEManager, stats: BridgeStats) {
  // Dynamically import so we can patch the module
  const webhookModule = await import('./webhookHandler.js');
  const livekitSdk = await import('livekit-server-sdk');

  // Patch WebhookReceiver.prototype.receive to just parse the body as JSON
  const origReceive = livekitSdk.WebhookReceiver.prototype.receive;
  livekitSdk.WebhookReceiver.prototype.receive = async function (body: string) {
    return JSON.parse(body);
  };

  const handler = webhookModule.createWebhookHandler(store, sse, stats, 'key', 'secret');

  return {
    handler,
    restore: () => {
      livekitSdk.WebhookReceiver.prototype.receive = origReceive;
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const ROOM = '!room:server.com';
const USER = '@alice:server.com';
const ID1 = `${USER}_DEVICE1`;
const ID2 = `${USER}_DEVICE2`;

describe('webhookHandler — aggregation contract', () => {
  let store: InMemoryVoiceStateStore;
  let stats: BridgeStats;

  beforeEach(() => {
    store = new InMemoryVoiceStateStore();
    stats = makeStats();
  });

  // ── participant_joined ──────────────────────────────────────────────────────

  it('participant_joined broadcasts aggregated state for first device', async () => {
    const { sse, broadcasts } = makeSpySSE(stats);
    const { handler, restore } = await buildHandler(store, sse, stats);

    try {
      const body = makeEventBody('participant_joined', ROOM, ID1, [
        { source: 'MICROPHONE', muted: true },
      ]);
      await handler(makeCtx(body));

      expect(broadcasts).toHaveLength(1);
      expect(broadcasts[0].type).toBe('update');
      expect(broadcasts[0].userId).toBe(USER);
      expect(broadcasts[0].presence.isMicMuted).toBe(true);
    } finally {
      restore();
    }
  });

  it('participant_joined: second device join broadcasts aggregated state', async () => {
    const { sse, broadcasts } = makeSpySSE(stats);
    const { handler, restore } = await buildHandler(store, sse, stats);

    try {
      // Device 1 joins: mic muted, camera off
      await handler(makeCtx(makeEventBody('participant_joined', ROOM, ID1, [
        { source: 'MICROPHONE', muted: true },
        { source: 'CAMERA', muted: true },
      ])));

      // Device 2 joins: mic unmuted, camera on
      await handler(makeCtx(makeEventBody('participant_joined', ROOM, ID2, [
        { source: 'MICROPHONE', muted: false },
        { source: 'CAMERA', muted: false },
      ])));

      expect(broadcasts).toHaveLength(2);
      const secondJoin = broadcasts[1];
      // Aggregated: mic NOT muted (device 2 unmuted), camera on (device 2 has it)
      expect(secondJoin.presence.isMicMuted).toBe(false);
      expect(secondJoin.presence.isCameraOn).toBe(true);
    } finally {
      restore();
    }
  });

  // ── track_muted / track_unmuted ─────────────────────────────────────────────

  it('track_muted broadcasts aggregated state (not device-state)', async () => {
    const { sse, broadcasts } = makeSpySSE(stats);
    const { handler, restore } = await buildHandler(store, sse, stats);

    try {
      // Seed two devices: both unmuted
      await store.joinPresence(ROOM, ID1, USER, {
        isMicMuted: false, isCameraOn: false, isScreenSharing: false, isDeafened: false,
        updatedAt: 1000, seq: 0, type: 'update',
      });
      await store.joinPresence(ROOM, ID2, USER, {
        isMicMuted: false, isCameraOn: true, isScreenSharing: false, isDeafened: false,
        updatedAt: 1000, seq: 0, type: 'update',
      });

      // Device 1 mutes mic — device 2 still unmuted
      const body = makeEventBody('track_muted', ROOM, ID1, { source: 'MICROPHONE', muted: true });
      await handler(makeCtx(body));

      // Should have broadcast the aggregated state: mic NOT muted (device 2 still unmuted)
      const updateBroadcasts = broadcasts.filter(b => b.type === 'update');
      expect(updateBroadcasts.length).toBeGreaterThan(0);
      const last = updateBroadcasts[updateBroadcasts.length - 1];
      expect(last.presence.isMicMuted).toBe(false); // aggregated: device 2 still unmuted
      expect(last.presence.isCameraOn).toBe(true);  // aggregated: device 2 has camera
    } finally {
      restore();
    }
  });

  it('track_muted broadcasts aggregated muted=true when all devices are muted', async () => {
    const { sse, broadcasts } = makeSpySSE(stats);
    const { handler, restore } = await buildHandler(store, sse, stats);

    try {
      // Seed two devices: device 2 already muted
      await store.joinPresence(ROOM, ID1, USER, {
        isMicMuted: false, isCameraOn: false, isScreenSharing: false, isDeafened: false,
        updatedAt: 1000, seq: 0, type: 'update',
      });
      await store.joinPresence(ROOM, ID2, USER, {
        isMicMuted: true, isCameraOn: false, isScreenSharing: false, isDeafened: false,
        updatedAt: 1000, seq: 0, type: 'update',
      });

      // Device 1 also mutes — now all devices are muted
      const body = makeEventBody('track_muted', ROOM, ID1, { source: 'MICROPHONE', muted: true });
      await handler(makeCtx(body));

      const updateBroadcasts = broadcasts.filter(b => b.type === 'update');
      expect(updateBroadcasts.length).toBeGreaterThan(0);
      const last = updateBroadcasts[updateBroadcasts.length - 1];
      expect(last.presence.isMicMuted).toBe(true); // aggregated: all muted
    } finally {
      restore();
    }
  });

  // ── participant_left ────────────────────────────────────────────────────────

  it('participant_left broadcasts "left" when last device leaves', async () => {
    const { sse, broadcasts } = makeSpySSE(stats);
    const { handler, restore } = await buildHandler(store, sse, stats);

    try {
      await store.joinPresence(ROOM, ID1, USER, {
        isMicMuted: false, isCameraOn: false, isScreenSharing: false, isDeafened: false,
        updatedAt: 1000, seq: 0, type: 'update',
      });

      const body = makeEventBody('participant_left', ROOM, ID1);
      await handler(makeCtx(body));

      expect(broadcasts).toHaveLength(1);
      expect(broadcasts[0].type).toBe('left');
      expect(broadcasts[0].userId).toBe(USER);
    } finally {
      restore();
    }
  });

  it('participant_left broadcasts "update" (not silence) when other devices remain', async () => {
    const { sse, broadcasts } = makeSpySSE(stats);
    const { handler, restore } = await buildHandler(store, sse, stats);

    try {
      // Device 1: screensharing
      await store.joinPresence(ROOM, ID1, USER, {
        isMicMuted: false, isCameraOn: false, isScreenSharing: true, isDeafened: false,
        updatedAt: 1000, seq: 0, type: 'update',
      });
      // Device 2: not screensharing, camera on
      await store.joinPresence(ROOM, ID2, USER, {
        isMicMuted: false, isCameraOn: true, isScreenSharing: false, isDeafened: false,
        updatedAt: 1000, seq: 0, type: 'update',
      });

      // Device 1 leaves
      const body = makeEventBody('participant_left', ROOM, ID1);
      await handler(makeCtx(body));

      expect(broadcasts).toHaveLength(1);
      expect(broadcasts[0].type).toBe('update'); // NOT 'left' — device 2 still present
      expect(broadcasts[0].userId).toBe(USER);
      // Aggregated from device 2 only: screenshare off, camera on
      expect(broadcasts[0].presence.isScreenSharing).toBe(false);
      expect(broadcasts[0].presence.isCameraOn).toBe(true);
    } finally {
      restore();
    }
  });

  it('participant_left: no broadcast when identity was never tracked', async () => {
    const { sse, broadcasts } = makeSpySSE(stats);
    const { handler, restore } = await buildHandler(store, sse, stats);

    try {
      const body = makeEventBody('participant_left', ROOM, ID1);
      await handler(makeCtx(body));

      // No presence was tracked — nothing to broadcast
      expect(broadcasts).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it('participant_left: three devices, partial leave broadcasts updated aggregated state', async () => {
    const ID3 = `${USER}_DEVICE3`;
    const { sse, broadcasts } = makeSpySSE(stats);
    const { handler, restore } = await buildHandler(store, sse, stats);

    try {
      // Device 1: mic muted, screensharing
      await store.joinPresence(ROOM, ID1, USER, {
        isMicMuted: true, isCameraOn: false, isScreenSharing: true, isDeafened: false,
        updatedAt: 1000, seq: 0, type: 'update',
      });
      // Device 2: mic muted, no screenshare
      await store.joinPresence(ROOM, ID2, USER, {
        isMicMuted: true, isCameraOn: false, isScreenSharing: false, isDeafened: false,
        updatedAt: 1000, seq: 0, type: 'update',
      });
      // Device 3: mic unmuted, camera on
      await store.joinPresence(ROOM, ID3, USER, {
        isMicMuted: false, isCameraOn: true, isScreenSharing: false, isDeafened: false,
        updatedAt: 1000, seq: 0, type: 'update',
      });

      // Device 1 (the screensharing one) leaves
      const body = makeEventBody('participant_left', ROOM, ID1);
      await handler(makeCtx(body));

      expect(broadcasts).toHaveLength(1);
      expect(broadcasts[0].type).toBe('update');
      // Aggregated from devices 2+3: mic NOT muted (device 3 unmuted), screenshare off, camera on
      expect(broadcasts[0].presence.isMicMuted).toBe(false);
      expect(broadcasts[0].presence.isScreenSharing).toBe(false);
      expect(broadcasts[0].presence.isCameraOn).toBe(true);
    } finally {
      restore();
    }
  });
});
