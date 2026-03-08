import React, { useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { Settings, SettingsPages } from '../../../features/settings';
import { Modal500 } from '../../../components/Modal500';
import { openSettingsAtKeyboardShortcutsAtom, openUserSettingsAtom } from '../../../state/keyboardShortcutsHelp';
import { AddAccountDialog } from '../AddAccountDialog';

export function SettingsTab() {
  const [settings, setSettings] = useState(false);
  const [settingsKey, setSettingsKey] = useState(0);
  const [initialPage, setInitialPage] = useState<SettingsPages | undefined>(undefined);
  const [showAddAccount, setShowAddAccount] = useState(false);

  const [openAtKbShortcuts, setOpenAtKbShortcuts] = useAtom(openSettingsAtKeyboardShortcutsAtom);
  const [openUserSettings, setOpenUserSettings] = useAtom(openUserSettingsAtom);

  useEffect(() => {
    if (openAtKbShortcuts) {
      setOpenAtKbShortcuts(false);
      setInitialPage(SettingsPages.KeyboardShortcutsPage);
      setSettingsKey((k) => k + 1);
      setSettings(true);
    }
  }, [openAtKbShortcuts, setOpenAtKbShortcuts]);

  useEffect(() => {
    if (openUserSettings) {
      setOpenUserSettings(false);
      setInitialPage(undefined);
      setSettingsKey((k) => k + 1);
      setSettings(true);
    }
  }, [openUserSettings, setOpenUserSettings]);

  const closeSettings = () => {
    setSettings(false);
    setInitialPage(undefined);
  };

  return (
    <>
      {settings && (
        <Modal500 requestClose={closeSettings}>
          <Settings key={settingsKey} initialPage={initialPage} requestClose={closeSettings} />
        </Modal500>
      )}
      {showAddAccount && <AddAccountDialog onClose={() => setShowAddAccount(false)} />}
    </>
  );
}
