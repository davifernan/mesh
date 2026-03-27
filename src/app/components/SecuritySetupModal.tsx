import React, { ReactNode, useEffect, useState } from 'react';
import {
  Dialog,
  Header,
  Box,
  Text,
  Icon,
  Icons,
  IconButton,
  Button,
  config,
  color,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { useCrossSigningActive } from '../hooks/useCrossSigning';
import {
  useDeviceVerificationStatus,
  VerificationStatus,
} from '../hooks/useDeviceVerificationStatus';
import {
  useSecretStorageDefaultKeyId,
  useSecretStorageKeyContent,
} from '../hooks/useSecretStorage';
import { DeviceVerificationSetup } from './DeviceVerificationSetup';
import { ManualVerificationTile } from './ManualVerification';
import { ScreenSize, useScreenSize } from '../hooks/useScreenSize';

const SESSION_STORAGE_KEY = 'mesh-security-setup-dismissed';

function useSecuritySetupDismissed(): [boolean, () => void] {
  const [dismissed, setDismissed] = useState<boolean>(
    () => sessionStorage.getItem(SESSION_STORAGE_KEY) === '1'
  );

  const dismiss = () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, '1');
    setDismissed(true);
  };

  return [dismissed, dismiss];
}

// ─── Shared layout: bottom-sheet on mobile, centered dialog on desktop ─────────

type ModalShellProps = {
  title: string;
  onDismiss: () => void;
  children: ReactNode;
  mobile: boolean;
};
function ModalShell({ title, onDismiss, children, mobile }: ModalShellProps) {
  const dialogStyle: React.CSSProperties = mobile
    ? {
        width: '100%',
        maxWidth: '100%',
        margin: 0,
        borderRadius: `${config.radii.R400} ${config.radii.R400} 0 0`,
      }
    : { width: '100%', maxWidth: '420px' };

  const inner = (
    <Dialog role="dialog" aria-modal="true" aria-labelledby="security-setup-title" style={dialogStyle}>
      <Header
        style={{
          padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
          borderBottomWidth: config.borderWidth.B300,
        }}
        variant="Surface"
        size="500"
      >
        <Box grow="Yes" alignItems="Center" gap="200">
          <Icon size="200" src={Icons.Shield} style={{ color: color.Warning.Main }} />
          <Text size="H4" as="h2" id="security-setup-title">
            {title}
          </Text>
        </Box>
        <IconButton size="300" radii="300" onClick={onDismiss} aria-label="Dismiss">
          <Icon src={Icons.Cross} />
        </IconButton>
      </Header>
      <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
        {children}
      </Box>
    </Dialog>
  );

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      {mobile ? (
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            clickOutsideDeactivates: false,
            escapeDeactivates: false,
          }}
        >
          {/* Bottom-anchored container for mobile */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div style={{ width: '100%', maxWidth: '100%', margin: 0, padding: 0, pointerEvents: 'auto' }}>{inner}</div>
          </div>
        </FocusTrap>
      ) : (
        <OverlayCenter>
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              clickOutsideDeactivates: false,
              escapeDeactivates: false,
            }}
          >
            {inner}
          </FocusTrap>
        </OverlayCenter>
      )}
    </Overlay>
  );
}

// ─── Case 1: No backup ────────────────────────────────────────────────────────

type EnableBackupModalProps = {
  onDismiss: () => void;
  mobile: boolean;
};
function EnableBackupModal({ onDismiss, mobile }: EnableBackupModalProps) {
  const [setupOpen, setSetupOpen] = useState(false);

  if (setupOpen) {
    return (
      <Overlay open backdrop={<OverlayBackdrop />}>
        <OverlayCenter>
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              clickOutsideDeactivates: false,
              escapeDeactivates: false,
            }}
          >
            <DeviceVerificationSetup onCancel={onDismiss} />
          </FocusTrap>
        </OverlayCenter>
      </Overlay>
    );
  }

  return (
    <ModalShell title="Secure your messages" onDismiss={onDismiss} mobile={mobile}>
      <Text size="T300">
        Set up encryption backup so you can read your messages on other devices.
        You&apos;ll receive a Recovery Key — keep it safe.
      </Text>
      <Box direction="Column" gap="200">
        <Button
          variant="Primary"
          fill="Solid"
          radii="300"
          onClick={() => setSetupOpen(true)}
          style={{ width: '100%' }}
        >
          <Text size="B400">Enable</Text>
        </Button>
        <Button
          variant="Secondary"
          fill="None"
          radii="300"
          onClick={onDismiss}
          style={{ width: '100%' }}
        >
          <Text size="B400">Later</Text>
        </Button>
      </Box>
    </ModalShell>
  );
}

// ─── Case 2: Backup exists but device unverified ──────────────────────────────

type VerifyDeviceModalProps = {
  secretStorageKeyId: string;
  secretStorageKeyContent: import('../../types/matrix/accountData').SecretStorageKeyContent;
  onDismiss: () => void;
  mobile: boolean;
};
function VerifyDeviceModal({
  secretStorageKeyId,
  secretStorageKeyContent,
  onDismiss,
  mobile,
}: VerifyDeviceModalProps) {
  return (
    <ModalShell title="Verify this device" onDismiss={onDismiss} mobile={mobile}>
      <Text size="T300">
        Enter your Recovery Key or passphrase to access your encrypted messages.
      </Text>
      <ManualVerificationTile
        secretStorageKeyId={secretStorageKeyId}
        secretStorageKeyContent={secretStorageKeyContent}
      />
      <Button
        variant="Secondary"
        fill="None"
        radii="300"
        onClick={onDismiss}
        style={{ width: '100%' }}
      >
        <Text size="B400">Later</Text>
      </Button>
    </ModalShell>
  );
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

function SecuritySetupModalInner() {
  const mx = useMatrixClient();
  const crypto = mx.getCrypto() ?? undefined;
  const userId = mx.getUserId() ?? '';
  const deviceId = mx.getDeviceId() ?? undefined;

  const screenSize = useScreenSize();
  const mobile = screenSize !== ScreenSize.Desktop;

  const crossSigningActive = useCrossSigningActive();
  const verificationStatus = useDeviceVerificationStatus(crypto, userId, deviceId);
  const defaultSecretStorageKeyId = useSecretStorageDefaultKeyId();
  const defaultSecretStorageKeyContent = useSecretStorageKeyContent(
    defaultSecretStorageKeyId ?? ''
  );

  const [dismissed, dismiss] = useSecuritySetupDismissed();
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Auto-dismiss once verified
  useEffect(() => {
    if (verificationStatus === VerificationStatus.Verified && !dismissed) {
      dismiss();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationStatus]);

  if (!settled) return null;
  if (dismissed) return null;
  if (verificationStatus === VerificationStatus.Unknown) return null;
  if (!crossSigningActive && verificationStatus === VerificationStatus.Unsupported) return null;

  if (!crossSigningActive) {
    return <EnableBackupModal onDismiss={dismiss} mobile={mobile} />;
  }

  if (
    crossSigningActive &&
    verificationStatus === VerificationStatus.Unverified &&
    defaultSecretStorageKeyId &&
    defaultSecretStorageKeyContent
  ) {
    return (
      <VerifyDeviceModal
        secretStorageKeyId={defaultSecretStorageKeyId}
        secretStorageKeyContent={defaultSecretStorageKeyContent}
        onDismiss={dismiss}
        mobile={mobile}
      />
    );
  }

  return null;
}

export function SecuritySetupModal() {
  return <SecuritySetupModalInner />;
}
