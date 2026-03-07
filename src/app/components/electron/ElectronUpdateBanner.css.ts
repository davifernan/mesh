import { style } from '@vanilla-extract/css';

export const banner = style({
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '12px',
  padding: '10px 16px',
  backgroundColor: 'var(--bg-surface)',
  borderTop: '1px solid rgba(255,255,255,0.08)',
  color: 'var(--tc-surface-hi)',
  fontSize: '14px',
  userSelect: 'none',
});

export const restartBtn = style({
  padding: '4px 14px',
  borderRadius: '4px',
  border: 'none',
  background: 'var(--color-success)',
  color: '#ffffff',
  fontWeight: 600,
  fontSize: '13px',
  cursor: 'pointer',
  flexShrink: 0,
  ':hover': {
    filter: 'brightness(1.1)',
  },
});

export const dismissBtn = style({
  padding: '4px 10px',
  borderRadius: '4px',
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'transparent',
  color: 'var(--tc-surface-hi)',
  fontSize: '13px',
  cursor: 'pointer',
  flexShrink: 0,
  ':hover': {
    background: 'rgba(255,255,255,0.07)',
  },
});

export const progressBar = style({
  height: '3px',
  position: 'absolute',
  bottom: 0,
  left: 0,
  background: 'var(--color-success)',
  transition: 'width 0.3s ease',
});
