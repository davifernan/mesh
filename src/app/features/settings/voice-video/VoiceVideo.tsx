import React, { useEffect, useRef, useState } from 'react';
import { Box, Chip, Scroll, Switch, Text, config } from 'folds';
import { Page, PageContent, PageHeader } from '../../../components/page';
import { SettingTile } from '../../../components/setting-tile';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { useAtomValue } from 'jotai';
import { effectiveAVSettingsAtom } from '../../../state/avQuality';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';

type ChipRowProps<T extends string | number> = {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Record<string | number, string>;
  serverMax?: T | string | number;
};
function ChipRow<T extends string | number>({
  options,
  value,
  onChange,
  labels,
  serverMax,
}: ChipRowProps<T>) {
  return (
    <Box gap="200" wrap="Wrap">
      {options.map((opt) => {
        const isSelected = opt === value;
        const label = labels ? labels[opt] ?? String(opt) : String(opt);
        return (
          <Chip
            key={String(opt)}
            as="button"
            variant={isSelected ? 'Primary' : 'Surface'}
            radii="Pill"
            onClick={() => onChange(opt)}
            aria-pressed={isSelected}
          >
            <Text size="T200">{label}</Text>
          </Chip>
        );
      })}
      {serverMax !== undefined && (
        <Text size="T200" priority="300" style={{ alignSelf: 'center' }}>
          (Server-Max: {String(serverMax)})
        </Text>
      )}
    </Box>
  );
}

// ── Device picker ────────────────────────────────────────────────────────────

type MediaDeviceInfo2 = { deviceId: string; label: string };

function useMediaDeviceList(kind: MediaDeviceKind): MediaDeviceInfo2[] {
  const [devices, setDevices] = useState<MediaDeviceInfo2[]>([]);
  const permissionRequestedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load(requestPermission: boolean) {
      // If labels are empty, request permission first (browser hides labels until granted)
      if (requestPermission && !permissionRequestedRef.current) {
        permissionRequestedRef.current = true;
        try {
          const constraints = kind === 'videoinput' ? { video: true } : { audio: true };
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          stream.getTracks().forEach((t) => t.stop());
        } catch {
          // Permission denied — still enumerate (labels will be empty)
        }
      }

      const all = await navigator.mediaDevices.enumerateDevices();
      if (cancelled) return;

      const filtered = all
        .filter((d) => d.kind === kind)
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `${kind === 'audioinput' ? 'Microphone' : kind === 'videoinput' ? 'Camera' : 'Speaker'} ${d.deviceId.slice(0, 6)}`,
        }));

      setDevices(filtered);

      // If labels are still empty, retry after requesting permission
      if (filtered.every((d) => !d.label || d.label.startsWith('Microphone ') || d.label.startsWith('Camera ') || d.label.startsWith('Speaker '))) {
        if (!requestPermission) load(true);
      }
    }

    void load(false);
    navigator.mediaDevices.addEventListener('devicechange', () => void load(false));
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener('devicechange', () => void load(false));
    };
  }, [kind]);

  return devices;
}

type DeviceSelectProps = {
  kind: MediaDeviceKind;
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  placeholder: string;
};

