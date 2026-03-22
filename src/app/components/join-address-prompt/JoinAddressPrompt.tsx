import React, { FormEventHandler, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import {
  Dialog,
  Overlay,
  OverlayCenter,
  OverlayBackdrop,
  Header,
  config,
  Box,
  Text,
  IconButton,
  Icon,
  Icons,
  Button,
  Input,
  color,
} from 'folds';
import { stopPropagation } from '../../utils/keyboard';
import { isRoomAlias, isRoomId } from '../../utils/matrix';
import { parseMatrixToRoom, parseMatrixToRoomEvent, testMatrixTo } from '../../plugins/matrix-to';
import { meshPermalink, parsemeshPermalink } from '../../plugins/permalink';
import { tryDecodeURIComponent } from '../../utils/dom';
import { useMatrixClient } from '../../hooks/useMatrixClient';

type JoinAddressProps = {
  onOpen: (target: meshPermalink) => void;
  onCancel: () => void;
};
export function JoinAddressPrompt({ onOpen, onCancel }: JoinAddressProps) {
  const mx = useMatrixClient();
  const [invalid, setInvalid] = useState(false);

  const getJoinedSpaceTarget = (roomIdOrAlias: string, viaServers?: string[]): meshPermalink | undefined => {
    const roomId = isRoomAlias(roomIdOrAlias)
      ? mx
          .getRooms()
          .find((room) => room.getCanonicalAlias() === roomIdOrAlias)
          ?.roomId
      : roomIdOrAlias;
    const room = roomId ? mx.getRoom(roomId) : undefined;

    if (!room?.isSpaceRoom()) return undefined;

    return {
      kind: 'space',
      spaceIdOrAlias: roomIdOrAlias,
      viaServers,
    };
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    setInvalid(false);

    const target = evt.target as HTMLFormElement | undefined;
    const addressInput = target?.addressInput as HTMLInputElement | undefined;
    const address = addressInput?.value.trim();
    if (!address) return;

    if (isRoomId(address) || isRoomAlias(address)) {
      onOpen(getJoinedSpaceTarget(address) ?? { kind: 'room', roomIdOrAlias: address });
      return;
    }

    if (testMatrixTo(address)) {
      const decodedAddress = tryDecodeURIComponent(address);
      const toRoom = parseMatrixToRoom(decodedAddress);
      if (toRoom) {
        onOpen(
          getJoinedSpaceTarget(toRoom.roomIdOrAlias, toRoom.viaServers) ?? {
            kind: 'room',
            roomIdOrAlias: toRoom.roomIdOrAlias,
            viaServers: toRoom.viaServers,
          }
        );
        return;
      }

      const toEvent = parseMatrixToRoomEvent(decodedAddress);
      if (toEvent) {
        onOpen({
          kind: 'room',
          roomIdOrAlias: toEvent.roomIdOrAlias,
          viaServers: toEvent.viaServers,
          eventId: toEvent.eventId,
        });
        return;
      }
    }

    const permalink = parsemeshPermalink(address);
    if (permalink) {
      onOpen(permalink);
      return;
    }

    setInvalid(true);
  };

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: onCancel,
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Dialog variant="Surface" role="dialog" aria-modal="true" aria-labelledby="join-address-dialog-title">
            <Header
              style={{
                padding: `0 ${config.space.S200} 0 ${config.space.S400}`,
              }}
              variant="Surface"
              size="500"
            >
              <Box grow="Yes">
                <Text size="H4" as="h2" id="join-address-dialog-title">Join with Address</Text>
              </Box>
              <IconButton size="300" onClick={onCancel} radii="300" aria-label="Close">
                <Icon src={Icons.Cross} />
              </IconButton>
            </Header>
            <Box
              as="form"
              onSubmit={handleSubmit}
              style={{ padding: config.space.S400, paddingTop: 0 }}
              direction="Column"
              gap="400"
            >
              <Box direction="Column" gap="200">
                <Text priority="400" size="T300">
                  Enter a public address to join a community or room. Addresses look like:
                </Text>
                <Text as="ul" size="T200" priority="300" style={{ paddingLeft: config.space.S400 }}>
                  <li>#community:server</li>
                  <li>{`${window.location.origin}/#community:server/`}</li>
                  <li>{`${window.location.origin}/home/#general:server/`}</li>
                </Text>
              </Box>
              <Box direction="Column" gap="100">
                <Text size="L400">Address</Text>
                <Input
                  size="500"
                  autoFocus
                  name="addressInput"
                  variant="Background"
                  placeholder="#community:server"
                  required
                />
                {invalid && (
                  <Text size="T200" style={{ color: color.Critical.Main }}>
                    <b>Invalid Address</b>
                  </Text>
                )}
              </Box>
              <Button type="submit" variant="Primary">
                <Text size="B400">Open</Text>
              </Button>
            </Box>
          </Dialog>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
