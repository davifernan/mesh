import React, { useState, useMemo, useCallback, useRef } from 'react';
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

// ── Built-in BetterCord sounds (from public/sound/) ──────────────────────────
// These are UI / call sounds that happen to also be playable as soundboard clips.
const DEFAULT_SOUNDS: SoundItemType[] = [
  {
    id: 'bc-mute',
    title: 'Mute',
    emoji: '🔇',
    sourceType: 'url',
    url: '/sound/mute.mp3',
    volume: 0.8,
    addedBy: 'system',
    addedAt: 0,
  },
  {
    id: 'bc-unmute',
    title: 'Unmute',
    emoji: '🔊',
    sourceType: 'url',
    url: '/sound/unmute.mp3',
    volume: 0.8,
    addedBy: 'system',
    addedAt: 0,
  },
  {
    id: 'bc-user-join',
    title: 'User Join',
    emoji: '👋',
    sourceType: 'url',
    url: '/sound/user-join.mp3',
    volume: 0.8,
    addedBy: 'system',
    addedAt: 0,
  },
  {
    id: 'bc-user-leave',
    title: 'User Leave',
    emoji: '🚪',
    sourceType: 'url',
    url: '/sound/user-leave.mp3',
    volume: 0.8,
    addedBy: 'system',
    addedAt: 0,
  },
  {
    id: 'bc-stream-start',
    title: 'Stream Start',
    emoji: '📺',
    sourceType: 'url',
    url: '/sound/stream-start.mp3',
    volume: 0.8,
    addedBy: 'system',
    addedAt: 0,
  },
  {
    id: 'bc-disconnect',
    title: 'Disconnect',
    emoji: '📴',
    sourceType: 'url',
    url: '/sound/voice-disconnect.mp3',
    volume: 0.8,
    addedBy: 'system',
    addedAt: 0,
  },
];

const DEFAULTS_SOURCE_ID = 'defaults';

// ── Section component ─────────────────────────────────────────────────────────

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

// ── Main panel ────────────────────────────────────────────────────────────────

type SoundboardPanelProps = {
  onClose: () => void;
};

