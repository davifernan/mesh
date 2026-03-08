import React from 'react';
import { useMobileDrawer } from './MobileDrawerContext';
import * as css from './MobileDrawer.css';

type SidebarDrawerWrapperProps = {
  children: React.ReactNode;
};

/**
 * Wraps the sidebar icon strip in a mobile slide-in drawer.
 * On desktop (> 750px): the wrapper div has no effect — sidebar renders normally.
 * On mobile (≤ 750px): sidebar is fixed-positioned, off-screen by default,
 * slides in when isOpen is true.
 *
 * Also renders the semi-transparent overlay that closes the drawer on click.
 */
export function SidebarDrawerWrapper({ children }: SidebarDrawerWrapperProps) {
  const { isOpen, close } = useMobileDrawer();

  return (
    <>
      {/* Overlay — only visible on mobile when drawer is open */}
      <div
        className={css.mobileOverlay}
        data-open={String(isOpen)}
        onClick={close}
        aria-hidden="true"
      />
      {/* Drawer wrapper */}
      <div className={css.mobileDrawer} data-open={String(isOpen)}>
        {children}
      </div>
    </>
  );
}
