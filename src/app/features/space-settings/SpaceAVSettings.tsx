import React, { useState, useCallback } from 'react';
import { Box, Icon, IconButton, Icons, Scroll, Text } from 'folds';
import { Page, PageContent, PageHeader } from '../../components/page';
import { useRoom } from '../../hooks/useRoom';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { usePowerLevels, readPowerLevel } from '../../hooks/usePowerLevels';
import { SpaceAVSettings as SpaceAVSettingsContent } from '../../state/avQuality';

const AV_SETTINGS_EVENT_TYPE = 'io.bettercord.space.av_settings';

// Required power level to edit space A/V settings (admin = 100)
const REQUIRED_POWER_LEVEL = 100;

type VideoResolution = SpaceAVSettingsContent['maxVideoResolution'];
type VideoFps = SpaceAVSettingsContent['maxVideoFps'];
type SSResolution = SpaceAVSettingsContent['maxSSResolution'];
type SSFps = SpaceAVSettingsContent['maxSSFps'];
type AudioBitrate = SpaceAVSettingsContent['maxAudioBitrate'];

const VIDEO_RESOLUTIONS: VideoResolution[] = ['360p', '480p', '720p', '1080p', '1440p', '2160p'];
const VIDEO_FPS: VideoFps[] = [15, 24, 30, 60, 120];
const SS_RESOLUTIONS: SSResolution[] = ['720p', '1080p', '1440p', '4k', 'source'];
const SS_FPS: SSFps[] = [5, 15, 30, 60, 120];
const AUDIO_BITRATES: AudioBitrate[] = [64, 128, 256, 510];

