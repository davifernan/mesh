/**
 * Unit tests for participantIdentity.ts
 *
 * Parity contract with bridge/src/identity.ts:
 *   - Same extractMatrixUserIdFromIdentity semantics
 *   - resolveParticipantUserId checks attributes → metadata → identity → name → fallback
 *   - Identical PARTICIPANT_USER_ID_KEYS order
 *
 * These tests mirror bridge/src/identity.test.ts so that any divergence between
 * the two implementations is caught immediately.
 */

import { describe, it, expect } from 'vitest';
import {
  extractMatrixUserIdFromIdentity,
  resolveParticipantUserId,
  PARTICIPANT_USER_ID_KEYS,
} from '../app/features/call/participantIdentity';

// ── PARTICIPANT_USER_ID_KEYS parity ───────────────────────────────────────────

describe('PARTICIPANT_USER_ID_KEYS', () => {
  it('contains the same keys as the bridge (in the same order)', () => {
    // This list must stay in sync with bridge/src/identity.ts PARTICIPANT_USER_ID_KEYS
    expect(PARTICIPANT_USER_ID_KEYS).toEqual([
      'matrix_user_id',
      'matrixUserId',
      'mx_user_id',
      'mxUserId',
      'claimed_user_id',
      'claimedUserId',
      'user_id',
      'userId',
      'io.element.owned_by',
    ]);
  });
});

// ── extractMatrixUserIdFromIdentity ───────────────────────────────────────────

describe('extractMatrixUserIdFromIdentity', () => {
  // ── Bare IDs (no device suffix) ──────────────────────────────────────────

  it('returns bare Matrix ID unchanged (legacy format, no underscore)', () => {
    expect(extractMatrixUserIdFromIdentity('@alice:server.com')).toBe('@alice:server.com');
  });

  it('returns bare Matrix ID with underscore in localpart unchanged', () => {
    expect(extractMatrixUserIdFromIdentity('@alice_bob:server.com')).toBe('@alice_bob:server.com');
  });

  it('returns bare Matrix ID with underscore in server name unchanged', () => {
    expect(extractMatrixUserIdFromIdentity('@alice:my_server.com')).toBe('@alice:my_server.com');
  });

  // ── MSC4143 device-suffix stripping ──────────────────────────────────────

  it('strips device suffix (MSC4143 format)', () => {
    expect(extractMatrixUserIdFromIdentity('@alice:server.com_DEVICEID')).toBe('@alice:server.com');
  });

  it('strips leading underscore and device suffix (MSC4143 leading-underscore variant)', () => {
    expect(extractMatrixUserIdFromIdentity('_@alice:server.com_DEVICEID')).toBe('@alice:server.com');
  });

  it('handles username with underscore — strips only the device suffix (lastIndexOf)', () => {
    expect(extractMatrixUserIdFromIdentity('@alice_bob:server.com_DEVICEID')).toBe(
      '@alice_bob:server.com',
    );
  });

  it('handles leading underscore + username with underscore', () => {
    expect(extractMatrixUserIdFromIdentity('_@alice_bob:server.com_DEVICEID')).toBe(
      '@alice_bob:server.com',
    );
  });

  it('handles underscore in server name with device suffix', () => {
    expect(extractMatrixUserIdFromIdentity('@alice:my_server.com_DEVICEID')).toBe(
      '@alice:my_server.com',
    );
  });

  // ── Invalid / non-Matrix identities ──────────────────────────────────────

  it('returns null for non-Matrix identity', () => {
    expect(extractMatrixUserIdFromIdentity('some-random-identity')).toBeNull();
  });

  it('returns null for identity without colon', () => {
    expect(extractMatrixUserIdFromIdentity('@noserver')).toBeNull();
  });

  it('returns null for identity without leading @', () => {
    expect(extractMatrixUserIdFromIdentity('alice:server.com')).toBeNull();
  });
});

// ── resolveParticipantUserId — attribute priority ─────────────────────────────

