/**
 * AppTile — renders a microapp widget as a full-width tile inside the call participant grid,
 * alongside real participants (Discord Activities–style).
 *
 * Uses SmallWidget / ClientWidgetApi to relay Matrix room events to the widget iframe
 * so apps like YouTube Together can receive sync commands in real time.
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CornersOut, ArrowsOutSimple, ArrowsInSimple } from '@phosphor-icons/react';
import type { RoomWidget } from '../../../hooks/useRoomWidgets';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useCallState } from './CallProvider';
import { SmallWidget, createVirtualWidget } from '../../../features/call/SmallWidget';
import { getAppCatalog } from '../../../state/microappCatalog';
import styles from './AppTile.module.css';

/** Prefix used in the voiceCallLayoutAtom to distinguish widget pins from participant pins. */
export const WIDGET_PIN_PREFIX = 'widget:';

export function widgetPinId(widgetId: string): string {
  return `${WIDGET_PIN_PREFIX}${widgetId}`;
}

interface AppTileProps {
  widget: RoomWidget;
  /** Called with `widgetPinId(widget.id)` to pin, or `null` to unpin. */
  onPin?: (id: string | null) => void;
  isPinned?: boolean;
  className?: string;
}

export function AppTile({ widget, onPin, isPinned, className }: AppTileProps) {
  const mx = useMatrixClient();
  const { activeCallRoomId } = useCallState();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const smallWidgetRef = useRef<SmallWidget | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Look up catalog entry for the emoji icon
  const catalogEntry = getAppCatalog().find((e) => e.id === widget.id);
  const icon = catalogEntry?.icon ?? '🧩';

  // Set up SmallWidget: start Matrix Widget API messaging before setting iframe.src
  useEffect(() => {
    const iframe = iframeRef.current;
    const room = activeCallRoomId ? mx.getRoom(activeCallRoomId) : null;
    if (!iframe || !room) return undefined;

    // Tear down any previous SmallWidget instance
    if (smallWidgetRef.current) {
      smallWidgetRef.current.stopMessaging();
      smallWidgetRef.current = null;
    }

    // Build the resolved URL — stored URL may be relative (/youtube.html?...)
    const rawUrl = widget.url.startsWith('/')
      ? `${window.location.origin}${widget.url}`
      : widget.url;
    const resolvedUrl = new URL(rawUrl);
    // Ensure widgetId / parentUrl params are present (defensive re-set)
    resolvedUrl.searchParams.set('widgetId', widget.id);
    resolvedUrl.searchParams.set('parentUrl', window.location.origin);

    const userId = mx.getUserId() ?? '';
    const app = createVirtualWidget(
      mx,
      widget.id,
      userId,
      widget.name,
      widget.type ?? 'm.custom',
      resolvedUrl,
      false,
      (widget.data as Record<string, unknown>) ?? {},
      room.roomId,
    );

    const sw = new SmallWidget(app);
    smallWidgetRef.current = sw;
    // MUST call startMessaging before setting iframe.src (ContentLoaded sequence)
    sw.startMessaging(iframe);
    iframe.src = resolvedUrl.toString();

    return () => {
      sw.stopMessaging();
      if (smallWidgetRef.current === sw) smallWidgetRef.current = null;
    };
  }, [mx, activeCallRoomId, widget.id, widget.url, widget.name, widget.type, widget.data]);

  // Track fullscreen state
  useEffect(() => {
    const handler = () => setIsFullscreen(document.fullscreenElement === tileRef.current);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!tileRef.current) return;
    if (document.fullscreenElement === tileRef.current) {
      await document.exitFullscreen();
    } else {
      await tileRef.current.requestFullscreen();
    }
  }, []);

  const handlePin = useCallback(() => {
    if (!onPin) return;
    onPin(isPinned ? null : widgetPinId(widget.id));
  }, [onPin, isPinned, widget.id]);

  return (
    <div
      ref={tileRef}
      className={`${styles.appTile}${className ? ` ${className}` : ''}`}
    >
      {/* Widget iframe — src is set imperatively in useEffect */}
      <iframe
        ref={iframeRef}
        title={widget.name}
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-modals allow-downloads allow-presentation"
        allow="autoplay; camera; microphone; fullscreen; display-capture"
        className={styles.appIframe}
      />

      {/* Action buttons — revealed on hover */}
      <div className={styles.appActions}>
        <button
          type="button"
          className={styles.appActionBtn}
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); void toggleFullscreen(); }}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          <CornersOut size={14} weight="bold" />
        </button>

        {onPin && (
          <button
            type="button"
            className={`${styles.appActionBtn}${isPinned ? ` ${styles.appActionBtnActive}` : ''}`}
            onClick={(e) => { e.stopPropagation(); handlePin(); }}
            title={isPinned ? 'Unpin' : 'Focus'}
            aria-label={isPinned ? 'Unpin app' : 'Focus app'}
          >
            {isPinned
              ? <ArrowsInSimple size={14} weight="bold" />
              : <ArrowsOutSimple size={14} weight="bold" />
            }
          </button>
        )}
      </div>

      {/* Bottom label bar — same gradient style as screenshare tiles */}
      <div className={styles.appTileLabel}>
        <span className={styles.appTileIcon} aria-hidden="true">{icon}</span>
        {widget.name}

        {onPin && (
          <button
            type="button"
            className={styles.focusBtn}
            onClick={(e) => { e.stopPropagation(); handlePin(); }}
          >
            {isPinned ? 'Unpin' : 'Focus'}
          </button>
        )}
      </div>
    </div>
  );
}
