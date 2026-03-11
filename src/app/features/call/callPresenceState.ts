import type { MatrixEvent, Room } from 'matrix-js-sdk';

export type CallPresenceState = {
  isMicMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isDeafened: boolean;
};

export const EMPTY_CALL_PRESENCE_STATE: CallPresenceState = {
  isMicMuted: false,
  isCameraOn: false,
  isScreenSharing: false,
  isDeafened: false,
};

function getCallMemberEvents(room: Room, userId?: string): MatrixEvent[] {
  const memberEventTypes = [
    'org.matrix.msc3401.call.member',
    'org.matrix.msc4143.call.member',
  ];

  return memberEventTypes.flatMap((type) => {
    const events = room.currentState.getStateEvents(type) ?? [];
    const memberEvents = Array.isArray(events) ? events : [events];
    return userId ? memberEvents.filter((event) => event.getSender() === userId) : memberEvents;
  });
}

function contentHasScreenShare(content?: Record<string, unknown>): boolean {
  const calls = Array.isArray(content?.['m.calls'])
    ? (content['m.calls'] as Record<string, unknown>[])
    : [];
  const now = Date.now();

  return calls.some((call) => {
    const devices = Array.isArray(call['m.devices']) ? (call['m.devices'] as Record<string, unknown>[]) : [];

    return devices.some((device) => {
      const expiresTs = typeof device.expires_ts === 'number' ? device.expires_ts : 0;
      const feeds = Array.isArray(device.feeds) ? (device.feeds as Record<string, unknown>[]) : [];

      return expiresTs > now && feeds.some((feed) => feed.purpose === 'm.screenshare');
    });
  });
}

/**
 * Returns a CallPresenceState for a specific user derived solely from
 * call.member events (MSC3401/MSC4143). The screenshare field reflects
 * whether any of the user's active call.member device feeds carry a
 * `m.screenshare` purpose entry that has not yet expired.
 *
 * All other fields (isMicMuted, isCameraOn, isDeafened) are always false
 * because call.member events do not carry that state — callers should
 * overlay bridge or LiveKit state on top.
 */
export function getCallMemberPresenceState(
  mx: import('matrix-js-sdk').MatrixClient,
  roomId: string,
  userId: string
): CallPresenceState {
  const room = mx.getRoom(roomId);
  if (!room) return EMPTY_CALL_PRESENCE_STATE;

  const isScreenSharing = getCallMemberEvents(room, userId).some((event) =>
    contentHasScreenShare(event.getContent<Record<string, unknown>>())
  );

  return {
    ...EMPTY_CALL_PRESENCE_STATE,
    isScreenSharing,
  };
}

/**
 * Returns true if any participant in the room currently has an active
 * screenshare feed according to call.member state events.
 *
 * Used by RoomNavItem, SpaceTabs, and useSpaceLiveActivity to show the
 * LIVE screenshare badge without requiring the local user to be in the call.
 */
export function roomHasCallScreenShare(mx: import('matrix-js-sdk').MatrixClient, roomId: string): boolean {
  const room = mx.getRoom(roomId);
  if (!room) return false;

  return getCallMemberEvents(room).some((event) =>
    contentHasScreenShare(event.getContent<Record<string, unknown>>())
  );
}
