import { useAtomValue } from 'jotai';
import React, { ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PWABadge, ElectronDeepLink, PTTElectronShortcut } from './ClientNonUIFeaturesPTT';
import { MatrixEvent, Room, RoomEvent, RoomEventHandlerMap } from 'matrix-js-sdk';
import { roomToUnreadAtom, unreadEqual, unreadInfoToUnread } from '../../state/room/roomToUnread';
import LogoSVG from '../../../../public/res/svg/cinny.svg';
import LogoUnreadSVG from '../../../../public/res/svg/cinny-unread.svg';
import LogoHighlightSVG from '../../../../public/res/svg/cinny-highlight.svg';
import NotificationSound from '../../../../public/sound/notification.ogg';
import InviteSound from '../../../../public/sound/invite.ogg';
import { notificationPermission, setFavicon } from '../../utils/dom';
import { useSetting } from '../../state/hooks/settings';
import { EmojiFont, getSettings, settingsAtom } from '../../state/settings';
import { allInvitesAtom } from '../../state/room-list/inviteList';
import { usePreviousValue } from '../../hooks/usePreviousValue';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import {
  getDirectRoomPath,
  getHomeRoomPath,
  getInboxInvitesPath,
  getInboxNotificationsPath,
  getInboxUnreadPath,
  getSpacePath,
  getSpaceRoomPath,
} from '../pathUtils';
import {
  getMemberDisplayName,
  getNotificationType,
  getUnreadInfo,
  isNotificationEvent,
} from '../../utils/room';
import { NotificationType, UnreadInfo } from '../../../types/matrix/room';
import { getCanonicalAliasOrRoomId, getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { mDirectAtom } from '../../state/mDirectList';
import { roomToParentsAtom } from '../../state/room/roomToParents';
import { useSelectedRoom } from '../../hooks/router/useSelectedRoom';
import { useInboxNotificationsSelected } from '../../hooks/router/useInbox';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { announce } from '../../utils/announce';
import {
  playCurrentRoomSound,
  playTypingSound,
  playReactionSound,
} from '../../utils/sounds';

function SystemEmojiFeature() {
  const [emojiFont] = useSetting(settingsAtom, 'emojiFont');

  switch (emojiFont) {
    case EmojiFont.Twemoji:
      document.documentElement.style.setProperty('--font-emoji', 'Twemoji');
      break;
    case EmojiFont.NotoColorEmojiBahai:
      document.documentElement.style.setProperty('--font-emoji', 'NotoColorEmojiBahai');
      break;
    case EmojiFont.System:
    default:
      document.documentElement.style.setProperty('--font-emoji', 'Twemoji_DISABLED');
      break;
  }

  return null;
}

function PageZoomFeature() {
  const [pageZoom] = useSetting(settingsAtom, 'pageZoom');

  if (pageZoom === 100) {
    document.documentElement.style.removeProperty('font-size');
  } else {
    document.documentElement.style.setProperty('font-size', `calc(1em * ${pageZoom / 100})`);
  }

  return null;
}

function FaviconUpdater() {
  const roomToUnread = useAtomValue(roomToUnreadAtom);

  useEffect(() => {
    let notification = false;
    let highlight = false;
    roomToUnread.forEach((unread) => {
      if (unread.total > 0) {
        notification = true;
      }
      if (unread.highlight > 0) {
        highlight = true;
      }
    });

    if (notification) {
      setFavicon(highlight ? LogoHighlightSVG : LogoUnreadSVG);
    } else {
      setFavicon(LogoSVG);
    }
  }, [roomToUnread]);

  return null;
}

function InviteNotifications() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const invites = useAtomValue(allInvitesAtom);
  const perviousInviteLen = usePreviousValue(invites.length, 0);
  const mx = useMatrixClient();

  const navigate = useNavigate();
  const [showNotifications] = useSetting(settingsAtom, 'showNotifications');
  const [notificationSound] = useSetting(settingsAtom, 'isNotificationSounds');

  const notify = useCallback(
    (count: number) => {
      const noti = new window.Notification('Invitation', {
        icon: LogoSVG,
        badge: LogoSVG,
        body: `You have ${count} new invitation request.`,
        silent: true,
      });

      noti.onclick = () => {
        if (!window.closed) navigate(getInboxInvitesPath());
        noti.close();
      };
    },
    [navigate]
  );

  const playSound = useCallback(() => {
    const audioElement = audioRef.current;
    audioElement?.play();
  }, []);

  useEffect(() => {
    if (invites.length > perviousInviteLen && mx.getSyncState() === 'SYNCING') {
      if (showNotifications && notificationPermission('granted')) {
        notify(invites.length - perviousInviteLen);
      }

      if (notificationSound) {
        playSound();
      }
    }
  }, [mx, invites, perviousInviteLen, showNotifications, notificationSound, notify, playSound]);

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <audio ref={audioRef} style={{ display: 'none' }}>
      <source src={InviteSound} type="audio/ogg" />
    </audio>
  );
}

