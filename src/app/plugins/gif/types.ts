export type GifItem = {
  id: string;
  provider: 'giphy' | 'community';
  title: string;
  url: string; // direct gif URL or mxc://
  previewUrl: string; // smaller preview
  width: number;
  height: number;
  addedBy?: string;
  addedAt?: number;
};

export type GifCollectionContent = {
  name: string;
  emoji?: string;
  gifs: Record<string, GifItem>; // gifId -> GifItem
  createdBy: string;
  createdAt: number;
};

export type FavoriteGifsContent = {
  savedGifs?: Array<{
    id: string;
    provider: 'giphy' | 'community';
    spaceId?: string;
    collectionId?: string;
    // Snapshot fields for GIPHY (since we can't store the asset)
    title: string;
    url: string;
    previewUrl: string;
    width: number;
    height: number;
    savedAt: number;
  }>;
};

export type ResolvedGifCollection = {
  spaceId: string;
  collectionId: string;
  content: GifCollectionContent;
};
