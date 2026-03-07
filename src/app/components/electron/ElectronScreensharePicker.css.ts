import { style } from '@vanilla-extract/css';

export const overlay = style({
  position: 'fixed',
  inset: 0,
  zIndex: 10000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.85)',
  backdropFilter: 'blur(6px)',
});

export const modal = style({
  background: '#2b2d31',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.1)',
  width: 'min(780px, 92vw)',
  maxHeight: '82vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
});

export const header = style({
  padding: '20px 24px 14px',
  fontSize: '18px',
  fontWeight: 700,
  color: '#f2f3f5',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
  flexShrink: 0,
  letterSpacing: '-0.01em',
});

export const tabRow = style({
  display: 'flex',
  gap: '4px',
  padding: '10px 20px',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
  flexShrink: 0,
  background: '#232428',
});

export const tab = style({
  padding: '6px 18px',
  borderRadius: '6px',
  border: 'none',
  background: 'transparent',
  color: '#b5bac1',
  fontSize: '14px',
  cursor: 'pointer',
  fontWeight: 600,
  transition: 'background 0.1s, color 0.1s',
  selectors: {
    '&[data-active="true"]': {
      background: '#404249',
      color: '#f2f3f5',
    },
    '&:hover:not([data-active="true"])': {
      background: 'rgba(255,255,255,0.06)',
      color: '#dbdee1',
    },
  },
});

export const grid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: '12px',
  padding: '16px 20px',
  overflowY: 'auto',
  flex: 1,
  background: '#2b2d31',
});

export const sourceCard = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  padding: '10px',
  borderRadius: '8px',
  border: '2px solid transparent',
  background: '#1e1f22',
  cursor: 'pointer',
  transition: 'border-color 0.15s, background 0.15s',
  selectors: {
    '&:hover': {
      background: '#313338',
      borderColor: 'rgba(255,255,255,0.1)',
    },
    '&[data-selected="true"]': {
      borderColor: '#5865f2',
      background: 'rgba(88,101,242,0.18)',
    },
  },
});

export const thumbnail = style({
  width: '100%',
  aspectRatio: '16/9',
  objectFit: 'cover',
  borderRadius: '4px',
  background: '#111214',
});

export const sourceName = style({
  fontSize: '13px',
  fontWeight: 500,
  color: '#dbdee1',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'center',
});

export const footer = style({
  display: 'flex',
  gap: '8px',
  padding: '14px 20px',
  borderTop: '1px solid rgba(255,255,255,0.07)',
  justifyContent: 'flex-end',
  alignItems: 'center',
  flexShrink: 0,
  background: '#232428',
});

export const audioToggle = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  fontWeight: 500,
  color: '#b5bac1',
  marginRight: 'auto',
  cursor: 'pointer',
  userSelect: 'none',
});

export const cancelBtn = style({
  padding: '8px 20px',
  borderRadius: '4px',
  border: 'none',
  background: '#4e5058',
  color: '#f2f3f5',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.1s',
  ':hover': { background: '#6d6f78' },
});

export const shareBtn = style({
  padding: '8px 20px',
  borderRadius: '4px',
  border: 'none',
  background: '#5865f2',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'background 0.1s',
  selectors: {
    '&:disabled': { opacity: 0.35, cursor: 'not-allowed' },
    '&:hover:not(:disabled)': { background: '#4752c4' },
  },
});
