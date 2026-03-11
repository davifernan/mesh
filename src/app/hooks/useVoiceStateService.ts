/**
 * useVoiceStateService
 *
 * Adapter hook that provides a unified voice-state interface over
 * BridgePresenceProvider. It abstracts the bridge vs. local-call resolution
 * so consumers don't need to know which source is authoritative.
 *
 * Behaviour:
 *   - Always subscribes to the bridge SSE for the given roomId (when active).
 *   - Exposes the raw bridge snapshot (Map<userId, CallPresenceState>).
 *   - Exposes a helper to resolve the effective presence for a single user,
 *     delegating to resolvePresence() with the correct priority order.
 *   - When `authoritativeBridgeMode` is enabled in featureFlags, the bridge
 *     snapshot is preferred even for the local user (useful when the backend
 *     is the single source of truth for all participants).
 *
 * Usage:
 *   const vs = useVoiceStateService(roomId, hasActiveCall);
 *   const presence = vs.resolveUserPresence(userId, { isLocalUser, ... });
 *   const rawBridge = vs.bridgeSnapshot;
 *
 * Prerequisite: must be rendered inside <BridgePresenceProvider>.
 */

import { useMemo } from 'react';
import { useBridgeRoomPresence } from './useBridgeRoomPresence';
import { resolveVoiceFeatureFlags, useClientConfig } from './useClientConfig';
import { resolvePresence, type ResolvePresenceArgs } from '../features/room-nav/RoomNavUser';
import type { CallPresenceState } from '../features/call/callPresenceState';

// ─── Public Types ─────────────────────────────────────────────────────────────

export type VoiceStateResolveArgs = Omit<ResolvePresenceArgs, 'remoteBridge'> & {
  /**
   * When true, the bridge snapshot is used as the authoritative source even for
   * the local user (overrides the default local-state-wins behaviour).
   * Defaults to the `authoritativeBridgeMode` feature flag value.
   */
  forceAuthoritativeBridge?: boolean;
};

export type VoiceStateService = {
  /** Raw bridge presence snapshot for the room. Stable reference when unchanged. */
  bridgeSnapshot: ReadonlyMap<string, CallPresenceState>;

  /**
   * Resolves the effective presence for a single user, applying the correct
   * priority order (pState > bridge > Matrix state) and honouring the
   * authoritativeBridgeMode flag.
   */
  resolveUserPresence: (userId: string, args: VoiceStateResolveArgs) => CallPresenceState;

  /** True when authoritativeBridgeMode is enabled in featureFlags. */
  isAuthoritativeMode: boolean;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param roomId  The Matrix room ID to subscribe to, or null/undefined to skip.
 * @param hasActiveCall  When false, the SSE connection is not opened (saves resources).
 */
export function useVoiceStateService(
  roomId: string | null | undefined,
  hasActiveCall: boolean,
): VoiceStateService {
  const clientConfig = useClientConfig();
  const { authoritativeBridgeMode: isAuthoritativeMode } = resolveVoiceFeatureFlags(clientConfig);

  // Only open the SSE connection when the room has an active call.
  const bridgeSnapshot = useBridgeRoomPresence(hasActiveCall ? roomId : null);

  const resolveUserPresence = useMemo(
    () =>
      (userId: string, args: VoiceStateResolveArgs): CallPresenceState => {
        const useAuthoritative = args.forceAuthoritativeBridge ?? isAuthoritativeMode;

        // In authoritative mode the bridge snapshot is passed even for the local
        // user. resolvePresence() still gives local call-state the highest priority
        // for the local user, but the bridge value is available as a fallback.
        const remoteBridge = useAuthoritative
          ? bridgeSnapshot.get(userId)
          : args.isLocalUser
            ? undefined
            : bridgeSnapshot.get(userId);

        return resolvePresence({ ...args, remoteBridge });
      },
    [bridgeSnapshot, isAuthoritativeMode],
  );

  return useMemo(
    () => ({ bridgeSnapshot, resolveUserPresence, isAuthoritativeMode }),
    [bridgeSnapshot, resolveUserPresence, isAuthoritativeMode],
  );
}
