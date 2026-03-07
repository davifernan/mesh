import React, { useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  config,
  Icon,
  IconButton,
  Icons,
  MenuItem,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Text,
} from 'folds';
import {
  UserCircle,
  Bell,
  Microphone,
  Monitor,
  SmileySticker,
  Code,
  Info,
  Keyboard,
  Sliders,
  SignOut,
} from '@phosphor-icons/react';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import FocusTrap from 'focus-trap-react';
import { General } from './general';
import { PageNav, PageNavContent, PageNavHeader, PageRoot } from '../../components/page';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { Account } from './account';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { mxcUrlToHttp } from '../../utils/matrix';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { UserAvatar } from '../../components/user-avatar';
import { Notifications } from './notifications';
import { Devices } from './devices';
import { EmojisStickers } from './emojis-stickers';
import { DeveloperTools } from './developer-tools';
import { About } from './about';
import { KeyboardShortcuts } from './keyboard-shortcuts/KeyboardShortcuts';
import { VoiceVideo } from './voice-video';
import { UseStateProvider } from '../../components/UseStateProvider';
import { stopPropagation } from '../../utils/keyboard';
import { LogoutDialog } from '../../components/LogoutDialog';

export enum SettingsPages {
  GeneralPage,
  AccountPage,
  NotificationPage,
  VoiceVideoPage,
  DevicesPage,
  EmojisStickersPage,
  DeveloperToolsPage,
  AboutPage,
  KeyboardShortcutsPage,
}

type SettingsMenuItem = {
  page: SettingsPages;
  name: string;
  PhosphorIcon: React.ComponentType<{ size?: number; weight?: 'regular' | 'bold' | 'fill' }>;
};

type SettingsMenuCategory = {
  label: string;
  items: SettingsMenuItem[];
};

const SETTINGS_CATEGORIES: SettingsMenuCategory[] = [
  {
    label: 'MY ACCOUNT',
    items: [
      { page: SettingsPages.AccountPage, name: 'Account', PhosphorIcon: UserCircle },
    ],
  },
  {
    label: 'APP SETTINGS',
    items: [
      { page: SettingsPages.GeneralPage, name: 'General', PhosphorIcon: Sliders },
      { page: SettingsPages.NotificationPage, name: 'Notifications', PhosphorIcon: Bell },
      { page: SettingsPages.VoiceVideoPage, name: 'Voice & Video', PhosphorIcon: Microphone },
      { page: SettingsPages.EmojisStickersPage, name: 'Emojis & Stickers', PhosphorIcon: SmileySticker },
    ],
  },
  {
    label: 'ADVANCED',
    items: [
      { page: SettingsPages.DevicesPage, name: 'Devices', PhosphorIcon: Monitor },
      { page: SettingsPages.KeyboardShortcutsPage, name: 'Keyboard Shortcuts', PhosphorIcon: Keyboard },
      { page: SettingsPages.DeveloperToolsPage, name: 'Developer Tools', PhosphorIcon: Code },
      { page: SettingsPages.AboutPage, name: 'About', PhosphorIcon: Info },
    ],
  },
];

