import { useCallback, useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { useMatrixClient } from './useMatrixClient';
import { spaceUploadSettingsAtom, SpaceUploadSettings } from '../state/uploadSettings';
import { useStateEventCallback } from './useStateEventCallback';

const UPLOAD_SETTINGS_EVENT_TYPE = 'io.mesh.space.upload_settings';

function parseUploadSettings(content: Record<string, unknown>): SpaceUploadSettings {
  return {
    maxFileSizeBytes: typeof content.maxFileSizeBytes === 'number' ? content.maxFileSizeBytes : 0,
  };
}

/**
 * Loads `io.mesh.space.upload_settings` state from the given space room
 * and keeps `spaceUploadSettingsAtom` in sync. Call this once per space view.
 */
export function useSpaceUploadSettings(spaceId: string | undefined) {
  const mx = useMatrixClient();
  const setSpaceUploadSettings = useSetAtom(spaceUploadSettingsAtom);

  const loadSettings = useCallback(() => {
    if (!spaceId) {
      setSpaceUploadSettings(null);
      return;
    }
    const room = mx.getRoom(spaceId);
    if (!room) {
      setSpaceUploadSettings(null);
      return;
    }
    const stateEvent = room.currentState.getStateEvents(UPLOAD_SETTINGS_EVENT_TYPE, '');
    if (!stateEvent) {
      setSpaceUploadSettings(null);
      return;
    }
    setSpaceUploadSettings(parseUploadSettings(stateEvent.getContent<Record<string, unknown>>()));
  }, [mx, spaceId, setSpaceUploadSettings]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useStateEventCallback(
    mx,
    useCallback(
      (event) => {
        if (
          event.getRoomId() === spaceId &&
          event.getType() === UPLOAD_SETTINGS_EVENT_TYPE
        ) {
          loadSettings();
        }
      },
      [spaceId, loadSettings]
    )
  );
}
