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
  type AudioPreset,
  type BaseKeyProvider,
  DefaultReconnectPolicy,
  type E2EEManagerOptions,
  type RoomOptions,
  ScreenSharePresets,
  type TrackPublishDefaults,
  VideoPreset,
  VideoPresets,
} from 'livekit-client';

// ─── Screen Share Presets (extends LiveKit built-ins beyond 1080p30) ──────────

/** 1080p screen share — adds 60fps and 120fps variants */
export const ScreenSharePresets1080p = {
  h1080fps15: ScreenSharePresets.h1080fps15,
  h1080fps30: ScreenSharePresets.h1080fps30,
  h1080fps60: new VideoPreset(1920, 1080, 8_000_000, 60, 'high'),
  h1080fps120: new VideoPreset(1920, 1080, 14_000_000, 120, 'high'),
} as const;

/** 1440p / QHD screen share presets */
export const ScreenSharePresets1440p = {
  h1440fps15: new VideoPreset(2560, 1440, 2_500_000, 15, 'high'),
  h1440fps30: new VideoPreset(2560, 1440, 4_000_000, 30, 'high'),
  h1440fps60: new VideoPreset(2560, 1440, 6_000_000, 60, 'high'),
  h1440fps120: new VideoPreset(2560, 1440, 10_000_000, 120, 'high'),
} as const;

/** 4K / UHD screen share presets */
export const ScreenSharePresets4K = {
  h2160fps15: new VideoPreset(3840, 2160, 5_000_000, 15, 'high'),
  h2160fps30: new VideoPreset(3840, 2160, 8_000_000, 30, 'high'),
  h2160fps60: new VideoPreset(3840, 2160, 12_000_000, 60, 'high'),
  h2160fps120: new VideoPreset(3840, 2160, 20_000_000, 120, 'high'),
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
    case '2160p': return new VideoPreset(3840, 2160, 10_000_000, 30, 'high');
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
    case '360p': return [];
    case '480p': return [VideoPresets.h180];
    case '720p': return [VideoPresets.h180, VideoPresets.h360];
    case '1080p': return [VideoPresets.h180, VideoPresets.h360, VideoPresets.h720];
    case '1440p':
    case '2160p': return [VideoPresets.h180, VideoPresets.h360, VideoPresets.h720];
    default: return [VideoPresets.h180, VideoPresets.h360];
  }
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

// ─── Screenshare Capture Options ──────────────────────────────────────────────

export interface SSCaptureOptions {
  audio: boolean;
  selfBrowserSurface: 'include' | 'exclude';
  surfaceSwitching: 'include' | 'exclude';
  systemAudio: 'include' | 'exclude';
  video?: MediaTrackConstraints | boolean;
}

/**
 * Builds MediaStreamConstraints-style capture options for setScreenShareEnabled().
 */
export function buildSSCaptureOptions(
  ssResolution: string,
  ssFps: number,
  ssAudio: boolean,
): SSCaptureOptions {
  const preset = resolutionToSSPreset(ssResolution, ssFps);

  return {
    audio: ssAudio,
    selfBrowserSurface: 'include',
    surfaceSwitching: 'include',
    systemAudio: 'include',
    ...(preset && {
      video: {
        width: { ideal: preset.width, max: preset.width },
        height: { ideal: preset.height, max: preset.height },
        frameRate: { ideal: preset.encoding.maxFramerate, max: preset.encoding.maxFramerate },
      },
    }),
    ...(!preset && ssFps !== undefined && {
      video: { frameRate: { ideal: ssFps, max: ssFps } },
    }),
  };
}

// ─── LiveKit Room Options Builder ─────────────────────────────────────────────

const defaultPublishOptions: TrackPublishDefaults = {
  // Keep upstream defaults — DO NOT change videoCodec, stopMicTrackOnMute, etc.
  screenShareEncoding: ScreenSharePresets.h1080fps30.encoding,
  videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360] as VideoPreset[],
  stopMicTrackOnMute: false, // NEVER set true — causes PublishTrackError on reconnect
  videoCodec: 'vp8',         // Keep vp8 — VP9 causes codec mismatches
  videoEncoding: VideoPresets.h720.encoding,
  backupCodec: { codec: 'vp8', encoding: VideoPresets.h720.encoding },
};

/**
 * Builds LiveKit RoomOptions from BetterCord AV settings.
 *
 * CRITICAL: adaptiveStream and dynacast are kept at upstream defaults (true).
 * Only publishDefaults is customized with user quality preferences.
 */
export function buildLiveKitRoomOptions(
  av: AVSettings,
  e2eeOptions?: E2EEManagerOptions,
): RoomOptions {
  const videoPreset = resolutionToVideoPreset(av.videoResolution);
  const videoEncoding = av.videoFps
    ? { ...videoPreset.encoding, maxFramerate: av.videoFps }
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
    },
    audioCaptureDefaults: {
      deviceId: av.micDeviceId,
      echoCancellation: av.echoCancellation,
      noiseSuppression: av.noiseSuppression,
      autoGainControl: av.autoGainControl,
    },
    audioOutput: av.speakerDeviceId
      ? { deviceId: av.speakerDeviceId }
      : undefined,

    // publish quality settings
    publishDefaults: {
      ...defaultPublishOptions,
      audioPreset: bitrateToAudioPreset(av.audioBitrate),
      videoEncoding,
      videoSimulcastLayers: getSimulcastLayers(av.videoResolution),
    },

    // E2EE — only set if key provider is supplied
    ...(e2eeOptions && { e2ee: e2eeOptions }),
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
