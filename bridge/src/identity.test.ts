/**
 * Unit tests for identity.ts
 *
 * Verifies that resolveMatrixUserId and extractMatrixUserIdFromIdentity
 * match the frontend's participantIdentity.ts behaviour exactly.
 *
 * Parity contract:
 *   - Same PARTICIPANT_USER_ID_KEYS order
 *   - Same extractMatrixUserIdFromIdentity semantics (bare-ID detection,
 *     device-suffix stripping, underscore-in-server-name edge cases)
 *   - resolveMatrixUserId checks attributes → metadata → identity → fallback
 */

import { describe, expect, it } from 'bun:test';
import { extractMatrixUserIdFromIdentity, resolveMatrixUserId } from './identity.js';

// ── extractMatrixUserIdFromIdentity ───────────────────────────────────────────

describe('extractMatrixUserIdFromIdentity', () => {
  // ── Bare IDs (no device suffix) ──────────────────────────────────────────

  it('returns bare Matrix ID unchanged (legacy format, no underscore)', () => {
    expect(extractMatrixUserIdFromIdentity('@alice:server.com')).toBe('@alice:server.com');
  });

  it('returns bare Matrix ID with underscore in localpart unchanged', () => {
    // No device suffix — the underscore is part of the username
    expect(extractMatrixUserIdFromIdentity('@alice_bob:server.com')).toBe('@alice_bob:server.com');
  });

  it('returns bare Matrix ID with underscore in server name unchanged', () => {
    // Server name contains underscore but there is no device suffix
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
    // lastIndexOf('_') correctly targets the device suffix, not the username underscore
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
    // lastIndexOf strips DEVICEID; candidate @alice:my_server.com is a valid Matrix ID
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

// ── resolveMatrixUserId ───────────────────────────────────────────────────────

describe('resolveMatrixUserId — attribute priority', () => {
  it('prefers io.element.owned_by attribute', () => {
    expect(
      resolveMatrixUserId('@alice:server.com_DEVICE', {
        'io.element.owned_by': '@bob:other.com',
      }),
    ).toBe('@bob:other.com');
  });

  it('prefers matrix_user_id attribute', () => {
    expect(
      resolveMatrixUserId('@alice:server.com_DEVICE', {
        matrix_user_id: '@carol:server.com',
      }),
    ).toBe('@carol:server.com');
  });

  it('prefers claimed_user_id attribute', () => {
    expect(
      resolveMatrixUserId('_@alice:server.com_DEVICE', {
        claimed_user_id: '@dave:server.com',
      }),
    ).toBe('@dave:server.com');
  });

  it('ignores attribute values that are not Matrix IDs', () => {
    expect(
      resolveMatrixUserId('@alice:server.com_DEVICE', {
        matrix_user_id: 'not-a-matrix-id',
      }),
    ).toBe('@alice:server.com');
  });
});

describe('resolveMatrixUserId — metadata fallback', () => {
  it('reads userId from JSON metadata when no attributes match', () => {
    const metadata = JSON.stringify({ userId: '@meta_user:server.com' });
    expect(resolveMatrixUserId('@alice:server.com_DEVICE', {}, metadata)).toBe(
      '@meta_user:server.com',
    );
  });

  it('reads matrix_user_id from JSON metadata', () => {
    const metadata = JSON.stringify({ matrix_user_id: '@meta2:server.com' });
    expect(resolveMatrixUserId('@alice:server.com_DEVICE', {}, metadata)).toBe(
      '@meta2:server.com',
    );
  });

  it('reads claimed_user_id from JSON metadata', () => {
    const metadata = JSON.stringify({ claimed_user_id: '@claimed:server.com' });
    expect(resolveMatrixUserId('@alice:server.com_DEVICE', {}, metadata)).toBe(
      '@claimed:server.com',
    );
  });

  it('attributes take priority over metadata', () => {
    const metadata = JSON.stringify({ userId: '@meta_user:server.com' });
    expect(
      resolveMatrixUserId('@alice:server.com_DEVICE', { userId: '@attr_user:server.com' }, metadata),
    ).toBe('@attr_user:server.com');
  });

  it('ignores malformed JSON metadata and falls back to identity', () => {
    expect(resolveMatrixUserId('@alice:server.com_DEVICEID', {}, 'not-json')).toBe(
      '@alice:server.com',
    );
  });

  it('ignores non-object JSON metadata and falls back to identity', () => {
    expect(resolveMatrixUserId('@alice:server.com_DEVICEID', {}, '"just-a-string"')).toBe(
      '@alice:server.com',
    );
  });
});

describe('resolveMatrixUserId — identity fallback', () => {
  it('falls back to identity parsing when no attributes', () => {
    expect(resolveMatrixUserId('@alice:server.com_DEVICEID')).toBe('@alice:server.com');
  });

  it('falls back to identity parsing with empty attributes', () => {
    expect(resolveMatrixUserId('@alice:server.com_DEVICEID', {})).toBe('@alice:server.com');
  });

  it('handles _@-prefixed identity with device suffix', () => {
    expect(resolveMatrixUserId('_@alice:server.com_DEVICEID')).toBe('@alice:server.com');
  });

  it('handles username with underscore in identity', () => {
    expect(resolveMatrixUserId('@alice_bob:server.com_DEVICEID')).toBe('@alice_bob:server.com');
  });

  it('handles server name with underscore in identity (no device suffix)', () => {
    expect(resolveMatrixUserId('@alice:my_server.com')).toBe('@alice:my_server.com');
  });

  it('handles server name with underscore in identity (with device suffix)', () => {
    expect(resolveMatrixUserId('@alice:my_server.com_DEVICEID')).toBe('@alice:my_server.com');
  });
});

describe('resolveMatrixUserId — final fallback', () => {
  it('strips leading _@ when identity is not a Matrix ID', () => {
    expect(resolveMatrixUserId('_@notvalid')).toBe('@notvalid');
  });

  it('returns identity as-is when not a Matrix ID and no attributes', () => {
    expect(resolveMatrixUserId('some-random-id')).toBe('some-random-id');
  });
});