function MessageNotifications() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const notifRef = useRef<Notification>();
  const unreadCacheRef = useRef<Map<string, UnreadInfo>>(new Map());
  const prevTypingCountRef = useRef(0);
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const [showNotifications] = useSetting(settingsAtom, 'showNotifications');
  const [notificationSound] = useSetting(settingsAtom, 'isNotificationSounds');
  const [inRoomActivitySound] = useSetting(settingsAtom, 'inRoomActivitySound');

  const navigate = useNavigate();
  const notificationSelected = useInboxNotificationsSelected();
  const selectedRoomId = useSelectedRoom();
  const mDirects = useAtomValue(mDirectAtom);
  const roomToParents = useAtomValue(roomToParentsAtom);

  const notify = useCallback(
    ({
      roomName,
      roomAvatar,
      username,
      body,
      navigateTo,
    }: {
      roomName: string;
      roomAvatar?: string;
      username: string;
      body: string;
      navigateTo: string;
    }) => {
      const trimmed = body.length > 120 ? `${body.slice(0, 120)}\u2026` : body;
      const noti = new window.Notification(roomName, {
        icon: roomAvatar,
        badge: roomAvatar,
        body: `${username}: ${trimmed}`,
        silent: true,
      });

      noti.onclick = () => {
        if (!window.closed) navigate(navigateTo);
        noti.close();
        notifRef.current = undefined;
      };

      notifRef.current?.close();
      notifRef.current = noti;
    },
    [navigate]
  );

  const playSound = useCallback(() => {
    const audioElement = audioRef.current;
    audioElement?.play();
  }, []);

  useEffect(() => {
    const handleTimelineEvent: RoomEventHandlerMap[RoomEvent.Timeline] = (
      mEvent,
      room,
      toStartOfTimeline,
      removed,
      data
    ) => {
      if (mx.getSyncState() !== 'SYNCING') return;
      if (
        !room ||
        !data.liveEvent ||
        room.isSpaceRoom() ||
        !isNotificationEvent(mEvent) ||
        getNotificationType(mx, room.roomId) === NotificationType.Mute
      ) {
        return;
      }

      const sender = mEvent.getSender();
      const eventId = mEvent.getId();
      if (!sender || !eventId || sender === mx.getUserId()) return;
      const unreadInfo = getUnreadInfo(room);
      const cachedUnreadInfo = unreadCacheRef.current.get(room.roomId);
      unreadCacheRef.current.set(room.roomId, unreadInfo);

      if (unreadInfo.total === 0) return;
      if (
        cachedUnreadInfo &&
        unreadEqual(unreadInfoToUnread(cachedUnreadInfo), unreadInfoToUnread(unreadInfo))
      ) {
        return;
      }

      const isCurrentRoom = room.roomId === selectedRoomId;
      const isFocused = document.hasFocus();

      // Desktop notification -- skip when page is focused on current room or inbox
      if (!(isFocused && (isCurrentRoom || notificationSelected))) {
        if (showNotifications && notificationPermission('granted')) {
          const avatarMxc =
            room.getAvatarFallbackMember()?.getMxcAvatarUrl() ?? room.getMxcAvatarUrl();
          const msgBody = (mEvent.getContent()?.body as string | undefined) ?? room.name ?? 'New message';
          const rIdOrAlias = getCanonicalAliasOrRoomId(mx, room.roomId);
          let roomPath: string;
          if (mDirects.has(room.roomId)) {
            roomPath = getDirectRoomPath(rIdOrAlias);
          } else {
            const parents = roomToParents.get(room.roomId);
            roomPath = parents && parents.size > 0
              ? getSpaceRoomPath(getCanonicalAliasOrRoomId(mx, Array.from(parents)[0]), rIdOrAlias)
              : getHomeRoomPath(rIdOrAlias);
          }
          notify({
            roomName: room.name,
            roomAvatar: avatarMxc
              ? mxcUrlToHttp(mx, avatarMxc, useAuthentication, 96, 96, 'crop') ?? undefined
              : undefined,
            username: getMemberDisplayName(room, sender) ?? getMxIdLocalPart(sender) ?? sender,
            body: msgBody,
            navigateTo: roomPath,
          });
        }
      }

      // Differentiated sounds: OGG for mentions/other-room, generated soft beep for current room
      const isHighlight = unreadInfo.highlight > (cachedUnreadInfo?.highlight ?? 0);
      if (isHighlight && notificationSound) {
        playSound();
        announce(`Mention in ${room.name}`);
      } else if (isCurrentRoom && isFocused && inRoomActivitySound) {
        playCurrentRoomSound();
      } else if (!isCurrentRoom && notificationSound) {
        playSound();
      }
    };
    mx.on(RoomEvent.Timeline, handleTimelineEvent);

    // Reaction to my own message
    const handleReactionEvent: RoomEventHandlerMap[RoomEvent.Timeline] = (
      mEvent,
      room,
      _toStart,
      _removed,
      data
    ) => {
      if (!data.liveEvent || mEvent.getType() !== 'm.reaction') return;
      const rel = mEvent.getContent()['m.relates_to'] as
        | { rel_type?: string; event_id?: string; key?: string }
        | undefined;
      if (rel?.rel_type !== 'm.annotation' || !rel.event_id) return;
      const targetEvt = room?.findEventById(rel.event_id);
      if (targetEvt?.getSender() !== mx.getUserId()) return;
      if (notificationSound) playReactionSound();
      const reactor = mEvent.getSender() ?? 'Someone';
      const reactorName = room
        ? (getMemberDisplayName(room, reactor) ?? getMxIdLocalPart(reactor) ?? reactor)
        : reactor;
      announce(`${reactorName} reacted ${rel.key ?? ''} to your message`);
    };
    mx.on(RoomEvent.Timeline, handleReactionEvent);

    // Typing sound for current room
    const handleTyping = (event: MatrixEvent, room: Room) => {
      if (room.roomId !== selectedRoomId) return;
      const typingUserIds =
        (event.getContent() as { user_ids?: string[] }).user_ids ?? [];
      const othersTyping = typingUserIds.filter((uid) => uid !== mx.getUserId());
      if (othersTyping.length > 0 && prevTypingCountRef.current === 0) {
        if (inRoomActivitySound) playTypingSound();
        announce('Someone is typing');
      }
      prevTypingCountRef.current = othersTyping.length;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mx.on(RoomEvent.Typing as any, handleTyping);

    return () => {
      mx.removeListener(RoomEvent.Timeline, handleTimelineEvent);
      mx.removeListener(RoomEvent.Timeline, handleReactionEvent);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mx.removeListener(RoomEvent.Typing as any, handleTyping);
    };
  }, [
    mx,
    notificationSound,
    inRoomActivitySound,
    notificationSelected,
    showNotifications,
    playSound,
    notify,
    selectedRoomId,
    useAuthentication,
    mDirects,
    roomToParents,
  ]);

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <audio ref={audioRef} style={{ display: 'none' }}>
      <source src={NotificationSound} type="audio/ogg" />
    </audio>
  );
}

