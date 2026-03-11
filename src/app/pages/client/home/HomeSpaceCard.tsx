import React, { useMemo } from 'react';
import { SpeakerHigh, Monitor } from '@phosphor-icons/react';
import { useAtomValue } from 'jotai';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { useRoomUnread } from '../../../state/hooks/unread';
import { roomToUnreadAtom } from '../../../state/room/roomToUnread';
import { selectSpaceHasVoiceActivity, selectSpaceHasLiveActivity } from '../../../state/voiceActivity';
import { UnreadBadge } from '../../../components/unread-badge';
import { getRoomAvatarUrl } from '../../../utils/room';
import { nameInitials } from '../../../utils/common';
import homeStyles from './Home.module.css';

export type HomeSpaceCardProps = {
  roomId: string;
  selected: boolean;
  onClick: (roomId: string) => void;
};

export function HomeSpaceCard({ roomId, selected, onClick }: HomeSpaceCardProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const unread = useRoomUnread(roomId, roomToUnreadAtom);
  const space = mx.getRoom(roomId);

  // Bug 1: Voice activity — reads from spaceVoiceActivityAtom (populated by SpaceTabs)
  const voiceAtom = useMemo(() => selectSpaceHasVoiceActivity(roomId), [roomId]);
  const hasVoiceActivity = useAtomValue(voiceAtom);

  // Bug 2: Live stream — reads from spaceLiveActivityAtom (populated by SpaceTabs)
  const liveAtom = useMemo(() => selectSpaceHasLiveActivity(roomId), [roomId]);
  const hasLiveActivity = useAtomValue(liveAtom);

  if (!space) return null;

  const avatarUrl = getRoomAvatarUrl(mx, space, 96, useAuthentication);

  return (
    <button
      type="button"
      className={`${homeStyles.spaceCard} ${selected ? homeStyles.spaceCardActive : ''}`}
      onClick={() => onClick(roomId)}
      aria-label={`${space.name} space`}
    >
      {/* Outer wrapper — badge positioning parent (no overflow: hidden) */}
      <div className={homeStyles.spaceAvatarWrapper}>
        {/* Inner avatar — overflow: hidden clips the image */}
        <div className={homeStyles.spaceAvatar}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={space.name} />
          ) : (
            <span className={homeStyles.spaceAvatarFallback}>{nameInitials(space.name, 2)}</span>
          )}
        </div>

        {/* Bug 3: Unread badge with actual count (bottom-right) */}
        {unread && unread.total > 0 && (
          <span className={homeStyles.spaceUnreadBadge}>
            <UnreadBadge highlight={unread.highlight > 0} count={unread.total} />
          </span>
        )}

        {/* Bug 1: Voice activity badge (bottom-left) — hidden when unread badge shown */}
        {(!unread || unread.total === 0) && hasVoiceActivity && (
          <span className={homeStyles.spaceVoiceBadge} title="Voice activity">
            <SpeakerHigh size={10} weight="fill" />
          </span>
        )}

        {/* Bug 2: Live stream badge (top-right) — always shown when active */}
        {hasLiveActivity && (
          <span className={homeStyles.spaceLiveBadge} title="Live stream">
            <Monitor size={10} weight="fill" />
          </span>
        )}
      </div>
      <span className={homeStyles.spaceName}>{space.name}</span>
    </button>
  );
}
