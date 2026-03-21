import React, { MouseEventHandler, forwardRef, useState, MouseEvent, useEffect } from 'react';
import { EventType, JoinRule, Room } from 'matrix-js-sdk';
import { Lock, MonitorPlay, SpeakerHigh } from '@phosphor-icons/react';
import {
  Avatar,
  Box,
  Icon,
  IconButton,
  Icons,
  Text,
  Menu,
  MenuItem,
  config,
  PopOut,
  toRem,
  Line,
  RectCords,
  Badge,
  Spinner,
  Tooltip,
  TooltipProvider,
} from 'folds';
import { useFocusWithin, useHover } from 'react-aria';
import FocusTrap from 'focus-trap-react';
import { useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { NavButton, NavItem, NavItemContent, NavItemOptions } from '../../components/nav';
import { UnreadBadge, UnreadBadgeCenter } from '../../components/unread-badge';
import { RoomAvatar, RoomIcon } from '../../components/room-avatar';
import {
  getAccountData,
  getDirectRoomAvatarUrl,
  getMDirects,
  getRoomAvatarUrl,
  getOrphanParents,
  guessPerfectParent,
} from '../../utils/room';
import { nameInitials } from '../../utils/common';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoomUnread } from '../../state/hooks/unread';
import { roomToUnreadAtom } from '../../state/room/roomToUnread';
import { roomToParentsAtom } from '../../state/room/roomToParents';
import { usePowerLevels } from '../../hooks/usePowerLevels';
import { copyToClipboard } from '../../utils/dom';
import { markAsRead } from '../../utils/notifications';
import { UseStateProvider } from '../../components/UseStateProvider';
import { LeaveRoomPrompt } from '../../components/leave-room-prompt';
import { useRoomTypingMember } from '../../hooks/useRoomTypingMembers';
import { TypingIndicator } from '../../components/typing-indicator';
import { stopPropagation } from '../../utils/keyboard';
import { getBetterCordPermalink } from '../../plugins/permalink';
import { getCanonicalAliasOrRoomId, isRoomAlias } from '../../utils/matrix';
import { getViaServers } from '../../plugins/via-servers';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { useOpenRoomSettings } from '../../state/hooks/roomSettings';
import { useSpaceOptionally } from '../../hooks/useSpace';
import {
  getRoomNotificationModeIcon,
  RoomNotificationMode,
} from '../../hooks/useRoomsNotificationPreferences';
import { RoomNotificationModeSwitcher } from '../../components/RoomNotificationSwitcher';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { useRoomPermissions } from '../../hooks/useRoomPermissions';
import { InviteUserPrompt } from '../../components/invite-user-prompt';
import { useCallState } from '../../pages/client/call/CallProvider';
import { mDirectAtom } from '../../state/mDirectList';
import { useClientConfig } from '../../hooks/useClientConfig';
import { AccountDataEvent } from '../../../types/matrix/accountData';
import { useCallMembers, useCallStartTime } from '../../hooks/useCallMemberships';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { RoomNavUser } from './RoomNavUser';
import type { VoiceStateSource } from './RoomNavUser';
import { useRoomName } from '../../hooks/useRoomMeta';
import { useVoiceStateService } from '../../hooks/useVoiceStateService';
import { useStateEvent } from '../../hooks/useStateEvent';
import { StateEvent } from '../../../types/matrix/room';

