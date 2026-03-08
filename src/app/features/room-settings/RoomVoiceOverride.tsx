import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Chip,
  Icon,
  IconButton,
  Icons,
  Scroll,
  Spinner,
  Text,
  color,
} from 'folds';
import { MatrixError } from 'matrix-js-sdk';
import { Page, PageContent, PageHeader } from '../../components/page';
import { useRoom } from '../../hooks/useRoom';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { usePowerLevels, readPowerLevel } from '../../hooks/usePowerLevels';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';

const CHANNEL_AV_EVENT = 'io.bettercord.channel.av_override';

type MaxVideoRes = '360p' | '480p' | '720p' | '1080p' | 'none';
type MaxSSRes = '720p' | '1080p' | '1440p' | '4k' | 'none';
type MaxSSFps = 5 | 15 | 30 | 60 | 'none';

const VIDEO_RES_OPTIONS: MaxVideoRes[] = ['360p', '480p', '720p', '1080p', 'none'];
const SS_RES_OPTIONS: MaxSSRes[] = ['720p', '1080p', '1440p', '4k', 'none'];
const SS_FPS_OPTIONS: MaxSSFps[] = [5, 15, 30, 60, 'none'];

type RoomVoiceOverrideProps = {
  requestClose: () => void;
};

export function RoomVoiceOverride({ requestClose }: RoomVoiceOverrideProps) {
  const mx = useMatrixClient();
  const room = useRoom();
  const powerLevels = usePowerLevels(room);
  const creators = useRoomCreators(room);

  const userId = mx.getSafeUserId();
  const userPower = readPowerLevel.user(powerLevels, userId);
  const requiredPower = readPowerLevel.state(powerLevels, CHANNEL_AV_EVENT);
  const isCreator = creators.has(userId);
  const canEdit = isCreator || userPower >= requiredPower;

  // Read existing override from room state
  const existingEvent = room.currentState.getStateEvents(CHANNEL_AV_EVENT, '');
  const existingContent = existingEvent?.getContent<Record<string, unknown>>() ?? {};

  const toVideoRes = (v: unknown): MaxVideoRes => {
    if (v === '360p' || v === '480p' || v === '720p' || v === '1080p') return v;
    return 'none';
  };
  const toSSRes = (v: unknown): MaxSSRes => {
    if (v === '720p' || v === '1080p' || v === '1440p' || v === '4k') return v;
    return 'none';
  };
  const toSSFps = (v: unknown): MaxSSFps => {
    if (v === 5 || v === 15 || v === 30 || v === 60) return v;
    return 'none';
  };

  const [maxVideoRes, setMaxVideoRes] = useState<MaxVideoRes>(() =>
    toVideoRes(existingContent.maxVideoResolution)
  );
  const [maxSSRes, setMaxSSRes] = useState<MaxSSRes>(() =>
    toSSRes(existingContent.maxSSResolution)
  );
  const [maxSSFps, setMaxSSFps] = useState<MaxSSFps>(() =>
    toSSFps(existingContent.maxSSFps)
  );

  const buildContent = useCallback((): Record<string, unknown> => {
    const content: Record<string, unknown> = {};
    if (maxVideoRes !== 'none') content.maxVideoResolution = maxVideoRes;
    if (maxSSRes !== 'none') content.maxSSResolution = maxSSRes;
    if (maxSSFps !== 'none') content.maxSSFps = maxSSFps;
    return content;
  }, [maxVideoRes, maxSSRes, maxSSFps]);

  const [saveState, save] = useAsyncCallback(
    useCallback(async () => {
      await mx.sendStateEvent(room.roomId, CHANNEL_AV_EVENT as any, buildContent(), '');
    }, [mx, room.roomId, buildContent])
  );

  const isSaving = saveState.status === AsyncStatus.Loading;
  const saveError =
    saveState.status === AsyncStatus.Error
      ? (saveState.error as MatrixError).message
      : undefined;

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" as="h1" truncate>
              Voice Override
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
            {!canEdit ? (
              <Box direction="Column" gap="400">
                <Text priority="400">
                  You do not have permission to edit voice overrides for this channel.
                </Text>
              </Box>
            ) : (
              <Box direction="Column" gap="700">
                <Box direction="Column" gap="200">
                  <Text size="L400">VOICE OVERRIDE</Text>
                  <Text size="T300" priority="300">
                    Per-channel AV caps override the space-level limits. Select
                    &quot;none&quot; to remove a restriction.
                  </Text>
                </Box>

                {/* Max Camera Resolution */}
                <Box direction="Column" gap="200">
                  <Text size="T300">Max Camera Resolution</Text>
                  <Box gap="200" wrap="Wrap">
                    {VIDEO_RES_OPTIONS.map((opt) => (
                      <Chip
                        key={String(opt)}
                        variant={maxVideoRes === opt ? 'Primary' : 'SurfaceVariant'}
                        radii="300"
                        onClick={() => setMaxVideoRes(opt)}
                        aria-pressed={maxVideoRes === opt}
                      >
                        <Text size="T300">{opt === 'none' ? 'No limit' : opt}</Text>
                      </Chip>
                    ))}
                  </Box>
                </Box>

                {/* Max Screenshare Resolution */}
                <Box direction="Column" gap="200">
                  <Text size="T300">Max Screenshare Resolution</Text>
                  <Box gap="200" wrap="Wrap">
                    {SS_RES_OPTIONS.map((opt) => (
                      <Chip
                        key={String(opt)}
                        variant={maxSSRes === opt ? 'Primary' : 'SurfaceVariant'}
                        radii="300"
                        onClick={() => setMaxSSRes(opt)}
                        aria-pressed={maxSSRes === opt}
                      >
                        <Text size="T300">{opt === 'none' ? 'No limit' : opt}</Text>
                      </Chip>
                    ))}
                  </Box>
                </Box>

                {/* Max Screenshare FPS */}
                <Box direction="Column" gap="200">
                  <Text size="T300">Max Screenshare FPS</Text>
                  <Box gap="200" wrap="Wrap">
                    {SS_FPS_OPTIONS.map((opt) => (
                      <Chip
                        key={String(opt)}
                        variant={maxSSFps === opt ? 'Primary' : 'SurfaceVariant'}
                        radii="300"
                        onClick={() => setMaxSSFps(opt)}
                        aria-pressed={maxSSFps === opt}
                      >
                        <Text size="T300">{opt === 'none' ? 'No limit' : `${opt} fps`}</Text>
                      </Chip>
                    ))}
                  </Box>
                </Box>

                {saveError && (
                  <Text style={{ color: color.Critical.Main }} size="T200">
                    {saveError}
                  </Text>
                )}

                <Box gap="300">
                  <Button
                    variant="Primary"
                    fill="Solid"
                    radii="300"
                    disabled={isSaving}
                    onClick={save}
                    before={isSaving && <Spinner size="100" variant="Primary" fill="Solid" />}
                  >
                    <Text size="B300">Save</Text>
                  </Button>
                </Box>
              </Box>
            )}
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
