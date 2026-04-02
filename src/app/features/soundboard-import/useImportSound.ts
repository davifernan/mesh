import { useCallback, useMemo, useState } from 'react';
import { SoundItem } from '../../plugins/soundboard/types';
import { addSoundToBoard } from '../../plugins/soundboard/soundboardPlugin';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { ImportResult, SoundImportProvider } from './types';
import { uploadProvider } from './providers/uploadProvider';
import { urlProvider } from './providers/urlProvider';
import { freesoundProvider } from './providers/freesoundProvider';
import { myinstantsProvider } from './providers/myinstantsProvider';

// ── Registry — ordered as displayed in the tab bar ────────────────────────────
const ALL_PROVIDERS: SoundImportProvider[] = [
  uploadProvider,
  urlProvider,
  freesoundProvider,
  myinstantsProvider,
];

// ── Metadata shape ────────────────────────────────────────────────────────────
export type SoundMetadata = {
  title: string;
  emoji: string;
  volume: number; // 0–1, normalized
  tags: string; // raw comma-separated string from the input
};

const DEFAULT_METADATA: SoundMetadata = {
  title: '',
  emoji: '🔊',
  volume: 0.8,
  tags: '',
};

// ── Hook return type ──────────────────────────────────────────────────────────
export type UseImportSoundReturn = {
  providers: SoundImportProvider[];
  selectedProvider: SoundImportProvider | null;
  selectProvider: (id: string) => void;
  importResult: ImportResult | null;
  isLoading: boolean;
  error: string | null;
  importFromFile: (file: File) => Promise<void>;
  importFromUrl: (url: string) => Promise<void>;
  metadata: SoundMetadata;
  setMetadata: (updates: Partial<SoundMetadata>) => void;
  commit: () => Promise<SoundItem | null>;
  reset: () => void;
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useImportSound(spaceId: string, boardId: string): UseImportSoundReturn {
  const mx = useMatrixClient();

  const providers = useMemo(() => ALL_PROVIDERS, []);

  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    ALL_PROVIDERS.find((p) => p.available)?.id ?? ALL_PROVIDERS[0].id
  );
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadataState] = useState<SoundMetadata>(DEFAULT_METADATA);

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === selectedProviderId) ?? null,
    [providers, selectedProviderId]
  );

  const selectProvider = useCallback((id: string) => {
    setSelectedProviderId(id);
    setImportResult(null);
    setError(null);
    setMetadataState(DEFAULT_METADATA);
  }, []);

  const setMetadata = useCallback((updates: Partial<SoundMetadata>) => {
    setMetadataState((prev) => ({ ...prev, ...updates }));
  }, []);

  const reset = useCallback(() => {
    setImportResult(null);
    setError(null);
    setIsLoading(false);
    setMetadataState(DEFAULT_METADATA);
  }, []);

  // ── importFromFile ──────────────────────────────────────────────────────────
  const importFromFile = useCallback(
    async (file: File): Promise<void> => {
      if (!selectedProvider?.importFromFile) return;
      setIsLoading(true);
      setError(null);
      setImportResult(null);

      try {
        const result = await selectedProvider.importFromFile(file);
        setImportResult(result);
        setMetadataState((prev) => ({
          ...prev,
          title: result.title || prev.title,
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error importing sound');
      } finally {
        setIsLoading(false);
      }
    },
    [selectedProvider]
  );

  // ── importFromUrl ───────────────────────────────────────────────────────────
  const importFromUrl = useCallback(
    async (url: string): Promise<void> => {
      if (!selectedProvider?.importFromUrl) return;
      setIsLoading(true);
      setError(null);
      setImportResult(null);

      try {
        const result = await selectedProvider.importFromUrl(url);
        setImportResult(result);
        setMetadataState((prev) => ({
          ...prev,
          title: result.title || prev.title,
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching URL');
      } finally {
        setIsLoading(false);
      }
    },
    [selectedProvider]
  );

  // ── commit ──────────────────────────────────────────────────────────────────
  const commit = useCallback(async (): Promise<SoundItem | null> => {
    if (!importResult) throw new Error('No sound imported');

    const titleTrimmed = metadata.title.trim();
    if (!titleTrimmed) throw new Error('Please enter a title');

    const tags = metadata.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    let sourceType: SoundItem['sourceType'];
    let url: string;

    if (importResult.blob) {
      // Upload the blob to Matrix media repo
      const uploadResponse = await mx.uploadContent(importResult.blob, {
        type: importResult.mimeType ?? importResult.blob.type,
        name: titleTrimmed,
        includeFilename: false,
      });

      // matrix-js-sdk v38 returns { content_uri: string }
      const mxcUri = (uploadResponse as { content_uri: string }).content_uri;
      if (!mxcUri) throw new Error('Upload failed – no MXC URI received');
      sourceType = 'mxc';
      url = mxcUri;
    } else if (importResult.url) {
      sourceType = 'url';
      url = importResult.url;
    } else {
      throw new Error('No blob or URL in import result');
    }

    const soundDraft: Omit<SoundItem, 'id' | 'addedBy' | 'addedAt'> = {
      title: titleTrimmed,
      emoji: metadata.emoji || undefined,
      sourceType,
      url,
      durationMs: importResult.durationMs,
      sizeBytes: importResult.blob?.size,
      volume: Math.max(0, Math.min(1, metadata.volume)),
      tags: tags.length > 0 ? tags : undefined,
    };

    await addSoundToBoard(mx, spaceId, boardId, soundDraft);

    // Build a local SoundItem for immediate UI feedback
    // (Stream B's addSoundToBoard writes the event; the reactive hook will
    //  pick up the real item from state. We return a synthetic copy here so
    //  the caller's onImported callback can act immediately.)
    const synthetic: SoundItem = {
      ...soundDraft,
      id: crypto.randomUUID(),
      addedBy: mx.getSafeUserId(),
      addedAt: Date.now(),
    };

    return synthetic;
  }, [importResult, metadata, mx, spaceId, boardId]);

  return {
    providers,
    selectedProvider,
    selectProvider,
    importResult,
    isLoading,
    error,
    importFromFile,
    importFromUrl,
    metadata,
    setMetadata,
    commit,
    reset,
  };
}
