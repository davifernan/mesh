// React 18 erfordert IS_REACT_ACT_ENVIRONMENT=true damit act() keine Warnungen
// schreibt. Das muss vor allen anderen Importen gesetzt werden.
// @ts-ignore
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * bridgePresence.test.ts
 *
 * Drei Testgruppen:
 *   1. resolvePresence() — pure Logik (keine React-Abhaengigkeit)
 *   2. BridgePresenceProvider — Connection Pool via Context-Direktzugriff
 *   3. REST Bootstrap — fetch-Mocking
 *
 * Kein @testing-library/react installiert → Gruppen 2+3 testen den Provider
 * durch direkten Aufruf der exportierten Logik-Bausteine via BridgePresenceContext
 * und eigenem Mini-React-Render (react-dom/client + act).
 *
 * Alle schweren Nicht-Pure-Module werden via vi.mock() weggemockt, damit
 * vanilla-extract / matrix-js-sdk / livekit-client nicht im Test-Kontext
 * initialisiert werden.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Mocks MUESSEN vor allen Importen stehen (Vitest hoisted)
// ─────────────────────────────────────────────────────────────────────────────

import { vi } from 'vitest';

// Alle vanilla-extract CSS-Module wegmocken
vi.mock('../app/components/nav/styles.css.ts', () => ({}));
vi.mock('../app/components/nav/NavCategory.tsx', () => ({ NavCategory: () => null }));

// Alle Module die transitive Imports von vanilla-extract / livekit / matrix haben
vi.mock('folds', () => ({
  Avatar: () => null,
  Badge: () => null,
  Box: () => null,
  Icon: () => null,
  Icons: {},
  Text: () => null,
}));
vi.mock('matrix-js-sdk', () => ({ Room: class Room {} }));
vi.mock('livekit-client', () => ({ Track: { Source: { ScreenShare: 'screen_share' } } }));
vi.mock('@phosphor-icons/react', () => ({
  MicrophoneSlash: () => null,
  SpeakerSlash: () => null,
  VideoCamera: () => null,
}));
vi.mock('../app/components/nav', () => ({
  NavButton: () => null,
  NavItem: () => null,
  NavItemContent: () => null,
}));
vi.mock('../app/components/user-avatar', () => ({ UserAvatar: () => null }));
vi.mock('../app/hooks/useMatrixClient', () => ({ useMatrixClient: () => ({}) }));
vi.mock('../app/hooks/useCallMemberPresence', () => ({
  roomHasCallScreenShare: () => false,
}));
vi.mock('../app/pages/client/call/CallProvider', () => ({
  useCallState: () => ({
    activeCallRoomId: null,
    setActiveCallRoomId: () => {},
    speakingUsers: new Set(),
    remoteParticipantStates: new Map(),
    isAudioEnabled: true,
    isVideoEnabled: false,
    isDeafened: false,
    isScreenShareEnabled: false,
    livekitRoom: null,
    callStatus: 'idle',
  }),
}));
vi.mock('../app/features/call/participantIdentity', () => ({
  resolveParticipantUserId: () => '',
}));
vi.mock('../app/features/call/presenceBadges', () => ({
  getPresenceBadgeKinds: () => [],
  getPresenceSummary: () => '',
  PRESENCE_BADGE_LABEL: { camera: '', deafened: '', muted: '' },
}));
vi.mock('../app/utils/matrix', () => ({ getMxIdLocalPart: (id: string) => id }));
vi.mock('../app/utils/room', () => ({
  getMemberAvatarMxc: () => null,
  getMemberDisplayName: () => 'User',
}));
vi.mock('../app/hooks/useMediaAuthentication', () => ({ useMediaAuthentication: () => false }));
vi.mock('../app/state/hooks/userRoomProfile', () => ({ useOpenUserRoomProfile: () => () => {} }));
vi.mock('../app/hooks/useSpace', () => ({ useSpaceOptionally: () => null }));
vi.mock('../app/features/room-nav/RoomNavUser.module.css', () => ({}));

// ─────────────────────────────────────────────────────────────────────────────
// Echte Imports NACH den Mocks
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolvePresence } from '../app/features/room-nav/RoomNavUser';
import type { ResolvePresenceArgs } from '../app/features/room-nav/RoomNavUser';
import type { CallPresenceState } from '../app/features/call/callPresenceState';
import { EMPTY_CALL_PRESENCE_STATE } from '../app/features/call/callPresenceState';

// ─────────────────────────────────────────────────────────────────────────────
// Gruppe 1: resolvePresence() — pure Logik
// ─────────────────────────────────────────────────────────────────────────────

