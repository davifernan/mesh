import type { Room } from 'matrix-js-sdk';

type LiveKitParticipantLike = {
  identity: string;
  name?: string;
  metadata?: string;
  attributes?: Record<string, string>;
};

const PARTICIPANT_USER_ID_KEYS = [
  'matrix_user_id',
  'matrixUserId',
  'mx_user_id',
  'mxUserId',
  'claimed_user_id',
  'claimedUserId',
  'user_id',
  'userId',
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

function matchUniqueRoomMemberByName(room: Room | null | undefined, name?: string): string | null {
  if (!room || !name) return null;

  const matches = room
    .getJoinedMembers()
    .filter((member) => (member.name ?? member.userId) === name);

  return matches.length === 1 ? matches[0].userId : null;
}

export function extractMatrixUserIdFromIdentity(identity: string): string | null {
  const normalizedIdentity = identity.startsWith('_@') ? identity.slice(1) : identity;

  if (isMatrixUserId(normalizedIdentity)) {
    return normalizedIdentity;
  }

  if (!normalizedIdentity.startsWith('@')) {
    return null;
  }

  const lastUnderscore = normalizedIdentity.lastIndexOf('_');
  if (lastUnderscore <= 1) {
    return isMatrixUserId(normalizedIdentity) ? normalizedIdentity : null;
  }

  const candidate = normalizedIdentity.slice(0, lastUnderscore);
  return isMatrixUserId(candidate) ? candidate : null;
}

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

  const namedMemberUserId = matchUniqueRoomMemberByName(room, participant.name);
  if (namedMemberUserId) return namedMemberUserId;

  return participant.identity.startsWith('_@') ? participant.identity.slice(1) : participant.identity;
}
