import React, { useState, useCallback } from 'react';
import { Box, Icon, IconButton, Icons, Scroll, Text } from 'folds';
import { Page, PageContent, PageHeader } from '../../components/page';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { usePowerLevels, readPowerLevel } from '../../hooks/usePowerLevels';
import { useSpaceSoundboards } from '../../plugins/soundboard/soundboardPlugin';
import {
  createSoundboard,
  deleteSoundboard,
  removeSoundFromBoard,
} from '../../plugins/soundboard/soundboardPlugin';
import { ResolvedSoundboard, SoundItem } from '../../plugins/soundboard/types';

import { ImportSoundModal } from '../soundboard-import/ImportSoundModal';

const MANAGE_POWER_LEVEL = 50;
const ADMIN_POWER_LEVEL = 100;

type SpaceSoundboardSettingsProps = {
  spaceId: string;
  requestClose: () => void;
};

// ─── Inline styles matching SpaceAVSettings / SpaceUploadSettings patterns ────

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--text-muted)',
};

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 4,
  border: '1px solid var(--background-modifier-accent)',
  background: 'var(--background-secondary)',
  color: 'var(--text-normal)',
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
};

const primaryButtonStyle = (disabled?: boolean): React.CSSProperties => ({
  padding: '6px 16px',
  borderRadius: 4,
  border: 'none',
  background: 'var(--brand-experiment, #5865f2)',
  color: '#fff',
  fontWeight: 600,
  fontSize: 13,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
  flexShrink: 0,
});

const dangerButtonStyle = (disabled?: boolean): React.CSSProperties => ({
  padding: '4px 10px',
  borderRadius: 4,
  border: '1px solid var(--status-danger, #f23f42)',
  background: 'transparent',
  color: 'var(--status-danger, #f23f42)',
  fontWeight: 600,
  fontSize: 12,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  flexShrink: 0,
});

const ghostButtonStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 4,
  border: '1px solid var(--background-modifier-accent)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontWeight: 500,
  fontSize: 12,
  cursor: 'pointer',
  flexShrink: 0,
};

// ─── Create Board Form ────────────────────────────────────────────────────────

type CreateBoardFormProps = {
  spaceId: string;
  onDone: () => void;
  onCancel: () => void;
};

function CreateBoardForm({ spaceId, onDone, onCancel }: CreateBoardFormProps) {
  const mx = useMatrixClient();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedName = name.trim();
      if (!trimmedName) return;
      setSaving(true);
      setError(null);
      try {
        await createSoundboard(mx, spaceId, trimmedName, emoji.trim() || undefined);
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Erstellen');
      } finally {
        setSaving(false);
      }
    },
    [mx, spaceId, name, emoji, onDone]
  );

  return (
    <Box
      as="form"
      direction="Column"
      gap="200"
      onSubmit={handleSubmit}
      style={{
        padding: '12px 16px',
        background: 'var(--background-secondary)',
        borderRadius: 6,
        border: '1px solid var(--background-modifier-accent)',
      }}
    >
      <Text size="L400" style={labelStyle}>
        Neues Soundboard
      </Text>
      <Box gap="200" alignItems="Center">
        <input
          style={{ ...inputStyle, width: 56, textAlign: 'center' }}
          type="text"
          placeholder="🎵"
          maxLength={2}
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          aria-label="Emoji"
        />
        <input
          style={inputStyle}
          type="text"
          placeholder="Name des Soundboards"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Name"
          autoFocus
        />
        <button type="submit" style={primaryButtonStyle(saving || !name.trim())} disabled={saving || !name.trim()}>
          {saving ? 'Erstellen…' : 'Erstellen'}
        </button>
        <button type="button" style={ghostButtonStyle} onClick={onCancel}>
          Abbrechen
        </button>
      </Box>
      {error && (
        <Text size="T300" style={{ color: 'var(--status-danger, #f23f42)' }}>
          {error}
        </Text>
      )}
    </Box>
  );
}

// ─── Sound Row ────────────────────────────────────────────────────────────────

