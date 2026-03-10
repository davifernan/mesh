import { keyframes } from '@vanilla-extract/css';
import { recipe } from '@vanilla-extract/recipes';
import { DefaultReset, toRem } from 'folds';

const TypingDotAnime = keyframes({
  '0%, 100%': {
    opacity: 0.4,
    transform: 'translateY(0)',
  },
  '45%': {
    opacity: 1,
    transform: 'translateY(-3px)',
  },
});

export const TypingDot = recipe({
  base: [
    DefaultReset,
    {
      display: 'inline-block',
      backgroundColor: 'var(--text-secondary)',
      borderRadius: '50%',
      opacity: 0.5,
    },
  ],
  variants: {
    animated: {
      true: {
        animation: `${TypingDotAnime} 1.2s ease-in-out infinite`,
      },
    },
    size: {
      '300': {
        width: toRem(4),
        height: toRem(4),
      },
      '400': {
        width: toRem(5),
        height: toRem(5),
      },
    },
    index: {
      '0': {
        animationDelay: '0s',
      },
      '1': {
        animationDelay: '0.2s',
      },
      '2': {
        animationDelay: '0.4s',
      },
    },
  },
  defaultVariants: {
    size: '400',
    animated: true,
  },
});
