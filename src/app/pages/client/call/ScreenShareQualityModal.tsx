import React, { useState } from 'react';
import { useAtomValue } from 'jotai';
import { X } from '@phosphor-icons/react';
import { settingsAtom } from '../../../state/settings';
import styles from './ScreenShareQualityModal.module.css';

interface ScreenShareQualityModalProps {
  onConfirm: (ssRes: string, ssFps: number, ssAudio: boolean) => void;
  onClose: () => void;
}

const RESOLUTIONS = ['720p', '1080p', '1440p', '4k', 'source'] as const;
const FPS_OPTIONS = [5, 15, 30, 60, 120] as const;

export function ScreenShareQualityModal({ onConfirm, onClose }: ScreenShareQualityModalProps) {
  const userSettings = useAtomValue(settingsAtom);
  const [resolution, setResolution] = useState(userSettings.ssResolution ?? '720p');
  const [fps, setFps] = useState(userSettings.ssFps ?? 15);
  const [audio, setAudio] = useState(userSettings.ssAudio ?? false);

  const handleConfirm = () => {
    onConfirm(resolution, fps, audio);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Screen Share Quality</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Resolution</label>
          <div className={styles.options}>
            {RESOLUTIONS.map((r) => (
              <button
                key={r}
                className={`${styles.option} ${resolution === r ? styles.selected : ''}`}
                onClick={() => setResolution(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Frame rate</label>
          <div className={styles.options}>
            {FPS_OPTIONS.map((f) => (
              <button
                key={f}
                className={`${styles.option} ${fps === f ? styles.selected : ''}`}
                onClick={() => setFps(f)}
              >
                {f} fps
              </button>
            ))}
          </div>
        </div>

        <div className={styles.toggleField}>
          <label className={styles.label}>Include system audio</label>
          <button
            className={`${styles.toggle} ${audio ? styles.toggleOn : ''}`}
            onClick={() => setAudio((a) => !a)}
            role="switch"
            aria-checked={audio}
          >
            <span className={styles.toggleThumb} />
          </button>
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.confirmBtn} onClick={handleConfirm}>
            Share Screen
          </button>
        </div>
      </div>
    </div>
  );
}
