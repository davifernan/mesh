import { ImportResult, SoundImportProvider } from '../types';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'webm',
]);

const AUDIO_MIME_PREFIXES = ['audio/'];
// Some servers return these for audio files
const EXTRA_AUDIO_MIMES = new Set([
  'application/ogg',
  'application/octet-stream', // treated as "possibly audio"
]);

function isAudioContentType(contentType: string): boolean {
  const lower = contentType.toLowerCase().split(';')[0].trim();
  return (
    AUDIO_MIME_PREFIXES.some((p) => lower.startsWith(p)) ||
    EXTRA_AUDIO_MIMES.has(lower)
  );
}

function hasAudioExtension(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase();
    return !!ext && AUDIO_EXTENSIONS.has(ext);
  } catch {
    return false;
  }
}

/**
 * Derives a display title from a URL.
 *
 * Special handling for known meme-button sites:
 *   https://www.myinstants.com/media/sounds/airhorn.mp3  → "airhorn"
 *   https://instantbuttons.com/sounds/airhorn.mp3       → "airhorn"
 *
 * Generic: last path segment without extension, dashes/underscores → spaces.
 */
function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1] ?? '';
    const withoutExt = last.replace(/\.[^.]+$/, '');
    return decodeURIComponent(withoutExt).replace(/[_-]+/g, ' ').trim() || url;
  } catch {
    return url;
  }
}

/**
 * Attempts a HEAD request to verify content-type and size before import.
 * Returns { contentType, sizeBytes, verified } — verified = false means HEAD
 * failed and we are operating without metadata.
 */
async function headCheck(
  url: string
): Promise<{ contentType: string | null; sizeBytes: number | null; verified: boolean }> {
  try {
    const res = await fetch(url, { method: 'HEAD', mode: 'cors' });
    if (!res.ok) {
      return { contentType: null, sizeBytes: null, verified: false };
    }
    const contentType = res.headers.get('content-type');
    const contentLength = res.headers.get('content-length');
    const sizeBytes = contentLength ? parseInt(contentLength, 10) : null;
    return { contentType, sizeBytes, verified: true };
  } catch {
    return { contentType: null, sizeBytes: null, verified: false };
  }
}

export const urlProvider: SoundImportProvider = {
  id: 'url',
  label: 'URL',
  description: 'Import a sound from a direct audio URL',
  available: true,

  supportsUrlImport: true,
  supportsSearch: false,
  supportsFileUpload: false,

  async importFromUrl(url: string): Promise<ImportResult> {
    // ── Basic URL validation ─────────────────────────────────────────────────
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('Ungültige URL. Bitte eine vollständige URL eingeben.');
    }

    if (parsed.protocol !== 'https:') {
      throw new Error(
        'Nur HTTPS-URLs sind erlaubt. Stelle sicher, dass die URL mit https:// beginnt.'
      );
    }

    const hasExt = hasAudioExtension(url);

    // ── HEAD preflight ───────────────────────────────────────────────────────
    const { contentType, sizeBytes, verified } = await headCheck(url);

    if (verified) {
      // Size check
      if (sizeBytes !== null && sizeBytes > MAX_SIZE_BYTES) {
        const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(1);
        throw new Error(
          `Datei zu groß (${sizeMb} MB). Maximum ist 5 MB.`
        );
      }

      // Content-type check (only if HEAD succeeded)
      if (contentType && !hasExt && !isAudioContentType(contentType)) {
        throw new Error(
          `Die URL scheint keine Audio-Datei zu sein (Content-Type: ${contentType}).`
        );
      }
    } else if (!hasExt) {
      // HEAD failed AND no recognizable extension — still allow but warn in title
      // We do NOT block the import; the user may know what they're doing.
      // The ImportResult will carry the url reference; playback will validate.
    }

    const title = titleFromUrl(url);

    return {
      url,
      title,
      mimeType: contentType ?? undefined,
      // No blob — we store a URL reference; Matrix client will fetch on playback
    };
  },
};
