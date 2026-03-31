import React, { useCallback, useEffect } from 'react';
import { Scroll, Spinner, Text, color } from 'folds';
import {
  Outlet,
  generatePath,
  matchPath,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import classNames from 'classnames';

import { AuthFooter } from './AuthFooter';
import * as css from './styles.css';
import {
  clientAllowedServer,
  clientDefaultServer,
  useClientConfig,
} from '../../hooks/useClientConfig';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { LOGIN_PATH, REGISTER_PATH, RESET_PASSWORD_PATH } from '../paths';
import { ServerPicker } from './ServerPicker';
import { AutoDiscoveryAction, autoDiscovery } from '../../cs-api';
import { SpecVersionsLoader } from '../../components/SpecVersionsLoader';
import { SpecVersionsProvider } from '../../hooks/useSpecVersions';
import { AutoDiscoveryInfoProvider } from '../../hooks/useAutoDiscoveryInfo';
import { AuthFlowsLoader } from '../../components/AuthFlowsLoader';
import { AuthFlowsProvider } from '../../hooks/useAuthFlows';
import { AuthServerProvider } from '../../hooks/useAuthServer';
import { tryDecodeURIComponent } from '../../utils/dom';

const currentAuthPath = (pathname: string): string => {
  if (matchPath(LOGIN_PATH, pathname)) {
    return LOGIN_PATH;
  }
  if (matchPath(RESET_PASSWORD_PATH, pathname)) {
    return RESET_PASSWORD_PATH;
  }
  if (matchPath(REGISTER_PATH, pathname)) {
    return REGISTER_PATH;
  }
  return LOGIN_PATH;
};

function AuthLayoutLoading({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
      <Spinner size="100" variant="Secondary" />
      <Text align="Center" size="T300">
        {message}
      </Text>
    </div>
  );
}

function AuthLayoutError({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <Text align="Center" style={{ color: color.Critical.Main }} size="T300">
        {message}
      </Text>
    </div>
  );
}

export function AuthLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { server: urlEncodedServer } = useParams();

  const clientConfig = useClientConfig();

  const defaultServer = clientDefaultServer(clientConfig);
  let server: string = urlEncodedServer ? tryDecodeURIComponent(urlEncodedServer) : defaultServer;

  if (!clientAllowedServer(clientConfig, server)) {
    server = defaultServer;
  }

  const [discoveryState, discoverServer] = useAsyncCallback(
    useCallback(async (serverName: string) => {
      const response = await autoDiscovery(fetch, serverName);
      return {
        serverName,
        response,
      };
    }, [])
  );

  useEffect(() => {
    if (server) discoverServer(server);
  }, [discoverServer, server]);

  useEffect(() => {
    if (!urlEncodedServer || tryDecodeURIComponent(urlEncodedServer) !== server) {
      navigate(
        generatePath(currentAuthPath(location.pathname), {
          server: encodeURIComponent(server),
        }),
        { replace: true }
      );
    }
  }, [urlEncodedServer, navigate, location, server]);

  const selectServer = useCallback(
    (newServer: string) => {
      if (newServer === server) {
        if (discoveryState.status === AsyncStatus.Loading) return;
        discoverServer(server);
        return;
      }
      navigate(
        generatePath(currentAuthPath(location.pathname), { server: encodeURIComponent(newServer) })
      );
    },
    [navigate, location, discoveryState, server, discoverServer]
  );

  const [autoDiscoveryError, autoDiscoveryInfo] =
    discoveryState.status === AsyncStatus.Success ? discoveryState.data.response : [];

  return (
    <Scroll variant="Background" visibility="Hover" size="300" hideTrack>
      <div className={css.AuthLayout}>
        <div className={css.AuthCard}>
          {/* LEFT: mesh logo side (33%) */}
          <div className={css.AuthLogoSide}>
            <div className={css.AuthLogoContent}>
              <svg className={css.AuthLogoMark} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                <defs>
                  <linearGradient id="lbg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#5ea6ff" />
                    <stop offset="40%" stopColor="#4a5ef8" />
                    <stop offset="100%" stopColor="#24258b" />
                  </linearGradient>
                  <filter id="lsh" x="-20%" y="-20%" width="150%" height="150%">
                    <feDropShadow dx="4" dy="8" stdDeviation="6" floodColor="#070a3a" floodOpacity="0.45"/>
                  </filter>
                  <radialGradient id="lnw" cx="35%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="50%" stopColor="#f0f6ff" />
                    <stop offset="100%" stopColor="#b6d0fa" />
                  </radialGradient>
                </defs>
                <rect x="24" y="24" width="464" height="464" rx="115" ry="115" fill="url(#lbg)" />
                <g filter="url(#lsh)">
                  <g stroke="#f0f6ff" strokeWidth="22" strokeLinecap="round">
                    <line x1="205" y1="115" x2="380" y2="155" />
                    <line x1="380" y1="155" x2="380" y2="315" />
                    <line x1="380" y1="315" x2="205" y2="385" />
                    <line x1="205" y1="385" x2="110" y2="260" />
                    <line x1="110" y1="260" x2="205" y2="115" />
                    <line x1="205" y1="115" x2="256" y2="220" />
                    <line x1="380" y1="155" x2="256" y2="220" />
                    <line x1="380" y1="315" x2="256" y2="220" />
                    <line x1="205" y1="385" x2="256" y2="220" />
                    <line x1="110" y1="260" x2="256" y2="220" />
                  </g>
                  <circle cx="205" cy="115" r="30" fill="url(#lnw)" />
                  <circle cx="380" cy="155" r="30" fill="url(#lnw)" />
                  <circle cx="256" cy="220" r="32" fill="url(#lnw)" />
                  <circle cx="380" cy="315" r="30" fill="url(#lnw)" />
                  <circle cx="205" cy="385" r="30" fill="url(#lnw)" />
                  <circle cx="110" cy="260" r="30" fill="url(#lnw)" />
                </g>
              </svg>
              <h2 className={css.AuthBrandName}>mesh</h2>
              <p className={css.AuthTagline}>Privacy-first communities on Matrix</p>
            </div>
          </div>

          {/* RIGHT: Form side (67%) — server picker + auth form */}
          <div className={css.AuthCardContent}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Text as="label" htmlFor="auth-server-input" size="L400" priority="300">
                Homeserver
              </Text>
              <ServerPicker
                server={server}
                serverList={clientConfig.homeserverList ?? []}
                allowCustomServer={clientConfig.allowCustomHomeservers}
                onServerChange={selectServer}
              />
            </div>

            {discoveryState.status === AsyncStatus.Loading && (
              <AuthLayoutLoading message="Looking for homeserver..." />
            )}
            {discoveryState.status === AsyncStatus.Error && (
              <AuthLayoutError message="Failed to find homeserver." />
            )}
            {autoDiscoveryError?.action === AutoDiscoveryAction.FAIL_PROMPT && (
              <AuthLayoutError
                message={`Failed to connect. Homeserver configuration found with ${autoDiscoveryError.host} appears unusable.`}
              />
            )}
            {autoDiscoveryError?.action === AutoDiscoveryAction.FAIL_ERROR && (
              <AuthLayoutError message="Failed to connect. Homeserver configuration base_url appears invalid." />
            )}
            {discoveryState.status === AsyncStatus.Success && autoDiscoveryInfo && (
              <AuthServerProvider value={discoveryState.data.serverName}>
                <AutoDiscoveryInfoProvider value={autoDiscoveryInfo}>
                  <SpecVersionsLoader
                    baseUrl={autoDiscoveryInfo['m.homeserver'].base_url}
                    fallback={() => (
                      <AuthLayoutLoading
                        message={`Connecting to ${autoDiscoveryInfo['m.homeserver'].base_url}`}
                      />
                    )}
                    error={() => (
                      <AuthLayoutError message="Failed to connect. Either homeserver is unavailable at this moment or does not exist." />
                    )}
                  >
                    {(specVersions) => (
                      <SpecVersionsProvider value={specVersions}>
                        <AuthFlowsLoader
                          fallback={() => (
                            <AuthLayoutLoading message="Loading authentication flow..." />
                          )}
                          error={() => (
                            <AuthLayoutError message="Failed to get authentication flow information." />
                          )}
                        >
                          {(authFlows) => (
                            <AuthFlowsProvider value={authFlows}>
                              <Outlet />
                            </AuthFlowsProvider>
                          )}
                        </AuthFlowsLoader>
                      </SpecVersionsProvider>
                    )}
                  </SpecVersionsLoader>
                </AutoDiscoveryInfoProvider>
              </AuthServerProvider>
            )}
          </div>
        </div>
        <AuthFooter />
      </div>
    </Scroll>
  );
}
