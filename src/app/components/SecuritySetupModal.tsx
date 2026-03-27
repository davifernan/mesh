import React, { useEffect, useState } from 'react';
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

// ─── Case 1: No backup ────────────────────────────────────────────────────────

type EnableBackupModalProps = {
  onDismiss: () => void;
};
function EnableBackupModal({ onDismiss }: EnableBackupModalProps) {
  const [setupOpen, setSetupOpen] = useState(false);

  return (
    <>
      {!setupOpen && (
        <Overlay open backdrop={<OverlayBackdrop />}>
          <OverlayCenter>
            <FocusTrap
              focusTrapOptions={{
                initialFocus: false,
                clickOutsideDeactivates: false,
                escapeDeactivates: false,
              }}
            >
              <Dialog
                role="dialog"
                aria-modal="true"
                aria-labelledby="security-setup-title"
                style={{ width: '100%', maxWidth: '420px' }}
              >
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
                      Secure your messages
                    </Text>
                  </Box>
                  <IconButton size="300" radii="300" onClick={onDismiss} aria-label="Dismiss">
                    <Icon src={Icons.Cross} />
                  </IconButton>
                </Header>
                <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
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
                </Box>
              </Dialog>
            </FocusTrap>
          </OverlayCenter>
        </Overlay>
      )}

      {setupOpen && (
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
      )}
    </>
  );
}

// ─── Case 2: Backup exists but unverified ─────────────────────────────────────

type VerifyDeviceModalProps = {
  secretStorageKeyId: string;
  secretStorageKeyContent: import('../../types/matrix/accountData').SecretStorageKeyContent;
  onDismiss: () => void;
};
function VerifyDeviceModal({
  secretStorageKeyId,
  secretStorageKeyContent,
  onDismiss,
}: VerifyDeviceModalProps) {
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
          <Dialog
            role="dialog"
            aria-modal="true"
            aria-labelledby="security-setup-title"
            style={{ width: '100%', maxWidth: '420px' }}
          >
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
                  Verify this device
                </Text>
              </Box>
              <IconButton size="300" radii="300" onClick={onDismiss} aria-label="Dismiss">
                <Icon src={Icons.Cross} />
              </IconButton>
            </Header>
            <Box style={{ padding: config.space.S400 }} direction="Column" gap="400">
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
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

function SecuritySetupModalInner() {
  const mx = useMatrixClient();
  const crypto = mx.getCrypto() ?? undefined;
  const userId = mx.getUserId() ?? '';
  const deviceId = mx.getDeviceId() ?? undefined;

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

  // Don't show while status is still loading
  if (verificationStatus === VerificationStatus.Unknown) return null;

  // Crypto not supported — no point showing anything
  if (!crossSigningActive && verificationStatus === VerificationStatus.Unsupported) return null;

  // Case 1: No backup at all
  if (!crossSigningActive) {
    return <EnableBackupModal onDismiss={dismiss} />;
  }

  // Case 2: Backup exists but device unverified
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
      />
    );
  }

  return null;
}

export function SecuritySetupModal() {
  return <SecuritySetupModalInner />;
}
