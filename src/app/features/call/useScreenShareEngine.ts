/**
 * BetterCord — Screen Share Engine
 *
 * Extracted from nativeCallEngine.ts to stay under the 650-line file limit.
 * Manages all screenshare-specific state and controls:
 *   - enforceScreenShareConstraints (Issue #47: RoomEvent.LocalTrackPublished, no polling)
 *   - startScreenShare / stopScreenShare / toggleScreenShareAudio (Issue #45)
 *   - watchScreenShare / unwatchScreenShare / updateActiveScreenShareSettings
 */

import { useRef, useCallback, useState, type MutableRefObject } from 'react';
import { Room, RoomEvent, Track, VideoQuality, LocalVideoTrack, type LocalTrackPublication } from 'livekit-client';
import {
  buildSSCaptureOptions,
  buildSSPublishOptions,
  resolutionToWidth,
  resolutionToHeight,
} from './avPresets';
import { playCallSound, CallSoundType } from '../../utils/callSounds';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScreenShareEngineParams {
  roomRef: MutableRefObject<Room | null>;
  callSoundsEnabledRef: MutableRefObject<boolean>;
  /** Jotai atom setter from useSetAtom(watchedScreenSharesAtom) */
  setWatchedScreenShares: (value: ReadonlySet<string> | ((prev: ReadonlySet<string>) => ReadonlySet<string>)) => void;
}

