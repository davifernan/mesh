import { style } from '@vanilla-extract/css';

/* === BetterCord Auth Layout ===
   - Full-screen brand-purple background
   - Split card: 33% logo side | 67% form side
   - border-radius: 1rem on card
*/

export const AuthLayout = style({
  minHeight: '100%',
  backgroundColor: 'var(--brand-primary)',
  backgroundImage: `
    radial-gradient(circle at 20% 20%, rgba(255,255,255,0.04) 0%, transparent 60%),
    radial-gradient(circle at 80% 80%, rgba(0,0,0,0.15) 0%, transparent 50%)
  `,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem',
  gap: '1rem',
  position: 'relative',
  overflow: 'hidden',
});

export const AuthCard = style({
  display: 'flex',
  flexDirection: 'row',
  width: '100%',
  maxWidth: '56rem',
  minHeight: '500px',
  backgroundColor: 'var(--background-header-primary)',
  borderRadius: '1rem',
  boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.4)',
  overflow: 'hidden',
  border: '1px solid var(--background-modifier-accent)',

  '@media': {
    '(max-width: 768px)': {
      flexDirection: 'column',
      maxWidth: '28rem',
      minHeight: 'unset',
    },
  },
});

/* Left side: 33% — logo, brand name, tagline */
export const AuthLogoSide = style({
  width: '33.333%',
  flexShrink: 0,
  padding: '3rem 2rem',
  borderRight: '1px solid var(--background-modifier-accent)',
  backgroundColor: 'var(--background-secondary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',

  '@media': {
    '(max-width: 768px)': {
      width: '100%',
      borderRight: 'none',
      borderBottom: '1px solid var(--background-modifier-accent)',
      padding: '2rem',
    },
  },
});

export const AuthLogoContent = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1rem',
  textAlign: 'center',
});

/* The squircle BetterCord logo mark */
export const AuthLogoMark = style({
  width: '7rem',
  height: '7rem',
  borderRadius: '30%',
  backgroundColor: 'var(--brand-primary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.75rem',
  fontWeight: '700',
  color: '#ffffff',
  letterSpacing: '-0.02em',
  flexShrink: 0,
  marginBottom: '0.25rem',
  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
});

export const AuthBrandName = style({
  fontSize: '1.25rem',
  fontWeight: '700',
  color: 'var(--text-primary)',
  margin: 0,
  letterSpacing: '-0.01em',
});

export const AuthTagline = style({
  fontSize: '0.8125rem',
  color: 'var(--text-tertiary)',
  margin: 0,
  lineHeight: '1.4',
  maxWidth: '18ch',
});

/* Right side: 67% — server picker + auth form */
export const AuthCardContent = style({
  flex: 1,
  backgroundColor: 'var(--background-header-primary)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  overflowY: 'auto',
  padding: '3rem',
  gap: '2rem',

  '@media': {
    '(max-width: 768px)': {
      padding: '2rem',
    },
  },
});

/* Kept for compatibility — no longer renders */
export const AuthLogo = style({ display: 'none' });
export const AuthHeader = style({ display: 'none' });

export const AuthFooter = style({
  padding: '0.5rem',
  color: 'var(--text-primary)',
  opacity: 0.7,
  fontSize: '0.75rem',
  textAlign: 'center',
});
