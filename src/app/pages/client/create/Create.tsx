import React from 'react';
import { Box, Icon, Icons, Scroll, Text } from 'folds';
import {
  Page,
  PageContent,
  PageContentCenter,
  PageHeroSection,
} from '../../../components/page';
import { CreateSpaceForm } from '../../../features/create-space';
import { useRoomNavigate } from '../../../hooks/useRoomNavigate';

export function Create() {
  const { navigateSpace } = useRoomNavigate();

  return (
    <Page>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <PageContentCenter>
              <PageHeroSection>
                <Box direction="Column" gap="700">
                  {/* Fluxer-style header */}
                  <Box direction="Column" gap="200" alignItems="Center" style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        width: '4rem',
                        height: '4rem',
                        borderRadius: '30%',
                        backgroundColor: 'var(--brand-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '0.5rem',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size="400" src={Icons.Space} style={{ color: '#ffffff' }} />
                    </div>
                    <Text
                      size="H3"
                      style={{
                        color: 'var(--text-primary)',
                        fontWeight: 700,
                        fontSize: '1.5rem',
                        margin: 0,
                      }}
                    >
                      Create a Community
                    </Text>
                    <Text
                      size="T300"
                      style={{
                        color: 'var(--text-tertiary)',
                        maxWidth: '40ch',
                        lineHeight: '1.5',
                        margin: '0 auto',
                      }}
                    >
                      Your community is where you and your friends hang out. Make yours and start talking.
                    </Text>
                  </Box>
                  <CreateSpaceForm onCreate={navigateSpace} />
                </Box>
              </PageHeroSection>
            </PageContentCenter>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
