import React, { MouseEventHandler, forwardRef, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Icon,
  IconButton,
  Icons,
  Line,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Text,
  config,
  toRem,
} from 'folds';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import FocusTrap from 'focus-trap-react';
import { factoryRoomIdByActivity, factoryRoomIdByAtoZ, factoryRoomIdByUnreadFirst } from '../../../utils/sort';
import {
  NavButton,
  NavCategory,
  NavCategoryHeader,
  NavEmptyCenter,
  NavEmptyLayout,
  NavItem,
  NavItemContent,
  NavLink,
} from '../../../components/nav';
import {
  getExplorePath,
  getHomeCreatePath,
  getHomeRoomPath,
  getHomeSearchPath,
  getSpacePath,
} from '../../pathUtils';
import { getCanonicalAliasOrRoomId } from '../../../utils/matrix';
import { useSelectedRoom } from '../../../hooks/router/useSelectedRoom';
import {
  useHomeCreateSelected,
  useHomeSearchSelected,
} from '../../../hooks/router/useHomeSelected';
import { useHomeRooms } from './useHomeRooms';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { VirtualTile } from '../../../components/virtualizer';
import { RoomNavCategoryButton, RoomNavItem } from '../../../features/room-nav';
import { makeNavCategoryId } from '../../../state/closedNavCategories';
import { roomToUnreadAtom } from '../../../state/room/roomToUnread';
import { useCategoryHandler } from '../../../hooks/useCategoryHandler';
import { useNavToActivePathMapper } from '../../../hooks/useNavToActivePathMapper';
import { PageNav, PageNavHeader, PageNavContent } from '../../../components/page';
import { useRoomsUnread } from '../../../state/hooks/unread';
import { markAsRead } from '../../../utils/notifications';
import { useClosedNavCategoriesAtom } from '../../../state/hooks/closedNavCategories';
import { stopPropagation } from '../../../utils/keyboard';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import {
  getRoomNotificationMode,
  useRoomsNotificationPreferencesContext,
} from '../../../hooks/useRoomsNotificationPreferences';
import { useRoomListKeyboard } from '../../../hooks/useRoomListKeyboard';
import { searchModalAtom, searchModalInitialCharAtom } from '../../../state/searchModal';
import { RoomListbox } from '../../../components/room-listbox/RoomListbox';
import { UseStateProvider } from '../../../components/UseStateProvider';
import { JoinAddressPrompt } from '../../../components/join-address-prompt';
import { getmeshPermalinkPath } from '../../../plugins/permalink';
import { useOrphanSpaces } from '../../../state/hooks/roomList';
import { allRoomsAtom } from '../../../state/room-list/roomList';
import { roomToParentsAtom } from '../../../state/room/roomToParents';
import { useSidebarItems } from '../../../hooks/useSidebarItems';
import { useSpaceVoiceActivity } from '../../../hooks/useSpaceVoiceActivity';
import { useSpaceLiveActivity } from '../../../hooks/useSpaceLiveActivity';
import { ScreenSize, useScreenSizeContext } from '../../../hooks/useScreenSize';
import { HomeSpaceCard } from './HomeSpaceCard';
import { ActiveCallsSection } from './ActiveCallsSection';
import homeStyles from './Home.module.css';

