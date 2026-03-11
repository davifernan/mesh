import { createContext } from 'react';
import type { CallPresenceState } from './callPresenceState';

const EMPTY_SNAPSHOT: ReadonlyMap<string, CallPresenceState> = new Map();

export type BridgePresenceContextValue = {
  /** Oeffnet SSE-Verbindung fuer roomId (ref-counted). Gibt cleanup zurueck. */
  subscribeSSE: (roomId: string) => () => void;
  /** Registriert einen useSyncExternalStore-Listener fuer eine Room. Gibt cleanup zurueck. */
  subscribeToUpdates: (roomId: string, listener: () => void) => () => void;
  /** Gibt den aktuellen Presence-Snapshot zurueck. Stabile Referenz wenn unveraendert. */
  getSnapshot: (roomId: string) => ReadonlyMap<string, CallPresenceState>;
};

export const BridgePresenceContext = createContext<BridgePresenceContextValue>({
  subscribeSSE: () => () => {},
  subscribeToUpdates: () => () => {},
  getSnapshot: () => EMPTY_SNAPSHOT,
});
