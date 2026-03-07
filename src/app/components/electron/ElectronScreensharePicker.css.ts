import { style } from '@vanilla-extract/css';

export const overlay = style({
  position: 'fixed',
  inset: 0,
  zIndex: 10000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.72)',
  backdropFilter: 'blur(4px)',
});

export const modal = style({
  background: 'var(--bg-surface)',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.08)',
  width: 'min(720px, 90vw)',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
});

export const header = style({
  padding: '16px 20px 12px',
  fontSize: '16px',
  fontWeight: 600,
  color: 'var(--tc-surface-hi)',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  flexShrink: 0,
});

export const tabRow = style({
  display: 'flex',
  gap: '4px',
  padding: '10px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  flexShrink: 0,
});

export const tab = style({
  padding: '5px 14px',
  borderRadius: '4px',
  border: 'none',
  background: 'transparent',
  color: 'var(--tc-surface-hi)',
  fontSize: '13px',
  cursor: 'pointer',
  fontWeight: 500,
  selectors: {
    '&[data-active="true"]': {
      background: 'var(--bg-surface-extra)',
      color: 'var(--tc-surface-hi)',
    },
    '&:hover:not([data-active="true"])': {
      background: 'rgba(255,255,255,0.06)',
    },
  },
});

export const grid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: '10px',
  padding: '14px 16px',
  overflowY: 'auto',
  flex: 1,
});

export const sourceCard = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  padding: '8px',
  borderRadius: '6px',
  border: '2px solid transparent',
  background: 'rgba(255,255,255,0.04)',
  cursor: 'pointer',
  transition: 'border-color 0.15s, background 0.15s',
  selectors: {
    '&:hover': {
      background: 'rgba(255,255,255,0.08)',
    },
    '&[data-selected="true"]': {
      borderColor: 'var(--color-primary)',
      background: 'rgba(88,101,242,0.15)',
    },
  },
});

export const thumbnail = style({
  width: '100%',
  aspectRatio: '16/9',
  objectFit: 'cover',
  borderRadius: '3px',
  background: '#000',
});

export const sourceName = style({
  fontSize: '12px',
  color: 'var(--tc-surface-hi)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'center',
});

export const footer = style({
  display: 'flex',
  gap: '8px',
  padding: '12px 16px',
  borderTop: '1px solid rgba(255,255,255,0.06)',
  justifyContent: 'flex-end',
  alignItems: 'center',
  flexShrink: 0,
});

export const audioToggle = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '13px',
  color: 'var(--tc-surface-hi)',
  marginRight: 'auto',
  cursor: 'pointer',
});

export const cancelBtn = style({
  padding: '7px 18px',
  borderRadius: '4px',
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'transparent',
  color: 'var(--tc-surface-hi)',
  fontSize: '13px',
  cursor: 'pointer',
  ':hover': { background: 'rgba(255,255,255,0.07)' },
});

export const shareBtn = style({
  padding: '7px 18px',
  borderRadius: '4px',
  border: 'none',
  background: 'var(--color-primary)',
  color: '#ffffff',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  selectors: {
    '&:disabled': { opacity: 0.4, cursor: 'not-allowed' },
    '&:hover:not(:disabled)': { filter: 'brightness(1.1)' },
  },
});
