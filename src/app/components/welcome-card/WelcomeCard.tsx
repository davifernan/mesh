import React from 'react';
import { MatrixEvent } from 'matrix-js-sdk';
import { Avatar, Icon, Icons } from 'folds';
import { UserAvatar } from '../user-avatar';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';

interface WelcomeCardProps {
  event: MatrixEvent;
}

export function WelcomeCard({ event }: WelcomeCardProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();

  const targetId = event.getStateKey() ?? event.getSender() ?? '';
  const content = event.getContent();
  const displayName: string = content.displayname ?? targetId;

  const targetUser = mx.getUser(targetId);
  const avatarMxc = content.avatar_url as string | undefined ?? targetUser?.avatarUrl;
  const avatarUrl = avatarMxc
    ? mx.mxcUrlToHttp(avatarMxc, 96, 96, 'crop', undefined, false, useAuthentication) ?? undefined
    : undefined;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 16px',
        gap: '12px',
        background: 'var(--background-secondary)',
        borderRadius: '8px',
        margin: '8px 16px',
        textAlign: 'center',
      }}
    >
      <Avatar size="500">
        <UserAvatar
          userId={targetId}
          src={avatarUrl}
          alt={displayName}
          renderFallback={() => <Icon size="400" src={Icons.User} filled />}
        />
      </Avatar>
      <div>
        <div
          style={{
            fontWeight: 700,
            fontSize: '16px',
            color: 'var(--text-primary)',
          }}
        >
          {`${displayName} joined the server!`}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginTop: 4,
          }}
        >
          {'Welcome to the community!'}
        </div>
      </div>
    </div>
  );
}