export function SoundboardPanel({ onClose }: SoundboardPanelProps) {
  const mx = useMatrixClient();
  const { playSoundboardClip, stopSoundboardClip } = useCallState();

  const allSpaceSoundboards = useAllJoinedSpaceSoundboards(mx);
  const favoriteSounds = useFavoriteSounds() ?? [];

  const [search, setSearch] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState<string>(DEFAULTS_SOURCE_ID);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [volume, setVolume] = useState(0.8);

  // Track playing clips: Map<soundUrl, clipId>
  const [playingByUrl, setPlayingByUrl] = useState<Map<string, string>>(new Map());

  const panelRef = useRef<HTMLDivElement>(null);

  // ── Sources ─────────────────────────────────────────────────────────────────
  // Group community soundboards by spaceId
  const spaceMap = useMemo(() => {
    const map = new Map<string, ResolvedSoundboard[]>();
    for (const board of allSpaceSoundboards) {
      if (!map.has(board.spaceId)) map.set(board.spaceId, []);
      map.get(board.spaceId)!.push(board);
    }
    return map;
  }, [allSpaceSoundboards]);

  const sources: SoundboardSource[] = useMemo(() => {
    const result: SoundboardSource[] = [
      { id: DEFAULTS_SOURCE_ID, label: 'BetterCord Sounds', emoji: '🎵' },
    ];
    for (const [spaceId] of spaceMap) {
      const room = mx.getRoom(spaceId);
      const label = room?.name ?? spaceId;
      const avatarUrl = room?.getAvatarUrl(mx.baseUrl, 36, 36, 'crop') ?? undefined;
      const emoji = room?.name?.slice(0, 2) ?? '🔊';
      result.push({ id: spaceId, label, avatarUrl: avatarUrl ?? undefined, emoji });
    }
    return result;
  }, [spaceMap, mx]);

  // ── All sounds flat list (filtered by selected source) ──────────────────────
  const soundsForSource = useMemo((): SoundItemType[] => {
    if (selectedSourceId === DEFAULTS_SOURCE_ID) return DEFAULT_SOUNDS;
    const boards = spaceMap.get(selectedSourceId) ?? [];
    return boards.flatMap((b) => Object.values(b.content.sounds));
  }, [selectedSourceId, spaceMap]);

  // ── Search filter (across all sources when search is non-empty) ─────────────
  const allSounds = useMemo((): SoundItemType[] => {
    if (!search) return soundsForSource;
    const q = search.toLowerCase();
    const all: SoundItemType[] = [
      ...DEFAULT_SOUNDS,
      ...allSpaceSoundboards.flatMap((b) => Object.values(b.content.sounds)),
    ];
    return all.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.emoji ?? '').toLowerCase().includes(q) ||
        (s.tags ?? []).some((t) => t.toLowerCase().includes(q))
    );
  }, [search, soundsForSource, allSpaceSoundboards]);

  // ── Favorite sound IDs ───────────────────────────────────────────────────────
  const favoriteIds = useMemo(
    () => new Set(favoriteSounds.map((f) => f.soundId)),
    [favoriteSounds]
  );

  // ── Playing URL set ─────────────────────────────────────────────────────────
  const playingUrls = useMemo(() => new Set(playingByUrl.keys()), [playingByUrl]);

  // ── Favorite sounds resolved ────────────────────────────────────────────────
  const favoriteSoundItems = useMemo((): SoundItemType[] => {
    if (favoriteSounds.length === 0) return [];
    const allSoundsMap = new Map<string, SoundItemType>();
    for (const s of DEFAULT_SOUNDS) allSoundsMap.set(s.id, s);
    for (const b of allSpaceSoundboards) {
      for (const [id, s] of Object.entries(b.content.sounds)) allSoundsMap.set(id, s);
    }
    return favoriteSounds
      .map((f) => allSoundsMap.get(f.soundId))
      .filter((s): s is SoundItemType => s !== undefined);
  }, [favoriteSounds, allSpaceSoundboards]);

  // ── URL resolver: converts mxc:// URIs to authenticated HTTP URLs ────────────
  const resolveUrl = useCallback(
    (url: string): string => {
      if (!url.startsWith('mxc://')) return url;
      return mx.mxcUrlToHttp(url) ?? url;
    },
    [mx]
  );

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handlePlay = useCallback(
    (sound: SoundItemType) => {
      const resolvedUrl = resolveUrl(sound.url);
      const clipId = playSoundboardClip(resolvedUrl, sound.volume * volume);
      if (clipId) {
        // Track by original URL so stop/playing-state lookup stays consistent
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
      // Find which board this sound belongs to
      const isDefaultSound = DEFAULT_SOUNDS.some((s) => s.id === sound.id);
      if (isDefaultSound) return; // Default sounds can't be favorited via Matrix account data

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

  // ── Sections to render ───────────────────────────────────────────────────────
  const isSearching = search.trim().length > 0;

  // When searching, show one flat section. Otherwise show sections per source.
  const sections = useMemo(() => {
    if (isSearching) {
      return [{ title: `Ergebnisse für "${search}"`, sounds: allSounds }];
    }
    if (selectedSourceId === DEFAULTS_SOURCE_ID) {
      return [{ title: 'BetterCord Sounds', sounds: DEFAULT_SOUNDS }];
    }
    const boards = spaceMap.get(selectedSourceId) ?? [];
    return boards.map((b) => ({
      title: b.content.name,
      sounds: Object.values(b.content.sounds),
    }));
  }, [isSearching, search, allSounds, selectedSourceId, spaceMap]);

  return (
    <div className={styles.panel} ref={panelRef}>
      {/* Header */}
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
          {/* Volume control */}
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

          {/* Close */}
          <button className={styles.closeBtn} onClick={onClose} aria-label="Soundboard schließen">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body: rail + content */}
      <div className={styles.body}>
        <SoundboardSourceRail
          sources={sources}
          selectedId={selectedSourceId}
          onSelect={setSelectedSourceId}
        />

        <div className={styles.content}>
          {/* Favorites section (always shown at top, outside source filter) */}
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

          {sections.map((sec) => (
            <SoundboardSection
              key={sec.title}
              title={sec.title}
              sounds={sec.sounds}
              playingUrls={playingUrls}
              favoriteIds={favoriteIds}
              onPlay={handlePlay}
              onStop={handleStop}
              onToggleFavorite={handleToggleFavorite}
              defaultOpen
            />
          ))}

          {sections.every((s) => s.sounds.length === 0) && !favoriteSoundItems.length && (
            <div className={styles.emptyState}>Keine Sounds</div>
          )}
        </div>
      </div>
    </div>
  );
}
