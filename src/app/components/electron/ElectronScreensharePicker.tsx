import React, { useEffect, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { settingsAtom, Settings } from '../../state/settings';
import { effectiveAVSettingsAtom } from '../../state/avQuality';
import type { DesktopSource, DisplayMediaRequestInfo } from '../../../types/electron';

type Tab = 'screen' | 'window';
type SSResolution = Settings['ssResolution'];
type SSFps = Settings['ssFps'];

interface PendingRequest {
  requestId: string;
  info: DisplayMediaRequestInfo;
}

const SS_RESOLUTIONS: SSResolution[] = ['720p', '1080p', '1440p', '4k', 'source'];
const SS_FPS: SSFps[] = [5, 15, 30, 60, 120];
const SS_RESOLUTION_ORDER = ['720p', '1080p', '1440p', '4k', 'source'];

function isResolutionAllowed(res: SSResolution, maxRes: string): boolean {
  const resIdx = SS_RESOLUTION_ORDER.indexOf(res);
  const maxIdx = SS_RESOLUTION_ORDER.indexOf(maxRes);
  if (resIdx === -1 || maxIdx === -1) return true;
  return resIdx <= maxIdx;
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
  audioToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#b5bac1',
    marginRight: 'auto',
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  // Quality step
  qualityBody: {
    padding: '20px 24px',
    overflowY: 'auto' as const,
    flex: 1,
    background: '#2b2d31',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#b5bac1',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  chipRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  chipActive: {
    padding: '6px 16px',
    borderRadius: '6px',
    border: '2px solid #5865f2',
    background: 'rgba(88,101,242,0.2)',
    color: '#f2f3f5',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  chipInactive: {
    padding: '6px 16px',
    borderRadius: '6px',
    border: '2px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: '#b5bac1',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  chipDisabled: {
    padding: '6px 16px',
    borderRadius: '6px',
    border: '2px solid rgba(255,255,255,0.05)',
    background: 'transparent',
    color: '#4e5058',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderRadius: '8px',
    background: '#1e1f22',
  },
  toggleLabel: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#dbdee1',
  },
  infoRow: {
    fontSize: '12px',
    color: '#b5bac1',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '6px',
    padding: '8px 12px',
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
  onNext: () => void;
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
            onDoubleClick={() => { onSelect(source.id); onNext(); }}
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
          onClick={onNext} disabled={!selected}>
          Next →
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Quality Picker ──────────────────────────────────────────────────

interface QualityPickerProps {
  supportsAudio: boolean;
  onBack: () => void;
  onCancel: () => void;
  onShare: (res: SSResolution, fps: SSFps, audio: boolean) => void;
}

function QualityPicker({ supportsAudio, onBack, onCancel, onShare }: QualityPickerProps) {
  const settings = useAtomValue(settingsAtom);
  const setSettings = useSetAtom(settingsAtom);
  const effective = useAtomValue(effectiveAVSettingsAtom);

  const [ssResolution, setSsResolution] = useState<SSResolution>(effective.ssResolution);
  const [ssFps, setSsFps] = useState<SSFps>(effective.ssFps as SSFps);
  const [ssAudio, setSsAudio] = useState<boolean>(settings.ssAudio);

  const serverMaxRes = effective.serverMaxSSResolution;
  const serverMaxFps = effective.serverMaxSSFps;

  const handleShare = () => {
    setSettings({ ...settings, ssResolution, ssFps, ssAudio });
    onShare(ssResolution, ssFps, ssAudio);
  };

  return (
    <div style={S.modal} role="dialog" aria-modal="true">
      <div style={S.header}>Quality settings</div>

      <div style={S.qualityBody}>
        <div style={S.section}>
          <div style={S.sectionLabel}>Resolution</div>
          <div style={S.chipRow}>
            {SS_RESOLUTIONS.map((res) => {
              const allowed = isResolutionAllowed(res, serverMaxRes);
              const active = ssResolution === res;
              return (
                <button key={res} type="button"
                  style={!allowed ? S.chipDisabled : active ? S.chipActive : S.chipInactive}
                  onClick={() => allowed && setSsResolution(res)}
                  disabled={!allowed}>
                  {res === 'source' ? 'Source' : res}
                </button>
              );
            })}
          </div>
        </div>

        <div style={S.section}>
          <div style={S.sectionLabel}>Framerate</div>
          <div style={S.chipRow}>
            {SS_FPS.map((fps) => {
              const allowed = fps <= serverMaxFps;
              const active = ssFps === fps;
              return (
                <button key={fps} type="button"
                  style={!allowed ? S.chipDisabled : active ? S.chipActive : S.chipInactive}
                  onClick={() => allowed && setSsFps(fps)}
                  disabled={!allowed}>
                  {fps} fps
                </button>
              );
            })}
          </div>
        </div>

        {supportsAudio && (
          <div style={S.section}>
            <div style={S.toggleRow}>
              <span style={S.toggleLabel}>Share system audio</span>
              <input type="checkbox" checked={ssAudio}
                onChange={(e) => setSsAudio(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer' }} />
            </div>
          </div>
        )}

        {(serverMaxRes !== 'source' || serverMaxFps < 120) && (
          <div style={S.infoRow}>
            ℹ Max allowed by space admin: {serverMaxRes === 'source' ? 'Source' : serverMaxRes} / {serverMaxFps} fps
          </div>
        )}
      </div>

      <div style={S.footer}>
        <button type="button" style={{ ...S.cancelBtn, marginRight: 'auto' }} onClick={onBack}>← Back</button>
        <button type="button" style={S.cancelBtn} onClick={onCancel}>Cancel</button>
        <button type="button" style={S.primaryBtn} onClick={handleShare}>Share now</button>
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
  const [step, setStep] = useState<'source' | 'quality'>('source');
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => {
    const electron = window.electron;
    if (!electron?.onDisplayMediaRequested) return;

    const unsub = electron.onDisplayMediaRequested((requestId, info) => {
      requestIdRef.current = requestId;
      setPending({ requestId, info });
      setSelected(null);
      setTab('screen');
      setStep('source');
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

  const handleShare = (_res: SSResolution, _fps: SSFps, audio: boolean) => {
    if (!selected) return;
    window.electron?.selectDisplayMediaSource(pending.requestId, selected, audio);
    setPending(null);
  };

  const supportsAudio = pending.info.supportsLoopbackAudio || pending.info.supportsSystemAudioCapture;

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && handleCancel()}>
      {step === 'source' ? (
        <SourcePicker
          sources={sources}
          loading={loading}
          tab={tab}
          selected={selected}
          onTabChange={(t) => { setTab(t); setSelected(null); }}
          onSelect={setSelected}
          onCancel={handleCancel}
          onNext={() => setStep('quality')}
        />
      ) : (
        <QualityPicker
          supportsAudio={supportsAudio}
          onBack={() => setStep('source')}
          onCancel={handleCancel}
          onShare={handleShare}
        />
      )}
    </div>
  );
}
