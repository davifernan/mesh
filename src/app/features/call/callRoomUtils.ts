/**
 * BetterCord — Call Room Utilities
 *
 * Pure helper functions extracted from nativeCallEngine.ts to stay under the 650-line limit.
 */

import type { MatrixClient } from 'matrix-js-sdk';

/**
 * Resolves the LiveKit SFU URL from room state events.
 * Checks the call state event first, then scans member events as a fallback.
 */
export function getFocusUrl(mx: MatrixClient, roomId: string): string | null {
  const room = mx.getRoom(roomId);
  if (!room) return null;

  // Primary: org.matrix.msc3401.call state event
  const callEvent = room.currentState.getStateEvents('org.matrix.msc3401.call', '');
  const fociPreferred = (callEvent as any)?.getContent()?.foci_preferred;
  if (Array.isArray(fociPreferred) && fociPreferred.length > 0) {
    return fociPreferred[0].livekit_service_url ?? null;
  }

  // Fallback: scan org.matrix.msc3401.call.member events
  const memberEvents =
    room.currentState.getStateEvents('org.matrix.msc3401.call.member') ?? [];
  for (const ev of Array.isArray(memberEvents) ? memberEvents : [memberEvents]) {
    const content = (ev as any).getContent?.() ?? {};
    const foci = content.foci_preferred ?? content['m.foci']?.preferred;
    if (Array.isArray(foci) && foci.length > 0) {
      const url = foci[0].livekit_service_url;
      if (url) return url as string;
    }
  }

  return null;
}

/**
 * Count users with an active (non-empty) call.member state event in a room.
 * Used to decide whether we are the first joiner (write start time) or last
 * leaver (clear start time).
 */
export function countActiveCallMembers(mx: MatrixClient, roomId: string): number {
  const room = mx.getRoom(roomId);
  if (!room) return 0;
  const types = ['org.matrix.msc3401.call.member', 'org.matrix.msc4143.call.member'];
  const senders = new Set<string>();
  for (const type of types) {
    const events: any[] = (room.currentState.getStateEvents(type) ?? []) as any[];
    for (const ev of Array.isArray(events) ? events : [events]) {
      const sender = ev.getSender?.();
      const content = ev.getContent?.() ?? {};
      if (sender && Object.keys(content).length > 0) senders.add(sender as string);
    }
  }
  return senders.size;
}
