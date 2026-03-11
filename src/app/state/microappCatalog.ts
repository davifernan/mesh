export type AppCategory = 'media' | 'collaborate' | 'decide';

export type AppCatalogEntry = {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji or Icons.* key from folds
  category: AppCategory;
  // Matrix template vars supported: $matrix_widget_id, $matrix_client_origin, $matrix_room_id
  widgetUrl: string;
  capabilities?: string[];
};

const _registry: AppCatalogEntry[] = [];

export function registerApp(entry: AppCatalogEntry): void {
  if (!_registry.find((e) => e.id === entry.id)) _registry.push(entry);
}

export function getAppCatalog(): AppCatalogEntry[] {
  return _registry;
}
