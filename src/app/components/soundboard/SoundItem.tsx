import React, { useState } from 'react';
import { Stop, Star, SpeakerHigh } from '@phosphor-icons/react';
import type { SoundItem as SoundItemType } from '../../plugins/soundboard/types';
import styles from './SoundItem.module.css';

type SoundItemProps = {
  sound: SoundItemType;
  isPlaying: boolean;
  isFavorite: boolean;
  onPlay: (sound: SoundItemType) => void;
  onStop: (sound: SoundItemType) => void;
  onToggleFavorite: (sound: SoundItemType) => void;
};

export function SoundItem({
  sound,
  isPlaying,
  isFavorite,
  onPlay,
  onStop,
  onToggleFavorite,
}: SoundItemProps) {
  const [hovered, setHovered] = useState(false);

  const handleBodyClick = () => {
    if (isPlaying) {
      onStop(sound);
    } else {
      onPlay(sound);
    }
  };

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(sound);
  };

  return (
    <div
      className={`${styles.tile} ${isPlaying ? styles.tilePlaying : ''}`}
      onClick={handleBodyClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleBodyClick()}
      aria-pressed={isPlaying}
      title={sound.title}
    >
      <span className={styles.emoji}>
        {sound.emoji ?? '🔊'}
      </span>

      <span className={styles.title}>{sound.title}</span>

      {isPlaying && (
        <span className={styles.playingIndicator}>
          <Stop size={12} weight="fill" />
        </span>
      )}

      {(hovered || isFavorite) && (
        <button
          className={`${styles.starBtn} ${isFavorite ? styles.starActive : ''}`}
          onClick={handleStarClick}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star size={12} weight={isFavorite ? 'fill' : 'regular'} />
        </button>
      )}
    </div>
  );
}

// Also export a volume-icon button (used in SoundboardPanel header)
export function VolumeButton({
  onClick,
  active,
}: {
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      className={`${styles.iconBtn} ${active ? styles.iconBtnActive : ''}`}
      onClick={onClick}
      aria-label="Soundboard volume"
      title="Soundboard volume"
    >
      <SpeakerHigh size={16} />
    </button>
  );
}
