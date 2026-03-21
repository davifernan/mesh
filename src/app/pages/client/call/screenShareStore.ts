import { atom } from 'jotai';

/**
 * Set of participant identities whose screenshare is currently being watched
 * by the local user. Managed by watchScreenShare / unwatchScreenShare in
 * nativeCallEngine.
 */
export const watchedScreenSharesAtom = atom<ReadonlySet<string>>(
  new Set<string>() as ReadonlySet<string>,
);
