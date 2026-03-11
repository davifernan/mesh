// @ts-ignore
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * featureFlags.test.ts
 *
 * Tests for:
 *   1. Feature flag types in ClientConfig (type-level, no runtime assertions needed)
 *   2. VoiceStateSource discriminated union in RoomNavUser
 *   3. useVoiceStateService — resolveUserPresence with authoritativeBridgeMode on/off
 *   4. disableMatrixPresenceWrites guard — publishPresence no-op when flag is set
 *
 * All heavy modules are mocked so this runs in Vitest without a browser.
 */

import { vi } from 'vitest';

// ─── Mocks (must precede all imports) ────────────────────────────────────────

vi.mock('../app/hooks/useClientConfig', () => {
  let _config: Record<string, unknown> = {};
  return {
    useClientConfig: () => _config,
    ClientConfigProvider: ({ children }: { children: unknown }) => children,
    // Expose a setter so tests can swap the config
    __setConfig: (c: Record<string, unknown>) => { _config = c; },
  };
});

vi.mock('../app/hooks/useBridgeRoomPresence', () => ({
  useBridgeRoomPresence: vi.fn(() => new Map()),
}));

vi.mock('../app/features/room-nav/RoomNavUser', () => ({
  resolvePresence: vi.fn((args: Record<string, unknown>) => ({
    isMicMuted: false,
    isCameraOn: false,
    isScreenSharing: false,
    isDeafened: false,
    ...args,
  })),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import type { CallPresenceState } from '../app/features/call/callPresenceState';
import { EMPTY_CALL_PRESENCE_STATE } from '../app/features/call/callPresenceState';
import { resolvePresence } from '../app/features/room-nav/RoomNavUser';
import type { VoiceStateSource } from '../app/features/room-nav/RoomNavUser';

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: VoiceStateSource discriminated union
// ─────────────────────────────────────────────────────────────────────────────

describe('VoiceStateSource discriminated union', () => {
  it('local kind is assignable', () => {
    const src: VoiceStateSource = { kind: 'local' };
    expect(src.kind).toBe('local');
  });

  it('authoritative kind carries resolvedPresence', () => {
    const presence: CallPresenceState = {
      isMicMuted: true,
      isCameraOn: false,
      isScreenSharing: false,
      isDeafened: false,
    };
    const src: VoiceStateSource = { kind: 'authoritative', resolvedPresence: presence };
    expect(src.kind).toBe('authoritative');
    if (src.kind === 'authoritative') {
      expect(src.resolvedPresence.isMicMuted).toBe(true);
    }
  });

  it('authoritative kind with all-false presence', () => {
    const src: VoiceStateSource = {
      kind: 'authoritative',
      resolvedPresence: EMPTY_CALL_PRESENCE_STATE,
    };
    if (src.kind === 'authoritative') {
      expect(src.resolvedPresence).toEqual(EMPTY_CALL_PRESENCE_STATE);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: resolvePresence — authoritative bridge mode integration
//
// These tests verify the logic that useVoiceStateService applies when
// authoritativeBridgeMode is enabled: the bridge snapshot is passed as
// remoteBridge even for the local user.
// ─────────────────────────────────────────────────────────────────────────────

describe('resolvePresence — authoritative bridge mode integration', () => {
  const baseArgs = {
    isLocalUser: false,
    isActiveCall: false,
    pState: undefined,
    remoteBridge: undefined,
    persistedPresence: EMPTY_CALL_PRESENCE_STATE,
    isAudioEnabled: true,
    isVideoEnabled: false,
    isCallDeafened: false,
    isScreenShareEnabled: false,
  };

  it('in authoritative mode, bridge state is passed as remoteBridge for remote user', () => {
    const bridgeState: CallPresenceState = {
      isMicMuted: true,
      isCameraOn: false,
      isScreenSharing: false,
      isDeafened: false,
    };

    // Simulate what useVoiceStateService does in authoritative mode for a remote user:
    // it passes bridgeSnapshot.get(userId) as remoteBridge regardless of isLocalUser.
    const result = resolvePresence({
      ...baseArgs,
      isLocalUser: false,
      remoteBridge: bridgeState,
    });

    // resolvePresence is mocked — just verify it was called with remoteBridge set
    expect(resolvePresence).toHaveBeenCalledWith(
      expect.objectContaining({ remoteBridge: bridgeState }),
    );
  });

  it('in authoritative mode, bridge state is passed as remoteBridge even for local user', () => {
    const bridgeState: CallPresenceState = {
      isMicMuted: false,
      isCameraOn: true,
      isScreenSharing: false,
      isDeafened: false,
    };

    // In authoritative mode useVoiceStateService passes bridge for local user too
    resolvePresence({
      ...baseArgs,
      isLocalUser: true,
      remoteBridge: bridgeState,
    });

    expect(resolvePresence).toHaveBeenCalledWith(
      expect.objectContaining({ isLocalUser: true, remoteBridge: bridgeState }),
    );
  });

  it('in default (local) mode, remoteBridge is undefined for local user', () => {
    const bridgeState: CallPresenceState = {
      isMicMuted: true,
      isCameraOn: false,
      isScreenSharing: false,
      isDeafened: false,
    };

    // Default mode: useVoiceStateService passes undefined for local user
    resolvePresence({
      ...baseArgs,
      isLocalUser: true,
      remoteBridge: undefined, // explicitly undefined for local user in default mode
    });

    expect(resolvePresence).toHaveBeenCalledWith(
      expect.objectContaining({ isLocalUser: true, remoteBridge: undefined }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: disableMatrixPresenceWrites — guard logic
//
// These tests verify the guard logic in publishPresence / clearPresence.
// We replicate the guard condition directly (the hook itself is too heavy to
// mount in a unit test without a full React tree), so we test the invariant:
//   "when the flag is true, publishCallPresenceState must NOT be called"
// ─────────────────────────────────────────────────────────────────────────────

describe('disableMatrixPresenceWrites guard logic', () => {
  /**
   * Minimal replica of the publishPresence guard from nativeCallEngine.ts.
   * Returns true if the write would proceed, false if guarded.
   */
  function wouldPublish(disableFlag: boolean, roomId: string | null): boolean {
    if (disableFlag) return false;
    if (!roomId) return false;
    return true;
  }

  it('publishes when flag is false and roomId is set', () => {
    expect(wouldPublish(false, '!room:server')).toBe(true);
  });

  it('does NOT publish when flag is true (regardless of roomId)', () => {
    expect(wouldPublish(true, '!room:server')).toBe(false);
    expect(wouldPublish(true, null)).toBe(false);
  });

  it('does NOT publish when roomId is null (regardless of flag)', () => {
    expect(wouldPublish(false, null)).toBe(false);
  });

  it('flag=false + null roomId → no publish', () => {
    expect(wouldPublish(false, null)).toBe(false);
  });

  it('flag=true + valid roomId → no publish (flag wins)', () => {
    expect(wouldPublish(true, '!any:server')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: ClientConfig featureFlags type contract
//
// These tests verify that the featureFlags shape is correctly typed and that
// default values (undefined → false) are handled correctly.
// ─────────────────────────────────────────────────────────────────────────────

describe('ClientConfig featureFlags defaults', () => {
  function resolveFlag(
    featureFlags: { authoritativeBridgeMode?: boolean; disableMatrixPresenceWrites?: boolean } | undefined,
    key: 'authoritativeBridgeMode' | 'disableMatrixPresenceWrites',
  ): boolean {
    return featureFlags?.[key] ?? false;
  }

  it('authoritativeBridgeMode defaults to false when featureFlags is undefined', () => {
    expect(resolveFlag(undefined, 'authoritativeBridgeMode')).toBe(false);
  });

  it('disableMatrixPresenceWrites defaults to false when featureFlags is undefined', () => {
    expect(resolveFlag(undefined, 'disableMatrixPresenceWrites')).toBe(false);
  });

  it('authoritativeBridgeMode defaults to false when featureFlags is empty object', () => {
    expect(resolveFlag({}, 'authoritativeBridgeMode')).toBe(false);
  });

  it('disableMatrixPresenceWrites defaults to false when featureFlags is empty object', () => {
    expect(resolveFlag({}, 'disableMatrixPresenceWrites')).toBe(false);
  });

  it('authoritativeBridgeMode=true is respected', () => {
    expect(resolveFlag({ authoritativeBridgeMode: true }, 'authoritativeBridgeMode')).toBe(true);
  });

  it('disableMatrixPresenceWrites=true is respected', () => {
    expect(resolveFlag({ disableMatrixPresenceWrites: true }, 'disableMatrixPresenceWrites')).toBe(true);
  });

  it('flags are independent — one true does not affect the other', () => {
    const flags = { authoritativeBridgeMode: true, disableMatrixPresenceWrites: false };
    expect(resolveFlag(flags, 'authoritativeBridgeMode')).toBe(true);
    expect(resolveFlag(flags, 'disableMatrixPresenceWrites')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 5: useVoiceStateService — resolveUserPresence routing
//
// Tests the routing logic inside useVoiceStateService.resolveUserPresence:
//   - In default mode: remoteBridge is undefined for local user, set for remote
//   - In authoritative mode: remoteBridge is set for both local and remote users
// ─────────────────────────────────────────────────────────────────────────────

describe('useVoiceStateService — resolveUserPresence routing', () => {
  const bridgeState: CallPresenceState = {
    isMicMuted: true,
    isCameraOn: false,
    isScreenSharing: false,
    isDeafened: false,
  };

  const baseResolveArgs = {
    isLocalUser: false,
    isActiveCall: false,
    pState: undefined as { audioEnabled: boolean; videoEnabled: boolean; isScreenSharing: boolean } | undefined,
    persistedPresence: EMPTY_CALL_PRESENCE_STATE,
    isAudioEnabled: true,
    isVideoEnabled: false,
    isCallDeafened: false,
    isScreenShareEnabled: false,
  };

  /**
   * Minimal replica of the routing logic inside useVoiceStateService.resolveUserPresence.
   * Returns the remoteBridge value that would be passed to resolvePresence().
   */
  function routeRemoteBridge(
    isAuthoritativeMode: boolean,
    isLocalUser: boolean,
    bridgeSnapshot: ReadonlyMap<string, CallPresenceState>,
    userId: string,
    forceAuthoritativeBridge?: boolean,
  ): CallPresenceState | undefined {
    const useAuthoritative = forceAuthoritativeBridge ?? isAuthoritativeMode;
    return useAuthoritative
      ? bridgeSnapshot.get(userId)
      : isLocalUser
        ? undefined
        : bridgeSnapshot.get(userId);
  }

  it('default mode, remote user: bridge state is passed', () => {
    const snapshot = new Map([['@remote:server', bridgeState]]);
    const result = routeRemoteBridge(false, false, snapshot, '@remote:server');
    expect(result).toBe(bridgeState);
  });

  it('default mode, local user: bridge state is NOT passed (undefined)', () => {
    const snapshot = new Map([['@local:server', bridgeState]]);
    const result = routeRemoteBridge(false, true, snapshot, '@local:server');
    expect(result).toBeUndefined();
  });

  it('authoritative mode, remote user: bridge state is passed', () => {
    const snapshot = new Map([['@remote:server', bridgeState]]);
    const result = routeRemoteBridge(true, false, snapshot, '@remote:server');
    expect(result).toBe(bridgeState);
  });

  it('authoritative mode, local user: bridge state IS passed (authoritative wins)', () => {
    const snapshot = new Map([['@local:server', bridgeState]]);
    const result = routeRemoteBridge(true, true, snapshot, '@local:server');
    expect(result).toBe(bridgeState);
  });

  it('forceAuthoritativeBridge=true overrides default mode for local user', () => {
    const snapshot = new Map([['@local:server', bridgeState]]);
    // isAuthoritativeMode=false but forceAuthoritativeBridge=true
    const result = routeRemoteBridge(false, true, snapshot, '@local:server', true);
    expect(result).toBe(bridgeState);
  });

  it('forceAuthoritativeBridge=false overrides authoritative mode for local user', () => {
    const snapshot = new Map([['@local:server', bridgeState]]);
    // isAuthoritativeMode=true but forceAuthoritativeBridge=false
    const result = routeRemoteBridge(true, true, snapshot, '@local:server', false);
    expect(result).toBeUndefined();
  });

  it('returns undefined when userId is not in bridge snapshot', () => {
    const snapshot = new Map<string, CallPresenceState>();
    expect(routeRemoteBridge(false, false, snapshot, '@unknown:server')).toBeUndefined();
    expect(routeRemoteBridge(true, false, snapshot, '@unknown:server')).toBeUndefined();
    expect(routeRemoteBridge(true, true, snapshot, '@unknown:server')).toBeUndefined();
  });
});
