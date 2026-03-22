import { MatrixClient } from 'matrix-js-sdk';
import { AccountDataEvent } from '../../../types/matrix/accountData';
import { getAccountData } from '../../utils/room';
import { useAccountData } from '../../hooks/useAccountData';
import { FavoriteGifsContent } from './types';

const MAX_FAVORITE_GIFS = 200;

type SavedGif = NonNullable<FavoriteGifsContent['savedGifs']>[number];

// Read the current saved GIFs list from account data
export function getFavoriteGifs(
  mx: MatrixClient
): FavoriteGifsContent['savedGifs'] {
  const event = getAccountData(mx, AccountDataEvent.meshFavoriteGifs);
  return event?.getContent<FavoriteGifsContent>().savedGifs ?? [];
}

// Add a GIF to favorites (max 200, drops oldest if exceeded)
export async function addFavoriteGif(
  mx: MatrixClient,
  gif: Omit<SavedGif, 'savedAt'>
): Promise<void> {
  const current = getFavoriteGifs(mx) ?? [];

  // Avoid duplicate by id
  const filtered = current.filter((g) => g.id !== gif.id);

  const entry: SavedGif = { ...gif, savedAt: Date.now() };
  const next = [...filtered, entry];

  // Drop oldest entries (front of array) when over the limit
  const capped =
    next.length > MAX_FAVORITE_GIFS
      ? next.slice(next.length - MAX_FAVORITE_GIFS)
      : next;

  const updated: FavoriteGifsContent = { savedGifs: capped };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await mx.setAccountData(AccountDataEvent.meshFavoriteGifs as any, updated as any);
}

// Remove a GIF from favorites by its id
export async function removeFavoriteGif(
  mx: MatrixClient,
  gifId: string
): Promise<void> {
  const current = getFavoriteGifs(mx) ?? [];

  const updated: FavoriteGifsContent = {
    savedGifs: current.filter((g) => g.id !== gifId),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await mx.setAccountData(AccountDataEvent.meshFavoriteGifs as any, updated as any);
}

// Check whether a specific GIF is already favorited
export function isFavoriteGif(mx: MatrixClient, gifId: string): boolean {
  const current = getFavoriteGifs(mx) ?? [];
  return current.some((g) => g.id === gifId);
}

// React hook: reactive list of favorite GIFs
export function useFavoriteGifs(): FavoriteGifsContent['savedGifs'] {
  const event = useAccountData(AccountDataEvent.meshFavoriteGifs);
  return event?.getContent<FavoriteGifsContent>().savedGifs ?? [];
}
