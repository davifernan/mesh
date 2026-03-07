import { atom } from 'jotai';
import { settingsAtom } from './settings';

export interface SpaceAVSettings {
  maxAudioBitrate: 64 | 128 | 256 | 510;
  maxVideoResolution: '360p' | '480p' | '720p' | '1080p' | '1440p' | '2160p';
  maxVideoFps: 15 | 24 | 30 | 60 | 120;
  maxSSResolution: '720p' | '1080p' | '1440p' | '2160p' | 'source';
  maxSSFps: 5 | 15 | 30 | 60 | 120;
  maxParticipants: number;
}

export interface ChannelAVOverride {
  maxSSResolution?: string;
  maxSSFps?: number;
  maxVideoBitrate?: number;
  maxParticipants?: number;
  displayLabel?: string;
}

export const spaceAVSettingsAtom = atom<SpaceAVSettings | null>(null);
export const channelAVOverrideAtom = atom<ChannelAVOverride | null>(null);

const VIDEO_RESOLUTION_ORDER = ['360p', '480p', '720p', '1080p', '1440p', '2160p'];
const SS_RESOLUTION_ORDER = ['720p', '1080p', '1440p', '2160p', 'source'];

function clampResolution<T extends string>(value: T, max: string, order: string[]): T {
  const valueIdx = order.indexOf(value);
  const maxIdx = order.indexOf(max);
  if (valueIdx === -1 || maxIdx === -1) return value;
  return (valueIdx <= maxIdx ? value : order[maxIdx]) as T;
}

export const effectiveAVSettingsAtom = atom((get) => {
  const user = get(settingsAtom);
  const space = get(spaceAVSettingsAtom);
  const channel = get(channelAVOverrideAtom);

  const maxSSRes = (channel?.maxSSResolution ?? space?.maxSSResolution ?? 'source') as string;
  const maxSSFps = channel?.maxSSFps ?? space?.maxSSFps ?? 60;
  const maxVideoRes = (space?.maxVideoResolution ?? '1080p') as string;
  const maxVideoFps = space?.maxVideoFps ?? 30;
  const maxAudioBitrate = space?.maxAudioBitrate ?? 510;

  return {
    ssResolution: clampResolution(user.ssResolution, maxSSRes, SS_RESOLUTION_ORDER),
    ssFps: Math.min(user.ssFps, maxSSFps),
    videoResolution: clampResolution(user.videoResolution, maxVideoRes, VIDEO_RESOLUTION_ORDER),
    videoFps: Math.min(user.videoFps, maxVideoFps),
    audioBitrate: Math.min(user.audioBitrate, maxAudioBitrate),
    serverMaxSSResolution: maxSSRes,
    serverMaxSSFps: maxSSFps,
    serverMaxVideoResolution: maxVideoRes,
    serverMaxVideoFps: maxVideoFps,
    serverMaxAudioBitrate: maxAudioBitrate,
  };
});
