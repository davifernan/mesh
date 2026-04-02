import React, { ReactNode } from 'react';
import { useMatch } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScreenSize, useScreenSizeContext } from '../hooks/useScreenSize';
import { DIRECT_PATH, EXPLORE_PATH, HOME_PATH, INBOX_PATH, SPACE_PATH } from './paths';

type MobileFriendlyClientNavProps = {
  children: ReactNode;
};
export function MobileFriendlyClientNav({ children }: MobileFriendlyClientNavProps) {
  const screenSize = useScreenSizeContext();
  const homeMatch = useMatch({ path: HOME_PATH, caseSensitive: true, end: true });
  const directMatch = useMatch({ path: DIRECT_PATH, caseSensitive: true, end: true });
  const spaceMatch = useMatch({ path: SPACE_PATH, caseSensitive: true, end: true });
  const exploreMatch = useMatch({ path: EXPLORE_PATH, caseSensitive: true, end: true });
  const inboxMatch = useMatch({ path: INBOX_PATH, caseSensitive: true, end: true });

  if (
    screenSize === ScreenSize.Mobile &&
    !(homeMatch || directMatch || spaceMatch || exploreMatch || inboxMatch)
  ) {
    return null;
  }

  return children;
}

type MobileFriendlyPageNavProps = {
  path: string;
  children: ReactNode;
};
/**
 * On desktop: always renders children.
 * On mobile: renders children as an absolutely positioned background layer so the
 * MobileSlide room view can slide in on top without disrupting layout flow.
 */
export function MobileFriendlyPageNav({ path, children }: MobileFriendlyPageNavProps) {
  const screenSize = useScreenSizeContext();

  if (screenSize !== ScreenSize.Mobile) return children;

  // On mobile the channel list is always in the DOM as a background layer.
  // The room view (MobileSlide) overlays it with position:absolute + z-index.
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 0,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Wraps a room view on mobile so it slides in from the right over the channel list.
 * On desktop this is a transparent pass-through.
 */
export function MobileSlide({ children }: { children: ReactNode }) {
  const screenSize = useScreenSizeContext();

  if (screenSize !== ScreenSize.Mobile) return <>{children}</>;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--background-primary)',
        overflow: 'hidden',
      }}
    >
      {children}
    </motion.div>
  );
}
