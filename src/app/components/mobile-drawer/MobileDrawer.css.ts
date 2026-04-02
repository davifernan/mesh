import { style } from '@vanilla-extract/css';

/**
 * The sidebar is ALWAYS rendered inline — on both desktop and mobile.
 * On mobile it forms the narrow left icon strip (72px) of the Discord-style layout.
 * The old drawer/slide-in behaviour has been removed.
 */
export const mobileDrawer = style({});

/**
 * Overlay is no longer used (sidebar is always visible, no drawer to close).
 * Kept as an empty style so imports don't break.
 */
export const mobileOverlay = style({
  display: 'none',
});
