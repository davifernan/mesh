import { describe, expect, it } from 'vitest';
import { getBestInboundVideoSample } from '../app/pages/client/call/ScreenShareTile';

function createStatsReport(
  stats: Array<Record<string, unknown> & { id: string; type: string; timestamp?: number }>,
): RTCStatsReport {
  return new Map(stats.map((stat) => [stat.id, stat])) as unknown as RTCStatsReport;
}

describe('getBestInboundVideoSample', () => {
  it('selects the inbound video stream with the highest bytes received', () => {
    const report = createStatsReport([
      {
        id: 'audio',
        type: 'inbound-rtp',
        mediaType: 'audio',
        bytesReceived: 99_999,
        timestamp: 1_000,
      },
      {
        id: 'low',
        type: 'inbound-rtp',
        mediaType: 'video',
        frameWidth: 1280,
        frameHeight: 720,
        bytesReceived: 500,
        framesPerSecond: 15,
        timestamp: 1_000,
      },
      {
        id: 'high',
        type: 'inbound-rtp',
        mediaType: 'video',
        frameWidth: 1920,
        frameHeight: 1080,
        bytesReceived: 3_000,
        framesPerSecond: 30,
        timestamp: 1_000,
      },
    ]);

    expect(getBestInboundVideoSample(report)).toMatchObject({
      id: 'high',
      width: 1920,
      height: 1080,
      fps: 30,
    });
  });

  it('derives fps from decoded-frame deltas when the browser omits framesPerSecond', () => {
    const previous = {
      id: 'stream-1',
      width: 1920,
      height: 1080,
      bytesReceived: 1_000,
      framesDecoded: 120,
      timestamp: 1_000,
    };

    const report = createStatsReport([
      {
        id: 'stream-1',
        type: 'inbound-rtp',
        kind: 'video',
        frameWidth: 1920,
        frameHeight: 1080,
        bytesReceived: 2_000,
        framesDecoded: 180,
        timestamp: 3_000,
      },
    ]);

    expect(getBestInboundVideoSample(report, previous)?.fps).toBe(30);
  });
});
