/**
 * WidgetCatalogView — catalog of curated microapps that can be added to a room.
 * Rendered inside WidgetsDrawer when the "Apps" tab is active.
 */
import React from 'react';
import { Box, Button, Text, config, color } from 'folds';
import { AppCatalogEntry, AppCategory } from '../../state/microappCatalog';

const CATEGORY_LABELS: Record<AppCategory, string> = {
  media: 'Media',
  collaborate: 'Collaborate',
  decide: 'Decide',
};

const CATEGORY_ORDER: AppCategory[] = ['media', 'collaborate', 'decide'];

type WidgetCatalogViewProps = {
  catalog: AppCatalogEntry[];
  canManageWidgets: boolean;
  onAdd: (entry: AppCatalogEntry) => Promise<void>;
};

export function WidgetCatalogView({ catalog, canManageWidgets, onAdd }: WidgetCatalogViewProps) {
  const [adding, setAdding] = React.useState<string | null>(null);

  const handleAdd = React.useCallback(
    async (entry: AppCatalogEntry) => {
      setAdding(entry.id);
      try {
        await onAdd(entry);
      } finally {
        setAdding(null);
      }
    },
    [onAdd],
  );

  // Group entries by category — must be called before any early returns (rules of hooks)
  const byCategory = React.useMemo(() => {
    const map = new Map<AppCategory, AppCatalogEntry[]>();
    for (const entry of catalog) {
      const list = map.get(entry.category) ?? [];
      list.push(entry);
      map.set(entry.category, list);
    }
    return map;
  }, [catalog]);

  if (catalog.length === 0) {
    return (
      <Box
        grow="Yes"
        justifyContent="Center"
        alignItems="Center"
        direction="Column"
        gap="200"
        style={{ padding: config.space.S400 }}
      >
        <Text size="T300" priority="300" style={{ textAlign: 'center' }}>
          No apps configured. Enable YouTube and Spotify by default, or configure Polls and
          Whiteboard URLs in build.config.ts.
        </Text>
      </Box>
    );
  }

  return (
    <Box
      direction="Column"
      style={{
        overflowY: 'auto',
        flexGrow: 1,
        minHeight: 0,
        padding: `${config.space.S200} 0`,
      }}
    >
      {CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((cat) => {
        const entries = byCategory.get(cat)!;
        return (
          <Box
            key={cat}
            direction="Column"
            style={{ marginBottom: config.space.S300 }}
          >
            {/* Category label */}
            <Text
              size="L400"
              style={{
                padding: `${config.space.S100} ${config.space.S300}`,
                color: color.Secondary.Main,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {CATEGORY_LABELS[cat]}
            </Text>

            {/* App cards */}
            {entries.map((entry) => (
              <Box
                key={entry.id}
                alignItems="Center"
                gap="300"
                style={{
                  padding: `${config.space.S200} ${config.space.S300}`,
                  borderRadius: '8px',
                  margin: `0 ${config.space.S200}`,
                }}
              >
                {/* Icon */}
                <Box
                  justifyContent="Center"
                  alignItems="Center"
                  shrink="No"
                  style={{
                    width: '40px',
                    height: '40px',
                    fontSize: '28px',
                    lineHeight: 1,
                    borderRadius: '10px',
                    background: color.Surface.Container,
                    userSelect: 'none',
                  }}
                >
                  {entry.icon}
                </Box>

                {/* Name + description */}
                <Box direction="Column" gap="100" style={{ flexGrow: 1, minWidth: 0 }}>
                  <Text size="H6" truncate>
                    {entry.name}
                  </Text>
                  <Text size="T300" priority="300" truncate>
                    {entry.description}
                  </Text>
                </Box>

                {/* Add button */}
                <Box shrink="No">
                  <span
                    title={!canManageWidgets ? 'Need moderator permissions' : undefined}
                    style={{ display: 'inline-flex' }}
                  >
                    <Button
                      size="300"
                      variant="Secondary"
                      fill="Soft"
                      disabled={!canManageWidgets || adding === entry.id}
                      onClick={() => handleAdd(entry)}
                    >
                      <Text size="B300">
                        {adding === entry.id ? 'Adding…' : 'Add to Room'}
                      </Text>
                    </Button>
                  </span>
                </Box>
              </Box>
            ))}
          </Box>
        );
      })}
    </Box>
  );
}
