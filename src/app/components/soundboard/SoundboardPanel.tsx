import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { X, MagnifyingGlass, CaretDown, CaretRight } from '@phosphor-icons/react';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useCallState } from '../../pages/client/call/CallProvider';
import { useAllJoinedSpaceSoundboards } from '../../plugins/soundboard/soundboardPlugin';
import { useFavoriteSounds, addFavoriteSound, removeFavoriteSound } from '../../plugins/soundboard/favoriteSounds';
import type { SoundItem as SoundItemType, ResolvedSoundboard } from '../../plugins/soundboard/types';
import { SoundboardGrid } from './SoundboardGrid';
import { SoundboardSourceRail, type SoundboardSource } from './SoundboardSourceRail';
import { VolumeButton } from './SoundItem';
import styles from './SoundboardPanel.module.css';

type SectionProps = {
  title: string;
  sounds: SoundItemType[];
  playingUrls: Set<string>;
  favoriteIds: Set<string>;
  onPlay: (sound: SoundItemType) => void;
  onStop: (sound: SoundItemType) => void;
  onToggleFavorite: (sound: SoundItemType) => void;
  defaultOpen?: boolean;
};

function SoundboardSection({
  title,
  sounds,
  playingUrls,
  favoriteIds,
  onPlay,
  onStop,
  onToggleFavorite,
  defaultOpen = true,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (sounds.length === 0) return null;

  return (
    <div className={styles.section}>
      <button
        className={styles.sectionHeader}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? <CaretDown size={12} weight="bold" /> : <CaretRight size={12} weight="bold" />}
        <span className={styles.sectionTitle}>{title}</span>
        <span className={styles.sectionCount}>{sounds.length}</span>
      </button>
      {open && (
        <div className={styles.sectionBody}>
          <SoundboardGrid
            sounds={sounds}
            playingUrls={playingUrls}
            favoriteIds={favoriteIds}
            onPlay={onPlay}
            onStop={onStop}
            onToggleFavorite={onToggleFavorite}
          />
        </div>
      )}
    </div>
  );
}

type SoundboardPanelProps = {
  onClose: () => void;
};

