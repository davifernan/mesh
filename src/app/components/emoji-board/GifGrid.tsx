import React from 'react';
import { Text } from 'folds';
import { GifItem as GifItemType } from '../../plugins/gif/types';
import { GifItem } from './GifItem';

type GifGridProps = {
  gifs: GifItemType[];
  favoriteIds: Set<string>;
  onSelect: (gif: GifItemType) => void;
  onToggleFavorite: (gif: GifItemType) => void;
  loading?: boolean;
  emptyMessage?: string;
};

function SkeletonTile() {
  return (
    <div
      style={{
        borderRadius: '6px',
        background: 'var(--bg-surface-low, #1e1f22)',
        aspectRatio: '4 / 3',
        animation: 'gifSkeleton 1.2s ease-in-out infinite',
      }}
    />
  );
}

export function GifGrid({
  gifs,
  favoriteIds,
  onSelect,
  onToggleFavorite,
  loading,
  emptyMessage,
}: GifGridProps) {
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '4px',
    padding: '4px 0',
  };

  if (loading) {
    return (
      <div style={gridStyle}>
        {Array.from({ length: 9 }).map((_, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <SkeletonTile key={i} />
        ))}
      </div>
    );
  }

  if (gifs.length === 0 && emptyMessage) {
    return (
      <div
        style={{
          padding: '16px 0',
          textAlign: 'center',
          color: 'var(--text-secondary, #b5bac1)',
        }}
      >
        <Text size="T300">{emptyMessage}</Text>
      </div>
    );
  }

  return (
    <div style={gridStyle}>
      {gifs.map((gif) => (
        <GifItem
          key={gif.id}
          gif={gif}
          isFavorite={favoriteIds.has(gif.id)}
          onSelect={onSelect}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}
