/**
 * WidgetsDrawer — lists and embeds room widgets (im.vector.modular.widgets state events).
 * Reuses the same SmallWidget / SmallWidgetDriver infrastructure used for Element Call.
 * Excludes natively-handled widgets from the generic widget list.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Room } from 'matrix-js-sdk';
import {
  Box,
  Button,
  Icon,
  IconButton,
  Icons,
  Text,
  Chip,
  config,
  toRem,
  color,
  PopOut,
  RectCords,
} from 'folds';
import { atom, useAtom } from 'jotai';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoomWidgets, RoomWidget } from '../../hooks/useRoomWidgets';
import { SmallWidget, createVirtualWidget } from '../call/SmallWidget';
import { useToolbarConfig } from '../../hooks/useToolbarConfig';
import { ToolbarItemId } from '../../state/toolbarConfig';
import { PanelIconPicker } from './PanelIconPicker';
import { getAppCatalog, AppCatalogEntry } from '../../state/microappCatalog';
import '../../../apps/index';
import { WidgetCatalogView } from './WidgetCatalogView';

export const activeWidgetIdAtom = atom<string | null>(null);

function substituteTemplateVars(
  url: string,
  mx: ReturnType<typeof useMatrixClient>,
  roomId: string,
  widgetId: string
): string {
  const userId = mx.getUserId() ?? '';
  const displayName = mx.getUser(userId)?.displayName ?? userId;
  const avatarUrl = mx.getUser(userId)?.avatarUrl ?? '';
  return url
    .replace(/\$matrix_room_id/g, encodeURIComponent(roomId))
    .replace(/\$matrix_user_id/g, encodeURIComponent(userId))
    .replace(/\$matrix_display_name/g, encodeURIComponent(displayName))
    .replace(/\$matrix_avatar_url/g, encodeURIComponent(avatarUrl))
    .replace(/\$matrix_widget_id/g, encodeURIComponent(widgetId))
    .replace(/\$matrix_client_origin/g, encodeURIComponent(window.location.origin))
    .replace(/\$org\.matrix\.msc2873\.client_id/g, encodeURIComponent(userId))
    .replace(/\$org\.matrix\.msc2873\.client_origin/g, encodeURIComponent(window.location.origin));
}

type WidgetViewProps = {
  room: Room;
  widget: RoomWidget;
};

function WidgetView({ room, widget }: WidgetViewProps) {
  const mx = useMatrixClient();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const smallWidgetRef = useRef<SmallWidget | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return undefined;

    if (smallWidgetRef.current) {
      smallWidgetRef.current.stopMessaging();
      smallWidgetRef.current = null;
    }

    const resolvedUrl = new URL(substituteTemplateVars(widget.url, mx, room.roomId, widget.id));
    resolvedUrl.searchParams.set('widgetId', widget.id);
    resolvedUrl.searchParams.set('parentUrl', window.location.origin);

    const userId = mx.getUserId() ?? '';
    const app = createVirtualWidget(
      mx,
      widget.id,
      userId,
      widget.name,
      widget.type,
      resolvedUrl,
      false,
      widget.data ?? {},
      room.roomId
    );

    const smallWidget = new SmallWidget(app);
    smallWidgetRef.current = smallWidget;
    smallWidget.startMessaging(iframe);
    iframe.src = resolvedUrl.toString();

    return () => {
      smallWidget.stopMessaging();
      if (smallWidgetRef.current === smallWidget) smallWidgetRef.current = null;
    };
  }, [mx, room.roomId, widget]);

  return (
    <iframe
      ref={iframeRef}
      title={widget.name}
      sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-modals allow-downloads"
      allow="microphone; camera; fullscreen"
      style={{
        flexGrow: 1,
        border: 'none',
        minHeight: 0,
        width: '100%',
        background: 'var(--bg-surface)',
      }}
    />
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: `${config.space.S100} ${config.space.S200}`,
  border: `1px solid ${color.Surface.ContainerLine}`,
  borderRadius: '6px',
  background: 'var(--bg-surface)',
  color: 'var(--tc-surface-high)',
  fontSize: '14px',
  boxSizing: 'border-box',
};

type WidgetsDrawerProps = {
  room: Room;
  onClose: () => void;
  width?: number;
  isFullWidth?: boolean;
  onToggleFullWidth?: () => void;
};

export function WidgetsDrawer({ room, onClose, width = 420, isFullWidth, onToggleFullWidth }: WidgetsDrawerProps) {
  const mx = useMatrixClient();
  const widgets = useRoomWidgets(room);
  const [activeTab, setActiveTab] = useState<'catalog' | 'widgets'>('catalog');
  const catalog = React.useMemo(() => getAppCatalog(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addName, setAddName] = useState('');
  const [saving, setSaving] = useState(false);

  const { config: toolbarConfig, setItem: setToolbarItem } = useToolbarConfig();
  const [iconPickerAnchor, setIconPickerAnchor] = useState<RectCords | null>(null);
  const [iconPickerWidget, setIconPickerWidget] = useState<RoomWidget | null>(null);

  const [activeWidgetId, setActiveWidgetId] = useAtom(activeWidgetIdAtom);
  useEffect(() => {
    if (activeWidgetId) {
      setSelectedId(activeWidgetId);
      setActiveWidgetId(null);
    }
  }, [activeWidgetId, setActiveWidgetId]);

  useEffect(() => {
    if (widgets.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev && widgets.some((widget) => widget.id === prev)) return prev;
      return null;
    });
  }, [widgets]);

  const selectedWidget = widgets.find((widget) => widget.id === selectedId) ?? null;

  const handleAdd = useCallback(async () => {
    const url = addUrl.trim();
    if (!url) return;

    let name = addName.trim();
    if (!name) {
      try {
        name = new URL(url).hostname;
      } catch {
        name = 'Widget';
      }
    }

    const id = `widget-${Date.now()}`;
    setSaving(true);
    try {
      await mx.sendStateEvent(
        room.roomId,
        'im.vector.modular.widgets' as any,
        {
          type: 'm.custom',
          url,
          name,
          id,
        },
        id
      );
      setAddUrl('');
      setAddName('');
      setIsAdding(false);
    } finally {
      setSaving(false);
    }
  }, [mx, room.roomId, addUrl, addName]);

  const handleRemove = useCallback(
    async (widgetId: string) => {
      await mx.sendStateEvent(room.roomId, 'im.vector.modular.widgets' as any, {}, widgetId);
    },
    [mx, room.roomId]
  );

  const cancelAdd = useCallback(() => {
    setIsAdding(false);
    setAddUrl('');
    setAddName('');
  }, []);

  const handleAddCatalogApp = useCallback(
    async (entry: AppCatalogEntry) => {
      const resolvedUrl = substituteTemplateVars(entry.widgetUrl, mx, room.roomId, entry.id);
      await mx.sendStateEvent(
        room.roomId,
        'im.vector.modular.widgets' as any,
        {
          type: 'm.custom',
          url: resolvedUrl,
          name: entry.name,
          id: entry.id,
        },
        entry.id
      );
      setActiveTab('widgets');
      setSelectedId(entry.id);
    },
    [mx, room.roomId]
  );

  const openIconPicker = useCallback((widget: RoomWidget, anchor: RectCords) => {
    setIconPickerWidget(widget);
    setIconPickerAnchor(anchor);
  }, []);

  const handleIconSelect = useCallback(
    (iconSpec: string | undefined) => {
      if (!iconPickerWidget) return;
      const toolbarId = `widget:${iconPickerWidget.id}` as ToolbarItemId;
      setToolbarItem(toolbarId, {
        pinned: true,
        order: Date.now() % 10000,
        defaultMode: 'sidebar',
        icon: iconSpec,
        label: iconPickerWidget.name,
      });
      setIconPickerAnchor(null);
      setIconPickerWidget(null);
    },
    [iconPickerWidget, setToolbarItem]
  );

  return (
    <Box
      role="region"
      aria-label="Widgets panel"
      tabIndex={-1}
      direction="Column"
      style={
        isFullWidth
          ? { flex: 1, minWidth: 0, overflow: 'hidden', borderLeft: `1px solid ${color.Surface.ContainerLine}` }
          : {
              width: toRem(width),
              minWidth: toRem(280),
              maxWidth: toRem(600),
              flexShrink: 0,
              borderLeft: `1px solid ${color.Surface.ContainerLine}`,
              overflow: 'hidden',
            }
      }
    >
      <Box
        alignItems="Center"
        gap="200"
        style={{
          padding: `${config.space.S200} ${config.space.S300}`,
          borderBottom: `1px solid ${color.Surface.ContainerLine}`,
          flexShrink: 0,
        }}
      >
        <Icon src={Icons.Category} size="200" />
        <Text size="H5" style={{ flexGrow: 1 }}>
          Widgets
        </Text>
        {onToggleFullWidth && (
          <IconButton
            size="300"
            radii="300"
            onClick={onToggleFullWidth}
            aria-label={isFullWidth ? 'Side by side' : 'Full width'}
          >
            <Icon src={isFullWidth ? Icons.ArrowGoRight : Icons.ArrowGoLeft} size="200" />
          </IconButton>
        )}
        <IconButton size="300" radii="300" onClick={onClose} aria-label="Close widgets drawer">
          <Icon src={Icons.Cross} size="200" />
        </IconButton>
      </Box>

      <Box
        gap="100"
        style={{
          padding: `${config.space.S100} ${config.space.S300}`,
          borderBottom: `1px solid ${color.Surface.ContainerLine}`,
          flexShrink: 0,
        }}
      >
        <Chip
          variant={activeTab === 'catalog' ? 'Primary' : 'Surface'}
          radii="Pill"
          onClick={() => setActiveTab('catalog')}
        >
          <Text size="T200">Apps</Text>
        </Chip>
        <Chip
          variant={activeTab === 'widgets' ? 'Primary' : 'Surface'}
          radii="Pill"
          onClick={() => setActiveTab('widgets')}
        >
          <Text size="T200">Widgets</Text>
        </Chip>
      </Box>

      {activeTab === 'widgets' && widgets.length > 0 && (
        <Box
          gap="100"
          style={{
            padding: `${config.space.S100} ${config.space.S200}`,
            borderBottom: `1px solid ${color.Surface.ContainerLine}`,
            flexShrink: 0,
            flexWrap: 'wrap',
          }}
        >
          {widgets.map((widget) => {
            const toolbarId = `widget:${widget.id}` as ToolbarItemId;
            const isPinned = !!toolbarConfig[toolbarId];
            return (
              <Box key={widget.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Chip
                  variant={selectedId === widget.id ? 'Primary' : 'Surface'}
                  radii="Pill"
                  onClick={() => setSelectedId((prev) => (prev === widget.id ? null : widget.id))}
                >
                  <Text size="T200" truncate>
                    {widget.name}
                  </Text>
                </Chip>
                {!isPinned && (
                  <IconButton
                    size="300"
                    radii="300"
                    onClick={(e) => {
                      openIconPicker(widget, (e.currentTarget as HTMLElement).getBoundingClientRect());
                    }}
                    aria-label={`Add ${widget.name} to toolbar`}
                    title="Add to toolbar"
                  >
                    <Icon src={Icons.Pin} size="100" />
                  </IconButton>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      <PopOut
        anchor={iconPickerAnchor ?? undefined}
        position="Bottom"
        align="Start"
        content={
          iconPickerWidget ? (
            <PanelIconPicker
              onSelect={handleIconSelect}
              onClose={() => {
                setIconPickerAnchor(null);
                setIconPickerWidget(null);
              }}
            />
          ) : <div />
        }
      />

      {activeTab === 'catalog' && (
        <WidgetCatalogView
          catalog={catalog}
          onAdd={handleAddCatalogApp}
        />
      )}

      {activeTab === 'widgets' && (
        <>
          {isAdding && (
            <Box
              direction="Column"
              gap="200"
              style={{
                padding: config.space.S300,
                borderBottom: `1px solid ${color.Surface.ContainerLine}`,
                flexShrink: 0,
              }}
            >
              <Text size="L400">Add Widget</Text>
              <input
                type="url"
                placeholder="Widget URL (required)"
                value={addUrl}
                onChange={(e) => setAddUrl(e.target.value)}
                style={inputStyle}
                autoFocus
              />
              <input
                type="text"
                placeholder="Name (defaults to hostname)"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                style={inputStyle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                }}
              />
              <Box gap="200">
                <Button
                  size="300"
                  variant="Primary"
                  onClick={handleAdd}
                  disabled={!addUrl.trim() || saving}
                >
                  <Text size="B300">{saving ? 'Adding…' : 'Add'}</Text>
                </Button>
                <Button size="300" variant="Secondary" fill="Soft" onClick={cancelAdd}>
                  <Text size="B300">Cancel</Text>
                </Button>
              </Box>
            </Box>
          )}

          {selectedWidget ? (
            <Box grow="Yes" direction="Column" style={{ minHeight: 0, overflow: 'hidden' }}>
              <WidgetView key={selectedWidget.id} room={room} widget={selectedWidget} />
            </Box>
          ) : !isAdding ? (
            <Box grow="Yes" justifyContent="Center" alignItems="Center" direction="Column" gap="300">
              <Text size="T300" priority="300">
                {widgets.length > 0 ? 'Select a widget above to load it.' : 'No widgets in this room.'}
              </Text>
              {widgets.length === 0 && (
                <Button size="300" variant="Secondary" fill="Soft" onClick={() => setIsAdding(true)}>
                  <Icon src={Icons.Plus} size="100" />
                  <Text size="B300">Add Widget</Text>
                </Button>
              )}
            </Box>
          ) : null}

          {widgets.length > 0 && !isAdding && (
            <Box
              shrink="No"
              gap="200"
              style={{
                padding: `${config.space.S200} ${config.space.S300}`,
                borderTop: `1px solid ${color.Surface.ContainerLine}`,
              }}
            >
              <Button size="300" variant="Secondary" fill="Soft" onClick={() => setIsAdding(true)}>
                <Icon src={Icons.Plus} size="100" />
                <Text size="B300">Add</Text>
              </Button>
              {selectedWidget && (
                <Button
                  size="300"
                  variant="Critical"
                  fill="Soft"
                  onClick={() => handleRemove(selectedWidget.id)}
                >
                  <Icon src={Icons.Delete} size="100" />
                  <Text size="B300">Remove</Text>
                </Button>
              )}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
