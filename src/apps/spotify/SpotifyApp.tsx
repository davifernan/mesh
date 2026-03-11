import React, { useCallback, useEffect, useRef, useState } from 'react';
import { WidgetApi, WidgetApiToWidgetAction } from 'matrix-widget-api';

interface Props {
  widgetApi: WidgetApi;
}

interface SpotifyStateContent {
  embedUrl: string;
  addedBy: string;
  updatedAt: number;
}

interface SpotifyCommandContent extends SpotifyStateContent {
  action: 'load';
}

type SpotifyContentType = 'track' | 'album' | 'playlist' | 'episode' | 'artist' | null;

const SPOTIFY_TYPES = ['track', 'album', 'playlist', 'episode', 'artist'] as const;

function toSpotifyEmbedUrl(input: string): string | null {
  try {
    const trimmed = input.trim();

    if (trimmed.startsWith('spotify:')) {
      const parts = trimmed.slice('spotify:'.length).split(':');
      if (parts.length >= 2) {
        const type = parts[0];
        const id = parts[1];
        if (SPOTIFY_TYPES.includes(type as (typeof SPOTIFY_TYPES)[number])) {
          return `https://open.spotify.com/embed/${type}/${id}`;
        }
      }
      return null;
    }

    const url = new URL(trimmed);
    if (!url.hostname.endsWith('spotify.com')) return null;

    let parts = url.pathname.split('/').filter(Boolean);

    if (parts.length > 0 && /^intl-[a-z]+$/i.test(parts[0])) {
      parts = parts.slice(1);
    }

    if (parts[0] === 'embed' && parts.length >= 3) {
      const type = parts[1];
      if (SPOTIFY_TYPES.includes(type as (typeof SPOTIFY_TYPES)[number])) {
        return `https://open.spotify.com/embed/${parts[1]}/${parts[2]}`;
      }
      return null;
    }

    if (parts.length >= 2) {
      const type = parts[0];
      if (SPOTIFY_TYPES.includes(type as (typeof SPOTIFY_TYPES)[number])) {
        return `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function toSpotifyState(content: Partial<SpotifyStateContent> | undefined): SpotifyStateContent | null {
  if (!content?.embedUrl) return null;
  return {
    embedUrl: content.embedUrl,
    addedBy: content.addedBy ?? '',
    updatedAt: content.updatedAt ?? Date.now(),
  };
}

function getContentType(embedUrl: string | null): SpotifyContentType {
  if (!embedUrl) return null;
  try {
    const url = new URL(embedUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'embed' && parts.length >= 2) {
      return parts[1] as SpotifyContentType;
    }
  } catch {
    // ignore
  }
  return null;
}

function formatContentLabel(type: SpotifyContentType): string {
  switch (type) {
    case 'track': return 'Track';
    case 'album': return 'Album';
    case 'playlist': return 'Playlist';
    case 'episode': return 'Podcast episode';
    case 'artist': return 'Artist';
    default: return 'Content';
  }
}

const S = {
  root: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    height: '100vh',
    background: '#121212',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#b3b3b3',
    overflow: 'hidden',
  },
  iframeWrapper: {
    flexGrow: 1,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  iframe: {
    border: 'none',
    width: '100%',
    height: '100%',
    flexGrow: 1,
    display: 'block' as const,
  },
  emptyState: {
    flexGrow: 1,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 12,
    padding: 32,
    textAlign: 'center' as const,
  },
  emptyIcon: {
    fontSize: 56,
    lineHeight: 1,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#ffffff',
    margin: 0,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6a6a6a',
    margin: 0,
  },
  bottomBar: {
    flexShrink: 0,
    height: 64,
    background: '#181818',
    borderTop: '1px solid #282828',
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: 10,
    padding: '0 14px',
  },
  metaLabel: {
    fontSize: 12,
    color: '#6a6a6a',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 160,
    flexShrink: 0,
  },
  urlInput: {
    flex: 1,
    minWidth: 0,
    height: 34,
    background: '#2a2a2a',
    border: '1px solid #3a3a3a',
    borderRadius: 4,
    color: '#e0e0e0',
    fontSize: 13,
    padding: '0 10px',
    outline: 'none',
  },
  loadBtn: {
    flexShrink: 0,
    height: 34,
    padding: '0 16px',
    background: '#1db954',
    border: 'none',
    borderRadius: 4,
    color: '#000000',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  errorText: {
    fontSize: 11,
    color: '#e05252',
    flexShrink: 0,
    maxWidth: 180,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
} as const;

export function SpotifyApp({ widgetApi }: Props) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [addedBy, setAddedBy] = useState<string>('');
  const [urlInput, setUrlInput] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const stateRef = useRef<SpotifyStateContent | null>(null);
  const currentUserId = new URLSearchParams(window.location.search).get('userId') ?? 'you';

  const applyState = useCallback((nextState: SpotifyStateContent) => {
    const current = stateRef.current;
    if (current && current.updatedAt > nextState.updatedAt) return;

    stateRef.current = nextState;
    setEmbedUrl(nextState.embedUrl);
    setAddedBy(nextState.addedBy);
    setSendError(null);
  }, []);

  const persistStateBestEffort = useCallback(
    (nextState: SpotifyStateContent) => {
      void widgetApi.sendStateEvent('eu.bettercord.apps.spotify', '', nextState).catch(() => undefined);
    },
    [widgetApi]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const events = await widgetApi.readStateEvents('eu.bettercord.apps.spotify', 1);
        if (cancelled) return;
        const nextState = toSpotifyState(events[0]?.content as Partial<SpotifyStateContent> | undefined);
        if (nextState) applyState(nextState);
      } catch {
        // State event not found yet — that's fine.
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

      if (event.type === 'eu.bettercord.apps.spotify.cmd') {
        const cmd = event.content as Partial<SpotifyCommandContent> | undefined;
        if (cmd?.action !== 'load') return;
        const nextState = toSpotifyState(cmd);
        if (nextState) applyState(nextState);
        return;
      }

      if (event.type === 'eu.bettercord.apps.spotify') {
        const nextState = toSpotifyState(event.content as Partial<SpotifyStateContent> | undefined);
        if (nextState) applyState(nextState);
      }
    };

    widgetApi.on(eventName, handler);
    return () => {
      widgetApi.off(eventName, handler);
    };
  }, [widgetApi, applyState]);

  const handleLoad = useCallback(async () => {
    const normalized = toSpotifyEmbedUrl(urlInput);
    if (!normalized) {
      setSendError('Invalid Spotify URL');
      return;
    }

    const nextState: SpotifyStateContent = {
      embedUrl: normalized,
      addedBy: currentUserId,
      updatedAt: Date.now(),
    };

    setSending(true);
    setSendError(null);

    try {
      await widgetApi.sendRoomEvent('eu.bettercord.apps.spotify.cmd', {
        action: 'load',
        ...nextState,
      } satisfies SpotifyCommandContent);
      applyState(nextState);
      setUrlInput('');
      persistStateBestEffort(nextState);
    } catch (err: any) {
      const msg = String(err?.message ?? err ?? '');
      setSendError(msg ? `Failed to sync: ${msg}` : 'Failed to sync Spotify link');
    } finally {
      setSending(false);
    }
  }, [urlInput, currentUserId, widgetApi, applyState, persistStateBestEffort]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleLoad();
    },
    [handleLoad]
  );

  const contentType = getContentType(embedUrl);

  const bottomBar = (
    <div style={S.bottomBar}>
      {embedUrl && (
        <span style={S.metaLabel} title={addedBy ? `Changed by ${addedBy}` : undefined}>
          {formatContentLabel(contentType)}
          {addedBy ? ` · ${addedBy}` : ''}
        </span>
      )}
      <input
        style={S.urlInput}
        type="text"
        placeholder="Paste Spotify track / album / playlist URL…"
        value={urlInput}
        onChange={(e) => {
          setUrlInput(e.target.value);
          setSendError(null);
        }}
        onKeyDown={handleKeyDown}
        disabled={sending}
        aria-label="Spotify URL input"
      />
      <button
        style={{
          ...S.loadBtn,
          opacity: sending ? 0.6 : 1,
          cursor: sending ? 'not-allowed' : 'pointer',
        }}
        onClick={handleLoad}
        disabled={sending}
      >
        {sending ? '…' : 'Load'}
      </button>
      {sendError && <span style={S.errorText} title={sendError}>{sendError}</span>}
    </div>
  );

  if (!embedUrl) {
    return (
      <div style={S.root}>
        <div style={S.emptyState}>
          <div style={S.emptyIcon}>🎵</div>
          <p style={S.emptyTitle}>No track loaded</p>
          <p style={S.emptySubtitle}>
            Paste a Spotify link below to share music with the room
          </p>
        </div>
        {bottomBar}
      </div>
    );
  }

  return (
    <div style={S.root}>
      <div style={S.iframeWrapper}>
        <iframe
          src={embedUrl}
          width="100%"
          height="100%"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          style={S.iframe}
          title="Spotify player"
        />
      </div>
      {bottomBar}
    </div>
  );
}
