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

// ── Call-room presence permission helpers ──────────────────────────────────────
//
// Voice rooms MUST allow every user (power level 0) to write these event types,
// otherwise non-participants never receive mute/camera/deafen/screenshare state.
//
// These helpers are used at call-join time (nativeCallEngine.ts) to:
//  1. Detect whether a room is already correctly configured.
//  2. Build a surgical power-level repair that only adds the missing entries
//     without touching any other fields.
//  3. Check whether the current user has permission to apply the repair.

/** Event types that must be at power level 0 in every BetterCord voice room. */
export const REQUIRED_CALL_ROOM_EVENTS: readonly string[] = [
  'org.matrix.msc3401.call.member',
  'io.bettercord.call.presence',
  'org.bettercord.call.info',
] as const;

export type CallPresencePermissionStatus = {
  /** True if the current user can already write io.bettercord.call.presence. */
  canWrite: boolean;
  /** Event types whose PL override is missing or above 0. */
  missingEventOverrides: string[];
  /** True if the current user has enough power to repair the PLs. */
  canRepair: boolean;
};

/**
 * Checks whether a voice room has the required power-level overrides for
 * presence events and whether the current user can write/repair them.
 *
 * Never throws — returns safe defaults if the room or PL event is missing.
 */
export function checkCallPresencePermissions(
  mx: MatrixClient,
  roomId: string,
): CallPresencePermissionStatus {
  const room = mx.getRoom(roomId);
  const userId = mx.getUserId() ?? '';

  if (!room) {
    return { canWrite: false, missingEventOverrides: [...REQUIRED_CALL_ROOM_EVENTS], canRepair: false };
  }

  const plEvent = room.currentState.getStateEvents('m.room.power_levels', '');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plContent = (plEvent as any)?.getContent?.() ?? {};
  const eventOverrides = (plContent.events ?? {}) as Record<string, number>;
  const stateDefault = (typeof plContent.state_default === 'number' ? plContent.state_default : 50);
  const userPower = (
    typeof plContent.users?.[userId] === 'number'
      ? plContent.users[userId]
      : typeof plContent.users_default === 'number'
        ? plContent.users_default
        : 0
  ) as number;

  const presenceEventPL = typeof eventOverrides['io.bettercord.call.presence'] === 'number'
    ? eventOverrides['io.bettercord.call.presence']
    : stateDefault;
  const canWrite = userPower >= presenceEventPL;

  const missingEventOverrides = REQUIRED_CALL_ROOM_EVENTS.filter(
    (ev) => (typeof eventOverrides[ev] === 'number' ? eventOverrides[ev] : stateDefault) > 0,
  );

  // To repair PLs the user must be able to send m.room.power_levels state events.
  const plEditPL = typeof eventOverrides['m.room.power_levels'] === 'number'
    ? eventOverrides['m.room.power_levels']
    : stateDefault;
  const canRepair = missingEventOverrides.length > 0 && userPower >= plEditPL;

  return { canWrite, missingEventOverrides, canRepair };
}

/**
 * Builds a surgically-merged power-level content object that adds only the
 * missing event overrides without modifying any other fields.
 *
 * Safe to send as-is to `mx.sendStateEvent(roomId, 'm.room.power_levels', ...)`.
 */
export function buildCallRoomPresenceRepair(
  existingPLContent: Record<string, unknown>,
  missingEventOverrides: string[],
): Record<string, unknown> {
  if (missingEventOverrides.length === 0) return existingPLContent;

  const existingEvents = ((existingPLContent.events ?? {}) as Record<string, number>);
  const repairedEvents: Record<string, number> = { ...existingEvents };
  for (const eventType of missingEventOverrides) {
    repairedEvents[eventType] = 0;
  }

  return {
    ...existingPLContent,
    events: repairedEvents,
  };
}
