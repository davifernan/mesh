/**
 * Matrix user-ID resolution from LiveKit participant identity.
 *
 * Aligned with the frontend's participantIdentity.ts logic so that the bridge
 * and every client derive the same userId key from the same LiveKit identity
 * string — critical for presence map lookups to match.
 *
 * Resolution order (mirrors resolveParticipantUserId in the frontend):
 *   1. Participant attributes — checked against PARTICIPANT_USER_ID_KEYS.
 *   2. Participant metadata   — JSON-parsed, same key list.
 *   3. Identity string        — extractMatrixUserIdFromIdentity logic:
 *        a. Strip leading `_@` → `@` (MSC4143 variant)
 *        b. If the server part (after `:`) has no `_`, return as-is (bare ID)
 *        c. Try stripping device suffix at the last `_`
 *        d. Fall back to the full normalised string if it is a valid Matrix ID
 *           (handles server names that legitimately contain underscores)
 *   4. Fallback — strip leading `_@` and return as-is.
 *
 * Key difference from the old bridge logic:
 *   OLD: returned bare ID early if `isMatrixUserId` passed, missing device-suffix
 *        stripping for IDs like `@alice:server.com_DEVICEID`
 *   NEW: checks the server part for underscores before deciding whether to strip
 */

// ── Attribute key list (must stay in sync with frontend participantIdentity.ts) ──

export const PARTICIPANT_USER_ID_KEYS = [
  'matrix_user_id',
  'matrixUserId',
  'mx_user_id',
  'mxUserId',
  'claimed_user_id',
  'claimedUserId',
  'user_id',
  'userId',
  // Legacy element-call key — kept for backwards compat
  'io.element.owned_by',
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isMatrixUserId(value: string): boolean {
  return value.startsWith('@') && value.includes(':');
}

function readUserIdCandidate(value: unknown): string | null {
  return typeof value === 'string' && isMatrixUserId(value) ? value : null;
}

function parseParticipantMetadata(metadata?: string): Record<string, unknown> | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function getMappedUserId(attrs: Record<string, unknown> | undefined | null): string | null {
  if (!attrs) return null;
  for (const key of PARTICIPANT_USER_ID_KEYS) {
    const candidate = readUserIdCandidate(attrs[key]);
    if (candidate) return candidate;
  }
  return null;
}

/**
 * Extract a bare Matrix user ID from a LiveKit participant identity string.
 *
 * Resolution order:
 *   1. Strip leading `_@` → `@` (MSC4143 leading-underscore variant).
 *   2. If the server part (after `:`) contains no `_`, the string is already a
 *      bare Matrix ID — return it as-is.
 *   3. Otherwise strip the device suffix by cutting at the last `_`.
 *      If the result is a valid Matrix ID, return it.
 *   4. Fall back to returning the full normalised string if it is a valid
 *      Matrix ID (handles server names that legitimately contain underscores,
 *      e.g. `@alice:my_server.com` with no device suffix).
 *   5. Return null if the identity cannot be parsed as a Matrix user ID.
 *
 * Examples:
 *   "@alice:server.com"                  → "@alice:server.com"
 *   "@alice:server.com_DEVICEID"         → "@alice:server.com"
 *   "_@alice:server.com_DEVICEID"        → "@alice:server.com"
 *   "@alice_bob:server.com_DEVICEID"     → "@alice_bob:server.com"
 *   "@alice:my_server.com"               → "@alice:my_server.com"  (no device suffix)
 *   "@alice:my_server.com_DEVICEID"      → "@alice:my_server.com"
 */
export function extractMatrixUserIdFromIdentity(identity: string): string | null {
  // Strip the leading `_@` → `@` variant used by some MSC4143 clients
  const normalized = identity.startsWith('_@') ? identity.slice(1) : identity;

  if (!normalized.startsWith('@')) return null;

  const colonIdx = normalized.indexOf(':');
  if (colonIdx === -1) return null;

  const serverPart = normalized.slice(colonIdx + 1);

  // No underscore in the server part → already a bare Matrix ID
  if (!serverPart.includes('_')) {
    return normalized;
  }

  // Try stripping the device suffix at the last underscore.
  // Device IDs never contain dots; server-name components always do (e.g. `my_server.com`).
  // So only strip if the suffix (the part after the last `_`) contains no dot.
  const lastUnderscore = normalized.lastIndexOf('_');
  // Guard: underscore at position ≤ 1 means `@_:…` — no real suffix to strip
  if (lastUnderscore > 1) {
    const suffix = normalized.slice(lastUnderscore + 1);
    if (!suffix.includes('.')) {
      const candidate = normalized.slice(0, lastUnderscore);
      if (isMatrixUserId(candidate)) return candidate;
    }
  }

  // The underscore is part of the server name (e.g. `@alice:my_server.com`),
  // not a device suffix — return the full normalised string if it is valid.
  return isMatrixUserId(normalized) ? normalized : null;
}

/**
 * Resolve the canonical Matrix user ID for a LiveKit participant.
 *
 * @param identity   LiveKit participant identity string
 * @param attributes LiveKit participant attributes map (optional)
 * @param metadata   LiveKit participant metadata string (optional, JSON)
 * @returns          Bare Matrix user ID, or the identity string as fallback
 */
export function resolveMatrixUserId(
  identity: string,
  attributes?: Record<string, string>,
  metadata?: string,
): string {
  // 1. Attributes take priority
  const attrUserId = getMappedUserId(attributes);
  if (attrUserId) return attrUserId;

  // 2. Metadata (JSON-parsed) — same key list
  const metaUserId = getMappedUserId(parseParticipantMetadata(metadata));
  if (metaUserId) return metaUserId;

  // 3. Parse from identity string
  const identityUserId = extractMatrixUserIdFromIdentity(identity);
  if (identityUserId) return identityUserId;

  // 4. Fallback: strip leading `_@` and return as-is
  return identity.startsWith('_@') ? identity.slice(1) : identity;
}
