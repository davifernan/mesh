import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SoundItem } from '../../plugins/soundboard/types';
import { useImportSound } from './useImportSound';
import * as css from './ImportSoundModal.css';

export type ImportSoundModalProps = {
  spaceId: string;
  boardId: string;
  onClose: () => void;
  onImported: (sound: SoundItem) => void;
};

// ── Small helpers ─────────────────────────────────────────────────────────────
function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
}

// ── Upload tab ────────────────────────────────────────────────────────────────
type UploadTabProps = {
  onFile: (file: File) => void;
  isLoading: boolean;
};
function UploadTab({ onFile, isLoading }: UploadTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const accept = '.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,.webm';

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onFile(files[0]);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (!isLoading) handleFiles(e.dataTransfer.files);
    },
    [isLoading]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  return (
    <div>
      <div
        className={[css.DropZone, isDragOver ? css.DropZoneActive : ''].filter(Boolean).join(' ')}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Datei auswählen oder hierher ziehen"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
      >
        <span style={{ fontSize: 28 }}>🎵</span>
        <span className={css.DropZoneText}>
          Datei hierher ziehen oder klicken zum Auswählen
        </span>
        <span className={css.DropZoneSub}>
          MP3, WAV, OGG, M4A, AAC, FLAC, OPUS, WEBM — max. 2 MB
        </span>
        <button
          type="button"
          className={css.BrowseBtn}
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          disabled={isLoading}
        >
          Datei auswählen
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

// ── URL tab ───────────────────────────────────────────────────────────────────
type UrlTabProps = {
  onFetch: (url: string) => void;
  isLoading: boolean;
};
function UrlTab({ onFetch, isLoading }: UrlTabProps) {
  const [urlValue, setUrlValue] = useState('');

  const handleFetch = () => {
    const trimmed = urlValue.trim();
    if (!trimmed) return;
    onFetch(trimmed);
  };

  return (
    <div className={css.UrlRow}>
      <input
        className={css.UrlInput}
        type="url"
        placeholder="https://example.com/sound.mp3"
        value={urlValue}
        onChange={(e) => setUrlValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleFetch();
        }}
        disabled={isLoading}
      />
      <button
        type="button"
        className={css.FetchBtn}
        onClick={handleFetch}
        disabled={isLoading || !urlValue.trim()}
      >
        {isLoading ? '…' : 'Abrufen'}
      </button>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export function ImportSoundModal({
  spaceId,
  boardId,
  onClose,
  onImported,
}: ImportSoundModalProps) {
  const {
    providers,
    selectedProvider,
    selectProvider,
    importResult,
    isLoading,
    error,
    importFromFile,
    importFromUrl,
    metadata,
    setMetadata,
    commit,
    reset,
  } = useImportSound(spaceId, boardId);

  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const handleCommit = async () => {
    setCommitting(true);
    setCommitError(null);
    try {
      const sound = await commit();
      if (sound) {
        reset();
        onImported(sound);
        onClose();
      }
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setCommitting(false);
    }
  };

  const displayedError = commitError ?? error;
  const canCommit = !!importResult && !!metadata.title.trim() && !isLoading && !committing;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className={css.Overlay} onClick={handleOverlayClick} role="presentation">
      <div
        className={css.Modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-sound-title"
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className={css.Header}>
          <h2 id="import-sound-title" className={css.Title}>
            Sound hinzufügen
          </h2>
          <button
            type="button"
            className={css.CloseBtn}
            onClick={handleClose}
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        {/* ── Provider tabs ─────────────────────────────────────────────── */}
        <div className={css.TabBar} role="tablist" aria-label="Importquelle">
          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={selectedProvider?.id === p.id}
              className={css.Tab}
              disabled={!p.available}
              onClick={() => {
                if (p.available) {
                  reset();
                  selectProvider(p.id);
                }
              }}
            >
              {p.label}
              {!p.available && (
                <span className={css.ComingSoonBadge}>Soon</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div className={css.Body}>
          {/* Upload tab */}
          {selectedProvider?.id === 'upload' && (
            <div>
              <div className={css.SectionLabel}>Audiodatei</div>
              <UploadTab onFile={importFromFile} isLoading={isLoading} />
            </div>
          )}

          {/* URL tab */}
          {selectedProvider?.id === 'url' && (
            <div>
              <div className={css.SectionLabel}>Direkte URL</div>
              <UrlTab onFetch={importFromUrl} isLoading={isLoading} />
            </div>
          )}

          {/* No provider selected yet */}
          {!selectedProvider && (
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0 }}>
              Wähle oben eine Importquelle.
            </p>
          )}

          {/* Result preview card */}
          {importResult && !isLoading && (
            <div className={css.PreviewCard}>
              <span className={css.PreviewIcon}>🎵</span>
              <div className={css.PreviewMeta}>
                <span className={css.PreviewName}>{importResult.title}</span>
                <span className={css.PreviewSub}>
                  {importResult.durationMs
                    ? formatDuration(importResult.durationMs)
                    : '–'}
                  {importResult.mimeType ? ` · ${importResult.mimeType}` : ''}
                  {importResult.blob
                    ? ` · ${(importResult.blob.size / 1024).toFixed(0)} KB`
                    : ''}
                </span>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>
              Lade…
            </p>
          )}

          {/* ── Metadata (shown once import result is available) ────────── */}
          {importResult && !isLoading && (
            <>
              {/* Title + Emoji */}
              <div className={css.FieldGroup}>
                <label className={css.FieldLabel} htmlFor="sound-title">
                  Titel
                </label>
                <div className={css.TitleEmojiRow}>
                  <button
                    type="button"
                    className={css.EmojiBtn}
                    aria-label="Emoji auswählen"
                    title="Emoji auswählen"
                    onClick={() => {
                      // Cycle through common sound emojis for now;
                      // replace with a real picker in Stream D / V2
                      const emojis = ['🔊', '🎵', '🎶', '🔔', '🎸', '🥁', '🎺', '🎷', '📣'];
                      const idx = emojis.indexOf(metadata.emoji);
                      setMetadata({ emoji: emojis[(idx + 1) % emojis.length] });
                    }}
                  >
                    {metadata.emoji || '🔊'}
                  </button>
                  <input
                    id="sound-title"
                    className={css.TextInput}
                    type="text"
                    placeholder="Sound-Titel"
                    value={metadata.title}
                    onChange={(e) => setMetadata({ title: e.target.value })}
                    maxLength={64}
                  />
                </div>
              </div>

              {/* Volume */}
              <div className={css.FieldGroup}>
                <label className={css.FieldLabel} htmlFor="sound-volume">
                  Lautstärke
                </label>
                <div className={css.VolumeRow}>
                  <input
                    id="sound-volume"
                    className={css.VolumeSlider}
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(metadata.volume * 100)}
                    onChange={(e) =>
                      setMetadata({ volume: Number(e.target.value) / 100 })
                    }
                  />
                  <span className={css.VolumeValue}>
                    {Math.round(metadata.volume * 100)}%
                  </span>
                </div>
              </div>

              {/* Tags */}
              <div className={css.FieldGroup}>
                <label className={css.FieldLabel} htmlFor="sound-tags">
                  Tags{' '}
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>
                    (kommagetrennt)
                  </span>
                </label>
                <input
                  id="sound-tags"
                  className={css.TextInput}
                  type="text"
                  placeholder="lustig, intro, meme"
                  value={metadata.tags}
                  onChange={(e) => setMetadata({ tags: e.target.value })}
                />
              </div>

              {/* Attribution */}
              {importResult.attribution && (
                <div className={css.AttributionNotice}>
                  <span>ℹ</span>
                  <span>{importResult.attribution}</span>
                </div>
              )}
            </>
          )}

          {/* Error display */}
          {displayedError && (
            <div className={css.ErrorBanner} role="alert">
              {displayedError}
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className={css.Footer}>
          <button type="button" className={css.BtnCancel} onClick={handleClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className={css.BtnAdd}
            onClick={handleCommit}
            disabled={!canCommit}
          >
            {committing ? 'Hinzufügen…' : 'Hinzufügen'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
