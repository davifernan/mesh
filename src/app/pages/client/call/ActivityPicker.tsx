/**
 * ActivityPicker — popover shown above the Activities button in the call control bar.
 * Lists all registered microapps; click to toggle them on/off in the current room.
 * Active apps immediately appear as tiles in the call participant grid.
 */
import React, { useRef, useEffect, useState } from 'react';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useCallState } from './CallProvider';
import { useRoomWidgets } from '../../../hooks/useRoomWidgets';
import { getAppCatalog, AppCatalogEntry } from '../../../state/microappCatalog';
import '../../../../apps/index';
import styles from './ActivityPicker.module.css';

function substituteTemplateVars(url: string, mx: ReturnType<typeof useMatrixClient>, roomId: string, widgetId: string): string {
  const userId = mx.getUserId() ?? '';
  const user = mx.getUser(userId);
  return url
    .replace(/\$matrix_room_id/g, encodeURIComponent(roomId))
    .replace(/\$matrix_user_id/g, encodeURIComponent(userId))
    .replace(/\$matrix_display_name/g, encodeURIComponent(user?.displayName ?? userId))
    .replace(/\$matrix_avatar_url/g, encodeURIComponent(user?.avatarUrl ?? ''))
    .replace(/\$matrix_widget_id/g, encodeURIComponent(widgetId))
    .replace(/\$matrix_client_origin/g, encodeURIComponent(window.location.origin))
    .replace(/\$org\.matrix\.msc2873\.client_id/g, encodeURIComponent(userId))
    .replace(/\$org\.matrix\.msc2873\.client_origin/g, encodeURIComponent(window.location.origin));
}

interface ActivityPickerProps {
  onClose: () => void;
}

export function ActivityPicker({ onClose }: ActivityPickerProps) {
  const mx = useMatrixClient();
  const { activeCallRoomId } = useCallState();
  const room = activeCallRoomId ? (mx.getRoom(activeCallRoomId) ?? null) : null;
  const activeWidgets = useRoomWidgets(room);
  const catalog = getAppCatalog();
  const pickerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleToggle = async (entry: AppCatalogEntry) => {
    if (!room || loading) return;
    const isActive = activeWidgets.some((widget) => widget.id === entry.id);
    setLoading(entry.id);
    setError(null);

    try {
      if (isActive) {
        await (mx as any).sendStateEvent(room.roomId, 'im.vector.modular.widgets', {}, entry.id);
      } else {
        const resolvedUrl = substituteTemplateVars(entry.widgetUrl, mx, room.roomId, entry.id);
        await (mx as any).sendStateEvent(
          room.roomId,
          'im.vector.modular.widgets',
          {
            type: 'm.custom',
            url: resolvedUrl,
            name: entry.name,
            id: entry.id,
          },
          entry.id
        );
      }
    } catch {
      setError('Could not update this activity in the room.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div ref={pickerRef} className={styles.picker}>
      <div className={styles.header}>Activities</div>

      {catalog.length === 0 ? (
        <p className={styles.empty}>No apps configured.</p>
      ) : (
        <div className={styles.grid}>
          {catalog.map((entry) => {
            const isActive = activeWidgets.some((widget) => widget.id === entry.id);
            const isLoading = loading === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                className={`${styles.card}${isActive ? ` ${styles.cardActive}` : ''}`}
                onClick={() => void handleToggle(entry)}
                disabled={isLoading}
                title={entry.description}
              >
                <span className={styles.cardIcon} aria-hidden="true">
                  {isLoading ? '⏳' : entry.icon}
                </span>
                <span className={styles.cardName}>{entry.name}</span>
                {isActive && <span className={styles.activeDot} aria-label="Active" />}
              </button>
            );
          })}
        </div>
      )}

      {error && <p className={styles.noPermission}>{error}</p>}
    </div>
  );
}
