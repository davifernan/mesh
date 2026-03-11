import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { X, MagnifyingGlass, CaretDown, CaretRight } from '@phosphor-icons/react';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useCallState } from '../../pages/client/call/CallProvider';
import { ImportSoundModal } from '../../features/soundboard-import/ImportSoundModal';
import { useAllJoinedSpaceSoundboards } from '../../plugins/soundboard/soundboardPlugin';
import { useFavoriteSounds, addFavoriteSound, removeFavoriteSound } from '../../plugins/soundboard/favoriteSounds';
import type { SoundItem as SoundItemType, ResolvedSoundboard } from '../../plugins/soundboard/types';
import {
  BUILTIN_SOUNDBOARD,
  BUILTIN_SOUNDBOARD_SPACE_ID,
} from '../../plugins/soundboard/defaultSoundboard';
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

  const joinedSpaceSoundboards = useAllJoinedSpaceSoundboards(mx);
  const allBoards = useMemo(() => [BUILTIN_SOUNDBOARD, ...joinedSpaceSoundboards], [joinedSpaceSoundboards]);
  const favoriteSounds = useFavoriteSounds() ?? [];

  const [search, setSearch] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [playingByUrl, setPlayingByUrl] = useState<Map<string, string>>(new Map());

  const panelRef = useRef<HTMLDivElement>(null);
  const playbackTimeoutsRef = useRef<Map<string, number>>(new Map());

  const spaceMap = useMemo(() => {
    const map = new Map<string, ResolvedSoundboard[]>();
    for (const board of allBoards) {
      if (!map.has(board.spaceId)) map.set(board.spaceId, []);
      map.get(board.spaceId)!.push(board);
    }
    return map;
  }, [allBoards]);

  const sources: SoundboardSource[] = useMemo(() => {
    const result: SoundboardSource[] = [
      { id: BUILTIN_SOUNDBOARD_SPACE_ID, label: 'BetterCord', emoji: '🎛️' },
    ];
    for (const [spaceId] of spaceMap) {
      if (spaceId === BUILTIN_SOUNDBOARD_SPACE_ID) continue;
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

  const allSounds = useMemo((): SoundItemType[] => {
    const everySound = allBoards.flatMap((board) => Object.values(board.content.sounds));
    if (!search) return soundsForSource;
    const q = search.toLowerCase();
    return everySound.filter(
      (sound) =>
        sound.title.toLowerCase().includes(q) ||
        (sound.emoji ?? '').toLowerCase().includes(q) ||
        (sound.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
    );
  }, [search, soundsForSource, allBoards]);

  const favoriteIds = useMemo(
    () => new Set(favoriteSounds.map((favorite) => favorite.soundId)),
    [favoriteSounds]
  );

  const playingUrls = useMemo(() => new Set(playingByUrl.keys()), [playingByUrl]);

  const selectedBoards = useMemo(
    () => (selectedSourceId ? spaceMap.get(selectedSourceId) ?? [] : []),
    [selectedSourceId, spaceMap]
  );

  const firstJoinedSpaceBoard = joinedSpaceSoundboards[0] ?? null;

  const importTarget = useMemo(() => {
    if (selectedSourceId && selectedSourceId !== BUILTIN_SOUNDBOARD_SPACE_ID && selectedBoards[0]) {
      return selectedBoards[0];
    }
    return firstJoinedSpaceBoard;
  }, [firstJoinedSpaceBoard, selectedBoards, selectedSourceId]);

  const importButtonTitle = importTarget
    ? 'Import sound into this soundboard'
    : 'Join a community with a soundboard to import sounds';

  const favoriteSoundItems = useMemo((): SoundItemType[] => {
    if (favoriteSounds.length === 0) return [];
    const allSoundsMap = new Map<string, SoundItemType>();
    for (const board of allBoards) {
      for (const [id, sound] of Object.entries(board.content.sounds)) {
        allSoundsMap.set(id, sound);
      }
    }
    return favoriteSounds
      .map((favorite) => allSoundsMap.get(favorite.soundId))
      .filter((sound): sound is SoundItemType => sound !== undefined);
  }, [favoriteSounds, allBoards]);

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
      const existingTimeout = playbackTimeoutsRef.current.get(sound.url);
      if (existingTimeout !== undefined) {
        window.clearTimeout(existingTimeout);
      }

      const clipId = playSoundboardClip(resolvedUrl, sound.volume * volume);
      if (clipId) {
        setPlayingByUrl((prev) => new Map(prev).set(sound.url, clipId));
        const timeoutMs = (sound.durationMs ?? 4000) + 250;
        const timeoutId = window.setTimeout(() => {
          playbackTimeoutsRef.current.delete(sound.url);
          setPlayingByUrl((prev) => {
            const next = new Map(prev);
            next.delete(sound.url);
            return next;
          });
        }, timeoutMs);
        playbackTimeoutsRef.current.set(sound.url, timeoutId);
      }
    },
    [playSoundboardClip, resolveUrl, volume]
  );

  const handleStop = useCallback(
    (sound: SoundItemType) => {
      const clipId = playingByUrl.get(sound.url);
      const timeoutId = playbackTimeoutsRef.current.get(sound.url);
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        playbackTimeoutsRef.current.delete(sound.url);
      }

      if (clipId) {
        stopSoundboardClip(clipId);
      }

      setPlayingByUrl((prev) => {
        const next = new Map(prev);
        next.delete(sound.url);
        return next;
      });
    },
    [stopSoundboardClip, playingByUrl]
  );

  const handleToggleFavorite = useCallback(
    async (sound: SoundItemType) => {
      for (const board of allBoards) {
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
    [mx, allBoards, favoriteIds]
  );

  const isSearching = search.trim().length > 0;

  const sections = useMemo(() => {
    if (isSearching) {
      return [{ title: `Ergebnisse fur "${search}"`, sounds: allSounds }];
    }
    if (!selectedSourceId) return [];
    return selectedBoards.map((board) => ({
      title: board.content.name,
      sounds: Object.values(board.content.sounds),
    }));
  }, [isSearching, search, allSounds, selectedBoards, selectedSourceId]);

  useEffect(() => () => {
    for (const timeoutId of playbackTimeoutsRef.current.values()) {
      window.clearTimeout(timeoutId);
    }
    playbackTimeoutsRef.current.clear();
  }, []);

  const handleImported = useCallback(() => {
    if (importTarget) {
      setSelectedSourceId(importTarget.spaceId);
    }
    setShowImport(false);
  }, [importTarget]);

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
          <button
            type="button"
            className={styles.importBtn}
            onClick={() => setShowImport(true)}
            disabled={!importTarget}
            title={importButtonTitle}
            aria-label="Import sound"
          >
            Import
          </button>

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

      {showImport && importTarget && (
        <ImportSoundModal
          spaceId={importTarget.spaceId}
          boardId={importTarget.boardId}
          onClose={() => setShowImport(false)}
          onImported={handleImported}
        />
      )}

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
