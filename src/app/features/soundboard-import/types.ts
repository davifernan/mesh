// A single result returned from a provider's search() method
export type ImportSearchResult = {
  id: string;
  title: string;
  previewUrl?: string; // URL to stream audio before committing the import
  sourceUrl: string; // URL to the actual audio file for import
  durationMs?: number;
  attribution?: string;
  license?: string;
};

// What a provider hands back after a successful import operation
export type ImportResult = {
  blob?: Blob; // set when the provider downloaded the file locally
  url?: string; // set when the provider only returns a URL reference
  title: string;
  durationMs?: number;
  mimeType?: string;
  attribution?: string;
};

// Contract every provider must implement
export interface SoundImportProvider {
  id: string;
  label: string;
  description: string;
  available: boolean; // false → show as disabled ("coming soon")

  supportsSearch: boolean;
  supportsUrlImport: boolean;
  supportsFileUpload: boolean;

  search?(query: string): Promise<ImportSearchResult[]>;
  importFromUrl?(url: string): Promise<ImportResult>;
  importFromFile?(file: File): Promise<ImportResult>;
}
