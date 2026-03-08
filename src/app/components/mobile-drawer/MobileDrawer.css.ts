import { style } from '@vanilla-extract/css';

// Mobile breakpoint matches MOBILE_BREAKPOINT = 750 from useScreenSize.ts
const MOBILE_MAX = '750px';

/**
 * Applied to the sidebar wrapper element.
 * On desktop: no effect (sidebar is always visible in flow).
 * On mobile: fixed positioned, slides in from the left.
 * Toggle via data-open attribute.
 */
export const mobileDrawer = style({
  '@media': {
    [`(max-width: ${MOBILE_MAX})`]: {
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100%',
      zIndex: 200,
      transform: 'translateX(-100%)',
      transition: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1)',
      selectors: {
        '&[data-open="true"]': {
          transform: 'translateX(0)',
        },
      },
    },
  },
});

/**
 * Semi-transparent overlay behind the open drawer.
 * Hidden on desktop, rendered (but transparent+non-interactive) on mobile.
 * Becomes visible when data-open="true".
 */
export const mobileOverlay = style({
  display: 'none',
  '@media': {
    [`(max-width: ${MOBILE_MAX})`]: {
      display: 'block',
      position: 'fixed',
      inset: 0,
      zIndex: 199,
      backgroundColor: 'rgba(0,0,0,0.5)',
      opacity: 0,
      pointerEvents: 'none',
      transition: 'opacity 250ms ease',
      selectors: {
        '&[data-open="true"]': {
          opacity: 1,
          pointerEvents: 'auto',
        },
      },
    },
  },
});
