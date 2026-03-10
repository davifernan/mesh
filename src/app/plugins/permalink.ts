import { matchPath } from 'react-router-dom';
import { HashRouterConfig } from '../hooks/useClientConfig';
import {
  decodeSearchParamValueArray,
  encodeSearchParamValueArray,
  getDirectRoomPath,
  getHomeRoomPath,
  getOriginBaseUrl,
  getSpacePath,
  getSpaceRoomPath,
  withOriginBaseUrl,
  withSearchParam,
} from '../pages/pathUtils';
import { _RoomSearchParams, DIRECT_ROOM_PATH, HOME_ROOM_PATH, SPACE_PATH, SPACE_ROOM_PATH } from '../pages/paths';
import { trimTrailingSlash } from '../utils/common';

const PERMALINK_BASE = 'https://bettercord.local';

const isMatrixEntityId = (value?: string): value is string =>
  typeof value === 'string' && (value.startsWith('!') || value.startsWith('#'));

const isMatrixEventId = (value?: string): value is string =>
  value === undefined || (typeof value === 'string' && value.startsWith('$'));

const getViaServers = (searchParams: URLSearchParams): string[] | undefined => {
  const viaServersParam = searchParams.get('viaServers');
  if (!viaServersParam) return undefined;

  const viaServers = decodeSearchParamValueArray(viaServersParam).filter(Boolean);
  return viaServers.length > 0 ? viaServers : undefined;
};

const withViaServers = (path: string, viaServers?: string[]): string => {
  if (!viaServers || viaServers.length === 0) return path;

  return withSearchParam<_RoomSearchParams>(path, {
    viaServers: encodeSearchParamValueArray(viaServers),
  });
};

const getBasePath = (origin: string): string => {
  const basePath = new URL(import.meta.env.BASE_URL ?? '/', `${origin}/`).pathname;
  return trimTrailingSlash(basePath);
};

const normaliseAppPath = (path: string): string => {
  const url = new URL(path, PERMALINK_BASE);
  return `${url.pathname}${url.search}`;
};

const getAppPathCandidates = (href: string): string[] => {
  try {
    const url = new URL(href);
    if (!/^https?:$/.test(url.protocol)) return [];
    if (url.origin !== window.location.origin) return [];

    const candidates = new Set<string>();
    const basePath = getBasePath(url.origin);
    const pathname = trimTrailingSlash(url.pathname);

    if (basePath === '' || pathname === basePath || pathname.startsWith(`${basePath}/`)) {
      const pathWithoutBase = pathname.slice(basePath.length) || '/';
      const appPath = pathWithoutBase.startsWith('/') ? pathWithoutBase : `/${pathWithoutBase}`;
      candidates.add(normaliseAppPath(`${appPath}${url.search}`));
    }

    if (url.hash.startsWith('#/')) {
      const hashPath = normaliseAppPath(url.hash.slice(1));
      candidates.add(hashPath);

      const hashUrl = new URL(hashPath, PERMALINK_BASE);
      const segments = hashUrl.pathname.split('/').filter(Boolean);
      if (segments.length > 1) {
        candidates.add(normaliseAppPath(`/${segments.slice(1).join('/')}${hashUrl.search}`));
      }
    }

    return Array.from(candidates);
  } catch {
    return [];
  }
};

export type BetterCordPermalink =
  | {
      kind: 'space';
      spaceIdOrAlias: string;
      viaServers?: string[];
    }
  | {
      kind: 'room';
      roomIdOrAlias: string;
      eventId?: string;
      viaServers?: string[];
      spaceIdOrAlias?: string;
      direct?: boolean;
    };

export const getBetterCordPermalinkPath = (permalink: BetterCordPermalink): string => {
  if (permalink.kind === 'space') {
    return withViaServers(getSpacePath(permalink.spaceIdOrAlias), permalink.viaServers);
  }

  if (permalink.spaceIdOrAlias) {
    return withViaServers(
      getSpaceRoomPath(permalink.spaceIdOrAlias, permalink.roomIdOrAlias, permalink.eventId),
      permalink.viaServers
    );
  }

  if (permalink.direct) {
    return withViaServers(
      getDirectRoomPath(permalink.roomIdOrAlias, permalink.eventId),
      permalink.viaServers
    );
  }

  return withViaServers(
    getHomeRoomPath(permalink.roomIdOrAlias, permalink.eventId),
    permalink.viaServers
  );
};

export const getBetterCordPermalink = (
  permalink: BetterCordPermalink,
  hashRouter?: HashRouterConfig
): string => withOriginBaseUrl(getOriginBaseUrl(hashRouter), getBetterCordPermalinkPath(permalink));

export const parseBetterCordPermalink = (href: string): BetterCordPermalink | undefined => {
  const candidates = getAppPathCandidates(href);

  return candidates.reduce<BetterCordPermalink | undefined>((match, candidate) => {
    if (match) return match;

    const url = new URL(candidate, PERMALINK_BASE);
    const pathname = decodeURIComponent(url.pathname);
    const viaServers = getViaServers(url.searchParams);

    const directMatch = matchPath(DIRECT_ROOM_PATH, pathname);
    if (
      directMatch &&
      isMatrixEntityId(directMatch.params.roomIdOrAlias) &&
      isMatrixEventId(directMatch.params.eventId)
    ) {
      return {
        kind: 'room',
        roomIdOrAlias: directMatch.params.roomIdOrAlias,
        eventId: directMatch.params.eventId,
        viaServers,
        direct: true,
      };
    }

    const homeMatch = matchPath(HOME_ROOM_PATH, pathname);
    if (
      homeMatch &&
      isMatrixEntityId(homeMatch.params.roomIdOrAlias) &&
      isMatrixEventId(homeMatch.params.eventId)
    ) {
      return {
        kind: 'room',
        roomIdOrAlias: homeMatch.params.roomIdOrAlias,
        eventId: homeMatch.params.eventId,
        viaServers,
      };
    }

    const spaceRoomMatch = matchPath(SPACE_ROOM_PATH, pathname);
    if (
      spaceRoomMatch &&
      isMatrixEntityId(spaceRoomMatch.params.spaceIdOrAlias) &&
      isMatrixEntityId(spaceRoomMatch.params.roomIdOrAlias) &&
      isMatrixEventId(spaceRoomMatch.params.eventId)
    ) {
      return {
        kind: 'room',
        spaceIdOrAlias: spaceRoomMatch.params.spaceIdOrAlias,
        roomIdOrAlias: spaceRoomMatch.params.roomIdOrAlias,
        eventId: spaceRoomMatch.params.eventId,
        viaServers,
      };
    }

    const spaceMatch = matchPath(SPACE_PATH, pathname);
    if (spaceMatch && isMatrixEntityId(spaceMatch.params.spaceIdOrAlias)) {
      return {
        kind: 'space',
        spaceIdOrAlias: spaceMatch.params.spaceIdOrAlias,
        viaServers,
      };
    }

    return undefined;
  }, undefined);
};

export const testBetterCordPermalink = (href: string): boolean =>
  parseBetterCordPermalink(href) !== undefined;
