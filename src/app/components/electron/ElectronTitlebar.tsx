import React, { useEffect, useState } from 'react';
import { MinusIcon, SquareIcon, XIcon } from '@phosphor-icons/react';
import * as css from './ElectronTitlebar.css';

/**
 * Custom frameless titlebar for the Electron desktop app.
 * Renders only when window.electron is present (no-op in browser).
 *
 * macOS: hidden — uses native traffic lights (titlebar-height padding only)
 * Windows/Linux: shows Minimize / Maximize / Close buttons on the right
 */
export function ElectronTitlebar() {
  const electron = window.electron;
  if (!electron) return null;

  const isMac = electron.platform === 'darwin';

  // On macOS we don't render buttons — just a drag region handled via CSS
  if (isMac) return <div className={css.dragRegionMac} />;

  return <WindowsTitlebar />;
}

function WindowsTitlebar() {
  const electron = window.electron!;
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    electron.windowIsMaximized().then(setMaximized).catch(() => {});
    return electron.onWindowMaximizeChange(setMaximized);
  }, [electron]);

  return (
    <div className={css.titlebar}>
      <div className={css.dragRegion} />
      <div className={css.controls}>
        <button
          className={css.controlBtn}
          aria-label="Minimize"
          onClick={() => electron.windowMinimize()}
          type="button"
        >
          <MinusIcon size={12} weight="bold" />
        </button>
        <button
          className={css.controlBtn}
          aria-label={maximized ? 'Restore' : 'Maximize'}
          onClick={() => electron.windowMaximize()}
          type="button"
        >
          <SquareIcon size={10} weight="bold" />
        </button>
        <button
          className={`${css.controlBtn} ${css.closeBtn}`}
          aria-label="Close"
          onClick={() => electron.windowClose()}
          type="button"
        >
          <XIcon size={12} weight="bold" />
        </button>
      </div>
    </div>
  );
}
