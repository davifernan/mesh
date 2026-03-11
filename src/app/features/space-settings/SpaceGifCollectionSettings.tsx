import React, { useState, useCallback } from 'react';
import { Box, Icon, IconButton, Icons, Scroll, Text } from 'folds';
import { Page, PageContent, PageHeader } from '../../components/page';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { usePowerLevels, readPowerLevel } from '../../hooks/usePowerLevels';
import { useSpaceGifCollections } from '../../plugins/gif/gifCollectionPlugin';
import {
  createGifCollection,
  deleteGifCollection,
  addGifToCollection,
  removeGifFromCollection,
} from '../../plugins/gif/gifCollectionPlugin';
import { GifItem, ResolvedGifCollection } from '../../plugins/gif/types';

const MANAGE_POWER_LEVEL = 50;
const ADMIN_POWER_LEVEL = 100;

type SpaceGifCollectionSettingsProps = {
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

// ─── Create Collection Form ───────────────────────────────────────────────────

type CreateCollectionFormProps = {
  spaceId: string;
  onDone: () => void;
  onCancel: () => void;
};

function CreateCollectionForm({ spaceId, onDone, onCancel }: CreateCollectionFormProps) {
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
        await createGifCollection(mx, spaceId, trimmedName, emoji.trim() || undefined);
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
        Neue GIF-Sammlung
      </Text>
      <Box gap="200" alignItems="Center">
        <input
          style={{ ...inputStyle, width: 56, textAlign: 'center' }}
          type="text"
          placeholder="🎬"
          maxLength={2}
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          aria-label="Emoji"
        />
        <input
          style={inputStyle}
          type="text"
          placeholder="Name der Sammlung"
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

// ─── Add GIF inline form ──────────────────────────────────────────────────────

type AddGifFormProps = {
  spaceId: string;
  collectionId: string;
  onDone: () => void;
  onCancel: () => void;
};

function AddGifForm({ spaceId, collectionId, onDone, onCancel }: AddGifFormProps) {
  const mx = useMatrixClient();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedUrl = url.trim();
      if (!trimmedUrl) return;
      setSaving(true);
      setError(null);
      try {
        const gifData: Omit<GifItem, 'id' | 'addedBy' | 'addedAt'> = {
          provider: 'community',
          title: title.trim() || trimmedUrl,
          url: trimmedUrl,
          previewUrl: trimmedUrl,
          width: 0,
          height: 0,
        };
        await addGifToCollection(mx, spaceId, collectionId, gifData);
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Hinzufügen');
      } finally {
        setSaving(false);
      }
    },
    [mx, spaceId, collectionId, url, title, onDone]
  );

  return (
    <Box
      as="form"
      direction="Column"
      gap="200"
      onSubmit={handleSubmit}
      style={{
        padding: '10px 12px',
        background: 'var(--background-secondary)',
        borderRadius: 4,
        border: '1px solid var(--background-modifier-accent)',
        marginTop: 8,
      }}
    >
      <Box gap="200" direction="Column">
        <input
          style={inputStyle}
          type="url"
          placeholder="GIF-URL (https://...)"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="GIF URL"
          autoFocus
        />
        <input
          style={inputStyle}
          type="text"
          placeholder="Titel (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Titel"
        />
      </Box>
      <Box gap="200" alignItems="Center">
        <button
          type="submit"
          style={primaryButtonStyle(saving || !url.trim())}
          disabled={saving || !url.trim()}
        >
          {saving ? 'Hinzufügen…' : 'Hinzufügen'}
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

// ─── GIF Thumbnail ────────────────────────────────────────────────────────────

type GifThumbProps = {
  gif: GifItem;
  collectionId: string;
  spaceId: string;
  canManage: boolean;
};

function GifThumb({ gif, collectionId, spaceId, canManage }: GifThumbProps) {
  const mx = useMatrixClient();
  const [removing, setRemoving] = useState(false);

  const handleRemove = useCallback(async () => {
    setRemoving(true);
    try {
      await removeGifFromCollection(mx, spaceId, collectionId, gif.id);
    } catch {
      setRemoving(false);
    }
  }, [mx, spaceId, collectionId, gif.id]);

  return (
    <Box
      direction="Column"
      style={{
        borderRadius: 4,
        overflow: 'hidden',
        border: '1px solid var(--background-modifier-accent)',
        position: 'relative',
        width: 120,
        flexShrink: 0,
      }}
    >
      <img
        src={gif.previewUrl || gif.url}
        alt={gif.title}
        style={{
          width: 120,
          height: 80,
          objectFit: 'cover',
          display: 'block',
          background: 'var(--background-tertiary)',
        }}
        loading="lazy"
      />
      <Box
        direction="Column"
        style={{
          padding: '4px 6px',
          background: 'var(--background-secondary)',
          minHeight: 0,
        }}
      >
        <Text
          size="T200"
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
            color: 'var(--text-secondary)',
          }}
          title={gif.title}
        >
          {gif.title}
        </Text>
        {canManage && (
          <button
            type="button"
            style={{
              marginTop: 4,
              padding: '2px 6px',
              borderRadius: 3,
              border: 'none',
              background: 'var(--status-danger, #f23f42)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              cursor: removing ? 'not-allowed' : 'pointer',
              opacity: removing ? 0.5 : 1,
              width: '100%',
            }}
            onClick={handleRemove}
            disabled={removing}
            aria-label={`GIF ${gif.title} entfernen`}
          >
            {removing ? '…' : 'Entfernen'}
          </button>
        )}
      </Box>
    </Box>
  );
}

