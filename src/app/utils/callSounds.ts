/**
 * callSounds.ts
 * Audio engine for mesh voice call events.
 *
 * Plays MP3 files from /public/sound/ via plain HTMLAudioElement.
 * No Web Audio API — avoids AudioContext suspension issues on first load.
 * Volume is controlled directly via audio.volume.
 */

// ---------------------------------------------------------------------------
// Sound type registry
// ---------------------------------------------------------------------------

export const CallSoundType = {
  UserJoin: 'user-join',
  UserLeave: 'user-leave',
  UserMove: 'user-move',
  // Viewer sounds — wire up when viewer/stream-watch feature is implemented:
  //   playCallSound(CallSoundType.ViewerJoin,  { enabled: callSoundsEnabledRef.current });
  //   playCallSound(CallSoundType.ViewerLeave, { enabled: callSoundsEnabledRef.current });
  ViewerJoin: 'viewer-join',
  ViewerLeave: 'viewer-leave',
  IncomingRing: 'incoming-ring',
  VoiceDisconnect: 'voice-disconnect',
  ScreenShareStart: 'stream-start',
  ScreenShareStop: 'stream-stop',
  CameraOn: 'camera-on',
  CameraOff: 'camera-off',
  Mute: 'mute',
  Unmute: 'unmute',
  Deaf: 'deaf',
  Undeaf: 'undeaf',
  Message: 'message',
  PttActive: 'ptt-active',
  PttInactive: 'ptt-inactive',
} as const;

export type CallSoundType = (typeof CallSoundType)[keyof typeof CallSoundType];

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** Currently playing Audio elements, keyed by sound type. */
const activeSounds = new Map<string, HTMLAudioElement>();

/** Loop sounds blocked by autoplay policy, retried on first user gesture. */
const pendingLoopSounds = new Set<string>();

/** Pending volume multipliers for loop sounds waiting to retry. */
const pendingLoopVolumes = new Map<string, number>();

let retryListenersAttached = false;

/** Master volume multiplier [0–1]. Applied to all new sounds. */
let masterVolume = 1.0;

// ---------------------------------------------------------------------------
// Public API — volume
// ---------------------------------------------------------------------------

export function setCallSoundsVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
  // Update all currently playing sounds immediately.
  for (const audio of activeSounds.values()) {
    audio.volume = masterVolume;
  }
}

// ---------------------------------------------------------------------------
// Public API — playback
// ---------------------------------------------------------------------------

export interface PlayCallSoundOptions {
  loop?: boolean;
  volume?: number;
  enabled?: boolean;
}

export function playCallSound(type: CallSoundType, options: PlayCallSoundOptions = {}): void {
  const { loop = false, volume = 1, enabled = true } = options;
  if (!enabled) return;

  // Stop any existing instance first.
  stopCallSound(type);

  const audio = new Audio(`/sound/${type}.mp3?v=2`);
  audio.volume = Math.max(0, Math.min(1, volume * masterVolume));
  audio.loop = loop;

  activeSounds.set(type, audio);

  audio.addEventListener(
    'ended',
    () => {
      if (activeSounds.get(type) === audio) activeSounds.delete(type);
    },
    { once: true },
  );

  audio.play().catch((err: unknown) => {
    const name = err instanceof Error ? err.name : String(err);
    if (name === 'NotAllowedError' || name === 'AbortError') {
      // Autoplay blocked — queue loop sounds for retry on next user gesture.
      if (loop) {
        pendingLoopSounds.add(type);
        pendingLoopVolumes.set(type, volume);
        attachRetryListeners();
      }
      // One-shot sounds are dropped (they're already stale by the time user interacts).
    } else {
      console.warn(`[callSounds] Failed to play "${type}":`, err);
    }
  });
}

// ---------------------------------------------------------------------------
// Public API — stop
// ---------------------------------------------------------------------------

export function stopCallSound(type: CallSoundType): void {
  pendingLoopSounds.delete(type);
  pendingLoopVolumes.delete(type);

  const audio = activeSounds.get(type);
  if (!audio) return;

  activeSounds.delete(type);

  // Fade out over 80ms to avoid a click.
  const start = Date.now();
  const startVol = audio.volume;
  const FADE_MS = 80;

  const fade = setInterval(() => {
    const elapsed = Date.now() - start;
    if (elapsed >= FADE_MS) {
      clearInterval(fade);
      audio.pause();
      audio.src = '';
    } else {
      audio.volume = startVol * (1 - elapsed / FADE_MS);
    }
  }, 16);
}

export function stopAllCallSounds(): void {
  for (const type of [...activeSounds.keys()]) {
    stopCallSound(type as CallSoundType);
  }
  pendingLoopSounds.clear();
  pendingLoopVolumes.clear();
}

// ---------------------------------------------------------------------------
// Autoplay recovery
// ---------------------------------------------------------------------------

export function retryPendingLoopSounds(): void {
  for (const type of [...pendingLoopSounds]) {
    const vol = pendingLoopVolumes.get(type) ?? 1;
    pendingLoopSounds.delete(type);
    pendingLoopVolumes.delete(type);
    playCallSound(type as CallSoundType, { loop: true, volume: vol });
  }
}

function attachRetryListeners(): void {
  if (retryListenersAttached) return;
  retryListenersAttached = true;

  const handler = (): void => {
    retryPendingLoopSounds();
    document.removeEventListener('pointerdown', handler);
    document.removeEventListener('keydown', handler);
    retryListenersAttached = false;
  };

  document.addEventListener('pointerdown', handler, { once: true, capture: true });
  document.addEventListener('keydown', handler, { once: true, capture: true });
}
