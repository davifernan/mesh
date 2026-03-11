/**
 * callPresencePermissions.test.ts
 *
 * Tests for the call-room permission helpers introduced in callPresenceState.ts:
 *   - checkCallPresencePermissions
 *   - buildCallRoomPresenceRepair
 *   - REQUIRED_CALL_ROOM_EVENTS
 *
 * Pure functions only — no React, no React testing utilities.
 * MatrixClient and room state are mocked inline.
 */

import { describe, it, expect } from 'vitest';
import {
  checkCallPresencePermissions,
  buildCallRoomPresenceRepair,
  REQUIRED_CALL_ROOM_EVENTS,
} from '../app/features/call/callPresenceState';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build a minimal mock MatrixClient + room for a given PL content
// ─────────────────────────────────────────────────────────────────────────────

function buildMockMx(
  plContent: Record<string, unknown> | null,
  userId = '@alice:server',
  roomExists = true,
) {
  const mockPLEvent = plContent !== null
    ? { getContent: () => plContent }
    : null;

  const mockRoom = {
    currentState: {
      getStateEvents: (type: string, stateKey?: string) => {
        if (type === 'm.room.power_levels' && stateKey === '') {
          return mockPLEvent;
        }
        return [];
      },
    },
  };

  return {
    getRoom: (_roomId: string) => (roomExists ? mockRoom : null),
    getUserId: () => userId,
  } as any;
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUIRED_CALL_ROOM_EVENTS
// ─────────────────────────────────────────────────────────────────────────────

describe('REQUIRED_CALL_ROOM_EVENTS', () => {
  it('contains exactly org.matrix.msc3401.call.member, io.bettercord.call.presence, org.bettercord.call.info', () => {
    expect([...REQUIRED_CALL_ROOM_EVENTS]).toEqual([
      'org.matrix.msc3401.call.member',
      'io.bettercord.call.presence',
      'org.bettercord.call.info',
    ]);
  });

  it('has exactly 3 entries', () => {
    expect(REQUIRED_CALL_ROOM_EVENTS.length).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// checkCallPresencePermissions
// ─────────────────────────────────────────────────────────────────────────────

describe('checkCallPresencePermissions', () => {
  // ── Room not found / null ──────────────────────────────────────────────────

  it('returns safe defaults when room is null (room not found)', () => {
    const mx = buildMockMx(null, '@alice:server', false);
    const result = checkCallPresencePermissions(mx, '!room:server');

    expect(result.canWrite).toBe(false);
    expect(result.canRepair).toBe(false);
    expect(result.missingEventOverrides).toEqual([...REQUIRED_CALL_ROOM_EVENTS]);
  });

  // ── canWrite based on io.bettercord.call.presence override ─────────────────

  it('canWrite=true when presence override is 0 and user power is 0', () => {
    const mx = buildMockMx({
      events: {
        'io.bettercord.call.presence': 0,
        'org.matrix.msc3401.call.member': 0,
        'org.bettercord.call.info': 0,
      },
      state_default: 50,
      users_default: 0,
    });
    const result = checkCallPresencePermissions(mx, '!room:server');
    expect(result.canWrite).toBe(true);
  });

  it('canWrite=false when override is 50 (stateDefault) and user power is 0', () => {
    const mx = buildMockMx({
      events: {
        'io.bettercord.call.presence': 50,
        'org.matrix.msc3401.call.member': 0,
        'org.bettercord.call.info': 0,
      },
      state_default: 50,
      users_default: 0,
    });
    const result = checkCallPresencePermissions(mx, '!room:server');
    expect(result.canWrite).toBe(false);
  });

  it('canWrite=false when presence override is absent and stateDefault is 50 and user power is 0', () => {
    // No events key at all — fallback to stateDefault=50
    const mx = buildMockMx({
      state_default: 50,
      users_default: 0,
    });
    const result = checkCallPresencePermissions(mx, '!room:server');
    expect(result.canWrite).toBe(false);
  });

  it('canWrite=true when presence event override absent but stateDefault is 0', () => {
    const mx = buildMockMx({
      state_default: 0,
      users_default: 0,
    });
    const result = checkCallPresencePermissions(mx, '!room:server');
    expect(result.canWrite).toBe(true);
  });

  it('canWrite=true when user power equals the required level exactly', () => {
    const mx = buildMockMx(
      {
        events: { 'io.bettercord.call.presence': 50 },
        state_default: 50,
        users: { '@alice:server': 50 },
      },
      '@alice:server',
    );
    const result = checkCallPresencePermissions(mx, '!room:server');
    expect(result.canWrite).toBe(true);
  });

  // ── missingEventOverrides ──────────────────────────────────────────────────

  it('missingEventOverrides lists only entries NOT at 0', () => {
    const mx = buildMockMx({
      events: {
        'org.matrix.msc3401.call.member': 0, // correct → not missing
        'io.bettercord.call.presence': 50,   // wrong → missing
        'org.bettercord.call.info': 0,       // correct → not missing
      },
      state_default: 50,
    });
    const result = checkCallPresencePermissions(mx, '!room:server');
    expect(result.missingEventOverrides).toEqual(['io.bettercord.call.presence']);
  });

  it('missingEventOverrides is empty when all three are at 0', () => {
    const mx = buildMockMx({
      events: {
        'org.matrix.msc3401.call.member': 0,
        'io.bettercord.call.presence': 0,
        'org.bettercord.call.info': 0,
      },
      state_default: 50,
    });
    const result = checkCallPresencePermissions(mx, '!room:server');
    expect(result.missingEventOverrides).toEqual([]);
  });

  it('missingEventOverrides lists all three when events object is absent (stateDefault=50)', () => {
    const mx = buildMockMx({
      state_default: 50,
      users_default: 0,
    });
    const result = checkCallPresencePermissions(mx, '!room:server');
    expect(result.missingEventOverrides).toEqual([...REQUIRED_CALL_ROOM_EVENTS]);
  });

  it('uses stateDefault (50) as fallback when event override is absent', () => {
    // With stateDefault=50 and no event override, presence PL = 50 → user at 0 cannot write
    const mx = buildMockMx({
      state_default: 50,
      users_default: 0,
    });
    const result = checkCallPresencePermissions(mx, '!room:server');
    // All three events missing (falling back to 50 > 0)
    expect(result.missingEventOverrides.length).toBe(3);
    expect(result.canWrite).toBe(false);
  });

  // ── canRepair ──────────────────────────────────────────────────────────────

  it('canRepair=true when user power >= PL edit level and missingEventOverrides non-empty', () => {
    const mx = buildMockMx(
      {
        events: {
          // All three are wrong (50) — so missingEventOverrides is non-empty
          'm.room.power_levels': 50, // PL edit requires 50
        },
        state_default: 50,
        users: { '@alice:server': 100 }, // user has power 100 >= 50
      },
      '@alice:server',
    );
    const result = checkCallPresencePermissions(mx, '!room:server');
    expect(result.missingEventOverrides.length).toBeGreaterThan(0);
    expect(result.canRepair).toBe(true);
  });

  it('canRepair=false when user lacks PL edit power', () => {
    const mx = buildMockMx(
      {
        events: {
          'm.room.power_levels': 50,
        },
        state_default: 50,
        users: { '@alice:server': 0 }, // user power 0 < 50 required
      },
      '@alice:server',
    );
    const result = checkCallPresencePermissions(mx, '!room:server');
    expect(result.canRepair).toBe(false);
  });

  it('canRepair=false when nothing is missing (room already correct)', () => {
    const mx = buildMockMx(
      {
        events: {
          'org.matrix.msc3401.call.member': 0,
          'io.bettercord.call.presence': 0,
          'org.bettercord.call.info': 0,
        },
        state_default: 50,
        users: { '@alice:server': 100 },
      },
      '@alice:server',
    );
    const result = checkCallPresencePermissions(mx, '!room:server');
    expect(result.missingEventOverrides).toEqual([]);
    expect(result.canRepair).toBe(false);
  });

  it('canRepair=false when user has enough power but nothing is missing', () => {
    const mx = buildMockMx(
      {
        events: {
          'org.matrix.msc3401.call.member': 0,
          'io.bettercord.call.presence': 0,
          'org.bettercord.call.info': 0,
          'm.room.power_levels': 50,
        },
        state_default: 50,
        users: { '@alice:server': 100 },
      },
      '@alice:server',
    );
    const result = checkCallPresencePermissions(mx, '!room:server');
    expect(result.canRepair).toBe(false);
  });

  it('canRepair uses stateDefault as fallback for m.room.power_levels when override absent', () => {
    // stateDefault=50, user has 50 → canRepair=true IF missing entries exist
    const mx = buildMockMx(
      {
        // no m.room.power_levels override → falls back to state_default=50
        state_default: 50,
        users: { '@alice:server': 50 },
      },
      '@alice:server',
    );
    const result = checkCallPresencePermissions(mx, '!room:server');
    expect(result.missingEventOverrides.length).toBeGreaterThan(0);
    expect(result.canRepair).toBe(true);
  });

  // ── getUserId fallback ─────────────────────────────────────────────────────

  it('uses users_default when userId not in users map', () => {
    const mx = buildMockMx(
      {
        events: { 'io.bettercord.call.presence': 25 },
        state_default: 50,
        users_default: 30, // ≥ 25 → canWrite
      },
      '@alice:server',
    );
    const result = checkCallPresencePermissions(mx, '!room:server');
    expect(result.canWrite).toBe(true);
  });

  it('falls back to power 0 when neither users map nor users_default is present', () => {
    const mx = buildMockMx(
      {
        events: { 'io.bettercord.call.presence': 1 },
        state_default: 50,
        // No users, no users_default → power defaults to 0
      },
      '@alice:server',
    );
    const result = checkCallPresencePermissions(mx, '!room:server');
    expect(result.canWrite).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildCallRoomPresenceRepair
// ─────────────────────────────────────────────────────────────────────────────

describe('buildCallRoomPresenceRepair', () => {
  it('returns identical object reference when missingEventOverrides is empty', () => {
    const existing = {
      events: { 'org.matrix.msc3401.call': 100 },
      users: { '@admin:server': 100 },
    };
    const result = buildCallRoomPresenceRepair(existing, []);
    expect(result).toBe(existing);
  });

  it('adds missing entries at value 0', () => {
    const existing = {
      events: { 'org.matrix.msc3401.call': 100 },
      ban: 50,
      kick: 50,
    };
    const missing = [
      'org.matrix.msc3401.call.member',
      'io.bettercord.call.presence',
      'org.bettercord.call.info',
    ];
    const result = buildCallRoomPresenceRepair(existing, missing);

    expect((result.events as Record<string, number>)['org.matrix.msc3401.call.member']).toBe(0);
    expect((result.events as Record<string, number>)['io.bettercord.call.presence']).toBe(0);
    expect((result.events as Record<string, number>)['org.bettercord.call.info']).toBe(0);
  });

  it('does NOT overwrite existing entries that are already at correct levels', () => {
    const existing = {
      events: {
        'org.matrix.msc3401.call': 100,
        'org.matrix.msc3401.call.member': 0, // already correct
      },
    };
    const missing = ['io.bettercord.call.presence'];
    const result = buildCallRoomPresenceRepair(existing, missing);

    // The existing correct entry must remain unchanged
    expect((result.events as Record<string, number>)['org.matrix.msc3401.call']).toBe(100);
    expect((result.events as Record<string, number>)['org.matrix.msc3401.call.member']).toBe(0);
    // And the missing one gets added
    expect((result.events as Record<string, number>)['io.bettercord.call.presence']).toBe(0);
  });

  it('does NOT modify unrelated PL fields (users, ban, kick, invite, etc.)', () => {
    const existing = {
      users: { '@admin:server': 100 },
      ban: 50,
      kick: 50,
      invite: 0,
      redact: 50,
      events: { 'org.matrix.msc3401.call': 100 },
    };
    const missing = ['io.bettercord.call.presence'];
    const result = buildCallRoomPresenceRepair(existing, missing);

    expect(result.users).toEqual({ '@admin:server': 100 });
    expect(result.ban).toBe(50);
    expect(result.kick).toBe(50);
    expect(result.invite).toBe(0);
    expect(result.redact).toBe(50);
  });

  it('works when existingPLContent.events is missing entirely', () => {
    const existing: Record<string, unknown> = {
      ban: 50,
      kick: 50,
      users: {},
      // No 'events' key
    };
    const missing = [
      'org.matrix.msc3401.call.member',
      'io.bettercord.call.presence',
      'org.bettercord.call.info',
    ];
    const result = buildCallRoomPresenceRepair(existing, missing);

    expect(result.events).toBeDefined();
    const evts = result.events as Record<string, number>;
    expect(evts['org.matrix.msc3401.call.member']).toBe(0);
    expect(evts['io.bettercord.call.presence']).toBe(0);
    expect(evts['org.bettercord.call.info']).toBe(0);
  });

  it('does not mutate the original existingPLContent object', () => {
    const existing = {
      events: { 'org.matrix.msc3401.call': 100 },
    };
    const originalEventsRef = existing.events;
    buildCallRoomPresenceRepair(existing, ['io.bettercord.call.presence']);
    // Original events object must not be mutated
    expect(existing.events).toBe(originalEventsRef);
    expect((existing.events as Record<string, number>)['io.bettercord.call.presence']).toBeUndefined();
  });

  it('adds a single missing entry correctly', () => {
    const existing = {
      events: {
        'org.matrix.msc3401.call.member': 0,
        'io.bettercord.call.presence': 0,
        // org.bettercord.call.info is missing
      },
    };
    const result = buildCallRoomPresenceRepair(existing, ['org.bettercord.call.info']);
    expect((result.events as Record<string, number>)['org.bettercord.call.info']).toBe(0);
    // others unchanged
    expect((result.events as Record<string, number>)['org.matrix.msc3401.call.member']).toBe(0);
    expect((result.events as Record<string, number>)['io.bettercord.call.presence']).toBe(0);
  });
});