export interface ScreenShareEngineResult {
  isScreenShareEnabled: boolean;
  isScreenShareAudioEnabled: boolean;
  /** Exposed so the parent's room event handlers can sync state */
  setIsScreenShareEnabled: (enabled: boolean) => void;
  /** Exposed so the parent's room event handlers can sync state */
  setIsScreenShareAudioEnabled: (enabled: boolean) => void;
  startScreenShare: (ssRes: string, ssFps: number, ssAudio: boolean) => Promise<void>;
  stopScreenShare: () => Promise<void>;
  toggleScreenShareAudio: () => Promise<void>;
  watchScreenShare: (identity: string) => Promise<void>;
  unwatchScreenShare: (identity: string) => Promise<void>;
  updateActiveScreenShareSettings: (ssRes: string, ssFps: number, ssAudio: boolean) => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useScreenShareEngine(params: ScreenShareEngineParams): ScreenShareEngineResult {
  const { roomRef, callSoundsEnabledRef, setWatchedScreenShares } = params;

  const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(false);
  const [isScreenShareAudioEnabled, setIsScreenShareAudioEnabled] = useState(false);

  // Issue #45: track current screenshare settings so toggleScreenShareAudio can restart with them
  const ssSettingsRef = useRef<{ ssRes: string; ssFps: number; ssAudio: boolean }>({
    ssRes: '1080p',
    ssFps: 30,
    ssAudio: false,
  });

  /**
   * Issue #47: Applies capture constraints to the screenshare track using
   * RoomEvent.LocalTrackPublished instead of a fragile 10×100ms polling loop.
   * If the track is already published, constraints are applied immediately.
   * Falls back to a 5s timeout if the event never fires.
   */
  const enforceScreenShareConstraints = useCallback(async (ssRes: string, ssFps: number) => {
    const room = roomRef.current;
    if (!room) return;

    const applyConstraintsToTrack = async (mediaTrack: MediaStreamTrack) => {
      if (!mediaTrack.applyConstraints) return;

      const targetWidth = ssRes === 'source' ? undefined : resolutionToWidth(ssRes);
      const targetHeight = ssRes === 'source' ? undefined : resolutionToHeight(ssRes);

      const exactConstraints: MediaTrackConstraints = {
        ...(targetWidth && { width: { exact: targetWidth } }),
        ...(targetHeight && { height: { exact: targetHeight } }),
        ...(ssFps ? { frameRate: { exact: ssFps } } : {}),
      };

      const fallbackConstraints: MediaTrackConstraints = {
        ...(targetWidth && { width: { ideal: targetWidth, max: targetWidth } }),
        ...(targetHeight && { height: { ideal: targetHeight, max: targetHeight } }),
        ...(ssFps ? { frameRate: { ideal: ssFps, max: ssFps } } : {}),
      };

      try {
        if (Object.keys(exactConstraints).length > 0) {
          await mediaTrack.applyConstraints(exactConstraints);
        }
      } catch {
        if (Object.keys(fallbackConstraints).length > 0) {
          await mediaTrack.applyConstraints(fallbackConstraints).catch(() => {});
        }
      }
    };

    // If the screenshare track is already published, apply constraints immediately.
    const existingPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
    const existingMst = (existingPub?.track as LocalVideoTrack | undefined)?.mediaStreamTrack;
    if (existingMst) {
      await applyConstraintsToTrack(existingMst);
      return;
    }

    // Wait for LocalTrackPublished with a 5s timeout fallback.
    await new Promise<void>((resolve) => {
      const handler = (pub: LocalTrackPublication) => {
        if (pub.source === Track.Source.ScreenShare) {
          const mst = (pub.track as LocalVideoTrack | undefined)?.mediaStreamTrack;
          if (mst) void applyConstraintsToTrack(mst);
          room.off(RoomEvent.LocalTrackPublished, handler);
          resolve();
        }
      };
      room.on(RoomEvent.LocalTrackPublished, handler);
      window.setTimeout(() => {
        room.off(RoomEvent.LocalTrackPublished, handler);
        resolve();
      }, 5000);
    });
  }, [roomRef]);

  const startScreenShare = useCallback(
    async (ssRes: string, ssFps: number, ssAudio: boolean) => {
      if (!roomRef.current) return;
      // Issue #45: persist settings so toggleScreenShareAudio can restart with them
      ssSettingsRef.current = { ssRes, ssFps, ssAudio };
      const captureOpts = buildSSCaptureOptions(ssRes, ssFps, ssAudio);
      const publishOpts = buildSSPublishOptions(ssRes, ssFps);
      await roomRef.current.localParticipant.setScreenShareEnabled(true, captureOpts, publishOpts);
      await enforceScreenShareConstraints(ssRes, ssFps);
      setIsScreenShareEnabled(true);
      setIsScreenShareAudioEnabled(ssAudio);
      playCallSound(CallSoundType.ScreenShareStart, { enabled: callSoundsEnabledRef.current });
    },
    [roomRef, callSoundsEnabledRef, enforceScreenShareConstraints],
  );

  const stopScreenShare = useCallback(async () => {
    if (!roomRef.current) return;
    await roomRef.current.localParticipant.setScreenShareEnabled(false);
    setIsScreenShareEnabled(false);
    setIsScreenShareAudioEnabled(false);
    playCallSound(CallSoundType.ScreenShareStop, { enabled: callSoundsEnabledRef.current });
  }, [roomRef, callSoundsEnabledRef]);

  /**
   * Issue #45: Toggle system audio on a running screenshare.
   *
   * getDisplayMedia does not allow adding/removing audio on an existing stream —
   * the only reliable approach is to stop the share and restart it with the new
   * audio setting. The brief restart is communicated to the user by the UI layer.
   */
  const toggleScreenShareAudio = useCallback(async () => {
    if (!roomRef.current) return;
    const lp = roomRef.current.localParticipant;
    if (!lp.isScreenShareEnabled) return;

    const { ssRes, ssFps, ssAudio } = ssSettingsRef.current;
    const nextAudio = !ssAudio;

    // Stop current share
    await lp.setScreenShareEnabled(false);
    setIsScreenShareEnabled(false);
    setIsScreenShareAudioEnabled(false);

    // Restart with toggled audio setting
    const captureOpts = buildSSCaptureOptions(ssRes, ssFps, nextAudio);
    const publishOpts = buildSSPublishOptions(ssRes, ssFps);
    ssSettingsRef.current = { ssRes, ssFps, ssAudio: nextAudio };

    await lp.setScreenShareEnabled(true, captureOpts, publishOpts);
    await enforceScreenShareConstraints(ssRes, ssFps);
    setIsScreenShareEnabled(true);
    setIsScreenShareAudioEnabled(nextAudio);
    playCallSound(CallSoundType.ScreenShareStart, { enabled: callSoundsEnabledRef.current });
  }, [roomRef, callSoundsEnabledRef, enforceScreenShareConstraints]);

  const watchScreenShare = useCallback(
    async (identity: string) => {
      const room = roomRef.current;
      if (!room) return;
      const participant = room.remoteParticipants.get(identity);
      if (!participant) return;
      for (const pub of participant.trackPublications.values()) {
        if (
          pub.source === Track.Source.ScreenShare ||
          pub.source === Track.Source.ScreenShareAudio
        ) {
          pub.setSubscribed(true);
          // Explicitly request highest quality — screenshare is single-layer
          // (simulcast: false) so this is a hint to adaptiveStream to prioritise
          // this track and not downgrade it when the tile is initially small.
          if (pub.source === Track.Source.ScreenShare && 'setVideoQuality' in pub) {
            try { (pub as any).setVideoQuality(VideoQuality.HIGH); } catch { /* best-effort */ }
          }
        }
      }
      setWatchedScreenShares((prev) => {
        const next = new Set(prev);
        next.add(identity);
        return next as ReadonlySet<string>;
      });
    },
    [roomRef, setWatchedScreenShares],
  );

  const unwatchScreenShare = useCallback(
    async (identity: string) => {
      const room = roomRef.current;
      if (room) {
        const participant = room.remoteParticipants.get(identity);
        if (participant) {
          for (const pub of participant.trackPublications.values()) {
            if (
              pub.source === Track.Source.ScreenShare ||
              pub.source === Track.Source.ScreenShareAudio
            ) {
              pub.setSubscribed(false);
            }
          }
        }
      }
      setWatchedScreenShares((prev) => {
        const next = new Set(prev);
        next.delete(identity);
        return next as ReadonlySet<string>;
      });
    },
    [roomRef, setWatchedScreenShares],
  );

  const updateActiveScreenShareSettings = useCallback(
    async (ssRes: string, ssFps: number, ssAudio: boolean) => {
      const room = roomRef.current;
      if (!room) return;
      const lp = room.localParticipant;
      if (!lp.isScreenShareEnabled) return;
      // Issue #45: keep settings ref in sync for toggleScreenShareAudio
      ssSettingsRef.current = { ssRes, ssFps, ssAudio };

      const ssPub = lp.getTrackPublication(Track.Source.ScreenShare);
      const ssTrack = ssPub?.track as LocalVideoTrack | undefined;
      if (!ssTrack) return;

      // 1. Apply capture constraints on the MediaStreamTrack
      const targetWidth = ssRes === 'source' ? undefined : resolutionToWidth(ssRes);
      const targetHeight = ssRes === 'source' ? undefined : resolutionToHeight(ssRes);
      const constraints: MediaTrackConstraints = {
        ...(targetWidth  !== undefined && { width:     { ideal: targetWidth  } }),
        ...(targetHeight !== undefined && { height:    { ideal: targetHeight } }),
        ...(ssFps        > 0           && { frameRate: { ideal: ssFps, max: ssFps } }),
      };
      if (Object.keys(constraints).length > 0) {
        await ssTrack.mediaStreamTrack.applyConstraints(constraints).catch(() => {});
      }

      // 2. Update RTCRtpSender encoding params (no track restart)
      const publishOpts = buildSSPublishOptions(ssRes, ssFps);
      const encoding = publishOpts.screenShareEncoding;
      if (encoding) {
        const sender = (ssTrack as any).sender as RTCRtpSender | undefined;
        if (sender) {
          const params = sender.getParameters();
          if (params.encodings?.length) {
            params.encodings = params.encodings.map((enc) => ({
              ...enc,
              maxBitrate:   encoding.maxBitrate,
              maxFramerate: encoding.maxFramerate ?? enc.maxFramerate,
            }));
            await sender.setParameters(params).catch(() => {});
          }
        }
      }

      // 3. Toggle ScreenShareAudio mute/unmute
      const audioPub = lp.getTrackPublication(Track.Source.ScreenShareAudio);
      if (audioPub) {
        if (ssAudio) await audioPub.unmute().catch(() => {});
        else         await audioPub.mute().catch(() => {});
      }
    },
    [roomRef],
  );

  return {
    isScreenShareEnabled,
    isScreenShareAudioEnabled,
    setIsScreenShareEnabled,
    setIsScreenShareAudioEnabled,
    startScreenShare,
    stopScreenShare,
    toggleScreenShareAudio,
    watchScreenShare,
    unwatchScreenShare,
    updateActiveScreenShareSettings,
  };
}
