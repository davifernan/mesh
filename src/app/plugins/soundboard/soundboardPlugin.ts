import { MatrixClient } from 'matrix-js-sdk';
import { useMemo } from 'react';
import { StateEvent } from '../../../types/matrix/room';
import { getStateEvents } from '../../utils/room';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useStateEvents } from '../../hooks/useStateEvents';
import { ResolvedSoundboard, SoundboardContent, SoundItem } from './types';

// Custom event type string — cast to `any` to bypass SDK's closed StateEvents map
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SOUNDBOARD_EVENT = StateEvent.BetterCordSpaceSoundboard as any;

// Read all soundboards from a space room
export function getSpaceSoundboards(
  mx: MatrixClient,
  spaceId: string
): ResolvedSoundboard[] {
  const room = mx.getRoom(spaceId);
  if (!room) return [];

  return getStateEvents(room, StateEvent.BetterCordSpaceSoundboard).reduce<
    ResolvedSoundboard[]
  >((acc, event) => {
    const boardId = event.getStateKey();
    const content = event.getContent<SoundboardContent>();
    if (!boardId || !content.name) return acc;
    acc.push({ spaceId, boardId, content });
    return acc;
  }, []);
}

// Create a new soundboard in a space (writes a state event)
export async function createSoundboard(
  mx: MatrixClient,
  spaceId: string,
  name: string,
  emoji?: string
): Promise<void> {
  const userId = mx.getUserId();
  if (!userId) throw new Error('Not logged in');

  const boardId = crypto.randomUUID();
  const content: SoundboardContent = {
    name,
    emoji,
    sounds: {},
    createdBy: userId,
    createdAt: Date.now(),
  };

  await mx.sendStateEvent(spaceId, SOUNDBOARD_EVENT, content, boardId);
}

// Delete a soundboard by sending empty content (tombstone pattern)
export async function deleteSoundboard(
  mx: MatrixClient,
  spaceId: string,
  boardId: string
): Promise<void> {
  await mx.sendStateEvent(spaceId, SOUNDBOARD_EVENT, {}, boardId);
}

// Add a sound to an existing soundboard
export async function addSoundToBoard(
  mx: MatrixClient,
  spaceId: string,
  boardId: string,
  sound: Omit<SoundItem, 'id' | 'addedBy' | 'addedAt'>
): Promise<void> {
  const userId = mx.getUserId();
  if (!userId) throw new Error('Not logged in');

  const room = mx.getRoom(spaceId);
  if (!room) throw new Error('Space not found');

  const stateEvents = getStateEvents(room, StateEvent.BetterCordSpaceSoundboard);
  const boardEvent = stateEvents.find((e) => e.getStateKey() === boardId);
  if (!boardEvent) throw new Error('Soundboard not found');

  const current = boardEvent.getContent<SoundboardContent>();
  if (!current.name) throw new Error('Soundboard has been deleted');

  const soundId = crypto.randomUUID();
  const newSound: SoundItem = {
    ...sound,
    id: soundId,
    addedBy: userId,
    addedAt: Date.now(),
  };

  const updated: SoundboardContent = {
    ...current,
    sounds: {
      ...current.sounds,
      [soundId]: newSound,
    },
  };

  await mx.sendStateEvent(spaceId, SOUNDBOARD_EVENT, updated, boardId);
}

// Remove a sound from a soundboard
export async function removeSoundFromBoard(
  mx: MatrixClient,
  spaceId: string,
  boardId: string,
  soundId: string
): Promise<void> {
  const room = mx.getRoom(spaceId);
  if (!room) throw new Error('Space not found');

  const stateEvents = getStateEvents(room, StateEvent.BetterCordSpaceSoundboard);
  const boardEvent = stateEvents.find((e) => e.getStateKey() === boardId);
  if (!boardEvent) throw new Error('Soundboard not found');

  const current = boardEvent.getContent<SoundboardContent>();
  if (!current.name) throw new Error('Soundboard has been deleted');

  const { [soundId]: _removed, ...remainingSounds } = current.sounds;

  const updated: SoundboardContent = {
    ...current,
    sounds: remainingSounds,
  };

  await mx.sendStateEvent(spaceId, SOUNDBOARD_EVENT, updated, boardId);
}

// React hook: reactive list of soundboards in a single space
export function useSpaceSoundboards(spaceId: string): ResolvedSoundboard[] {
  const mx = useMatrixClient();
  const room = mx.getRoom(spaceId) ?? null;

  const events = useStateEvents(room, StateEvent.BetterCordSpaceSoundboard);

  return useMemo(
    () =>
      events.reduce<ResolvedSoundboard[]>((acc, event) => {
        const boardId = event.getStateKey();
        const content = event.getContent<SoundboardContent>();
        if (!boardId || !content.name) return acc;
        acc.push({ spaceId, boardId, content });
        return acc;
      }, []),
    [events, spaceId]
  );
}

// React hook: soundboards from all spaces the user is a member of
export function useAllJoinedSpaceSoundboards(
  mx: MatrixClient
): ResolvedSoundboard[] {
  const rooms = mx.getRooms();

  return useMemo(() => {
    const all: ResolvedSoundboard[] = [];
    for (const room of rooms) {
      if (!room.isSpaceRoom()) continue;
      if (room.getMyMembership() !== 'join') continue;

      const events = getStateEvents(room, StateEvent.BetterCordSpaceSoundboard);
      for (const event of events) {
        const boardId = event.getStateKey();
        const content = event.getContent<SoundboardContent>();
        if (!boardId || !content.name) continue;
        all.push({ spaceId: room.roomId, boardId, content });
      }
    }
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms]);
}
