import React, { useEffect, useState } from 'react';
import {
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

type ToastCardProps = {
  title: string;
  body: string;
  onDismiss: () => void;
  children?: React.ReactNode;
};
function ToastCard({ title, body, onDismiss, children }: ToastCardProps) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        right: '16px',
        zIndex: 1000,
        maxWidth: '340px',
        width: '100%',
        borderRadius: '12px',
        padding: config.space.S400,
        backgroundColor: 'var(--bg-surface-low)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
        border: '1px solid var(--border-interactive)',
      }}
    >
      <Box direction="Column" gap="300">
        <Box alignItems="Center" justifyContent="SpaceBetween" gap="200">
          <Box alignItems="Center" gap="200">
            <Icon
              size="200"
              src={Icons.Shield}
              style={{ color: color.Warning.Main }}
            />
            <Text size="H5" style={{ fontWeight: 600 }}>
              {title}
            </Text>
          </Box>
          <IconButton
            size="300"
            radii="300"
            onClick={onDismiss}
            aria-label="Dismiss security notification"
          >
            <Icon src={Icons.Cross} />
          </IconButton>
        </Box>
        <Text size="T300" style={{ color: 'var(--text-secondary)' }}>
          {body}
        </Text>
        {children}
      </Box>
    </div>
  );
}

type EnableBackupToastProps = {
  onDismiss: () => void;
};
function EnableBackupToast({ onDismiss }: EnableBackupToastProps) {
  const [setupOpen, setSetupOpen] = useState(false);

  const handleEnable = () => {
    setSetupOpen(true);
  };

  const handleSetupClose = () => {
    setSetupOpen(false);
    onDismiss();
  };

  return (
    <>
      <ToastCard
        title="Secure your messages"
        body="Enable verification to back up your encryption keys. Without this, you cannot read messages on new devices."
        onDismiss={onDismiss}
      >
        <Button
          variant="Primary"
          fill="Solid"
          size="300"
          radii="300"
          onClick={handleEnable}
        >
          <Text size="B300">Enable</Text>
        </Button>
      </ToastCard>

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
              <DeviceVerificationSetup onCancel={handleSetupClose} />
            </FocusTrap>
          </OverlayCenter>
        </Overlay>
      )}
    </>
  );
}

type VerifyDeviceToastProps = {
  secretStorageKeyId: string;
  secretStorageKeyContent: import('../../types/matrix/accountData').SecretStorageKeyContent;
  onDismiss: () => void;
};
function VerifyDeviceToast({
  secretStorageKeyId,
  secretStorageKeyContent,
  onDismiss,
}: VerifyDeviceToastProps) {
  const [verifyExpanded, setVerifyExpanded] = useState(false);

  const handleVerifyClick = () => {
    setVerifyExpanded(true);
  };

  return (
    <ToastCard
      title="Verify this device"
      body="Enter your recovery key to access encrypted messages from other sessions."
      onDismiss={onDismiss}
    >
      {!verifyExpanded ? (
        <Button
          variant="Primary"
          fill="Solid"
          size="300"
          radii="300"
          onClick={handleVerifyClick}
        >
          <Text size="B300">Verify</Text>
        </Button>
      ) : (
        <Box direction="Column" gap="200">
          <ManualVerificationTile
            secretStorageKeyId={secretStorageKeyId}
            secretStorageKeyContent={secretStorageKeyContent}
          />
          <Button
            variant="Secondary"
            fill="Soft"
            size="300"
            radii="300"
            onClick={onDismiss}
          >
            <Text size="B300">Done</Text>
          </Button>
        </Box>
      )}
    </ToastCard>
  );
}

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
    return <EnableBackupToast onDismiss={dismiss} />;
  }

  // Case 2: Backup exists but device unverified
  if (
    crossSigningActive &&
    verificationStatus === VerificationStatus.Unverified &&
    defaultSecretStorageKeyId &&
    defaultSecretStorageKeyContent
  ) {
    return (
      <VerifyDeviceToast
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
