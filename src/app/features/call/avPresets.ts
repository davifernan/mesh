/**
 * BetterCord — AV Quality Presets
 *
 * LiveKit preset mapping functions and Room option builder.
 * Ported and adapted from Element Call's options.ts.
 *
 * RULES:
 * - adaptiveStream: true and dynacast: true are UPSTREAM DEFAULTS — never change them.
 * - videoCodec: "vp8" — keep upstream default to avoid codec mismatches.
 * - stopMicTrackOnMute must stay false (default) — true causes PublishTrackError on reconnect.
 */

import {
  AudioPresets,
  type AudioCaptureOptions,
  type AudioPreset,
  DefaultReconnectPolicy,
  type E2EEManagerOptions,
  type RoomOptions,
  type ScreenShareCaptureOptions,
  type TrackPublishOptions,
  ScreenSharePresets,
  type TrackPublishDefaults,
  type VideoEncoding,
  VideoPreset,
  VideoPresets,
} from 'livekit-client';

// ─── Screen Share Presets (extends LiveKit built-ins beyond 1080p30) ──────────

/** 1080p screen share — adds 60fps and 120fps variants */
export const ScreenSharePresets1080p = {
  h1080fps15: ScreenSharePresets.h1080fps15,
  h1080fps30: ScreenSharePresets.h1080fps30,
  // 60fps: extra headroom for motion; 120fps: high-motion gaming content
  h1080fps60: new VideoPreset(1920, 1080, 10_000_000, 60, 'high'),
  h1080fps120: new VideoPreset(1920, 1080, 16_000_000, 120, 'high'),
} as const;

/** 1440p / QHD screen share presets */
export const ScreenSharePresets1440p = {
  h1440fps15: new VideoPreset(2560, 1440, 2_500_000, 15, 'high'),
  h1440fps30: new VideoPreset(2560, 1440, 5_000_000, 30, 'high'),
  // 60fps: 1440p at 60fps is a common gaming target — needs real bitrate
  h1440fps60: new VideoPreset(2560, 1440, 10_000_000, 60, 'high'),
  // 120fps: premium gaming mode — most demanding 1440p profile
  h1440fps120: new VideoPreset(2560, 1440, 16_000_000, 120, 'high'),
} as const;

/** 4K / UHD screen share presets.
 *
 * VP8 at 4k needs ~15-20 Mbps for crisp text/UI (content hint 'detail').
 * Motion content at 60/120fps needs even more headroom.
 *
 * Issue #67: all 4K presets require maxBitrate ≥ 15 Mbps for legible text at full resolution.
 */
export const ScreenSharePresets4K = {
  // 15fps: minimum viable bitrate for static UI / slides at 4K
  h2160fps15: new VideoPreset(3840, 2160, 15_000_000, 15, 'high'),
  // 30fps: higher rate for smooth scrolling / light motion at 4K
  h2160fps30: new VideoPreset(3840, 2160, 20_000_000, 30, 'high'),
  // 4k60: primary aggressive profile — headroom for high-motion content
  h2160fps60: new VideoPreset(3840, 2160, 26_000_000, 60, 'high'),
  // 4k120: maximum quality — high-refresh gaming at 4k
  h2160fps120: new VideoPreset(3840, 2160, 35_000_000, 120, 'high'),
} as const;

// ─── Mapping Functions ────────────────────────────────────────────────────────

/**
 * Maps a BetterCord video resolution string to a LiveKit VideoPreset.
 * Falls back to 720p for unknown values.
 */
export function resolutionToVideoPreset(res?: string): VideoPreset {
  switch (res) {
    case '360p': return VideoPresets.h360;
    case '480p': return new VideoPreset(854, 480, 600_000, 30); // h480 is 4:3 only
    case '720p': return VideoPresets.h720;
    case '1080p': return VideoPresets.h1080;
    case '1440p': return new VideoPreset(2560, 1440, 5_000_000, 30, 'high');
    // Issue #67: 4K needs 15 Mbps for crisp text/UI at full resolution
    case '2160p': return new VideoPreset(3840, 2160, 15_000_000, 30, 'high');
    default: return VideoPresets.h720;
  }
}

/**
 * Maps BetterCord screenshare resolution + fps to a LiveKit VideoPreset.
 * fps is bucketed: ≤15→15, ≤30→30, ≤60→60, else→120.
 * 'source' resolution returns undefined (no constraint applied).
 */
