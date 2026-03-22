/**
 * mesh — Audio-Wins-Over-Video Quality Fallback
 *
 * When LiveKit reports Poor/Lost connection quality for the local participant,
 * we automatically throttle screenshare and camera video bitrates to protect
 * the microphone audio stream. Audio is NEVER touched — priority 1 always.
 *
 * Implementation notes:
 * - Uses RoomEvent.ConnectionQualityChanged (fires for local participant too)
 * - Throttling is applied via RTCRtpSender.setParameters() — no re-publish needed
 * - Restores original encoding parameters when quality recovers to Good/Excellent
 * - Screenshare fallback: 500 kbps @ 15fps (still usable for slides / text)
 * - Camera fallback: 150 kbps (recognisable face, minimal bandwidth)
 * - 2-step debounce: Poor must persist for POOR_GRACE_MS before throttling;
 *   Good must persist for RECOVER_GRACE_MS before restoring (avoids flapping).
 */

import { useEffect, useRef, MutableRefObject } from 'react';
import { Room, RoomEvent, Track, LocalVideoTrack, ConnectionQuality, type LocalTrackPublication } from 'livekit-client';
import type { CallStatus } from './nativeCallEngine';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Milliseconds of sustained Poor/Lost quality before throttling kicks in. */
const POOR_GRACE_MS = 3_000;

/** Milliseconds of sustained Good/Excellent quality before restoring full bitrate. */
const RECOVER_GRACE_MS = 6_000;

/** Screenshare fallback bitrate (bps) when network/CPU is stressed. */
const SS_FALLBACK_BITRATE = 500_000;

/** Screenshare fallback max framerate during stress. */
const SS_FALLBACK_FPS = 15;

/** Camera fallback bitrate (bps) during stress. */
const CAM_FALLBACK_BITRATE = 150_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Applies new maxBitrate + maxFramerate to the first video encoding of an RTCRtpSender. */
async function throttleSender(
  sender: RTCRtpSender,
  maxBitrate: number,
  maxFramerate?: number,
): Promise<void> {
  const params = sender.getParameters();
  if (!params.encodings || params.encodings.length === 0) return;
  params.encodings = params.encodings.map((enc) => ({
    ...enc,
    maxBitrate,
    ...(maxFramerate !== undefined && { maxFramerate }),
  }));
  await sender.setParameters(params);
}

/**
 * Returns the original encoding parameters from the first active encoding
 * of an RTCRtpSender, or undefined if not yet available.
 */
