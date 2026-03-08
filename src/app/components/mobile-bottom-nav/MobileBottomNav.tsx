import React from 'react';
import { NavLink } from 'react-router-dom';
import { House, ChatCircle, Bell, MagnifyingGlass, List, User, X } from '@phosphor-icons/react';
import { useSetAtom } from 'jotai';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { HOME_PATH, DIRECT_PATH, INBOX_PATH, EXPLORE_PATH } from '../../pages/paths';
import { openUserSettingsAtom } from '../../state/keyboardShortcutsHelp';
import { useMobileDrawer } from '../mobile-drawer';
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

type ButtonTabProps = {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  ariaControls?: string;
  ariaExpanded?: boolean;
};
function ButtonTab({
  icon,
  label,
  onClick,
  active,
  ariaControls,
  ariaExpanded,
}: ButtonTabProps) {
  return (
    <button
      type="button"
      className={`${css.Tab} ${css.ButtonTab} ${active ? css.TabActive : ''}`}
      aria-label={label}
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
      onClick={onClick}
    >
      {icon}
      <span className={css.TabLabel}>{label}</span>
    </button>
  );
}

export function MobileBottomNav() {
  const screenSize = useScreenSizeContext();
  const setOpenUserSettings = useSetAtom(openUserSettingsAtom);
  const { isOpen, toggle, close } = useMobileDrawer();

  if (screenSize !== ScreenSize.Mobile) return null;

  return (
    <nav className={css.BottomNav} aria-label="Mobile navigation">
      <ButtonTab
        icon={isOpen ? <X size={22} weight="bold" /> : <List size={22} weight="bold" />}
        label={isOpen ? 'Close' : 'Menu'}
        onClick={toggle}
        active={isOpen}
        ariaControls="mobile-sidebar-drawer"
        ariaExpanded={isOpen}
      />
      <NavTab to={HOME_PATH} icon={<House size={22} weight="fill" />} label="Home" onClick={close} />
      <NavTab to={DIRECT_PATH} icon={<ChatCircle size={22} weight="fill" />} label="DMs" onClick={close} />
      <NavTab to={INBOX_PATH} icon={<Bell size={22} weight="fill" />} label="Inbox" onClick={close} />
      <NavTab
        to={EXPLORE_PATH}
        icon={<MagnifyingGlass size={22} weight="bold" />}
        label="Explore"
        onClick={close}
      />
      <ButtonTab
        icon={<User size={22} weight="regular" />}
        label="Profile"
        onClick={() => {
          close();
          setOpenUserSettings(true);
        }}
      />
    </nav>
  );
}
