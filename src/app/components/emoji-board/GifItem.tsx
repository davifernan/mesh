import React, { useState } from 'react';
import { Icon, Icons } from 'folds';
import { GifItem as GifItemType } from '../../plugins/gif/types';

type GifItemProps = {
  gif: GifItemType;
  isFavorite: boolean;
  onSelect: (gif: GifItemType) => void;
  onToggleFavorite: (gif: GifItemType) => void;
};

export function GifItem({ gif, isFavorite, onSelect, onToggleFavorite }: GifItemProps) {
  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);

  const showOverlay = hovered || isFavorite;

  const handleBodyClick = () => {
    onSelect(gif);
  };

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(gif);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={gif.title || 'GIF'}
      onClick={handleBodyClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleBodyClick();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        cursor: 'pointer',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'var(--background-secondary)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        aspectRatio: gif.width && gif.height ? `${gif.width} / ${gif.height}` : '16 / 9',
      }}
    >
      {imgError ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            minHeight: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--background-secondary)',
            color: 'var(--text-secondary)',
            fontSize: '12px',
          }}
        >
          GIF
        </div>
      ) : (
        <img
          src={gif.previewUrl}
          alt={gif.title || 'GIF'}
          loading="lazy"
          onError={() => setImgError(true)}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}

      {showOverlay && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleStarClick}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: isFavorite ? '#f0b132' : 'var(--text-muted)',
                padding: 0,
              }}
            >
              <Icon src={Icons.Star} size="100" filled={isFavorite} />
            </button>
          </div>

          {gif.title && (
            <div
              style={{
                fontSize: '10px',
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                background: 'rgba(0, 0, 0, 0.6)',
                borderRadius: '4px',
                padding: '3px 5px',
              }}
            >
              {gif.title}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
