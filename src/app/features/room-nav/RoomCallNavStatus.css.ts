import { style } from '@vanilla-extract/css';
import { config, toRem } from 'folds';

const LEFT_OVERLAP = toRem(56);

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
  position: 'relative',
  left: `calc(-1 * ${LEFT_OVERLAP})`,
  width: `calc(100% + ${LEFT_OVERLAP} - ${toRem(8)})`,
  margin: `${toRem(2)} ${toRem(8)} ${toRem(6)} ${toRem(8)}`,
  display: 'flex',
  flexDirection: 'column',
  gap: toRem(6),
  padding: `${toRem(8)} ${toRem(10)}`,
  borderRadius: toRem(12),
  border: '1px solid color-mix(in srgb, var(--background-modifier-accent) 82%, transparent)',
  borderLeftColor: 'color-mix(in srgb, var(--background-modifier-accent) 58%, transparent)',
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--background-secondary) 92%, transparent), color-mix(in srgb, var(--background-primary) 88%, transparent))',
  boxShadow:
    '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 0 0 1px color-mix(in srgb, var(--background-modifier-accent) 30%, transparent)',
  backdropFilter: 'blur(8px)',
  zIndex: 55,
  flexShrink: 0,
});

export const VoiceContainerDocked = style([
  VoiceContainer,
  {
    left: 0,
    width: '100%',
    margin: 0,
    border: 'none',
    background: 'transparent',
    boxShadow: 'none',
    backdropFilter: 'none',
    borderRadius: 0,
    zIndex: 1,
  },
]);

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

export const ConnectedDot = style({
  width: toRem(10),
  height: toRem(10),
  borderRadius: '50%',
  background: 'var(--status-online, #23a55a)',
  boxShadow: '0 0 0 2px color-mix(in srgb, var(--status-online, #23a55a) 25%, transparent)',
  flexShrink: 0,
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
  background: 'var(--voice-surface-1)',
  color: 'var(--interactive-normal)',
  border: 'none',
  borderRadius: toRem(9999),
  cursor: 'pointer',
  padding: 0,
  selectors: {
    '&:hover': {
      background: 'var(--voice-surface-2)',
      color: 'var(--interactive-hover)',
    },
    '&[data-active=true]': {
      background: 'var(--voice-status-success-bg)',
      color: 'var(--voice-status-success)',
    },
    '&[data-muted=true]': {
      color: 'var(--voice-status-danger)',
    },
  },
});

/* --- Avatar stack (speaking users) --- */

export const AvatarStack = style({
  display: 'flex',
  alignItems: 'center',
  marginTop: toRem(2),
  paddingLeft: toRem(2),
});

export const AvatarItem = style({
  width: toRem(24),
  height: toRem(24),
  borderRadius: '50%',
  overflow: 'hidden',
  background: 'var(--background-tertiary)',
  border: `2px solid var(--background-secondary)`,
  flexShrink: 0,
  selectors: {
    '&:not(:first-child)': {
      marginLeft: toRem(-6),
    },
  },
});

export const AvatarItemSpeaking = style({
  boxShadow: '0 0 0 2px #23a55a',
});

export const AvatarImg = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

export const AvatarInitials = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: toRem(9),
  fontWeight: 700,
  color: 'var(--text-muted)',
  background: 'var(--background-tertiary)',
  userSelect: 'none',
});

/* --- Voice Details Popout --- */

export const VoicePopout = style({
  position: 'absolute',
  bottom: `calc(100% + ${toRem(8)})`,
  left: 0,
  right: 0,
  zIndex: 100,
  background: 'var(--background-secondary)',
  borderRadius: toRem(8),
  padding: toRem(12),
  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  border: '1px solid var(--background-modifier-accent, rgba(255,255,255,0.08))',
});

export const VoicePopoutTitle = style({
  fontSize: toRem(11),
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-muted)',
  marginBottom: toRem(8),
});

export const VoicePopoutRow = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: toRem(12),
  lineHeight: toRem(18),
  color: 'var(--text-secondary)',
  gap: toRem(8),
});

export const VoicePopoutValue = style({
  fontWeight: 600,
  color: 'var(--text-primary)',
  fontVariantNumeric: 'tabular-nums',
});

/* --- Incoming call glassmorphism card --- */

export const incomingCallCard = style({
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  background: 'color-mix(in srgb, var(--background-secondary) 85%, transparent)',
  borderRadius: toRem(12),
  padding: toRem(16),
  width: toRem(260),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: toRem(12),
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  cursor: 'grab',
  touchAction: 'none',
  selectors: {
    '&:active': { cursor: 'grabbing' },
  },
});

export const dragHandle = style({
  width: toRem(48),
  height: toRem(4),
  borderRadius: toRem(9999),
  background: 'rgba(255,255,255,0.2)',
  alignSelf: 'center',
  cursor: 'grab',
});

