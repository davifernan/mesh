import { createContext, useContext } from 'react';

export type HashRouterConfig = {
  enabled?: boolean;
  basename?: string;
};

export type ClientConfig = {
  defaultHomeserver?: number;
  homeserverList?: string[];
  allowCustomHomeservers?: boolean;

  featuredCommunities?: {
    openAsDefault?: boolean;
    spaces?: string[];
    rooms?: string[];
    servers?: string[];
  };

  hashRouter?: HashRouterConfig;

  /** @deprecated replaced by livekitServiceUrl */
  elementCallUrl?: string;

  /**
   * LiveKit JWT service URL — used as fallback when a voice channel room
   * does not yet have an org.matrix.msc3401.call state event.
   * Set via BETTERCORD_LIVEKIT_URL env var (Docker) or directly in config.json.
   * Example: "https://livekit-jwt.example.com"
   */
  livekitServiceUrl?: string;

  /**
   * Presence bridge base URL for SSE streams.
   * Set via BETTERCORD_PRESENCE_URL env var (Docker) or directly in config.json.
   * Defaults to "/api/presence" (proxied through nginx) if not set.
   * Example: "https://presence.example.com/presence"
   */
  presenceUrl?: string;

  /**
   * Coarse-grained voice state mode for deploy-time rollouts.
   *
   * - `livekit` keeps the historic UI preference chain.
   * - `bridge` makes the backend bridge authoritative for sidebar presence.
   *
   * Feature flags below still take precedence when explicitly set.
   */
  voiceStateMode?: 'livekit' | 'bridge';

  /**
   * Feature flags for the authoritative bridge migration.
   */
  featureFlags?: {
    /**
     * When true, the bridge is treated as the authoritative source of voice state
     * for ALL users (including the local user). The local LiveKit client state is
     * still used for immediate UI feedback but the bridge snapshot is preferred for
     * non-participant observers.
     *
     * Default: false (backward-compatible — local state wins for local user,
     * bridge is a fallback for remote users).
     */
    authoritativeBridgeMode?: boolean;

    /**
     * When true, AV1 is used as the primary video codec (with VP8 as backupCodec).
     * AV1 provides ~30–50% better compression than VP8 at the same quality.
     * Requires Chrome 70+, Edge 79+, or Firefox 93+.
     * Falls back to VP8 automatically on unsupported clients via backupCodec.
     *
     * Default: false (keep VP8 for backward compat — safe to enable for modern clients).
     */
    av1Video?: boolean;
  };
};

const ClientConfigContext = createContext<ClientConfig | null>(null);

export const ClientConfigProvider = ClientConfigContext.Provider;

export type ResolvedVoiceFeatureFlags = {
  authoritativeBridgeMode: boolean;
};

export function useClientConfig(): ClientConfig {
  const config = useContext(ClientConfigContext);
  if (!config) throw new Error('Client config are not provided!');
  return config;
}

export const resolveVoiceFeatureFlags = (
  clientConfig: ClientConfig,
): ResolvedVoiceFeatureFlags => {
  const mode = clientConfig.voiceStateMode ?? 'livekit';

  return {
    authoritativeBridgeMode:
      clientConfig.featureFlags?.authoritativeBridgeMode ?? mode === 'bridge',
  };
};

export const clientDefaultServer = (clientConfig: ClientConfig): string =>
  clientConfig.homeserverList?.[clientConfig.defaultHomeserver ?? 0] ?? 'matrix.org';

export const clientAllowedServer = (clientConfig: ClientConfig, server: string): boolean => {
  const { homeserverList, allowCustomHomeservers } = clientConfig;

  if (allowCustomHomeservers) return true;

  return homeserverList?.includes(server) === true;
};
