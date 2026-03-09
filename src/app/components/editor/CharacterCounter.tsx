import React from 'react';
import { Text } from 'folds';

const MAX_LENGTH = 32000;
const WARN_THRESHOLD = 0.8;

type CharacterCounterProps = {
  count: number;
};

export function CharacterCounter({ count }: CharacterCounterProps) {
  const ratio = count / MAX_LENGTH;
  if (ratio < WARN_THRESHOLD) return null;

  const isOver = count >= MAX_LENGTH;
  const isNear = ratio >= 0.95;

  return (
    <Text
      as="span"
      size="T200"
      style={{
        color: isOver
          ? 'var(--clr-critical-main)'
          : isNear
          ? 'var(--clr-warning-main, #f0a030)'
          : 'var(--text-secondary)',
        userSelect: 'none',
      }}
    >
      {count} / {MAX_LENGTH}
    </Text>
  );
}
