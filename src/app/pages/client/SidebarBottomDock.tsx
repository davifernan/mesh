import React, { useEffect, useLayoutEffect, useRef } from 'react';
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

  if (screenSize === ScreenSize.Mobile) return null;

  return (
    <div ref={hostRef} className={css.host}>
      {hasActiveCall ? (
        <div className={css.card}>
          <CallNavStatus docked />
          <div className={css.divider} />
          <UserArea docked />
        </div>
      ) : (
        <div className={css.inner}>
          <CallNavStatus />
          <UserArea />
        </div>
      )}
    </div>
  );
}
