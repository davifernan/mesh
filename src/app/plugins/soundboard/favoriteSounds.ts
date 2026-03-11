import { MatrixClient } from 'matrix-js-sdk';
import { AccountDataEvent } from '../../../types/matrix/accountData';
import { getAccountData } from '../../utils/room';
import { useAccountData } from '../../hooks/useAccountData';
import { FavoriteSoundsContent } from './types';

// Read the current saved sounds list from account data
export function getFavoriteSounds(
  mx: MatrixClient
): FavoriteSoundsContent['savedSounds'] {
  const event = getAccountData(mx, AccountDataEvent.BetterCordFavoriteSounds);
  return event?.getContent<FavoriteSoundsContent>().savedSounds ?? [];
}

// Add a sound to the personal favorites list
export async function addFavoriteSound(
  mx: MatrixClient,
  spaceId: string,
  boardId: string,
  soundId: string
): Promise<void> {
  const current = getFavoriteSounds(mx) ?? [];

  // Avoid duplicates
  const alreadySaved = current.some(
    (s) => s.spaceId === spaceId && s.boardId === boardId && s.soundId === soundId
  );
  if (alreadySaved) return;

  const updated: FavoriteSoundsContent = {
    savedSounds: [
      ...current,
      { spaceId, boardId, soundId, savedAt: Date.now() },
    ],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await mx.setAccountData(AccountDataEvent.BetterCordFavoriteSounds as any, updated as any);
}

// Remove a sound from the personal favorites list
export async function removeFavoriteSound(
  mx: MatrixClient,
  spaceId: string,
  boardId: string,
  soundId: string
): Promise<void> {
  const current = getFavoriteSounds(mx) ?? [];

  const updated: FavoriteSoundsContent = {
    savedSounds: current.filter(
      (s) =>
        !(s.spaceId === spaceId && s.boardId === boardId && s.soundId === soundId)
    ),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await mx.setAccountData(AccountDataEvent.BetterCordFavoriteSounds as any, updated as any);
}

// Check whether a specific sound is already favorited
export function isFavoriteSound(
  mx: MatrixClient,
  spaceId: string,
  boardId: string,
  soundId: string
): boolean {
  const current = getFavoriteSounds(mx) ?? [];
  return current.some(
    (s) => s.spaceId === spaceId && s.boardId === boardId && s.soundId === soundId
  );
}

// React hook: reactive list of favorite sounds
export function useFavoriteSounds(): FavoriteSoundsContent['savedSounds'] {
  const event = useAccountData(AccountDataEvent.BetterCordFavoriteSounds);
  return event?.getContent<FavoriteSoundsContent>().savedSounds ?? [];
}
