import React, { FormEventHandler, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  Box,
  Button,
  Icon,
  IconButton,
  Icons,
  Input,
  Modal,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Text,
  color,
} from 'folds';
import { Preset, Visibility } from 'matrix-js-sdk';
import { useNavigate } from 'react-router-dom';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { stopPropagation } from '../../utils/keyboard';
import { isRoomAlias, isRoomId } from '../../utils/matrix';
import { parseMatrixToRoom, parseMatrixToRoomEvent, testMatrixTo } from '../../plugins/matrix-to';
import { tryDecodeURIComponent } from '../../utils/dom';
import {
  encodeSearchParamValueArray,
  getSpacePath,
  withSearchParam,
} from '../../pages/pathUtils';
import { _RoomSearchParams } from '../../pages/paths';

type Step = 'landing' | 'create' | 'join';

type CreateCommunityModalProps = {
  onClose: () => void;
};

export function CreateCommunityModal({ onClose }: CreateCommunityModalProps) {
  const [step, setStep] = useState<Step>('landing');
  const mx = useMatrixClient();
  const { navigateSpace } = useRoomNavigate();
  const navigate = useNavigate();

  // Create step state
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Join step state
  const [joinAddress, setJoinAddress] = useState('');
  const [joinInvalid, setJoinInvalid] = useState(false);

  const handleCreate: FormEventHandler<HTMLFormElement> = async (evt) => {
    evt.preventDefault();
    const name = createName.trim();
    if (!name) return;
    setCreating(true);
    setCreateError(null);
    try {
      const result = await mx.createRoom({
        name,
        preset: Preset.PublicChat,
        visibility: Visibility.Private,
        creation_content: { type: 'm.space' },
      });
      navigateSpace(result.room_id);
      onClose();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create community.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    setJoinInvalid(false);
    const address = joinAddress.trim();
    if (!address) return;

    if (isRoomId(address) || isRoomAlias(address)) {
      navigate(getSpacePath(address));
      onClose();
      return;
    }

    if (testMatrixTo(address)) {
      const decoded = tryDecodeURIComponent(address);
      const toRoom = parseMatrixToRoom(decoded);
      if (toRoom) {
        const path = getSpacePath(toRoom.roomIdOrAlias);
        navigate(
          toRoom.viaServers
            ? withSearchParam<_RoomSearchParams>(path, {
                viaServers: encodeSearchParamValueArray(toRoom.viaServers),
              })
            : path
        );
        onClose();
        return;
      }
      const toEvent = parseMatrixToRoomEvent(decoded);
      if (toEvent) {
        const path = getSpacePath(toEvent.roomIdOrAlias);
        navigate(
          toEvent.viaServers
            ? withSearchParam<_RoomSearchParams>(path, {
                viaServers: encodeSearchParamValueArray(toEvent.viaServers),
              })
            : path
        );
        onClose();
        return;
      }
    }

    setJoinInvalid(true);
  };

  const stepTitle =
    step === 'landing'
      ? 'Add a Community'
      : step === 'create'
        ? 'Create a Community'
        : 'Join a Community';

  const cardBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    background: 'var(--background-modifier-hover)',
    border: '1px solid var(--background-modifier-accent)',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'background-color 100ms ease',
    color: 'inherit',
  };

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            clickOutsideDeactivates: true,
            onDeactivate: onClose,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Modal
            size="300"
            flexHeight
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-community-title"
          >
            <Box direction="Column">
              {/* ── Header ── */}
              <Box
                alignItems="Center"
                style={{
                  padding: '0.75rem 0.75rem 0.75rem 1.25rem',
                  borderBottom: '1px solid var(--background-modifier-accent)',
                }}
              >
                {step !== 'landing' && (
                  <IconButton
                    size="300"
                    radii="300"
                    onClick={() => setStep('landing')}
                    aria-label="Back"
                    style={{ marginRight: '0.25rem' }}
                  >
                    <Icon src={Icons.ChevronLeft} />
                  </IconButton>
                )}
                <Box grow="Yes">
                  <Text size="H4" as="h2" id="create-community-title">
                    {stepTitle}
                  </Text>
                </Box>
                <IconButton size="300" radii="300" onClick={onClose} aria-label="Close">
                  <Icon src={Icons.Cross} />
                </IconButton>
              </Box>

              {/* ── Step: Landing ── */}
              {step === 'landing' && (
                <Box direction="Column" gap="200" style={{ padding: '1.25rem' }}>
                  <Text size="T300" style={{ color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                    Create your own or join an existing community with an invite link.
                  </Text>

                  {/* Create card */}
                  <button
                    type="button"
                    style={cardBtnStyle}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.backgroundColor = 'var(--background-modifier-selected)')
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.backgroundColor = 'var(--background-modifier-hover)')
                    }
                    onClick={() => setStep('create')}
                  >
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '30%',
                        backgroundColor: 'var(--brand-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size="400" src={Icons.Space} style={{ color: '#ffffff' }} />
                    </div>
                    <Box direction="Column" gap="100" grow="Yes">
                      <Text size="H6" style={{ color: 'var(--text-primary)' }}>
                        Create My Own
                      </Text>
                      <Text size="T300" style={{ color: 'var(--text-tertiary)' }}>
                        Start fresh — invite friends and build your space.
                      </Text>
                    </Box>
                    <Icon
                      src={Icons.ChevronRight}
                      size="200"
                      style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
                    />
                  </button>

                  {/* Join card */}
                  <button
                    type="button"
                    style={cardBtnStyle}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.backgroundColor = 'var(--background-modifier-selected)')
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.backgroundColor = 'var(--background-modifier-hover)')
                    }
                    onClick={() => setStep('join')}
                  >
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '30%',
                        backgroundColor: 'var(--background-header-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        border: '1px solid var(--background-modifier-accent)',
                      }}
                    >
                      <Icon
                        size="400"
                        src={Icons.Link}
                        style={{ color: 'var(--text-primary)' }}
                      />
                    </div>
                    <Box direction="Column" gap="100" grow="Yes">
                      <Text size="H6" style={{ color: 'var(--text-primary)' }}>
                        Join a Community
                      </Text>
                      <Text size="T300" style={{ color: 'var(--text-tertiary)' }}>
                        Enter an invite link or address to join.
                      </Text>
                    </Box>
                    <Icon
                      src={Icons.ChevronRight}
                      size="200"
                      style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
                    />
                  </button>
                </Box>
              )}

              {/* ── Step: Create ── */}
              {step === 'create' && (
                <Box
                  as="form"
                  onSubmit={handleCreate}
                  direction="Column"
                  gap="400"
                  style={{ padding: '1.25rem' }}
                >
                  {/* Icon placeholder */}
                  <Box direction="Column" alignItems="Center" gap="200">
                    <div
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '30%',
                        backgroundColor: 'var(--brand-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size="600" src={Icons.Space} style={{ color: '#ffffff' }} />
                    </div>
                    <Text size="T200" style={{ color: 'var(--text-muted)' }}>
                      Community Icon
                    </Text>
                  </Box>

                  <Box direction="Column" gap="100">
                    <Text size="L400">Community Name</Text>
                    <Input
                      size="500"
                      autoFocus
                      variant="Background"
                      placeholder="My Awesome Community"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      required
                    />
                    {createError && (
                      <Text size="T200" style={{ color: color.Critical.Main }}>
                        {createError}
                      </Text>
                    )}
                    <Text size="T200" style={{ color: 'var(--text-muted)' }}>
                      By creating a community, you agree to Matrix Terms of Service.
                    </Text>
                  </Box>

                  <Button
                    type="submit"
                    variant="Primary"
                    disabled={creating || !createName.trim()}
                  >
                    <Text size="B400">{creating ? 'Creating…' : 'Create Community'}</Text>
                  </Button>
                </Box>
              )}

              {/* ── Step: Join ── */}
              {step === 'join' && (
                <Box
                  as="form"
                  onSubmit={handleJoin}
                  direction="Column"
                  gap="400"
                  style={{ padding: '1.25rem' }}
                >
                  <Box direction="Column" gap="200">
                    <Text size="T300" style={{ color: 'var(--text-tertiary)' }}>
                      Enter a public address to join the community. It looks like:
                    </Text>
                    <Text
                      as="ul"
                      size="T200"
                      style={{ color: 'var(--text-muted)', paddingLeft: '1.25rem' }}
                    >
                      <li>#community:server</li>
                      <li>https://matrix.to/#/#community:server</li>
                    </Text>
                  </Box>

                  <Box direction="Column" gap="100">
                    <Text size="L400">Invite Link or Address</Text>
                    <Input
                      size="500"
                      autoFocus
                      name="addressInput"
                      variant="Background"
                      placeholder="#community:server"
                      value={joinAddress}
                      onChange={(e) => setJoinAddress(e.target.value)}
                      required
                    />
                    {joinInvalid && (
                      <Text size="T200" style={{ color: color.Critical.Main }}>
                        <b>Invalid address.</b> Check the format and try again.
                      </Text>
                    )}
                  </Box>

                  <Button type="submit" variant="Primary" disabled={!joinAddress.trim()}>
                    <Text size="B400">Join Community</Text>
                  </Button>
                </Box>
              )}
            </Box>
          </Modal>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
