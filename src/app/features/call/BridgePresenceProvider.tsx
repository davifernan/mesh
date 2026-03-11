// src/app/features/call/BridgePresenceProvider.tsx

import React, { ReactNode, useCallback, useMemo, useRef } from 'react';
import type { CallPresenceState } from './callPresenceState';
import { BridgePresenceContext, type BridgePresenceContextValue } from './BridgePresenceContext';
import { useClientConfig } from '../../hooks/useClientConfig';

// Shape eines einzelnen Bridge SSE/REST payloads
type BridgePayload = {
  userId: string;
  type: 'update' | 'left';
  isMicMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isDeafened: boolean;
  updatedAt: number;
  /**
   * Monotonic per-room sequence number from the bridge store.
   * Present on all events from bridge v2+. Absent on legacy payloads
   * (seq === undefined) — fall back to updatedAt comparison in that case.
   */
  seq?: number;
};

/**
 * Sentinel event sent by the bridge after replaying the initial snapshot.
 * All events with seq ≤ snapshotSeq are from the snapshot; events with
 * seq > snapshotSeq are live updates.
 */
type SnapshotEndPayload = {
  type: 'snapshot_end';
  seq: number;
};

// Interner Zustand pro Room
type ConnectionEntry = {
  presence: Map<string, CallPresenceState & { updatedAt: number; seq: number }>;
  subscriberCount: number;
  listeners: Set<() => void>;
  es: EventSource | null;
  backoff: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
  restoreAbort: AbortController | null;
  /**
   * The highest seq received from the snapshot_end sentinel on the current
   * SSE connection. Live events with seq ≤ this value are duplicates from
   * the snapshot replay and are discarded.
   * -1 = snapshot_end not yet received (accept all events during replay).
   */
  snapshotSeq: number;
  // Stabiler snapshot fuer useSyncExternalStore (new Map nur wenn Daten aendern)
  snapshot: ReadonlyMap<string, CallPresenceState>;
};

const MAX_BACKOFF_MS = 30_000;
const EMPTY_MAP: ReadonlyMap<string, CallPresenceState> = new Map();

type Props = { children: ReactNode };

