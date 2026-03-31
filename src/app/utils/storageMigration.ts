/**
 * Migrates legacy Cinny storage keys to mesh keys.
 * Called once at app startup to ensure backward compatibility.
 */
export function migrateStorageKeys(): void {
  migrateStorage(localStorage);
  migrateStorage(sessionStorage);
}

function migrateStorage(storage: Storage): void {
  const keysToMigrate: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && (key.startsWith('cinny_') || key.startsWith('cinny-'))) {
      keysToMigrate.push(key);
    }
  }
  for (const key of keysToMigrate) {
    const newKey = key.startsWith('cinny_')
      ? `mesh_${key.slice('cinny_'.length)}`
      : `mesh-${key.slice('cinny-'.length)}`;
    const value = storage.getItem(key);
    if (value !== null) {
      storage.setItem(newKey, value);
      storage.removeItem(key);
    }
  }
}