function InboxUnreadNotifications() {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const roomToUnread = useAtomValue(roomToUnreadAtom);
  const mDirects = useAtomValue(mDirectAtom);
  const roomToParents = useAtomValue(roomToParentsAtom);
  const [inboxUnreadNotifications] = useSetting(settingsAtom, 'inboxUnreadNotifications');
  const [notifBatchDelay] = useSetting(settingsAtom, 'inboxNotifBatchDelay');
  const [showNotifications] = useSetting(settingsAtom, 'showNotifications');

  const notifRef = useRef<Notification>();
  const pendingRoomsRef = useRef<Set<string>>(new Set());
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable ref to latest values — safe to read from inside setTimeout callbacks
  const latestRef = useRef({ mx, navigate, mDirects, roomToParents, inboxUnreadNotifications, notifBatchDelay, showNotifications });
  latestRef.current = { mx, navigate, mDirects, roomToParents, inboxUnreadNotifications, notifBatchDelay, showNotifications };

  // fireNow: flush pending rooms → single notification, then start cooldown
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fireNow = useCallback(() => {
    const rooms = Array.from(pendingRoomsRef.current);
    pendingRoomsRef.current.clear();
    if (rooms.length === 0) return;
    if (!getSettings().inboxUnreadNotifications) return;
    if (!getSettings().showNotifications) return;

    const { mx: m, navigate: nav, mDirects: dms, roomToParents: rtp } = latestRef.current;
    const count = rooms.length;
    const title =
      count === 1
        ? (m.getRoom(rooms[0])?.name ?? 'New unread message')
        : `${count} new unread rooms`;

    // For single-room: show sender + message body; encrypted rooms show generic text
    let body = count === 1 ? 'New unread message' : `${count} rooms have new messages.`;
    if (count === 1) {
      const room = m.getRoom(rooms[0]);
      const events = room?.getLiveTimeline()?.getEvents() ?? [];
      const lastMsg = [...events].reverse().find((ev) => ev.getType() === 'm.room.message');
      if (lastMsg) {
        const msgBody = lastMsg.getContent()?.body as string | undefined;
        const sender = lastMsg.getSender();
        const senderName = sender
          ? (room ? (getMemberDisplayName(room, sender) ?? getMxIdLocalPart(sender)) : getMxIdLocalPart(sender)) ?? sender
          : undefined;
        if (msgBody) {
          const trimmed = msgBody.length > 120 ? `${msgBody.slice(0, 120)}\u2026` : msgBody;
          body = senderName ? `${senderName}: ${trimmed}` : trimmed;
        }
      }
    }

    const noti = new window.Notification(title, {
      icon: LogoSVG,
      badge: LogoSVG,
      body,
      silent: true,
    });

    const capturedRooms = rooms;
    noti.onclick = () => {
      if (!window.closed) {
        if (capturedRooms.length === 1) {
          const roomId = capturedRooms[0];
          const { mx: m2, navigate: nav2, mDirects: dms2, roomToParents: rtp2 } =
            latestRef.current;
          const room = m2.getRoom(roomId);
          if (!room) {
            nav2(getInboxUnreadPath());
          } else {
            const rIdOrAlias = getCanonicalAliasOrRoomId(m2, roomId);
            if (room.isSpaceRoom()) {
              nav2(getSpacePath(rIdOrAlias));
            } else if (dms2.has(roomId)) {
              nav2(getDirectRoomPath(rIdOrAlias));
            } else {
              const parents = rtp2.get(roomId);
              if (parents && parents.size > 0) {
                nav2(
                  getSpaceRoomPath(
                    getCanonicalAliasOrRoomId(m2, Array.from(parents)[0]),
                    rIdOrAlias
                  )
                );
              } else {
                nav2(getHomeRoomPath(rIdOrAlias));
              }
            }
          }
        } else {
          latestRef.current.navigate(getInboxUnreadPath());
        }
      }
      noti.close();
      notifRef.current = undefined;
    };

    notifRef.current?.close();
    notifRef.current = noti;

    // Start cooldown; when it ends, fire again if more rooms accumulated
    const cooldownMs = Math.max((latestRef.current.notifBatchDelay ?? 60) * 1000, 1000);
    cooldownRef.current = setTimeout(() => {
      cooldownRef.current = null;
      if (pendingRoomsRef.current.size > 0) fireNow();
    }, cooldownMs);
  }, []); // stable — reads only from refs

  // Build list of rooms currently with direct unreads
  const unreadRoomIds = useMemo(() => {
    const ids: string[] = [];
    roomToUnread.forEach((u, roomId) => {
      if (u.total > 0 && u.from === null) ids.push(roomId);
    });
    return ids;
  }, [roomToUnread]);

  const prevUnreadRoomIds = usePreviousValue(unreadRoomIds, []);

  // Close notification + cancel cooldown when setting is turned off
  useEffect(() => {
    if (!inboxUnreadNotifications || !showNotifications) {
      notifRef.current?.close();
      notifRef.current = undefined;
      if (cooldownRef.current !== null) {
        clearTimeout(cooldownRef.current);
        cooldownRef.current = null;
      }
      pendingRoomsRef.current.clear();
    }
  }, [inboxUnreadNotifications, showNotifications]);

  useEffect(() => {
    if (!inboxUnreadNotifications) return;
    if (!showNotifications) return;
    if (mx.getSyncState() !== 'SYNCING') return;
    if (!notificationPermission('granted')) return;
    if (document.hasFocus()) return;

    // Find rooms newly unread since last render
    const prevSet = new Set(prevUnreadRoomIds);
    const newRoomIds = unreadRoomIds.filter((id) => !prevSet.has(id));
    if (newRoomIds.length === 0) return;

    newRoomIds.forEach((id) => pendingRoomsRef.current.add(id));

    if (cooldownRef.current === null) {
      // Not in cooldown: schedule initial notification.
      // Use a short debounce to batch simultaneous messages, capped at configured delay.
      const batchMs = (notifBatchDelay ?? 60) * 1000;
      const debounceMs = batchMs === 0 ? 1_000 : Math.min(batchMs, 3_000);
      cooldownRef.current = setTimeout(() => {
        cooldownRef.current = null;
        fireNow();
      }, debounceMs);
    }
    // If in cooldown: rooms accumulate in pendingRoomsRef, fired when cooldown ends
  }, [mx, unreadRoomIds, prevUnreadRoomIds, inboxUnreadNotifications, showNotifications, notifBatchDelay, fireNow]);

  return null;
}

