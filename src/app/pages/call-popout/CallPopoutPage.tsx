/**
 * CallPopoutPage.tsx — #81
 *
 * Minimal page for the /popout route, opened via window.open() in Electron.
 * Electron's setWindowOpenHandler (desktop/src/main/Window.tsx) allows new
 * BrowserWindows when frameName starts with 'bettercord_' and pathname === '/popout'.
 *
 * The page reads ?room=<roomId> from the URL, and renders NativeCallView
 * inside its own CallProvider — no sidebar, no shell.
 *
 * Usage (from NativeCallControlBar — Electron only):
 *   window.open(`${origin}/popout?room=${roomId}`, `bettercord_call_${roomId}`, 'width=960,height=640');
 */

import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CallProvider, useCallState } from '../client/call/CallProvider';
import { NativeCallView } from '../client/call/NativeCallView';

function PopoutInner() {
  const [params] = useSearchParams();
  const roomId = params.get('room') ?? null;
  const { setActiveCallRoomId } = useCallState();

  useEffect(() => {
    if (roomId) setActiveCallRoomId(roomId);
    return () => setActiveCallRoomId(null);
  }, [roomId, setActiveCallRoomId]);

  if (!roomId) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: '#949ba4',
          fontFamily: 'sans-serif',
        }}
      >
        Kein Raum angegeben. Bitte dieses Fenster schließen.
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#111214', overflow: 'hidden' }}>
      <NativeCallView />
    </div>
  );
}

export function CallPopoutPage() {
  return (
    <CallProvider>
      <PopoutInner />
    </CallProvider>
  );
}
