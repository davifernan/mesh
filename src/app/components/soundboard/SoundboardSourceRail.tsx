import React, { useState } from 'react';
import styles from './SoundboardSourceRail.module.css';

export type SoundboardSource = {
  id: string; // 'defaults' | spaceId
  label: string;
  avatarUrl?: string;
  emoji?: string;
};

type SoundboardSourceRailProps = {
  sources: SoundboardSource[];
  selectedId: string;
  onSelect: (id: string) => void;
};

type TooltipState = {
  id: string;
  x: number;
  y: number;
} | null;

export function SoundboardSourceRail({
  sources,
  selectedId,
  onSelect,
}: SoundboardSourceRailProps) {
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  return (
    <div className={styles.rail}>
      {sources.map((src) => {
        const isSelected = src.id === selectedId;

        return (
          <div key={src.id} className={styles.itemWrap}>
            <button
              className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
              onClick={() => onSelect(src.id)}
              onMouseEnter={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setTooltip({ id: src.id, x: rect.right + 8, y: rect.top + rect.height / 2 });
              }}
              onMouseLeave={() => setTooltip(null)}
              aria-label={src.label}
              title={src.label}
            >
              {src.avatarUrl ? (
                <img
                  src={src.avatarUrl}
                  alt={src.label}
                  className={styles.avatar}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : src.emoji ? (
                <span className={styles.emojiAvatar}>{src.emoji}</span>
              ) : (
                // Default mesh logo fallback — uses brand initial
                <span className={styles.defaultAvatar}>BC</span>
              )}
            </button>

            {tooltip?.id === src.id && (
              <div
                className={styles.tooltip}
                style={{ top: tooltip.y, left: tooltip.x }}
              >
                {src.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
