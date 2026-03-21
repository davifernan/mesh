import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { House, ChatCircle, Bell, SquaresFour } from '@phosphor-icons/react';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { HOME_PATH, DIRECT_PATH, INBOX_PATH } from '../../pages/paths';
import { useMobileDrawer } from '../mobile-drawer';
import { useCallStateOptional } from '../../pages/client/call/CallProvider';
import * as css from './MobileBottomNav.css';

type NavTabProps = {
  to: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
};
function NavTab({ to, icon, label, onClick }: NavTabProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `${css.Tab} ${isActive ? css.TabActive : ''}`}
      aria-label={label}
      onClick={onClick}
    >
      {icon}
      <span className={css.TabLabel}>{label}</span>
    </NavLink>
  );
}


export function MobileBottomNav() {
  const screenSize = useScreenSizeContext();
  const { close } = useMobileDrawer();
  const callState = useCallStateOptional();
  const hideForActiveCall =
    screenSize === ScreenSize.Mobile &&
    !!callState?.activeCallRoomId &&
    !!callState?.isCallViewOpen;

  useEffect(() => {
    const nextHeight = hideForActiveCall ? '0px' : '60px';
    document.documentElement.style.setProperty('--mobile-bottom-nav-height', nextHeight);

    return () => {
      document.documentElement.style.setProperty('--mobile-bottom-nav-height', '60px');
    };
  }, [hideForActiveCall]);

  if (screenSize !== ScreenSize.Mobile || hideForActiveCall) return null;

  return (
    <nav className={css.BottomNav} aria-label="Mobile navigation">
      <NavTab to={HOME_PATH} icon={<SquaresFour size={22} weight="fill" />} label="Spaces" onClick={close} />
      <NavTab to={HOME_PATH} icon={<House size={22} weight="fill" />} label="Home" onClick={close} />
      <NavTab to={DIRECT_PATH} icon={<ChatCircle size={22} weight="fill" />} label="DMs" onClick={close} />
      <NavTab to={INBOX_PATH} icon={<Bell size={22} weight="fill" />} label="Inbox" onClick={close} />
    </nav>
  );
}
