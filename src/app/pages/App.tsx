import React, { useEffect } from 'react';
import { Provider as JotaiProvider } from 'jotai';
import { OverlayContainerProvider, PopOutContainerProvider, TooltipContainerProvider } from 'folds';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { IconContext } from '@phosphor-icons/react';

import { ClientConfigLoader } from '../components/ClientConfigLoader';
import { ClientConfigProvider } from '../hooks/useClientConfig';
import { ConfigConfigError, ConfigConfigLoading } from './ConfigConfig';
import { FeatureCheck } from './FeatureCheck';
import { createRouter } from './Router';
import { ScreenSizeProvider, useScreenSize } from '../hooks/useScreenSize';
import { useCompositionEndTracking } from '../hooks/useComposingCheck';
import { setSessionOverride, getSessionForSlot } from '../state/sessions';
import { ElectronTitlebar } from '../components/electron/ElectronTitlebar';
import { migrateStorageKeys } from '../utils/storageMigration';

// Migrate legacy Cinny storage keys to BetterCord keys on startup
migrateStorageKeys();

// Detect secondary account slot from URL (browser router) or sessionStorage (hash router)
const _slotMatch = window.location.pathname.match(/^\/account\/(\d+)(\/|$)/);
const _sessionSlot = (() => {
  const s = sessionStorage.getItem('bettercord-account-slot');
  return s !== null ? parseInt(s, 10) : null;
})();
const _accountSlot = _slotMatch ? parseInt(_slotMatch[1], 10) : _sessionSlot;
if (_accountSlot !== null) {
  const _sess = getSessionForSlot(_accountSlot);
  if (_sess) {
    setSessionOverride(_sess);
  } else {
    sessionStorage.removeItem('bettercord-account-slot');
  }
}
const _basename = _slotMatch ? `/account/${_accountSlot}/` : undefined;

const queryClient = new QueryClient();

/**
 * When Electron titlebar is present, push the root container down so nothing
 * is obscured behind the titlebar. On macOS only a small drag-region renders
 * (28px) so we only need padding on Windows/Linux (32px).
 */
function useElectronRootPadding() {
  useEffect(() => {
    const electron = window.electron;
    if (!electron) return;
    const isMac = electron.platform === 'darwin';
    const root = document.getElementById('root');
    if (!root) return;
    root.style.paddingTop = isMac ? '38px' : '32px';
    return () => {
      root.style.paddingTop = '';
    };
  }, []);
}

function App() {
  const screenSize = useScreenSize();
  useCompositionEndTracking();
  useElectronRootPadding();

  const portalContainer = document.getElementById('portalContainer') ?? undefined;

  return (
    <IconContext.Provider value={{ weight: 'fill', color: 'currentColor' }}>
    <ElectronTitlebar />
    <TooltipContainerProvider value={portalContainer}>
      <PopOutContainerProvider value={portalContainer}>
        <OverlayContainerProvider value={portalContainer}>
          <ScreenSizeProvider value={screenSize}>
            <FeatureCheck>
              <ClientConfigLoader
                fallback={() => <ConfigConfigLoading />}
                error={(err, retry, ignore) => (
                  <ConfigConfigError error={err} retry={retry} ignore={ignore} />
                )}
              >
                {(clientConfig) => (
                  <ClientConfigProvider value={clientConfig}>
                    <QueryClientProvider client={queryClient}>
                      <JotaiProvider>
                        <RouterProvider router={createRouter(clientConfig, screenSize, _basename)} />
                      </JotaiProvider>
                      <ReactQueryDevtools initialIsOpen={false} />
                    </QueryClientProvider>
                  </ClientConfigProvider>
                )}
              </ClientConfigLoader>
            </FeatureCheck>
          </ScreenSizeProvider>
        </OverlayContainerProvider>
      </PopOutContainerProvider>
    </TooltipContainerProvider>
    </IconContext.Provider>
  );
}

export default App;
