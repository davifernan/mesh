import { style } from '@vanilla-extract/css';
import { toRem } from 'folds';

const LINE_H = '1.0625rem'; // 17px — single text line height
const MOBILE_MAX = '750px';
const GUILD_STRIP_W = '72px';

export const userArea = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(8),
  paddingTop: toRem(8),
  paddingRight: toRem(10),
  paddingBottom: toRem(8),
  paddingLeft: `calc(${toRem(10)} + ${GUILD_STRIP_W}) !important`,
  minHeight: toRem(52),
  width: `calc(100% + ${GUILD_STRIP_W}) !important`,
  margin: `${toRem(4)} ${toRem(8)} ${toRem(10)} calc(${toRem(8)} - ${GUILD_STRIP_W}) !important`,
  borderRadius: toRem(12),
  border: '1px solid color-mix(in srgb, var(--background-modifier-accent) 82%, transparent)',
  borderLeftColor: 'color-mix(in srgb, var(--background-modifier-accent) 58%, transparent)',
  background: 'linear-gradient(135deg, color-mix(in srgb, var(--background-secondary) 92%, transparent), color-mix(in srgb, var(--background-primary) 88%, transparent))',
  boxShadow: '0 8px 22px rgba(0, 0, 0, 0.28), inset 0 0 0 1px color-mix(in srgb, var(--background-modifier-accent) 36%, transparent)',
  backdropFilter: 'blur(8px)',
  position: 'relative',
  zIndex: 12,
  flexShrink: 0,
  cursor: 'default',
  transition: 'background-color 120ms ease, border-color 120ms ease, transform 120ms ease',
  selectors: {
    '&:hover': {
      background: 'linear-gradient(135deg, color-mix(in srgb, var(--background-secondary) 96%, transparent), color-mix(in srgb, var(--background-primary) 92%, transparent))',
      borderColor: 'color-mix(in srgb, var(--background-modifier-accent) 96%, transparent)',
      transform: 'translateY(-1px)',
    },
  },
  '@media': {
    [`(max-width: ${MOBILE_MAX})`]: {
      width: '100% !important',
      paddingLeft: toRem(10),
      margin: 0,
      borderRadius: 0,
      borderLeft: 'none',
      borderRight: 'none',
      borderBottom: 'none',
      boxShadow: 'none',
      backdropFilter: 'none',
    },
  },
});

export const avatarWrap = style({
  position: 'relative',
  flexShrink: 0,
  width: toRem(32),
  height: toRem(32),
});

export const presenceDot = style({
  position: 'absolute',
  bottom: toRem(-2),
  right: toRem(-2),
  width: toRem(10),
  height: toRem(10),
  borderRadius: '50%',
  border: `${toRem(2)} solid color-mix(in srgb, var(--background-primary) 88%, transparent)`,
  backgroundColor: 'var(--status-offline)',
  selectors: {
    '&[data-presence="online"]': { backgroundColor: 'var(--status-online)' },
    '&[data-presence="unavailable"]': { backgroundColor: 'var(--status-idle)' },
    '&[data-presence="offline"]': { backgroundColor: 'var(--status-offline)' },
  },
});

/* Fixed-height clip: only one line visible at a time */
export const textStack = style({
  flex: 1,
  minWidth: 0,
  height: LINE_H,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 1,
});

/* Username — starts visible, slides up on parent hover */
export const usernameText = style({
  flexShrink: 0,
  height: LINE_H,
  lineHeight: LINE_H,
  fontSize: toRem(14),
  fontWeight: 600,
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  transform: 'translateY(0)',
  transition: 'transform 0.22s ease',
  selectors: {
    [`${userArea}:hover &`]: {
      transform: 'translateY(-107%)',
    },
  },
});

/* Status — starts hidden below, slides up into view on hover */
export const statusText = style({
  flexShrink: 0,
  height: LINE_H,
  lineHeight: LINE_H,
  fontSize: toRem(12),
  fontWeight: 400,
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  opacity: 0,
  transform: 'translateY(0)',
  transition: 'transform 0.22s ease, opacity 0.15s ease',
  selectors: {
    [`${userArea}:hover &`]: {
      transform: 'translateY(-107%)',
      opacity: 1,
    },
  },
});

export const controlsRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(4),
  flexShrink: 0,
  marginLeft: 'auto',
});

export const controlBtn = style({
  width: toRem(32),
  height: toRem(32),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  borderRadius: toRem(4),
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  transition: 'background-color 100ms ease, color 100ms ease',
  selectors: {
    '&:hover': { backgroundColor: 'var(--background-modifier-hover)' },
  },
});

export const controlBtnDanger = style([controlBtn, {
  selectors: {
    '&[data-active=true]': { color: '#f23f43' },
  },
}]);

export const controlButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: toRem(32),
  height: toRem(32),
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'transparent',
  color: 'var(--control-button-normal-text)',
  border: 'none',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background-color 100ms ease, color 100ms ease',
  selectors: {
    '&:hover': {
      backgroundColor: 'color-mix(in srgb, var(--control-button-normal-text) 10%, transparent)',
      color: 'var(--control-button-hover-text)',
    },
  },
});