function snapshotEncoding(
  sender: RTCRtpSender,
): RTCRtpEncodingParameters | undefined {
  const params = sender.getParameters();
  return params.encodings?.[0];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useAudioWinsOverVideo — attaches quality fallback logic to the active LiveKit room.
 *
 * Call inside useNativeCall() after the room is connected.
 * roomRef — same mutable ref used by the engine (always points to current Room).
 */
export function useAudioWinsOverVideo(
  roomRef: MutableRefObject<Room | null>,
  livekitRoom: Room | null,
  status: CallStatus,
): void {
  /** True while we are currently in throttled (fallback) mode. */
  const isThrottledRef = useRef(false);

  /** Snapshot of screenshare sender encoding BEFORE throttling, for restoration. */
  const ssOriginalEncodingRef = useRef<RTCRtpEncodingParameters | undefined>(undefined);

  /** Snapshot of camera sender encoding BEFORE throttling. */
  const camOriginalEncodingRef = useRef<RTCRtpEncodingParameters | undefined>(undefined);

  /** Timer ID for the grace period debounce. */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const room = livekitRoom;
    if (!room || status !== 'connected') return;

    function clearGraceTimer() {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    async function applyFallback() {
      const r = roomRef.current;
      if (!r || isThrottledRef.current) return;

      const lp = r.localParticipant;

      // Snapshot + throttle screenshare sender
      const ssPub = lp.getTrackPublication(Track.Source.ScreenShare);
      const ssTrack = ssPub?.track as LocalVideoTrack | undefined;
      const ssSender = ssTrack?.sender;
      if (ssSender) {
        ssOriginalEncodingRef.current = snapshotEncoding(ssSender);
        await throttleSender(ssSender, SS_FALLBACK_BITRATE, SS_FALLBACK_FPS).catch(() => {});
      }

      // Snapshot + throttle camera sender
      const camPub = lp.getTrackPublication(Track.Source.Camera);
      const camTrack = camPub?.track as LocalVideoTrack | undefined;
      const camSender = camTrack?.sender;
      if (camSender) {
        camOriginalEncodingRef.current = snapshotEncoding(camSender);
        await throttleSender(camSender, CAM_FALLBACK_BITRATE).catch(() => {});
      }

      if (ssSender || camSender) {
        isThrottledRef.current = true;
        console.warn('[QualityFallback] Poor connection — video throttled, audio protected');
      }
    }

    async function restoreQuality() {
      const r = roomRef.current;
      if (!r || !isThrottledRef.current) return;

      const lp = r.localParticipant;

      try {
        // Restore screenshare sender
        const ssPub = lp.getTrackPublication(Track.Source.ScreenShare);
        const ssTrack = ssPub?.track as LocalVideoTrack | undefined;
        const ssSender = ssTrack?.sender;
        const ssOrig = ssOriginalEncodingRef.current;
        if (ssSender && ssOrig?.maxBitrate !== undefined) {
          await throttleSender(ssSender, ssOrig.maxBitrate, ssOrig.maxFramerate ?? undefined).catch(
            () => {},
          );
        }

        // Restore camera sender
        const camPub = lp.getTrackPublication(Track.Source.Camera);
        const camTrack = camPub?.track as LocalVideoTrack | undefined;
        const camSender = camTrack?.sender;
        const camOrig = camOriginalEncodingRef.current;
        if (camSender && camOrig?.maxBitrate !== undefined) {
          await throttleSender(camSender, camOrig.maxBitrate, camOrig.maxFramerate ?? undefined).catch(
            () => {},
          );
        }
      } finally {
        // Always reset state-machine flags regardless of whether snapshots existed.
        // If a screenshare started *during* the throttle phase, ssOriginalEncodingRef
        // has no snapshot — the restore if-block above is skipped, but we must still
        // clear isThrottledRef so the next applyFallback is not permanently blocked.
        isThrottledRef.current = false;
        ssOriginalEncodingRef.current = undefined;
        camOriginalEncodingRef.current = undefined;
      }
      console.info('[QualityFallback] Quality recovered — video encoding restored');
    }

    const onQualityChanged = (quality: ConnectionQuality, participant: { identity: string }) => {
      // Only react to LOCAL participant quality changes
      if (!roomRef.current || participant.identity !== roomRef.current.localParticipant.identity) {
        return;
      }

      clearGraceTimer();

      if (quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost) {
        timerRef.current = setTimeout(() => {
          void applyFallback();
        }, POOR_GRACE_MS);
      } else if (quality === ConnectionQuality.Excellent || quality === ConnectionQuality.Good) {
        timerRef.current = setTimeout(() => {
          void restoreQuality();
        }, RECOVER_GRACE_MS);
      }
      // ConnectionQuality.Unknown — do nothing; wait for a definitive signal
    };

    room.on(RoomEvent.ConnectionQualityChanged, onQualityChanged);

    // Issue #70: If a screenshare starts WHILE throttling is active, immediately
    // apply the screenshare fallback to the newly published track so it respects
    // the current quality window (instead of starting at full bitrate then going uncapped).
    const onLocalTrackPublished = (pub: LocalTrackPublication) => {
      if (pub.source !== Track.Source.ScreenShare) return;
      if (!isThrottledRef.current) return;
      const ssTrack = pub.track as LocalVideoTrack | undefined;
      const ssSender = ssTrack?.sender;
      if (ssSender) {
        ssOriginalEncodingRef.current = snapshotEncoding(ssSender);
        void throttleSender(ssSender, SS_FALLBACK_BITRATE, SS_FALLBACK_FPS).catch(() => {});
        console.warn('[QualityFallback] Screenshare started during throttle — applying SS fallback immediately');
      }
    };
    room.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished);

    return () => {
      clearGraceTimer();
      room.off(RoomEvent.ConnectionQualityChanged, onQualityChanged);
      room.off(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
      // Reset state so the next room connection starts clean
      isThrottledRef.current = false;
      ssOriginalEncodingRef.current = undefined;
      camOriginalEncodingRef.current = undefined;
    };
  }, [livekitRoom, status, roomRef]);
}
