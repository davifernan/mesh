import { style } from '@vanilla-extract/css';
import { toRem } from 'folds';

export const Overlay = style({
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 'var(--z-index-overlay)',
  padding: toRem(16),
  boxSizing: 'border-box',
  backdropFilter: 'blur(4px)',
});

export const Modal = style({
  background: 'hsl(220, 14%, 13%)',
  borderRadius: toRem(12),
  minWidth: toRem(340),
  maxWidth: toRem(420),
  maxHeight: '90vh',
  overflowY: 'auto',
  width: '90vw',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
  // Brand stripe along the top
  borderTop: '3px solid var(--brand-experiment, #5865f2)',
});

// ── Header (title row) ────────────────────────────────────────────────────────
export const Header = style({
  padding: `${toRem(18)} ${toRem(22)} ${toRem(14)}`,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
});

export const Title = style({
  fontSize: toRem(16),
  fontWeight: 700,
  color: '#f2f3f5',
  margin: 0,
  letterSpacing: '-0.01em',
});

export const Subtitle = style({
  fontSize: toRem(12),
  color: 'rgba(255,255,255,0.4)',
  marginTop: toRem(2),
});

// ── Body ──────────────────────────────────────────────────────────────────────
export const Body = style({
  padding: `${toRem(16)} ${toRem(22)}`,
  display: 'flex',
  flexDirection: 'column',
  gap: toRem(18),
});

export const Section = style({
  display: 'flex',
  flexDirection: 'column',
  gap: toRem(8),
});

export const Label = style({
  fontSize: toRem(11),
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: 'var(--brand-experiment, #5865f2)',
});

export const ChipRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: toRem(6),
});

/** Base chip — unselected, enabled */
export const Chip = style({
  padding: `${toRem(6)} ${toRem(14)}`,
  borderRadius: toRem(6),
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.65)',
  fontSize: toRem(13),
  cursor: 'pointer',
  fontWeight: 500,
  transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
  selectors: {
    '&:hover:not(:disabled)': {
      background: 'rgba(255,255,255,0.11)',
      color: '#fff',
      borderColor: 'rgba(255,255,255,0.18)',
    },
    '&:disabled': {
      opacity: 0.3,
      cursor: 'not-allowed',
    },
  },
});

/** Applied on top of Chip when this option is the active selection */
export const ChipActive = style({
  background: 'var(--brand-experiment, #5865f2)',
  borderColor: 'var(--brand-experiment, #5865f2)',
  color: '#fff',
  fontWeight: 600,
  selectors: {
    '&:hover:not(:disabled)': {
      background: 'var(--brand-experiment-560, #4752c4)',
      borderColor: 'var(--brand-experiment-560, #4752c4)',
    },
  },
});

export const InfoRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(6),
  fontSize: toRem(12),
  color: 'rgba(255,255,255,0.4)',
  padding: `${toRem(8)} ${toRem(10)}`,
  background: 'rgba(255,255,255,0.04)',
  borderRadius: toRem(6),
  border: '1px solid rgba(255,255,255,0.06)',
});

// ── System audio toggle row ───────────────────────────────────────────────────
export const AudioRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${toRem(10)} ${toRem(12)}`,
  background: 'rgba(255,255,255,0.04)',
  borderRadius: toRem(8),
  border: '1px solid rgba(255,255,255,0.06)',
});

export const AudioLabel = style({
  fontSize: toRem(13),
  fontWeight: 500,
  color: 'rgba(255,255,255,0.8)',
});

export const Toggle = style({
  position: 'relative',
  width: toRem(40),
  height: toRem(22),
  flexShrink: 0,
});

export const ToggleInput = style({
  opacity: 0,
  width: 0,
  height: 0,
  position: 'absolute',
});

export const ToggleSlider = style({
  position: 'absolute',
  inset: 0,
  borderRadius: toRem(11),
  background: 'rgba(255,255,255,0.15)',
  cursor: 'pointer',
  transition: 'background 0.2s',
  selectors: {
    [`${ToggleInput}:checked + &`]: {
      background: 'var(--brand-experiment, #5865f2)',
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      width: toRem(16),
      height: toRem(16),
      top: toRem(3),
      left: toRem(3),
      borderRadius: '50%',
      background: '#fff',
      transition: 'transform 0.2s',
      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    },
    [`${ToggleInput}:checked + &::after`]: {
      transform: 'translateX(18px)',
    },
  },
});

// ── Footer (buttons) ──────────────────────────────────────────────────────────
export const Footer = style({
  display: 'flex',
  gap: toRem(8),
  justifyContent: 'flex-end',
  padding: `${toRem(14)} ${toRem(22)}`,
  borderTop: '1px solid rgba(255,255,255,0.06)',
});

export const BtnCancel = style({
  padding: `${toRem(8)} ${toRem(18)}`,
  borderRadius: toRem(6),
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'transparent',
  color: 'rgba(255,255,255,0.6)',
  fontSize: toRem(14),
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background 0.12s ease, color 0.12s ease',
  selectors: {
    '&:hover': {
      background: 'rgba(255,255,255,0.07)',
      color: '#fff',
    },
  },
});

export const BtnConfirm = style({
  padding: `${toRem(8)} ${toRem(18)}`,
  borderRadius: toRem(6),
  border: 'none',
  background: 'var(--brand-experiment, #5865f2)',
  color: '#fff',
  fontSize: toRem(14),
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.12s ease',
  selectors: {
    '&:hover': {
      background: 'var(--brand-experiment-560, #4752c4)',
    },
  },
});
