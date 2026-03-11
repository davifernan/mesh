import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WidgetApi } from 'matrix-widget-api';
import { useYoutubeSync, YoutubeState } from './useYoutubeSync';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface Props {
  widgetApi: WidgetApi;
}

/** Extract videoId from various YouTube URL formats or return raw string if already an ID */
function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  // Already a bare videoId (11 chars, alphanumeric + -_)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    // youtu.be/ID
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0];
      if (id) return id;
    }
    // youtube.com/watch?v=ID
    const v = url.searchParams.get('v');
    if (v) return v;
    // youtube.com/shorts/ID or youtube.com/embed/ID
    const parts = url.pathname.split('/').filter(Boolean);
    const shortIdx = parts.indexOf('shorts');
    const embedIdx = parts.indexOf('embed');
    if (shortIdx !== -1 && parts[shortIdx + 1]) return parts[shortIdx + 1];
    if (embedIdx !== -1 && parts[embedIdx + 1]) return parts[embedIdx + 1];
  } catch {
    // Not a URL
  }
  return null;
}

export function YoutubeApp({ widgetApi }: Props) {
  const { state, sendCommand, getEffectiveTimestamp } = useYoutubeSync(widgetApi);

  const playerRef = useRef<any>(null);
  const playerReadyRef = useRef(false);
  const isSyncingRef = useRef(false);
  const lastStateRef = useRef<YoutubeState | null>(null);

  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [playerTitle, setPlayerTitle] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [duration, setDuration] = useState(0);
  const seekIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Inject YT IFrame API script once
  useEffect(() => {
    if (window.YT && window.YT.Player) return;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }, []);

  // Initialize YT Player once API is ready
  useEffect(() => {
    const init = () => {
      if (playerRef.current) return;
      playerRef.current = new window.YT.Player('yt-player', {
        width: '100%',
        height: '100%',
        videoId: '',
        playerVars: {
          enablejsapi: 1,
          origin: window.location.origin,
          autoplay: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            playerReadyRef.current = true;
            // Apply current state if already loaded
            if (lastStateRef.current) {
              applyState(lastStateRef.current);
            }
          },
          onStateChange: (event: any) => {
            if (isSyncingRef.current) return;
            const YT_PLAYING = 1;
            const YT_PAUSED = 2;
            const YT_ENDED = 0;
            if (event.data === YT_PLAYING) {
              setIsPlaying(true);
              const d = playerRef.current?.getDuration?.() ?? 0;
              setDuration(d);
              try {
                const title = playerRef.current?.getVideoData?.()?.title ?? '';
                setPlayerTitle(title);
              } catch { /* ignore */ }
              sendCommand({
                action: 'play',
                timestamp: playerRef.current?.getCurrentTime?.() ?? 0,
              }).catch(() => {
                showToast('Failed to sync playback');
              });
            } else if (event.data === YT_PAUSED) {
              setIsPlaying(false);
              const ts = playerRef.current?.getCurrentTime?.() ?? 0;
              sendCommand({ action: 'pause', timestamp: ts }).catch(() => {
                showToast('Failed to sync playback');
              });
            } else if (event.data === YT_ENDED) {
              setIsPlaying(false);
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      init();
    } else {
      window.onYouTubeIframeAPIReady = init;
    }

    return () => {
      if (seekIntervalRef.current) clearInterval(seekIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track seek position
  useEffect(() => {
    seekIntervalRef.current = setInterval(() => {
      if (!playerReadyRef.current || !playerRef.current) return;
      const t = playerRef.current?.getCurrentTime?.() ?? 0;
      setSeekValue(t);
    }, 1000);
    return () => {
      if (seekIntervalRef.current) clearInterval(seekIntervalRef.current);
    };
  }, []);

  const applyState = useCallback((s: YoutubeState) => {
    if (!playerReadyRef.current || !playerRef.current) return;
    isSyncingRef.current = true;

    const effectiveTs = getEffectiveTimestamp(s);

    try {
      playerRef.current.loadVideoById({
        videoId: s.videoId,
        startSeconds: effectiveTs,
      });
      // Give the player a moment to load before seeking/playing
      setTimeout(() => {
        if (!playerRef.current) return;
        try {
          playerRef.current.seekTo(effectiveTs, true);
          if (s.playing) {
            playerRef.current.playVideo();
          } else {
            playerRef.current.pauseVideo();
          }
          const d = playerRef.current.getDuration?.() ?? 0;
          setDuration(d);
          try {
            const title = playerRef.current.getVideoData?.()?.title ?? '';
            if (title) setPlayerTitle(title);
          } catch { /* ignore */ }
        } finally {
          setTimeout(() => { isSyncingRef.current = false; }, 500);
        }
      }, 300);
    } catch {
      isSyncingRef.current = false;
    }
  }, [getEffectiveTimestamp]);

  // React to state changes from Matrix
  useEffect(() => {
    if (!state) return;
    const prev = lastStateRef.current;
    lastStateRef.current = state;

    const videoChanged = !prev || prev.videoId !== state.videoId;
    const playChanged = prev && prev.playing !== state.playing;
    const seekChanged = prev && Math.abs((prev.timestamp ?? 0) - (state.timestamp ?? 0)) > 2;

    if (!playerReadyRef.current) return;
    if (!videoChanged && !playChanged && !seekChanged) return;

    applyState(state);
  }, [state, applyState]);

  const handlePlayPause = useCallback(async () => {
    if (!playerReadyRef.current || !playerRef.current) return;
    const ts = playerRef.current.getCurrentTime?.() ?? 0;
    try {
      if (isPlaying) {
        await sendCommand({ action: 'pause', timestamp: ts });
      } else {
        await sendCommand({ action: 'play', timestamp: ts });
      }
    } catch {
      showToast('Failed to sync playback');
    }
  }, [isPlaying, sendCommand, showToast]);

  const handleSeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTs = parseFloat(e.target.value);
    setSeekValue(newTs);
    if (playerReadyRef.current && playerRef.current) {
      isSyncingRef.current = true;
      playerRef.current.seekTo(newTs, true);
      setTimeout(() => { isSyncingRef.current = false; }, 500);
    }
  }, []);

  const handleSeekCommit = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTs = parseFloat(e.target.value);
    try {
      await sendCommand({ action: 'seek', timestamp: newTs });
    } catch {
      showToast('Failed to sync playback');
    }
  }, [sendCommand, showToast]);

  const handleLoadUrl = useCallback(async () => {
    const videoId = extractVideoId(urlInput);
    if (!videoId) {
      showToast('Invalid YouTube URL or video ID');
      return;
    }
    try {
      await sendCommand({ action: 'load', videoId });
      setUrlInput('');
      setShowUrlInput(false);
    } catch {
      showToast('Failed to sync playback');
    }
  }, [urlInput, sendCommand, showToast]);

  const handleUrlKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleLoadUrl();
    if (e.key === 'Escape') setShowUrlInput(false);
  }, [handleLoadUrl]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const displayTitle = playerTitle || (state?.videoId ? state.videoId : 'No video loaded');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#0f0f0f',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(30,30,30,0.95)',
          color: '#fff',
          padding: '8px 18px',
          borderRadius: 6,
          fontSize: 13,
          zIndex: 1000,
          border: '1px solid #444',
          pointerEvents: 'none',
          boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
        }}>
          {toast}
        </div>
      )}

      {/* Player area */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <div id="yt-player" style={{ width: '100%', height: '100%' }} />
        {!state && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: '#0f0f0f', gap: 12,
          }}>
            <div style={{ fontSize: 48 }}>📺</div>
            <div style={{ color: '#aaa', fontSize: 15 }}>No video loaded</div>
            <div style={{ color: '#666', fontSize: 12 }}>
              Use the edit button below to load a YouTube video
            </div>
          </div>
        )}
      </div>

      {/* Bottom control bar */}
      <div style={{
        height: 52,
        background: '#1a1a1a',
        borderTop: '1px solid #2a2a2a',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 10,
        flexShrink: 0,
      }}>
        {/* Left: video title */}
        <div style={{
          flex: 1,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          fontSize: 13,
          color: '#ccc',
          minWidth: 0,
        }}>
          {displayTitle}
        </div>

        {/* Center: play/pause + seek */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}>
          <button
            onClick={handlePlayPause}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: 20,
              cursor: 'pointer',
              padding: '4px 6px',
              borderRadius: 4,
              lineHeight: 1,
            }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          {duration > 0 && (
            <>
              <span style={{ fontSize: 11, color: '#888', flexShrink: 0 }}>
                {formatTime(seekValue)}
              </span>
              <input
                type="range"
                min={0}
                max={duration}
                step={1}
                value={seekValue}
                onChange={handleSeekChange}
                onMouseUp={handleSeekCommit as any}
                onTouchEnd={handleSeekCommit as any}
                style={{
                  width: 120,
                  accentColor: '#ff0000',
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: 11, color: '#888', flexShrink: 0 }}>
                {formatTime(duration)}
              </span>
            </>
          )}
        </div>

        {/* Right: URL input toggle */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          {showUrlInput ? (
            <>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={handleUrlKeyDown}
                placeholder="YouTube URL or video ID…"
                autoFocus
                style={{
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: 4,
                  color: '#fff',
                  fontSize: 12,
                  padding: '4px 8px',
                  width: 220,
                  outline: 'none',
                }}
              />
              <button
                onClick={handleLoadUrl}
                style={{
                  background: '#ff0000',
                  border: 'none',
                  borderRadius: 4,
                  color: '#fff',
                  fontSize: 12,
                  padding: '4px 10px',
                  cursor: 'pointer',
                }}
              >
                Load
              </button>
              <button
                onClick={() => setShowUrlInput(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  fontSize: 16,
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                ✕
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowUrlInput(true)}
              style={{
                background: 'none',
                border: '1px solid #444',
                borderRadius: 4,
                color: '#aaa',
                fontSize: 12,
                padding: '4px 10px',
                cursor: 'pointer',
              }}
              title="Load a YouTube video"
            >
              + Video
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
