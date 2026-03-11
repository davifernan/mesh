/**
 * soundboardMixer.ts
 *
 * Outbound audio mixer that blends the local microphone with soundboard clips
 * and exposes a single mixed MediaStreamTrack for LiveKit to publish.
 *
 * Local monitoring:
 * - Soundboard clips are also monitored locally through the user's speakers.
 * - The microphone is NOT locally monitored here.
 *
 * Graph:
 *   micSource (MediaStreamSource)  ──► micGain ───────────────► destination (MediaStreamDestination)
 *
 *   clipSource (BufferSource/MediaSource) ──► clipGain ───────► destination (MediaStreamDestination)
 *                                                   └─────────► audioContext.destination
 *
 * The destination's stream contains one mixed track which LiveKit publishes
 * instead of the raw mic track, so all call participants hear both mic and clips.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActiveClip {
  id: string;
  gainNode: GainNode;
  /** Defined for AudioBuffer-based clips (fetch-decoded). */
  bufferSource?: AudioBufferSourceNode;
  /** Defined for HTMLMediaElement-based clips (streaming fallback). */
  mediaSource?: MediaElementAudioSourceNode;
  /** HTMLAudioElement used for streaming fallback. */
  mediaElement?: HTMLAudioElement;
}

// ─── SoundboardMixer ──────────────────────────────────────────────────────────

export class SoundboardMixer {
  private ctx: AudioContext;
  private destination: MediaStreamAudioDestinationNode;

  /** Gain node for the microphone branch. */
  private micGain: GainNode;
  /** MediaStreamSource wrapping the current mic track's stream. */
  private micSource: MediaStreamAudioSourceNode | null = null;

  /** Currently playing clips keyed by clip ID. */
  private clips = new Map<string, ActiveClip>();
  /** Counter for generating unique clip IDs. */
  private clipSeq = 0;

  /** Whether the mic branch is logically enabled. */
  private micEnabled = true;

