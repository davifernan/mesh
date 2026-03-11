import { ImportResult, SoundImportProvider } from '../types';

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

const SUPPORTED_MIME_TYPES = new Set([
  'audio/mpeg', // .mp3
  'audio/wav', // .wav
  'audio/ogg', // .ogg
  'audio/mp4', // .m4a / .aac (browser-reported)
  'audio/aac', // .aac
  'audio/flac', // .flac
  'audio/opus', // .opus
  'audio/webm', // .webm audio
  // Some browsers report these variants
  'audio/x-wav',
  'audio/vnd.wave',
  'audio/x-m4a',
]);

// File extension to MIME mapping for when the browser doesn't set type
const EXTENSION_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  opus: 'audio/opus',
  webm: 'audio/webm',
};

const SUPPORTED_EXTENSIONS = new Set(Object.keys(EXTENSION_MIME));

/**
 * Reads the duration of an audio Blob via HTMLAudioElement.
 * Returns undefined if the browser cannot decode the format.
 */
function readAudioDurationMs(blob: Blob): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();

    const cleanup = () => {
      URL.revokeObjectURL(url);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('error', onError);
    };

    const onMeta = () => {
      cleanup();
      const { duration } = audio;
      resolve(Number.isFinite(duration) ? Math.round(duration * 1000) : undefined);
    };

    const onError = () => {
      cleanup();
      resolve(undefined);
    };

    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('error', onError);
    audio.src = url;
    // Trigger load without playing
    audio.load();
  });
}

/**
 * Derives a human-readable title from a filename by stripping the extension
 * and replacing underscores/hyphens with spaces.
 */
function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, ''); // strip extension
  return base.replace(/[_-]+/g, ' ').trim() || filename;
}

/**
 * Resolves the MIME type for a file.
 * Falls back to extension-based lookup when browser type is absent or generic.
 */
function resolveMimeType(file: File): string | undefined {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext ? EXTENSION_MIME[ext] : undefined;
}

export const uploadProvider: SoundImportProvider = {
  id: 'upload',
  label: 'Upload',
  description: 'Upload an audio file from your device',
  available: true,

  supportsFileUpload: true,
  supportsSearch: false,
  supportsUrlImport: false,

  async importFromFile(file: File): Promise<ImportResult> {
    // ── Validate extension ──────────────────────────────────────────────────
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !SUPPORTED_EXTENSIONS.has(ext)) {
      throw new Error(
        `Nicht unterstütztes Dateiformat ".${ext ?? ''}". ` +
          `Erlaubt: ${[...SUPPORTED_EXTENSIONS].join(', ')}`
      );
    }

    // ── Validate MIME type ──────────────────────────────────────────────────
    const mimeType = resolveMimeType(file);
    if (mimeType && !SUPPORTED_MIME_TYPES.has(mimeType)) {
      throw new Error(
        `Ungültiger Dateityp: ${mimeType}. Bitte eine Audio-Datei auswählen.`
      );
    }

    // ── Validate size ────────────────────────────────────────────────────────
    if (file.size > MAX_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      throw new Error(
        `Datei zu groß (${sizeMb} MB). Maximum ist 2 MB.`
      );
    }

    // ── Read blob ────────────────────────────────────────────────────────────
    const blob = new Blob([await file.arrayBuffer()], {
      type: mimeType ?? file.type,
    });

    // ── Read duration ────────────────────────────────────────────────────────
    const durationMs = await readAudioDurationMs(blob);

    return {
      blob,
      title: titleFromFilename(file.name),
      durationMs,
      mimeType: (mimeType ?? file.type) || undefined,
    };
  },
};
