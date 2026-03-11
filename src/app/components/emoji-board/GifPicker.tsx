import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Grid } from '@giphy/react-components';
import type { IGif } from '@giphy/js-types';
import { Box, Icon, Icons, Text } from 'folds';
import { MatrixClient } from 'matrix-js-sdk';
import { useAtomValue } from 'jotai';
import { GifItem as GifItemType } from '../../plugins/gif/types';
import { getGiphyFetch, mapGif, GIPHY_RATING_DEFAULT } from '../../plugins/gif/giphyApi';
import { useFavoriteGifs, addFavoriteGif, removeFavoriteGif } from '../../plugins/gif/favoriteGifs';
import { useSpaceGifCollections } from '../../plugins/gif/gifCollectionPlugin';
import { useDebounce } from '../../hooks/useDebounce';
import { roomToParentsAtom } from '../../state/room/roomToParents';
import { GifGrid } from './GifGrid';

type GifPickerProps = {
  mx: MatrixClient;
  roomId: string;
  onSelect: (gif: GifItemType) => void;
  requestClose: () => void;
};

const GRID_COLUMNS = 3;
const GRID_GUTTER = 4;

const sectionHeaderStyle: React.CSSProperties = {
  padding: '12px 0 6px',
  color: 'var(--text-secondary)',
};

const searchBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  background: 'var(--background-secondary)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: '8px',
  padding: '8px 10px',
};

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Box alignItems="Center" gap="100" style={sectionHeaderStyle}>
      {icon}
      <Text size="T200" as="span">
        {label}
      </Text>
    </Box>
  );
}

// Convert saved favorite entries to GifItem[]
function savedGifsToItems(
  savedGifs: NonNullable<ReturnType<typeof useFavoriteGifs>>
): GifItemType[] {
  return savedGifs.map((g) => ({
    id: g.id,
    provider: g.provider,
    title: g.title,
    url: g.url,
    previewUrl: g.previewUrl,
    width: g.width,
    height: g.height,
  }));
}