  /**
   * @param micTrack - Initial mic MediaStreamTrack to mix into the output.
   *                   May be null; call setMicTrack() later.
   */
  constructor(micTrack: MediaStreamTrack | null) {
    this.ctx = new AudioContext();
    this.destination = this.ctx.createMediaStreamDestination();

    // Mic gain — starts at 1 (pass-through). Set to 0 when muted.
    // Only routed to the outbound mix, never to local speakers.
    this.micGain = this.ctx.createGain();
    this.micGain.gain.value = 1;
    this.micGain.connect(this.destination);

    if (micTrack) {
      this.connectMicTrack(micTrack);
    }

    // Resume AudioContext on first user gesture if the browser suspended it.
    this.resumeOnGesture();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Wrap a MediaStreamTrack in a MediaStream and connect it to the mic branch.
   * Any previous mic source is disconnected first.
   */
  private connectMicTrack(track: MediaStreamTrack): void {
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    const stream = new MediaStream([track]);
    this.micSource = this.ctx.createMediaStreamSource(stream);
    this.micSource.connect(this.micGain);
  }

  /**
   * Register one-time pointerdown/keydown listeners to resume the AudioContext
   * if it was created in a suspended state (autoplay policy).
   */
  private resumeOnGesture(): void {
    if (this.ctx.state !== 'suspended') return;

    const resume = (): void => {
      void this.ctx.resume();
      document.removeEventListener('pointerdown', resume, true);
      document.removeEventListener('keydown', resume, true);
    };

    document.addEventListener('pointerdown', resume, { once: true, capture: true });
    document.addEventListener('keydown', resume, { once: true, capture: true });
  }

  /**
   * Resolve a clip URL to a fetchable HTTPS URL.
   * mxc:// URIs are converted using the Matrix content repository download path.
   * The homeserver base URL is extracted from the MXC authority component.
   *
   * Note: This resolver works for public (unauthenticated) media. For servers
   * that require authenticated media downloads, the caller should pass a pre-resolved
   * HTTPS URL instead of an mxc:// URI.
   *
   * @param url - An mxc:// or https:// URL.
   * @param homeserverUrl - Optional explicit homeserver URL to use for mxc:// resolution.
   */
  private resolveUrl(url: string, homeserverUrl?: string): string {
    if (!url.startsWith('mxc://')) return url;

    // mxc://<server>/<mediaId>
    const withoutScheme = url.slice('mxc://'.length);
    const slashIdx = withoutScheme.indexOf('/');
    if (slashIdx === -1) return url;

    const serverName = withoutScheme.slice(0, slashIdx);
    const mediaId = withoutScheme.slice(slashIdx + 1);
    const base = homeserverUrl ?? `https://${serverName}`;
    return `${base.replace(/\/$/, '')}/_matrix/media/v3/download/${serverName}/${mediaId}`;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Play a soundboard clip and mix it into the outbound audio stream.
   *
   * Decoding strategy:
   *   1. Fetch + decodeAudioData (low latency, preferred).
   *   2. HTMLAudioElement + createMediaElementSource (streaming fallback for large files
   *      or when the fetch fails due to CORS on the initial attempt).
   *
   * Clips are also monitored locally through the current AudioContext destination.
   * The mic branch is not locally monitored.
   *
   * @param url           - Clip URL: mxc:// or https://.
   * @param volume        - Gain [0–1], default 1.
   * @param homeserverUrl - Optional homeserver base URL for mxc:// resolution.
   * @returns             Unique clip ID (pass to stopSoundboardClip to cancel early).
   */
  playSoundboardClip(url: string, volume = 1, homeserverUrl?: string): string {
    const clipId = `clip-${++this.clipSeq}`;
    const resolvedUrl = this.resolveUrl(url, homeserverUrl);

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const clipGain = this.ctx.createGain();
    clipGain.gain.value = Math.max(0, Math.min(1, volume));
    clipGain.connect(this.destination);
    clipGain.connect(this.ctx.destination);

    const clip: ActiveClip = { id: clipId, gainNode: clipGain };
    this.clips.set(clipId, clip);

    fetch(resolvedUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching clip`);
        return res.arrayBuffer();
      })
      .then((buf) => this.ctx.decodeAudioData(buf))
      .then((audioBuffer) => {
        if (!this.clips.has(clipId)) return;

        const source = this.ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(clipGain);
        source.onended = () => {
          this.clips.delete(clipId);
        };
        source.start(0);

        const stored = this.clips.get(clipId);
        if (stored) stored.bufferSource = source;
      })
      .catch(() => {
        if (!this.clips.has(clipId)) return;

        const audio = new Audio(resolvedUrl);
        audio.crossOrigin = 'anonymous';
        const mediaSource = this.ctx.createMediaElementSource(audio);
        mediaSource.connect(clipGain);
        audio.onended = () => {
          this.clips.delete(clipId);
        };
        audio.play().catch((err: unknown) => {
          console.warn('[SoundboardMixer] Fallback playback failed for clip', clipId, err);
          this.clips.delete(clipId);
        });

        const stored = this.clips.get(clipId);
        if (stored) {
          stored.mediaSource = mediaSource;
          stored.mediaElement = audio;
        }
      });

    return clipId;
  }

  /**
   * Stop a specific clip by ID. Fades out immediately then disconnects.
   */
  stopSoundboardClip(clipId: string): void {
    const clip = this.clips.get(clipId);
    if (!clip) return;
    this.clips.delete(clipId);
    this.fadeOutAndDispose(clip);
  }

  /**
   * Stop all currently playing clips.
   */
  stopAllClips(): void {
    for (const [id] of this.clips) {
      this.stopSoundboardClip(id);
    }
  }

  /**
   * Swap the mic MediaStreamTrack feeding into the mix.
   * Call this after LiveKit restarts or republishes the mic track
   * (e.g. after restartTrack() or unpublishTrack/publishTrack).
   *
   * Passing null disconnects the mic branch but leaves the mixer active
   * (clips continue to play; silence fills the mic branch).
   */
  setMicTrack(track: MediaStreamTrack | null): void {
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    if (track) {
      this.connectMicTrack(track);
    }
  }

  /**
   * Mute or unmute the mic branch in the Web Audio graph.
   * Does NOT affect LiveKit's own mute state — the caller must keep those in sync.
   *
   * @param enabled - true = mic audible in mix; false = mic silenced.
   */
  setMicEnabled(enabled: boolean): void {
    this.micEnabled = enabled;
    this.micGain.gain.setTargetAtTime(enabled ? 1 : 0, this.ctx.currentTime, 0.005);
  }

  /**
   * Returns the single mixed MediaStreamTrack that should be published to LiveKit.
   * This track combines mic + all active soundboard clips.
   */
  getMixedTrack(): MediaStreamTrack {
    return this.destination.stream.getAudioTracks()[0];
  }

  /**
   * Returns true while the AudioContext is open (not closed).
   */
  isActive(): boolean {
    return this.ctx.state !== 'closed';
  }

  /**
   * Tear down the mixer: stop all clips, disconnect nodes, close AudioContext.
   * After teardown the instance must not be used again.
   */
  teardown(): void {
    this.stopAllClips();
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    this.micGain.disconnect();
    void this.ctx.close();
  }

  // ── Private disposal helper ─────────────────────────────────────────────────

  private fadeOutAndDispose(clip: ActiveClip): void {
    const FADE_S = 0.08;
    const now = this.ctx.currentTime;
    clip.gainNode.gain.setValueAtTime(clip.gainNode.gain.value, now);
    clip.gainNode.gain.linearRampToValueAtTime(0, now + FADE_S);

    setTimeout(() => {
      clip.bufferSource?.stop();
      clip.bufferSource?.disconnect();
      clip.mediaSource?.disconnect();
      if (clip.mediaElement) {
        clip.mediaElement.pause();
        clip.mediaElement.src = '';
      }
      clip.gainNode.disconnect();
    }, (FADE_S + 0.02) * 1000);
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────

let _instance: SoundboardMixer | null = null;

/**
 * Get (or lazily create) the process-wide SoundboardMixer singleton.
 *
 * The singleton is intentionally separate from React state so it can survive
 * re-renders and be accessed imperatively from non-React code.
 *
 * Call teardown() on the instance when the call ends, then getSoundboardMixer()
 * will create a fresh instance on the next call join.
 *
 * @param micTrack - Required on first call; ignored if instance already exists.
 */
export function getSoundboardMixer(micTrack?: MediaStreamTrack | null): SoundboardMixer {
  if (!_instance || !_instance.isActive()) {
    _instance = new SoundboardMixer(micTrack ?? null);
  }
  return _instance;
}

/**
 * Returns the existing singleton without creating a new one.
 * Returns null if no call is active or the mixer has been torn down.
 */
export function getSoundboardMixerIfActive(): SoundboardMixer | null {
  if (_instance && _instance.isActive()) return _instance;
  return null;
}

/**
 * Destroy and nullify the singleton. Called by nativeCallEngine on cleanup.
 */
export function destroySoundboardMixerSingleton(): void {
  if (_instance) {
    _instance.teardown();
    _instance = null;
  }
}
