export type PresenceBadgeKind = 'live' | 'camera' | 'deafened' | 'muted';

export type PresenceBadgeState = {
  isScreenSharing: boolean;
  isCameraOn: boolean;
  isDeafened: boolean;
  isMicMuted: boolean;
};

export const PRESENCE_BADGE_LABEL: Record<PresenceBadgeKind, string> = {
  live: 'Sharing screen (LIVE)',
  camera: 'Camera on',
  deafened: 'Deafened',
  muted: 'Microphone muted',
};

export function getPresenceBadgeKinds(state: PresenceBadgeState): PresenceBadgeKind[] {
  const badges: PresenceBadgeKind[] = [];

  if (state.isScreenSharing) badges.push('live');
  if (state.isCameraOn) badges.push('camera');
  if (state.isDeafened) badges.push('deafened');
  if (state.isMicMuted) badges.push('muted');

  return badges;
}

export function getPresenceSummary(state: PresenceBadgeState): string {
  const labels = getPresenceBadgeKinds(state).map((kind) => PRESENCE_BADGE_LABEL[kind]);
  if (labels.length === 0) return 'No active call status badges';
  return labels.join(', ');
}