describe('resolvePresence', () => {
  const basePresence: CallPresenceState = {
    isMicMuted: false,
    isCameraOn: false,
    isScreenSharing: false,
    isDeafened: false,
  };

  const baseArgs: ResolvePresenceArgs = {
    isLocalUser: false,
    isActiveCall: false,
    pState: undefined,
    remoteBridge: undefined,
    isAudioEnabled: true,
    isVideoEnabled: false,
    isCallDeafened: false,
    isScreenShareEnabled: false,
  };

  // ── Remote, kein Call, kein Bridge → all-false (no Matrix-state fallback) ──

  it('remote user not in call, no bridge: returns all-false', () => {
    const result = resolvePresence(baseArgs);
    expect(result).toEqual({ isMicMuted: false, isCameraOn: false, isScreenSharing: false, isDeafened: false });
  });

  it('remote user not in call, no bridge: isMicMuted=false (no Matrix-state fallback)', () => {
    const result = resolvePresence(baseArgs);
    expect(result.isMicMuted).toBe(false);
    expect(result.isCameraOn).toBe(false);
  });

  it('remote user not in call, no bridge: isCameraOn=false (no Matrix-state fallback)', () => {
    const result = resolvePresence(baseArgs);
    expect(result.isCameraOn).toBe(false);
  });

  // ── Remote, mit Bridge ──────────────────────────────────────────────────

  it('remote user with bridge muted: returns isMicMuted=true (bridge=true)', () => {
    const result = resolvePresence({
      ...baseArgs,
      remoteBridge: { isMicMuted: true, isCameraOn: false, isScreenSharing: false, isDeafened: false },
    });
    expect(result.isMicMuted).toBe(true);
  });

  it('remote user bridge isMicMuted=false: returns false', () => {
    const result = resolvePresence({
      ...baseArgs,
      remoteBridge: { isMicMuted: false, isCameraOn: false, isScreenSharing: false, isDeafened: false },
    });
    expect(result.isMicMuted).toBe(false);
  });

  it('remote user with bridge: both false → isMicMuted=false', () => {
    const result = resolvePresence({
      ...baseArgs,
      remoteBridge: { isMicMuted: false, isCameraOn: false, isScreenSharing: false, isDeafened: false },
    });
    expect(result.isMicMuted).toBe(false);
  });

  it('remote user with bridge cameraOn=true: returns isCameraOn=true', () => {
    const result = resolvePresence({
      ...baseArgs,
      remoteBridge: { isMicMuted: false, isCameraOn: true, isScreenSharing: false, isDeafened: false },
    });
    expect(result.isCameraOn).toBe(true);
  });

  it('remote user bridge cameraOn=false: returns false', () => {
    const result = resolvePresence({
      ...baseArgs,
      remoteBridge: { isMicMuted: false, isCameraOn: false, isScreenSharing: false, isDeafened: false },
    });
    expect(result.isCameraOn).toBe(false);
  });

  // ── Remote, mit pState (lokaler Client im selben Call) ──────────────────

  it('remote user with pState: pState takes priority over bridge for micMuted', () => {
    // pState sagt audioEnabled=true (nicht muted) — bridge sagt muted
    const result = resolvePresence({
      ...baseArgs,
      isActiveCall: true,
      pState: { audioEnabled: true, videoEnabled: false, isScreenSharing: false },
      remoteBridge: { isMicMuted: true, isCameraOn: false, isScreenSharing: false, isDeafened: false },
    });
    // pState hat Vorrang: audioEnabled=true → isMicMuted=false
    expect(result.isMicMuted).toBe(false);
  });

  it('remote user with pState audioEnabled=false: isMicMuted=true (pState priority)', () => {
    const result = resolvePresence({
      ...baseArgs,
      isActiveCall: true,
      pState: { audioEnabled: false, videoEnabled: false, isScreenSharing: false },
    });
    expect(result.isMicMuted).toBe(true);
  });

  it('remote user with pState videoEnabled=true: isCameraOn=true (pState priority)', () => {
    const result = resolvePresence({
      ...baseArgs,
      isActiveCall: true,
      pState: { audioEnabled: true, videoEnabled: true, isScreenSharing: false },
    });
    expect(result.isCameraOn).toBe(true);
  });

  it('remote user with pState: pState screenSharing=false wins over bridge', () => {
    const result = resolvePresence({
      ...baseArgs,
      isActiveCall: true,
      pState: { audioEnabled: true, videoEnabled: false, isScreenSharing: false },
      remoteBridge: { isMicMuted: false, isCameraOn: false, isScreenSharing: true, isDeafened: false },
    });
    expect(result.isScreenSharing).toBe(false);
  });

  it('remote user with pState: pState screenSharing=true → isScreenSharing=true', () => {
    const result = resolvePresence({
      ...baseArgs,
      isActiveCall: true,
      pState: { audioEnabled: true, videoEnabled: false, isScreenSharing: true },
    });
    expect(result.isScreenSharing).toBe(true);
  });

  it('remote user with pState: both screenSharing false → false', () => {
    const result = resolvePresence({
      ...baseArgs,
      isActiveCall: true,
      pState: { audioEnabled: true, videoEnabled: false, isScreenSharing: false },
    });
    expect(result.isScreenSharing).toBe(false);
  });

  // ── Lokaler User, im aktiven Call ────────────────────────────────────────

  it('local user in active call: isMicMuted = !isAudioEnabled (muted)', () => {
    const result = resolvePresence({
      ...baseArgs,
      isLocalUser: true,
      isActiveCall: true,
      isAudioEnabled: false,
    });
    expect(result.isMicMuted).toBe(true);
  });

  it('local user in active call: isMicMuted=false when isAudioEnabled=true', () => {
    const result = resolvePresence({
      ...baseArgs,
      isLocalUser: true,
      isActiveCall: true,
      isAudioEnabled: true,
    });
    expect(result.isMicMuted).toBe(false);
  });

  it('local user in active call: isCameraOn = isVideoEnabled (true)', () => {
    const result = resolvePresence({
      ...baseArgs,
      isLocalUser: true,
      isActiveCall: true,
      isVideoEnabled: true,
    });
    expect(result.isCameraOn).toBe(true);
  });

  it('local user in active call: isCameraOn=false when isVideoEnabled=false', () => {
    const result = resolvePresence({
      ...baseArgs,
      isLocalUser: true,
      isActiveCall: true,
      isVideoEnabled: false,
    });
    expect(result.isCameraOn).toBe(false);
  });

  it('local user in active call: isDeafened = isCallDeafened (true)', () => {
    const result = resolvePresence({
      ...baseArgs,
      isLocalUser: true,
      isActiveCall: true,
      isCallDeafened: true,
    });
    expect(result.isDeafened).toBe(true);
  });

  it('local user in active call: isDeafened=false when isCallDeafened=false', () => {
    const result = resolvePresence({
      ...baseArgs,
      isLocalUser: true,
      isActiveCall: true,
      isCallDeafened: false,
    });
    expect(result.isDeafened).toBe(false);
  });

  it('local user in active call: screenshare = isScreenShareEnabled OR persisted (enabled)', () => {
    const result = resolvePresence({
      ...baseArgs,
      isLocalUser: true,
      isActiveCall: true,
      isScreenShareEnabled: true,
    });
    expect(result.isScreenSharing).toBe(true);
  });

  it('local user in active call: screenshare=false when isScreenShareEnabled=false', () => {
    const result = resolvePresence({
      ...baseArgs,
      isLocalUser: true,
      isActiveCall: true,
      isScreenShareEnabled: false,
    });
    expect(result.isScreenSharing).toBe(false);
  });

  it('local user in active call: screenshare=false when both false', () => {
    const result = resolvePresence({
      ...baseArgs,
      isLocalUser: true,
      isActiveCall: true,
      isScreenShareEnabled: false,
    });
    expect(result.isScreenSharing).toBe(false);
  });

  // ── Lokaler User, nicht im Call ──────────────────────────────────────────

  it('local user not in call: returns all-false (no Matrix-state fallback)', () => {
    const result = resolvePresence({
      ...baseArgs,
      isLocalUser: true,
      isActiveCall: false,
    });
    expect(result).toEqual({ isMicMuted: false, isCameraOn: false, isScreenSharing: false, isDeafened: false });
  });

  it('local user not in call: ignores isAudioEnabled/isVideoEnabled', () => {
    const result = resolvePresence({
      ...baseArgs,
      isLocalUser: true,
      isActiveCall: false,
      isAudioEnabled: false,  // ignoriert weil nicht im Call
      isVideoEnabled: true,   // ignoriert weil nicht im Call
    });
    expect(result.isMicMuted).toBe(false);
    expect(result.isCameraOn).toBe(false);
  });

  it('local user not in call: screenshare=false regardless of isScreenShareEnabled', () => {
    const r1 = resolvePresence({
      ...baseArgs,
      isLocalUser: true,
      isActiveCall: false,
      isScreenShareEnabled: true,  // ignoriert weil nicht im Call
    });
    expect(r1.isScreenSharing).toBe(false);

    const r2 = resolvePresence({
      ...baseArgs,
      isLocalUser: true,
      isActiveCall: false,
      isScreenShareEnabled: false,
    });
    expect(r2.isScreenSharing).toBe(false);
  });

  // ── isDeafened Bridge vs persisted Prioritaet ────────────────────────────

  it('remote user: deafen bridge=true → true', () => {
    const result = resolvePresence({
      ...baseArgs,
      remoteBridge: { isMicMuted: false, isCameraOn: false, isScreenSharing: false, isDeafened: true },
    });
    expect(result.isDeafened).toBe(true);
  });

  it('remote user bridge deafen=false → false', () => {
    const result = resolvePresence({
      ...baseArgs,
      remoteBridge: { isMicMuted: false, isCameraOn: false, isScreenSharing: false, isDeafened: false },
    });
    expect(result.isDeafened).toBe(false);
  });

  it('remote user: deafen bridge=false → false', () => {
    const result = resolvePresence({
      ...baseArgs,
      remoteBridge: { isMicMuted: false, isCameraOn: false, isScreenSharing: false, isDeafened: false },
    });
    expect(result.isDeafened).toBe(false);
  });

  it('remote user without bridge: deafen=false (no Matrix-state fallback)', () => {
    const result = resolvePresence({
      ...baseArgs,
      remoteBridge: undefined,
    });
    expect(result.isDeafened).toBe(false);
  });

  it('remote user without bridge: deafen=false from all-false default', () => {
    const result = resolvePresence({ ...baseArgs });
    expect(result.isDeafened).toBe(false);
  });

  // ── isScreenSharing kombiniert fuer Remote ohne pState ──────────────────

  it('remote user with bridge screenSharing=true: isScreenSharing=true', () => {
    const result = resolvePresence({
      ...baseArgs,
      remoteBridge: { isMicMuted: false, isCameraOn: false, isScreenSharing: true, isDeafened: false },
    });
    expect(result.isScreenSharing).toBe(true);
  });

  it('remote user bridge screenSharing=false: isScreenSharing=false', () => {
    const result = resolvePresence({
      ...baseArgs,
      remoteBridge: { isMicMuted: false, isCameraOn: false, isScreenSharing: false, isDeafened: false },
    });
    expect(result.isScreenSharing).toBe(false);
  });

  it('remote user no bridge, no pState: screenSharing=false (no Matrix-state fallback)', () => {
    const result = resolvePresence({ ...baseArgs });
    expect(result.isScreenSharing).toBe(false);
  });

  it('remote user no bridge, no pState: screenSharing=false always', () => {
    const result = resolvePresence({ ...baseArgs });
    expect(result.isScreenSharing).toBe(false);
  });

  // ── Vollstaendige State-Objekte ──────────────────────────────────────────

  it('returns exactly the four expected keys (no extras)', () => {
    const result = resolvePresence(baseArgs);
    expect(Object.keys(result).sort()).toEqual(
      ['isCameraOn', 'isDeafened', 'isMicMuted', 'isScreenSharing'].sort()
    );
  });

  it('result is a plain object (not the same reference as the baseline object)', () => {
    const result = resolvePresence(baseArgs);
    expect(result).not.toBe(basePresence);
  });

  it('all false inputs → all false outputs', () => {
    const result = resolvePresence(baseArgs);
    expect(result.isMicMuted).toBe(false);
    expect(result.isCameraOn).toBe(false);
    expect(result.isScreenSharing).toBe(false);
    expect(result.isDeafened).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helfer: MockEventSource fuer Gruppen 2 + 3
// ─────────────────────────────────────────────────────────────────────────────

class MockEventSource {
  static instances: MockEventSource[] = [];

  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  /** Simuliert eine eingehende SSE-Nachricht. */
  emit(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helfer: BridgePresenceProvider mounten (kein @testing-library/react)
//
// Wir rendern den Provider in ein happy-dom-div und lesen den Context ueber
// einen eigenen Consumer-Komponenten aus. React's `act` aus react 18 stellt
// sicher, dass State-Updates synchron geflusht werden.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { createRoot } from 'react-dom/client';
import { BridgePresenceContext } from '../app/features/call/BridgePresenceContext';
import { BridgePresenceProvider } from '../app/features/call/BridgePresenceProvider';
import type { BridgePresenceContextValue } from '../app/features/call/BridgePresenceContext';
import { ClientConfigProvider } from '../app/hooks/useClientConfig';

// Minimale ClientConfig für Tests — BridgePresenceProvider braucht useClientConfig()
const TEST_CLIENT_CONFIG = {};

async function captureContextWithoutProvider(): Promise<BridgePresenceContextValue> {
  const { act } = await import('react-dom/test-utils');
  let capturedCtx!: BridgePresenceContextValue;

  function Consumer() {
    capturedCtx = React.useContext(BridgePresenceContext);
    return null;
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(Consumer));
  });

  act(() => {
    root.unmount();
  });
  container.remove();

  return capturedCtx;
}

describe('BridgePresenceContext defaults', () => {
  it('returns stable no-op defaults when provider is missing', async () => {
    const ctx = await captureContextWithoutProvider();
    const cleanupSSE = ctx.subscribeSSE('!room:server');
    const cleanupUpdates = ctx.subscribeToUpdates('!room:server', () => {});
    const snapshotA = ctx.getSnapshot('!room:server');
    const snapshotB = ctx.getSnapshot('!room:server');

    expect(typeof cleanupSSE).toBe('function');
    expect(typeof cleanupUpdates).toBe('function');
    expect(snapshotA).toBe(snapshotB);

    cleanupSSE();
    cleanupUpdates();
  });
});

/**
 * Mountet BridgePresenceProvider in ein frisches div.
 * Gibt den Context-Wert sowie ein unmount-Handle zurueck.
 */
async function mountProvider(): Promise<{
  ctx: BridgePresenceContextValue;
  unmount: () => void;
}>;
async function mountProvider(configOverride: Record<string, unknown>): Promise<{
  ctx: BridgePresenceContextValue;
  unmount: () => void;
}>;
async function mountProvider(configOverride?: Record<string, unknown>): Promise<{
  ctx: BridgePresenceContextValue;
  unmount: () => void;
}> {
  // In React 18 lebt `act` in react-dom/test-utils, nicht als named export von 'react'
  const { act } = await import('react-dom/test-utils');

  let capturedCtx!: BridgePresenceContextValue;

  function Consumer() {
    capturedCtx = React.useContext(BridgePresenceContext);
    return null;
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      React.createElement(ClientConfigProvider, { value: { ...TEST_CLIENT_CONFIG, ...configOverride } },
        React.createElement(BridgePresenceProvider, null,
          React.createElement(Consumer)
        )
      )
    );
  });

  return {
    ctx: capturedCtx,
    unmount: () => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      act(() => { root.unmount(); });
      container.remove();
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Gruppe 2: BridgePresenceProvider — Connection Pool
// ─────────────────────────────────────────────────────────────────────────────

describe('BridgePresenceProvider — Connection Pool', () => {
  beforeEach(() => {
    vi.stubGlobal('EventSource', MockEventSource);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }));
    MockEventSource.reset();
  });

  afterEach(() => {
    MockEventSource.reset();
    vi.unstubAllGlobals();
  });

  it('oeffnet keine SSE-Verbindung ohne subscribeSSE-Aufruf', async () => {
    const { unmount } = await mountProvider();
    expect(MockEventSource.instances).toHaveLength(0);
    unmount();
  });

  it('oeffnet genau eine SSE-Verbindung beim ersten subscribeSSE(roomId)', async () => {
    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();

    let cleanup!: () => void;
    await act(async () => {
      cleanup = ctx.subscribeSSE('!room1:server');
    });

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain('room1');

    cleanup();
    unmount();
  });

  it('oeffnet keine zweite Verbindung bei zweitem subscribeSSE(roomId)', async () => {
    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();

    let cleanup1!: () => void;
    let cleanup2!: () => void;

    await act(async () => {
      cleanup1 = ctx.subscribeSSE('!room1:server');
      cleanup2 = ctx.subscribeSSE('!room1:server');
    });

    expect(MockEventSource.instances).toHaveLength(1);

    cleanup1();
    cleanup2();
    unmount();
  });

  it('oeffnet separate Verbindungen fuer verschiedene roomIds', async () => {
    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();

    let cleanup1!: () => void;
    let cleanup2!: () => void;

    await act(async () => {
      cleanup1 = ctx.subscribeSSE('!room1:server');
      cleanup2 = ctx.subscribeSSE('!room2:server');
    });

    expect(MockEventSource.instances).toHaveLength(2);
    const urls = MockEventSource.instances.map((es) => es.url);
    expect(urls.some((u) => u.includes('room1'))).toBe(true);
    expect(urls.some((u) => u.includes('room2'))).toBe(true);

    cleanup1();
    cleanup2();
    unmount();
  });

  it('schliesst SSE nach letztem cleanup', async () => {
    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();

    let cleanup!: () => void;
    await act(async () => {
      cleanup = ctx.subscribeSSE('!room1:server');
    });

    const es = MockEventSource.instances[0];
    expect(es.closed).toBe(false);

    await act(async () => { cleanup(); });

    expect(es.closed).toBe(true);
    unmount();
  });

  it('plant keinen Reconnect mehr wenn subscriberCount vor onerror bereits 0 ist', async () => {
    vi.useFakeTimers();
    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();

    let cleanup!: () => void;
    await act(async () => {
      cleanup = ctx.subscribeSSE('!room1:server');
    });

    const es = MockEventSource.instances[0];

    await act(async () => {
      cleanup();
    });

    es.onerror?.();
    vi.advanceTimersByTime(30_000);

    expect(MockEventSource.instances).toHaveLength(1);

    vi.useRealTimers();
    unmount();
  });

  it('reconnects with exponential backoff while subscribers remain', async () => {
    vi.useFakeTimers();
    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();

    await act(async () => {
      ctx.subscribeSSE('!room1:server');
    });

    const first = MockEventSource.instances[0];
    first.onerror?.();
    expect(MockEventSource.instances).toHaveLength(1);

    vi.advanceTimersByTime(999);
    expect(MockEventSource.instances).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(MockEventSource.instances).toHaveLength(2);

    const second = MockEventSource.instances[1];
    second.onerror?.();

    vi.advanceTimersByTime(1_999);
    expect(MockEventSource.instances).toHaveLength(2);

    vi.advanceTimersByTime(1);
    expect(MockEventSource.instances).toHaveLength(3);

    vi.useRealTimers();
    unmount();
  });

  it('schliesst SSE erst wenn ALLE cleanups aufgerufen wurden (ref-counting)', async () => {
    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();

    let cleanup1!: () => void;
    let cleanup2!: () => void;

    await act(async () => {
      cleanup1 = ctx.subscribeSSE('!room1:server');
      cleanup2 = ctx.subscribeSSE('!room1:server');
    });

    const es = MockEventSource.instances[0];

    await act(async () => { cleanup1(); });
    // Erster cleanup → noch ein Subscriber → SSE bleibt offen
    expect(es.closed).toBe(false);

    await act(async () => { cleanup2(); });
    // Zweiter cleanup → kein Subscriber mehr → SSE geschlossen
    expect(es.closed).toBe(true);
    unmount();
  });

  it('behaelt presence-Cache nach letztem cleanup', async () => {
    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();

    let cleanup!: () => void;
    await act(async () => {
      cleanup = ctx.subscribeSSE('!room1:server');
    });

    const es = MockEventSource.instances[0];

    // Simuliert ein SSE-Update
    await act(async () => {
      es.emit({
        type: 'update',
        userId: 'user1',
        isMicMuted: true,
        isCameraOn: false,
        isScreenSharing: false,
        isDeafened: false,
        updatedAt: 1000,
      });
    });

    // Snapshot vor cleanup
    expect(ctx.getSnapshot('!room1:server').has('user1')).toBe(true);

    await act(async () => { cleanup(); });

    // Snapshot nach cleanup — Cache bleibt erhalten
    const snapshotAfter = ctx.getSnapshot('!room1:server');
    expect(snapshotAfter.has('user1')).toBe(true);
    expect(snapshotAfter.get('user1')?.isMicMuted).toBe(true);

    unmount();
  });

  it('getSnapshot gibt leere Map zurueck fuer unbekannte roomId', async () => {
    const { ctx, unmount } = await mountProvider();
    const snapshot = ctx.getSnapshot('!unknown:server');
    expect(snapshot).toBeDefined();
    expect(snapshot.size).toBe(0);
    unmount();
  });

  it('notifiziert listener nach SSE-Update', async () => {
    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();
    const roomId = '!room1:server';

    await act(async () => { ctx.subscribeSSE(roomId); });

    const listener = vi.fn();
    ctx.subscribeToUpdates(roomId, listener);

    const es = MockEventSource.instances[0];

    await act(async () => {
      es.emit({
        type: 'update',
        userId: 'user1',
        isMicMuted: false,
        isCameraOn: true,
        isScreenSharing: false,
        isDeafened: false,
        updatedAt: 2000,
      });
    });

    expect(listener).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('notifiziert listener mehrfach bei mehreren SSE-Events', async () => {
    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();
    const roomId = '!room1:server';

    await act(async () => { ctx.subscribeSSE(roomId); });

    const listener = vi.fn();
    ctx.subscribeToUpdates(roomId, listener);
    const es = MockEventSource.instances[0];

    await act(async () => {
      es.emit({ type: 'update', userId: 'user1', isMicMuted: false, isCameraOn: false, isScreenSharing: false, isDeafened: false, updatedAt: 1 });
      es.emit({ type: 'update', userId: 'user2', isMicMuted: true, isCameraOn: false, isScreenSharing: false, isDeafened: false, updatedAt: 2 });
    });

    expect(listener).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('entfernt userId aus snapshot bei type=left', async () => {
    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();
    const roomId = '!room1:server';

    await act(async () => { ctx.subscribeSSE(roomId); });

    const es = MockEventSource.instances[0];

    // Erst update, dann left
    await act(async () => {
      es.emit({
        type: 'update',
        userId: 'user1',
        isMicMuted: false,
        isCameraOn: false,
        isScreenSharing: false,
        isDeafened: false,
        updatedAt: 100,
      });
    });

    expect(ctx.getSnapshot(roomId).has('user1')).toBe(true);

    await act(async () => {
      es.emit({ type: 'left', userId: 'user1', updatedAt: 200 });
    });

    expect(ctx.getSnapshot(roomId).has('user1')).toBe(false);
    unmount();
  });

  it('ignoriert stale left-events wenn ein neuerer Presence-Eintrag existiert', async () => {
    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();
    const roomId = '!room1:server';

    await act(async () => { ctx.subscribeSSE(roomId); });

    const es = MockEventSource.instances[0];
    await act(async () => {
      es.emit({
        type: 'update',
        userId: 'user1',
        isMicMuted: false,
        isCameraOn: true,
        isScreenSharing: false,
        isDeafened: false,
        updatedAt: 500,
      });
    });

    const snapshotBefore = ctx.getSnapshot(roomId);

    await act(async () => {
      es.emit({ type: 'left', userId: 'user1', updatedAt: 100 });
    });

    const snapshotAfter = ctx.getSnapshot(roomId);
    expect(snapshotAfter).toBe(snapshotBefore);
    expect(snapshotAfter.get('user1')?.isCameraOn).toBe(true);
    unmount();
  });

  it('ignoriert SSE-Update wenn updatedAt aelter als vorhandener Eintrag', async () => {
    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();
    const roomId = '!room1:server';

    await act(async () => { ctx.subscribeSSE(roomId); });

    const es = MockEventSource.instances[0];

    // Neueres Update zuerst
    await act(async () => {
      es.emit({
        type: 'update',
        userId: 'user1',
        isMicMuted: true,
        isCameraOn: false,
        isScreenSharing: false,
        isDeafened: false,
        updatedAt: 9999,
      });
    });

    // Aelteres Update danach — soll ignoriert werden
    await act(async () => {
      es.emit({
        type: 'update',
        userId: 'user1',
        isMicMuted: false,
        isCameraOn: true,
        isScreenSharing: false,
        isDeafened: false,
        updatedAt: 1,  // aelter!
      });
    });

    const entry = ctx.getSnapshot(roomId).get('user1');
    // isMicMuted=true vom neueren Update bleibt erhalten
    expect(entry?.isMicMuted).toBe(true);
    expect(entry?.isCameraOn).toBe(false);

    unmount();
  });

  it('ignoriert malformed SSE-JSON (kein crash)', async () => {
    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();
    const roomId = '!room1:server';

    await act(async () => { ctx.subscribeSSE(roomId); });

    const es = MockEventSource.instances[0];

    // Kein Fehler-Throw erwartet
    await act(async () => {
      es.onmessage?.({ data: 'INVALID_JSON{{{}' });
    });

    expect(ctx.getSnapshot(roomId).size).toBe(0);
    unmount();
  });

  it('snapshot ist eine neue Map-Referenz nach SSE-Update (useSyncExternalStore-Kompatibilitaet)', async () => {
    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();
    const roomId = '!room1:server';

    await act(async () => { ctx.subscribeSSE(roomId); });

    const snapshotBefore = ctx.getSnapshot(roomId);

    const es = MockEventSource.instances[0];
    await act(async () => {
      es.emit({
        type: 'update',
        userId: 'user1',
        isMicMuted: false,
        isCameraOn: false,
        isScreenSharing: false,
        isDeafened: false,
        updatedAt: 500,
      });
    });

    const snapshotAfter = ctx.getSnapshot(roomId);
    // Neue Referenz nach Update (nicht dieselbe Map-Instanz)
    expect(snapshotAfter).not.toBe(snapshotBefore);
    unmount();
  });

  it('unsubscribeFromUpdates entfernt listener korrekt', async () => {
    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();
    const roomId = '!room1:server';

    await act(async () => { ctx.subscribeSSE(roomId); });

    const listener = vi.fn();
    const unsubListener = ctx.subscribeToUpdates(roomId, listener);

    // Listener entfernen
    unsubListener();

    const es = MockEventSource.instances[0];
    await act(async () => {
      es.emit({
        type: 'update',
        userId: 'user2',
        isMicMuted: true,
        isCameraOn: false,
        isScreenSharing: false,
        isDeafened: false,
        updatedAt: 1000,
      });
    });

    // Listener wurde entfernt → nicht aufgerufen
    expect(listener).not.toHaveBeenCalled();
    unmount();
  });

  it('snapshot-Eintraege enthalten nicht updatedAt (nur CallPresenceState-Felder)', async () => {
    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();
    const roomId = '!room1:server';

    await act(async () => { ctx.subscribeSSE(roomId); });

    const es = MockEventSource.instances[0];
    await act(async () => {
      es.emit({
        type: 'update',
        userId: 'user1',
        isMicMuted: false,
        isCameraOn: false,
        isScreenSharing: false,
        isDeafened: false,
        updatedAt: 123,
      });
    });

    const entry = ctx.getSnapshot(roomId).get('user1');
    expect(entry).toBeDefined();
    // updatedAt soll NICHT im oeffentlichen Snapshot auftauchen
    expect('updatedAt' in (entry as object)).toBe(false);
    expect(Object.keys(entry as object).sort()).toEqual(
      ['isCameraOn', 'isDeafened', 'isMicMuted', 'isScreenSharing'].sort()
    );

    unmount();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gruppe 3: REST Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

describe('BridgePresenceProvider — REST Bootstrap', () => {
  beforeEach(() => {
    vi.stubGlobal('EventSource', MockEventSource);
    MockEventSource.reset();
  });

  afterEach(() => {
    MockEventSource.reset();
    vi.unstubAllGlobals();
  });

  it('ruft /api/presence/room?roomId=... beim ersten subscribeSSE auf', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();
    const roomId = '!room1:server';

    let cleanup!: () => void;
    await act(async () => {
      cleanup = ctx.subscribeSSE(roomId);
    });

    // fetch-Promise auflösen
    await act(async () => { await Promise.resolve(); });

    const calledUrls = fetchMock.mock.calls.map((call: unknown[]) => call[0] as string);
    expect(calledUrls.some((url) => url.includes('/api/presence/room?roomId='))).toBe(true);
    expect(calledUrls.some((url) => url.includes('room1'))).toBe(true);
    // Nur einmal beim ersten Subscribe
    expect(fetchMock).toHaveBeenCalledTimes(1);

    cleanup();
    unmount();
  });

  it('faellt bei presenceUrl="" weiter auf /api/presence Query-URLs zurueck', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider({ presenceUrl: '' });

    await act(async () => {
      ctx.subscribeSSE('!room1:server');
    });

    await act(async () => { await Promise.resolve(); });

    const calledUrls = fetchMock.mock.calls.map((call: unknown[]) => call[0] as string);
    expect(calledUrls.some((url) => url.includes('/api/presence/room?roomId='))).toBe(true);
    expect(MockEventSource.instances[0]?.url).toContain('/api/presence/stream?roomId=');

    unmount();
  });

  it('uses query-param presence URLs for roomIds containing slashes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();
    const roomId = 'c2g123/Uutu456';

    await act(async () => {
      ctx.subscribeSSE(roomId);
    });

    await act(async () => { await Promise.resolve(); });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/presence/room?roomId=c2g123%2FUutu456',
      expect.objectContaining({ headers: {}, signal: expect.any(AbortSignal) }),
    );
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0]?.url).toBe(
      '/api/presence/stream?roomId=c2g123%2FUutu456',
    );

    unmount();
  });

  it('fuellt snapshot mit REST-Daten vor erstem SSE-Event', async () => {
    const restData = {
      user1: {
        userId: 'user1',
        isMicMuted: true,
        isCameraOn: false,
        isScreenSharing: false,
        isDeafened: false,
        updatedAt: 5000,
      },
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => restData,
    }));

    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();
    const roomId = '!room1:server';

    await act(async () => { ctx.subscribeSSE(roomId); });

    // REST-Response vollstaendig auflösen
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    const snapshot = ctx.getSnapshot(roomId);
    expect(snapshot.has('user1')).toBe(true);
    expect(snapshot.get('user1')?.isMicMuted).toBe(true);

    unmount();
  });

  it('fuellt snapshot mit mehreren Usern aus REST-Response', async () => {
    const restData = {
      user1: { userId: 'user1', isMicMuted: true, isCameraOn: false, isScreenSharing: false, isDeafened: false, updatedAt: 100 },
      user2: { userId: 'user2', isMicMuted: false, isCameraOn: true, isScreenSharing: false, isDeafened: false, updatedAt: 200 },
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => restData,
    }));

    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();
    const roomId = '!room1:server';

    await act(async () => { ctx.subscribeSSE(roomId); });
    await act(async () => { await new Promise<void>((resolve) => setTimeout(resolve, 0)); });

    const snapshot = ctx.getSnapshot(roomId);
    expect(snapshot.has('user1')).toBe(true);
    expect(snapshot.has('user2')).toBe(true);
    expect(snapshot.get('user2')?.isCameraOn).toBe(true);

    unmount();
  });

  it('ignoriert REST-Fehler: SSE laeuft weiter, kein crash', async () => {
    // fetch wirft einen Netzwerkfehler
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();
    const roomId = '!room1:server';

    // Kein Fehler-Throw erwartet
    await act(async () => { ctx.subscribeSSE(roomId); });
    await act(async () => { await new Promise<void>((resolve) => setTimeout(resolve, 0)); });

    // SSE sollte trotzdem offen sein
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].closed).toBe(false);

    // Snapshot leer (REST hat nichts geliefert)
    expect(ctx.getSnapshot(roomId).size).toBe(0);

    unmount();
  });

  it('ignoriert REST non-ok response: Snapshot bleibt leer, kein crash', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    }));

    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();
    const roomId = '!room1:server';

    await act(async () => { ctx.subscribeSSE(roomId); });
    await act(async () => { await new Promise<void>((resolve) => setTimeout(resolve, 0)); });

    expect(ctx.getSnapshot(roomId).size).toBe(0);
    unmount();
  });

  it('REST ruft fetch NICHT nochmal auf bei zweitem subscribeSSE desselben Raums', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();
    const roomId = '!room1:server';

    await act(async () => {
      ctx.subscribeSSE(roomId);
      ctx.subscribeSSE(roomId);
    });
    await act(async () => { await new Promise<void>((resolve) => setTimeout(resolve, 0)); });

    // bootstrapREST wird nur beim ERSTEN subscribe aufgerufen
    expect(fetchMock).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('ueberschreibt REST-Daten nicht mit aelterem SSE-Event (updatedAt-Vergleich)', async () => {
    // REST liefert einen neueren Timestamp
    const restData = {
      user1: {
        userId: 'user1',
        isMicMuted: false,   // REST: nicht muted, Timestamp 9999
        isCameraOn: false,
        isScreenSharing: false,
        isDeafened: false,
        updatedAt: 9999,
      },
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => restData,
    }));

    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();
    const roomId = '!room1:server';

    await act(async () => { ctx.subscribeSSE(roomId); });

    // REST auflösen
    await act(async () => { await new Promise<void>((resolve) => setTimeout(resolve, 0)); });

    const es = MockEventSource.instances[0];

    // SSE-Event mit ALTEM Timestamp kommt NACH dem REST-Update
    await act(async () => {
      es.emit({
        type: 'update',
        userId: 'user1',
        isMicMuted: true,   // SSE sagt: muted, aber Timestamp ist aelter!
        isCameraOn: true,
        isScreenSharing: false,
        isDeafened: false,
        updatedAt: 1,  // aelter als REST (9999)
      });
    });

    // REST-Daten bleiben (SSE wird ignoriert weil updatedAt juenger)
    const entry = ctx.getSnapshot(roomId).get('user1');
    expect(entry?.isMicMuted).toBe(false);  // REST-Wert bleibt
    expect(entry?.isCameraOn).toBe(false);   // REST-Wert bleibt

    unmount();
  });

  it('SSE-Event mit neuerem Timestamp ueberschreibt REST-Daten', async () => {
    const restData = {
      user1: {
        userId: 'user1',
        isMicMuted: false,
        isCameraOn: false,
        isScreenSharing: false,
        isDeafened: false,
        updatedAt: 100,
      },
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => restData,
    }));

    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();
    const roomId = '!room1:server';

    await act(async () => { ctx.subscribeSSE(roomId); });
    await act(async () => { await new Promise<void>((resolve) => setTimeout(resolve, 0)); });

    const es = MockEventSource.instances[0];

    // SSE-Event mit NEUEREM Timestamp
    await act(async () => {
      es.emit({
        type: 'update',
        userId: 'user1',
        isMicMuted: true,   // neuer Wert
        isCameraOn: true,
        isScreenSharing: false,
        isDeafened: false,
        updatedAt: 99999,   // neuer als REST (100)
      });
    });

    const entry = ctx.getSnapshot(roomId).get('user1');
    expect(entry?.isMicMuted).toBe(true);   // SSE-Wert gesetzt
    expect(entry?.isCameraOn).toBe(true);    // SSE-Wert gesetzt

    unmount();
  });

  it('REST-Daten mit fehlenden Feldern werden sicher auf false defaulted', async () => {
    const restData = {
      user1: {
        userId: 'user1',
        // isMicMuted / isCameraOn / isScreenSharing / isDeafened fehlen → false
        updatedAt: 500,
      },
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => restData,
    }));

    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();

    await act(async () => { ctx.subscribeSSE('!room1:server'); });
    await act(async () => { await new Promise<void>((resolve) => setTimeout(resolve, 0)); });

    const entry = ctx.getSnapshot('!room1:server').get('user1');
    expect(entry?.isMicMuted).toBe(false);
    expect(entry?.isCameraOn).toBe(false);
    expect(entry?.isScreenSharing).toBe(false);
    expect(entry?.isDeafened).toBe(false);

    unmount();
  });

  it('notifiziert listener nach REST-Bootstrap (changed=true)', async () => {
    const restData = {
      user1: { userId: 'user1', isMicMuted: true, isCameraOn: false, isScreenSharing: false, isDeafened: false, updatedAt: 100 },
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => restData,
    }));

    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();
    const roomId = '!room1:server';

    const listener = vi.fn();

    await act(async () => {
      ctx.subscribeSSE(roomId);
      ctx.subscribeToUpdates(roomId, listener);
    });

    // REST auflösen
    await act(async () => { await new Promise<void>((resolve) => setTimeout(resolve, 0)); });

    expect(listener).toHaveBeenCalled();
    unmount();
  });

  it('notifiziert listener NICHT bei REST wenn keine Daten geaendert (leere Response)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),  // Leeres Objekt → changed=false
    }));

    const { act } = await import('react-dom/test-utils');
    const { ctx, unmount } = await mountProvider();
    const roomId = '!room1:server';

    const listener = vi.fn();

    await act(async () => {
      ctx.subscribeSSE(roomId);
      ctx.subscribeToUpdates(roomId, listener);
    });

    await act(async () => { await new Promise<void>((resolve) => setTimeout(resolve, 0)); });

    // Leere Response → changed=false → listener nicht aufgerufen
    expect(listener).not.toHaveBeenCalled();
    unmount();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resolvePresence — non-participant observer scenarios
