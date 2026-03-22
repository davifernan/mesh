import React from 'react';
import { Box, Text } from 'folds';
import * as css from './styles.css';

export function AuthFooter() {
  return (
    <Box className={css.AuthFooter} justifyContent="Center" gap="400" wrap="Wrap">
      <Text as="a" size="T300" href="https://hostmesh.diy" target="_blank" rel="noreferrer">
        hostmesh.diy
      </Text>
      <Text as="a" size="T300" href="https://github.com/davifernan/mesh" target="_blank" rel="noreferrer">
        GitHub
      </Text>
      <Text
        as="a"
        size="T300"
        href="https://github.com/davifernan/mesh/releases"
        target="_blank"
        rel="noreferrer"
      >
        v4.10.5
      </Text>
      <Text as="a" size="T300" href="https://matrix.org" target="_blank" rel="noreferrer">
        Powered by Matrix
      </Text>
    </Box>
  );
}
