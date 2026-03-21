import { describe, expect, it } from 'vitest';
import {
  buildSSCaptureOptions,
  buildSSPublishOptions,
} from '../app/features/call/avPresets';

describe('source mode screenshare', () => {
  it('passes frameRate constraint when source + 60fps', () => {
    const capture = buildSSCaptureOptions('source', 60, false);
    expect(capture.resolution).toBeUndefined();
    expect(capture.video).toMatchObject({ frameRate: { ideal: 60, max: 60 } });
  });

  it('passes frameRate constraint when source + 15fps', () => {
    const capture = buildSSCaptureOptions('source', 15, false);
    expect(capture.resolution).toBeUndefined();
    expect(capture.video).toMatchObject({ frameRate: { ideal: 15, max: 15 } });
  });

  it('uses boolean true for video in preset modes (non-source)', () => {
    const capture = buildSSCaptureOptions('1080p', 30, false);
    expect(capture.resolution).toBeDefined();
    expect(capture.video).toBe(true);
  });

  it('buildSSPublishOptions source 60fps keeps correct bitrate', () => {
    const pub = buildSSPublishOptions('source', 60);
    expect(pub.simulcast).toBe(false);
    expect(pub.screenShareEncoding?.maxBitrate).toBe(10_000_000);
    expect(pub.screenShareEncoding?.maxFramerate).toBe(60);
  });

  it('source without fps does not set video constraints', () => {
    const capture = buildSSCaptureOptions('source', 0, false);
    // 0 is falsy → no MediaTrackConstraints, falls back to boolean true
    expect(capture.video).toBe(true);
  });
});
