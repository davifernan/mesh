/**
 * Migrates legacy Cinny and BetterCord storage keys to mesh keys.
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
    if (
      key &&
      (key.startsWith('cinny_') ||
        key.startsWith('cinny-') ||
        key.startsWith('bettercord_') ||
        key.startsWith('bettercord-'))
    ) {
      keysToMigrate.push(key);
    }
  }
  for (const key of keysToMigrate) {
    let newKey: string;
    if (key.startsWith('cinny_')) {
      newKey = `mesh_${key.slice('cinny_'.length)}`;
    } else if (key.startsWith('cinny-')) {
      newKey = `mesh-${key.slice('cinny-'.length)}`;
    } else if (key.startsWith('bettercord_')) {
      newKey = `mesh_${key.slice('bettercord_'.length)}`;
    } else {
      newKey = `mesh-${key.slice('bettercord-'.length)}`;
    }
    const value = storage.getItem(key);
    if (value !== null) {
      storage.setItem(newKey, value);
      storage.removeItem(key);
    }
  }
}
