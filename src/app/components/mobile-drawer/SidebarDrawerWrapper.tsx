import React from 'react';

type SidebarDrawerWrapperProps = {
  children: React.ReactNode;
};

/**
 * Previously wrapped the sidebar in a mobile slide-in drawer.
 * Now the sidebar is always rendered inline as a narrow icon strip on both
 * desktop and mobile (Discord-style persistent left column).
 * This component is kept as a thin pass-through so Router.tsx doesn't need changes.
 */
export function SidebarDrawerWrapper({ children }: SidebarDrawerWrapperProps) {
  return <>{children}</>;
}
