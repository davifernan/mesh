import React, { MouseEventHandler, useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import { SidebarAvatar, SidebarItem, SidebarItemTooltip } from '../../../components/sidebar';
import { ContainerColor } from '../../../styles/ContainerColor.css';
import { useCreateSelected } from '../../../hooks/router/useCreateSelected';
import { CreateCommunityModal } from '../../../components/create-community-modal/CreateCommunityModal';

export function CreateTab() {
  const createSelected = useCreateSelected();
  const [showModal, setShowModal] = useState(false);

  const handleClick: MouseEventHandler<HTMLButtonElement> = () => {
    setShowModal(true);
  };

  return (
    <SidebarItem active={createSelected}>
      <SidebarItemTooltip tooltip="Add a Community">
        {(triggerRef) => (
          <>
            <SidebarAvatar
              className={showModal ? ContainerColor({ variant: 'Surface' }) : undefined}
              as="button"
              ref={triggerRef}
              outlined
              aria-label="Add a Community"
              onClick={handleClick}
            >
              <Plus size={22} weight="bold" />
            </SidebarAvatar>

            {showModal && (
              <CreateCommunityModal onClose={() => setShowModal(false)} />
            )}
          </>
        )}
      </SidebarItemTooltip>
    </SidebarItem>
  );
}