type RoomNavItemMenuProps = {
  room: Room;
  requestClose: () => void;
  notificationMode?: RoomNotificationMode;
};
const RoomNavItemMenu = forwardRef<HTMLDivElement, RoomNavItemMenuProps>(
  ({ room, requestClose, notificationMode }, ref) => {
    const mx = useMatrixClient();
    const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
    const unread = useRoomUnread(room.roomId, roomToUnreadAtom);
    const powerLevels = usePowerLevels(room);
    const creators = useRoomCreators(room);

    const permissions = useRoomPermissions(creators, powerLevels);
    const canInvite = permissions.action('invite', mx.getSafeUserId());
    const openRoomSettings = useOpenRoomSettings();
    const space = useSpaceOptionally();
    const mDirects = useAtomValue(mDirectAtom);
    const roomToParents = useAtomValue(roomToParentsAtom);
    const { hashRouter } = useClientConfig();

    const [invitePrompt, setInvitePrompt] = useState(false);

    const handleMarkAsRead = () => {
      markAsRead(mx, room.roomId, hideActivity);
      requestClose();
    };

    const handleInvite = () => {
      setInvitePrompt(true);
    };

    const handleCopyLink = () => {
      const roomIdOrAlias = getCanonicalAliasOrRoomId(mx, room.roomId);
      const viaServers = isRoomAlias(roomIdOrAlias) ? undefined : getViaServers(room);
      const orphanParents = getOrphanParents(roomToParents, room.roomId);
      const preferredSpaceId =
        space?.roomId ??
        (orphanParents.length > 0
          ? guessPerfectParent(mx, room.roomId, orphanParents) ?? orphanParents[0]
          : undefined);
      const directEvent = getAccountData(mx, AccountDataEvent.Direct);
      const isDirect =
        mDirects.has(room.roomId) ||
        (!!directEvent && getMDirects(directEvent).has(room.roomId));
      copyToClipboard(
        getBetterCordPermalink(
          {
            kind: 'room',
            roomIdOrAlias,
            viaServers,
            spaceIdOrAlias: preferredSpaceId
              ? getCanonicalAliasOrRoomId(mx, preferredSpaceId)
              : undefined,
            direct: isDirect,
          },
          hashRouter
        )
      );
      requestClose();
    };

    const handleRoomSettings = () => {
      openRoomSettings(room.roomId, space?.roomId);
      requestClose();
    };

    return (
      <Menu role="menu" ref={ref} style={{ maxWidth: toRem(160), width: '100vw' }}>
        {invitePrompt && room && (
          <InviteUserPrompt
            room={room}
            requestClose={() => {
              setInvitePrompt(false);
              requestClose();
            }}
          />
        )}
        <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
          <MenuItem
            onClick={handleMarkAsRead}
            size="300"
            after={<Icon size="100" src={Icons.CheckTwice} />}
            radii="300"
            disabled={!unread}
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Mark as Read
            </Text>
          </MenuItem>
          <RoomNotificationModeSwitcher roomId={room.roomId} value={notificationMode}>
            {(handleOpen, opened, changing) => (
              <MenuItem
                size="300"
                after={
                  changing ? (
                    <Spinner size="100" variant="Secondary" />
                  ) : (
                    <Icon size="100" src={getRoomNotificationModeIcon(notificationMode)} />
                  )
                }
                radii="300"
                aria-pressed={opened}
                onClick={handleOpen}
              >
                <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                  Notifications
                </Text>
              </MenuItem>
            )}
          </RoomNotificationModeSwitcher>
        </Box>
        <Line variant="Surface" size="300" />
        <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
          <MenuItem
            onClick={handleInvite}
            variant="Primary"
            fill="None"
            size="300"
            after={<Icon size="100" src={Icons.UserPlus} />}
            radii="300"
            aria-pressed={invitePrompt}
            disabled={!canInvite}
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Invite
            </Text>
          </MenuItem>
          <MenuItem
            onClick={handleCopyLink}
            size="300"
            after={<Icon size="100" src={Icons.Link} />}
            radii="300"
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Copy Link
            </Text>
          </MenuItem>
          <MenuItem
            onClick={handleRoomSettings}
            size="300"
            after={<Icon size="100" src={Icons.Setting} />}
            radii="300"
          >
            <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
              Room Settings
            </Text>
          </MenuItem>
        </Box>
        <Line variant="Surface" size="300" />
        <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
          <UseStateProvider initial={false}>
            {(promptLeave, setPromptLeave) => (
              <>
                <MenuItem
                  onClick={() => setPromptLeave(true)}
                  variant="Critical"
                  fill="None"
                  size="300"
                  after={<Icon size="100" src={Icons.ArrowGoLeft} />}
                  radii="300"
                  aria-pressed={promptLeave}
                >
                  <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                    Leave Room
                  </Text>
                </MenuItem>
                {promptLeave && (
                  <LeaveRoomPrompt
                    roomId={room.roomId}
                    onDone={requestClose}
                    onCancel={() => setPromptLeave(false)}
                  />
                )}
              </>
            )}
          </UseStateProvider>
        </Box>
      </Menu>
    );
  }
);
RoomNavItemMenu.displayName = 'RoomNavItemMenu';

