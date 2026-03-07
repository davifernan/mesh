import React, { useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
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
}

export function ScreenShareModal({ onConfirm, onCancel }: ScreenShareModalProps) {
  const settings = useAtomValue(settingsAtom);
  const setSettings = useSetAtom(settingsAtom);
  const effective = useAtomValue(effectiveAVSettingsAtom);

  const [ssResolution, setSsResolution] = useState<SSResolution>(effective.ssResolution);
  const [ssFps, setSsFps] = useState<SSFps>(effective.ssFps as SSFps);
  const [ssAudio, setSsAudio] = useState<boolean>(settings.ssAudio);

  const serverMaxRes = effective.serverMaxSSResolution;
  const serverMaxFps = effective.serverMaxSSFps;

  const handleConfirm = () => {
    setSettings({ ...settings, ssResolution, ssFps, ssAudio });
    onConfirm(ssResolution, ssFps, ssAudio);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div className={css.Overlay} onClick={handleOverlayClick}>
      <div className={css.Modal} role="dialog" aria-modal="true" aria-labelledby="ss-modal-title">
        <h2 id="ss-modal-title" className={css.Title}>
          Bildschirm teilen
        </h2>

        <div className={css.Section}>
          <div className={css.Label}>Auflösung</div>
          <div className={css.ChipRow}>
            {SS_RESOLUTIONS.map((res) => {
              const allowed = isResolutionAllowed(res, serverMaxRes);
              return (
                <button
                  key={res}
                  type="button"
                  className={css.Chip}
                  data-selected={ssResolution === res}
                  data-disabled={!allowed}
                  onClick={() => allowed && setSsResolution(res)}
                  aria-pressed={ssResolution === res}
                  disabled={!allowed}
                >
                  {res === 'source' ? 'Quelle' : res}
                </button>
              );
            })}
          </div>
        </div>

        <div className={css.Section}>
          <div className={css.Label}>Framerate</div>
          <div className={css.ChipRow}>
            {SS_FPS.map((fps) => {
              const allowed = fps <= serverMaxFps;
              return (
                <button
                  key={fps}
                  type="button"
                  className={css.Chip}
                  data-selected={ssFps === fps}
                  data-disabled={!allowed}
                  onClick={() => allowed && setSsFps(fps)}
                  aria-pressed={ssFps === fps}
                  disabled={!allowed}
                >
                  {fps} fps
                </button>
              );
            })}
          </div>
        </div>

        <div className={css.Section}>
          <div className={css.AudioRow}>
            <span className={css.Label} style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '14px', fontWeight: 500, color: 'var(--text-normal)' }}>
              System-Audio aufnehmen
            </span>
            <label className={css.Toggle}>
              <input
                type="checkbox"
                className={css.ToggleInput}
                checked={ssAudio}
                onChange={(e) => setSsAudio(e.target.checked)}
              />
              <span className={css.ToggleSlider} />
            </label>
          </div>
        </div>

        {(serverMaxRes !== 'source' || serverMaxFps < 120) && (
          <div className={css.InfoRow}>
            ℹ Max: {serverMaxRes === 'source' ? 'Quelle' : serverMaxRes} / {serverMaxFps} fps (Space-Admin)
          </div>
        )}

        <div className={css.ButtonRow}>
          <button type="button" className={css.BtnCancel} onClick={onCancel}>
            Abbrechen
          </button>
          <button type="button" className={css.BtnConfirm} onClick={handleConfirm}>
            Jetzt teilen →
          </button>
        </div>
      </div>
    </div>
  );
}
