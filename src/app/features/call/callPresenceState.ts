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

function getCallMemberEvents(room: import('matrix-js-sdk').Room): import('matrix-js-sdk').MatrixEvent[] {
  const memberEventTypes = [
    'org.matrix.msc3401.call.member',
    'org.matrix.msc4143.call.member',
  ];

  return memberEventTypes.flatMap((type) => {
    const events = room.currentState.getStateEvents(type) ?? [];
    return Array.isArray(events) ? events : [events];
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

export function roomHasCallScreenShare(mx: import('matrix-js-sdk').MatrixClient, roomId: string): boolean {
  const room = mx.getRoom(roomId);
  if (!room) return false;

  return getCallMemberEvents(room).some((event) =>
    contentHasScreenShare(event.getContent<Record<string, unknown>>())
  );
}
