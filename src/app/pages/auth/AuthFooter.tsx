import React from 'react';
import { Box, Text } from 'folds';
import * as css from './styles.css';

export function AuthFooter() {
  return (
    <Box className={css.AuthFooter} justifyContent="Center" gap="400" wrap="Wrap">
      <Text as="a" size="T300" href="https://github.com/davifernan/BetterCord" target="_blank" rel="noreferrer">
        About
      </Text>
      <Text
        as="a"
        size="T300"
        href="https://github.com/davifernan/BetterCord/releases"
        target="_blank"
        rel="noreferrer"
      >
        v4.10.5
      </Text>
      <Text as="a" size="T300" href="https://github.com/davifernan" target="_blank" rel="noreferrer">
        GitHub
      </Text>
      <Text as="a" size="T300" href="https://matrix.org" target="_blank" rel="noreferrer">
        Powered by Matrix
      </Text>
      <Text
        as="a"
        size="T300"
        href="https://github.com/davifernan/BetterCord"
        target="_blank"
        rel="noreferrer"
      >
        Source Code
      </Text>
    </Box>
  );
}
