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
