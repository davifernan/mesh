import { style } from '@vanilla-extract/css';
import { toRem } from 'folds';

const LINE_H = '1.0625rem'; // 17px — matches UserArea pattern

/**
 * Wrapper applied to the clickable button inside SpaceHeader.
 * The hover selector on this element drives both text animations.
 */
export const headerBtn = style({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'inherit',
  display: 'flex',
  alignItems: 'center',
  gap: toRem(6),
  padding: 0,
  minWidth: 0,
  flex: 1,
});

/**
 * Fixed-height clip: only one line visible at a time.
 * Identical clip-container pattern to UserArea.textStack.
 */
export const headerTextStack = style({
  height: LINE_H,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 0,
});

/**
 * Primary title row (space name).
 * Starts at translateY(0), slides up to -107% on parent button hover.
 */
export const headerTitle = style({
  flexShrink: 0,
  height: LINE_H,
  lineHeight: LINE_H,
  fontSize: toRem(16),
  fontWeight: 600,
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  transform: 'translateY(0)',
  transition: 'transform 0.22s ease',
  selectors: {
    [`${headerBtn}:hover &`]: {
      transform: 'translateY(-107%)',
    },
  },
});

/**
 * Subtitle row that slides in from below on hover.
 * Starts invisible (opacity: 0, translateY(0)) — slides up alongside title.
 */
export const headerSubtitle = style({
  flexShrink: 0,
  height: LINE_H,
  lineHeight: LINE_H,
  fontSize: toRem(11),
  fontWeight: 400,
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  opacity: 0,
  transform: 'translateY(0)',
  transition: 'transform 0.22s ease, opacity 0.15s ease',
  selectors: {
    [`${headerBtn}:hover &`]: {
      transform: 'translateY(-107%)',
      opacity: 1,
    },
  },
});
