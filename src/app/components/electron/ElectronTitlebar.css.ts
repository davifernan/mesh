import { style } from '@vanilla-extract/css';

// `WebkitAppRegion` is an Electron-specific CSS property not in the standard
// vanilla-extract types. We suppress the unknown-property TS error with casts.
type ElectronStyle = Parameters<typeof style>[0] & { WebkitAppRegion?: string };

const es = (s: ElectronStyle) => style(s as Parameters<typeof style>[0]);

export const titlebar = es({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  backgroundColor: 'var(--background-tertiary)',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  zIndex: 'var(--z-index-overlay)' as never,
  // Allow dragging the window
  WebkitAppRegion: 'drag',
  userSelect: 'none',
});

// macOS titlebar — full-width drag region with space for traffic lights
export const dragRegionMac = es({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  height: 38,
  WebkitAppRegion: 'drag',
  zIndex: 'var(--z-index-overlay)' as never,
  // No background — completely transparent, sits above the web-app
  // pointerEvents must stay default (auto) so Electron can detect the drag
});

// Fills available space for dragging within the titlebar
export const dragRegion = es({
  flex: 1,
  height: '100%',
  WebkitAppRegion: 'drag',
});

export const controls = es({
  display: 'flex',
  height: '100%',
  // Buttons must NOT be draggable
  WebkitAppRegion: 'no-drag',
});

export const controlBtn = style({
  width: 46,
  height: '100%',
  border: 'none',
  background: 'transparent',
  color: 'var(--text-secondary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background 0.1s',
  ':hover': {
    backgroundColor: 'var(--background-modifier-hover)',
    color: 'var(--text-primary)',
  },
  ':active': {
    backgroundColor: 'var(--background-modifier-selected)',
  },
});

export const closeBtn = style({
  ':hover': {
    backgroundColor: '#e81123',
    color: '#ffffff',
  },
});