function DeviceSelect({ kind, value, onChange, placeholder }: DeviceSelectProps) {
  const devices = useMediaDeviceList(kind);

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
      style={{
        background: 'var(--bg-surface-low, #1e1f22)',
        color: 'var(--text-normal, #dbdee1)',
        border: '1px solid var(--background-modifier-accent, #3a3c40)',
        borderRadius: '4px',
        padding: '6px 10px',
        fontSize: '14px',
        minWidth: '220px',
        maxWidth: '100%',
        cursor: 'pointer',
        outline: 'none',
      }}
    >
      <option value="">{placeholder}</option>
      {devices.map((d) => (
        <option key={d.deviceId} value={d.deviceId}>
          {d.label}
        </option>
      ))}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type VoiceVideoProps = {
  requestClose: () => void;
};

export function VoiceVideo({ requestClose }: VoiceVideoProps) {
  const effective = useAtomValue(effectiveAVSettingsAtom);

  const [micDeviceId, setMicDeviceId] = useSetting(settingsAtom, 'micDeviceId');
  const [cameraDeviceId, setCameraDeviceId] = useSetting(settingsAtom, 'cameraDeviceId');
  const [speakerDeviceId, setSpeakerDeviceId] = useSetting(settingsAtom, 'speakerDeviceId');

  const [audioBitrate, setAudioBitrate] = useSetting(settingsAtom, 'audioBitrate');
  const [echoCancellation, setEchoCancellation] = useSetting(settingsAtom, 'echoCancellation');
  const [noiseSuppression, setNoiseSuppression] = useSetting(settingsAtom, 'noiseSuppression');
  const [autoGainControl, setAutoGainControl] = useSetting(settingsAtom, 'autoGainControl');
  const [videoResolution, setVideoResolution] = useSetting(settingsAtom, 'videoResolution');
  const [videoFps, setVideoFps] = useSetting(settingsAtom, 'videoFps');
  const [ssResolution, setSSResolution] = useSetting(settingsAtom, 'ssResolution');
  const [ssFps, setSSFps] = useSetting(settingsAtom, 'ssFps');
  const [ssAudio, setSSAudio] = useSetting(settingsAtom, 'ssAudio');

  const serverLimitsAudio = effective.serverMaxAudioBitrate < 510;
  const serverLimitsVideo =
    effective.serverMaxVideoResolution !== '2160p' || effective.serverMaxVideoFps < 120;
  const serverLimitsSS =
    effective.serverMaxSSResolution !== 'source' || effective.serverMaxSSFps < 120;

  return (
    <Page>
      <PageHeader balance>
        <Box grow="Yes" alignItems="Center" gap="200">
          <Text size="H3" as="h2">
            Voice & Video
          </Text>
        </Box>
      </PageHeader>
      <Box grow="Yes">
      <Scroll hideTrack visibility="Hover">
      <PageContent>
        {/* Devices */}
        <Box direction="Column" gap="200">
          <Text size="L400" priority="300">
            DEVICES
          </Text>
          <SequenceCard className={SequenceCardStyle}>
            <SettingTile
              title="Microphone"
              description="Input device used for your voice in calls."
              after={
                <DeviceSelect
                  kind="audioinput"
                  value={micDeviceId}
                  onChange={setMicDeviceId}
                  placeholder="Default microphone"
                />
              }
            />
          </SequenceCard>
          <SequenceCard className={SequenceCardStyle}>
            <SettingTile
              title="Camera"
              description="Video input device used for camera in calls."
              after={
                <DeviceSelect
                  kind="videoinput"
                  value={cameraDeviceId}
                  onChange={setCameraDeviceId}
                  placeholder="Default camera"
                />
              }
            />
          </SequenceCard>
          <SequenceCard className={SequenceCardStyle}>
            <SettingTile
              title="Speaker / Output"
              description="Audio output device for call audio. Not supported on Firefox."
              after={
                <DeviceSelect
                  kind="audiooutput"
                  value={speakerDeviceId}
                  onChange={setSpeakerDeviceId}
                  placeholder="Default speaker"
                />
              }
            />
          </SequenceCard>
        </Box>

        {/* Audio */}
        <Box direction="Column" gap="200" style={{ marginTop: config.space.S500 }}>
          <Text size="L400" priority="300">
            AUDIO
          </Text>
          <SequenceCard className={SequenceCardStyle}>
            <SettingTile
              title="Microphone Bitrate"
              description={
                serverLimitsAudio
                  ? `Higher bitrate = better quality. Server maximum: ${effective.serverMaxAudioBitrate} kbps.`
                  : 'Higher bitrate = better quality but more bandwidth.'
              }
              after={
                <ChipRow<32 | 64 | 128 | 256 | 510>
                  options={[32, 64, 128, 256, 510]}
                  value={audioBitrate}
                  onChange={setAudioBitrate}
                  labels={{ 32: '32k', 64: '64k', 128: '128k', 256: '256k', 510: '510k' }}
                />
              }
            />
          </SequenceCard>
          <SequenceCard className={SequenceCardStyle}>
            <SettingTile
              title="Echo Cancellation"
              after={
                <Switch
                  variant="Primary"
                  value={echoCancellation}
                  onChange={setEchoCancellation}
                />
              }
            />
          </SequenceCard>
          <SequenceCard className={SequenceCardStyle}>
            <SettingTile
              title="Noise Suppression"
              after={
                <Switch
                  variant="Primary"
                  value={noiseSuppression}
                  onChange={setNoiseSuppression}
                />
              }
            />
          </SequenceCard>
          <SequenceCard className={SequenceCardStyle}>
            <SettingTile
              title="Auto Gain Control"
              after={
                <Switch
                  variant="Primary"
                  value={autoGainControl}
                  onChange={setAutoGainControl}
                />
              }
            />
          </SequenceCard>
        </Box>

        <Box direction="Column" gap="200" style={{ marginTop: config.space.S500 }}>
          <Text size="L400" priority="300">
            CAMERA
          </Text>
          <SequenceCard className={SequenceCardStyle}>
            <SettingTile
              title="Video Resolution"
              description={serverLimitsVideo ? `Server maximum: ${effective.serverMaxVideoResolution}` : undefined}
              after={
                <ChipRow<'360p' | '480p' | '720p' | '1080p' | '1440p' | '2160p'>
                  options={['360p', '480p', '720p', '1080p', '1440p', '2160p']}
                  value={videoResolution}
                  onChange={setVideoResolution}
                  labels={{ '2160p': '4K' }}
                  serverMax={serverLimitsVideo ? effective.serverMaxVideoResolution : undefined}
                />
              }
            />
          </SequenceCard>
          <SequenceCard className={SequenceCardStyle}>
            <SettingTile
              title="Frame Rate"
              description={serverLimitsVideo ? `Server maximum: ${effective.serverMaxVideoFps} fps` : undefined}
              after={
                <ChipRow<15 | 24 | 30 | 60 | 120>
                  options={[15, 24, 30, 60, 120]}
                  value={videoFps}
                  onChange={setVideoFps}
                  labels={{ 15: '15 fps', 24: '24 fps', 30: '30 fps', 60: '60 fps', 120: '120 fps' }}
                  serverMax={serverLimitsVideo ? `${effective.serverMaxVideoFps} fps` : undefined}
                />
              }
            />
          </SequenceCard>
        </Box>

        <Box direction="Column" gap="200" style={{ marginTop: config.space.S500 }}>
          <Text size="L400" priority="300">
            SCREEN SHARE
          </Text>
          <SequenceCard className={SequenceCardStyle}>
            <SettingTile
              title="Resolution"
              description={serverLimitsSS ? `Server maximum: ${effective.serverMaxSSResolution}` : undefined}
              after={
                <ChipRow<'720p' | '1080p' | '1440p' | '4k' | 'source'>
                  options={['720p', '1080p', '1440p', '4k', 'source']}
                  value={ssResolution}
                  onChange={setSSResolution}
                  labels={{ '4k': '4K', source: 'Source' }}
                  serverMax={serverLimitsSS ? effective.serverMaxSSResolution : undefined}
                />
              }
            />
          </SequenceCard>
          <SequenceCard className={SequenceCardStyle}>
            <SettingTile
              title="Frame Rate"
              description={
                serverLimitsSS
                  ? `Server maximum: ${effective.serverMaxSSFps} fps`
                  : '120 fps requires Chrome on desktop.'
              }
              after={
                <ChipRow<5 | 15 | 30 | 60 | 120>
                  options={[5, 15, 30, 60, 120]}
                  value={ssFps}
                  onChange={setSSFps}
                  labels={{ 5: '5', 15: '15', 30: '30', 60: '60', 120: '120 fps' }}
                  serverMax={serverLimitsSS ? `${effective.serverMaxSSFps} fps` : undefined}
                />
              }
            />
          </SequenceCard>
          <SequenceCard className={SequenceCardStyle}>
            <SettingTile
              title="Share Desktop Audio"
              description="Captures system audio along with your screen."
              after={
                <Switch
                  variant="Primary"
                  value={ssAudio}
                  onChange={setSSAudio}
                />
              }
            />
          </SequenceCard>
        </Box>
      </PageContent>
      </Scroll>
      </Box>
    </Page>
  );
}