function OptionChip<T extends string | number>({
  value,
  selected,
  disabled,
  label,
  onClick,
}: {
  value: T;
  selected: boolean;
  disabled?: boolean;
  label?: string;
  onClick: (v: T) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={() => !disabled && onClick(value)}
      style={{
        padding: '4px 12px',
        borderRadius: 4,
        border: '1px solid var(--background-modifier-accent)',
        background: selected ? 'var(--brand-experiment, #5865f2)' : 'var(--background-secondary)',
        color: selected ? '#fff' : 'var(--text-normal)',
        fontSize: 13,
        fontWeight: selected ? 600 : 400,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label ?? String(value)}
    </button>
  );
}

type SpaceAVSettingsProps = {
  requestClose: () => void;
};

export function SpaceAVSettings({ requestClose }: SpaceAVSettingsProps) {
  const mx = useMatrixClient();
  const room = useRoom();
  const powerLevels = usePowerLevels(room);
  const myUserId = mx.getSafeUserId();
  const myPowerLevel = readPowerLevel.user(powerLevels, myUserId);
  const canEdit = myPowerLevel >= REQUIRED_POWER_LEVEL;

  // Load current settings from state event
  const stateEvent = room.currentState.getStateEvents(AV_SETTINGS_EVENT_TYPE, '');
  const current = stateEvent?.getContent<Partial<SpaceAVSettingsContent>>() ?? {};

  const [maxAudioBitrate, setMaxAudioBitrate] = useState<AudioBitrate>(
    current.maxAudioBitrate ?? 510
  );
  const [maxVideoResolution, setMaxVideoResolution] = useState<VideoResolution>(
    current.maxVideoResolution ?? '2160p'
  );
  const [maxVideoFps, setMaxVideoFps] = useState<VideoFps>(current.maxVideoFps ?? 120);
  const [maxSSResolution, setMaxSSResolution] = useState<SSResolution>(
    current.maxSSResolution ?? 'source'
  );
  const [maxSSFps, setMaxSSFps] = useState<SSFps>(current.maxSSFps ?? 120);
  const [maxParticipants, setMaxParticipants] = useState<number>(current.maxParticipants ?? 100);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await mx.sendStateEvent(
        room.roomId,
        AV_SETTINGS_EVENT_TYPE as any,
        {
          maxAudioBitrate,
          maxVideoResolution,
          maxVideoFps,
          maxSSResolution,
          maxSSFps,
          maxParticipants,
        },
        ''
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }, [
    mx,
    room.roomId,
    maxAudioBitrate,
    maxVideoResolution,
    maxVideoFps,
    maxSSResolution,
    maxSSFps,
    maxParticipants,
  ]);

  const sectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--text-muted)',
  };
  const chipRowStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  };

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" as="h1" truncate>
              A/V Qualitätslimits
            </Text>
          </Box>
          <Box shrink="No">
            <IconButton onClick={requestClose} variant="Surface" aria-label="Schließen">
              <Icon src={Icons.Cross} />
            </IconButton>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            {!canEdit ? (
              <Box direction="Column" gap="200">
                <Text size="T300" style={{ color: 'var(--text-muted)' }}>
                  Nur Space-Administratoren (Power Level ≥ 100) können diese Einstellungen ändern.
                </Text>
                {stateEvent ? (
                  <Box direction="Column" gap="400">
                    <div style={sectionStyle}>
                      <div style={labelStyle}>Aktuelle Einstellungen</div>
                      <Text size="T300">
                        Audio: max {maxAudioBitrate} kbps · Video: max {maxVideoResolution} @ {maxVideoFps} fps
                      </Text>
                      <Text size="T300">
                        Screenshare: max {maxSSResolution === 'source' ? 'Quelle' : maxSSResolution} @ {maxSSFps} fps
                      </Text>
                      <Text size="T300">Max. Teilnehmer: {maxParticipants}</Text>
                    </div>
                  </Box>
                ) : (
                  <Text size="T300" style={{ color: 'var(--text-muted)' }}>
                    Noch keine Limits gesetzt — Standard gilt (unbegrenzt).
                  </Text>
                )}
              </Box>
            ) : (
              <Box direction="Column" gap="500">
                <Box direction="Column" gap="200">
                  <Text size="T400" style={{ color: 'var(--text-muted)' }}>
                    Diese Limits gelten für alle Mitglieder in diesem Space. Nutzer können innerhalb
                    der gesetzten Grenzen ihre eigene Qualität frei wählen.
                  </Text>
                </Box>

                {/* Audio Bitrate */}
                <div style={sectionStyle}>
                  <div style={labelStyle}>Max. Audio-Bitrate</div>
                  <div style={chipRowStyle}>
                    {AUDIO_BITRATES.map((b) => (
                      <OptionChip
                        key={b}
                        value={b}
                        selected={maxAudioBitrate === b}
                        label={`${b} kbps`}
                        onClick={setMaxAudioBitrate}
                      />
                    ))}
                  </div>
                </div>

                {/* Video Resolution */}
                <div style={sectionStyle}>
                  <div style={labelStyle}>Max. Video-Auflösung</div>
                  <div style={chipRowStyle}>
                    {VIDEO_RESOLUTIONS.map((r) => (
                      <OptionChip
                        key={r}
                        value={r}
                        selected={maxVideoResolution === r}
                        onClick={setMaxVideoResolution}
                      />
                    ))}
                  </div>
                </div>

                {/* Video FPS */}
                <div style={sectionStyle}>
                  <div style={labelStyle}>Max. Video-Framerate</div>
                  <div style={chipRowStyle}>
                    {VIDEO_FPS.map((f) => (
                      <OptionChip
                        key={f}
                        value={f}
                        selected={maxVideoFps === f}
                        label={`${f} fps`}
                        onClick={setMaxVideoFps}
                      />
                    ))}
                  </div>
                </div>

                {/* Screenshare Resolution */}
                <div style={sectionStyle}>
                  <div style={labelStyle}>Max. Screenshare-Auflösung</div>
                  <div style={chipRowStyle}>
                    {SS_RESOLUTIONS.map((r) => (
                      <OptionChip
                        key={r}
                        value={r}
                        selected={maxSSResolution === r}
                        label={r === 'source' ? 'Quelle' : r}
                        onClick={setMaxSSResolution}
                      />
                    ))}
                  </div>
                </div>

                {/* Screenshare FPS */}
                <div style={sectionStyle}>
                  <div style={labelStyle}>Max. Screenshare-Framerate</div>
                  <div style={chipRowStyle}>
                    {SS_FPS.map((f) => (
                      <OptionChip
                        key={f}
                        value={f}
                        selected={maxSSFps === f}
                        label={`${f} fps`}
                        onClick={setMaxSSFps}
                      />
                    ))}
                  </div>
                </div>

                {/* Max Participants */}
                <div style={sectionStyle}>
                  <div style={labelStyle}>Max. Teilnehmer</div>
                  <input
                    type="number"
                    min={2}
                    max={500}
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(Math.max(2, Number(e.target.value)))}
                    disabled={!canEdit}
                    style={{
                      width: 80,
                      padding: '4px 8px',
                      borderRadius: 4,
                      border: '1px solid var(--background-modifier-accent)',
                      background: 'var(--background-secondary)',
                      color: 'var(--text-normal)',
                      fontSize: 14,
                    }}
                  />
                </div>

                {error && (
                  <Text size="T300" style={{ color: 'var(--status-danger, #f23f42)' }}>
                    {error}
                  </Text>
                )}

                <Box gap="200">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      padding: '8px 20px',
                      borderRadius: 4,
                      border: 'none',
                      background: 'var(--brand-experiment, #5865f2)',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? 'Speichern...' : saved ? 'Gespeichert ✓' : 'Speichern'}
                  </button>
                </Box>
              </Box>
            )}
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