export function resolutionToSSPreset(res?: string, fps?: number): VideoPreset | undefined {
  if (!res || res === 'source') return undefined;

  const fpsBucket =
    !fps || fps <= 15 ? 15 : fps <= 30 ? 30 : fps <= 60 ? 60 : 120;

  switch (res) {
    case '4k':
      return fpsBucket <= 15 ? ScreenSharePresets4K.h2160fps15
        : fpsBucket <= 30 ? ScreenSharePresets4K.h2160fps30
        : fpsBucket <= 60 ? ScreenSharePresets4K.h2160fps60
        : ScreenSharePresets4K.h2160fps120;
    case '1440p':
      return fpsBucket <= 15 ? ScreenSharePresets1440p.h1440fps15
        : fpsBucket <= 30 ? ScreenSharePresets1440p.h1440fps30
        : fpsBucket <= 60 ? ScreenSharePresets1440p.h1440fps60
        : ScreenSharePresets1440p.h1440fps120;
    case '1080p':
      return fpsBucket <= 15 ? ScreenSharePresets1080p.h1080fps15
        : fpsBucket <= 30 ? ScreenSharePresets1080p.h1080fps30
        : fpsBucket <= 60 ? ScreenSharePresets1080p.h1080fps60
        : ScreenSharePresets1080p.h1080fps120;
    default: // '720p'
      return fpsBucket <= 15 ? ScreenSharePresets.h720fps15
        : fpsBucket <= 30 ? ScreenSharePresets.h720fps30
        : fpsBucket <= 60 ? new VideoPreset(1280, 720, 4_000_000, 60, 'high')
        : new VideoPreset(1280, 720, 7_000_000, 120, 'high');
  }
}

/**
 * Maps audio bitrate in kbps to a LiveKit AudioPreset.
 * Falls back to music (48kbps) if not specified.
 */
export function bitrateToAudioPreset(kbps?: number): AudioPreset {
  if (!kbps) return AudioPresets.music;
  return { maxBitrate: kbps * 1000 };
}

/**
 * Returns appropriate simulcast layers for the chosen camera resolution.
 * Lower base resolutions get fewer layers to save bandwidth.
 */
export function getSimulcastLayers(res?: string): VideoPreset[] {
  switch (res) {
    // Issue #68: 360p needs an h180 fallback layer so the SFU always has a downgrade path
    case '360p': return [new VideoPreset(320, 180, 80_000, 15)];
    case '480p': return [VideoPresets.h180];
    case '720p': return [VideoPresets.h180, VideoPresets.h360];
    case '1080p': return [VideoPresets.h180, VideoPresets.h360, VideoPresets.h720];
    case '1440p':
    case '2160p': return [VideoPresets.h180, VideoPresets.h360, VideoPresets.h720, VideoPresets.h1080];
    default: return [VideoPresets.h180, VideoPresets.h360];
  }
}

/**
 * Issue #69: Returns a backupCodec VP8 encoding that matches the active camera resolution.
 * Prevents the backup codec from always defaulting to h720 regardless of camera quality.
 */
export function getBackupCodecEncoding(res?: string): VideoEncoding {
  switch (res) {
    case '360p': return VideoPresets.h360.encoding;
    case '480p': return new VideoPreset(854, 480, 600_000, 30).encoding;
    case '720p': return VideoPresets.h720.encoding;
    case '1080p': return VideoPresets.h1080.encoding;
    case '1440p': return new VideoPreset(2560, 1440, 5_000_000, 30).encoding;
    case '2160p': return new VideoPreset(3840, 2160, 15_000_000, 30).encoding;
    default: return VideoPresets.h720.encoding;
  }
}

function getCameraBitrateCap(res?: string): number | undefined {
  switch (res) {
    case '360p': return 900_000;
    case '480p': return 1_200_000;
    case '720p': return 4_000_000;
    case '1080p': return 7_000_000;
    case '1440p': return 12_000_000;
    case '2160p': return 20_000_000;
    default: return undefined;
  }
}

export function scaleEncodingBitrateForFps(
  maxBitrate: number,
  baseFps: number,
  targetFps: number,
  cap?: number,
): number {
  if (!targetFps || targetFps <= baseFps) {
    return maxBitrate;
  }

  const scaled = Math.round(maxBitrate * Math.min(targetFps / Math.max(baseFps, 1), 3));
  return cap ? Math.min(scaled, cap) : scaled;
}

export function getScreenShareContentHint(
  ssResolution: string,
  ssFps: number,
): 'detail' | 'text' | 'motion' {
  if (ssFps >= 60) {
    return 'motion';
  }

  return ssResolution === 'source' || ssResolution === '4k' || ssResolution === '1440p'
    ? 'detail'
    : 'text';
}

