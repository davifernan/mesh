import React, { useEffect, useState } from 'react';
import type { UpdaterEvent } from '../../../types/electron';
import * as css from './ElectronUpdateBanner.css';

type UpdateState =
  | { phase: 'idle' }
  | { phase: 'downloading'; percent: number }
  | { phase: 'ready'; version: string | null }
  | { phase: 'error'; message: string };

/**
 * Shows a bottom banner when an Electron auto-update is available or has been
 * downloaded. No-op in the browser (window.electron is undefined).
 */
export function ElectronUpdateBanner() {
  const [state, setState] = useState<UpdateState>({ phase: 'idle' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const electron = window.electron;
    if (!electron) return;

    const unsub = electron.onUpdaterEvent((event: UpdaterEvent) => {
      switch (event.type) {
        case 'progress':
          setState({ phase: 'downloading', percent: Math.round(event.percent) });
          setDismissed(false);
          break;
        case 'downloaded':
          setState({ phase: 'ready', version: event.version });
          setDismissed(false);
          break;
        case 'error':
          // Only show errors if we were already in an active download state
          setState((prev) => {
            if (prev.phase === 'idle') return prev;
            return { phase: 'error', message: event.message };
          });
          break;
        case 'not-available':
          setState({ phase: 'idle' });
          break;
        default:
          break;
      }
    });

    // Kick off a background check on mount
    electron.updaterCheck('background').catch(() => {});

    return unsub;
  }, []);

  if (dismissed || state.phase === 'idle') return null;

  return (
    <div className={css.banner} role="status">
      {state.phase === 'downloading' && (
        <>
          <span>Downloading update… {state.percent}%</span>
          <div
            className={css.progressBar}
            style={{ width: `${state.percent}%` }}
          />
        </>
      )}

      {state.phase === 'ready' && (
        <>
          <span>
            {state.version ? `BetterCord ${state.version} is ready.` : 'An update is ready.'}{' '}
            Restart to apply.
          </span>
          <button
            className={css.restartBtn}
            type="button"
            onClick={() => window.electron?.updaterInstall()}
          >
            Restart now
          </button>
          <button
            className={css.dismissBtn}
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss update banner"
          >
            Later
          </button>
        </>
      )}

      {state.phase === 'error' && (
        <>
          <span>Update failed: {state.message}</span>
          <button
            className={css.dismissBtn}
            type="button"
            onClick={() => {
              setState({ phase: 'idle' });
              setDismissed(false);
            }}
          >
            Dismiss
          </button>
        </>
      )}
    </div>
  );
}