// ─── Collection Card ──────────────────────────────────────────────────────────

type CollectionCardProps = {
  collection: ResolvedGifCollection;
  canManage: boolean;
  isAdmin: boolean;
};

function CollectionCard({ collection, canManage, isAdmin }: CollectionCardProps) {
  const mx = useMatrixClient();
  const [expanded, setExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const gifs = Object.values(collection.content.gifs);
  const gifCount = gifs.length;

  const handleDelete = useCallback(async () => {
    if (!window.confirm(`GIF-Sammlung "${collection.content.name}" wirklich löschen?`)) return;
    setDeleting(true);
    try {
      await deleteGifCollection(mx, collection.spaceId, collection.collectionId);
    } catch {
      setDeleting(false);
    }
  }, [mx, collection]);

  return (
    <Box
      direction="Column"
      style={{
        borderRadius: 6,
        border: '1px solid var(--background-modifier-accent)',
        overflow: 'hidden',
      }}
    >
      {/* Collection Header */}
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
          {collection.content.emoji ?? '🎬'}
        </Text>
        <Box grow="Yes" direction="Column">
          <Text size="T300" style={{ fontWeight: 600 }}>
            {collection.content.name}
          </Text>
          <Text size="T200" style={{ color: 'var(--text-muted)' }}>
            {gifCount} {gifCount === 1 ? 'GIF' : 'GIFs'}
          </Text>
        </Box>
        <Box gap="200" alignItems="Center" onClick={(e) => e.stopPropagation()}>
          {isAdmin && (
            <button
              type="button"
              style={dangerButtonStyle(deleting)}
              onClick={handleDelete}
              disabled={deleting}
              aria-label={`Sammlung ${collection.content.name} löschen`}
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

      {/* Expanded: GIF grid + add form */}
      {expanded && (
        <Box
          direction="Column"
          gap="100"
          style={{
            padding: '12px 14px',
            background: 'var(--background-primary)',
          }}
        >
          {gifs.length === 0 && !showAddForm && (
            <Text size="T300" style={{ color: 'var(--text-muted)', padding: '4px 0' }}>
              Noch keine GIFs in dieser Sammlung.
            </Text>
          )}

          {/* GIF grid */}
          {gifs.length > 0 && (
            <Box
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                paddingBottom: 8,
              }}
            >
              {gifs.map((gif) => (
                <GifThumb
                  key={gif.id}
                  gif={gif}
                  collectionId={collection.collectionId}
                  spaceId={collection.spaceId}
                  canManage={canManage}
                />
              ))}
            </Box>
          )}

          {/* Add GIF */}
          {canManage && (
            <>
              {showAddForm ? (
                <AddGifForm
                  spaceId={collection.spaceId}
                  collectionId={collection.collectionId}
                  onDone={() => setShowAddForm(false)}
                  onCancel={() => setShowAddForm(false)}
                />
              ) : (
                <Box style={{ marginTop: gifs.length > 0 ? 4 : 0 }}>
                  <button
                    type="button"
                    style={ghostButtonStyle}
                    onClick={() => setShowAddForm(true)}
                  >
                    + GIF hinzufügen
                  </button>
                </Box>
              )}
            </>
          )}
        </Box>
      )}
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SpaceGifCollectionSettings({
  spaceId,
  requestClose,
}: SpaceGifCollectionSettingsProps) {
  const mx = useMatrixClient();
  const room = mx.getRoom(spaceId);

  // usePowerLevels requires a non-null Room — hook is called unconditionally (React rules),
  // but we fall back via non-null assertion; the null guard render path fires before any usage.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const powerLevels = usePowerLevels(room!);
  const myUserId = mx.getSafeUserId();
  const myPowerLevel = readPowerLevel.user(powerLevels, myUserId);
  const canManage = myPowerLevel >= MANAGE_POWER_LEVEL;
  const isAdmin = myPowerLevel >= ADMIN_POWER_LEVEL;

  const collections = useSpaceGifCollections(spaceId);
  const [showCreateForm, setShowCreateForm] = useState(false);

  if (!room) {
    return (
      <Page>
        <PageHeader outlined={false}>
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" as="h1" truncate>
              GIF-Sammlungen
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
              GIF-Sammlungen
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
                  Du hast keine Berechtigung, GIF-Sammlungen zu verwalten (Power Level ≥ 50 erforderlich).
                </Text>
                {collections.length === 0 ? (
                  <Text size="T300" style={{ color: 'var(--text-muted)' }}>
                    Keine GIF-Sammlungen
                  </Text>
                ) : (
                  <Box direction="Column" gap="200" style={{ marginTop: 8 }}>
                    {collections.map((col) => (
                      <CollectionCard
                        key={col.collectionId}
                        collection={col}
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
                  Verwalte die Community-GIF-Sammlungen dieses Spaces. Mitglieder können GIFs aus
                  diesen Sammlungen direkt im Chat verwenden.
                </Text>

                {/* Create button / inline form */}
                {isAdmin && !showCreateForm && (
                  <Box>
                    <button
                      type="button"
                      style={primaryButtonStyle()}
                      onClick={() => setShowCreateForm(true)}
                    >
                      + Neue Sammlung erstellen
                    </button>
                  </Box>
                )}
                {isAdmin && showCreateForm && (
                  <CreateCollectionForm
                    spaceId={spaceId}
                    onDone={() => setShowCreateForm(false)}
                    onCancel={() => setShowCreateForm(false)}
                  />
                )}

                {/* Collection list */}
                {collections.length === 0 ? (
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
                        ? 'Noch keine GIF-Sammlungen. Erstelle die erste!'
                        : 'Keine GIF-Sammlungen'}
                    </Text>
                    {isAdmin && (
                      <Text size="T200" align="Center" style={{ color: 'var(--text-muted)' }}>
                        Klicke oben auf „Neue Sammlung erstellen", um loszulegen.
                      </Text>
                    )}
                  </Box>
                ) : (
                  <Box direction="Column" gap="200">
                    <div style={labelStyle}>Sammlungen ({collections.length})</div>
                    {collections.map((col) => (
                      <CollectionCard
                        key={col.collectionId}
                        collection={col}
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
