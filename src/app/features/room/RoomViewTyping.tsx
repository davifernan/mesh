import React, { useEffect } from 'react';
import { Box, Text, as } from 'folds';
import { Room } from 'matrix-js-sdk';
import classNames from 'classnames';
import { useSetAtom } from 'jotai';
import { roomIdToTypingMembersAtom } from '../../state/typingMembers';
import { TypingIndicator } from '../../components/typing-indicator';
import { getMemberDisplayName } from '../../utils/room';
import { getMxIdLocalPart } from '../../utils/matrix';
import * as css from './RoomViewTyping.css';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoomTypingMember } from '../../hooks/useRoomTypingMembers';

// #35 — Auto-expire stale typing indicators after 30s.
// Some homeservers never send a typing-stop event, leaving indicators forever.
// The old workaround was a manual "Tipp-Status verwerfen" button — no other
// client has this button, so we replaced it with a silent client-side timeout.
const TYPING_AUTO_EXPIRE_MS = 30_000;

export type RoomViewTypingProps = {
  room: Room;
};
export const RoomViewTyping = as<'div', RoomViewTypingProps>(
  ({ className, room, ...props }, ref) => {
    const setTypingMembers = useSetAtom(roomIdToTypingMembersAtom);
    const mx = useMatrixClient();
    const typingMembers = useRoomTypingMember(room.roomId);

    const typingNames = typingMembers
      .filter((receipt) => receipt.userId !== mx.getUserId())
      .map(
        (receipt) => getMemberDisplayName(room, receipt.userId) ?? getMxIdLocalPart(receipt.userId)
      )
      .reverse();

    // Auto-expire: when new typing members appear, schedule removal after 30s.
    // This handles homeservers that never send a typing-stop event.
    useEffect(() => {
      if (typingMembers.length === 0) return;
      const timer = setTimeout(() => {
        typingMembers.forEach((receipt) =>
          setTypingMembers({ type: 'DELETE', roomId: room.roomId, userId: receipt.userId })
        );
      }, TYPING_AUTO_EXPIRE_MS);
      return () => clearTimeout(timer);
    // Re-schedule whenever the member list changes (new typist resets the clock)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [typingMembers.map((r) => r.userId).join(','), room.roomId]);

    if (typingNames.length === 0) {
      return <div className={css.RoomViewTypingPlaceholder} aria-hidden="true" />;
    }

    const n = typingNames.length;

    const typingContent = (() => {
      if (n >= 10) {
        return (
          <Text as="span" size="Inherit" priority="300">
            {'Viele Personen tippen…'}
          </Text>
        );
      }
      if (n === 1) {
        return (
          <>
            <b>{typingNames[0]}</b>
            <Text as="span" size="Inherit" priority="300">
              {' tippt…'}
            </Text>
          </>
        );
      }
      if (n === 2) {
        return (
          <>
            <b>{typingNames[0]}</b>
            <Text as="span" size="Inherit" priority="300">
              {' und '}
            </Text>
            <b>{typingNames[1]}</b>
            <Text as="span" size="Inherit" priority="300">
              {' tippen…'}
            </Text>
          </>
        );
      }
      if (n === 3) {
        return (
          <>
            <b>{typingNames[0]}</b>
            <Text as="span" size="Inherit" priority="300">
              {', '}
            </Text>
            <b>{typingNames[1]}</b>
            <Text as="span" size="Inherit" priority="300">
              {' und '}
            </Text>
            <b>{typingNames[2]}</b>
            <Text as="span" size="Inherit" priority="300">
              {' tippen…'}
            </Text>
          </>
        );
      }
      // 4–9 people
      const rest = n - 3;
      const restLabel = rest === 1 ? 'Person tippt' : 'Personen tippen';
      return (
        <>
          <b>{typingNames[0]}</b>
          <Text as="span" size="Inherit" priority="300">
            {', '}
          </Text>
          <b>{typingNames[1]}</b>
          <Text as="span" size="Inherit" priority="300">
            {', '}
          </Text>
          <b>{typingNames[2]}</b>
          <Text as="span" size="Inherit" priority="300">
            {' und '}
          </Text>
          <b>{rest} weitere</b>
          <Text as="span" size="Inherit" priority="300">
            {` ${restLabel}…`}
          </Text>
        </>
      );
    })();

    return (
      <Box
        className={classNames(css.RoomViewTyping, className)}
        alignItems="Center"
        gap="400"
        {...props}
        ref={ref}
      >
        <TypingIndicator />
        <Text className={css.TypingText} size="T300" truncate>
          {typingContent}
        </Text>
      </Box>
    );
  }
);
