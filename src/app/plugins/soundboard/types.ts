// A single sound item stored in a community soundboard
export type SoundItem = {
  id: string;
  title: string;
  emoji?: string;
  sourceType: 'mxc' | 'url';
  url: string; // mxc:// or https://
  durationMs?: number;
  sizeBytes?: number;
  volume: number; // 0-1, normalized at import
  addedBy: string; // userId
  addedAt: number; // unix timestamp ms
  tags?: string[];
};

// Content of a io.mesh.space.soundboard state event
// state_key = boardId
export type SoundboardContent = {
  name: string;
  emoji?: string;
  sounds: Record<string, SoundItem>; // soundId -> SoundItem
  createdBy: string;
  createdAt: number;
};

// Shape stored in io.mesh.favorite_sounds account data
export type FavoriteSoundsContent = {
  savedSounds?: Array<{
    spaceId: string;
    boardId: string; // state_key of the soundboard event
    soundId: string;
    savedAt: number;
  }>;
};

// A resolved soundboard with its source community info
export type ResolvedSoundboard = {
  spaceId: string;
  boardId: string; // state_key
  content: SoundboardContent;
};
