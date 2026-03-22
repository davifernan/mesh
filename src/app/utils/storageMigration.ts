/**
 * Migrates legacy Cinny storage keys to BetterCord keys.
 * Called once at app startup to ensure backward compatibility.
 */
export function migrateStorageKeys(): void {
  // Migrate localStorage
  const localKeysToMigrate: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('cinny_') || key.startsWith('cinny-'))) {
      localKeysToMigrate.push(key);
    }
  }
  for (const key of localKeysToMigrate) {
    const newKey = key.startsWith('cinny_')
      ? `bettercord_${key.slice('cinny_'.length)}`
      : `bettercord-${key.slice('cinny-'.length)}`;
    const value = localStorage.getItem(key);
    if (value !== null) {
      localStorage.setItem(newKey, value);
      localStorage.removeItem(key);
    }
  }

  // Migrate sessionStorage
  const sessionKeysToMigrate: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && (key.startsWith('cinny_') || key.startsWith('cinny-'))) {
      sessionKeysToMigrate.push(key);
    }
  }
  for (const key of sessionKeysToMigrate) {
    const newKey = key.startsWith('cinny_')
      ? `bettercord_${key.slice('cinny_'.length)}`
      : `bettercord-${key.slice('cinny-'.length)}`;
    const value = sessionStorage.getItem(key);
    if (value !== null) {
      sessionStorage.setItem(newKey, value);
      sessionStorage.removeItem(key);
    }
  }
}