/**
 * Syncs Electron zoom commands (View → Zoom In/Out/Reset from the main-process
 * menu) with the web-app pageZoom setting.
 * Step: ±10%, clamped between 50 and 200.
 */
function ElectronZoom() {
  const [pageZoom, setPageZoom] = useSetting(settingsAtom, 'pageZoom');

  useEffect(() => {
    const electron = window.electron;
    if (!electron) return;

    const STEP = 10;
    const MIN = 50;
    const MAX = 200;

    const unZoomIn = electron.onZoomIn(() => {
      setPageZoom((prev) => {
        const next = Math.min(prev + STEP, MAX);
        electron.setZoomFactor(next / 100);
        return next;
      });
    });

    const unZoomOut = electron.onZoomOut(() => {
      setPageZoom((prev) => {
        const next = Math.max(prev - STEP, MIN);
        electron.setZoomFactor(next / 100);
        return next;
      });
    });

    const unZoomReset = electron.onZoomReset(() => {
      setPageZoom(100);
      electron.setZoomFactor(1);
    });

    return () => {
      unZoomIn();
      unZoomOut();
      unZoomReset();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Also keep the Electron zoom factor in sync when pageZoom changes externally
  // (e.g. user edits it in Settings → General).
  useEffect(() => {
    window.electron?.setZoomFactor(pageZoom / 100);
  }, [pageZoom]);

  return null;
}


/**
 * Keeps the Electron dock/taskbar badge count in sync with total unread count.
 * No-op when running in the browser (window.electron is undefined).
 */
function ElectronBadgeCount() {
  const roomToUnread = useAtomValue(roomToUnreadAtom);

  useEffect(() => {
    const electron = window.electron;
    if (!electron?.setBadgeCount) return;

    let total = 0;
    roomToUnread.forEach((unread) => {
      total += unread.highlight > 0 ? unread.highlight : unread.total;
    });

    electron.setBadgeCount(total);
  }, [roomToUnread]);

  return null;
}

type ClientNonUIFeaturesProps = {
  children: ReactNode;
};

export function ClientNonUIFeatures({ children }: ClientNonUIFeaturesProps) {
  return (
    <>
      <SystemEmojiFeature />
      <PageZoomFeature />
      <FaviconUpdater />
      <ElectronBadgeCount />
      {!window.electron && <PWABadge />}
      <ElectronZoom />
      <ElectronDeepLink />
      <PTTElectronShortcut />
      <InviteNotifications />
      <MessageNotifications />
      <InboxUnreadNotifications />
      {children}
    </>
  );
}
