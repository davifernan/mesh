import React from 'react';
import { NavLink } from 'react-router-dom';
import { House, ChatCircle, Bell, MagnifyingGlass, Gear } from '@phosphor-icons/react';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { HOME_PATH, DIRECT_PATH, INBOX_PATH, EXPLORE_PATH } from '../../pages/paths';
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

export function MobileBottomNav() {
  const screenSize = useScreenSizeContext();
  if (screenSize !== ScreenSize.Mobile) return null;

  return (
    <nav className={css.BottomNav} aria-label="Mobile navigation">
      <NavTab to={HOME_PATH} icon={<House size={22} weight="fill" />} label="Home" />
      <NavTab to={DIRECT_PATH} icon={<ChatCircle size={22} weight="fill" />} label="DMs" />
      <NavTab to={INBOX_PATH} icon={<Bell size={22} weight="fill" />} label="Inbox" />
      <NavTab to={EXPLORE_PATH} icon={<MagnifyingGlass size={22} weight="bold" />} label="Explore" />
    </nav>
  );
}