// ─── AV Settings Type ─────────────────────────────────────────────────────────

export interface AVSettings {
  audioBitrate: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  videoResolution: string;
  videoFps: number;
  ssResolution: string;
  ssFps: number;
  ssAudio: boolean;
  micDeviceId?: string;
  cameraDeviceId?: string;
  speakerDeviceId?: string;
}

export type AudioCaptureSettings = Pick<
  AVSettings,
  'echoCancellation' | 'noiseSuppression' | 'autoGainControl' | 'micDeviceId'
>;

export function buildAudioCaptureDefaults(av: AudioCaptureSettings): AudioCaptureOptions {
  return {
    deviceId: av.micDeviceId,
    echoCancellation: av.echoCancellation,
    noiseSuppression: av.noiseSuppression,
    autoGainControl: av.autoGainControl,
    // CRITICAL: Explicitly set voiceIsolation so it is never eliminated by object spread
    // in the SDK. Without this, BetterCord's own AudioCaptureOptions replace the SDK
    // defaults entirely, which drops voiceIsolation and enables Chrome's old WebRTC
    // noise suppressor (AEC3) — causing the metallic "Blechdosen" sound.
    voiceIsolation: true,
  };
}

// ─── Screenshare Capture Options ──────────────────────────────────────────────

/**
 * Builds LiveKit ScreenShareCaptureOptions for setScreenShareEnabled().
 *
 * Issue #46: stopScreenShareTrackOnMute: false prevents OS capture teardown on mute.
 * Issue #48: Chrome-only getDisplayMedia extensions are guarded behind isChrome — Firefox
 *   and Safari throw on unknown constraints (systemAudio, surfaceSwitching, etc.)
 */
export function buildSSCaptureOptions(
  ssResolution: string,
  ssFps: number,
  ssAudio: boolean,
): ScreenShareCaptureOptions {
  const isChrome =
    typeof navigator !== 'undefined' &&
    /Chrome/.test(navigator.userAgent) &&
    /Google Inc/.test(navigator.vendor);

  const preset = resolutionToSSPreset(ssResolution, ssFps);

  const videoConstraint: boolean | MediaTrackConstraints =
    !preset && ssFps
      ? { frameRate: { ideal: ssFps, max: ssFps } }
      : true;

  // suppressLocalAudioPlayback is Chrome-only — prevents system audio loopback in the mic
  const audioConstraint: boolean | MediaTrackConstraints = ssAudio
    ? isChrome
      ? ({ suppressLocalAudioPlayback: true } as MediaTrackConstraints)
      : true
    : false;

  return {
    stopScreenShareTrackOnMute: false, // Issue #46: keep OS capture alive when track is muted
    audio: audioConstraint,
    video: videoConstraint,
    resolution: preset?.resolution,
    contentHint: getScreenShareContentHint(ssResolution, ssFps),
    // Issue #48: Chrome-specific getDisplayMedia extensions — omit on Firefox/Safari
    ...(isChrome && {
      preferCurrentTab: false as const,
      selfBrowserSurface: 'include' as const,
      surfaceSwitching: 'include' as const,
      systemAudio: (ssAudio ? 'include' : 'exclude') as 'include' | 'exclude',
    }),
  };
}

// ─── LiveKit Room Options Builder ─────────────────────────────────────────────

const defaultPublishOptions: TrackPublishDefaults = {
  // Keep upstream defaults — DO NOT change videoCodec, stopMicTrackOnMute, etc.
  screenShareEncoding: ScreenSharePresets.h1080fps30.encoding,
  videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360] as VideoPreset[],
  stopMicTrackOnMute: false, // NEVER set true — causes PublishTrackError on reconnect
  videoCodec: 'vp8',         // Keep vp8 — VP9 causes codec mismatches; AV1 opt-in via experimentalAV1 flag
  dtx: true,
  red: true,
  forceStereo: false,
  videoEncoding: VideoPresets.h720.encoding,
  backupCodec: { codec: 'vp8', encoding: VideoPresets.h720.encoding },
};

/**
 * Builds LiveKit RoomOptions from BetterCord AV settings.
 *
 * CRITICAL: adaptiveStream and dynacast are kept at upstream defaults (true).
 * Only publishDefaults is customized with user quality preferences.
 *
 * Issue #72: experimentalAV1=true switches videoCodec to 'av1' when the browser supports it.
 *   AV1 is NOT VP9 — the AGENTS.md warning against VP9 does NOT apply here.
 *   Fallback: if RTCRtpSender reports no AV1 capability, vp8 is used instead.
 */
