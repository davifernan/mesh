import React from 'react';
import { createRoot } from 'react-dom/client';

const root = createRoot(document.getElementById('widget-root')!);
root.render(
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100vh', gap: 16, padding: 24,
    textAlign: 'center', fontFamily: 'system-ui, sans-serif', color: '#444' }}>
    <div style={{ fontSize: 32 }}>🖊️</div>
    <div style={{ fontWeight: 600, fontSize: 18 }}>Whiteboard Widget</div>
    <div style={{ maxWidth: 520, color: '#555', fontSize: 13, lineHeight: 1.7 }}>
      <p>This widget requires a self-hosted nordeck/matrix-neoboard-widget instance.</p>
      <p style={{ marginTop: 8 }}>Configure <code>whiteboardWidgetUrl</code> in <code>build.config.ts</code> to enable.</p>
      <p style={{ marginTop: 8 }}>Deploy with Docker:</p>
      <pre style={{ background: '#f5f5f5', padding: '10px 14px', borderRadius: 4, fontSize: 12, textAlign: 'left', marginTop: 8 }}>
        docker run --rm -p 3002:8080 ghcr.io/nordeck/matrix-neoboard-widget:latest
      </pre>
      <p style={{ marginTop: 8, color: '#777', fontSize: 12 }}>
        Note: Whiteboard requires a compatible Matrix homeserver and works best with
        Element Web or BetterCord clients.
      </p>
    </div>
  </div>
);
