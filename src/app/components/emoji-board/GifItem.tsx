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
      onClick={handleBodyClick}
      onKeyDown={(e) => e.key === 'Enter' && handleBodyClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        cursor: 'pointer',
        borderRadius: '6px',
        overflow: 'hidden',
        background: 'var(--bg-surface-low, #1e1f22)',
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
            background: 'var(--bg-surface-low, #1e1f22)',
            color: 'var(--text-secondary, #b5bac1)',
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

      {/* Hover overlay */}
      {hovered && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '4px',
          }}
        >
          {/* Star button top-right */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleStarClick}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              style={{
                background: 'rgba(0,0,0,0.6)',
                border: 'none',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: isFavorite ? '#f0b132' : '#fff',
                padding: 0,
              }}
            >
              <Icon
                src={Icons.Star}
                size="100"
                filled={isFavorite}
              />
            </button>
          </div>

          {/* Title overlay bottom */}
          {gif.title && (
            <div
              style={{
                fontSize: '10px',
                color: '#fff',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                background: 'rgba(0,0,0,0.5)',
                borderRadius: '3px',
                padding: '2px 4px',
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
