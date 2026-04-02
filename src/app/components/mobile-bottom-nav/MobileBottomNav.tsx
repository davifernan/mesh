import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { ChatCircle, Bell, House, UserCircle } from '@phosphor-icons/react';
import { useSetAtom } from 'jotai';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { HOME_PATH, INBOX_PATH } from '../../pages/paths';
import { useCallStateOptional } from '../../pages/client/call/CallProvider';
import { openUserSettingsAtom } from '../../state/keyboardShortcutsHelp';
import * as css from './MobileBottomNav.css';

type NavTabProps = {
  to: string;
  icon: React.ReactNode;
  label: string;
};
function NavTab({ to, icon, label }: NavTabProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `${css.Tab} ${isActive ? css.TabActive : ''}`}
      aria-label={label}
    >
      {icon}
      <span className={css.TabLabel}>{label}</span>
    </NavLink>
  );
}

type ButtonTabProps = {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
};
function ButtonTab({ icon, label, onClick }: ButtonTabProps) {
  return (
    <button
      type="button"
      className={`${css.Tab} ${css.ButtonTab}`}
      aria-label={label}
      onClick={onClick}
    >
      {icon}
      <span className={css.TabLabel}>{label}</span>
    </button>
  );
}

export function MobileBottomNav() {
  const screenSize = useScreenSizeContext();
  const callState = useCallStateOptional();
  const openSettings = useSetAtom(openUserSettingsAtom);

  const hideForActiveCall =
    screenSize === ScreenSize.Mobile &&
    !!callState?.activeCallRoomId &&
    !!callState?.isCallViewOpen;

  useEffect(() => {
    const nextHeight = hideForActiveCall ? '0px' : 'calc(3.75rem + env(safe-area-inset-bottom))';
    document.documentElement.style.setProperty('--mobile-bottom-nav-height', nextHeight);

    return () => {
      document.documentElement.style.setProperty(
        '--mobile-bottom-nav-height',
        'calc(3.75rem + env(safe-area-inset-bottom))'
      );
    };
  }, [hideForActiveCall]);

  if (screenSize !== ScreenSize.Mobile || hideForActiveCall) return null;

  return (
    <nav className={css.BottomNav} aria-label="Mobile navigation">
      {/* Home — DMs + unread rooms */}
      <NavTab to={HOME_PATH} icon={<House size={22} weight="fill" />} label="Home" />
      {/* Inbox — notifications */}
      <NavTab to={INBOX_PATH} icon={<Bell size={22} weight="fill" />} label="Inbox" />
      {/* You — opens Settings modal */}
      <ButtonTab
        icon={<UserCircle size={22} weight="fill" />}
        label="You"
        onClick={() => openSettings(true)}
      />
    </nav>
  );
}
