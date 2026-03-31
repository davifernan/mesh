import {
  Box,
  Button,
  config,
  Dialog,
  Icon,
  IconButton,
  Icons,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Spinner,
  Text,
} from 'folds';
import {
  HttpApiEvent,
  HttpApiEventHandlerMap,
  MatrixClient,
  validateAuthMetadata,
} from 'matrix-js-sdk';
import FocusTrap from 'focus-trap-react';
import React, { MouseEventHandler, ReactNode, useCallback, useEffect, useState } from 'react';
import {
  clearCacheAndReload,
  clearLoginData,
  initClient,
  logoutClient,
  startClient,
} from '../../../client/initMatrix';
import { SplashScreen } from '../../components/splash-screen';
import { CapabilitiesProvider } from '../../hooks/useCapabilities';
import { MediaConfigProvider } from '../../hooks/useMediaConfig';
import { MatrixClientProvider } from '../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { useSyncState } from '../../hooks/useSyncState';
import { stopPropagation } from '../../utils/keyboard';
import { SyncStatus } from './SyncStatus';
import { AuthMetadataProvider } from '../../hooks/useAuthMetadata';
import { getFallbackSession, getSessionAsync, removeSecondarySession } from '../../state/sessions';
import { specVersions, SpecVersions as SpecVersionsData } from '../../cs-api';
import { SpecVersionsProvider } from '../../hooks/useSpecVersions';
import type { ServerConfigs } from '../../components/ServerConfigsLoader';

async function prefetchServerConfigs(mx: MatrixClient): Promise<ServerConfigs> {
  const [capsResult, mediaResult, authResult] = await Promise.allSettled([
    mx.getCapabilities(),
    mx.getMediaConfig(),
    mx.getAuthMetadata(),
  ]);
  const capabilities = capsResult.status === 'fulfilled' ? capsResult.value : undefined;
  const mediaConfig = mediaResult.status === 'fulfilled' ? mediaResult.value : undefined;
  const authMetadataRaw = authResult.status === 'fulfilled' ? authResult.value : undefined;
  let authMetadata;
  try {
    authMetadata = validateAuthMetadata(authMetadataRaw);
  } catch {
    // ignore — authMetadata stays undefined
  }
  return { capabilities, mediaConfig, authMetadata };
}

const LOADING_TIMEOUT_MS = 30_000;

type ClientRootLoadingProps = {
  mx?: MatrixClient;
  onRetry: () => void;
  onClearCache: () => void;
  onLogout: () => void;
};

function ClientRootLoading({ mx, onRetry, onClearCache, onLogout }: ClientRootLoadingProps) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), LOADING_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);

  if (timedOut) {
    return (
      <SplashScreen>
        <Box direction="Column" grow="Yes" alignItems="Center" justifyContent="Center" gap="400">
          <Dialog>
            <Box direction="Column" gap="400" style={{ padding: config.space.S400 }}>
              <Box direction="Column" gap="100">
                <Text size="H5">Taking longer than expected</Text>
                <Text size="T300" style={{ opacity: 0.7 }}>
                  Could not connect to your homeserver. Check your internet connection or try
                  clearing the cache.
                </Text>
              </Box>
              <Button variant="Primary" onClick={onRetry}>
                <Text as="span" size="B400">Retry</Text>
              </Button>
              <Button variant="Secondary" fill="Soft" onClick={onClearCache}>
                <Text as="span" size="B400">Clear Cache &amp; Reload</Text>
              </Button>
              <Button variant="Critical" fill="None" onClick={onLogout}>
                <Text as="span" size="B400">Logout</Text>
              </Button>
            </Box>
          </Dialog>
        </Box>
      </SplashScreen>
    );
  }

  return (
    <SplashScreen>
      <Box direction="Column" grow="Yes" alignItems="Center" justifyContent="Center" gap="400">
        <Spinner variant="Secondary" size="600" />
        <Text>Heating up</Text>
      </Box>
    </SplashScreen>
  );
}

