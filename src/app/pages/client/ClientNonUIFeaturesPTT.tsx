/**
 * ClientNonUIFeaturesPTT.tsx
 *
 * Split from ClientNonUIFeatures.tsx to stay under the 650-line limit.
 * Contains:
 *  - PWABadge          — navigator.setAppBadge() for PWA/browser badge count
 *  - ElectronDeepLink  — mesh:// URL handler (Electron + web fallback)
 *                        Extended to handle invite/CODE and room/ROOM_ID patterns
 *  - PTTElectronShortcut — Push-to-Talk via Electron globalShortcut or web keydown/keyup
 */

import { useAtomValue } from 'jotai';
import React, { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomToUnreadAtom } from '../../state/room/roomToUnread';
import { settingsAtom } from '../../state/settings';
import { getAppPathFromHref, getOriginBaseUrl, getHomeJoinPath, getHomeRoomPath } from '../pathUtils';
import { useCallStateOptional } from './call/CallProvider';

// ---------------------------------------------------------------------------
// PWABadge
// Uses navigator.setAppBadge() to show unread count in the OS dock/shelf.
// Only active when not running in Electron (Electron handles this itself via
// ElectronBadgeCount → window.electron.setBadgeCount()).
// ---------------------------------------------------------------------------

export function PWABadge() {
  const roomToUnread = useAtomValue(roomToUnreadAtom);

  // Compute the same count that ElectronBadgeCount uses
  let count = 0;
  roomToUnread.forEach((unread) => {
    count += unread.highlight > 0 ? unread.highlight : unread.total;
  });

  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    if (count > 0) {
      navigator.setAppBadge(count).catch(() => {});
    } else {
      navigator.clearAppBadge?.().catch(() => {});
    }
  }, [count]);

  return null;
}

// ---------------------------------------------------------------------------
// ElectronDeepLink (extended)
// Handles mesh:// URLs from both Electron and (on web) window.location.
//
// Supported patterns:
//   mesh://app/<path>         → /<path>
//   mesh://invite/<CODE>      → /home/join/ (with invite code in hash/search)
//   mesh://room/<ROOM_ID>     → /home/<roomIdOrAlias>/
// ---------------------------------------------------------------------------

