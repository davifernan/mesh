import { style } from '@vanilla-extract/css';

const MOBILE_MAX = '750px';

export const host = style({
  position: 'absolute',
  left: '8px',
  bottom: '8px',
  width: 'calc(var(--layout-guild-list-width) + var(--layout-sidebar-width) - 16px)',
  zIndex: 140,
  pointerEvents: 'none',
  '@media': {
    // On mobile: position fixed just above the bottom nav, full width
    [`(max-width: ${MOBILE_MAX})`]: {
      position: 'fixed',
      left: '8px',
      right: '8px',
      width: 'auto',
      bottom: 'calc(var(--mobile-bottom-nav-height, calc(3.75rem + env(safe-area-inset-bottom))) + 8px)',
    },
  },
});

export const inner = style({
  pointerEvents: 'auto',
});

export const card = style({
  pointerEvents: 'auto',
  borderRadius: '8px',
  border: '1px solid color-mix(in srgb, var(--background-modifier-accent) 78%, transparent)',
  background: 'var(--background-secondary)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  overflow: 'hidden',
});

export const divider = style({
  height: '1px',
  background: 'color-mix(in srgb, var(--background-modifier-accent) 72%, transparent)',
  margin: '0 10px',
});