export function SoundboardPanel({ onClose }: SoundboardPanelProps) {
  const mx = useMatrixClient();
  const { playSoundboardClip, stopSoundboardClip } = useCallState();

  const allSpaceSoundboards = useAllJoinedSpaceSoundboards(mx);
  const favoriteSounds = useFavoriteSounds() ?? [];

  const [search, setSearch] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [playingByUrl, setPlayingByUrl] = useState<Map<string, string>>(new Map());

  const panelRef = useRef<HTMLDivElement>(null);

  const spaceMap = useMemo(() => {
    const map = new Map<string, ResolvedSoundboard[]>();
    for (const board of allSpaceSoundboards) {
      if (!map.has(board.spaceId)) map.set(board.spaceId, []);
      map.get(board.spaceId)!.push(board);
    }
    return map;
  }, [allSpaceSoundboards]);

  const sources: SoundboardSource[] = useMemo(() => {
    const result: SoundboardSource[] = [];
    for (const [spaceId] of spaceMap) {
      const room = mx.getRoom(spaceId);
      const label = room?.name ?? spaceId;
      const avatarUrl = room?.getAvatarUrl(mx.baseUrl, 36, 36, 'crop') ?? undefined;
      const emoji = room?.name?.slice(0, 2) ?? '🔊';
      result.push({ id: spaceId, label, avatarUrl: avatarUrl ?? undefined, emoji });
    }
    return result;
  }, [spaceMap, mx]);

  useEffect(() => {
    if (sources.length === 0) {
      setSelectedSourceId('');
      return;
    }
    setSelectedSourceId((prev) => (
      prev && sources.some((source) => source.id === prev) ? prev : sources[0].id
    ));
  }, [sources]);

  const soundsForSource = useMemo((): SoundItemType[] => {
    if (!selectedSourceId) return [];
    const boards = spaceMap.get(selectedSourceId) ?? [];
    return boards.flatMap((board) => Object.values(board.content.sounds));
  }, [selectedSourceId, spaceMap]);

  const allCommunitySounds = useMemo(
    (): SoundItemType[] => allSpaceSoundboards.flatMap((board) => Object.values(board.content.sounds)),
    [allSpaceSoundboards]
  );

  const allSounds = useMemo((): SoundItemType[] => {
    if (!search) return soundsForSource;
    const q = search.toLowerCase();
    return allCommunitySounds.filter(
      (sound) =>
        sound.title.toLowerCase().includes(q) ||
        (sound.emoji ?? '').toLowerCase().includes(q) ||
        (sound.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
    );
  }, [search, soundsForSource, allCommunitySounds]);

  const favoriteIds = useMemo(
    () => new Set(favoriteSounds.map((favorite) => favorite.soundId)),
    [favoriteSounds]
  );

  const playingUrls = useMemo(() => new Set(playingByUrl.keys()), [playingByUrl]);

  const favoriteSoundItems = useMemo((): SoundItemType[] => {
    if (favoriteSounds.length === 0) return [];
    const allSoundsMap = new Map<string, SoundItemType>();
    for (const board of allSpaceSoundboards) {
      for (const [id, sound] of Object.entries(board.content.sounds)) {
        allSoundsMap.set(id, sound);
      }
    }
    return favoriteSounds
      .map((favorite) => allSoundsMap.get(favorite.soundId))
      .filter((sound): sound is SoundItemType => sound !== undefined);
  }, [favoriteSounds, allSpaceSoundboards]);

  const resolveUrl = useCallback(
    (url: string): string => {
      if (!url.startsWith('mxc://')) return url;
      return mx.mxcUrlToHttp(url) ?? url;
    },
    [mx]
  );

  const handlePlay = useCallback(
    (sound: SoundItemType) => {
      const resolvedUrl = resolveUrl(sound.url);
      const clipId = playSoundboardClip(resolvedUrl, sound.volume * volume);
      if (clipId) {
        setPlayingByUrl((prev) => new Map(prev).set(sound.url, clipId));
      }
    },
    [playSoundboardClip, resolveUrl, volume]
  );

  const handleStop = useCallback(
    (sound: SoundItemType) => {
      const clipId = playingByUrl.get(sound.url);
      if (clipId) {
        stopSoundboardClip(clipId);
        setPlayingByUrl((prev) => {
          const next = new Map(prev);
          next.delete(sound.url);
          return next;
        });
      }
    },
    [stopSoundboardClip, playingByUrl]
  );

  const handleToggleFavorite = useCallback(
    async (sound: SoundItemType) => {
      for (const board of allSpaceSoundboards) {
        if (board.content.sounds[sound.id]) {
          if (favoriteIds.has(sound.id)) {
            await removeFavoriteSound(mx, board.spaceId, board.boardId, sound.id);
          } else {
            await addFavoriteSound(mx, board.spaceId, board.boardId, sound.id);
          }
          return;
        }
      }
    },
    [mx, allSpaceSoundboards, favoriteIds]
  );

  const isSearching = search.trim().length > 0;

  const sections = useMemo(() => {
    if (isSearching) {
      return [{ title: `Ergebnisse fur "${search}"`, sounds: allSounds }];
    }
    if (!selectedSourceId) return [];
    const boards = spaceMap.get(selectedSourceId) ?? [];
    return boards.map((board) => ({
      title: board.content.name,
      sounds: Object.values(board.content.sounds),
    }));
  }, [isSearching, search, allSounds, selectedSourceId, spaceMap]);

  return (
    <div className={styles.panel} ref={panelRef}>
      <div className={styles.header}>
        <div className={styles.searchWrap}>
          <MagnifyingGlass size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Finde den perfekten Sound"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Suche Sounds"
          />
        </div>

        <div className={styles.headerActions}>
          <div className={styles.volumeWrap}>
            <VolumeButton onClick={() => setShowVolumeSlider((v) => !v)} active={showVolumeSlider} />
            {showVolumeSlider && (
              <div className={styles.volumePopover}>
                <span className={styles.volumeLabel}>{Math.round(volume * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className={styles.volumeSlider}
                  aria-label="Soundboard volume"
                />
              </div>
            )}
          </div>

          <button className={styles.closeBtn} onClick={onClose} aria-label="Soundboard schliessen">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className={styles.body}>
        <SoundboardSourceRail
          sources={sources}
          selectedId={selectedSourceId}
          onSelect={setSelectedSourceId}
        />

        <div className={styles.content}>
          {!isSearching && favoriteSoundItems.length > 0 && (
            <SoundboardSection
              title="Meine Favoriten"
              sounds={favoriteSoundItems}
              playingUrls={playingUrls}
              favoriteIds={favoriteIds}
              onPlay={handlePlay}
              onStop={handleStop}
              onToggleFavorite={handleToggleFavorite}
              defaultOpen
            />
          )}

          {sections.map((section) => (
            <SoundboardSection
              key={section.title}
              title={section.title}
              sounds={section.sounds}
              playingUrls={playingUrls}
              favoriteIds={favoriteIds}
              onPlay={handlePlay}
              onStop={handleStop}
              onToggleFavorite={handleToggleFavorite}
              defaultOpen
            />
          ))}

          {sections.every((section) => section.sounds.length === 0) && !favoriteSoundItems.length && (
            <div className={styles.emptyState}>Keine Sounds</div>
          )}
        </div>
      </div>
    </div>
  );
}
