import React from 'react';
import { createRoot } from 'react-dom/client';
import { WidgetApi } from 'matrix-widget-api';
import { SpotifyApp } from './SpotifyApp';

const params = new URLSearchParams(window.location.search);
const widgetId = params.get('widgetId') ?? undefined;
const parentUrl = params.get('parentUrl') ?? undefined;

const widgetApi = new WidgetApi(widgetId, parentUrl);

widgetApi.requestCapabilityToReceiveState('eu.bettercord.apps.spotify');
widgetApi.requestCapabilityToSendState('eu.bettercord.apps.spotify');
widgetApi.requestCapabilityToReceiveState('m.room.power_levels');

widgetApi.start();

let rendered = false;

widgetApi.once('ready', () => {
  rendered = true;
  const root = createRoot(document.getElementById('widget-root')!);
  root.render(<SpotifyApp widgetApi={widgetApi} />);
});

// Fallback: if the Widget API hasn't started after 4s, show a helpful message.
// Two cases:
//   - window.parent === window: opened directly in browser, no Matrix host
//   - window.parent !== window: embedded as plain iframe (e.g. Element Web "Custom widget" UI)
//     but without the Matrix Widget API handshake (no parentUrl/widgetId params → ready never fires)
setTimeout(() => {
  if (rendered) return;
  const isInIframe = window.parent !== window;
  const hasParentUrl = !!parentUrl;
  const root = createRoot(document.getElementById('widget-root')!);
  root.render(
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', gap: 16, padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif',
      color: '#b3b3b3', background: '#121212',
    }}>
      <div style={{ fontSize: 48 }}>🎵</div>
      <div style={{ fontWeight: 700, fontSize: 20, color: '#1db954' }}>Spotify Together</div>
      {isInIframe && !hasParentUrl && (
        <div style={{ maxWidth: 520, color: '#c62828', lineHeight: 1.6, fontSize: 14 }}>
          The widget API is not active. This widget was embedded as a plain iframe — it must be
          registered as a room state event to work (see below).
        </div>
      )}
      <div style={{ maxWidth: 520, color: '#aaa', fontSize: 13, lineHeight: 1.7, textAlign: 'left' }}>
        <p style={{ marginBottom: 8 }}>
          Send the following state event in the room where you want the widget. Any Matrix client
          with developer tools works (Gomuks, Element Web, etc.).
        </p>
        <pre style={{
          background: '#1a1a1a', padding: '10px 14px', borderRadius: 4,
          fontSize: 12, overflowX: 'auto', margin: 0, color: '#e0e0e0',
        }}>{
`Event type:  im.vector.modular.widgets
State key:   eu.bettercord.apps.spotify
Content:
{
  "type": "m.custom",
  "url": "${window.location.origin + window.location.pathname}?widgetId=$matrix_widget_id&parentUrl=$matrix_client_origin",
  "name": "Spotify Together",
  "id": "eu.bettercord.apps.spotify"
}`
        }</pre>
        <p style={{ marginTop: 10, color: '#777' }}>
          <strong style={{ color: '#aaa' }}>Gomuks:</strong> open Developer Tools (⋮ menu → Developer tools),
          go to "Send custom event", set type to{' '}
          <code style={{ background: '#1a1a1a', padding: '1px 4px', borderRadius: 3 }}>im.vector.modular.widgets</code>,
          state key to{' '}
          <code style={{ background: '#1a1a1a', padding: '1px 4px', borderRadius: 3 }}>eu.bettercord.apps.spotify</code>,
          paste the content above.
        </p>
        <p style={{ marginTop: 6, color: '#777' }}>
          <strong style={{ color: '#aaa' }}>Element Web:</strong> use the{' '}
          <code style={{ background: '#1a1a1a', padding: '1px 4px', borderRadius: 3 }}>/addwidget</code>{' '}
          slash command in the room chat:
        </p>
        <pre style={{
          background: '#1a1a1a', padding: '6px 14px', borderRadius: 4,
          fontSize: 12, overflowX: 'auto', margin: '4px 0', color: '#e0e0e0',
        }}>{
          `/addwidget ${window.location.origin + window.location.pathname}?widgetId=$matrix_widget_id&parentUrl=$matrix_client_origin`
        }</pre>
      </div>
    </div>
  );
}, 4000);
