import React from 'react';
import { NavLink } from 'react-router-dom';
import { House, ChatCircle, Bell, MagnifyingGlass, User, List } from '@phosphor-icons/react';
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
};
function NavTab({ to, icon, label }: NavTabProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `${css.Tab} ${isActive ? css.TabActive : ''}`}
      aria-label={label}
      end
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
};
function ButtonTab({ icon, label, onClick, active }: ButtonTabProps) {
  return (
    <button
      type="button"
      className={`${css.Tab} ${css.ButtonTab} ${active ? css.TabActive : ''}`}
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
  const setOpenUserSettings = useSetAtom(openUserSettingsAtom);
  const { isOpen: isDrawerOpen, toggle: toggleDrawer } = useMobileDrawer();

  if (screenSize !== ScreenSize.Mobile) return null;

  return (
    <nav className={css.BottomNav} aria-label="Mobile navigation">
      <NavTab to={HOME_PATH} icon={<House size={22} weight="fill" />} label="Home" />
      <NavTab to={DIRECT_PATH} icon={<ChatCircle size={22} weight="fill" />} label="DMs" />
      <NavTab to={INBOX_PATH} icon={<Bell size={22} weight="fill" />} label="Inbox" />
      <NavTab to={EXPLORE_PATH} icon={<MagnifyingGlass size={22} weight="bold" />} label="Explore" />
      <ButtonTab
        icon={<User size={22} weight={isDrawerOpen ? 'fill' : 'regular'} />}
        label="Profile"
        onClick={() => setOpenUserSettings(true)}
      />
      <ButtonTab
        icon={<List size={22} weight="bold" />}
        label="Spaces"
        onClick={toggleDrawer}
        active={isDrawerOpen}
      />
    </nav>
  );
}
