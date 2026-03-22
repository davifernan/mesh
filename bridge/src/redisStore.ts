/**
 * Redis-backed VoiceStateStore using Bun's built-in RedisClient.
 *
 * Storage layout (all keys namespaced under "bc:"):
 *
 *   bc:identity:{roomId}:{identity}   → JSON string of { userId, presence }
 *   bc:room:{roomId}                  → Redis hash: userId → JSON presence
 *   bc:rooms                          → Redis set of active roomIds
 *   bc:seq:{roomId}                   → Redis string (integer): monotonic seq counter
 *
 * Design decisions:
 *   - Identity entries are stored as individual string keys so they can be
 *     expired independently (TTL-based cleanup for crashed clients).
 *   - Room snapshot is a hash for O(1) field access and atomic HSET/HDEL.
 *   - Seq counter uses INCR for atomic increment — safe under concurrent writes.
 *   - Seq key is intentionally NOT deleted on clearRoom so seq never regresses
 *     for clients connected across a reconcile cycle.
 *   - All multi-step operations use Promise.all where possible.
 *   - No Lua scripts — keeps the implementation simple and debuggable.
 *   - TTL of 4 hours on identity keys as a safety net against leaked state.
 *
 * Failure mode: if Redis is unreachable, all methods throw. The caller
 * (index.ts) should fall back to InMemoryVoiceStateStore or surface the error.
 */

import type { ParticipantPresence } from './types.js';
import type { VoiceStateStore } from './store.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Safety-net TTL (seconds) for identity keys — prevents leaked state on crash. */
const IDENTITY_TTL_SECONDS = 4 * 60 * 60; // 4 hours

const NS = 'bc';

function identityKey(roomId: string, identity: string): string {
  return `${NS}:identity:${roomId}:${identity}`;
}

function roomHashKey(roomId: string): string {
  return `${NS}:room:${roomId}`;
}

function seqKey(roomId: string): string {
  return `${NS}:seq:${roomId}`;
}

const ROOMS_SET_KEY = `${NS}:rooms`;

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_PRESENCE: Omit<ParticipantPresence, 'updatedAt' | 'type' | 'seq'> = {
  isMicMuted: false,
  isCameraOn: false,
  isScreenSharing: false,
  isDeafened: false,
};

function presenceChanged(a: ParticipantPresence, b: ParticipantPresence): boolean {
  return (
    a.isMicMuted !== b.isMicMuted ||
    a.isCameraOn !== b.isCameraOn ||
    a.isScreenSharing !== b.isScreenSharing ||
    a.isDeafened !== b.isDeafened
  );
}

function parsePresence(raw: string | null): ParticipantPresence | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ParticipantPresence;
  } catch {
    return null;
  }
}

function aggregatePresences(candidates: ParticipantPresence[]): ParticipantPresence | null {
  if (candidates.length === 0) return null;

  return {
    isMicMuted: candidates.every((presence) => presence.isMicMuted),
    isCameraOn: candidates.some((presence) => presence.isCameraOn),
    isScreenSharing: candidates.some((presence) => presence.isScreenSharing),
    isDeafened: candidates.some((presence) => presence.isDeafened),
    updatedAt: Math.max(...candidates.map((presence) => presence.updatedAt)),
    seq: Math.max(...candidates.map((presence) => presence.seq ?? 0)),
    type: 'update',
  };
}

// ── RedisVoiceStateStore ──────────────────────────────────────────────────────

export class RedisVoiceStateStore implements VoiceStateStore {
  private readonly redis: InstanceType<typeof Bun.RedisClient>;
  /** Tracks connection health for /health endpoint. */
  public connected = false;

