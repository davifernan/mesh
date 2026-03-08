import { useCallback, useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { useMatrixClient } from './useMatrixClient';
import { channelAVOverrideAtom, ChannelAVOverride } from '../state/avQuality';
import { useStateEventCallback } from './useStateEventCallback';

const CHANNEL_AV_EVENT = 'io.bettercord.channel.av_override';

function parseChannelAVOverride(
  content: Record<string, unknown>
): ChannelAVOverride | null {
  if (Object.keys(content).length === 0) return null;
  const override: ChannelAVOverride = {};
  if (typeof content.maxSSResolution === 'string') {
    override.maxSSResolution = content.maxSSResolution;
  }
  if (typeof content.maxSSFps === 'number') {
    override.maxSSFps = content.maxSSFps;
  }
  if (typeof content.maxVideoBitrate === 'number') {
    override.maxVideoBitrate = content.maxVideoBitrate;
  }
  if (typeof content.maxParticipants === 'number') {
    override.maxParticipants = content.maxParticipants;
  }
  if (typeof content.displayLabel === 'string') {
    override.displayLabel = content.displayLabel;
  }
  return Object.keys(override).length > 0 ? override : null;
}

/**
 * Reads `io.bettercord.channel.av_override` state from the given room and
 * keeps `channelAVOverrideAtom` in sync reactively.
 * Call this once per active call room (e.g. inside CallProvider).
 */
export function useChannelAVOverride(roomId: string | null): void {
  const mx = useMatrixClient();
  const setOverride = useSetAtom(channelAVOverrideAtom);

  const loadOverride = useCallback(() => {
    if (!roomId) {
      setOverride(null);
      return;
    }
    const room = mx.getRoom(roomId);
    if (!room) {
      setOverride(null);
      return;
    }
    const stateEvent = room.currentState.getStateEvents(CHANNEL_AV_EVENT, '');
    if (!stateEvent) {
      setOverride(null);
      return;
    }
    setOverride(parseChannelAVOverride(stateEvent.getContent<Record<string, unknown>>()));
  }, [mx, roomId, setOverride]);

  // Initial load + re-run when roomId changes
  useEffect(() => {
    loadOverride();
    // On unmount or roomId change, clear the atom
    return () => {
      setOverride(null);
    };
  }, [loadOverride, setOverride]);

  // Live updates via Matrix room state listener
  useStateEventCallback(
    mx,
    useCallback(
      (event) => {
        if (
          event.getRoomId() === roomId &&
          event.getType() === CHANNEL_AV_EVENT
        ) {
          loadOverride();
        }
      },
      [roomId, loadOverride]
    )
  );
}
