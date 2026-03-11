import { atom } from 'jotai';

// Map from spaceId → boolean: true if any child room has active call members
export const spaceVoiceActivityAtom = atom<Map<string, boolean>>(new Map());

// Derived read-only atom for a specific space
export function selectSpaceHasVoiceActivity(spaceId: string) {
  return atom((get) => get(spaceVoiceActivityAtom).get(spaceId) ?? false);
}

// Map from spaceId → boolean: true if any child room has active screenshare
export const spaceLiveActivityAtom = atom<Map<string, boolean>>(new Map());

// Derived read-only atom for a specific space
export function selectSpaceHasLiveActivity(spaceId: string) {
  return atom((get) => get(spaceLiveActivityAtom).get(spaceId) ?? false);
}
