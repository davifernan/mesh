/**
 * Unit tests for store.ts (InMemoryVoiceStateStore)
 *
 * Covers: joinPresence, setPresence (change detection + aggregated return),
 * removePresence (multi-device aggregation + partial-leave aggregated return),
 * and getRoomSnapshot.
 *
 * All store methods are async — tests use await throughout.
 */

import { describe, expect, it, beforeEach } from 'bun:test';
import { InMemoryVoiceStateStore } from './store.js';
import type { ParticipantPresence } from './types.js';

const ROOM = '!room:server.com';
const USER = '@alice:server.com';
const ID1 = '@alice:server.com_DEVICE1';
const ID2 = '@alice:server.com_DEVICE2';
const ID3 = '@alice:server.com_DEVICE3';

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

describe('InMemoryVoiceStateStore', () => {
  let store: InMemoryVoiceStateStore;

  beforeEach(() => {
    store = new InMemoryVoiceStateStore();
  });

  // ── joinPresence ────────────────────────────────────────────────────────────

  describe('joinPresence', () => {
    it('stores initial presence and returns it', async () => {
      const initial = makePresence({ isMicMuted: true });
      const result = await store.joinPresence(ROOM, ID1, USER, initial);
      // Store assigns seq=1 on first join — check fields individually
      expect(result.isMicMuted).toBe(true);
      expect(result.isCameraOn).toBe(false);
      expect(result.isDeafened).toBe(false);
      expect(result.isScreenSharing).toBe(false);
      expect(result.seq).toBe(1);
      expect(result.type).toBe('update');
      const snap = (await store.getRoomSnapshot(ROOM)).get(USER);
      expect(snap?.isMicMuted).toBe(true);
      expect(snap?.seq).toBe(1);
    });

    it('roomCount increments after first join', async () => {
      expect(await store.roomCount()).toBe(0);
      await store.joinPresence(ROOM, ID1, USER, makePresence());
      expect(await store.roomCount()).toBe(1);
    });
  });

  // ── setPresence ─────────────────────────────────────────────────────────────

  describe('setPresence', () => {
    it('returns changed=true when state changes', async () => {
      await store.joinPresence(ROOM, ID1, USER, makePresence({ isMicMuted: false }));
      const result = await store.setPresence(ROOM, ID1, USER, { isMicMuted: true });
      expect(result?.changed).toBe(true);
      expect(result?.next.isMicMuted).toBe(true);
    });

    it('returns changed=false when state is identical (Fix E)', async () => {
      await store.joinPresence(ROOM, ID1, USER, makePresence({ isMicMuted: true }));
      const result = await store.setPresence(ROOM, ID1, USER, { isMicMuted: true });
      expect(result?.changed).toBe(false);
    });

    it('updates roomState snapshot', async () => {
      await store.joinPresence(ROOM, ID1, USER, makePresence());
      await store.setPresence(ROOM, ID1, USER, { isCameraOn: true });
      expect((await store.getRoomSnapshot(ROOM)).get(USER)?.isCameraOn).toBe(true);
    });

    // ── Aggregated return contract ──────────────────────────────────────────

    it('returns aggregated user-state (not device-state) when changed=true', async () => {
      // Device 1: mic unmuted, camera off
      await store.joinPresence(ROOM, ID1, USER, makePresence({ isMicMuted: false, isCameraOn: false }));
      // Device 2: mic muted, camera on
      await store.joinPresence(ROOM, ID2, USER, makePresence({ isMicMuted: true, isCameraOn: true }));

      // Mute device 1's mic — now both devices are muted
      const result = await store.setPresence(ROOM, ID1, USER, { isMicMuted: true });
      expect(result?.changed).toBe(true);
      // Aggregated: mic muted (all muted), camera on (any has camera)
      expect(result?.next.isMicMuted).toBe(true);
      expect(result?.next.isCameraOn).toBe(true);
    });

    it('returns aggregated user-state when changed=false', async () => {
      // Device 1: mic muted, camera off
      await store.joinPresence(ROOM, ID1, USER, makePresence({ isMicMuted: true, isCameraOn: false }));
      // Device 2: mic unmuted, camera on
      await store.joinPresence(ROOM, ID2, USER, makePresence({ isMicMuted: false, isCameraOn: true }));

      // Re-send same state for device 1 — no change
      const result = await store.setPresence(ROOM, ID1, USER, { isMicMuted: true });
      expect(result?.changed).toBe(false);
      // next must be the aggregated state: mic NOT muted (device 2 is unmuted), camera on
      expect(result?.next.isMicMuted).toBe(false);
      expect(result?.next.isCameraOn).toBe(true);
    });

    it('single-device: aggregated equals device state', async () => {
      await store.joinPresence(ROOM, ID1, USER, makePresence({ isMicMuted: false }));
      const result = await store.setPresence(ROOM, ID1, USER, { isMicMuted: true });
      expect(result?.changed).toBe(true);
      expect(result?.next.isMicMuted).toBe(true);
      // Snapshot must match
      expect((await store.getRoomSnapshot(ROOM)).get(USER)?.isMicMuted).toBe(true);
    });
  });

  // ── removePresence ──────────────────────────────────────────────────────────

  describe('removePresence', () => {
    it('removes user from snapshot when last identity leaves', async () => {
      await store.joinPresence(ROOM, ID1, USER, makePresence());
      await store.removePresence(ROOM, ID1, USER);
      expect((await store.getRoomSnapshot(ROOM)).has(USER)).toBe(false);
    });

    it('returns remaining=0 and aggregated=null when last identity leaves', async () => {
      await store.joinPresence(ROOM, ID1, USER, makePresence());
      const result = await store.removePresence(ROOM, ID1, USER);
      expect(result?.remaining).toBe(0);
      expect(result?.aggregated).toBeNull();
    });

    it('keeps user in snapshot when another identity remains (multi-device Fix F)', async () => {
      await store.joinPresence(ROOM, ID1, USER, makePresence({ isMicMuted: false }));
      await store.joinPresence(ROOM, ID2, USER, makePresence({ isMicMuted: true }));
      const result = await store.removePresence(ROOM, ID1, USER);
      expect(result?.remaining).toBe(1);
      expect((await store.getRoomSnapshot(ROOM)).has(USER)).toBe(true);
    });

    it('returns aggregated presence when devices remain after partial leave', async () => {
      // Device 1: mic muted, camera off, screenshare on
      await store.joinPresence(ROOM, ID1, USER, makePresence({ isMicMuted: true, isCameraOn: false, isScreenSharing: true }));
      // Device 2: mic unmuted, camera on, screenshare off
      await store.joinPresence(ROOM, ID2, USER, makePresence({ isMicMuted: false, isCameraOn: true, isScreenSharing: false }));

      // Device 1 leaves — only device 2 remains
      const result = await store.removePresence(ROOM, ID1, USER);
      expect(result?.remaining).toBe(1);
      expect(result?.aggregated).not.toBeNull();
      // Aggregated from device 2 only: mic unmuted, camera on, screenshare off
      expect(result?.aggregated?.isMicMuted).toBe(false);
      expect(result?.aggregated?.isCameraOn).toBe(true);
      expect(result?.aggregated?.isScreenSharing).toBe(false);
    });

    it('aggregated after partial leave matches getRoomSnapshot', async () => {
      await store.joinPresence(ROOM, ID1, USER, makePresence({ isMicMuted: true, isScreenSharing: true }));
      await store.joinPresence(ROOM, ID2, USER, makePresence({ isMicMuted: false, isScreenSharing: false }));

      const result = await store.removePresence(ROOM, ID1, USER);
      const snapshot = (await store.getRoomSnapshot(ROOM)).get(USER);

      expect(result?.aggregated).toEqual(snapshot);
    });

    it('three devices: partial leave recomputes correctly', async () => {
      await store.joinPresence(ROOM, ID1, USER, makePresence({ isMicMuted: true, isCameraOn: false }));
      await store.joinPresence(ROOM, ID2, USER, makePresence({ isMicMuted: true, isCameraOn: true }));
      await store.joinPresence(ROOM, ID3, USER, makePresence({ isMicMuted: false, isCameraOn: false }));

      // Remove device 3 (the only unmuted one)
      const result = await store.removePresence(ROOM, ID3, USER);
      expect(result?.remaining).toBe(2);
      // Now all remaining devices are muted → aggregated mic muted = true
      expect(result?.aggregated?.isMicMuted).toBe(true);
      // Device 2 has camera → aggregated camera on = true
      expect(result?.aggregated?.isCameraOn).toBe(true);
    });

    it('cleans up room from roomState when last user leaves', async () => {
      await store.joinPresence(ROOM, ID1, USER, makePresence());
      await store.removePresence(ROOM, ID1, USER);
      expect(await store.roomCount()).toBe(0);
    });

    it('handles removePresence for unknown userId gracefully (Fix H2)', async () => {
      // Should not throw — returns null when identity was never tracked
      const result = await store.removePresence(ROOM, ID1, USER);
      expect(result).toBeNull();
    });
  });

  // ── getRoomSnapshot ─────────────────────────────────────────────────────────

  describe('getRoomSnapshot', () => {
    it('returns empty map for unknown room', async () => {
      expect((await store.getRoomSnapshot('!unknown:server')).size).toBe(0);
    });

    it('returns all users in room', async () => {
      const user2 = '@bob:server.com';
      await store.joinPresence(ROOM, ID1, USER, makePresence());
      await store.joinPresence(ROOM, '@bob:server.com_DEV', user2, makePresence());
      expect((await store.getRoomSnapshot(ROOM)).size).toBe(2);
    });

    it('lists known room ids', async () => {
      await store.joinPresence(ROOM, ID1, USER, makePresence());
      expect(await store.listRoomIds()).toEqual([ROOM]);
    });

    it('clears all room state', async () => {
      await store.joinPresence(ROOM, ID1, USER, makePresence());
      await store.clearRoom(ROOM);
      expect((await store.getRoomSnapshot(ROOM)).size).toBe(0);
      expect(await store.roomCount()).toBe(0);
    });
  });

  // ── Multi-device aggregation ────────────────────────────────────────────────

  describe('multi-device aggregation', () => {
    it('aggregates active device state instead of picking a single winning device', async () => {
      await store.joinPresence(ROOM, ID1, USER, makePresence({ isMicMuted: false, isCameraOn: false, updatedAt: 1000 }));
      await store.joinPresence(ROOM, ID2, USER, makePresence({ isMicMuted: true, isCameraOn: true, updatedAt: 2000 }));

      const aggregated = (await store.getRoomSnapshot(ROOM)).get(USER);
      expect(aggregated?.isMicMuted).toBe(false);
      expect(aggregated?.isCameraOn).toBe(true);
      expect(aggregated?.updatedAt).toBe(2000);
      // seq should be 2 (two joins)
      expect(aggregated?.seq).toBe(2);
    });

    it('marks mic muted only when all active devices are muted', async () => {
      await store.joinPresence(ROOM, ID1, USER, makePresence({ isMicMuted: true }));
      await store.joinPresence(ROOM, ID2, USER, makePresence({ isMicMuted: true }));
      expect((await store.getRoomSnapshot(ROOM)).get(USER)?.isMicMuted).toBe(true);

      await store.setPresence(ROOM, ID2, USER, { isMicMuted: false });
      expect((await store.getRoomSnapshot(ROOM)).get(USER)?.isMicMuted).toBe(false);
    });

    it('setPresence on one device reflects aggregated state across all devices', async () => {
      // Device 1: screensharing, mic muted
      await store.joinPresence(ROOM, ID1, USER, makePresence({ isScreenSharing: true, isMicMuted: true }));
      // Device 2: not screensharing, mic unmuted
      await store.joinPresence(ROOM, ID2, USER, makePresence({ isScreenSharing: false, isMicMuted: false }));

      // Device 1 stops screensharing
      const result = await store.setPresence(ROOM, ID1, USER, { isScreenSharing: false });
      expect(result?.changed).toBe(true);
      // Aggregated: screenshare off (neither device), mic NOT muted (device 2 unmuted)
      expect(result?.next.isScreenSharing).toBe(false);
      expect(result?.next.isMicMuted).toBe(false);

      // Snapshot must be consistent
      const snap = (await store.getRoomSnapshot(ROOM)).get(USER);
      expect(snap?.isScreenSharing).toBe(false);
      expect(snap?.isMicMuted).toBe(false);
    });

    it('partial leave: screenshare stops when only screensharing device leaves', async () => {
      // Device 1: screensharing
      await store.joinPresence(ROOM, ID1, USER, makePresence({ isScreenSharing: true }));
      // Device 2: not screensharing
      await store.joinPresence(ROOM, ID2, USER, makePresence({ isScreenSharing: false }));

      // Aggregated before: screenshare on (device 1 has it)
      expect((await store.getRoomSnapshot(ROOM)).get(USER)?.isScreenSharing).toBe(true);

      // Device 1 leaves
      const result = await store.removePresence(ROOM, ID1, USER);
      expect(result?.remaining).toBe(1);
      // Aggregated after: screenshare off (only device 2 remains)
      expect(result?.aggregated?.isScreenSharing).toBe(false);
      expect((await store.getRoomSnapshot(ROOM)).get(USER)?.isScreenSharing).toBe(false);
    });
  });
});
