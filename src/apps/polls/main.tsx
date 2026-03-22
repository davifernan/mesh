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
      <p style={{ marginTop: 8 }}>Set <code>MESH_POLLS_URL</code> in your <code>.env</code> file to enable.</p>
      <p style={{ marginTop: 8 }}>Start the service:</p>
      <pre style={{ background: '#f5f5f5', padding: '10px 14px', borderRadius: 4, fontSize: 12, textAlign: 'left', marginTop: 8 }}>
        docker compose --profile microapps up -d polls-widget
      </pre>
    </div>
  </div>
);