export function GifPicker({ mx, roomId, onSelect, requestClose }: GifPickerProps) {
  const roomToParents = useAtomValue(roomToParentsAtom);

  // Derive parent space id
  const spaceId = useMemo<string | undefined>(() => {
    const parents = roomToParents.get(roomId);
    if (!parents || parents.size === 0) return undefined;
    return [...parents][0];
  }, [roomToParents, roomId]);

  // --- Container width for SDK Grid ---
  const contentRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(280);
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return undefined;
    const obs = new ResizeObserver(([entry]) => {
      if (entry) setGridWidth(entry.contentRect.width);
    });
    obs.observe(el);
    setGridWidth(el.offsetWidth);
    return () => obs.disconnect();
  }, []);

  // --- Favorites (our own account data — kept custom) ---
  const savedGifs = useFavoriteGifs();
  const favoriteItems = useMemo(() => savedGifsToItems(savedGifs ?? []), [savedGifs]);
  const favoriteIds = useMemo(() => new Set(favoriteItems.map((g) => g.id)), [favoriteItems]);

  // --- Search query ---
  const [searchQuery, setSearchQuery] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const searchActive = committedQuery.trim().length > 0;

  const commitSearch = useCallback((q: string) => setCommittedQuery(q), []);
  const debouncedCommit = useDebounce(commitSearch, { wait: 400 });

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setSearchQuery(val);
      debouncedCommit(val);
    },
    [debouncedCommit]
  );

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setCommittedQuery('');
  }, []);

  // --- Community GIF collections (kept custom) ---
  const communityCollections = useSpaceGifCollections(spaceId ?? '');

  // --- Favorite toggle ---
  const handleToggleFavorite = useCallback(
    async (gif: GifItemType) => {
      try {
        if (favoriteIds.has(gif.id)) {
          await removeFavoriteGif(mx, gif.id);
        } else {
          await addFavoriteGif(mx, {
            id: gif.id,
            provider: gif.provider,
            title: gif.title,
            url: gif.url,
            previewUrl: gif.previewUrl,
            width: gif.width,
            height: gif.height,
          });
        }
      } catch {
        // reactive account data self-heals on error
      }
    },
    [mx, favoriteIds]
  );

  // --- SDK Grid click → our GifItem ---
  const handleGifClick = useCallback(
    (gif: IGif, e: React.SyntheticEvent<HTMLElement>) => {
      e.preventDefault();
      onSelect(mapGif(gif));
      requestClose();
    },
    [onSelect, requestClose]
  );

  // --- SDK fetchGifs callbacks ---
  // Key changes force the Grid to remount and reset pagination
  const fetchSearch = useCallback(
    (offset: number) =>
      getGiphyFetch().search(committedQuery, {
        offset,
        limit: 25,
        rating: GIPHY_RATING_DEFAULT,
        lang: 'en',
      }),
    [committedQuery]
  );

  const fetchTrending = useCallback(
    (offset: number) =>
      getGiphyFetch().trending({ offset, limit: 25, rating: GIPHY_RATING_DEFAULT, type: 'gifs' }),
    []
  );

  // --- Search input autofocus (desktop only — avoids triggering mobile keyboard on open) ---
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (window.innerWidth > 768) {
      inputRef.current?.focus();
    }
  }, []);

  return (
    <Box
      direction="Column"
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--background-primary)',
      }}
    >
      <Box
        style={{
          padding: '8px 12px 6px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          flexShrink: 0,
          background: 'var(--background-primary)',
        }}
      >
        <div style={searchBarStyle}>
          <Icon src={Icons.Search} size="100" style={{ color: 'var(--text-secondary)' }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search GIFs..."
            aria-label="Search GIFs"
            value={searchQuery}
            onChange={handleSearchChange}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '14px',
              width: '100%',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: 0,
                display: 'flex',
              }}
              aria-label="Clear search"
            >
              <Icon src={Icons.Cross} size="100" />
            </button>
          )}
        </div>
      </Box>

      <div
        ref={contentRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 12px 12px',
          background: 'var(--background-primary)',
        }}
      >
        {searchActive && gridWidth > 0 && (
          <>
            <SectionHeader icon={<Icon src={Icons.Search} size="100" />} label="Search Results" />
            <Grid
              key={committedQuery}
              fetchGifs={fetchSearch}
              width={gridWidth}
              columns={GRID_COLUMNS}
              gutter={GRID_GUTTER}
              onGifClick={handleGifClick}
              noResultsMessage={
                <Text size="T300" style={{ color: 'var(--text-secondary)' }}>
                  No GIFs found
                </Text>
              }
            />
          </>
        )}

        {!searchActive && (
          <>
            {favoriteItems.length > 0 && (
              <>
                <SectionHeader icon={<Icon src={Icons.Star} size="100" />} label="Favorites" />
                <GifGrid
                  gifs={favoriteItems}
                  favoriteIds={favoriteIds}
                  onSelect={(gif) => {
                    onSelect(gif);
                    requestClose();
                  }}
                  onToggleFavorite={handleToggleFavorite}
                />
              </>
            )}

            {gridWidth > 0 && (
              <>
                <SectionHeader icon={<Icon src={Icons.Heart} size="100" />} label="Trending" />
                <Grid
                  key="trending"
                  fetchGifs={fetchTrending}
                  width={gridWidth}
                  columns={GRID_COLUMNS}
                  gutter={GRID_GUTTER}
                  onGifClick={handleGifClick}
                />
              </>
            )}

            {communityCollections.map((col) => {
              const gifs = Object.values(col.content.gifs);
              if (gifs.length === 0) return null;
              return (
                <div key={col.collectionId}>
                  <SectionHeader
                    icon={<Icon src={Icons.Space} size="100" />}
                    label={`${col.content.emoji ?? '🏠'} ${col.content.name}`}
                  />
                  <GifGrid
                    gifs={gifs}
                    favoriteIds={favoriteIds}
                    onSelect={(gif) => {
                      onSelect(gif);
                      requestClose();
                    }}
                    onToggleFavorite={handleToggleFavorite}
                  />
                </div>
              );
            })}
          </>
        )}
      </div>
    </Box>
  );
}