  constructor(url: string) {
    this.redis = new Bun.RedisClient(url);
    // Bun.RedisClient connects lazily; ping on first use to detect issues early.
    this.redis.ping().then(() => {
      this.connected = true;
      console.log('[redis] Connected to Redis store');
    }).catch((err: unknown) => {
      console.error('[redis] Initial ping failed:', (err as Error).message);
    });
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /** Atomically increment and return the room-level seq counter. */
  private async nextSeq(roomId: string): Promise<number> {
    const result = await this.redis.incr(seqKey(roomId));
    return result as number;
  }

  // ── VoiceStateStore implementation ─────────────────────────────────────────

  async joinPresence(
    roomId: string,
    identity: string,
    userId: string,
    initial: ParticipantPresence,
  ): Promise<ParticipantPresence> {
    const seq = await this.nextSeq(roomId);
    const withSeq: ParticipantPresence = { ...initial, seq };

    const idKey = identityKey(roomId, identity);
    const roomKey = roomHashKey(roomId);
    const idValue = JSON.stringify({ userId, presence: withSeq });

    // Store identity entry with TTL, then recompute the aggregated user snapshot.
    await Promise.all([
      this.redis.set(idKey, idValue, 'EX', IDENTITY_TTL_SECONDS),
      this.redis.sadd(ROOMS_SET_KEY, roomId),
    ]);

    const aggregated = await this._recomputeAggregated(roomId, userId, seq);
    if (aggregated) {
      await this.redis.hset(roomKey, { [userId]: JSON.stringify(aggregated) });
    }

    this.connected = true;
    return aggregated ?? withSeq;
  }

  async setPresence(
    roomId: string,
    identity: string,
    userId: string,
    patch: Partial<ParticipantPresence>,
  ): Promise<{ changed: boolean; next: ParticipantPresence } | null> {
    const idKey = identityKey(roomId, identity);

    // Read current identity entry
    const raw = await this.redis.get(idKey);
    this.connected = true;

    let prev: ParticipantPresence;
    if (raw) {
      try {
        const obj = JSON.parse(raw) as { userId: string; presence: ParticipantPresence };
        prev = obj.presence;
      } catch {
        prev = { ...DEFAULT_PRESENCE, updatedAt: 0, seq: 0, type: 'update' };
      }
    } else {
      prev = { ...DEFAULT_PRESENCE, updatedAt: 0, seq: 0, type: 'update' };
    }

    const next: ParticipantPresence = {
      ...prev,
      ...patch,
      updatedAt: Date.now(),
      seq: prev.seq, // placeholder — overwritten below on change
      type: 'update',
    };

    if (!presenceChanged(prev, next)) {
      // Return the current aggregated state from the room hash (not raw device state)
      const roomKey = roomHashKey(roomId);
      const rawAggregated = await this.redis.hget(roomKey, userId);
      const currentAggregated = parsePresence(rawAggregated) ?? prev;
      return { changed: false, next: currentAggregated };
    }

    const seq = await this.nextSeq(roomId);
    const withSeq: ParticipantPresence = { ...next, seq };
    const idValue = JSON.stringify({ userId, presence: withSeq });
    const roomKey = roomHashKey(roomId);

    await Promise.all([
      this.redis.set(idKey, idValue, 'EX', IDENTITY_TTL_SECONDS),
      this.redis.sadd(ROOMS_SET_KEY, roomId),
    ]);

    const aggregated = await this._recomputeAggregated(roomId, userId, seq);
    if (aggregated) {
      await this.redis.hset(roomKey, { [userId]: JSON.stringify(aggregated) });
    }

    return { changed: true, next: aggregated ?? withSeq };
  }

  async removePresence(
    roomId: string,
    identity: string,
    userId: string,
  ): Promise<{
    userId: string;
    remaining: number;
    aggregated: ParticipantPresence | null;
    seq: number;
  } | null> {
    const idKey = identityKey(roomId, identity);
    const roomKey = roomHashKey(roomId);

    // Guard: check if userId was tracked before deleting the identity key
    // Bun.RedisClient does not expose hexists — use hget and check for null instead
    const wasTracked = (await this.redis.hget(roomKey, userId)) !== null;
    this.connected = true;

    // Delete the identity key
    await this.redis.del(idKey);

    // If userId was never tracked, return null (no broadcast needed)
    if (!wasTracked) {
      return null;
    }

    // Count remaining identities for this userId by scanning identity keys
    const remaining = await this._countRemainingIdentities(roomId, userId);

    const seq = await this.nextSeq(roomId);
    let aggregated: ParticipantPresence | null = null;

    if (remaining === 0) {
      // Last device — remove from room hash
      await this.redis.hdel(roomKey, userId);

      // If room hash is now empty, remove from rooms set
      const roomSize = await this.redis.hlen(roomKey);
      if (roomSize === 0) {
        await this.redis.srem(ROOMS_SET_KEY, roomId);
      }
    } else {
      // Recompute aggregated presence from remaining identities
      aggregated = await this._recomputeAggregated(roomId, userId, seq);
      if (aggregated) {
        await this.redis.hset(roomKey, { [userId]: JSON.stringify(aggregated) });
      }
    }

    return { userId, remaining, aggregated, seq };
  }

  async getRoomSnapshot(roomId: string): Promise<Map<string, ParticipantPresence>> {
    const roomKey = roomHashKey(roomId);
    // hgetall returns Record<string, string> (empty object when key doesn't exist)
    const hash = await this.redis.hgetall(roomKey);
    this.connected = true;

    const result = new Map<string, ParticipantPresence>();
    if (!hash) return result;

    for (const [uid, raw] of Object.entries(hash)) {
      const presence = parsePresence(raw);
      if (presence) result.set(uid, presence);
    }
    return result;
  }

  async roomCount(): Promise<number> {
    const count = await this.redis.scard(ROOMS_SET_KEY);
    this.connected = true;
    return count ?? 0;
  }

  async listRoomIds(): Promise<string[]> {
    const roomIds = await this.redis.smembers(ROOMS_SET_KEY);
    this.connected = true;
    return roomIds ?? [];
  }

  async clearRoom(roomId: string): Promise<void> {
    const roomKey = roomHashKey(roomId);
    const pattern = `${NS}:identity:${roomId}:*`;
    let cursor = '0';

    do {
      const result = await this.redis.send('SCAN', [cursor, 'MATCH', pattern, 'COUNT', '100']) as [string, string[]];
      cursor = result[0];
      const keys = result[1];
      if (keys.length > 0) {
        await this.redis.send('DEL', keys);
      }
    } while (cursor !== '0');

    // NOTE: seqKey(roomId) is intentionally NOT deleted here.
    // Seq must never regress for clients connected across a reconcile cycle.
    await Promise.all([
      this.redis.del(roomKey),
      this.redis.srem(ROOMS_SET_KEY, roomId),
    ]);

    this.connected = true;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Scan identity keys for a userId in a room and count how many remain
   * (excluding the one just deleted, which is already gone from Redis).
   */
  private async _countRemainingIdentities(roomId: string, userId: string): Promise<number> {
    // Use SCAN with a pattern — acceptable for bridge scale (rooms have O(10s) of participants).
    const pattern = `${NS}:identity:${roomId}:*`;
    let cursor = '0';
    let count = 0;

    do {
      const result = await this.redis.send('SCAN', [cursor, 'MATCH', pattern, 'COUNT', '100']) as [string, string[]];
      cursor = result[0];
      const keys = result[1];

      if (keys.length > 0) {
        const values = await this.redis.mget(...keys);
        for (const raw of values) {
          if (!raw) continue;
          try {
            const obj = JSON.parse(raw) as { userId: string };
            if (obj.userId === userId) count++;
          } catch {
            // ignore malformed entries
          }
        }
      }
    } while (cursor !== '0');

    return count;
  }

  /**
   * Recompute the aggregated presence for a userId by scanning all identity
   * entries in the room and picking the most recently updated one.
   * Stamps the result with the provided seq.
   */
  private async _recomputeAggregated(
    roomId: string,
    userId: string,
    seq: number,
  ): Promise<ParticipantPresence | null> {
    const pattern = `${NS}:identity:${roomId}:*`;
    let cursor = '0';
    const candidates: ParticipantPresence[] = [];

    do {
      const result = await this.redis.send('SCAN', [cursor, 'MATCH', pattern, 'COUNT', '100']) as [string, string[]];
      cursor = result[0];
      const keys = result[1];

      if (keys.length > 0) {
        const values = await this.redis.mget(...keys);
        for (let i = 0; i < keys.length; i++) {
          const raw = values[i];
          if (!raw) continue;
          try {
            const obj = JSON.parse(raw) as { userId: string; presence: ParticipantPresence };
            if (obj.userId !== userId) continue;
            candidates.push(obj.presence);
          } catch {
            // ignore malformed entries
          }
        }
      }
    } while (cursor !== '0');

    const aggregated = aggregatePresences(candidates);
    if (!aggregated) return null;
    // Override seq with the freshly allocated room-level counter
    aggregated.seq = seq;
    return aggregated;
  }
}
