import { atom } from 'jotai';

export interface SpaceUploadSettings {
  /** Max upload size in bytes. 0 means no limit. */
  maxFileSizeBytes: number;
}

export const spaceUploadSettingsAtom = atom<SpaceUploadSettings | null>(null);