type HomeMenuProps = {
  requestClose: () => void;
};
const HomeMenu = forwardRef<HTMLDivElement, HomeMenuProps>(({ requestClose }, ref) => {
  const orphanRooms = useHomeRooms();
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const unread = useRoomsUnread(orphanRooms, roomToUnreadAtom);
  const mx = useMatrixClient();
  const [roomSortOrder, setRoomSortOrder] = useSetting(settingsAtom, 'roomSortOrder');

  const handleMarkAsRead = () => {
    if (!unread) return;
    orphanRooms.forEach((rId) => markAsRead(mx, rId, hideActivity));
    requestClose();
  };

  return (
    <Menu role="menu" ref={ref} style={{ maxWidth: toRem(160) }}>
      <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
        <MenuItem
          onClick={() => setRoomSortOrder('activity')}
          size="300"
          after={roomSortOrder === 'activity' ? <Icon size="100" src={Icons.Check} /> : undefined}
          radii="300"
        >
          <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
            Sort by Activity
          </Text>
        </MenuItem>
        <MenuItem
          onClick={() => setRoomSortOrder('az')}
          size="300"
          after={roomSortOrder === 'az' ? <Icon size="100" src={Icons.Check} /> : undefined}
          radii="300"
        >
          <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
            Sort A-Z
          </Text>
        </MenuItem>
        <MenuItem
          onClick={() => setRoomSortOrder('unread')}
          size="300"
          after={roomSortOrder === 'unread' ? <Icon size="100" src={Icons.Check} /> : undefined}
          radii="300"
        >
          <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
            Unread First
          </Text>
        </MenuItem>
        <Line variant="Surface" size="300" />
        <MenuItem
          onClick={handleMarkAsRead}
          size="300"
          after={<Icon size="100" src={Icons.CheckTwice} />}
          radii="300"
          aria-disabled={!unread}
        >
          <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
            Mark as Read
          </Text>
        </MenuItem>
      </Box>
    </Menu>
  );
});

function HomeHeader() {
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const cords = evt.currentTarget.getBoundingClientRect();
    setMenuAnchor((currentState) => {
      if (currentState) return undefined;
      return cords;
    });
  };

  return (
    <>
      <PageNavHeader>
        <Box alignItems="Center" grow="Yes" gap="300">
          <Box grow="Yes" style={{ overflow: 'hidden' }}>
            <Text size="H4" as="h1" truncate>
                Home
            </Text>
          </Box>
          <Box>
            <IconButton aria-pressed={!!menuAnchor} variant="Background" onClick={handleOpenMenu}>
              <Icon src={Icons.VerticalDots} size="200" />
            </IconButton>
          </Box>
        </Box>
      </PageNavHeader>
      <PopOut
        anchor={menuAnchor}
        position="Bottom"
        align="End"
        offset={6}
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              returnFocusOnDeactivate: false,
              onDeactivate: () => setMenuAnchor(undefined),
              clickOutsideDeactivates: true,
              isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
              isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
              escapeDeactivates: stopPropagation,
            }}
          >
            <HomeMenu requestClose={() => setMenuAnchor(undefined)} />
          </FocusTrap>
        }
      />
    </>
  );
}

