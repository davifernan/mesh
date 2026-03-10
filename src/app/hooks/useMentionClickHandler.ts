import { ReactEventHandler, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoomNavigate } from './useRoomNavigate';
import { useMatrixClient } from './useMatrixClient';
import { isRoomId, isUserId } from '../utils/matrix';
import {
  getDirectRoomPath,
  getHomeRoomPath,
  getSpacePath,
  getSpaceRoomPath,
  withSearchParam,
} from '../pages/pathUtils';
import { _RoomSearchParams } from '../pages/paths';
import { useOpenUserRoomProfile } from '../state/hooks/userRoomProfile';
import { useSpaceOptionally } from './useSpace';

export const useMentionClickHandler = (roomId: string): ReactEventHandler<HTMLElement> => {
  const mx = useMatrixClient();
  const { navigateRoom, navigateSpace } = useRoomNavigate();
  const navigate = useNavigate();
  const openProfile = useOpenUserRoomProfile();
  const space = useSpaceOptionally();

  const handleClick: ReactEventHandler<HTMLElement> = useCallback(
    (evt) => {
      evt.stopPropagation();
      evt.preventDefault();
      const target = evt.currentTarget;
      const mentionId = target.getAttribute('data-mention-id');
      if (typeof mentionId !== 'string') return;
      const mentionKind = target.getAttribute('data-mention-kind');

      if (isUserId(mentionId)) {
        openProfile(roomId, space?.roomId, mentionId, target.getBoundingClientRect());
        return;
      }

      const eventId = target.getAttribute('data-mention-event-id') || undefined;
      const spaceIdOrAlias = target.getAttribute('data-mention-space-id') || undefined;
      const direct = target.getAttribute('data-mention-direct') === 'true';
      const viaServers = target.getAttribute('data-mention-via') || undefined;

      const navigateWithViaServers = (path: string) => {
        navigate(viaServers ? withSearchParam<_RoomSearchParams>(path, { viaServers }) : path);
      };

      if (mentionKind === 'space') {
        navigateWithViaServers(getSpacePath(mentionId));
        return;
      }

      if (spaceIdOrAlias) {
        navigateWithViaServers(getSpaceRoomPath(spaceIdOrAlias, mentionId, eventId));
        return;
      }

      if (direct) {
        navigateWithViaServers(getDirectRoomPath(mentionId, eventId));
        return;
      }

      if (isRoomId(mentionId) && mx.getRoom(mentionId)) {
        if (mx.getRoom(mentionId)?.isSpaceRoom()) navigateSpace(mentionId);
        else navigateRoom(mentionId, eventId);
        return;
      }

      navigateWithViaServers(getHomeRoomPath(mentionId, eventId));
    },
    [mx, navigate, navigateRoom, navigateSpace, roomId, space, openProfile]
  );

  return handleClick;
};
