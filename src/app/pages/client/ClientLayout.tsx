import React, { ReactNode } from 'react';
import { Box } from 'folds';

type ClientLayoutProps = {
  nav: ReactNode;
  children: ReactNode;
};
export function ClientLayout({ nav, children }: ClientLayoutProps) {
  return (
    <Box grow="Yes" className="bc-app-shell">
      <Box shrink="No" style={{ height: '100%' }}>
        {nav}
      </Box>
      <Box
        grow="Yes"
        className="bc-content"
        style={{ overflowX: 'visible', overflowY: 'hidden' }}
      >
        {children}
      </Box>
    </Box>
  );
}