function formatDuration(ms?: number): string {
  if (!ms) return '';
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type SoundRowProps = {
  sound: SoundItem;
  boardId: string;
  spaceId: string;
  canManage: boolean;
};

function SoundRow({ sound, boardId, spaceId, canManage }: SoundRowProps) {
  const mx = useMatrixClient();
  const [removing, setRemoving] = useState(false);

  const handleRemove = useCallback(async () => {
    setRemoving(true);
    try {
      await removeSoundFromBoard(mx, spaceId, boardId, sound.id);
    } catch {
      setRemoving(false);
    }
  }, [mx, spaceId, boardId, sound.id]);

  return (
    <Box
      alignItems="Center"
      gap="200"
      style={{
        padding: '6px 12px',
        borderRadius: 4,
        background: 'var(--background-secondary)',
      }}
    >
      <Text size="T300" style={{ width: 24, textAlign: 'center', flexShrink: 0 }}>
        {sound.emoji ?? '🔊'}
      </Text>
      <Box grow="Yes" direction="Column">
        <Text size="T300" style={{ fontWeight: 500 }}>
          {sound.title}
        </Text>
        {sound.durationMs !== undefined && (
          <Text size="T200" style={{ color: 'var(--text-muted)' }}>
            {formatDuration(sound.durationMs)}
          </Text>
        )}
      </Box>
      {canManage && (
        <button
          type="button"
          style={dangerButtonStyle(removing)}
          onClick={handleRemove}
          disabled={removing}
          aria-label={`Sound ${sound.title} entfernen`}
        >
          {removing ? '…' : 'Entfernen'}
        </button>
      )}
    </Box>
  );
}

// ─── Soundboard Card ──────────────────────────────────────────────────────────

type SoundboardCardProps = {
  board: ResolvedSoundboard;
  canManage: boolean;
  isAdmin: boolean;
};

function SoundboardCard({ board, canManage, isAdmin }: SoundboardCardProps) {
  const mx = useMatrixClient();
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const sounds = Object.values(board.content.sounds);
  const soundCount = sounds.length;

  const handleDelete = useCallback(async () => {
    if (!window.confirm(`Soundboard "${board.content.name}" wirklich löschen?`)) return;
    setDeleting(true);
    try {
      await deleteSoundboard(mx, board.spaceId, board.boardId);
    } catch {
      setDeleting(false);
    }
  }, [mx, board]);

  return (
    <Box
      direction="Column"
      style={{
        borderRadius: 6,
        border: '1px solid var(--background-modifier-accent)',
        overflow: 'hidden',
      }}
    >
      {/* Board Header */}
      <Box
        alignItems="Center"
        gap="300"
        style={{
          padding: '10px 14px',
          background: 'var(--background-secondary)',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <Text size="T400" style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>
          {board.content.emoji ?? '🎵'}
        </Text>
        <Box grow="Yes" direction="Column">
          <Text size="T300" style={{ fontWeight: 600 }}>
            {board.content.name}
          </Text>
          <Text size="T200" style={{ color: 'var(--text-muted)' }}>
            {soundCount} {soundCount === 1 ? 'Sound' : 'Sounds'}
          </Text>
        </Box>
        <Box gap="200" alignItems="Center" onClick={(e) => e.stopPropagation()}>
          {isAdmin && (
            <button
              type="button"
              style={dangerButtonStyle(deleting)}
              onClick={handleDelete}
              disabled={deleting}
              aria-label={`Soundboard ${board.content.name} löschen`}
            >
              {deleting ? '…' : 'Löschen'}
            </button>
          )}
          <Icon
            src={expanded ? Icons.ChevronTop : Icons.ChevronBottom}
            size="100"
          />
        </Box>
      </Box>

      {/* Expanded: sound list */}
      {expanded && (
        <Box
          direction="Column"
          gap="100"
          style={{
            padding: '8px 14px 12px',
            background: 'var(--background-primary)',
          }}
        >
          {sounds.length === 0 && (
            <Text size="T300" style={{ color: 'var(--text-muted)', padding: '4px 0' }}>
              Noch keine Sounds in diesem Board.
            </Text>
          )}
          {sounds.map((sound) => (
            <SoundRow
              key={sound.id}
              sound={sound}
              boardId={board.boardId}
              spaceId={board.spaceId}
              canManage={canManage}
            />
          ))}
          {canManage && (
            <Box style={{ marginTop: 8 }}>
              <button
                type="button"
                style={ghostButtonStyle}
                onClick={() => setShowImport(true)}
              >
                + Sound hinzufügen
              </button>
              {showImport && (
                <ImportSoundModal
                  spaceId={board.spaceId}
                  boardId={board.boardId}
                  onClose={() => setShowImport(false)}
                  onImported={() => setShowImport(false)}
                />
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SpaceSoundboardSettings({ spaceId, requestClose }: SpaceSoundboardSettingsProps) {
  const mx = useMatrixClient();
  const room = mx.getRoom(spaceId);

  // usePowerLevels requires a non-null Room — hook is called unconditionally (React rules),
  // but we fall back to an empty object which yields power level 0 when room is null.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const powerLevels = usePowerLevels(room!);
  const myUserId = mx.getSafeUserId();
  const myPowerLevel = readPowerLevel.user(powerLevels, myUserId);
  const canManage = myPowerLevel >= MANAGE_POWER_LEVEL;
  const isAdmin = myPowerLevel >= ADMIN_POWER_LEVEL;

  const boards = useSpaceSoundboards(spaceId);

  const [showCreateForm, setShowCreateForm] = useState(false);

  if (!room) {
    return (
      <Page>
        <PageHeader outlined={false}>
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" as="h1" truncate>
              Soundboard
            </Text>
          </Box>
        </PageHeader>
        <Box grow="Yes">
          <PageContent>
            <Text size="T300" style={{ color: 'var(--text-muted)' }}>
              Space nicht gefunden.
            </Text>
          </PageContent>
        </Box>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" as="h1" truncate>
              Soundboard
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
            {!canManage ? (
              /* ── No permission ── */
              <Box direction="Column" gap="200">
                <Text size="T300" style={{ color: 'var(--text-muted)' }}>
                  Du hast keine Berechtigung, Soundboards zu verwalten (Power Level ≥ 50 erforderlich).
                </Text>
                {boards.length === 0 ? (
                  <Text size="T300" style={{ color: 'var(--text-muted)' }}>
                    Keine Soundboards
                  </Text>
                ) : (
                  <Box direction="Column" gap="200" style={{ marginTop: 8 }}>
                    {boards.map((board) => (
                      <SoundboardCard
                        key={board.boardId}
                        board={board}
                        canManage={false}
                        isAdmin={false}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            ) : (
              /* ── Can manage ── */
              <Box direction="Column" gap="400">
                <Text size="T400" style={{ color: 'var(--text-muted)' }}>
                  Verwalte die Community-Soundboards dieses Spaces. Mitglieder können Sounds im
                  Soundboard-Panel abspielen.
                </Text>

                {/* Create button / inline form */}
                {isAdmin && !showCreateForm && (
                  <Box>
                    <button
                      type="button"
                      style={primaryButtonStyle()}
                      onClick={() => setShowCreateForm(true)}
                    >
                      + Neue Soundboard erstellen
                    </button>
                  </Box>
                )}
                {isAdmin && showCreateForm && (
                  <CreateBoardForm
                    spaceId={spaceId}
                    onDone={() => setShowCreateForm(false)}
                    onCancel={() => setShowCreateForm(false)}
                  />
                )}

                {/* Board list */}
                {boards.length === 0 ? (
                  <Box
                    direction="Column"
                    alignItems="Center"
                    gap="200"
                    style={{
                      padding: '40px 24px',
                      background: 'var(--background-secondary)',
                      borderRadius: 6,
                      border: '1px dashed var(--background-modifier-accent)',
                    }}
                  >
                    <Text size="H5" as="h3" align="Center">
                      {isAdmin
                        ? 'Noch keine Soundboards. Erstelle das erste!'
                        : 'Keine Soundboards'}
                    </Text>
                    {isAdmin && (
                      <Text size="T200" align="Center" style={{ color: 'var(--text-muted)' }}>
                        Klicke oben auf „Neue Soundboard erstellen", um loszulegen.
                      </Text>
                    )}
                  </Box>
                ) : (
                  <Box direction="Column" gap="200">
                    <div style={labelStyle}>Soundboards ({boards.length})</div>
                    {boards.map((board) => (
                      <SoundboardCard
                        key={board.boardId}
                        board={board}
                        canManage={canManage}
                        isAdmin={isAdmin}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
