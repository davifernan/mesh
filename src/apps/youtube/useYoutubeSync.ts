import { useEffect, useRef, useState, useCallback } from 'react';
import { WidgetApi, WidgetApiToWidgetAction } from 'matrix-widget-api';

export type YoutubeState = {
  videoId: string;
  playing: boolean;
  timestamp: number;
  issuedAt: number; // Date.now() when the state was sent
};

export type YoutubeCommand = {
  action: 'load' | 'play' | 'pause' | 'seek';
  videoId?: string;
  timestamp?: number;
};

/**
 * Returns state.timestamp + elapsed seconds since issuedAt,
 * compensating for the time it takes for state to propagate.
 */
export function getEffectiveTimestamp(state: YoutubeState): number {
  return state.timestamp + (Date.now() - state.issuedAt) / 1000;
}

export function useYoutubeSync(widgetApi: WidgetApi) {
  const [state, setState] = useState<YoutubeState | null>(null);
  const stateRef = useRef<YoutubeState | null>(null);

  // Load initial state from room on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const events = await widgetApi.readStateEvents('eu.bettercord.apps.youtube', 1);
        if (cancelled) return;
        if (events && events.length > 0) {
          const content = events[0]?.content as Partial<YoutubeState> | undefined;
          if (content?.videoId) {
            const s: YoutubeState = {
              videoId: content.videoId,
              playing: content.playing ?? false,
              timestamp: content.timestamp ?? 0,
              issuedAt: content.issuedAt ?? Date.now(),
            };
            stateRef.current = s;
            setState(s);
          }
        }
      } catch {
        // No state yet — that's fine, the room is empty
      }
    }
    load();
    return () => { cancelled = true; };
  }, [widgetApi]);

  // Subscribe to live SendEvent updates (state changes + commands)
  useEffect(() => {
    const eventName = `action:${WidgetApiToWidgetAction.SendEvent}`;

    const handler = (actionEv: any) => {
      const event = actionEv?.detail?.data ?? actionEv;
      if (!event?.type) return;

      // State event: sync play state
      if (event.type === 'eu.bettercord.apps.youtube' && event.state_key === '') {
        const content = event.content as Partial<YoutubeState> | undefined;
        if (content?.videoId) {
          const s: YoutubeState = {
            videoId: content.videoId,
            playing: content.playing ?? false,
            timestamp: content.timestamp ?? 0,
            issuedAt: content.issuedAt ?? Date.now(),
          };
          stateRef.current = s;
          setState(s);
        }
      }

      // Timeline command event
      if (event.type === 'eu.bettercord.apps.youtube.cmd') {
        const cmd = event.content as YoutubeCommand | undefined;
        if (!cmd?.action) return;
        const cur = stateRef.current;
        // 'load' can initialize state even if no prior state exists
        if (!cur && cmd.action !== 'load') return;
        let updated: YoutubeState | null = null;
        if (cmd.action === 'play' && cur) {
          updated = { ...cur, playing: true, timestamp: cmd.timestamp ?? cur.timestamp, issuedAt: Date.now() };
        } else if (cmd.action === 'pause' && cur) {
          updated = { ...cur, playing: false, timestamp: cmd.timestamp ?? cur.timestamp, issuedAt: Date.now() };
        } else if (cmd.action === 'seek' && cur) {
          updated = { ...cur, timestamp: cmd.timestamp ?? cur.timestamp, issuedAt: Date.now() };
        } else if (cmd.action === 'load' && cmd.videoId) {
          updated = { videoId: cmd.videoId, playing: true, timestamp: 0, issuedAt: Date.now() };
        }
        if (updated) {
          stateRef.current = updated;
          setState(updated);
        }
      }
    };

    widgetApi.on(eventName, handler);
    return () => { widgetApi.off(eventName, handler); };
  }, [widgetApi]);

  /**
   * Send a command to all room members. Also updates shared room state for
   * load/play/pause so new joiners get the current position.
   */
  const sendCommand = useCallback(async (cmd: YoutubeCommand) => {
    // Send timeline event for real-time sync
    await widgetApi.sendRoomEvent('eu.bettercord.apps.youtube.cmd', cmd);

    // For load/play/pause also persist state so late joiners catch up
    if (cmd.action === 'load' || cmd.action === 'play' || cmd.action === 'pause') {
      const cur = stateRef.current;
      const videoId = cmd.videoId ?? cur?.videoId ?? '';
      if (!videoId) return;
      const playing = cmd.action === 'play' || cmd.action === 'load';
      const timestamp = cmd.action === 'pause'
        ? (cmd.timestamp ?? cur?.timestamp ?? 0)
        : cmd.action === 'play'
          ? (cmd.timestamp ?? cur?.timestamp ?? 0)
          : 0; // load always starts from beginning
      const newState: YoutubeState = {
        videoId,
        playing,
        timestamp,
        issuedAt: Date.now(),
      };
      await widgetApi.sendStateEvent('eu.bettercord.apps.youtube', '', newState);
      stateRef.current = newState;
      setState(newState);
    }

    // For seek, also update state timestamp
    if (cmd.action === 'seek' && cmd.timestamp !== undefined) {
      const cur = stateRef.current;
      if (cur) {
        const newState: YoutubeState = {
          ...cur,
          timestamp: cmd.timestamp,
          issuedAt: Date.now(),
        };
        await widgetApi.sendStateEvent('eu.bettercord.apps.youtube', '', newState);
        stateRef.current = newState;
        setState(newState);
      }
    }
  }, [widgetApi]);

  return {
    state,
    sendCommand,
    getEffectiveTimestamp,
  };
}
