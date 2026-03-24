import { GiphyFetch } from '@giphy/js-fetch-api';
import type { IGif } from '@giphy/js-types';
import { GifItem } from './types';

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY ?? '';

export const GIPHY_RATING_DEFAULT = 'pg-13' as const;

type GiphyRating = 'g' | 'pg' | 'pg-13' | 'r';

// Singleton SDK instance — exported for use with @giphy/react-components Grid
let _gf: GiphyFetch | null = null;
let _gfKey = '';
export function getGiphyFetch(): GiphyFetch {
  if (!_gf || _gfKey !== GIPHY_API_KEY) {
    _gf = new GiphyFetch(GIPHY_API_KEY);
    _gfKey = GIPHY_API_KEY;
  }
  return _gf;
}

// Map IGif (SDK type) → our internal GifItem
export function mapGif(gif: IGif): GifItem {
  const original = gif.images.original;
  const preview = gif.images.fixed_width;
  return {
    id: gif.id as string,
    provider: 'giphy',
    title: gif.title ?? '',
    url: original.url ?? '',
    previewUrl: preview.url ?? original.url ?? '',
    width: Number(original.width) || 0,
    height: Number(original.height) || 0,
  };
}

// Convenience wrappers (used by non-Grid code paths e.g. getGifById)
export async function searchGifs(
  query: string,
  options: { limit?: number; offset?: number; rating?: GiphyRating } = {}
): Promise<GifItem[]> {
  const { limit = 25, offset = 0, rating = GIPHY_RATING_DEFAULT } = options;
  try {
    const { data } = await getGiphyFetch().search(query, { limit, offset, rating, lang: 'en' });
    return data.map(mapGif);
  } catch {
    return [];
  }
}

export async function getTrendingGifs(
  options: { limit?: number; rating?: GiphyRating } = {}
): Promise<GifItem[]> {
  const { limit = 25, rating = GIPHY_RATING_DEFAULT } = options;
  try {
    const { data } = await getGiphyFetch().trending({ limit, rating, type: 'gifs' });
    return data.map(mapGif);
  } catch {
    return [];
  }
}

export async function getGifById(id: string): Promise<GifItem | null> {
  try {
    const { data } = await getGiphyFetch().gif(id);
    return mapGif(data);
  } catch {
    return null;
  }
}

// Autocomplete suggestions — SDK provides this for free
export async function searchSuggestions(term: string): Promise<string[]> {
  try {
    const { data } = await getGiphyFetch().search(term, { limit: 5, type: 'gifs' });
    return data.map((g) => g.title ?? '').filter(Boolean);
  } catch {
    return [];
  }
}
