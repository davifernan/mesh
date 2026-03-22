import React, { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCallState } from '../client/call/CallProvider';
import { NativeCallView } from '../client/call/NativeCallView';

/**
 * CallPopoutPage — Electron-only popout window showing just the call UI.
 *
 * Rendered at /popout?room=<roomId> (or /#/popout?room=... for hash router).
 * Opened via window.open() from NativeCallControlBar when running in Electron.
 * Electron's setWindowOpenHandler (desktop/src/main/Window.tsx) intercepts
 * mesh_* frameName and creates a native BrowserWindow without chrome.
 *
 * Provider requirements are satisfied by the existing auth-protected route
 * group in Router.tsx (ClientRoot → CallProvider wraps all auth routes).
 */
export function CallPopoutPage() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('room');
  const { setActiveCallRoomId, hangUp } = useCallState();

  // Keep a stable ref to hangUp so cleanup effects always call the latest version
  const hangUpRef = useRef(hangUp);
  useEffect(() => {
    hangUpRef.current = hangUp;
  }, [hangUp]);

  // Join the call when roomId is available
  useEffect(() => {
    if (!roomId) return;
    setActiveCallRoomId(roomId, true);
  }, [roomId, setActiveCallRoomId]);

  // Hang up when the component unmounts (navigate away or app closes)
  useEffect(() => {
    return () => {
      hangUpRef.current();
    };
  }, []);

  // Also hang up when the window is closed via OS close button
  useEffect(() => {
    const handler = () => hangUpRef.current();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  if (!roomId) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: 'var(--text-muted)',
          fontSize: '14px',
          background: 'var(--background-primary)',
        }}
      >
        No room specified.
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--background-primary)',
      }}
    >
      <NativeCallView />
    </div>
  );
}
