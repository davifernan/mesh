import { keyframes, style } from '@vanilla-extract/css';
import { DefaultReset, color, config } from 'folds';

const FadeSlideAnime = keyframes({
  from: {
    opacity: 0,
    transform: 'translateY(4px)',
  },
  to: {
    opacity: 1,
    transform: 'translateY(0)',
  },
});

export const RoomViewTyping = style([
  DefaultReset,
  {
    padding: `${config.space.S100} ${config.space.S500}`,
    width: '100%',
    backgroundColor: color.Surface.Container,
    color: color.Surface.OnContainer,
    animation: `${FadeSlideAnime} 120ms ease-out`,
  },
]);
export const TypingText = style({
  flexGrow: 1,
});

export const RoomViewTypingPlaceholder = style([
  DefaultReset,
  {
    padding: `${config.space.S100} ${config.space.S500}`,
    width: '100%',
  },
]);
