import { describe, expect, it } from 'vitest';
import {
  buildLiveKitRoomOptions,
  buildSSCaptureOptions,
  buildSSPublishOptions,
  getScreenShareContentHint,
  scaleEncodingBitrateForFps,
  ScreenSharePresets4K,
  ScreenSharePresets1440p,
  ScreenSharePresets1080p,
} from '../app/features/call/avPresets';

describe('avPresets', () => {
  it('maps screenshare capture presets to LiveKit resolution hints', () => {
    const capture = buildSSCaptureOptions('1440p', 120, true);

    expect(capture.audio).toBe(true);
    expect(capture.video).toBe(true);
    expect(capture.systemAudio).toBe('include');
    expect(capture.contentHint).toBe('motion');
    expect(capture.resolution).toMatchObject({ width: 2560, height: 1440, frameRate: 120 });
  });

  it('keeps source capture uncapped while still hinting text/detail content', () => {
    const capture = buildSSCaptureOptions('source', 30, false);

    expect(capture.audio).toBe(false);
    expect(capture.resolution).toBeUndefined();
    expect(capture.systemAudio).toBe('exclude');
    expect(capture.contentHint).toBe('detail');
  });

  it('publishes screenshare encoding via screenShareEncoding (4k60 → 18 Mbps)', () => {
    const publish = buildSSPublishOptions('4k', 60);

    expect(publish.simulcast).toBe(false);
    // Updated aggressive profile: 18 Mbps for crisp 4k60 text/UI
    expect(publish.screenShareEncoding).toMatchObject({ maxBitrate: 18_000_000, maxFramerate: 60 });
    expect('videoEncoding' in publish).toBe(false);
  });

  it('builds room options with explicit audio semantics and high-fps video scaling', () => {
    const options = buildLiveKitRoomOptions({
      audioBitrate: 128,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
      videoResolution: '2160p',
      videoFps: 120,
      ssResolution: '1080p',
      ssFps: 30,
      ssAudio: true,
      micDeviceId: 'mic-1',
      cameraDeviceId: 'cam-1',
      speakerDeviceId: 'speaker-1',
    });

    expect(options.audioCaptureDefaults).toMatchObject({
      deviceId: 'mic-1',
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
      voiceIsolation: false,
    });
    expect(options.videoCaptureDefaults).toMatchObject({
      deviceId: 'cam-1',
      frameRate: 120,
    });
    expect(options.publishDefaults).toMatchObject({
      audioPreset: { maxBitrate: 128_000 },
      dtx: true,
      red: true,
      forceStereo: false,
      videoEncoding: {
        maxFramerate: 120,
        maxBitrate: 20_000_000,
      },
    });
  });

  it('caps bitrate scaling to the configured ceiling', () => {
    expect(scaleEncodingBitrateForFps(10_000_000, 30, 120, 20_000_000)).toBe(20_000_000);
    expect(getScreenShareContentHint('1080p', 15)).toBe('text');
  });

  // ── Aggressive bitrate profile assertions ────────────────────────────────

  it('has correct bitrates for all 4k preset variants', () => {
    expect(ScreenSharePresets4K.h2160fps15.encoding.maxBitrate).toBe(6_000_000);
    expect(ScreenSharePresets4K.h2160fps30.encoding.maxBitrate).toBe(10_000_000);
    expect(ScreenSharePresets4K.h2160fps60.encoding.maxBitrate).toBe(18_000_000);
    expect(ScreenSharePresets4K.h2160fps120.encoding.maxBitrate).toBe(26_000_000);
  });

  it('has correct bitrates for all 1440p preset variants', () => {
    expect(ScreenSharePresets1440p.h1440fps15.encoding.maxBitrate).toBe(2_500_000);
    expect(ScreenSharePresets1440p.h1440fps30.encoding.maxBitrate).toBe(5_000_000);
    expect(ScreenSharePresets1440p.h1440fps60.encoding.maxBitrate).toBe(10_000_000);
    expect(ScreenSharePresets1440p.h1440fps120.encoding.maxBitrate).toBe(16_000_000);
  });

  it('has correct bitrates for 1080p high-fps variants', () => {
    expect(ScreenSharePresets1080p.h1080fps60.encoding.maxBitrate).toBe(10_000_000);
    expect(ScreenSharePresets1080p.h1080fps120.encoding.maxBitrate).toBe(16_000_000);
  });

  it('source mode uses aggressive bitrates for high fps', () => {
    // 30fps source
    const pub30 = buildSSPublishOptions('source', 30);
    expect(pub30.screenShareEncoding?.maxBitrate).toBe(5_000_000);

    // 60fps source
    const pub60 = buildSSPublishOptions('source', 60);
    expect(pub60.screenShareEncoding?.maxBitrate).toBe(10_000_000);

    // 120fps source
    const pub120 = buildSSPublishOptions('source', 120);
    expect(pub120.screenShareEncoding?.maxBitrate).toBe(16_000_000);
  });
});
