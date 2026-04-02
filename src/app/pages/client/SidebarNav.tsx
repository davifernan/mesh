import React, { useEffect, useRef } from 'react';
import { useMatch } from 'react-router-dom';

import {
  Sidebar,
  SidebarContent,
  SidebarStackSeparator,
  SidebarStack,
} from '../../components/sidebar';
import {
  DirectTab,
  HomeTab,
  SpaceTabs,
  InboxTab,
  ExploreTab,
  SettingsTab,
  UnverifiedTab,
  SearchTab,
} from './sidebar';
import { CreateTab } from './sidebar/CreateTab';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { HOME_PATH } from '../paths';

export function SidebarNav() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const screenSize = useScreenSizeContext();
  const isMobile = screenSize === ScreenSize.Mobile;
  // On mobile: icon strip only visible when on the Home route (incl. sub-routes like rooms)
  const isOnHome = !!useMatch({ path: HOME_PATH, end: false });

  // Initialise roving tabIndex: all sidebar buttons get tabindex=-1 except the first.
  // This makes the sidebar a single tab stop; arrow keys move within it.
  useEffect(() => {
    const id = setTimeout(() => {
      const sidebar = document.querySelector(
        '[role="navigation"][aria-label="Main navigation"]'
      );
      if (!sidebar) return;
      const allBtns = Array.from(
        sidebar.querySelectorAll('button:not([disabled])')
      ) as HTMLElement[];
      allBtns.forEach((b, i) => b.setAttribute('tabindex', i === 0 ? '0' : '-1'));
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const handleKeyDown = (evt: React.KeyboardEvent<HTMLDivElement>) => {
    if (evt.key !== 'ArrowDown' && evt.key !== 'ArrowUp') return;
    const sidebar = evt.currentTarget;
    const buttons = Array.from(sidebar.querySelectorAll('button:not([disabled])')) as HTMLElement[];
    const current = document.activeElement as HTMLElement;
    const currentIndex = buttons.indexOf(current);
    if (currentIndex < 0) return;
    evt.preventDefault();
    let target: HTMLElement | undefined;
    if (evt.key === 'ArrowDown') {
      target = buttons[currentIndex + 1] ?? buttons[0];
    } else {
      target = buttons[currentIndex - 1] ?? buttons[buttons.length - 1];
    }
    if (target) {
      buttons.forEach((b) => b.setAttribute('tabindex', '-1'));
      target.setAttribute('tabindex', '0');
      target.focus();
    }
  };

  // On mobile outside of Home: render only the invisible modal controllers.
  // Space/Room/Direct pages get the full screen width — no icon strip.
  if (isMobile && !isOnHome) {
    return (
      <>
        <SettingsTab />
        <UnverifiedTab />
      </>
    );
  }

  return (
    <Sidebar role="navigation" aria-label="Main navigation" onKeyDown={handleKeyDown}>
      <SidebarContent
        scrollable={
          <div
            ref={scrollRef}
            style={{
              width: '100%',
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {/* On mobile: only SpaceTabs in the strip (Home/Inbox/Settings → bottom nav). */}
              {!isMobile && (
                <SidebarStack>
                  <HomeTab />
                  <DirectTab />
                </SidebarStack>
              )}
              <SpaceTabs scrollRef={scrollRef} />
              {!isMobile && (
                <>
                  <SidebarStackSeparator />
                  <SidebarStack>
                    <ExploreTab />
                    <CreateTab />
                  </SidebarStack>
                </>
              )}
            </div>
          </div>
        }
        sticky={
          isMobile ? (
            <>
              <SettingsTab />
              <UnverifiedTab />
            </>
          ) : (
            <>
              <SidebarStackSeparator />
              <SidebarStack>
                <SearchTab />
                <UnverifiedTab />
                <InboxTab />
                <SettingsTab />
              </SidebarStack>
            </>
          )
        }
      />
    </Sidebar>
  );
}
