import { style, keyframes } from '@vanilla-extract/css';

const splashPulse = keyframes({
  '0%': { transform: 'scale(1)', opacity: 0.7 },
  '100%': { transform: 'scale(2)', opacity: 0 },
});

export const SplashScreen = style({
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'var(--background-secondary)',
  zIndex: 99999,
});

export const SplashCenter = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '7rem',
  height: '7rem',
});

export const PulseRing = style({
  position: 'absolute',
  inset: 0,
  borderRadius: '50%',
  backgroundColor: 'var(--brand-primary)',
  animation: `${splashPulse} 1.5s cubic-bezier(0, 0, 0.2, 1) infinite`,
});

export const Logo = style({
  position: 'relative',
  zIndex: 1,
  width: '4.5rem',
  height: '4.5rem',
  borderRadius: '30%',
  userSelect: 'none',
});

// Legacy export — keep for any imports that reference it
export const SplashScreenFooter = style({
  display: 'none',
});
