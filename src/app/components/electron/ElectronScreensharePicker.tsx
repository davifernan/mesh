import React, { useEffect, useState } from 'react';
import type { DesktopSource, DisplayMediaRequestInfo } from '../../../types/electron';

type Tab = 'screen' | 'window';

interface PendingRequest {
  requestId: string;
  info: DisplayMediaRequestInfo;
}

// ─── Shared inline styles ────────────────────────────────────────────────────

const S = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 10000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(6px)',
  },
  modal: {
    background: '#2b2d31',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.12)',
    width: 'min(780px, 92vw)',
    maxHeight: '82vh',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
    fontFamily: 'sans-serif',
  },
  header: {
    padding: '20px 24px 14px',
    fontSize: '18px',
    fontWeight: 700,
    color: '#f2f3f5',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  tabRow: {
    display: 'flex',
    gap: '4px',
    padding: '10px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    flexShrink: 0,
    background: '#232428',
  },
  tabActive: {
    padding: '6px 18px',
    borderRadius: '6px',
    border: 'none',
    background: '#404249',
    color: '#f2f3f5',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  tabInactive: {
    padding: '6px 18px',
    borderRadius: '6px',
    border: 'none',
    background: 'transparent',
    color: '#b5bac1',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
    padding: '16px 20px',
    overflowY: 'auto' as const,
    flex: 1,
    background: '#2b2d31',
  },
  cardNormal: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    padding: '10px',
    borderRadius: '8px',
    border: '2px solid transparent',
    background: '#1e1f22',
    cursor: 'pointer',
    textAlign: 'center' as const,
  },
  cardSelected: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    padding: '10px',
    borderRadius: '8px',
    border: '2px solid #5865f2',
    background: 'rgba(88,101,242,0.2)',
    cursor: 'pointer',
    textAlign: 'center' as const,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: '16/9',
    objectFit: 'cover' as const,
    borderRadius: '4px',
    background: '#111214',
    display: 'block',
  },
  sourceName: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#dbdee1',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  footer: {
    display: 'flex',
    gap: '8px',
    padding: '14px 20px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    flexShrink: 0,
    background: '#232428',
  },
  cancelBtn: {
    padding: '8px 20px',
    borderRadius: '4px',
    border: 'none',
    background: '#4e5058',
    color: '#f2f3f5',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  primaryBtn: {
    padding: '8px 20px',
    borderRadius: '4px',
    border: 'none',
    background: '#5865f2',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  primaryBtnDisabled: {
    padding: '8px 20px',
    borderRadius: '4px',
    border: 'none',
    background: '#5865f2',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'not-allowed',
    opacity: 0.35,
  },
};

// ─── Step 1: Source Picker ───────────────────────────────────────────────────

interface SourcePickerProps {
  sources: DesktopSource[];
  loading: boolean;
  tab: Tab;
  selected: string | null;
  onTabChange: (t: Tab) => void;
  onSelect: (id: string) => void;
  onCancel: () => void;
  onNext: (sourceId?: string) => void;
}

function SourcePicker({ sources, loading, tab, selected, onTabChange, onSelect, onCancel, onNext }: SourcePickerProps) {
  const visibleSources = sources.filter((s) =>
    tab === 'screen' ? s.id.startsWith('screen:') : !s.id.startsWith('screen:'),
  );

  return (
    <div style={S.modal} role="dialog" aria-modal="true">
      <div style={S.header}>Choose what to share</div>

      <div style={S.tabRow}>
        <button type="button" style={tab === 'screen' ? S.tabActive : S.tabInactive}
          onClick={() => onTabChange('screen')}>Screens</button>
        <button type="button" style={tab === 'window' ? S.tabActive : S.tabInactive}
          onClick={() => onTabChange('window')}>Windows</button>
      </div>

      <div style={S.grid}>
        {loading && (
          <span style={{ color: '#b5bac1', fontSize: '13px', gridColumn: '1/-1' }}>Loading sources…</span>
        )}
        {!loading && visibleSources.length === 0 && (
          <span style={{ color: '#b5bac1', fontSize: '13px', gridColumn: '1/-1' }}>
            No {tab === 'screen' ? 'screens' : 'windows'} found.
          </span>
        )}
        {visibleSources.map((source) => (
          <button key={source.id} type="button"
            style={selected === source.id ? S.cardSelected : S.cardNormal}
            onClick={() => onSelect(source.id)}
            onDoubleClick={() => onNext(source.id)}
          >
            <img style={S.thumbnail} src={source.thumbnailDataUrl} alt={source.name} draggable={false} />
            <span style={S.sourceName} title={source.name}>{source.name}</span>
          </button>
        ))}
      </div>

      <div style={S.footer}>
        <button type="button" style={S.cancelBtn} onClick={onCancel}>Cancel</button>
        <button type="button"
          style={selected ? S.primaryBtn : S.primaryBtnDisabled}
          onClick={() => onNext()} disabled={!selected}>
          Share now
        </button>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ElectronScreensharePicker() {
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [tab, setTab] = useState<Tab>('screen');
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const electron = window.electron;
    if (!electron?.onDisplayMediaRequested) return;

    const unsub = electron.onDisplayMediaRequested((requestId, info) => {
      setPending({ requestId, info });
      setSelected(null);
      setTab('screen');
      setSources([]);
      setLoading(true);

      electron
        .getDesktopSources(['screen', 'window'], requestId)
        .then((all) => setSources(all))
        .catch(() => setSources([]))
        .finally(() => setLoading(false));
    });

    return unsub;
  }, []);

  if (!pending) return null;

  const handleCancel = () => {
    window.electron?.selectDisplayMediaSource(pending.requestId, null, false);
    setPending(null);
  };

  const handleShare = (sourceId?: string) => {
    const resolvedSourceId = sourceId ?? selected;
    if (!resolvedSourceId) return;

    const withAudio = pending.info.audioRequested && (
      pending.info.supportsLoopbackAudio || pending.info.supportsSystemAudioCapture
    );

    window.electron?.selectDisplayMediaSource(pending.requestId, resolvedSourceId, withAudio);
    setPending(null);
  };

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && handleCancel()}>
      <SourcePicker
        sources={sources}
        loading={loading}
        tab={tab}
        selected={selected}
        onTabChange={(t) => { setTab(t); setSelected(null); }}
        onSelect={setSelected}
        onCancel={handleCancel}
        onNext={handleShare}
      />
    </div>
  );
}