type RoomNavItemProps = {
  room: Room;
  selected: boolean;
  linkPath: string;
  notificationMode?: RoomNotificationMode;
  showAvatar?: boolean;
  direct?: boolean;
  focused?: boolean;
  optionId?: string;
  tabIndex?: number;
};
export function RoomNavItem({
  room,
  selected,
  showAvatar,
  direct,
  notificationMode,
  linkPath,
  focused,
  optionId,
  tabIndex,
}: RoomNavItemProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const [hover, setHover] = useState(false);
  const { hoverProps } = useHover({ onHoverChange: setHover });
  const { focusWithinProps } = useFocusWithin({ onFocusWithinChange: setHover });
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();
  const unread = useRoomUnread(room.roomId, roomToUnreadAtom);
  const typingMember = useRoomTypingMember(room.roomId).filter(
    (receipt) => receipt.userId !== mx.getUserId()
  );

  const {
    activeCallRoomId,
    setActiveCallRoomId,
    setViewedCallRoomId,
    isChatOpen,
    speakingUsers,
    isAudioEnabled,
    isVideoEnabled,
    isDeafened,
    isScreenShareEnabled,
    remoteParticipantStates,
    toggleChat,
    hangUp,
    callStatus,
  } = useCallState();

  // isActiveCall: true as soon as this room is set as active call (including while connecting)
  const isActiveCall = activeCallRoomId === room.roomId;

  function formatCallDuration(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }
  const callMemberships = useCallMembers(mx, room.roomId);

  // hasActiveCall: true whenever ANY member is in the call — drives timer visibility for everyone
  const hasActiveCall = room.isCallRoom() && callMemberships.length > 0;

  // Server-tracked start timestamp written by the first joiner (org.bettercord.call.info).
  // Same value for ALL clients, survives page reloads, resets when last member leaves.
  const callStartTime = useCallStartTime(mx, room.roomId);

  // Tick every second to keep the displayed duration current
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!hasActiveCall || callStartTime === null) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [hasActiveCall, callStartTime]);

  // IMPORTANT: sidebar membership must come from Matrix call.member state only.
  // LiveKit participant.identity can be opaque/non-Matrix IDs and creates ghost users.
  //
  // Instant local-user removal: when WE hang up, activeCallRoomId becomes null
  // immediately (synchronous state update in CallProvider) — no need to wait for
  // the Matrix call.member event to arrive (~300ms network round-trip).
  // Remote users still go through the normal Matrix event path (+ 200ms grace).
  const myUserId = mx.getUserId();
  const displayedCallMembers = isActiveCall
    ? callMemberships
    : callMemberships.filter((id) => id !== myUserId);

  // Voice state service: bridge-backed participant state for badges and sidebar UI.
  // Only subscribe while the room actually has active call members; opening SSE
  // for every call room can exhaust browser/proxy connection limits in dev.
  const voiceStateService = useVoiceStateService(room.roomId, hasActiveCall);
  const bridgePresenceMap = voiceStateService.bridgeSnapshot;

  const hasSpeakingMember =
    room.isCallRoom() &&
    isActiveCall &&
    displayedCallMembers.some((memberId) => speakingUsers.has(memberId));
  // Bridge map is authoritative for screenshare badges, including non-active rooms.
  const bridgeHasLiveMember =
    room.isCallRoom() &&
    Array.from(bridgePresenceMap.values()).some((p) => p.isScreenSharing);
  const hasLiveMember =
    room.isCallRoom() &&
    (bridgeHasLiveMember ||
      (isActiveCall &&
        (isScreenShareEnabled ||
          Array.from(remoteParticipantStates.values()).some((state) => state.isScreenSharing))));

  const powerLevels = usePowerLevels(room);
  const creators = useRoomCreators(room);
  const roomName = useRoomName(room);
  const isEncrypted = !!useStateEvent(room, StateEvent.RoomEncryption);

  const permissions = useRoomPermissions(creators, powerLevels);
  const canJoinCall = permissions.event(EventType.GroupCallMemberPrefix, mx.getSafeUserId());

  const { navigateRoom } = useRoomNavigate();
  const navigate = useNavigate();

  const handleContextMenu: MouseEventHandler<HTMLElement> = (evt) => {
    evt.preventDefault();
    setMenuAnchor({
      x: evt.clientX,
      y: evt.clientY,
      width: 0,
      height: 0,
    });
  };

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuAnchor(evt.currentTarget.getBoundingClientRect());
  };

  // Navigate to the room; for voice rooms also join the call so the call panel opens
  const handleNavItemClick: MouseEventHandler<HTMLElement> = () => {
    if (room.isCallRoom() && activeCallRoomId !== room.roomId) {
      hangUp();
      setActiveCallRoomId(room.roomId, true);
    }
    navigate(linkPath);
  };

  // Open chat panel for voice rooms
  const handleChatButtonClick = (evt: MouseEvent<HTMLButtonElement>) => {
    evt.stopPropagation();
    if (selected) {
      toggleChat();
    } else if (!isChatOpen) {
      toggleChat();
    }
    setViewedCallRoomId(room.roomId);
    navigate(linkPath);
  };

  // Join the call for a voice room and navigate to it so the call panel opens
  const handleCallButtonClick = (evt: MouseEvent<HTMLButtonElement>) => {
    evt.stopPropagation();
    if (activeCallRoomId !== room.roomId) {
      hangUp();
      setActiveCallRoomId(room.roomId, true);
    }
    navigateRoom(room.roomId);
  };

  const optionsVisible = hover || !!menuAnchor;
  const ariaLabel = [
    roomName,
    room.isCallRoom()
      ? [
          'Call Room',
          isActiveCall && 'Currently in Call',
          displayedCallMembers.length && `${displayedCallMembers.length} in Call`,
        ]
      : direct
        ? 'Direct Message'
        : room.getJoinRule() === JoinRule.Public
          ? 'Public Room'
          : 'Group Room',
    unread?.total && `${unread.total} Messages`,
  ]
    .flat()
    .filter(Boolean)
    .join(', ');

  return (
    <Box direction="Column" grow="Yes">
      <NavItem
        variant="Background"
        radii="400"
        highlight={unread !== undefined}
        aria-selected={selected}
        role="option"
        id={optionId}
        data-hover={!!menuAnchor}
        onContextMenu={handleContextMenu}
        style={focused ? { outline: '2px solid', outlineOffset: '-2px', borderRadius: '12px' } : undefined}
        {...hoverProps}
        {...focusWithinProps}
      >
        <NavButton onClick={handleNavItemClick} aria-label={ariaLabel} tabIndex={tabIndex}>
          <NavItemContent>
            <Box as="span" grow="Yes" alignItems="Center" gap="200" style={{ minWidth: 0 }}>
              <span style={{ position: 'relative', flexShrink: 0 }}>
                <Avatar size="200" radii="400">
                  {showAvatar ? (
                    <RoomAvatar
                      roomId={room.roomId}
                      src={
                        direct
                          ? getDirectRoomAvatarUrl(mx, room, 96, useAuthentication)
                          : getRoomAvatarUrl(mx, room, 96, useAuthentication)
                      }
                      alt={roomName}
                      renderFallback={() => (
                        <Text as="span" size="H6">
                          {nameInitials(roomName)}
                        </Text>
                      )}
                    />
                  ) : (
                    <RoomIcon
                      style={{
                        opacity: unread || isActiveCall ? config.opacity.P500 : config.opacity.P300,
                      }}
                      filled={selected || isActiveCall}
                      size="100"
                      joinRule={room.getJoinRule()}
                      roomType={room.getType()}
                      locked={room.isCallRoom() && !canJoinCall}
                    />
                  )}
                </Avatar>
                {isEncrypted && (
                  <Lock
                    size={8}
                    weight="fill"
                    style={{
                      position: 'absolute',
                      bottom: -1,
                      right: -2,
                      color: 'var(--text-secondary)',
                      opacity: 0.6,
                    }}
                  />
                )}
              </span>
              <Box as="span" grow="Yes" alignItems="Center" gap="200" style={{ minWidth: 0 }}>
                <Text
                  priority={unread || isActiveCall ? '500' : '300'}
                  as="span"
                  size="Inherit"
                  truncate
                >
                  {roomName}
                </Text>
                {hasActiveCall && callStartTime !== null && (
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      marginLeft: '4px',
                      fontVariantNumeric: 'tabular-nums',
                      flexShrink: 0,
                    }}
                  >
                    {formatCallDuration(Math.max(0, Math.floor((Date.now() - callStartTime) / 1000)))}
                  </span>
                )}
              </Box>
              <Box
                as="span"
                alignItems="Center"
                gap="100"
                shrink="No"
                style={{
                  minWidth: toRem(room.isCallRoom() ? 52 : 24),
                  justifyContent: 'flex-end',
                  flexShrink: 0,
                }}
              >
                {hasLiveMember && !optionsVisible && !unread && (
                  <MonitorPlay
                    size={12}
                    weight="fill"
                    style={{
                      color: '#f23f43',
                      filter: 'drop-shadow(0 0 6px rgba(242,63,67,0.55))',
                      flexShrink: 0,
                    }}
                    aria-label="Live stream active"
                  />
                )}
                {room.isCallRoom() && displayedCallMembers.length > 0 && !optionsVisible && !unread && (
                  <SpeakerHigh
                    size={12}
                    weight="fill"
                    style={{
                      color: hasSpeakingMember
                        ? '#23a55a'
                        : isActiveCall
                          ? 'color-mix(in srgb, #23a55a 65%, #ffffff 35%)'
                          : 'rgba(255,255,255,0.4)',
                      filter: hasSpeakingMember
                        ? 'drop-shadow(0 0 6px rgba(35,165,90,0.65))'
                        : undefined,
                      flexShrink: 0,
                    }}
                    aria-label={`${displayedCallMembers.length} in voice`}
                  />
                )}
                {!optionsVisible && !unread && !selected && typingMember.length > 0 && (
                  <Badge
                    size="300"
                    variant="Secondary"
                    fill="Soft"
                    radii="Pill"
                    outlined
                    style={{ overflow: 'visible', paddingInline: '6px', flexShrink: 0 }}
                  >
                    <TypingIndicator size="300" disableAnimation />
                  </Badge>
                )}
                {!optionsVisible && unread && (
                  <UnreadBadgeCenter>
                    <UnreadBadge highlight={unread.highlight > 0} count={unread.total} />
                  </UnreadBadgeCenter>
                )}
                {!optionsVisible && !unread && notificationMode !== RoomNotificationMode.Unset && (
                  <Icon
                    size="50"
                    src={getRoomNotificationModeIcon(notificationMode)}
                    aria-label={notificationMode}
                  />
                )}
              </Box>
            </Box>
          </NavItemContent>
        </NavButton>
        {/* Always show call icon for voice rooms; show full options on hover */}
        {(room.isCallRoom() || optionsVisible) && (
          <NavItemOptions>
            {/* Persistent call icon — always visible for voice rooms */}
            {room.isCallRoom() && (
              <TooltipProvider
                position="Bottom"
                offset={4}
                tooltip={
                  <Tooltip>
                    <Text>{isActiveCall ? 'Open Call' : 'Join Call'}</Text>
                  </Tooltip>
                }
              >
                {(triggerRef) => (
                  <IconButton
                    ref={triggerRef}
                    data-testid="call-button"
                    onClick={handleCallButtonClick}
                    aria-pressed={isActiveCall}
                    aria-label={isActiveCall ? 'Open Call' : 'Join Call'}
                    variant="Background"
                    fill="None"
                    size="300"
                    radii="300"
                  >
                    <Icon size="50" src={Icons.Phone} filled={isActiveCall} />
                  </IconButton>
                )}
              </TooltipProvider>
            )}
            {/* Context menu options — hover only */}
            {optionsVisible && (
              <PopOut
                id={`menu-${room.roomId}`}
                aria-expanded={!!menuAnchor}
                anchor={menuAnchor}
                offset={menuAnchor?.width === 0 ? 0 : undefined}
                alignOffset={menuAnchor?.width === 0 ? 0 : -5}
                position="Bottom"
                align={menuAnchor?.width === 0 ? 'Start' : 'End'}
                content={
                  <FocusTrap
                    focusTrapOptions={{
                      initialFocus: false,
                      returnFocusOnDeactivate: false,
                      onDeactivate: () => setMenuAnchor(undefined),
                      clickOutsideDeactivates: true,
                      isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
                      isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
                      escapeDeactivates: stopPropagation,
                    }}
                  >
                    <RoomNavItemMenu
                      room={room}
                      requestClose={() => setMenuAnchor(undefined)}
                      notificationMode={notificationMode}
                    />
                  </FocusTrap>
                }
              >
                {room.isCallRoom() && (
                  <TooltipProvider
                    position="Bottom"
                    offset={4}
                    tooltip={
                      <Tooltip>
                        <Text>Open Chat</Text>
                      </Tooltip>
                    }
                  >
                    {(triggerRef) => (
                      <IconButton
                        ref={triggerRef}
                        data-testid="chat-button"
                        onClick={handleChatButtonClick}
                        aria-pressed={isChatOpen && selected}
                        aria-label={isChatOpen && selected ? 'Close Chat' : 'Open Chat'}
                        variant="Background"
                        fill="None"
                        size="300"
                        radii="300"
                      >
                        <Icon size="50" src={Icons.Message} />
                      </IconButton>
                    )}
                  </TooltipProvider>
                )}
                <IconButton
                  onClick={handleOpenMenu}
                  aria-pressed={!!menuAnchor}
                  aria-controls={`menu-${room.roomId}`}
                  aria-label="More Options"
                  variant="Background"
                  fill="None"
                  size="300"
                  radii="300"
                >
                  <Icon size="50" src={Icons.VerticalDots} filled={!!menuAnchor} />
                </IconButton>
              </PopOut>
            )}
          </NavItemOptions>
        )}
      </NavItem>
      {room.isCallRoom() && displayedCallMembers.length > 0 && (
        <Box direction="Column" style={{ paddingLeft: config.space.S200 }}>
          {displayedCallMembers.map((memberId) => {
            // In authoritative bridge mode, pre-resolve the presence here so
            // RoomNavUser can render it directly without its own resolution chain.
            // In default (local) mode, pass bridgePresence as before.
            const voiceStateSource: VoiceStateSource = voiceStateService.isAuthoritativeMode
              ? {
                  kind: 'authoritative',
                  resolvedPresence: voiceStateService.resolveUserPresence(memberId, {
                    isLocalUser: memberId === mx.getUserId(),
                    isActiveCall,
                    pState: isActiveCall ? remoteParticipantStates.get(memberId) : undefined,
                    isAudioEnabled,
                    isVideoEnabled,
                    isCallDeafened: isDeafened,
                    isScreenShareEnabled,
                  }),
                }
              : { kind: 'local' };

            return (
              <RoomNavUser
                key={memberId}
                room={room}
                userId={memberId}
                bridgePresence={bridgePresenceMap.get(memberId)}
                voiceStateSource={voiceStateSource}
              />
            );
          })}
        </Box>
      )}
    </Box>
  );
}
