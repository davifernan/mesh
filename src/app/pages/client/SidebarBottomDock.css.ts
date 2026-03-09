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
  borderRadius: '12px',
  border: '1px solid color-mix(in srgb, var(--background-modifier-accent) 82%, transparent)',
  borderLeftColor: 'color-mix(in srgb, var(--background-modifier-accent) 58%, transparent)',
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--background-secondary) 92%, transparent), color-mix(in srgb, var(--background-primary) 88%, transparent))',
  boxShadow:
    '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 0 0 1px color-mix(in srgb, var(--background-modifier-accent) 30%, transparent)',
  backdropFilter: 'blur(8px)',
  overflow: 'hidden',
});

export const divider = style({
  height: '1px',
  background: 'color-mix(in srgb, var(--background-modifier-accent) 72%, transparent)',
  margin: '0 10px',
});
