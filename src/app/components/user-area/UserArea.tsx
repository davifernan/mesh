import React, { useState } from 'react';
import { Avatar, Icon, Icons } from 'folds';
import { useSetAtom } from 'jotai';
import { Microphone, MicrophoneSlash, SpeakerHigh, SpeakerSlash, GearSix } from '@phosphor-icons/react';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useUserProfile } from '../../hooks/useUserProfile';
import { mxcUrlToHttp } from '../../utils/matrix';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { UserAvatar } from '../user-avatar';
import { Presence, useUserPresence, usePresenceLabel } from '../../hooks/useUserPresence';
import { useCallStateOptional } from '../../pages/client/call/CallProvider';
import { openUserSettingsAtom } from '../../state/keyboardShortcutsHelp';
import * as css from './UserArea.css';

export function UserArea() {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const userId = mx.getUserId() as string;
  const profile = useUserProfile(userId);
  const presence = useUserPresence(userId);
  const presenceLabel = usePresenceLabel();
  const callState = useCallStateOptional();
  const [isDeafened, setIsDeafened] = useState(false);
  const setOpenUserSettings = useSetAtom(openUserSettingsAtom);

  const avatarUrl = profile.avatarUrl
    ? mxcUrlToHttp(mx, profile.avatarUrl, useAuthentication, 64, 64, 'crop') ?? undefined
    : undefined;

  const displayName = profile.displayName ?? userId;
  const presenceState = presence?.presence ?? Presence.Offline;
  const statusMsg = presence?.status || presenceLabel[presenceState];

  const isAudioEnabled = callState?.isAudioEnabled ?? true;

  return (
    <div className={css.userArea}>
      <div className={css.avatarWrap}>
        <Avatar size="300">
          <UserAvatar
            userId={userId}
            src={avatarUrl}
            alt={displayName}
            renderFallback={() => <Icon size="300" src={Icons.User} filled />}
          />
        </Avatar>
        <span className={css.presenceDot} data-presence={presenceState} />
      </div>

      <div className={css.textStack}>
        <span className={css.usernameText}>{displayName}</span>
        <span className={css.statusText}>{statusMsg}</span>
      </div>

      <div className={css.controlsRow}>
        <button
          className={css.controlBtnDanger}
          data-active={!isAudioEnabled}
          onClick={() => void callState?.toggleAudio()}
          title={isAudioEnabled ? 'Mute' : 'Unmute'}
          aria-label={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isAudioEnabled
            ? <Microphone size={16} />
            : <MicrophoneSlash size={16} />}
        </button>
        <button
          className={css.controlBtnDanger}
          data-active={isDeafened}
          onClick={() => setIsDeafened((d) => !d)}
          title={isDeafened ? 'Undeafen' : 'Deafen'}
          aria-label={isDeafened ? 'Undeafen' : 'Deafen'}
        >
          {isDeafened ? <SpeakerSlash size={16} /> : <SpeakerHigh size={16} />}
        </button>
        <button
          className={css.controlBtn}
          onClick={() => setOpenUserSettings(true)}
          title="User Settings"
          aria-label="User Settings"
        >
          <GearSix size={16} />
        </button>
      </div>
    </div>
  );
}
