import { style } from '@vanilla-extract/css';
import { toRem } from 'folds';

// ── Overlay & shell ───────────────────────────────────────────────────────────
export const Overlay = style({
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.75)',
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
  width: '90vw',
  maxWidth: toRem(480),
  maxHeight: '92vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 24px 64px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.06)',
  borderTop: '3px solid var(--brand-experiment, #5865f2)',
  overflowY: 'auto',
});

// ── Header ────────────────────────────────────────────────────────────────────
export const Header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${toRem(16)} ${toRem(20)} ${toRem(14)}`,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  flexShrink: 0,
});

export const Title = style({
  fontSize: toRem(16),
  fontWeight: 700,
  color: '#f2f3f5',
  margin: 0,
  letterSpacing: '-0.01em',
});

export const CloseBtn = style({
  background: 'none',
  border: 'none',
  color: 'rgba(255,255,255,0.45)',
  cursor: 'pointer',
  fontSize: toRem(18),
  lineHeight: 1,
  padding: toRem(4),
  borderRadius: toRem(4),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  selectors: {
    '&:hover': {
      color: '#fff',
      background: 'rgba(255,255,255,0.08)',
    },
  },
});

// ── Provider tabs ─────────────────────────────────────────────────────────────
export const TabBar = style({
  display: 'flex',
  gap: toRem(4),
  padding: `${toRem(12)} ${toRem(20)} 0`,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  flexShrink: 0,
});

export const Tab = style({
  position: 'relative',
  padding: `${toRem(6)} ${toRem(12)} ${toRem(10)}`,
  borderRadius: `${toRem(6)} ${toRem(6)} 0 0`,
  border: 'none',
  background: 'none',
  color: 'rgba(255,255,255,0.5)',
  fontSize: toRem(13),
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'color 0.12s ease',
  display: 'flex',
  alignItems: 'center',
  gap: toRem(6),
  selectors: {
    '&:hover:not(:disabled)': {
      color: 'rgba(255,255,255,0.85)',
    },
    '&:disabled': {
      cursor: 'not-allowed',
      opacity: 0.45,
    },
    '&[aria-selected="true"]': {
      color: '#fff',
      fontWeight: 600,
    },
    '&[aria-selected="true"]::after': {
      content: '""',
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: toRem(2),
      background: 'var(--brand-experiment, #5865f2)',
      borderRadius: `${toRem(2)} ${toRem(2)} 0 0`,
    },
  },
});

export const ComingSoonBadge = style({
  fontSize: toRem(10),
  fontWeight: 600,
  background: 'rgba(88,101,242,0.2)',
  color: 'var(--brand-experiment, #5865f2)',
  borderRadius: toRem(4),
  padding: `${toRem(1)} ${toRem(5)}`,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
});

// ── Body ──────────────────────────────────────────────────────────────────────
export const Body = style({
  padding: `${toRem(18)} ${toRem(20)}`,
  display: 'flex',
  flexDirection: 'column',
  gap: toRem(16),
  flexGrow: 1,
  minHeight: 0,
});

export const SectionLabel = style({
  fontSize: toRem(11),
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: 'var(--brand-experiment, #5865f2)',
  marginBottom: toRem(6),
});

// ── Drop zone (upload) ────────────────────────────────────────────────────────
export const DropZone = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: toRem(8),
  padding: `${toRem(28)} ${toRem(16)}`,
  border: '2px dashed rgba(255,255,255,0.14)',
  borderRadius: toRem(10),
  cursor: 'pointer',
  transition: 'border-color 0.15s ease, background 0.15s ease',
  background: 'rgba(255,255,255,0.02)',
  selectors: {
    '&:hover': {
      borderColor: 'var(--brand-experiment, #5865f2)',
      background: 'rgba(88,101,242,0.05)',
    },
  },
});

export const DropZoneActive = style({
  borderColor: 'var(--brand-experiment, #5865f2)',
  background: 'rgba(88,101,242,0.09)',
});

export const DropZoneText = style({
  fontSize: toRem(13),
  color: 'rgba(255,255,255,0.55)',
  textAlign: 'center',
  lineHeight: 1.5,
});

export const DropZoneSub = style({
  fontSize: toRem(11),
  color: 'rgba(255,255,255,0.3)',
  marginTop: toRem(2),
});

export const BrowseBtn = style({
  padding: `${toRem(6)} ${toRem(14)}`,
  borderRadius: toRem(6),
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.7)',
  fontSize: toRem(12),
  fontWeight: 500,
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      background: 'rgba(255,255,255,0.1)',
      color: '#fff',
    },
  },
});

// ── File / URL preview card ───────────────────────────────────────────────────
export const PreviewCard = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(10),
  padding: `${toRem(10)} ${toRem(12)}`,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: toRem(8),
});

export const PreviewIcon = style({
  fontSize: toRem(20),
  flexShrink: 0,
});

export const PreviewMeta = style({
  display: 'flex',
  flexDirection: 'column',
  gap: toRem(2),
  minWidth: 0,
});

export const PreviewName = style({
  fontSize: toRem(13),
  fontWeight: 500,
  color: '#f2f3f5',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const PreviewSub = style({
  fontSize: toRem(11),
  color: 'rgba(255,255,255,0.4)',
});

// ── URL tab inputs ────────────────────────────────────────────────────────────
export const UrlRow = style({
  display: 'flex',
  gap: toRem(8),
  alignItems: 'stretch',
});

export const UrlInput = style({
  flex: 1,
  padding: `${toRem(8)} ${toRem(12)}`,
  borderRadius: toRem(6),
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)',
  color: '#f2f3f5',
  fontSize: toRem(13),
  outline: 'none',
  selectors: {
    '&::placeholder': {
      color: 'rgba(255,255,255,0.25)',
    },
    '&:focus': {
      borderColor: 'var(--brand-experiment, #5865f2)',
      background: 'rgba(88,101,242,0.06)',
    },
  },
});

export const FetchBtn = style({
  padding: `${toRem(8)} ${toRem(14)}`,
  borderRadius: toRem(6),
  border: 'none',
  background: 'rgba(255,255,255,0.08)',
  color: 'rgba(255,255,255,0.75)',
  fontSize: toRem(13),
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  selectors: {
    '&:hover:not(:disabled)': {
      background: 'rgba(255,255,255,0.13)',
      color: '#fff',
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
});

// ── Metadata fields ───────────────────────────────────────────────────────────
export const FieldGroup = style({
  display: 'flex',
  flexDirection: 'column',
  gap: toRem(4),
});

export const FieldLabel = style({
  fontSize: toRem(11),
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'rgba(255,255,255,0.4)',
});

export const TextInput = style({
  padding: `${toRem(8)} ${toRem(10)}`,
  borderRadius: toRem(6),
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)',
  color: '#f2f3f5',
  fontSize: toRem(13),
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  selectors: {
    '&::placeholder': {
      color: 'rgba(255,255,255,0.25)',
    },
    '&:focus': {
      borderColor: 'var(--brand-experiment, #5865f2)',
    },
  },
});

export const TitleEmojiRow = style({
  display: 'flex',
  gap: toRem(8),
  alignItems: 'stretch',
});

export const EmojiBtn = style({
  padding: `${toRem(7)} ${toRem(10)}`,
  borderRadius: toRem(6),
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)',
  color: '#f2f3f5',
  fontSize: toRem(18),
  cursor: 'pointer',
  lineHeight: 1,
  flexShrink: 0,
  selectors: {
    '&:hover': {
      background: 'rgba(255,255,255,0.1)',
    },
  },
});

// ── Volume slider ─────────────────────────────────────────────────────────────
export const VolumeRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(10),
});

export const VolumeSlider = style({
  flex: 1,
  accentColor: 'var(--brand-experiment, #5865f2)',
  cursor: 'pointer',
});

export const VolumeValue = style({
  fontSize: toRem(12),
  fontWeight: 600,
  color: 'rgba(255,255,255,0.6)',
  minWidth: toRem(34),
  textAlign: 'right',
});

// ── Attribution notice ────────────────────────────────────────────────────────
export const AttributionNotice = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: toRem(8),
  padding: `${toRem(8)} ${toRem(10)}`,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: toRem(6),
  fontSize: toRem(11),
  color: 'rgba(255,255,255,0.4)',
  lineHeight: 1.5,
});

// ── Error banner ──────────────────────────────────────────────────────────────
export const ErrorBanner = style({
  padding: `${toRem(9)} ${toRem(12)}`,
  borderRadius: toRem(6),
  background: 'rgba(242,63,67,0.12)',
  border: '1px solid rgba(242,63,67,0.25)',
  color: '#f87171',
  fontSize: toRem(12),
  lineHeight: 1.5,
});

// ── Footer ────────────────────────────────────────────────────────────────────
export const Footer = style({
  display: 'flex',
  gap: toRem(8),
  justifyContent: 'flex-end',
  padding: `${toRem(14)} ${toRem(20)}`,
  borderTop: '1px solid rgba(255,255,255,0.06)',
  flexShrink: 0,
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
  selectors: {
    '&:hover': {
      background: 'rgba(255,255,255,0.07)',
      color: '#fff',
    },
  },
});

export const BtnAdd = style({
  padding: `${toRem(8)} ${toRem(18)}`,
  borderRadius: toRem(6),
  border: 'none',
  background: 'var(--brand-experiment, #5865f2)',
  color: '#fff',
  fontSize: toRem(14),
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.12s ease, opacity 0.12s ease',
  selectors: {
    '&:hover:not(:disabled)': {
      background: 'var(--brand-experiment-560, #4752c4)',
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
  },
});
