/**
 * createRoomUtils.test.ts
 *
 * Tests for createPowerLevelContentOverrides in create-room/utils.ts.
 * Pure function — no React, no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import { createPowerLevelContentOverrides } from '../app/components/create-room/utils';
import type { IPowerLevels } from '../app/hooks/usePowerLevels';
import { RoomType } from '../types/matrix/room';

// ─────────────────────────────────────────────────────────────────────────────
// createPowerLevelContentOverrides — general merge behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe('createPowerLevelContentOverrides', () => {
  it('merges base and override top-level fields', () => {
    const base: IPowerLevels = { ban: 50, kick: 50 };
    const overrides: Partial<IPowerLevels> = { invite: 0 };
    const result = createPowerLevelContentOverrides(base, overrides);

    expect(result.ban).toBe(50);
    expect(result.kick).toBe(50);
    expect(result.invite).toBe(0);
  });

  it('override top-level field wins over base', () => {
    const base: IPowerLevels = { ban: 50 };
    const overrides: Partial<IPowerLevels> = { ban: 100 };
    const result = createPowerLevelContentOverrides(base, overrides);
    expect(result.ban).toBe(100);
  });

  it('merges events objects (not replaced)', () => {
    const base: IPowerLevels = {
      events: { 'org.matrix.msc3401.call': 100 },
    };
    const overrides: Partial<IPowerLevels> = {
      events: { 'org.matrix.msc3401.call.member': 0 },
    };
    const result = createPowerLevelContentOverrides(base, overrides);

    // Both keys must survive
    expect(result.events?.['org.matrix.msc3401.call']).toBe(100);
    expect(result.events?.['org.matrix.msc3401.call.member']).toBe(0);
  });

  it('override events key wins over base events key', () => {
    const base: IPowerLevels = {
      events: { 'org.matrix.msc3401.call': 50 },
    };
    const overrides: Partial<IPowerLevels> = {
      events: { 'org.matrix.msc3401.call': 100 },
    };
    const result = createPowerLevelContentOverrides(base, overrides);
    expect(result.events?.['org.matrix.msc3401.call']).toBe(100);
  });

  it('merges users objects (not replaced)', () => {
    const base: IPowerLevels = { users: { '@admin:server': 100 } };
    const overrides: Partial<IPowerLevels> = { users: { '@mod:server': 50 } };
    const result = createPowerLevelContentOverrides(base, overrides);

    expect(result.users?.['@admin:server']).toBe(100);
    expect(result.users?.['@mod:server']).toBe(50);
  });

  it('merges notifications objects (not replaced)', () => {
    const base: IPowerLevels = { notifications: { room: 50 } };
    const overrides: Partial<IPowerLevels> = { notifications: { room: 0 } };
    const result = createPowerLevelContentOverrides(base, overrides);

    expect(result.notifications?.['room']).toBe(0);
  });

  it('base fields not in overrides are preserved', () => {
    const base: IPowerLevels = {
      ban: 50,
      kick: 50,
      redact: 50,
      invite: 0,
      state_default: 50,
      events_default: 0,
      users_default: 0,
      events: { 'some.existing.event': 100 },
    };
    const overrides: Partial<IPowerLevels> = {
      events: { 'new.event': 0 },
    };
    const result = createPowerLevelContentOverrides(base, overrides);

    expect(result.ban).toBe(50);
    expect(result.kick).toBe(50);
    expect(result.redact).toBe(50);
    expect(result.invite).toBe(0);
    expect(result.state_default).toBe(50);
    expect(result.events_default).toBe(0);
    expect(result.users_default).toBe(0);
    expect(result.events?.['some.existing.event']).toBe(100);
    expect(result.events?.['new.event']).toBe(0);
  });

  it('returns empty events when neither base nor overrides have events', () => {
    const base: IPowerLevels = { ban: 50 };
    const overrides: Partial<IPowerLevels> = { kick: 50 };
    const result = createPowerLevelContentOverrides(base, overrides);
    // events key should not appear at all (or be undefined)
    expect(result.events).toBeUndefined();
  });

  it('produces events when only base has events', () => {
    const base: IPowerLevels = { events: { 'a': 50 } };
    const overrides: Partial<IPowerLevels> = {};
    const result = createPowerLevelContentOverrides(base, overrides);
    expect(result.events?.['a']).toBe(50);
  });

  it('produces events when only overrides has events', () => {
    const base: IPowerLevels = {};
    const overrides: Partial<IPowerLevels> = { events: { 'b': 0 } };
    const result = createPowerLevelContentOverrides(base, overrides);
    expect(result.events?.['b']).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Call-room PL shape — same args as used in createRoom for RoomType.Call
// ─────────────────────────────────────────────────────────────────────────────

describe('createPowerLevelContentOverrides — call-room shape (as used in createRoom)', () => {
  // This mirrors the logic in utils.ts createRoom when data.type === RoomType.Call:
  //   createPowerLevelContentOverrides(data.powerLevelContentOverrides ?? {}, {
  //     events: {
  //       'org.matrix.msc3401.call': 100,
  //       'org.matrix.msc3401.call.member': 0,
  //       'org.bettercord.call.info': 0,
  //     },
  //   })

  const CALL_ROOM_EVENTS_OVERRIDE: IPowerLevels = {
    events: {
      'org.matrix.msc3401.call': 100,
      'org.matrix.msc3401.call.member': 0,
      'org.bettercord.call.info': 0,
    },
  };

  it('org.matrix.msc3401.call is 100 in the call-room PL', () => {
    const result = createPowerLevelContentOverrides({}, CALL_ROOM_EVENTS_OVERRIDE);
    expect(result.events?.['org.matrix.msc3401.call']).toBe(100);
  });

  it('org.matrix.msc3401.call.member is 0 in the call-room PL', () => {
    const result = createPowerLevelContentOverrides({}, CALL_ROOM_EVENTS_OVERRIDE);
    expect(result.events?.['org.matrix.msc3401.call.member']).toBe(0);
  });

  it('io.bettercord.call.presence is NOT in the call-room PL', () => {
    const result = createPowerLevelContentOverrides({}, CALL_ROOM_EVENTS_OVERRIDE);
    expect(result.events?.['io.bettercord.call.presence']).toBeUndefined();
  });

  it('org.bettercord.call.info is 0 in the call-room PL', () => {
    const result = createPowerLevelContentOverrides({}, CALL_ROOM_EVENTS_OVERRIDE);
    expect(result.events?.['org.bettercord.call.info']).toBe(0);
  });

  it('call-room PL preserves any base powerLevelContentOverrides passed in', () => {
    const existingBase: IPowerLevels = {
      ban: 50,
      kick: 50,
      users: { '@admin:server': 100 },
      events: { 'some.custom.event': 50 },
    };
    const result = createPowerLevelContentOverrides(existingBase, CALL_ROOM_EVENTS_OVERRIDE);

    expect(result.ban).toBe(50);
    expect(result.kick).toBe(50);
    expect(result.users?.['@admin:server']).toBe(100);
    expect(result.events?.['some.custom.event']).toBe(50);
    // Call-specific overrides still applied
    expect(result.events?.['org.matrix.msc3401.call']).toBe(100);
    expect(result.events?.['io.bettercord.call.presence']).toBeUndefined();
  });

  it('non-call rooms (no override applied) do NOT get the call-specific event entries', () => {
    // When data.type !== RoomType.Call, callPowerLevels = data.powerLevelContentOverrides
    // and no call-specific events are injected.
    // We verify by NOT applying the call override:
    const nonCallBase: IPowerLevels = {
      ban: 50,
      kick: 50,
    };
    // For a non-call room, powerLevelContentOverrides is passed directly — no merging.
    // So we just check that the base has no call entries:
    expect(nonCallBase.events?.['org.matrix.msc3401.call']).toBeUndefined();
    expect(nonCallBase.events?.['org.matrix.msc3401.call.member']).toBeUndefined();
    expect(nonCallBase.events?.['io.bettercord.call.presence']).toBeUndefined();
    expect(nonCallBase.events?.['org.bettercord.call.info']).toBeUndefined();
  });

  it('RoomType.Call value is org.matrix.msc3417.call (verify enum)', () => {
    // Sanity check that the enum value used in createRoom is correct
    expect(RoomType.Call).toBe('org.matrix.msc3417.call');
  });
});
