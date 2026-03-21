import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue } from 'jotai';
import { settingsAtom, Settings } from '../../../state/settings';
import { effectiveAVSettingsAtom } from '../../../state/avQuality';
import * as css from './ScreenShareModal.css';

type SSResolution = Settings['ssResolution'];
type SSFps = Settings['ssFps'];

const SS_RESOLUTIONS: SSResolution[] = ['720p', '1080p', '1440p', '4k', 'source'];
const SS_FPS: SSFps[] = [5, 15, 30, 60, 120];

const SS_RESOLUTION_ORDER = ['720p', '1080p', '1440p', '4k', 'source'];

function isResolutionAllowed(res: SSResolution, maxRes: string): boolean {
  const resIdx = SS_RESOLUTION_ORDER.indexOf(res);
  const maxIdx = SS_RESOLUTION_ORDER.indexOf(maxRes);
  if (resIdx === -1 || maxIdx === -1) return true;
  return resIdx <= maxIdx;
}

interface ScreenShareModalProps {
  onConfirm: (ssResolution: SSResolution, ssFps: SSFps, ssAudio: boolean) => void;
  onCancel: () => void;
  mode?: 'start' | 'update';
  /** When true, the audio toggle is locked — mid-share audio cannot be toggled
   *  without restarting the share (no ScreenShareAudio track exists). */
  audioLocked?: boolean;
}

export function ScreenShareModal({ onConfirm, onCancel, mode = 'start', audioLocked = false }: ScreenShareModalProps) {
  if (typeof document === 'undefined') return null;

  const settings = useAtomValue(settingsAtom);
  const effective = useAtomValue(effectiveAVSettingsAtom);

  const [ssResolution, setSsResolution] = useState<SSResolution>(effective.ssResolution);
  const [ssFps, setSsFps] = useState<SSFps>(effective.ssFps as SSFps);
  const [ssAudio, setSsAudio] = useState<boolean>(settings.ssAudio);

  const serverMaxRes = effective.serverMaxSSResolution;
  const serverMaxFps = effective.serverMaxSSFps;

  const handleConfirm = () => {
    // Settings persistence is the caller's responsibility (NativeCallControlBar).
    // Writing here too caused stale-closure overwrite of concurrently changed settings.
    onConfirm(ssResolution, ssFps, ssAudio);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return createPortal(
    <div className={css.Overlay} onClick={handleOverlayClick}>
      <div className={css.Modal} role="dialog" aria-modal="true" aria-labelledby="ss-modal-title">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className={css.Header}>
          <h2 id="ss-modal-title" className={css.Title}>Share Screen</h2>
          <div className={css.Subtitle}>Choose your quality settings before sharing</div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className={css.Body}>

          {/* Resolution */}
          <div className={css.Section}>
            <div className={css.Label}>Resolution</div>
            <div className={css.ChipRow}>
              {SS_RESOLUTIONS.map((res) => {
                const allowed = isResolutionAllowed(res, serverMaxRes);
                const isActive = ssResolution === res;
                return (
                  <button
                    key={res}
                    type="button"
                    className={[css.Chip, isActive ? css.ChipActive : ''].filter(Boolean).join(' ')}
                    onClick={() => allowed && setSsResolution(res)}
                    aria-pressed={isActive}
                    disabled={!allowed}
                  >
                    {res === 'source' ? 'Source' : res}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Framerate */}
          <div className={css.Section}>
            <div className={css.Label}>Framerate</div>
            <div className={css.ChipRow}>
              {SS_FPS.map((fps) => {
                const allowed = fps <= serverMaxFps;
                const isActive = ssFps === fps;
                return (
                  <button
                    key={fps}
                    type="button"
                    className={[css.Chip, isActive ? css.ChipActive : ''].filter(Boolean).join(' ')}
                    onClick={() => allowed && setSsFps(fps)}
                    aria-pressed={isActive}
                    disabled={!allowed}
                  >
                    {fps} fps
                  </button>
                );
              })}
            </div>
          </div>

          {/* System Audio */}
          <div className={css.AudioRow} style={audioLocked ? { opacity: 0.45, pointerEvents: 'none' } : undefined}>
            <span className={css.AudioLabel}>
              Capture System Audio
              {audioLocked && (
                <span style={{ marginLeft: 6, fontSize: '11px', color: 'var(--text-muted)' }}>
                  (restart share to change)
                </span>
              )}
            </span>
            <label className={css.Toggle}>
              <input
                type="checkbox"
                className={css.ToggleInput}
                checked={ssAudio}
                disabled={audioLocked}
                onChange={(e) => setSsAudio(e.target.checked)}
              />
              <span className={css.ToggleSlider} />
            </label>
          </div>

          {/* Server cap info */}
          {(serverMaxRes !== 'source' || serverMaxFps < 120) && (
            <div className={css.InfoRow}>
              ℹ Max: {serverMaxRes === 'source' ? 'Source' : serverMaxRes} / {serverMaxFps} fps (Space Admin)
            </div>
          )}

        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className={css.Footer}>
          <button type="button" className={css.BtnCancel} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={css.BtnConfirm} onClick={handleConfirm}>
            {mode === 'update' ? 'Apply Settings' : 'Start Sharing'}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