// ─────────────────────────────────────────────────────────────────────────────

describe('resolvePresence — non-participant observer scenarios', () => {
  const emptyBridge: CallPresenceState = {
    isMicMuted: false,
    isCameraOn: false,
    isScreenSharing: false,
    isDeafened: false,
  };

  const baseNonParticipantArgs: ResolvePresenceArgs = {
    isLocalUser: false,
    isActiveCall: false,
    pState: undefined,
    remoteBridge: undefined,
    isAudioEnabled: true,
    isVideoEnabled: false,
    isCallDeafened: false,
    isScreenShareEnabled: false,
  };

  // 1. Non-participant sees bridge state (no pState)
  it('non-participant: bridge isMicMuted=true is reflected in result', () => {
    const result = resolvePresence({
      ...baseNonParticipantArgs,
      remoteBridge: { isMicMuted: true, isCameraOn: false, isScreenSharing: false, isDeafened: false },
    });
    expect(result.isMicMuted).toBe(true);
  });

  // 2. Non-participant sees deafen from bridge
  it('non-participant: bridge isDeafened=true is reflected in result', () => {
    const result = resolvePresence({
      ...baseNonParticipantArgs,
      remoteBridge: { isMicMuted: false, isCameraOn: false, isScreenSharing: false, isDeafened: true },
    });
    expect(result.isDeafened).toBe(true);
  });

  // 3. Non-participant with no bridge → all-false (no Matrix-state fallback)
  it('non-participant: all-false when remoteBridge is undefined', () => {
    const result = resolvePresence({
      ...baseNonParticipantArgs,
      remoteBridge: undefined,
    });
    expect(result.isMicMuted).toBe(false);
  });

  // 4. Non-participant sees empty state when bridge is absent
  it('non-participant: all false when remoteBridge is undefined', () => {
    const result = resolvePresence({
      ...baseNonParticipantArgs,
      remoteBridge: undefined,
    });
    expect(result.isMicMuted).toBe(false);
    expect(result.isCameraOn).toBe(false);
    expect(result.isScreenSharing).toBe(false);
    expect(result.isDeafened).toBe(false);
  });

  // 5. Non-participant: bridge takes priority for screensharing
  it('non-participant: bridge isScreenSharing=true is reflected in result', () => {
    const result = resolvePresence({
      ...baseNonParticipantArgs,
      remoteBridge: { isMicMuted: false, isCameraOn: false, isScreenSharing: true, isDeafened: false },
    });
    expect(result.isScreenSharing).toBe(true);
  });

  // 6. Non-participant: bridge false → false
  it('non-participant: bridge isMicMuted=false → false', () => {
    const result = resolvePresence({
      ...baseNonParticipantArgs,
      remoteBridge: { isMicMuted: false, isCameraOn: false, isScreenSharing: false, isDeafened: false },
    });
    expect(result.isMicMuted).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gruppe 5: bridge webhook — deafen sync via track events (fallback)
//
// Tests the syncDeafenFromAttrs fallback that is called from every track event
// handler in bridge/src/index.ts.  We replicate the bridge's in-memory state
// management here (same logic, zero network/HTTP deps) so Vitest can run these
// purely in-process without importing Hono or livekit-server-sdk.
//
// The logic under test (from bridge/src/index.ts):
//
//   function syncDeafenFromAttrs(roomId, identity, userId, attrs) {
//     if (!attrs || !('isDeafened' in attrs)) return;
//     setPresence(roomId, identity, userId, { isDeafened: attrs.isDeafened === '1' });
//   }
//
//   track_muted / track_unmuted / track_published / track_unpublished all call
//   syncDeafenFromAttrs(roomId, identity, userId, pAttrs) AFTER setting the
//   track-specific field, so both fields are updated atomically.
// ─────────────────────────────────────────────────────────────────────────────

describe('bridge webhook — deafen sync via track events (fallback)', () => {
  // ── Minimal replica of bridge in-memory state ──────────────────────────────

  type BridgePresence = {
    isMicMuted: boolean;
    isCameraOn: boolean;
    isScreenSharing: boolean;
    isDeafened: boolean;
    updatedAt: number;
  };

  type IdentityEntry = { userId: string; presence: BridgePresence };

  let roomState: Map<string, Map<string, BridgePresence>>;
  let identityState: Map<string, Map<string, IdentityEntry>>;

  function ensureRoom(roomId: string): Map<string, BridgePresence> {
    if (!roomState.has(roomId)) roomState.set(roomId, new Map());
    return roomState.get(roomId)!;
  }

  function ensureIdentityRoom(roomId: string): Map<string, IdentityEntry> {
    if (!identityState.has(roomId)) identityState.set(roomId, new Map());
    return identityState.get(roomId)!;
  }

  function recomputeUserState(roomId: string, userId: string): void {
    const idRoom = identityState.get(roomId);
    const candidates: BridgePresence[] = [];
    if (idRoom) {
      for (const entry of idRoom.values()) {
        if (entry.userId === userId) candidates.push(entry.presence);
      }
    }
    if (candidates.length === 0) {
      const room = roomState.get(roomId);
      if (room) {
        room.delete(userId);
        if (room.size === 0) roomState.delete(roomId);
      }
    } else {
      const best = candidates.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));
      ensureRoom(roomId).set(userId, best);
    }
  }

  function setPresence(
    roomId: string,
    identity: string,
    userId: string,
    patch: Partial<BridgePresence>,
  ): void {
    const idRoom = ensureIdentityRoom(roomId);
    const existing = idRoom.get(identity);
    const prev: BridgePresence = existing?.presence ?? {
      isMicMuted: false,
      isCameraOn: false,
      isScreenSharing: false,
      isDeafened: false,
      updatedAt: 0,
    };
    const next: BridgePresence = { ...prev, ...patch, updatedAt: Date.now() };

    const changed =
      next.isMicMuted !== prev.isMicMuted ||
      next.isCameraOn !== prev.isCameraOn ||
      next.isScreenSharing !== prev.isScreenSharing ||
      next.isDeafened !== prev.isDeafened;
    if (!changed) return;

    idRoom.set(identity, { userId, presence: next });
    recomputeUserState(roomId, userId);
  }

  // Exact replica of syncDeafenFromAttrs in bridge/src/index.ts
  function syncDeafenFromAttrs(
    roomId: string,
    identity: string,
    userId: string,
    attrs: Record<string, string> | undefined,
  ): void {
    if (!attrs || !('isDeafened' in attrs)) return;
    setPresence(roomId, identity, userId, { isDeafened: attrs.isDeafened === '1' });
  }

  // ── Track-event handlers (exact logic from bridge/src/index.ts) ───────────

  type TrackSource = 'MICROPHONE' | 'CAMERA' | 'SCREEN_SHARE';

  function handleTrackEvent(
    event: 'track_muted' | 'track_unmuted' | 'track_published' | 'track_unpublished',
    roomId: string,
    identity: string,
    userId: string,
    source: TrackSource,
    trackMuted: boolean | undefined,
    pAttrs: Record<string, string> | undefined,
  ): void {
    switch (event) {
      case 'track_muted':
        if (source === 'MICROPHONE') setPresence(roomId, identity, userId, { isMicMuted: true });
        if (source === 'CAMERA') setPresence(roomId, identity, userId, { isCameraOn: false });
        if (source === 'SCREEN_SHARE') setPresence(roomId, identity, userId, { isScreenSharing: false });
        syncDeafenFromAttrs(roomId, identity, userId, pAttrs);
        break;

      case 'track_unmuted':
        if (source === 'MICROPHONE') setPresence(roomId, identity, userId, { isMicMuted: false });
        if (source === 'CAMERA') setPresence(roomId, identity, userId, { isCameraOn: true });
        if (source === 'SCREEN_SHARE') setPresence(roomId, identity, userId, { isScreenSharing: true });
        syncDeafenFromAttrs(roomId, identity, userId, pAttrs);
        break;

      case 'track_published':
        if (source === 'MICROPHONE') setPresence(roomId, identity, userId, { isMicMuted: trackMuted ?? false });
        if (source === 'CAMERA') setPresence(roomId, identity, userId, { isCameraOn: !(trackMuted ?? false) });
        if (source === 'SCREEN_SHARE') setPresence(roomId, identity, userId, { isScreenSharing: !(trackMuted ?? false) });
        syncDeafenFromAttrs(roomId, identity, userId, pAttrs);
        break;

      case 'track_unpublished':
        if (source === 'MICROPHONE') setPresence(roomId, identity, userId, { isMicMuted: true });
        if (source === 'CAMERA') setPresence(roomId, identity, userId, { isCameraOn: false });
        if (source === 'SCREEN_SHARE') setPresence(roomId, identity, userId, { isScreenSharing: false });
        syncDeafenFromAttrs(roomId, identity, userId, pAttrs);
        break;
    }
  }

  function participantJoined(
    roomId: string,
    identity: string,
    userId: string,
    attrs?: Record<string, string>,
  ): void {
    const initial: BridgePresence = {
      isMicMuted: false,
      isCameraOn: false,
      isScreenSharing: false,
      isDeafened: attrs?.isDeafened === '1',
      updatedAt: Date.now(),
    };
    ensureIdentityRoom(roomId).set(identity, { userId, presence: initial });
    ensureRoom(roomId).set(userId, initial);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  const ROOM = '!room:test.server';
  const IDENTITY = '@alice:test.server';
  const USER_ID = '@alice:test.server';

  function getPresence(): BridgePresence | undefined {
    return roomState.get(ROOM)?.get(USER_ID);
  }

  beforeEach(() => {
    roomState = new Map();
    identityState = new Map();
  });

  // ── Test 1: track_unpublished MICROPHONE + isDeafened=1 → isDeafened: true ─

  it('track_unpublished MICROPHONE + isDeafened=1 in attrs → isMicMuted:true AND isDeafened:true', () => {
    // Pre-seed: participant must exist for setPresence to find an entry to patch.
    // We seed via a direct identityState insertion to keep setup minimal.
    participantJoined(ROOM, IDENTITY, USER_ID);

    handleTrackEvent(
      'track_unpublished',
      ROOM, IDENTITY, USER_ID,
      'MICROPHONE',
      undefined,
      { isDeafened: '1' },
    );

    const entry = getPresence();
    expect(entry?.isMicMuted).toBe(true);
    expect(entry?.isDeafened).toBe(true);
  });

  // ── Test 2: track_published MICROPHONE + isDeafened=0 → isDeafened: false ─

  it('track_published MICROPHONE + isDeafened=0 in attrs → isMicMuted:false AND isDeafened:false', () => {
    // Pre-seed with deafened=true so we can verify the attr clears it
    participantJoined(ROOM, IDENTITY, USER_ID, { isDeafened: '1' });

    handleTrackEvent(
      'track_published',
      ROOM, IDENTITY, USER_ID,
      'MICROPHONE',
      false,
      { isDeafened: '0' },
    );

    const entry = getPresence();
    expect(entry?.isMicMuted).toBe(false);
    expect(entry?.isDeafened).toBe(false);
  });

  // ── Test 3: track_muted MICROPHONE + isDeafened=1 → isDeafened: true ──────

  it('track_muted MICROPHONE + isDeafened=1 → isMicMuted:true AND isDeafened:true', () => {
    participantJoined(ROOM, IDENTITY, USER_ID);

    handleTrackEvent(
      'track_muted',
      ROOM, IDENTITY, USER_ID,
      'MICROPHONE',
      undefined,
      { isDeafened: '1' },
    );

    const entry = getPresence();
    expect(entry?.isMicMuted).toBe(true);
    expect(entry?.isDeafened).toBe(true);
  });

  // ── Test 4: track_unmuted MICROPHONE + isDeafened=0 → isDeafened: false ───

  it('track_unmuted MICROPHONE + isDeafened=0 → isMicMuted:false AND isDeafened:false', () => {
    participantJoined(ROOM, IDENTITY, USER_ID, { isDeafened: '1' });

    handleTrackEvent(
      'track_unmuted',
      ROOM, IDENTITY, USER_ID,
      'MICROPHONE',
      undefined,
      { isDeafened: '0' },
    );

    const entry = getPresence();
    expect(entry?.isMicMuted).toBe(false);
    expect(entry?.isDeafened).toBe(false);
  });

  // ── Test 5: track_unpublished MICROPHONE without isDeafened attr → isDeafened NOT overridden ──

  it('track_unpublished MICROPHONE without isDeafened attr → isDeafened remains true (absent key ≠ false)', () => {
    // First: join with isDeafened=true
    participantJoined(ROOM, IDENTITY, USER_ID, { isDeafened: '1' });

    // Then: track_unpublished with NO isDeafened attribute at all
    handleTrackEvent(
      'track_unpublished',
      ROOM, IDENTITY, USER_ID,
      'MICROPHONE',
      undefined,
      undefined, // no isDeafened key in attrs
    );

    const entry = getPresence();
    // isMicMuted should be set to true by track_unpublished
    expect(entry?.isMicMuted).toBe(true);
    // isDeafened must NOT be overridden — absence of key leaves it as-is
    expect(entry?.isDeafened).toBe(true);
  });

  // ── Test 6: track_unmuted CAMERA + isDeafened=1 → isDeafened updated even for non-mic track ──

  it('track_unmuted CAMERA + isDeafened=1 → isCameraOn:true AND isDeafened:true', () => {
    participantJoined(ROOM, IDENTITY, USER_ID);

    handleTrackEvent(
      'track_unmuted',
      ROOM, IDENTITY, USER_ID,
      'CAMERA',
      undefined,
      { isDeafened: '1' },
    );

    const entry = getPresence();
    expect(entry?.isCameraOn).toBe(true);
    expect(entry?.isDeafened).toBe(true);
  });
});