export const incomingLabel = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(6),
  fontSize: toRem(11),
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--status-online, #23a55a)',
});

export const callerAvatar = style({
  width: toRem(80),
  height: toRem(80),
  borderRadius: toRem(9999),
  overflow: 'hidden',
  background: 'var(--background-tertiary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const callerAvatarImg = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

export const callerAvatarInitials = style({
  fontSize: toRem(28),
  fontWeight: 700,
  color: 'var(--text-muted)',
  userSelect: 'none',
});

export const callerName = style({
  fontSize: toRem(16),
  fontWeight: 600,
  color: 'var(--text-primary)',
  textAlign: 'center',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const incomingActions = style({
  display: 'flex',
  flexDirection: 'column',
  gap: toRem(8),
  width: '100%',
});

export const acceptBtn = style({
  height: toRem(44),
  borderRadius: toRem(9999),
  background: 'var(--status-online, #23a55a)',
  color: 'white',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: toRem(14),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: toRem(8),
  selectors: {
    '&:hover': {
      filter: 'brightness(1.1)',
    },
  },
});

export const rejectBtn = style({
  height: toRem(44),
  borderRadius: toRem(9999),
  background: 'var(--status-danger, #f23f43)',
  color: 'white',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: toRem(14),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: toRem(8),
  selectors: {
    '&:hover': {
      filter: 'brightness(1.1)',
    },
  },
});

export const ignoreBtn = style({
  height: toRem(44),
  borderRadius: toRem(9999),
  background: 'var(--background-secondary)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--background-tertiary)',
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: toRem(14),
  selectors: {
    '&:hover': {
      background: 'var(--background-modifier-hover)',
    },
  },
});

export const overflowBadge = style({
  background: 'var(--background-modifier-hover)',
  border: 'none',
  borderRadius: toRem(9999),
  width: toRem(22),
  height: toRem(22),
  fontSize: toRem(10),
  fontWeight: 600,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

export const membersPopout = style({
  position: 'absolute',
  bottom: '100%',
  left: '0',
  background: 'var(--background-floating)',
  borderRadius: toRem(8),
  padding: toRem(8),
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  minWidth: toRem(160),
  zIndex: 100,
});

export const membersPopoutItem = style({
  padding: `${toRem(4)} ${toRem(8)}`,
  fontSize: toRem(13),
  color: 'var(--text-primary)',
});

/* ── Voice channel member list (replaces avatar stack) ──────────────── */

export const MemberList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: toRem(1),
  marginTop: toRem(2),
});

export const MemberRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(6),
  padding: `${toRem(3)} ${toRem(4)}`,
  borderRadius: toRem(4),
  minWidth: 0,
  selectors: {
    '&:hover': {
      background: 'var(--background-modifier-hover)',
    },
  },
});

export const MemberAvatar = style({
  width: toRem(24),
  height: toRem(24),
  borderRadius: '50%',
  overflow: 'hidden',
  background: 'var(--background-tertiary)',
  flexShrink: 0,
  border: '2px solid transparent',
  transition: 'border-color 150ms ease',
});

export const MemberAvatarSpeaking = style({
  borderColor: '#23a55a',
  boxShadow: '0 0 0 1px #23a55a44',
});

export const MemberAvatarImg = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
});

export const MemberAvatarInitials = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: toRem(9),
  fontWeight: 700,
  color: 'var(--text-muted)',
  userSelect: 'none',
});

export const MemberName = style({
  flex: 1,
  minWidth: 0,
  fontSize: toRem(13),
  fontWeight: 500,
  color: 'var(--text-secondary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  lineHeight: toRem(18),
});

export const MemberNameSpeaking = style({
  color: 'var(--text-primary)',
});

export const MemberBadges = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(3),
  flexShrink: 0,
  color: 'var(--text-muted)',
});

/** Mic muted: red */
export const BadgeMuted = style({
  color: '#F23F43',
});

/** Camera on: subtle green */
export const BadgeCamera = style({
  color: '#23A55A',
});

/** Deafened: orange */
export const BadgeDeafened = style({
  color: '#FCC23B',
});

/** LIVE screenshare pill */
export const LiveBadge = style({
  fontSize: toRem(9),
  fontWeight: 700,
  letterSpacing: '0.06em',
  color: '#F23F43',
  background: 'rgba(242, 63, 67, 0.15)',
  border: '1px solid rgba(242, 63, 67, 0.3)',
  borderRadius: toRem(3),
  padding: `0 ${toRem(4)}`,
  lineHeight: toRem(14),
  userSelect: 'none',
  animation: 'livePulse 2s ease-in-out infinite',
});

// keyframes need to be defined separately – injecting as global for now
// (vanilla-extract keyframes are typed, this is the simplest compatible approach)