function ClientRootOptions({ mx }: { mx?: MatrixClient }) {
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();

  const handleToggle: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const cords = evt.currentTarget.getBoundingClientRect();
    setMenuAnchor((currentState) => {
      if (currentState) return undefined;
      return cords;
    });
  };

  return (
    <IconButton
      style={{
        position: 'absolute',
        top: config.space.S100,
        right: config.space.S100,
      }}
      variant="Background"
      fill="None"
      onClick={handleToggle}
      aria-label="More options"
      aria-pressed={!!menuAnchor}
    >
      <Icon size="200" src={Icons.VerticalDots} />
      <PopOut
        anchor={menuAnchor}
        position="Bottom"
        align="End"
        offset={6}
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              returnFocusOnDeactivate: false,
              onDeactivate: () => setMenuAnchor(undefined),
              clickOutsideDeactivates: true,
              isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
              isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
              escapeDeactivates: stopPropagation,
            }}
          >
            <Menu role="menu">
              <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
                {mx && (
                  <MenuItem onClick={() => clearCacheAndReload(mx)} size="300" radii="300">
                    <Text as="span" size="T300" truncate>
                      Clear Cache and Reload
                    </Text>
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => {
                    if (mx) {
                      logoutClient(mx);
                      return;
                    }
                    // No client yet — check if this is a secondary account page so we
                    // don't accidentally wipe the main account's localStorage.
                    const slotStr = sessionStorage.getItem('mesh-account-slot');
                    const slot = slotStr !== null ? parseInt(slotStr, 10) : null;
                    const pathSlotMatch = window.location.pathname.match(/^\/account\/(\d+)/);
                    if (slot !== null || pathSlotMatch) {
                      if (slot !== null) {
                        removeSecondarySession(slot);
                        sessionStorage.removeItem('mesh-account-slot');
                      } else if (pathSlotMatch) {
                        removeSecondarySession(parseInt(pathSlotMatch[1], 10));
                      }
                      window.location.assign('/');
                    } else {
                      clearLoginData();
                    }
                  }}
                  size="300"
                  radii="300"
                  variant="Critical"
                  fill="None"
                >
                  <Text as="span" size="T300" truncate>
                    Logout
                  </Text>
                </MenuItem>
              </Box>
            </Menu>
          </FocusTrap>
        }
      />
    </IconButton>
  );
}

const useLogoutListener = (mx?: MatrixClient) => {
  useEffect(() => {
    const handleLogout: HttpApiEventHandlerMap[HttpApiEvent.SessionLoggedOut] = async () => {
      mx?.stopClient();
      await mx?.clearStores();
      const slot = sessionStorage.getItem('mesh-account-slot');
      if (slot !== null) {
        // Secondary account session expired — remove it and return to main
        removeSecondarySession(parseInt(slot, 10));
        sessionStorage.removeItem('mesh-account-slot');
        window.location.assign('/');
      } else {
        window.localStorage.clear();
        window.location.reload();
      }
    };

    mx?.on(HttpApiEvent.SessionLoggedOut, handleLogout);
    return () => {
      mx?.removeListener(HttpApiEvent.SessionLoggedOut, handleLogout);
    };
  }, [mx]);
};

type ClientRootProps = {
  children: ReactNode;
};
function StoreDegradedBanner({ mx }: { mx?: MatrixClient }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: config.space.S400,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        backgroundColor: 'var(--background-header-primary)',
        border: '1px solid var(--bg-warning)',
        borderRadius: '0.5rem',
        padding: `${config.space.S200} ${config.space.S400}`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: config.space.S300,
        maxWidth: '28rem',
      }}
    >
      <Text size="T300" style={{ flex: 1 }}>
        Storage error — some data may be unavailable. Please reload.
      </Text>
      <Button
        size="300"
        variant="Primary"
        onClick={() => (mx ? clearCacheAndReload(mx) : window.location.reload())}
      >
        <Text as="span" size="B300">Reload</Text>
      </Button>
    </div>
  );
}