/** Spaces grid — only rendered on mobile */
function HomeSpacesSection() {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const roomToParents = useAtomValue(roomToParentsAtom);
  const orphanSpaces = useOrphanSpaces(mx, allRoomsAtom, roomToParents);
  const [sidebarItems] = useSidebarItems(orphanSpaces);

  // Flatten all spaces including those inside sidebar folders
  const spaceIds = sidebarItems.flatMap((item) =>
    typeof item === 'string' ? [item] : item.content
  );

  // Populate voice/live activity atoms on mobile.
  // SpaceTabs runs off-screen in the DOM, but calling these hooks here ensures
  // the atoms are always fresh for the HomeSpaceCard badges on mobile.
  useSpaceVoiceActivity(spaceIds);
  useSpaceLiveActivity(spaceIds);

  const handleSpaceClick = (roomId: string) => {
    navigate(getSpacePath(getCanonicalAliasOrRoomId(mx, roomId)));
  };

  return (
    <div className={homeStyles.spacesSection}>
      <div className={homeStyles.spacesSectionTitle}>Spaces</div>
      <div className={homeStyles.spacesGrid}>
        {spaceIds.length === 0 ? (
          <span className={homeStyles.spacesEmpty}>No spaces joined yet</span>
        ) : (
          spaceIds.map((roomId) => (
            <HomeSpaceCard
              key={roomId}
              roomId={roomId}
              selected={false}
              onClick={handleSpaceClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

function HomeEmpty() {
  const navigate = useNavigate();

  return (
    <NavEmptyCenter>
      <NavEmptyLayout
        icon={<Icon size="600" src={Icons.Hash} />}
        title={
          <Text size="H5" as="h2" align="Center">
            No Rooms
          </Text>
        }
        content={
          <Text size="T300" align="Center">
            You do not have any rooms yet.
          </Text>
        }
        options={
          <>
            <Button onClick={() => navigate(getHomeCreatePath())} variant="Secondary" size="300">
              <Text size="B300" truncate>
                Create Room
              </Text>
            </Button>
            <Button
              onClick={() => navigate(getExplorePath())}
              variant="Secondary"
              fill="Soft"
              size="300"
            >
              <Text size="B300" truncate>
                Explore Community Rooms
              </Text>
            </Button>
          </>
        }
      />
    </NavEmptyCenter>
  );
}

const DEFAULT_CATEGORY_ID = makeNavCategoryId('home', 'room');
export function Home() {
  const screenSize = useScreenSizeContext();
  const mx = useMatrixClient();
  useNavToActivePathMapper('home');
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = screenSize === ScreenSize.Mobile;
  const rooms = useHomeRooms();
  const notificationPreferences = useRoomsNotificationPreferencesContext();
  const roomToUnread = useAtomValue(roomToUnreadAtom);
  const navigate = useNavigate();

  const selectedRoomId = useSelectedRoom();
  const createRoomSelected = useHomeCreateSelected();
  const searchSelected = useHomeSearchSelected();
  const noRoomToDisplay = rooms.length === 0;
  const [closedCategories, setClosedCategories] = useAtom(useClosedNavCategoriesAtom());
  const [roomSortOrder] = useSetting(settingsAtom, 'roomSortOrder');

  const sortedRooms = useMemo(() => {
    let sortFn;
    if (roomSortOrder === 'az') {
      sortFn = factoryRoomIdByAtoZ(mx);
    } else if (roomSortOrder === 'unread') {
      sortFn = factoryRoomIdByUnreadFirst(
        (id) => roomToUnread.get(id)?.highlight ?? 0,
        (id) => roomToUnread.get(id)?.total ?? 0,
        factoryRoomIdByActivity(mx)
      );
    } else {
      sortFn = factoryRoomIdByActivity(mx);
    }
    const items = Array.from(rooms).sort(sortFn);
    if (closedCategories.has(DEFAULT_CATEGORY_ID)) {
      return items.filter((rId) => roomToUnread.has(rId) || rId === selectedRoomId);
    }
    return items;
  }, [mx, rooms, closedCategories, roomToUnread, selectedRoomId, roomSortOrder]);

  const virtualizer = useVirtualizer({
    count: sortedRooms.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const room = mx.getRoom(sortedRooms[index]);
      return room?.isCallRoom() ? 80 : 38;
    },
    overscan: 10,
    getItemKey: (index) => sortedRooms[index],
  });

  const setSearchModal = useSetAtom(searchModalAtom);
  const setSearchInitialChar = useSetAtom(searchModalInitialCharAtom);

  const keyboardNav = useRoomListKeyboard({
    items: sortedRooms,
    selectedRoomId,
    virtualizer,
    onNavigate: (roomId) => navigate(getHomeRoomPath(getCanonicalAliasOrRoomId(mx, roomId))),
    onTypeChar: (key) => { setSearchInitialChar(key); setSearchModal(true); },
  });

  const handleCategoryClick = useCategoryHandler(setClosedCategories, (categoryId) =>
    closedCategories.has(categoryId)
  );

  return (
    <PageNav>
      <HomeHeader />
      {/* Desktop-only empty state — on mobile we always render PageNavContent
          so HomeSpacesSection is accessible even when there are no orphan rooms */}
      {noRoomToDisplay && !isMobile ? (
        <HomeEmpty />
      ) : (
        <PageNavContent scrollRef={scrollRef}>
          <Box direction="Column" gap="300">
            <ActiveCallsSection />
            {/* Always show spaces grid on mobile so users can reach their communities
                regardless of whether they have orphan rooms */}
            {isMobile && <HomeSpacesSection />}
            {isMobile && !noRoomToDisplay && <div className={homeStyles.sectionDivider} />}
            {noRoomToDisplay ? null : (
              <>
                <NavCategory>
                  <NavItem variant="Background" radii="400" aria-selected={createRoomSelected}>
                    <NavButton onClick={() => navigate(getHomeCreatePath())}>
                      <NavItemContent>
                        <Box as="span" grow="Yes" alignItems="Center" gap="200">
                          <Avatar size="200" radii="400">
                            <Icon src={Icons.Plus} size="100" />
                          </Avatar>
                          <Box as="span" grow="Yes">
                            <Text as="span" size="Inherit" truncate>
                              Create Room
                            </Text>
                          </Box>
                        </Box>
                      </NavItemContent>
                    </NavButton>
                  </NavItem>
                  <UseStateProvider initial={false}>
                    {(open, setOpen) => (
                      <>
                        <NavItem variant="Background" radii="400">
                          <NavButton onClick={() => setOpen(true)}>
                            <NavItemContent>
                              <Box as="span" grow="Yes" alignItems="Center" gap="200">
                                <Avatar size="200" radii="400">
                                  <Icon src={Icons.Link} size="100" />
                                </Avatar>
                                <Box as="span" grow="Yes">
                                  <Text as="span" size="Inherit" truncate>
                                    Join with Address
                                  </Text>
                                </Box>
                              </Box>
                            </NavItemContent>
                          </NavButton>
                        </NavItem>
                        {open && (
                          <JoinAddressPrompt
                            onCancel={() => setOpen(false)}
                            onOpen={(target) => {
                              setOpen(false);
                              navigate(getmeshPermalinkPath(target));
                            }}
                          />
                        )}
                      </>
                    )}
                  </UseStateProvider>
                  <NavItem variant="Background" radii="400" aria-selected={searchSelected}>
                    <NavLink to={getHomeSearchPath()}>
                      <NavItemContent>
                        <Box as="span" grow="Yes" alignItems="Center" gap="200">
                          <Avatar size="200" radii="400">
                            <Icon src={Icons.Search} size="100" filled={searchSelected} />
                          </Avatar>
                          <Box as="span" grow="Yes">
                            <Text as="span" size="Inherit" truncate>
                              Message Search
                            </Text>
                          </Box>
                        </Box>
                      </NavItemContent>
                    </NavLink>
                  </NavItem>
                </NavCategory>
                <NavCategory>
                  <NavCategoryHeader>
                    <RoomNavCategoryButton
                      closed={closedCategories.has(DEFAULT_CATEGORY_ID)}
                      data-category-id={DEFAULT_CATEGORY_ID}
                      onClick={handleCategoryClick}
                    >
                      Rooms
                    </RoomNavCategoryButton>
                  </NavCategoryHeader>
                  <RoomListbox
                    id="mesh-room-listbox"
                    aria-label="Room list"
                    items={sortedRooms}
                    focusedIndex={keyboardNav.focusedIndex}
                    onKeyDown={keyboardNav.handleKeyDown}
                    onFocus={keyboardNav.handleFocus}
                  >
                    <div
                      style={{
                        position: 'relative',
                        height: virtualizer.getTotalSize(),
                        width: '100%',
                      }}
                    >
                      {virtualizer.getVirtualItems().map((vItem) => {
                        const roomId = sortedRooms[vItem.index];
                        const room = mx.getRoom(roomId);
                        if (!room) return null;
                        const selected = selectedRoomId === roomId;
                        const focused = keyboardNav.focusedIndex === vItem.index;

                        return (
                          <VirtualTile
                            virtualItem={vItem}
                            key={vItem.key}
                            ref={virtualizer.measureElement}
                          >
                            <RoomNavItem
                              room={room}
                              selected={selected}
                              focused={focused}
                              optionId={`room-option-${roomId}`}
                              tabIndex={-1}
                              linkPath={getHomeRoomPath(getCanonicalAliasOrRoomId(mx, roomId))}
                              notificationMode={getRoomNotificationMode(
                                notificationPreferences,
                                room.roomId
                              )}
                            />
                          </VirtualTile>
                        );
                      })}
                    </div>
                  </RoomListbox>
                </NavCategory>
              </>
            )}
          </Box>
        </PageNavContent>
      )}
    </PageNav>
  );
}
