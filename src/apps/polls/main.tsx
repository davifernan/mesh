import React from 'react';
import { createRoot } from 'react-dom/client';

const root = createRoot(document.getElementById('widget-root')!);
root.render(
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100vh', gap: 16, padding: 24,
    textAlign: 'center', fontFamily: 'system-ui, sans-serif', color: '#444' }}>
    <div style={{ fontSize: 32 }}>🗳️</div>
    <div style={{ fontWeight: 600, fontSize: 18 }}>Polls Widget</div>
    <div style={{ maxWidth: 520, color: '#555', fontSize: 13, lineHeight: 1.7 }}>
      <p>This widget requires a self-hosted nordeck/matrix-poll-widget instance.</p>
      <p style={{ marginTop: 8 }}>Configure <code>pollsWidgetUrl</code> in <code>build.config.ts</code> to enable.</p>
      <p style={{ marginTop: 8 }}>Deploy with Docker:</p>
      <pre style={{ background: '#f5f5f5', padding: '10px 14px', borderRadius: 4, fontSize: 12, textAlign: 'left', marginTop: 8 }}>
        docker run --rm -p 3001:8080 ghcr.io/nordeck/matrix-poll-widget:latest
      </pre>
    </div>
  </div>
);