export function ClientRoot({ children }: ClientRootProps) {
  const [loading, setLoading] = useState(true);
  const [storeDegraded, setStoreDegraded] = useState(false);
  const { baseUrl } = getFallbackSession() ?? {};

  // Fetch spec versions in parallel with initClient — children use empty fallback until resolved
  const [specVersionsData, setSpecVersionsData] = useState<SpecVersionsData>({ versions: [] });
  useEffect(() => {
    if (!baseUrl) return;
    specVersions(fetch, baseUrl)
      .then(setSpecVersionsData)
      .catch(() => {
        // keep empty fallback — features degrade gracefully, sync failure will surface if server is down
      });
  }, [baseUrl]);

  const [loadState, loadMatrix] = useAsyncCallback<MatrixClient, Error, []>(
    useCallback(async () => {
      const session = await getSessionAsync();
      if (!session) {
        // Session is unrecoverable (e.g. encryption key lost after browser restart).
        // Clean up stale data and redirect to login instead of hanging on "Heating up".
        clearLoginData();
        // clearLoginData() triggers a page reload → this error is only a safety-net
        // in case the reload is delayed.
        throw new Error('Session expired. Redirecting to login…');
      }
      return initClient(session);
    }, [])
  );
  const mx = loadState.status === AsyncStatus.Success ? loadState.data : undefined;
  const [startState, startMatrix] = useAsyncCallback<void, Error, [MatrixClient]>(
    useCallback((m) => startClient(m), [])
  );

  // Start server config fetches as soon as mx is available — before /sync completes
  const [serverConfigs, setServerConfigs] = useState<ServerConfigs>({});
  useEffect(() => {
    if (!mx) return;
    prefetchServerConfigs(mx).then(setServerConfigs).catch(() => {
      // keep empty fallback
    });
  }, [mx]);

  useLogoutListener(mx);

  useEffect(() => {
    const handler = () => setStoreDegraded(true);
    window.addEventListener('mesh:store-degraded', handler);
    return () => window.removeEventListener('mesh:store-degraded', handler);
  }, []);

  useEffect(() => {
    if (loadState.status === AsyncStatus.Idle) {
      loadMatrix();
    }
  }, [loadState, loadMatrix]);

  useEffect(() => {
    if (mx && !mx.clientRunning) {
      startMatrix(mx);
    }
  }, [mx, startMatrix]);

  useSyncState(
    mx,
    useCallback((state) => {
      if (state === 'PREPARED' || state === 'SYNCING') {
        setLoading(false);
      }
    }, [])
  );

  return (
    <SpecVersionsProvider value={specVersionsData}>
      {storeDegraded && <StoreDegradedBanner mx={mx} />}
      {mx && <SyncStatus mx={mx} />}
      {loading && <ClientRootOptions mx={mx} />}
      {(loadState.status === AsyncStatus.Error || startState.status === AsyncStatus.Error) && (
        <SplashScreen>
          <Box direction="Column" grow="Yes" alignItems="Center" justifyContent="Center" gap="400">
            <Dialog>
              <Box direction="Column" gap="400" style={{ padding: config.space.S400 }}>
                {loadState.status === AsyncStatus.Error && (
                  <Text>{`Failed to load. ${loadState.error.message}`}</Text>
                )}
                {startState.status === AsyncStatus.Error && (
                  <Text>{`Failed to start. ${startState.error.message}`}</Text>
                )}
                <Button variant="Critical" onClick={mx ? () => startMatrix(mx) : loadMatrix}>
                  <Text as="span" size="B400">
                    Retry
                  </Text>
                </Button>
                <Button
                  variant="Secondary"
                  fill="Soft"
                  onClick={mx ? () => clearCacheAndReload(mx) : clearLoginData}
                >
                  <Text as="span" size="B400">
                    Clear Cache
                  </Text>
                </Button>
              </Box>
            </Dialog>
          </Box>
        </SplashScreen>
      )}
      {(loading || !mx) &&
        loadState.status !== AsyncStatus.Error &&
        startState.status !== AsyncStatus.Error && (
          <ClientRootLoading
            mx={mx}
            onRetry={mx ? () => startMatrix(mx) : loadMatrix}
            onClearCache={mx ? () => clearCacheAndReload(mx) : clearLoginData}
            onLogout={mx ? () => logoutClient(mx) : clearLoginData}
          />
        )}
      {!loading && mx && (
        <MatrixClientProvider value={mx}>
          <CapabilitiesProvider value={serverConfigs.capabilities ?? {}}>
            <MediaConfigProvider value={serverConfigs.mediaConfig ?? {}}>
              <AuthMetadataProvider value={serverConfigs.authMetadata}>
                {children}
              </AuthMetadataProvider>
            </MediaConfigProvider>
          </CapabilitiesProvider>
        </MatrixClientProvider>
      )}
    </SpecVersionsProvider>
  );
}