export function BridgePresenceProvider({ children }: Props) {
  const { presenceUrl } = useClientConfig();
  // Stable ref so URL changes don't invalidate callbacks
  const presenceBaseRef = useRef<string>(presenceUrl ?? '/api/presence');
  presenceBaseRef.current = presenceUrl ?? '/api/presence';

  // Pool lebt in einem Ref (kein State) – Reactivity laeuft ueber listeners
  const pool = useRef<Map<string, ConnectionEntry>>(new Map());

  // Erstellt leeren Entry falls nicht vorhanden
  function ensureEntry(roomId: string): ConnectionEntry {
    if (!pool.current.has(roomId)) {
      pool.current.set(roomId, {
        presence: new Map(),
        subscriberCount: 0,
        listeners: new Set(),
        es: null,
        backoff: 1_000,
        retryTimer: null,
        restoreAbort: null,
        snapshotSeq: -1,
        snapshot: EMPTY_MAP,
      });
    }
    return pool.current.get(roomId)!;
  }

  // Notifiziert alle Listeners einer Room + aktualisiert stabilen Snapshot
  function notifyListeners(roomId: string): void {
    const entry = pool.current.get(roomId);
    if (!entry) return;
    // Neue Map-Referenz damit useSyncExternalStore Aenderung erkennt
    entry.snapshot = new Map(
      Array.from(entry.presence.entries()).map(([uid, { updatedAt: _at, seq: _seq, ...state }]) => [uid, state])
    );
    for (const l of entry.listeners) l();
  }

  /**
   * Determine whether an incoming event should be applied.
   *
   * Ordering rules (highest priority first):
   *   1. If both sides have seq: use seq (strictly monotonic, no clock skew).
   *   2. If only one side has seq: the one with seq wins (newer bridge version).
   *   3. Neither has seq: fall back to updatedAt (legacy behaviour).
   *
   * During snapshot replay (snapshotSeq === -1) all events are accepted so
   * the snapshot populates the map. After snapshot_end, live events with
   * seq ≤ snapshotSeq are discarded (already covered by the snapshot).
   */
  function isNewer(
    incoming: BridgePayload,
    existing: (CallPresenceState & { updatedAt: number; seq: number }) | undefined,
    snapshotSeq: number,
  ): boolean {
    const inSeq = incoming.seq;

    // After snapshot_end: discard live events that were already in the snapshot
    if (snapshotSeq >= 0 && inSeq !== undefined && inSeq <= snapshotSeq) {
      return false;
    }

    if (!existing) return true;

    const exSeq = existing.seq;

    if (inSeq !== undefined && exSeq !== undefined && exSeq > 0) {
      return inSeq > exSeq;
    }
    if (inSeq !== undefined && (exSeq === undefined || exSeq === 0)) {
      return true; // incoming has seq, existing doesn't — incoming is newer
    }
    // Fallback: wall-clock comparison (legacy payloads without seq)
    return incoming.updatedAt >= existing.updatedAt;
  }

  // Oeffnet SSE-Verbindung fuer roomId
  function openSSE(roomId: string): void {
    const entry = ensureEntry(roomId);
    if (entry.es) return; // schon offen

    function connect(): void {
      const e = pool.current.get(roomId);
      if (!e || e.subscriberCount === 0) return;
      e.retryTimer = null;
      // Reset snapshotSeq for the new connection — we haven't received
      // snapshot_end yet so accept all events during replay.
      e.snapshotSeq = -1;

      const url = `${presenceBaseRef.current}/${encodeURIComponent(roomId)}/stream`;
      const es = new EventSource(url);
      e.es = es;

      es.onmessage = (ev: MessageEvent<string>) => {
        const en = pool.current.get(roomId);
        if (!en) return;
        try {
          const raw = JSON.parse(ev.data) as BridgePayload | SnapshotEndPayload;

          // ── snapshot_end sentinel ─────────────────────────────────────────
          if (raw.type === 'snapshot_end') {
            en.snapshotSeq = (raw as SnapshotEndPayload).seq;
            // No presence change — no notify needed
            return;
          }

          const p = raw as BridgePayload;
          let changed = false;

          if (p.type === 'left') {
            const existing = en.presence.get(p.userId);
            if (existing && isNewer(p, existing, en.snapshotSeq)) {
              en.presence.delete(p.userId);
              changed = true;
            }
          } else {
            const existing = en.presence.get(p.userId);
            if (isNewer(p, existing, en.snapshotSeq)) {
              en.presence.set(p.userId, {
                isMicMuted: p.isMicMuted,
                isCameraOn: p.isCameraOn,
                isScreenSharing: p.isScreenSharing,
                isDeafened: p.isDeafened,
                updatedAt: p.updatedAt,
                seq: p.seq ?? 0,
              });
              changed = true;
            }
          }
          en.backoff = 1_000;
          if (changed) {
            notifyListeners(roomId);
          }
        } catch {
          // Malformed JSON – ignorieren
        }
      };

      es.onerror = () => {
        const en = pool.current.get(roomId);
        if (!en) return;
        es.close();
        en.es = null;
        if (en.subscriberCount === 0) return;
        const delay = en.backoff;
        en.backoff = Math.min(delay * 2, MAX_BACKOFF_MS);
        en.retryTimer = setTimeout(connect, delay);
      };
    }

    connect();
  }

  // Schliesst SSE fuer roomId (aber behaelt presence-Cache)
  function closeSSE(roomId: string): void {
    const entry = pool.current.get(roomId);
    if (!entry) return;
    entry.es?.close();
    entry.es = null;
    if (entry.retryTimer !== null) {
      clearTimeout(entry.retryTimer);
      entry.retryTimer = null;
    }
    entry.restoreAbort?.abort();
    entry.restoreAbort = null;
    entry.backoff = 1_000;
    entry.snapshotSeq = -1;
  }

  // REST Bootstrap: holt aktuellen Snapshot vom Server
  // NOTE: With the subscribe-first SSE approach, the SSE stream already sends
  // the snapshot on connect. This REST bootstrap is kept as a belt-and-suspenders
  // fallback for cases where the SSE connection is slow to establish.
  function bootstrapREST(roomId: string): void {
    const entry = ensureEntry(roomId);
    const abort = new AbortController();
    entry.restoreAbort = abort;

    fetch(`${presenceBaseRef.current}/${encodeURIComponent(roomId)}`, { signal: abort.signal })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as Record<string, Partial<BridgePayload>>;
        const e = pool.current.get(roomId);
        if (!e) return;
        let changed = false;
        for (const [userId, payload] of Object.entries(data)) {
          const incoming = payload as BridgePayload;
          const existing = e.presence.get(userId);
          const incomingTs = typeof incoming.updatedAt === 'number' ? incoming.updatedAt : 0;
          const incomingSeq = typeof incoming.seq === 'number' ? incoming.seq : 0;
          if (isNewer({ ...incoming, updatedAt: incomingTs, seq: incomingSeq }, existing, e.snapshotSeq)) {
            e.presence.set(userId, {
              isMicMuted: incoming.isMicMuted ?? false,
              isCameraOn: incoming.isCameraOn ?? false,
              isScreenSharing: incoming.isScreenSharing ?? false,
              isDeafened: incoming.isDeafened ?? false,
              updatedAt: incomingTs,
              seq: incomingSeq,
            });
            changed = true;
          }
        }
        if (changed) notifyListeners(roomId);
      })
      .catch(() => {
        // Bootstrap ist best-effort – SSE laeuft weiter
      });
  }

  const subscribeSSE = useCallback((roomId: string): (() => void) => {
    const entry = ensureEntry(roomId);
    entry.subscriberCount += 1;

    if (entry.subscriberCount === 1) {
      // Erster Subscriber: SSE oeffnen (SSE stream sends snapshot on connect)
      // REST bootstrap is belt-and-suspenders for slow SSE establishment
      bootstrapREST(roomId);
      openSSE(roomId);
    }

    return () => {
      const e = pool.current.get(roomId);
      if (!e) return;
      e.subscriberCount -= 1;
      if (e.subscriberCount <= 0) {
        closeSSE(roomId);
        // Presence-Cache BEHALTEN (fuer naechsten Mount durch Virtualizer)
        // Entry nur loeschen wenn presence auch leer ist (Call beendet)
        if (e.presence.size === 0) {
          pool.current.delete(roomId);
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subscribeToUpdates = useCallback((roomId: string, listener: () => void): (() => void) => {
    const entry = ensureEntry(roomId);
    entry.listeners.add(listener);
    return () => {
      const e = pool.current.get(roomId);
      e?.listeners.delete(listener);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getSnapshot = useCallback((roomId: string): ReadonlyMap<string, CallPresenceState> => {
    return pool.current.get(roomId)?.snapshot ?? EMPTY_MAP;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contextValue = useMemo<BridgePresenceContextValue>(
    () => ({ subscribeSSE, subscribeToUpdates, getSnapshot }),
    [subscribeSSE, subscribeToUpdates, getSnapshot],
  );

  return (
    <BridgePresenceContext.Provider value={contextValue}>
      {children}
    </BridgePresenceContext.Provider>
  );
}