export function buildLiveKitRoomOptions(
  av: AVSettings,
  e2eeOptions?: E2EEManagerOptions,
  experimentalAV1 = false,
): RoomOptions {
  // Issue #72: check browser AV1 support at runtime before enabling
  const supportsAV1 =
    experimentalAV1 &&
    (RTCRtpSender.getCapabilities?.('video')?.codecs?.some(
      (c) => c.mimeType.toLowerCase() === 'video/av1',
    ) ?? false);
  const videoCodec: 'vp8' | 'av1' = supportsAV1 ? 'av1' : 'vp8';
  const videoPreset = resolutionToVideoPreset(av.videoResolution);
  const baseVideoFps = videoPreset.encoding.maxFramerate ?? 30;
  const targetVideoFps = av.videoFps || baseVideoFps;
  const videoEncoding = av.videoFps
    ? {
      ...videoPreset.encoding,
      maxFramerate: targetVideoFps,
      maxBitrate: scaleEncodingBitrateForFps(
        videoPreset.encoding.maxBitrate,
        baseVideoFps,
        targetVideoFps,
        getCameraBitrateCap(av.videoResolution),
      ),
    }
    : videoPreset.encoding;

  return {
    // upstream defaults — DO NOT override these
    adaptiveStream: true,
    dynacast: true,
    reconnectPolicy: new DefaultReconnectPolicy(),

    // device capture defaults
    videoCaptureDefaults: {
      deviceId: av.cameraDeviceId,
      resolution: videoPreset.resolution,
      frameRate: targetVideoFps,
    },
    audioCaptureDefaults: buildAudioCaptureDefaults(av),
    audioOutput: av.speakerDeviceId
      ? { deviceId: av.speakerDeviceId }
      : undefined,

    // publish quality settings
    publishDefaults: {
      ...defaultPublishOptions,
      audioPreset: bitrateToAudioPreset(av.audioBitrate),
      videoEncoding,
      videoSimulcastLayers: getSimulcastLayers(av.videoResolution),
      // Issue #69: backupCodec encoding matches active camera resolution (not always h720)
      backupCodec: { codec: 'vp8', encoding: getBackupCodecEncoding(av.videoResolution) },
      // Issue #72: AV1 opt-in via experimentalAV1 config flag (requires browser support)
      videoCodec,
    },

    // E2EE — only set if key provider is supplied
    ...(e2eeOptions && { e2ee: e2eeOptions }),
  };
}

/**
 * Builds LiveKit TrackPublishOptions for a screenshare track.
 * Sets screenShareEncoding to match the chosen resolution/fps so the SFU
 * applies correct bitrate caps — without this, quality settings are ignored.
 */
export function buildSSPublishOptions(
  ssResolution: string,
  ssFps: number,
): TrackPublishOptions {
  const preset = resolutionToSSPreset(ssResolution, ssFps);
  // 'source' mode — no resolution cap, so we budget more aggressively for high fps.
  // At high fps the SFU still enforces maxBitrate; choose values that allow crisp
  // native-resolution content without starving audio on a typical 25–50 Mbps uplink.
  const sourceEncoding =
    !preset && ssResolution === 'source'
      ? {
          maxFramerate: ssFps,
          maxBitrate:
            ssFps <= 15 ? 2_500_000
              : ssFps <= 30 ? 5_000_000
              : ssFps <= 60 ? 10_000_000
              : 16_000_000,
        }
      : undefined;

  return {
    simulcast: false, // screenshare must NOT simulcast
    ...(preset && { screenShareEncoding: preset.encoding }),
    ...(sourceEncoding && { screenShareEncoding: sourceEncoding }),
  };
}

/** Width in pixels for a given resolution string (for display purposes). */
export function resolutionToWidth(res: string): number {
  const map: Record<string, number> = {
    '360p': 640, '480p': 854, '720p': 1280, '1080p': 1920,
    '1440p': 2560, '4k': 3840, '2160p': 3840, 'source': 0,
  };
  return map[res] ?? 1280;
}

/** Height in pixels for a given resolution string (for display purposes). */
export function resolutionToHeight(res: string): number {
  const map: Record<string, number> = {
    '360p': 360, '480p': 480, '720p': 720, '1080p': 1080,
    '1440p': 1440, '4k': 2160, '2160p': 2160, 'source': 0,
  };
  return map[res] ?? 720;
}
