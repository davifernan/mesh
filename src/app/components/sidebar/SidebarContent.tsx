import React, { ReactNode } from 'react';
import { Box } from 'folds';

type SidebarContentProps = {
  scrollable: ReactNode;
  sticky: ReactNode;
};
export function SidebarContent({ scrollable, sticky }: SidebarContentProps) {
  return (
    <>
      <Box direction="Column" grow="Yes" style={{ minHeight: 0 }}>
        {scrollable}
      </Box>
      <Box direction="Column" shrink="No" style={{ marginBottom: 'var(--bc-bottom-dock-height, 0px)' }}>
        {sticky}
      </Box>
    </>
  );
}
