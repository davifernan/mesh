import { useCallback, useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { RoomStateEvent } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';
import { spaceAVSettingsAtom, SpaceAVSettings } from '../state/avQuality';
import { useStateEventCallback } from './useStateEventCallback';

const AV_SETTINGS_EVENT_TYPE = 'io.bettercord.space.av_settings';

function parseAVSettings(content: Record<string, unknown>): SpaceAVSettings {
  return {
    maxAudioBitrate: (content.maxAudioBitrate as SpaceAVSettings['maxAudioBitrate']) ?? 510,
    maxVideoResolution:
      (content.maxVideoResolution as SpaceAVSettings['maxVideoResolution']) ?? '1080p',
    maxVideoFps: (content.maxVideoFps as SpaceAVSettings['maxVideoFps']) ?? 30,
    maxSSResolution: (content.maxSSResolution as SpaceAVSettings['maxSSResolution']) ?? 'source',
    maxSSFps: (content.maxSSFps as SpaceAVSettings['maxSSFps']) ?? 60,
    maxParticipants: (content.maxParticipants as number) ?? 100,
  };
}

/**
 * Loads `io.bettercord.space.av_settings` state from the given space room
 * and keeps `spaceAVSettingsAtom` in sync. Call this once per space view.
 */
export function useSpaceAVSettings(spaceId: string | undefined) {
  const mx = useMatrixClient();
  const setSpaceAVSettings = useSetAtom(spaceAVSettingsAtom);

  const loadSettings = useCallback(() => {
    if (!spaceId) {
      setSpaceAVSettings(null);
      return;
    }
    const room = mx.getRoom(spaceId);
    if (!room) {
      setSpaceAVSettings(null);
      return;
    }
    const stateEvent = room.currentState.getStateEvents(AV_SETTINGS_EVENT_TYPE, '');
    if (!stateEvent) {
      setSpaceAVSettings(null);
      return;
    }
    setSpaceAVSettings(parseAVSettings(stateEvent.getContent<Record<string, unknown>>()));
  }, [mx, spaceId, setSpaceAVSettings]);

  // Initial load
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Live updates via Matrix state event listener
  useStateEventCallback(
    mx,
    useCallback(
      (event) => {
        if (
          event.getRoomId() === spaceId &&
          event.getType() === AV_SETTINGS_EVENT_TYPE
        ) {
          loadSettings();
        }
      },
      [spaceId, loadSettings]
    )
  );
}
