import React, { useState, useCallback } from 'react';
import { Box, Icon, IconButton, Icons, Scroll, Text } from 'folds';
import { Page, PageContent, PageHeader } from '../../components/page';
import { useRoom } from '../../hooks/useRoom';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { usePowerLevels, readPowerLevel } from '../../hooks/usePowerLevels';

const UPLOAD_SETTINGS_EVENT_TYPE = 'io.bettercord.space.upload_settings';
const REQUIRED_POWER_LEVEL = 100;

const MB = 1024 * 1024;

type Preset = 0 | 25 | 50 | 100 | 500 | -1; // -1 = custom

const PRESETS: { value: Preset; label: string }[] = [
  { value: 0, label: 'Unbegrenzt' },
  { value: 25, label: '25 MB' },
  { value: 50, label: '50 MB' },
  { value: 100, label: '100 MB' },
  { value: 500, label: '500 MB' },
  { value: -1, label: 'Custom' },
];

function bytesToMb(bytes: number): number {
  return Math.round(bytes / MB);
}

function mbToBytes(mb: number): number {
  return mb * MB;
}

function detectPreset(bytes: number): Preset {
  if (bytes === 0) return 0;
  const mb = bytesToMb(bytes);
  const match = PRESETS.find((p) => p.value === mb);
  return match ? (match.value as Preset) : -1;
}

function OptionChip<T extends string | number>({
  value,
  selected,
  label,
  onClick,
}: {
  value: T;
  selected: boolean;
  label?: string;
  onClick: (v: T) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onClick(value)}
      style={{
        padding: '4px 12px',
        borderRadius: 4,
        border: '1px solid var(--background-modifier-accent)',
        background: selected ? 'var(--brand-experiment, #5865f2)' : 'var(--background-secondary)',
        color: selected ? '#fff' : 'var(--text-normal)',
        fontSize: 13,
        fontWeight: selected ? 600 : 400,
        cursor: 'pointer',
      }}
    >
      {label ?? String(value)}
    </button>
  );
}

type SpaceUploadSettingsProps = {
  requestClose: () => void;
};

export function SpaceUploadSettings({ requestClose }: SpaceUploadSettingsProps) {
  const mx = useMatrixClient();
  const room = useRoom();
  const powerLevels = usePowerLevels(room);
  const myUserId = mx.getSafeUserId();
  const myPowerLevel = readPowerLevel.user(powerLevels, myUserId);
  const canEdit = myPowerLevel >= REQUIRED_POWER_LEVEL;

  const stateEvent = room.currentState.getStateEvents(UPLOAD_SETTINGS_EVENT_TYPE, '');
  const currentBytes: number =
    (stateEvent?.getContent<{ maxFileSizeBytes?: number }>()?.maxFileSizeBytes) ?? 0;

  const initialPreset = detectPreset(currentBytes);
  const initialCustomMb = initialPreset === -1 ? bytesToMb(currentBytes) : 25;

  const [selectedPreset, setSelectedPreset] = useState<Preset>(initialPreset);
  const [customMb, setCustomMb] = useState<number>(initialCustomMb);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveBytes =
    selectedPreset === -1 ? mbToBytes(Math.max(1, customMb)) : mbToBytes(selectedPreset);

  const handlePresetClick = (preset: Preset) => {
    setSelectedPreset(preset);
    setSaved(false);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await mx.sendStateEvent(
        room.roomId,
        UPLOAD_SETTINGS_EVENT_TYPE as any,
        { maxFileSizeBytes: effectiveBytes },
        ''
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  }, [mx, room.roomId, effectiveBytes]);

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

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return 'Unbegrenzt';
    return `${bytesToMb(bytes)} MB`;
  };

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" as="h1" truncate>
              Datei-Upload
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
                <Text size="T300">
                  Aktuelles Limit:{' '}
                  <strong>{stateEvent ? formatBytes(currentBytes) : 'Unbegrenzt (Standard)'}</strong>
                </Text>
              </Box>
            ) : (
              <Box direction="Column" gap="500">
                <Box direction="Column" gap="200">
                  <Text size="T400" style={{ color: 'var(--text-muted)' }}>
                    Maximale Dateigröße für Uploads in diesem Space. Dateien die das Limit
                    überschreiten werden beim Hochladen abgelehnt.
                  </Text>
                </Box>

                {/* Preset Chips */}
                <div style={sectionStyle}>
                  <div style={labelStyle}>Max. Dateigröße</div>
                  <div style={chipRowStyle}>
                    {PRESETS.map((preset) => (
                      <OptionChip
                        key={preset.value}
                        value={preset.value as Preset}
                        selected={selectedPreset === preset.value}
                        label={preset.label}
                        onClick={handlePresetClick}
                      />
                    ))}
                  </div>
                </div>

                {/* Custom Input */}
                {selectedPreset === -1 && (
                  <div style={sectionStyle}>
                    <div style={labelStyle}>Eigene Größe (MB)</div>
                    <Box gap="200" alignItems="Center">
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        value={customMb}
                        onChange={(e) => {
                          const v = Math.max(1, Number(e.target.value));
                          setCustomMb(v);
                          setSaved(false);
                        }}
                        style={{
                          width: 100,
                          padding: '4px 8px',
                          borderRadius: 4,
                          border: '1px solid var(--background-modifier-accent)',
                          background: 'var(--background-secondary)',
                          color: 'var(--text-normal)',
                          fontSize: 14,
                        }}
                      />
                      <Text size="T300" style={{ color: 'var(--text-muted)' }}>
                        MB
                      </Text>
                    </Box>
                  </div>
                )}

                {/* Summary */}
                <Text size="T300" style={{ color: 'var(--text-muted)' }}>
                  Aktuell gesetzt:{' '}
                  <strong style={{ color: 'var(--text-normal)' }}>
                    {effectiveBytes === 0 ? 'Unbegrenzt' : `${bytesToMb(effectiveBytes)} MB`}
                  </strong>
                </Text>

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
