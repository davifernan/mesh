import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useMatch } from 'react-router-dom';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { UserArea } from '../../components/user-area/UserArea';
import { CallNavStatus } from '../../features/room-nav/RoomCallNavStatus';
import { useCallStateOptional } from './call/CallProvider';
import * as css from './SidebarBottomDock.css';

const ROOT_STYLE = '--bc-bottom-dock-height';

export function SidebarBottomDock() {
  const screenSize = useScreenSizeContext();
  const callState = useCallStateOptional();
  const hasActiveCall = Boolean(callState?.activeCallRoomId);
  const hostRef = useRef<HTMLDivElement>(null);
  // On mobile: hide the dock when a room is open (MobileSlide is on top — the dock
  // would cover the message input). Show it on channel-list views (Home, Space, Direct).
  const inRoom = !!useMatch({ path: '*/:section/room/:roomId/*', end: false })
    || !!useMatch({ path: '*/:section/room/:roomId', end: true });

  useLayoutEffect(() => {
    if (screenSize === ScreenSize.Mobile) {
      document.documentElement.style.setProperty(ROOT_STYLE, '0px');
      return;
    }

    const updateHeight = () => {
      const height = hostRef.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty(ROOT_STYLE, `${height + 8}px`);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    if (hostRef.current) observer.observe(hostRef.current);
    window.addEventListener('resize', updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [screenSize, hasActiveCall]);

  useEffect(
    () => () => {
      document.documentElement.style.setProperty(ROOT_STYLE, '0px');
    },
    []
  );

  // On mobile: hide entirely when a room is open; otherwise show above the bottom nav.
  if (screenSize === ScreenSize.Mobile && inRoom) return null;

  return (
    <div ref={hostRef} className={css.host}>
      {hasActiveCall ? (
        <div className={css.card}>
          <CallNavStatus docked />
          <div className={css.divider} />
          <UserArea docked />
        </div>
      ) : (
        <div className={css.card}>
          <CallNavStatus />
          <UserArea docked />
        </div>
      )}
    </div>
  );
}