describe('resolveParticipantUserId — attribute priority', () => {
  it('prefers io.element.owned_by attribute', () => {
    expect(
      resolveParticipantUserId({
        identity: '@alice:server.com_DEVICE',
        attributes: { 'io.element.owned_by': '@bob:other.com' },
      }),
    ).toBe('@bob:other.com');
  });

  it('prefers matrix_user_id attribute', () => {
    expect(
      resolveParticipantUserId({
        identity: '@alice:server.com_DEVICE',
        attributes: { matrix_user_id: '@carol:server.com' },
      }),
    ).toBe('@carol:server.com');
  });

  it('prefers claimed_user_id attribute', () => {
    expect(
      resolveParticipantUserId({
        identity: '_@alice:server.com_DEVICE',
        attributes: { claimed_user_id: '@dave:server.com' },
      }),
    ).toBe('@dave:server.com');
  });

  it('ignores attribute values that are not Matrix IDs', () => {
    expect(
      resolveParticipantUserId({
        identity: '@alice:server.com_DEVICE',
        attributes: { matrix_user_id: 'not-a-matrix-id' },
      }),
    ).toBe('@alice:server.com');
  });
});

// ── resolveParticipantUserId — metadata fallback ──────────────────────────────

describe('resolveParticipantUserId — metadata fallback', () => {
  it('reads userId from JSON metadata when no attributes match', () => {
    expect(
      resolveParticipantUserId({
        identity: '@alice:server.com_DEVICE',
        attributes: {},
        metadata: JSON.stringify({ userId: '@meta_user:server.com' }),
      }),
    ).toBe('@meta_user:server.com');
  });

  it('reads matrix_user_id from JSON metadata', () => {
    expect(
      resolveParticipantUserId({
        identity: '@alice:server.com_DEVICE',
        metadata: JSON.stringify({ matrix_user_id: '@meta2:server.com' }),
      }),
    ).toBe('@meta2:server.com');
  });

  it('reads claimed_user_id from JSON metadata', () => {
    expect(
      resolveParticipantUserId({
        identity: '@alice:server.com_DEVICE',
        metadata: JSON.stringify({ claimed_user_id: '@claimed:server.com' }),
      }),
    ).toBe('@claimed:server.com');
  });

  it('attributes take priority over metadata', () => {
    expect(
      resolveParticipantUserId({
        identity: '@alice:server.com_DEVICE',
        attributes: { userId: '@attr_user:server.com' },
        metadata: JSON.stringify({ userId: '@meta_user:server.com' }),
      }),
    ).toBe('@attr_user:server.com');
  });

  it('ignores malformed JSON metadata and falls back to identity', () => {
    expect(
      resolveParticipantUserId({
        identity: '@alice:server.com_DEVICEID',
        attributes: {},
        metadata: 'not-json',
      }),
    ).toBe('@alice:server.com');
  });

  it('ignores non-object JSON metadata and falls back to identity', () => {
    expect(
      resolveParticipantUserId({
        identity: '@alice:server.com_DEVICEID',
        metadata: '"just-a-string"',
      }),
    ).toBe('@alice:server.com');
  });
});

// ── resolveParticipantUserId — identity fallback ──────────────────────────────

describe('resolveParticipantUserId — identity fallback', () => {
  it('falls back to identity parsing when no attributes', () => {
    expect(resolveParticipantUserId({ identity: '@alice:server.com_DEVICEID' })).toBe(
      '@alice:server.com',
    );
  });

  it('falls back to identity parsing with empty attributes', () => {
    expect(
      resolveParticipantUserId({ identity: '@alice:server.com_DEVICEID', attributes: {} }),
    ).toBe('@alice:server.com');
  });

  it('handles _@-prefixed identity with device suffix', () => {
    expect(resolveParticipantUserId({ identity: '_@alice:server.com_DEVICEID' })).toBe(
      '@alice:server.com',
    );
  });

  it('handles username with underscore in identity', () => {
    expect(resolveParticipantUserId({ identity: '@alice_bob:server.com_DEVICEID' })).toBe(
      '@alice_bob:server.com',
    );
  });

  it('handles server name with underscore in identity (no device suffix)', () => {
    expect(resolveParticipantUserId({ identity: '@alice:my_server.com' })).toBe(
      '@alice:my_server.com',
    );
  });

  it('handles server name with underscore in identity (with device suffix)', () => {
    expect(resolveParticipantUserId({ identity: '@alice:my_server.com_DEVICEID' })).toBe(
      '@alice:my_server.com',
    );
  });
});

// ── resolveParticipantUserId — final fallback ─────────────────────────────────

describe('resolveParticipantUserId — final fallback', () => {
  it('strips leading _@ when identity is not a Matrix ID', () => {
    expect(resolveParticipantUserId({ identity: '_@notvalid' })).toBe('@notvalid');
  });

  it('returns identity as-is when not a Matrix ID and no attributes', () => {
    expect(resolveParticipantUserId({ identity: 'some-random-id' })).toBe('some-random-id');
  });
});
