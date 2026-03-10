import React from 'react';
import { Box, Icon, IconButton, Icons, Scroll, Switch, Text } from 'folds';
import { Page, PageContent, PageHeader } from '../../../components/page';
import { SequenceCard } from '../../../components/sequence-card';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { SettingTile } from '../../../components/setting-tile';
import { SequenceCardStyle } from '../styles.css';

type RoomsProps = {
  requestClose: () => void;
};

export function Rooms({ requestClose }: RoomsProps) {
  const [autoJoinSpaceRooms, setAutoJoinSpaceRooms] = useSetting(
    settingsAtom,
    'autoJoinSpaceRooms'
  );

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text as="h1" size="H3" truncate>
              Rooms
            </Text>
          </Box>
          <Box shrink="No">
            <IconButton onClick={requestClose} variant="Surface" aria-label="Close">
              <Icon src={Icons.Cross} />
            </IconButton>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <Box direction="Column" gap="100">
                <Text size="L400">Community</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                  gap="400"
                >
                  <SettingTile
                    title="Auto-Subscribe to Rooms"
                    description="Automatically join all public rooms when you join a community. You can leave individual rooms at any time."
                    after={
                      <Switch
                        value={autoJoinSpaceRooms}
                        onChange={setAutoJoinSpaceRooms}
                      />
                    }
                  />
                </SequenceCard>
              </Box>
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
