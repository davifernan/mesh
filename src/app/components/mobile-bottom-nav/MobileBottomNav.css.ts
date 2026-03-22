import { style } from '@vanilla-extract/css';
import { toRem } from 'folds';

export const BottomNav = style({
  display: 'flex',
  alignItems: 'stretch',
  justifyContent: 'space-around',
  height: 'calc(3.75rem + env(safe-area-inset-bottom))',
  paddingBottom: 'env(safe-area-inset-bottom)',
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 1000,
  backgroundColor: 'var(--background-tertiary)',
  borderTop: '1px solid var(--background-modifier-hover)',
  flexShrink: 0,
});

export const Tab = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  gap: toRem(2),
  color: 'var(--interactive-normal)',
  textDecoration: 'none',
  fontSize: toRem(10),
  fontWeight: 500,
  transition: 'color 100ms ease',
  selectors: {
    '&:hover': {
      color: 'var(--interactive-hover)',
    },
  },
});

export const TabActive = style({
  // BetterCord: active tab = --text-primary (near-white), NOT brand color
  color: 'var(--text-primary)',
});

export const TabLabel = style({
  fontSize: toRem(10),
  lineHeight: toRem(12),
});

/** Reset button defaults so ButtonTab matches NavTab appearance */
export const ButtonTab = style({
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
});
