import { ImportResult, ImportSearchResult, SoundImportProvider } from '../types';

// ── V2 placeholder type ──────────────────────────────────────────────────────
// Will be extended when Freesound OAuth + API integration is implemented.
export type FreesoundSearchResult = ImportSearchResult & {
  freesoundId: number;
  username: string;
  tags: string[];
  license: string; // e.g. "https://creativecommons.org/licenses/by/4.0/"
  downloadUrl: string; // requires OAuth token
};

// ── V2 stub provider ─────────────────────────────────────────────────────────
export const freesoundProvider: SoundImportProvider = {
  id: 'freesound',
  label: 'Freesound',
  description: 'Import sounds from Freesound.org (coming soon)',
  available: false,

  supportsSearch: true,
  supportsUrlImport: false,
  supportsFileUpload: false,

  async search(_query: string): Promise<ImportSearchResult[]> {
    throw new Error('Freesound integration coming in V2');
  },

  async importFromUrl(_url: string): Promise<ImportResult> {
    throw new Error('Freesound integration coming in V2');
  },
};
