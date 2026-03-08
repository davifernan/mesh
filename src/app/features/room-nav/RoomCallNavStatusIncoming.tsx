import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Phone, PhoneIncoming, PhoneX } from '@phosphor-icons/react';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { mxcUrlToHttp } from '../../utils/matrix';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import * as css from './RoomCallNavStatus.css';

interface IncomingCallCardProps {
  roomId: string;
  onAccept: (roomId: string) => void;
  onReject: (roomId: string) => void;
  onIgnore: (roomId: string) => void;
}

export function IncomingCallCard({
  roomId,
  onAccept,
  onReject,
  onIgnore,
}: IncomingCallCardProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();

  const room = mx.getRoom(roomId);
  const roomName = room?.name ?? roomId;

  // Determine caller: first member that isn't us
  const myUserId = mx.getUserId() ?? '';
  const otherMembers = room?.getMembers().filter((m) => m.userId !== myUserId) ?? [];
  const caller = otherMembers[0] ?? null;
  const callerDisplayName = caller?.name ?? roomName;

  // Avatar resolution
  let avatarHttpUrl: string | null = null;
  const callerUser = caller ? mx.getUser(caller.userId) : null;
  if (callerUser?.avatarUrl) {
    avatarHttpUrl = mxcUrlToHttp(mx, callerUser.avatarUrl, useAuthentication, 80, 80, 'crop') ?? null;
  } else if (caller?.getMxcAvatarUrl()) {
    const mxcUrl = caller.getMxcAvatarUrl();
    if (mxcUrl) {
      avatarHttpUrl = mxcUrlToHttp(mx, mxcUrl, useAuthentication, 80, 80, 'crop') ?? null;
    }
  }

  const initials = callerDisplayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const handleAccept = useCallback(() => onAccept(roomId), [onAccept, roomId]);
  const handleReject = useCallback(() => onReject(roomId), [onReject, roomId]);
  const handleIgnore = useCallback(() => onIgnore(roomId), [onIgnore, roomId]);

  return (
    <motion.div
      className={css.incomingCallCard}
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
      drag
      dragMomentum={false}
      style={{ position: 'fixed', zIndex: 2001, bottom: '80px', right: '16px' }}
    >
      {/* Drag handle pill at top */}
      <div className={css.dragHandle} />

      {/* Label row */}
      <div className={css.incomingLabel}>
        <PhoneIncoming size={14} color="var(--status-online, #23a55a)" weight="fill" />
        <span>INCOMING CALL</span>
      </div>

      {/* Caller avatar — 80px circle */}
      <div className={css.callerAvatar}>
        {avatarHttpUrl ? (
          <img
            src={avatarHttpUrl}
            alt={callerDisplayName}
            className={css.callerAvatarImg}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <span className={css.callerAvatarInitials}>{initials || '?'}</span>
        )}
      </div>

      {/* Caller name */}
      <div className={css.callerName} title={callerDisplayName}>
        {callerDisplayName}
      </div>

      {/* Action buttons */}
      <div className={css.incomingActions}>
        <button
          type="button"
          className={css.acceptBtn}
          onClick={handleAccept}
          aria-label={`Accept call from ${callerDisplayName}`}
        >
          <Phone size={16} weight="fill" /> Accept
        </button>
        <button
          type="button"
          className={css.rejectBtn}
          onClick={handleReject}
          aria-label={`Reject call from ${callerDisplayName}`}
        >
          <PhoneX size={16} weight="fill" /> Reject
        </button>
        <button
          type="button"
          className={css.ignoreBtn}
          onClick={handleIgnore}
          aria-label={`Ignore call from ${callerDisplayName}`}
        >
          Ignore
        </button>
      </div>
    </motion.div>
  );
}
