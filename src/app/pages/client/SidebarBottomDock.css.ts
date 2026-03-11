import { style } from '@vanilla-extract/css';

export const host = style({
  position: 'absolute',
  left: '8px',
  bottom: '8px',
  width: 'calc(var(--layout-guild-list-width) + var(--layout-sidebar-width) - 16px)',
  zIndex: 140,
  pointerEvents: 'none',
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