type SettingsProps = {
  initialPage?: SettingsPages;
  requestClose: () => void;
};
export function Settings({ initialPage, requestClose }: SettingsProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const userId = mx.getUserId() as string;
  const profile = useUserProfile(userId);
  const avatarUrl = profile.avatarUrl
    ? mxcUrlToHttp(mx, profile.avatarUrl, useAuthentication, 96, 96, 'crop') ?? undefined
    : undefined;

  const screenSize = useScreenSizeContext();
  const [activePage, setActivePage] = useState<SettingsPages | undefined>(() => {
    if (initialPage) return initialPage;
    return screenSize === ScreenSize.Mobile ? undefined : SettingsPages.GeneralPage;
  });

  const handlePageRequestClose = () => {
    if (screenSize === ScreenSize.Mobile) {
      setActivePage(undefined);
      return;
    }
    requestClose();
  };

  return (
    <PageRoot
      nav={
        screenSize === ScreenSize.Mobile && activePage !== undefined ? undefined : (
          <PageNav size="300">
            <PageNavHeader outlined={false}>
              <Box grow="Yes" gap="200">
                <Avatar size="200" radii="300">
                  <UserAvatar
                    userId={userId}
                    src={avatarUrl}
                    renderFallback={() => <Icon size="100" src={Icons.User} filled />}
                  />
                </Avatar>
                <Text size="H4" as="h1" truncate>
                  Settings
                </Text>
              </Box>
              <Box shrink="No">
                {screenSize === ScreenSize.Mobile && (
                  <IconButton onClick={requestClose} variant="Background" aria-label="Close">
                    <Icon src={Icons.Cross} />
                  </IconButton>
                )}
              </Box>
            </PageNavHeader>
            <Box grow="Yes" direction="Column">
              <PageNavContent>
                <Box direction="Column" gap="400">
                  {SETTINGS_CATEGORIES.map((category) => (
                    <Box key={category.label} direction="Column" gap="100">
                      <Text
                        size="L400"
                        priority="300"
                        style={{
                          padding: `0 ${config.space.S300}`,
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {category.label}
                      </Text>
                      {category.items.map((item) => {
                        const isActive = activePage === item.page;
                        return (
                          <MenuItem
                            key={item.name}
                            variant="Background"
                            radii="400"
                            aria-pressed={isActive}
                            before={
                              <item.PhosphorIcon
                                size={18}
                                weight={isActive ? 'fill' : 'regular'}
                              />
                            }
                            onClick={() => setActivePage(item.page)}
                          >
                            <Text
                              style={{
                                fontWeight: isActive ? config.fontWeight.W600 : undefined,
                              }}
                              size="T300"
                              truncate
                            >
                              {item.name}
                            </Text>
                          </MenuItem>
                        );
                      })}
                    </Box>
                  ))}
                </Box>
              </PageNavContent>
              <Box style={{ padding: config.space.S200 }} shrink="No" direction="Column">
                <UseStateProvider initial={false}>
                  {(logout, setLogout) => (
                    <>
                      <Button
                        size="300"
                        variant="Critical"
                        fill="None"
                        radii="Pill"
                        before={<SignOut size={16} weight="bold" />}
                        onClick={() => setLogout(true)}
                      >
                        <Text size="B400">Logout</Text>
                      </Button>
                      {logout && (
                        <Overlay open backdrop={<OverlayBackdrop />}>
                          <OverlayCenter>
                            <FocusTrap
                              focusTrapOptions={{
                                onDeactivate: () => setLogout(false),
                                clickOutsideDeactivates: true,
                                escapeDeactivates: stopPropagation,
                              }}
                            >
                              <LogoutDialog handleClose={() => setLogout(false)} />
                            </FocusTrap>
                          </OverlayCenter>
                        </Overlay>
                      )}
                    </>
                  )}
                </UseStateProvider>
              </Box>
            </Box>
          </PageNav>
        )
      }
    >
      {activePage === SettingsPages.GeneralPage && (
        <General requestClose={handlePageRequestClose} />
      )}
      {activePage === SettingsPages.AccountPage && (
        <Account requestClose={handlePageRequestClose} />
      )}
      {activePage === SettingsPages.NotificationPage && (
        <Notifications requestClose={handlePageRequestClose} />
      )}
      {activePage === SettingsPages.VoiceVideoPage && (
        <VoiceVideo requestClose={handlePageRequestClose} />
      )}
      {activePage === SettingsPages.DevicesPage && (
        <Devices requestClose={handlePageRequestClose} />
      )}
      {activePage === SettingsPages.EmojisStickersPage && (
        <EmojisStickers requestClose={handlePageRequestClose} />
      )}
      {activePage === SettingsPages.DeveloperToolsPage && (
        <DeveloperTools requestClose={handlePageRequestClose} />
      )}
      {activePage === SettingsPages.AboutPage && <About requestClose={handlePageRequestClose} />}
      {activePage === SettingsPages.KeyboardShortcutsPage && (
        <KeyboardShortcuts requestClose={handlePageRequestClose} />
      )}
    </PageRoot>
  );
}
