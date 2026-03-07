import { style } from '@vanilla-extract/css';
import { config, toRem } from 'folds';

export const Actions = style({
  padding: config.space.S200,
});

export const RoomButtonWrap = style({
  minWidth: 0,
});

export const RoomButton = style({
  width: '100%',
  minWidth: 0,
  padding: `0 ${config.space.S200}`,
});

export const RoomName = style({
  flexGrow: 1,
  minWidth: 0,
});

/* --- Fluxer-style active call voice panel --- */

export const VoiceContainer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: toRem(6),
  padding: `${toRem(6)} ${toRem(8)}`,
  flexShrink: 0,
});

export const StatusRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(4),
  minWidth: 0,
});

export const SignalIconWrap = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: toRem(24),
  width: toRem(24),
  flexShrink: 0,
});

export const SignalConnected = style({
  color: 'var(--status-online, #23a55a)',
});

export const SignalConnecting = style({
  color: 'var(--text-muted)',
});

export const StatusLabel = style({
  flex: 1,
  minWidth: 0,
  fontWeight: 600,
  fontSize: toRem(14),
  lineHeight: toRem(18),
  background: 'none',
  border: 'none',
  padding: 0,
  textAlign: 'left',
  cursor: 'pointer',
  userSelect: 'none',
  color: 'var(--text-normal)',
});

export const StatusConnected = style({
  color: 'var(--status-online, #23a55a)',
});

export const StatusConnecting = style({
  color: 'var(--text-muted)',
});

export const Controls = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(4),
  flexShrink: 0,
});

export const ControlButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: toRem(32),
  width: toRem(32),
  background: 'transparent',
  color: 'var(--interactive-normal)',
  border: 'none',
  borderRadius: toRem(4),
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
  selectors: {
    '&:hover': {
      background: 'var(--background-modifier-hover)',
      color: 'var(--interactive-hover)',
    },
  },
});

export const ChannelSourceRow = style({
  display: 'flex',
  alignItems: 'center',
  minWidth: 0,
});

export const ChannelSourceLink = style({
  display: 'inline-flex',
  alignItems: 'center',
  minWidth: 0,
  maxWidth: '100%',
  border: 'none',
  background: 'transparent',
  padding: 0,
  fontSize: toRem(12),
  lineHeight: toRem(16),
  color: 'var(--text-muted)',
  cursor: 'pointer',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  selectors: {
    '&:hover': {
      textDecoration: 'underline',
    },
  },
});

export const MediaSection = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: toRem(2),
});

export const MoreMenuWrap = style({
  position: 'relative',
  // Must exceed iframe z-index (1000 set in CallView.tsx applyFixedPositioningToIframe)
  zIndex: 1001,
  isolation: 'isolate',
});

export const MoreMenu = style({
  position: 'absolute',
  bottom: `calc(100% + ${toRem(4)})`,
  right: 0,
  background: 'var(--background-floating, #111214)',
  border: '1px solid var(--background-modifier-accent, #1e1f22)',
  borderRadius: toRem(6),
  padding: `${toRem(4)} 0`,
  zIndex: 1001,
  width: toRem(180),
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
});

export const MoreMenuItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(8),
  width: '100%',
  padding: `${toRem(6)} ${toRem(10)}`,
  background: 'transparent',
  border: 'none',
  color: 'var(--interactive-normal)',
  fontSize: toRem(13),
  cursor: 'pointer',
  textAlign: 'left',
  selectors: {
    '&:hover': {
      background: 'var(--background-modifier-hover)',
      color: 'var(--interactive-hover)',
    },
    '&[data-active=true]': {
      color: 'var(--status-online, #23a55a)',
    },
  },
});

export const MediaButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: toRem(32),
  width: '100%',
  background: 'var(--background-modifier-hover)',
  color: 'var(--interactive-normal)',
  border: 'none',
  borderRadius: toRem(4),
  cursor: 'pointer',
  padding: 0,
  selectors: {
    '&:hover': {
      background: 'var(--background-modifier-selected)',
      color: 'var(--interactive-hover)',
    },
    '&[data-active=true]': {
      background: 'rgba(35, 165, 90, 0.15)',
      color: 'var(--status-online, #23a55a)',
    },
    '&[data-muted=true]': {
      color: 'var(--status-danger, #f23f42)',
    },
  },
});
