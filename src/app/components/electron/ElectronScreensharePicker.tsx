import React, { useEffect, useRef, useState } from 'react';
import type { DesktopSource, DisplayMediaRequestInfo } from '../../../types/electron';
import * as css from './ElectronScreensharePicker.css';

type Tab = 'screen' | 'window';

interface PendingRequest {
  requestId: string;
  info: DisplayMediaRequestInfo;
}

/**
 * Listens for Electron `onDisplayMediaRequested` events and renders a native-
 * feeling source picker overlay. Calls `selectDisplayMediaSource` when the
 * user confirms or cancels.
 *
 * No-op in the browser (window.electron is undefined).
 */
export function ElectronScreensharePicker() {
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [tab, setTab] = useState<Tab>('screen');
  const [selected, setSelected] = useState<string | null>(null);
  const [withAudio, setWithAudio] = useState(false);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => {
    const electron = window.electron;
    if (!electron?.onDisplayMediaRequested) return;

    const unsub = electron.onDisplayMediaRequested((requestId, info) => {
      requestIdRef.current = requestId;
      setPending({ requestId, info });
      setSelected(null);
      setTab('screen');
      setSources([]);
      setLoading(true);

      electron
        .getDesktopSources(['screen', 'window'], requestId)
        .then((all) => {
          setSources(all);
        })
        .catch(() => {
          setSources([]);
        })
        .finally(() => setLoading(false));
    });

    return unsub;
  }, []);

  if (!pending) return null;

  const visibleSources = sources.filter((s) =>
    tab === 'screen' ? s.id.startsWith('screen:') : !s.id.startsWith('screen:'),
  );

  const canShareAudio =
    pending.info.supportsLoopbackAudio || pending.info.supportsSystemAudioCapture;

  const handleCancel = () => {
    window.electron?.selectDisplayMediaSource(pending.requestId, null, false);
    setPending(null);
  };

  const handleShare = () => {
    if (!selected) return;
    window.electron?.selectDisplayMediaSource(pending.requestId, selected, withAudio);
    setPending(null);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleCancel();
  };

  return (
    <div className={css.overlay} onClick={handleOverlayClick}>
      <div className={css.modal} role="dialog" aria-modal="true" aria-label="Choose what to share">
        <div className={css.header}>Choose what to share</div>

        <div className={css.tabRow}>
          <button
            type="button"
            className={css.tab}
            data-active={tab === 'screen'}
            onClick={() => {
              setTab('screen');
              setSelected(null);
            }}
          >
            Screens
          </button>
          <button
            type="button"
            className={css.tab}
            data-active={tab === 'window'}
            onClick={() => {
              setTab('window');
              setSelected(null);
            }}
          >
            Windows
          </button>
        </div>

        <div className={css.grid}>
          {loading && (
            <span style={{ color: 'var(--tc-surface-lo)', fontSize: '13px', gridColumn: '1/-1' }}>
              Loading sources…
            </span>
          )}
          {!loading && visibleSources.length === 0 && (
            <span style={{ color: 'var(--tc-surface-lo)', fontSize: '13px', gridColumn: '1/-1' }}>
              No {tab === 'screen' ? 'screens' : 'windows'} found.
            </span>
          )}
          {visibleSources.map((source) => (
            <button
              key={source.id}
              type="button"
              className={css.sourceCard}
              data-selected={selected === source.id}
              onClick={() => setSelected(source.id)}
              onDoubleClick={handleShare}
              aria-pressed={selected === source.id}
            >
              <img
                className={css.thumbnail}
                src={source.thumbnailDataUrl}
                alt={source.name}
                draggable={false}
              />
              <span className={css.sourceName} title={source.name}>
                {source.name}
              </span>
            </button>
          ))}
        </div>

        <div className={css.footer}>
          {canShareAudio && (
            <label className={css.audioToggle}>
              <input
                type="checkbox"
                checked={withAudio}
                onChange={(e) => setWithAudio(e.target.checked)}
              />
              Share audio
            </label>
          )}
          <button type="button" className={css.cancelBtn} onClick={handleCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={css.shareBtn}
            onClick={handleShare}
            disabled={!selected}
          >
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
