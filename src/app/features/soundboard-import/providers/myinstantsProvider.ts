// TODO(V2): Instant Buttons / Myinstants integration
//
// ⚠ COPYRIGHT & TERMS REVIEW REQUIRED BEFORE IMPLEMENTING ⚠
//
// Sites like myinstants.com and instantbuttons.com allow users to upload sounds
// that may be copyrighted (movie clips, music, TV clips, etc.).  Their TOS does
// not grant third-party applications a re-distribution license, and scraping /
// embedding their audio directly inside a Matrix client could expose BetterCord
// to DMCA takedown requests.
//
// Before implementing:
//   1. Obtain explicit written permission from each site, OR
//   2. Only link to the site URL (sourceType: 'url') so no file is stored, AND
//   3. Display attribution + a link back to the original button page, AND
//   4. Consult legal counsel regarding DMCA safe harbor eligibility.
//
// This stub is intentionally left non-functional.

import { ImportResult, ImportSearchResult, SoundImportProvider } from '../types';

export const myinstantsProvider: SoundImportProvider = {
  id: 'myinstants',
  label: 'Instant Buttons',
  description: 'Import sounds from meme button sites (coming soon)',
  available: false,

  supportsSearch: true,
  supportsUrlImport: true,
  supportsFileUpload: false,

  async search(_query: string): Promise<ImportSearchResult[]> {
    throw new Error('Instant Buttons integration coming in V2');
  },

  async importFromUrl(_url: string): Promise<ImportResult> {
    throw new Error('Instant Buttons integration coming in V2');
  },
};
