import React from 'react';
import type { SoundItem as SoundItemType } from '../../plugins/soundboard/types';
import { SoundItem } from './SoundItem';
import styles from './SoundboardGrid.module.css';

type SoundboardGridProps = {
  sounds: SoundItemType[];
  /** Set of soundboard sound IDs currently playing (mapped via playingUrls → sound.url) */
  playingUrls: Set<string>;
  /** Sound IDs that are favorited */
  favoriteIds: Set<string>;
  onPlay: (sound: SoundItemType) => void;
  onStop: (sound: SoundItemType) => void;
  onToggleFavorite: (sound: SoundItemType) => void;
};

export function SoundboardGrid({
  sounds,
  playingUrls,
  favoriteIds,
  onPlay,
  onStop,
  onToggleFavorite,
}: SoundboardGridProps) {
  if (sounds.length === 0) {
    return (
      <div className={styles.empty}>
        Keine Sounds
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {sounds.map((sound) => (
        <SoundItem
          key={sound.id}
          sound={sound}
          isPlaying={playingUrls.has(sound.url)}
          isFavorite={favoriteIds.has(sound.id)}
          onPlay={onPlay}
          onStop={onStop}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}
