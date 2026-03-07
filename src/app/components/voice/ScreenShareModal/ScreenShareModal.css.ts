import { style } from '@vanilla-extract/css';
import { config, toRem } from 'folds';

export const Overlay = style({
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
});

export const Modal = style({
  background: 'var(--background-primary)',
  borderRadius: toRem(8),
  padding: toRem(24),
  minWidth: toRem(340),
  maxWidth: toRem(420),
  width: '90vw',
  display: 'flex',
  flexDirection: 'column',
  gap: toRem(16),
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  border: '1px solid var(--background-modifier-accent)',
});

export const Title = style({
  fontSize: toRem(18),
  fontWeight: 600,
  color: 'var(--header-primary)',
  margin: 0,
});

export const Section = style({
  display: 'flex',
  flexDirection: 'column',
  gap: toRem(6),
});

export const Label = style({
  fontSize: toRem(12),
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--text-muted)',
});

export const ChipRow = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: toRem(4),
});

export const Chip = style({
  padding: `${toRem(4)} ${toRem(10)}`,
  borderRadius: toRem(4),
  border: '1px solid var(--background-modifier-accent)',
  background: 'var(--background-secondary)',
  color: 'var(--text-normal)',
  fontSize: toRem(13),
  cursor: 'pointer',
  fontWeight: 500,
  selectors: {
    '&:hover:not([data-disabled=true])': {
      background: 'var(--background-modifier-hover)',
    },
    '&[data-selected=true]': {
      background: 'var(--brand-experiment, #5865f2)',
      borderColor: 'var(--brand-experiment, #5865f2)',
      color: '#fff',
    },
    '&[data-disabled=true]': {
      opacity: 0.38,
      cursor: 'not-allowed',
    },
  },
});

export const InfoRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(6),
  fontSize: toRem(12),
  color: 'var(--text-muted)',
  padding: `${toRem(6)} ${toRem(8)}`,
  background: 'var(--background-secondary)',
  borderRadius: toRem(4),
});

export const AudioRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
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
  background: 'var(--background-modifier-accent)',
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
    },
    [`${ToggleInput}:checked + &::after`]: {
      transform: 'translateX(18px)',
    },
  },
});

export const ButtonRow = style({
  display: 'flex',
  gap: toRem(8),
  justifyContent: 'flex-end',
  marginTop: toRem(4),
});

export const BtnCancel = style({
  padding: `${toRem(8)} ${toRem(16)}`,
  borderRadius: toRem(4),
  border: '1px solid var(--background-modifier-accent)',
  background: 'transparent',
  color: 'var(--text-normal)',
  fontSize: toRem(14),
  fontWeight: 500,
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      background: 'var(--background-modifier-hover)',
    },
  },
});

export const BtnConfirm = style({
  padding: `${toRem(8)} ${toRem(16)}`,
  borderRadius: toRem(4),
  border: 'none',
  background: 'var(--brand-experiment, #5865f2)',
  color: '#fff',
  fontSize: toRem(14),
  fontWeight: 600,
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      background: 'var(--brand-experiment-560, #4752c4)',
    },
  },
});
