import { MatrixClient } from 'matrix-js-sdk';
import { useMemo } from 'react';
import { StateEvent } from '../../../types/matrix/room';
import { getStateEvents } from '../../utils/room';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useStateEvents } from '../../hooks/useStateEvents';
import { GifCollectionContent, GifItem, ResolvedGifCollection } from './types';

// Custom event type string — cast to `any` to bypass SDK's closed StateEvents map
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GIF_COLLECTION_EVENT = StateEvent.meshSpaceGifCollection as any;

// Read all GIF collections from a space room
export function getSpaceGifCollections(
  mx: MatrixClient,
  spaceId: string
): ResolvedGifCollection[] {
  const room = mx.getRoom(spaceId);
  if (!room) return [];

  return getStateEvents(room, StateEvent.meshSpaceGifCollection).reduce<
    ResolvedGifCollection[]
  >((acc, event) => {
    const collectionId = event.getStateKey();
    const content = event.getContent<GifCollectionContent>();
    if (!collectionId || !content.name) return acc;
    acc.push({ spaceId, collectionId, content });
    return acc;
  }, []);
}

// Create a new GIF collection in a space
export async function createGifCollection(
  mx: MatrixClient,
  spaceId: string,
  name: string,
  emoji?: string
): Promise<void> {
  const userId = mx.getUserId();
  if (!userId) throw new Error('Not logged in');

  const collectionId = crypto.randomUUID();
  const content: GifCollectionContent = {
    name,
    emoji,
    gifs: {},
    createdBy: userId,
    createdAt: Date.now(),
  };

  await mx.sendStateEvent(spaceId, GIF_COLLECTION_EVENT, content, collectionId);
}

// Delete a GIF collection by sending empty content (tombstone pattern)
export async function deleteGifCollection(
  mx: MatrixClient,
  spaceId: string,
  collectionId: string
): Promise<void> {
  await mx.sendStateEvent(spaceId, GIF_COLLECTION_EVENT, {}, collectionId);
}

// Add a GIF to an existing collection
export async function addGifToCollection(
  mx: MatrixClient,
  spaceId: string,
  collectionId: string,
  gif: Omit<GifItem, 'id' | 'addedBy' | 'addedAt'>
): Promise<void> {
  const userId = mx.getUserId();
  if (!userId) throw new Error('Not logged in');

  const room = mx.getRoom(spaceId);
  if (!room) throw new Error('Space not found');

  const stateEvents = getStateEvents(room, StateEvent.meshSpaceGifCollection);
  const collectionEvent = stateEvents.find((e) => e.getStateKey() === collectionId);
  if (!collectionEvent) throw new Error('GIF collection not found');

  const current = collectionEvent.getContent<GifCollectionContent>();
  if (!current.name) throw new Error('GIF collection has been deleted');

  const gifId = crypto.randomUUID();
  const newGif: GifItem = {
    ...gif,
    id: gifId,
    addedBy: userId,
    addedAt: Date.now(),
  };

  const updated: GifCollectionContent = {
    ...current,
    gifs: {
      ...current.gifs,
      [gifId]: newGif,
    },
  };

  await mx.sendStateEvent(spaceId, GIF_COLLECTION_EVENT, updated, collectionId);
}

// Remove a GIF from a collection
export async function removeGifFromCollection(
  mx: MatrixClient,
  spaceId: string,
  collectionId: string,
  gifId: string
): Promise<void> {
  const room = mx.getRoom(spaceId);
  if (!room) throw new Error('Space not found');

  const stateEvents = getStateEvents(room, StateEvent.meshSpaceGifCollection);
  const collectionEvent = stateEvents.find((e) => e.getStateKey() === collectionId);
  if (!collectionEvent) throw new Error('GIF collection not found');

  const current = collectionEvent.getContent<GifCollectionContent>();
  if (!current.name) throw new Error('GIF collection has been deleted');

  const { [gifId]: _removed, ...remainingGifs } = current.gifs;

  const updated: GifCollectionContent = {
    ...current,
    gifs: remainingGifs,
  };

  await mx.sendStateEvent(spaceId, GIF_COLLECTION_EVENT, updated, collectionId);
}

// React hook: reactive list of GIF collections in a single space
export function useSpaceGifCollections(spaceId: string): ResolvedGifCollection[] {
  const mx = useMatrixClient();
  const room = mx.getRoom(spaceId) ?? null;

  const events = useStateEvents(room, StateEvent.meshSpaceGifCollection);

  return useMemo(
    () =>
      events.reduce<ResolvedGifCollection[]>((acc, event) => {
        const collectionId = event.getStateKey();
        const content = event.getContent<GifCollectionContent>();
        if (!collectionId || !content.name) return acc;
        acc.push({ spaceId, collectionId, content });
        return acc;
      }, []),
    [events, spaceId]
  );
}
