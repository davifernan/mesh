import React from 'react';
import { Box, Text } from 'folds';
import { Page } from '../../components/page';

export function WelcomePage() {
  return (
    <Page>
      <Box
        grow="Yes"
        alignItems="Center"
        justifyContent="Center"
        direction="Column"
        style={{ gap: '1.5rem', padding: '2rem', textAlign: 'center' }}
      >
        {/* BetterCord logo mark — squircle, same design as auth page */}
        <div
          style={{
            width: '5rem',
            height: '5rem',
            borderRadius: '30%',
            backgroundColor: 'var(--brand-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#ffffff',
            letterSpacing: '-0.02em',
            flexShrink: 0,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          BC
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Text
            size="H4"
            style={{
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '1.375rem',
              margin: 0,
            }}
          >
            Welcome to BetterCord
          </Text>
          <Text
            size="T300"
            style={{
              color: 'var(--text-tertiary)',
              maxWidth: '32ch',
              lineHeight: '1.5',
              margin: '0 auto',
            }}
          >
            Select a channel from the left to start chatting, or join a community to get started.
          </Text>
        </div>

        {/* Privacy badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '9999px',
            backgroundColor: 'var(--background-modifier-hover)',
            border: '1px solid var(--background-modifier-accent)',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--status-online)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <Text
            size="T200"
            style={{
              color: 'var(--text-tertiary)',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            End-to-end encrypted · Privacy first · Open source
          </Text>
        </div>
      </Box>
    </Page>
  );
}
