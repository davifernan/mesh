import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';

export const BETTERCORD_CALL_PRESENCE_EVENT = 'io.bettercord.call.presence';

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

type PresenceContent = Partial<CallPresenceState> & {
  updatedAt?: number;
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

function getPresenceEvents(room: Room, userId?: string): MatrixEvent[] {
  const events = room.currentState.getStateEvents(BETTERCORD_CALL_PRESENCE_EVENT) ?? [];
  const presenceEvents = Array.isArray(events) ? events : [events];
  return userId ? presenceEvents.filter((event) => event.getSender() === userId) : presenceEvents;
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

function aggregatePresenceState(events: MatrixEvent[]): CallPresenceState {
  return events.reduce<CallPresenceState>((state, event) => {
    const content = event.getContent<PresenceContent>() ?? {};
    if (Object.keys(content).length === 0) return state;

    return {
      isMicMuted: state.isMicMuted || content.isMicMuted === true,
      isCameraOn: state.isCameraOn || content.isCameraOn === true,
      isScreenSharing: state.isScreenSharing || content.isScreenSharing === true,
      isDeafened: state.isDeafened || content.isDeafened === true,
    };
  }, EMPTY_CALL_PRESENCE_STATE);
}

export function getCallMemberPresenceState(
  mx: MatrixClient,
  roomId: string,
  userId: string
): CallPresenceState {
  const room = mx.getRoom(roomId);
  if (!room) return EMPTY_CALL_PRESENCE_STATE;

  const persistedPresence = aggregatePresenceState(getPresenceEvents(room, userId));
  const hasLegacyScreenshare = getCallMemberEvents(room, userId).some((event) =>
    contentHasScreenShare(event.getContent<Record<string, unknown>>())
  );

  return {
    ...persistedPresence,
    isScreenSharing: persistedPresence.isScreenSharing || hasLegacyScreenshare,
  };
}

export function roomHasCallScreenShare(mx: MatrixClient, roomId: string): boolean {
  const room = mx.getRoom(roomId);
  if (!room) return false;

  const hasPersistedPresence = aggregatePresenceState(getPresenceEvents(room)).isScreenSharing;

  if (hasPersistedPresence) return true;

  return getCallMemberEvents(room).some((event) =>
    contentHasScreenShare(event.getContent<Record<string, unknown>>())
  );
}

export async function publishCallPresenceState(
  mx: MatrixClient,
  roomId: string,
  userId: string,
  deviceId: string,
  presence: CallPresenceState | null
): Promise<void> {
  const stateKey = `${userId}_${deviceId}`;

  await mx.sendStateEvent(
    roomId,
    BETTERCORD_CALL_PRESENCE_EVENT as any,
    presence
      ? {
          ...presence,
          updatedAt: Date.now(),
        }
      : {},
    stateKey,
  );
}
