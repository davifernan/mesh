import { useEffect, useRef, useState, useCallback } from 'react';
import { WidgetApi, WidgetApiToWidgetAction } from 'matrix-widget-api';

export type YoutubeState = {
  videoId: string;
  playing: boolean;
  timestamp: number;
  issuedAt: number;
};

export type YoutubeCommand = {
  action: 'load' | 'play' | 'pause' | 'seek';
  videoId?: string;
  timestamp?: number;
};

export function getEffectiveTimestamp(state: YoutubeState): number {
  return state.timestamp + (Date.now() - state.issuedAt) / 1000;
}

function sanitizeCommand(cmd: YoutubeCommand): YoutubeCommand {
  if (cmd.timestamp === undefined) return cmd;

  return {
    ...cmd,
    timestamp: Math.round(cmd.timestamp),
  };
}

function toYoutubeState(content: Partial<YoutubeState> | undefined): YoutubeState | null {
  if (!content?.videoId) return null;
  return {
    videoId: content.videoId,
    playing: content.playing ?? false,
    timestamp: content.timestamp === undefined ? 0 : Math.round(content.timestamp),
    issuedAt: content.issuedAt ?? Date.now(),
  };
}

function applyCommand(cur: YoutubeState | null, cmd: YoutubeCommand): YoutubeState | null {
  if (!cur && cmd.action !== 'load') return null;

  if (cmd.action === 'play' && cur) {
    return {
      ...cur,
      playing: true,
      timestamp: cmd.timestamp ?? cur.timestamp,
      issuedAt: Date.now(),
    };
  }

  if (cmd.action === 'pause' && cur) {
    return {
      ...cur,
      playing: false,
      timestamp: cmd.timestamp ?? cur.timestamp,
      issuedAt: Date.now(),
    };
  }

  if (cmd.action === 'seek' && cur) {
    return {
      ...cur,
      timestamp: cmd.timestamp ?? cur.timestamp,
      issuedAt: Date.now(),
    };
  }

  if (cmd.action === 'load' && cmd.videoId) {
    return {
      videoId: cmd.videoId,
      playing: true,
      timestamp: 0,
      issuedAt: Date.now(),
    };
  }

  return null;
}

export function useYoutubeSync(widgetApi: WidgetApi) {
  const [state, setState] = useState<YoutubeState | null>(null);
  const stateRef = useRef<YoutubeState | null>(null);

  const applyState = useCallback((nextState: YoutubeState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const persistStateBestEffort = useCallback(
    (nextState: YoutubeState) => {
      void widgetApi.sendStateEvent('eu.mesh.apps.youtube', '', nextState).catch(() => undefined);
    },
    [widgetApi]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const events = await widgetApi.readStateEvents('eu.mesh.apps.youtube', 1);
        if (cancelled) return;
        const nextState = toYoutubeState(events[0]?.content as Partial<YoutubeState> | undefined);
        if (nextState) applyState(nextState);
      } catch {
        // No state yet — that's fine.
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [widgetApi, applyState]);

  useEffect(() => {
    const eventName = `action:${WidgetApiToWidgetAction.SendEvent}`;

    const handler = (actionEv: any) => {
      const event = actionEv?.detail?.data ?? actionEv;
      if (!event?.type) return;

      if (event.type === 'eu.mesh.apps.youtube.cmd') {
        const cmd = event.content as YoutubeCommand | undefined;
        if (!cmd?.action) return;
        const nextState = applyCommand(stateRef.current, cmd);
        if (nextState) applyState(nextState);
        return;
      }

      if (event.type === 'eu.mesh.apps.youtube' && event.state_key === '') {
        const nextState = toYoutubeState(event.content as Partial<YoutubeState> | undefined);
        if (nextState) applyState(nextState);
      }
    };

    widgetApi.on(eventName, handler);
    return () => {
      widgetApi.off(eventName, handler);
    };
  }, [widgetApi, applyState]);

  const sendCommand = useCallback(
    async (cmd: YoutubeCommand) => {
      const sanitizedCmd = sanitizeCommand(cmd);
      const nextState = applyCommand(stateRef.current, sanitizedCmd);

      await widgetApi.sendRoomEvent('eu.mesh.apps.youtube.cmd', sanitizedCmd);

      if (nextState) {
        applyState(nextState);
        persistStateBestEffort(nextState);
      }
    },
    [widgetApi, applyState, persistStateBestEffort]
  );

  return {
    state,
    sendCommand,
    getEffectiveTimestamp,
  };
}
