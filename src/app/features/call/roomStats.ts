import type { Room } from 'livekit-client';

export interface RoomStats {
  rtt: number | null;
  jitter: number | null;
  /** Fraction [0–1] of packets lost, or null if unavailable. */
  packetLoss: number | null;
  /** Raw packet counts for display purposes. */
  packetsLost: number | null;
  packetsTotal: number;
}

/**
 * Version-safe abstraction over LiveKit internal stats.
 *
 * Tries the public `room.engine?.latency` API for RTT first, then falls back
 * to RTCPeerConnection.getStats() for a complete picture. All private-field
 * access is guarded so callers never need (room as any) casts.
 */
export async function getRoomStats(room: Room): Promise<RoomStats> {
  let rtt: number | null = null;
  let jitter: number | null = null;
  let packetLoss: number | null = null;
  let packetsLost: number | null = null;
  let packetsTotal = 0;

  // RTT via engine.latency (LiveKit 2.x internal, best-effort)
  try {
    const lat = (room as any).engine?.latency ?? null;
    if (typeof lat === 'number') rtt = Math.round(lat);
  } catch {
    // ignore — will stay null
  }

  // Jitter + packet loss via RTCPeerConnection.getStats()
  try {
    const pc: RTCPeerConnection | undefined = (room as any).engine?.subscriber?.pc;
    if (pc) {
      const report = await pc.getStats();
      report.forEach((stat: RTCStats) => {
        const s = stat as any;
        if (s.type === 'inbound-rtp' && s.kind === 'audio') {
          const lost = s.packetsLost ?? 0;
          const received = s.packetsReceived ?? 0;
          packetsLost = lost;
          packetsTotal = received + lost;
          jitter = typeof s.jitter === 'number' ? Math.round(s.jitter * 1000) : null;
          // Derive fraction from raw counts when fractionLost is absent
          packetLoss = packetsTotal > 0 ? lost / packetsTotal : 0;
          // Override RTT if remote-inbound-rtp is available (more accurate)
        } else if (s.type === 'remote-inbound-rtp' && s.kind === 'audio') {
          if (typeof s.roundTripTime === 'number') {
            rtt = Math.round(s.roundTripTime * 1000);
          }
        }
      });
    }
  } catch {
    // ignore — stats will show as unavailable
  }

  return { rtt, jitter, packetLoss, packetsLost, packetsTotal };
}
