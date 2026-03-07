/*
 * BetterCord — Electron API type declarations for the Web-App renderer.
 *
 * These types mirror desktop/src/common/Types.tsx so that the Web-App can
 * safely call window.electron?.* without TypeScript errors.
 * window.electron is undefined when running in a normal browser.
 */

export interface DesktopInfo {
  version: string;
  channel: 'stable' | 'canary';
  arch: string;
  hardwareArch: string;
  runningUnderRosetta: boolean;
  os: string;
  osVersion: string;
  systemVersion?: string;
}

export type UpdaterContext = 'user' | 'background' | 'focus';

export type UpdaterEvent =
  | { type: 'checking'; context: UpdaterContext }
  | { type: 'available'; context: UpdaterContext; version: string | null }
  | { type: 'not-available'; context: UpdaterContext }
  | { type: 'downloaded'; context: UpdaterContext; version: string | null }
  | { type: 'progress'; context: UpdaterContext; percent: number; transferred: number; total: number; bytesPerSecond: number }
  | { type: 'error'; context: UpdaterContext; message: string };

export interface DownloadFileResult {
  success: boolean;
  path?: string;
  error?: string;
}

export type MediaAccessType = 'microphone' | 'camera' | 'screen';
export type MediaAccessStatus = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown';

export interface DesktopSource {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  appIconDataUrl?: string;
  display_id?: string;
}

export interface DisplayMediaRequestInfo {
  audioRequested: boolean;
  videoRequested: boolean;
  supportsLoopbackAudio: boolean;
  supportsSystemAudioCapture: boolean;
}

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  url?: string;
}

export interface NotificationResult {
  id: string;
}

export interface SpellcheckState {
  enabled: boolean;
  languages: string[];
}

export interface TextareaContextMenuParams {
  misspelledWord?: string;
  suggestions?: string[];
  editFlags: {
    canUndo: boolean;
    canRedo: boolean;
    canCut: boolean;
    canCopy: boolean;
    canPaste: boolean;
    canSelectAll: boolean;
  };
  x: number;
  y: number;
}

export interface GlobalKeyHookRegisterOptions {
  id: string;
  keycode?: number;
  mouseButton?: number;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export interface GlobalKeyEvent {
  type: 'keydown' | 'keyup';
  keycode: number;
  keyName: string;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export interface GlobalMouseEvent {
  type: 'mousedown' | 'mouseup';
  button: number;
}

export interface GlobalKeybindTriggeredEvent {
  id: string;
  type: 'keydown' | 'keyup';
}

export interface SwitchInstanceUrlOptions {
  instanceUrl: string;
  desktopHandoffCode?: string | null;
}

export interface ElectronAPI {
  platform: string;
  getDesktopInfo: () => Promise<DesktopInfo>;

  onUpdaterEvent: (callback: (event: UpdaterEvent) => void) => () => void;
  updaterCheck: (context: UpdaterContext) => Promise<void>;
  updaterInstall: () => Promise<void>;

  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
  windowIsMaximized: () => Promise<boolean>;
  onWindowMaximizeChange: (callback: (maximized: boolean) => void) => () => void;

  openExternal: (url: string) => Promise<void>;

  clipboardWriteText: (text: string) => Promise<void>;
  clipboardReadText: () => Promise<string>;

  onDeepLink: (callback: (url: string) => void) => () => void;
  getInitialDeepLink: () => Promise<string | null>;

  onRpcNavigate: (callback: (path: string) => void) => () => void;

  registerGlobalShortcut: (accelerator: string, id: string) => Promise<boolean>;
  unregisterGlobalShortcut: (accelerator: string) => Promise<void>;
  unregisterAllGlobalShortcuts: () => Promise<void>;
  onGlobalShortcut: (callback: (id: string) => void) => () => void;

  autostartEnable: () => Promise<void>;
  autostartDisable: () => Promise<void>;
  autostartIsEnabled: () => Promise<boolean>;
  autostartIsInitialized: () => Promise<boolean>;
  autostartMarkInitialized: () => Promise<void>;

  checkMediaAccess: (type: MediaAccessType) => Promise<MediaAccessStatus>;
  requestMediaAccess: (type: MediaAccessType) => Promise<boolean>;
  openMediaAccessSettings: (type: MediaAccessType) => Promise<void>;

  checkAccessibility: (prompt: boolean) => Promise<boolean>;
  openAccessibilitySettings: () => Promise<void>;
  openInputMonitoringSettings: () => Promise<void>;

  downloadFile: (url: string, defaultPath: string) => Promise<DownloadFileResult>;

  toggleDevTools: () => void;

  showNotification: (options: NotificationOptions) => Promise<NotificationResult>;
  closeNotification: (id: string) => void;
  closeNotifications: (ids: string[]) => void;
  onNotificationClick: (callback: (id: string, url?: string) => void) => () => void;

  setBadgeCount: (count: number) => void;
  getBadgeCount: () => Promise<number>;

  bounceDock: (type?: 'critical' | 'informational') => number;
  cancelBounceDock: (id: number) => void;

  setZoomFactor: (factor: number) => void;
  getZoomFactor: () => Promise<number>;

  onZoomIn: (callback: () => void) => () => void;
  onZoomOut: (callback: () => void) => () => void;
  onZoomReset: (callback: () => void) => () => void;

  onOpenSettings: (callback: () => void) => () => void;

  globalKeyHookStart: () => Promise<boolean>;
  globalKeyHookStop: () => Promise<void>;
  globalKeyHookIsRunning: () => Promise<boolean>;
  checkInputMonitoringAccess: () => Promise<boolean>;
  globalKeyHookRegister: (options: GlobalKeyHookRegisterOptions) => Promise<void>;
  globalKeyHookUnregister: (id: string) => Promise<void>;
  globalKeyHookUnregisterAll: () => Promise<void>;
  onGlobalKeyEvent: (callback: (event: GlobalKeyEvent) => void) => () => void;
  onGlobalMouseEvent: (callback: (event: GlobalMouseEvent) => void) => () => void;
  onGlobalKeybindTriggered: (callback: (event: GlobalKeybindTriggeredEvent) => void) => () => void;

  spellcheckGetState: () => Promise<SpellcheckState>;
  spellcheckSetState: (state: Partial<SpellcheckState>) => Promise<SpellcheckState>;
  spellcheckGetAvailableLanguages: () => Promise<string[]>;
  spellcheckOpenLanguageSettings: () => Promise<boolean>;
  onSpellcheckStateChanged: (callback: (state: SpellcheckState) => void) => () => void;
  onTextareaContextMenu: (callback: (params: TextareaContextMenuParams) => void) => () => void;
  spellcheckReplaceMisspelling: (replacement: string) => Promise<void>;
  spellcheckAddWordToDictionary: (word: string) => Promise<void>;

  switchInstanceUrl: (options: SwitchInstanceUrlOptions) => Promise<void>;
  consumeDesktopHandoffCode: () => Promise<string | null>;

  getDesktopSources: (types: Array<'screen' | 'window'>, requestId?: string) => Promise<DesktopSource[]>;
  onDisplayMediaRequested?: (callback: (requestId: string, info: DisplayMediaRequestInfo) => void) => () => void;
  selectDisplayMediaSource: (requestId: string, sourceId: string | null, withAudio: boolean) => void;
}

// Augment the global Window interface so window.electron is typed everywhere
declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}