export function ElectronDeepLink() {
  const navigate = useNavigate();

  const handleDeepLinkUrl = useCallback(
    (url: string) => {
      try {
        const parsed = new URL(url);
        const scheme = parsed.protocol; // e.g. "mesh:"
        const host = parsed.host;       // e.g. "invite", "room", "app"
        const pathParts = parsed.pathname.replace(/^\//, '').split('/').filter(Boolean);

        if (scheme !== 'mesh:') {
          // Not our scheme — try treating as normal URL
          const appPath = getAppPathFromHref(getOriginBaseUrl(), url);
          if (appPath && appPath !== '/') navigate(appPath);
          return;
        }

        if (host === 'invite') {
          // mesh://invite/CODE → navigate to join flow with the code pre-filled
          const code = pathParts[0] ?? parsed.pathname.replace(/^\//, '');
          if (code) {
            // HOME_JOIN_PATH = /home/join/
            // Pass the invite code as a ?alias query param so the join dialog can pick it up
            navigate(`${getHomeJoinPath()}?alias=${encodeURIComponent(code)}`);
          }
        } else if (host === 'room') {
          // mesh://room/ROOM_ID_OR_ALIAS → navigate directly to that room
          const roomId = pathParts[0] ?? parsed.pathname.replace(/^\//, '');
          if (roomId) {
            navigate(getHomeRoomPath(roomId));
          }
        } else {
          // mesh://app/some/path → /some/path  (legacy / default)
          const path = `/${host}${parsed.pathname}${parsed.search}${parsed.hash}`.replace(
            /^\/app/,
            ''
          );
          if (path) navigate(path);
        }
      } catch {
        // Fallback: try treating it as a normal URL and extract the app path
        const appPath = getAppPathFromHref(getOriginBaseUrl(), url);
        if (appPath && appPath !== '/') navigate(appPath);
      }
    },
    [navigate]
  );

  // -------------------------------------------------------------------------
  // Electron: receive deep links from the main process
  // -------------------------------------------------------------------------
  useEffect(() => {
    const electron = window.electron;
    if (!electron) return;

    // Handle the URL that launched the app (if any)
    electron.getInitialDeepLink().then((url) => {
      if (url) handleDeepLinkUrl(url);
    }).catch(() => {});

    // Subscribe to future deep-link events
    return electron.onDeepLink(handleDeepLinkUrl);
  }, [handleDeepLinkUrl]);

  // -------------------------------------------------------------------------
  // Web fallback: handle mesh:// URLs arriving via window.location
  // (some OS / browser setups redirect custom protocol URLs to the PWA).
  // Check on mount and on popstate/hashchange.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (window.electron) return; // Electron already handled above

    const checkLocation = () => {
      const href = window.location.href;
      if (href.startsWith('mesh://')) {
        handleDeepLinkUrl(href);
      }
    };

    checkLocation();
    window.addEventListener('popstate', checkLocation);
    window.addEventListener('hashchange', checkLocation);
    return () => {
      window.removeEventListener('popstate', checkLocation);
      window.removeEventListener('hashchange', checkLocation);
    };
  }, [handleDeepLinkUrl]);

  return null;
}

// ---------------------------------------------------------------------------
// PTTElectronShortcut
// Push-to-Talk: when voiceActivityMode === 'ptt' and pttKey is set:
//   • In Electron: uses window.electron.registerGlobalShortcut + onGlobalShortcut
//     (works even when the window is not focused, using Electron's native API).
//     The global shortcut ID convention:
//       "ptt-press"   → key down  → unmute
//       "ptt-release" → key up    → mute
//   • In browser/PWA: falls back to keydown/keyup on window (only when focused).
// ---------------------------------------------------------------------------

export function PTTElectronShortcut() {
  const settings = useAtomValue(settingsAtom);
  const { voiceActivityMode, pttKey } = settings;
  const callState = useCallStateOptional();
  const isAudioEnabled = callState?.isAudioEnabled ?? false;
  const toggleAudio = callState?.toggleAudio;

  // #64 — useRef so handlers always see the latest values without re-registering
  // the global shortcut / re-adding window listeners on every mute/unmute state change.
  const isAudioEnabledRef = useRef(isAudioEnabled);
  isAudioEnabledRef.current = isAudioEnabled;
  const toggleAudioRef = useRef(toggleAudio);
  toggleAudioRef.current = toggleAudio;

  // -------------------------------------------------------------------------
  // Electron global shortcut path
  // -------------------------------------------------------------------------
  useEffect(() => {
    const electron = window.electron;
    if (!electron?.registerGlobalShortcut) return;
    if (voiceActivityMode !== 'ptt' || !pttKey) return;
    if (!callState) return; // no active call

    let cleanedUp = false;

    // Electron global shortcuts only fire on keydown. We register a single
    // shortcut with id 'ptt-press'. For key-release we fall back to a
    // keydown/keyup listener on the window (Electron still delivers those).
    const pressId = 'ptt-press';

    // Register the global shortcut (works even when app is not focused)
    electron.registerGlobalShortcut(pttKey, pressId).catch(() => {});

    const unsubShortcut = electron.onGlobalShortcut((id: string) => {
      if (cleanedUp) return;
      if (id === pressId) {
        // Use ref so we don't re-register the shortcut on every isAudioEnabled change
        if (!isAudioEnabledRef.current && toggleAudioRef.current) void toggleAudioRef.current();
      }
    });

    // For the release (mute again), listen on the window keyup in Electron too.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === pttKey && isAudioEnabledRef.current && toggleAudioRef.current) {
        void toggleAudioRef.current();
      }
    };
    window.addEventListener('keyup', onKeyUp);

    return () => {
      cleanedUp = true;
      window.removeEventListener('keyup', onKeyUp);
      electron.unregisterGlobalShortcut(pttKey).catch(() => {});
      unsubShortcut();
    };
    // isAudioEnabled / toggleAudio intentionally excluded — accessed via ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceActivityMode, pttKey, callState]);

  // -------------------------------------------------------------------------
  // Web / PWA fallback: keydown + keyup on window (only when window focused)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (window.electron) return; // Electron path above handles it
    if (voiceActivityMode !== 'ptt' || !pttKey) return;

    let active = false;

    const onDown = (e: KeyboardEvent) => {
      if (e.code === pttKey && !active) {
        active = true;
        if (!isAudioEnabledRef.current && toggleAudioRef.current) void toggleAudioRef.current();
      }
    };

    const onUp = (e: KeyboardEvent) => {
      if (e.code === pttKey && active) {
        active = false;
        if (isAudioEnabledRef.current && toggleAudioRef.current) void toggleAudioRef.current();
      }
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
    // isAudioEnabled / toggleAudio intentionally excluded — accessed via ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceActivityMode, pttKey]);

  return null;
}
