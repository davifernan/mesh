import type { Room } from 'matrix-js-sdk';
import { getMxIdLocalPart, isUserId } from '../../utils/matrix';
import { getMemberDisplayName } from '../../utils/room';

type LiveKitParticipantLike = {
  identity: string;
  name?: string;
  metadata?: string;
  attributes?: Record<string, string>;
};

/**
 * Attribute keys checked (in order) when resolving a Matrix user ID from a
 * LiveKit participant.  Must stay in sync with bridge/src/identity.ts.
 */
export const PARTICIPANT_USER_ID_KEYS = [
  'matrix_user_id',
  'matrixUserId',
  'mx_user_id',
  'mxUserId',
  'claimed_user_id',
  'claimedUserId',
  'user_id',
  'userId',
  // Legacy Element Call key — kept for backwards compat
  'io.element.owned_by',
] as const;

export const PARTICIPANT_DISPLAY_NAME_KEYS = [
  'display_name',
  'displayName',
  'participant_name',
  'participantName',
  'name',
] as const;

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

function getMappedUserId(candidate?: Record<string, unknown> | null): string | null {
  if (!candidate) return null;

  return (
    PARTICIPANT_USER_ID_KEYS.map((key) => readUserIdCandidate(candidate[key])).find(Boolean) ?? null
  );
}

function readDisplayNameCandidate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getMappedDisplayName(candidate?: Record<string, unknown> | null): string | null {
  if (!candidate) return null;

  return (
    PARTICIPANT_DISPLAY_NAME_KEYS.map((key) => readDisplayNameCandidate(candidate[key])).find(Boolean) ?? null
  );
}

export function isOpaqueParticipantIdentifier(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes(' ')) return false;
  if (trimmed.startsWith('@') || trimmed.includes(':')) return false;
  return /^[A-Za-z0-9+/=_-]{12,}$/.test(trimmed);
}

function matchUniqueRoomMemberByLocalPart(room: Room | null | undefined, value?: string): string | null {
  if (!room || !value) return null;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  const matches = room.getJoinedMembers().filter((member) => {
    const localPart = getMxIdLocalPart(member.userId)?.toLowerCase();
    return localPart === normalized;
  });

  return matches.length === 1 ? matches[0].userId : null;
}

function matchUniqueRoomMemberByName(room: Room | null | undefined, name?: string): string | null {
  if (!room || !name) return null;

  const matches = room
    .getJoinedMembers()
    .filter((member) => (member.name ?? member.userId) === name);

  return matches.length === 1 ? matches[0].userId : null;
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
 * Resolution order (mirrors bridge resolveMatrixUserId):
 *   1. Participant attributes — checked against PARTICIPANT_USER_ID_KEYS.
 *   2. Participant metadata  — JSON-parsed, same key list.
 *   3. Identity string       — extractMatrixUserIdFromIdentity.
 *   4. Room member name match — unique display-name lookup (frontend only).
 *   5. Fallback              — strip leading `_@` and return identity as-is.
 */
export function resolveParticipantUserId(
  participant: LiveKitParticipantLike,
  room?: Room | null
): string {
  const attributeUserId = getMappedUserId(participant.attributes);
  if (attributeUserId) return attributeUserId;

  const metadataUserId = getMappedUserId(parseParticipantMetadata(participant.metadata));
  if (metadataUserId) return metadataUserId;

  const identityUserId = extractMatrixUserIdFromIdentity(participant.identity);
  if (identityUserId) return identityUserId;

  const nameUserId = participant.name && isUserId(participant.name) ? participant.name : null;
  if (nameUserId) return nameUserId;

  const namedMemberUserId = matchUniqueRoomMemberByName(room, participant.name);
  if (namedMemberUserId) return namedMemberUserId;

  const localPartUserId = matchUniqueRoomMemberByLocalPart(room, participant.name);
  if (localPartUserId) return localPartUserId;

  return participant.identity.startsWith('_@') ? participant.identity.slice(1) : participant.identity;
}

export function resolveParticipantDisplayName(
  participant: LiveKitParticipantLike,
  room?: Room | null,
): string {
  const resolvedUserId = resolveParticipantUserId(participant, room);
  const matrixName = room ? getMemberDisplayName(room, resolvedUserId) : undefined;
  if (matrixName) return matrixName;

  const metadataDisplayName = getMappedDisplayName(parseParticipantMetadata(participant.metadata));
  if (metadataDisplayName && !isOpaqueParticipantIdentifier(metadataDisplayName)) {
    return metadataDisplayName;
  }

  const attributeDisplayName = getMappedDisplayName(participant.attributes);
  if (attributeDisplayName && !isOpaqueParticipantIdentifier(attributeDisplayName)) {
    return attributeDisplayName;
  }

  if (participant.name && !participant.name.startsWith('@') && !isOpaqueParticipantIdentifier(participant.name)) {
    return participant.name;
  }

  const localPart = getMxIdLocalPart(resolvedUserId);
  if (localPart) return localPart;

  const identityLocalPart = getMxIdLocalPart(
    participant.identity.startsWith('_@') ? participant.identity.slice(1) : participant.identity,
  );
  if (identityLocalPart) return identityLocalPart;

  return isOpaqueParticipantIdentifier(participant.identity) ? 'Participant' : participant.identity;
}
