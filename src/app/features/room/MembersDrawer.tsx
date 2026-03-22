import React, {
  ChangeEventHandler,
  KeyboardEventHandler,
  MouseEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Avatar,
  Badge,
  Box,
  Chip,
  Header,
  Icon,
  IconButton,
  Icons,
  Input,
  MenuItem,
  PopOut,
  RectCords,
  Scroll,
  Spinner,
  Text,
  Tooltip,
  TooltipProvider,
  config,
} from 'folds';
import { MatrixClient, Room, RoomMember, UserEvent } from 'matrix-js-sdk';
import { useVirtualizer } from '@tanstack/react-virtual';
import classNames from 'classnames';

import * as css from './MembersDrawer.css';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { UseStateProvider } from '../../components/UseStateProvider';
import {
  SearchItemStrGetter,
  UseAsyncSearchOptions,
  useAsyncSearch,
} from '../../hooks/useAsyncSearch';
import { useDebounce } from '../../hooks/useDebounce';
import { TypingIndicator } from '../../components/typing-indicator';
import { getMemberDisplayName, getMemberSearchStr } from '../../utils/room';
import { getMxIdLocalPart } from '../../utils/matrix';
import { useSetSetting, useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { millify } from '../../plugins/millify';
import { ScrollTopContainer } from '../../components/scroll-top-container';
import { UserAvatar } from '../../components/user-avatar';
import { useRoomTypingMember } from '../../hooks/useRoomTypingMembers';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useMembershipFilter, useMembershipFilterMenu } from '../../hooks/useMemberFilter';
import { useMemberPowerSort, useMemberSort, useMemberSortMenu } from '../../hooks/useMemberSort';
import { useGetMemberPowerLevel, usePowerLevelsContext } from '../../hooks/usePowerLevels';
import { MembershipFilterMenu } from '../../components/MembershipFilterMenu';
import { MemberSortMenu } from '../../components/MemberSortMenu';
import { useOpenUserRoomProfile, useUserRoomProfileState } from '../../state/hooks/userRoomProfile';
import { useSpaceOptionally } from '../../hooks/useSpace';
import { ContainerColor } from '../../styles/ContainerColor.css';
import { useGetMemberPowerTag } from '../../hooks/useMemberPowerTag';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { isKeyHotkey } from 'is-hotkey';
import { Presence } from '../../hooks/useUserPresence';

// Discriminated union for the virtualizer items list.
// MemberPowerTag has `name` and no `userId`; RoomMember has `userId`.
// PresenceSectionHeader has `__presenceHeader` to distinguish it.
type PresenceSectionHeader = {
  __presenceHeader: true;
  label: string;
  count: number;
};

function isPresenceHeader(
  item: PresenceSectionHeader | object
): item is PresenceSectionHeader {
  return '__presenceHeader' in item && (item as PresenceSectionHeader).__presenceHeader === true;
}

function getMemberPresence(mx: MatrixClient, userId: string): Presence {
  const user = mx.getUser(userId);
  const p = user?.presence as string | undefined;
  if (p === 'online') return Presence.Online;
  if (p === 'unavailable') return Presence.Unavailable;
  return Presence.Offline;
}

function isOnline(p: Presence): boolean {
  return p === Presence.Online || p === Presence.Unavailable;
}

type MemberDrawerHeaderProps = {
  room: Room;
  isFullWidth?: boolean;
  onToggleFullWidth?: () => void;
};
function MemberDrawerHeader({ room, isFullWidth, onToggleFullWidth }: MemberDrawerHeaderProps) {
  const setPeopleDrawer = useSetSetting(settingsAtom, 'isPeopleDrawer');

  return (
    <Header className={css.MembersDrawerHeader} variant="Background" size="600">
      <Box grow="Yes" alignItems="Center" gap="200">
        <Box grow="Yes" alignItems="Center" gap="200">
          <Text title={`${room.getJoinedMemberCount()} Members`} size="H5" as="h2" truncate>
            {`${millify(room.getJoinedMemberCount())} Members`}
          </Text>
        </Box>
        <Box shrink="No" alignItems="Center">
          {onToggleFullWidth && (
            <IconButton
              variant="Background"
              onClick={onToggleFullWidth}
              aria-label={isFullWidth ? 'Side by side' : 'Full width'}
            >
              <Icon src={isFullWidth ? Icons.ArrowGoRight : Icons.ArrowGoLeft} />
            </IconButton>
          )}
          <TooltipProvider
            position="Bottom"
            align="End"
            offset={4}
            tooltip={
              <Tooltip>
                <Text>Close</Text>
              </Tooltip>
            }
          >
            {(triggerRef) => (
              <IconButton
                ref={triggerRef}
                variant="Background"
                onClick={() => setPeopleDrawer(false)}
                aria-label="Close"
              >
                <Icon src={Icons.Cross} />
              </IconButton>
            )}
          </TooltipProvider>
        </Box>
      </Box>
    </Header>
  );
}

type MemberItemProps = {
  mx: MatrixClient;
  useAuthentication: boolean;
  room: Room;
  member: RoomMember;
  onClick: MouseEventHandler<HTMLButtonElement>;
  pressed?: boolean;
  typing?: boolean;
  focused?: boolean;
  optionId?: string;
  tabIndex?: number;
  online?: boolean;
};
function MemberItem({
  mx,
  useAuthentication,
  room,
  member,
  onClick,
  pressed,
  typing,
  focused,
  optionId,
  tabIndex: tabIndexProp,
  online,
}: MemberItemProps) {
  const name =
    getMemberDisplayName(room, member.userId) ?? getMxIdLocalPart(member.userId) ?? member.userId;
  const avatarMxcUrl = member.getMxcAvatarUrl();
  const avatarUrl = avatarMxcUrl
    ? mx.mxcUrlToHttp(avatarMxcUrl, 100, 100, 'crop', undefined, false, useAuthentication)
    : undefined;

  return (
    <MenuItem
      id={optionId}
      role="option"
      style={{ padding: `0 ${config.space.S200}` }}
      aria-selected={pressed || focused}
      data-user-id={member.userId}
      tabIndex={tabIndexProp ?? -1}
      variant="Background"
      radii="400"
      onClick={onClick}
      before={
        <Avatar size="200">
          <UserAvatar
            userId={member.userId}
            src={avatarUrl ?? undefined}
            alt={name}
            renderFallback={() => <Icon size="50" src={Icons.User} filled />}
          />
        </Avatar>
      }
      after={
        typing && (
          <Badge size="300" variant="Secondary" fill="Soft" radii="Pill" outlined>
            <TypingIndicator size="300" />
          </Badge>
        )
      }
    >
      <Box grow="Yes">
        <Text
          size="T400"
          truncate
          style={{
            color: online ? 'var(--text-primary)' : 'var(--text-muted)',
            transition: 'color 200ms ease',
          }}
        >
          {name}
        </Text>
      </Box>
    </MenuItem>
  );
}

const SEARCH_OPTIONS: UseAsyncSearchOptions = {
  limit: 1000,
  matchOptions: {
    contain: true,
  },
};

const mxIdToName = (mxId: string) => getMxIdLocalPart(mxId) ?? mxId;
const getRoomMemberStr: SearchItemStrGetter<RoomMember> = (m, query) =>
  getMemberSearchStr(m, query, mxIdToName);

type MembersDrawerProps = {
  room: Room;
  memberRoom?: Room;
  members: RoomMember[];
  width?: number;
  isFullWidth?: boolean;
  onToggleFullWidth?: () => void;
};
export function MembersDrawer({
  room,
  memberRoom: memberRoomProp,
  members,
  width = 266,
  isFullWidth,
  onToggleFullWidth,
}: MembersDrawerProps) {
  const memberRoom = memberRoomProp ?? room;
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollTopAnchorRef = useRef<HTMLDivElement>(null);
  const powerLevels = usePowerLevelsContext();
  const creators = useRoomCreators(memberRoom);
  const getPowerTag = useGetMemberPowerTag(memberRoom, creators, powerLevels);
  const getPowerLevel = useGetMemberPowerLevel(powerLevels);

  const fetchingMembers = members.length < memberRoom.getJoinedMemberCount();
  const openUserRoomProfile = useOpenUserRoomProfile();
  const space = useSpaceOptionally();
  const openProfileUserId = useUserRoomProfileState()?.userId;

  const membershipFilterMenu = useMembershipFilterMenu();
  const sortFilterMenu = useMemberSortMenu();
  const [sortFilterIndex, setSortFilterIndex] = useSetting(settingsAtom, 'memberSortFilterIndex');
  const [membershipFilterIndex, setMembershipFilterIndex] = useState(0);

  const membershipFilter = useMembershipFilter(membershipFilterIndex, membershipFilterMenu);
  const memberSort = useMemberSort(sortFilterIndex, sortFilterMenu);
  const memberPowerSort = useMemberPowerSort(creators, getPowerLevel);

  const typingMembers = useRoomTypingMember(room.roomId);

  const filteredMembers = useMemo(
    () => members.filter(membershipFilter.filterFn).sort(memberSort.sortFn).sort(memberPowerSort),
    [members, membershipFilter, memberSort, memberPowerSort]
  );

  const [result, search, resetSearch] = useAsyncSearch(
    filteredMembers,
    getRoomMemberStr,
    SEARCH_OPTIONS
  );
  if (!result && searchInputRef.current?.value) search(searchInputRef.current.value);

  const processMembers = result ? result.items : filteredMembers;

  // Subscribe to presence changes so the list re-groups when presence updates.
  const [presenceTick, setPresenceTick] = useState(0);
  useEffect(() => {
    const handler = () => setPresenceTick((t) => t + 1);
    processMembers.forEach((m) => {
      const user = mx.getUser(m.userId);
      user?.on(UserEvent.Presence, handler);
      user?.on(UserEvent.CurrentlyActive, handler);
    });
    return () => {
      processMembers.forEach((m) => {
        const user = mx.getUser(m.userId);
        user?.removeListener(UserEvent.Presence, handler);
        user?.removeListener(UserEvent.CurrentlyActive, handler);
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mx, processMembers]);

  // Build online/offline grouped virtualizer list.
  // Each group: section header → power-tag-flattened members.
  const groupedVirtualItems = useMemo(() => {
    // Force re-compute when presenceTick changes
    void presenceTick;
    const online: RoomMember[] = [];
    const offline: RoomMember[] = [];
    processMembers.forEach((m) => {
      const p = getMemberPresence(mx, m.userId);
      if (isOnline(p)) online.push(m);
      else offline.push(m);
    });

    const onlineFlat = (() => {
      let prevTag: ReturnType<typeof getPowerTag> | undefined;
      const items: Array<PresenceSectionHeader | ReturnType<typeof getPowerTag> | RoomMember> = [];
      // Insert online header first
      items.push({ __presenceHeader: true, label: 'ONLINE', count: online.length } as PresenceSectionHeader);
      online.forEach((m) => {
        const tag = getPowerTag(m.userId);
        if (tag !== prevTag) {
          prevTag = tag;
          items.push(tag);
        }
        items.push(m);
      });
      return items;
    })();

    const offlineFlat = (() => {
      let prevTag: ReturnType<typeof getPowerTag> | undefined;
      const items: Array<PresenceSectionHeader | ReturnType<typeof getPowerTag> | RoomMember> = [];
      items.push({ __presenceHeader: true, label: 'OFFLINE', count: offline.length } as PresenceSectionHeader);
      offline.forEach((m) => {
        const tag = getPowerTag(m.userId);
        if (tag !== prevTag) {
          prevTag = tag;
          items.push(tag);
        }
        items.push(m);
      });
      return items;
    })();

    return [...onlineFlat, ...offlineFlat];
  }, [mx, processMembers, getPowerTag, presenceTick]);

  const virtualizer = useVirtualizer({
    count: groupedVirtualItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const handleSearchChange: ChangeEventHandler<HTMLInputElement> = useDebounce(
    useCallback(
      (evt) => {
        if (evt.target.value) search(evt.target.value);
        else resetSearch();
      },
      [search, resetSearch]
    ),
    { wait: 200 }
  );

  const handleMemberClick: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const btn = evt.currentTarget as HTMLButtonElement;
    const userId = btn.getAttribute('data-user-id');
    if (!userId) return;
    openUserRoomProfile(memberRoom.roomId, space?.roomId, userId, btn.getBoundingClientRect(), 'Left');
  };

  // Keyboard navigation: only member items (skip power-tag label rows and presence headers).
  const memberIndices = useMemo(
    () =>
      groupedVirtualItems.reduce<number[]>((acc, item, i) => {
        if ('userId' in item && !isPresenceHeader(item)) acc.push(i);
        return acc;
      }, []),
    [groupedVirtualItems]
  );
  const [focusedVirtIndex, setFocusedVirtIndex] = useState(-1);

  // Keep focusedVirtIndex valid when list shrinks (e.g. search filter).
  useEffect(() => {
    if (focusedVirtIndex >= groupedVirtualItems.length) setFocusedVirtIndex(-1);
  }, [groupedVirtualItems.length, focusedVirtIndex]);

  const focusMember = useCallback(
    (idx: number) => {
      setFocusedVirtIndex(idx);
      virtualizer.scrollToIndex(idx, { align: 'auto' });
      const member = groupedVirtualItems[idx];
      if (member && 'userId' in member && !isPresenceHeader(member)) {
        const { userId } = member as RoomMember;
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const btn = document.querySelector<HTMLElement>(`[data-user-id="${userId}"]`);
            btn?.focus({ preventScroll: true });
          })
        );
      }
    },
    [groupedVirtualItems, virtualizer]
  );

  const handleListKeyDown: KeyboardEventHandler<HTMLDivElement> = useCallback(
    (evt) => {
      if (memberIndices.length === 0) return;
      // Only handle keys from a focused member button (or the listbox container itself).
      const target = evt.target as HTMLElement;
      const currentUserId = target.getAttribute('data-user-id');
      if (!currentUserId) return;

      const isDown = isKeyHotkey('arrowdown', evt as unknown as KeyboardEvent);
      const isUp = isKeyHotkey('arrowup', evt as unknown as KeyboardEvent);
      const isHome = isKeyHotkey('home', evt as unknown as KeyboardEvent);
      const isEnd = isKeyHotkey('end', evt as unknown as KeyboardEvent);

      if (isDown || isUp || isHome || isEnd) {
        evt.preventDefault();
        const currentIdx = groupedVirtualItems.findIndex(
          (m) => 'userId' in m && !isPresenceHeader(m) && (m as RoomMember).userId === currentUserId
        );
        const currentPos = currentIdx >= 0 ? memberIndices.indexOf(currentIdx) : -1;
        let nextPos: number;
        if (isHome) nextPos = 0;
        else if (isEnd) nextPos = memberIndices.length - 1;
        else if (isDown) nextPos = currentPos < 0 ? 0 : Math.min(currentPos + 1, memberIndices.length - 1);
        else nextPos = currentPos < 0 ? memberIndices.length - 1 : Math.max(currentPos - 1, 0);
        focusMember(memberIndices[nextPos]);
        return;
      }

      // Typing redirects to the search bar — focus the input and inject the character.
      if (evt.key.length === 1 && !evt.ctrlKey && !evt.altKey && !evt.metaKey) {
        evt.preventDefault();
        const input = searchInputRef.current;
        if (input) {
          input.focus();
          const key = evt.key;
          requestAnimationFrame(() => {
            if (document.activeElement === input) {
              input.setRangeText(key, input.selectionStart ?? 0, input.selectionEnd ?? 0, 'end');
              input.dispatchEvent(new Event('input', { bubbles: true }));
            }
          });
        }
      }
    },
    [memberIndices, groupedVirtualItems, focusMember]
  );

  return (
    <Box
      id="bettercord-members-panel"
      role="region"
      aria-label="Members panel"
      tabIndex={-1}
      className={classNames(css.MembersDrawer, ContainerColor({ variant: 'Background' }))}
      shrink="No"
      direction="Column"
      style={
        isFullWidth
          ? { flex: 1, minWidth: 0, overflow: 'hidden' }
          : { width: `${width}px` }
      }
      onFocus={(evt) => {
        // F6 (supertab) focuses this container directly — redirect immediately to the first
        // member button so the user can navigate the list right away with arrow keys.
        if (evt.target !== evt.currentTarget) return;
        const firstMember = evt.currentTarget.querySelector<HTMLElement>(
          '[data-user-id][tabindex="0"]'
        );
        firstMember?.focus();
      }}
    >
      <MemberDrawerHeader room={memberRoom} isFullWidth={isFullWidth} onToggleFullWidth={onToggleFullWidth} />
      <Box className={css.MemberDrawerContentBase} grow="Yes">
        <Scroll ref={scrollRef} variant="Background" size="300" visibility="Hover" hideTrack>
          <Box className={css.MemberDrawerContent} direction="Column" gap="200">
            <Box ref={scrollTopAnchorRef} className={css.DrawerGroup} direction="Column" gap="200">
              <Box alignItems="Center" justifyContent="SpaceBetween" gap="200">
                <UseStateProvider initial={undefined}>
                  {(anchor: RectCords | undefined, setAnchor) => (
                    <PopOut
                      anchor={anchor}
                      position="Bottom"
                      align="Start"
                      offset={4}
                      content={
                        <MembershipFilterMenu
                          selected={membershipFilterIndex}
                          onSelect={setMembershipFilterIndex}
                          requestClose={() => setAnchor(undefined)}
                        />
                      }
                    >
                      <Chip
                        onClick={
                          ((evt) =>
                            setAnchor(
                              evt.currentTarget.getBoundingClientRect()
                            )) as MouseEventHandler<HTMLButtonElement>
                        }
                        variant="Background"
                        size="400"
                        radii="300"
                        before={<Icon src={Icons.Filter} size="50" />}
                      >
                        <Text size="T200">{membershipFilter.name}</Text>
                      </Chip>
                    </PopOut>
                  )}
                </UseStateProvider>
                <UseStateProvider initial={undefined}>
                  {(anchor: RectCords | undefined, setAnchor) => (
                    <PopOut
                      anchor={anchor}
                      position="Bottom"
                      align="End"
                      offset={4}
                      content={
                        <MemberSortMenu
                          selected={sortFilterIndex}
                          onSelect={setSortFilterIndex}
                          requestClose={() => setAnchor(undefined)}
                        />
                      }
                    >
                      <Chip
                        onClick={
                          ((evt) =>
                            setAnchor(
                              evt.currentTarget.getBoundingClientRect()
                            )) as MouseEventHandler<HTMLButtonElement>
                        }
                        variant="Background"
                        size="400"
                        radii="300"
                        after={<Icon src={Icons.Sort} size="50" />}
                      >
                        <Text size="T200">{memberSort.name}</Text>
                      </Chip>
                    </PopOut>
                  )}
                </UseStateProvider>
              </Box>
              <Box direction="Column" gap="100">
                <Input
                  ref={searchInputRef}
                  onChange={handleSearchChange}
                  style={{ paddingRight: config.space.S200 }}
                  placeholder="Type name..."
                  variant="Surface"
                  size="400"
                  radii="400"
                  before={<Icon size="50" src={Icons.Search} />}
                  after={
                    result && (
                      <Chip
                        variant={result.items.length > 0 ? 'Success' : 'Critical'}
                        size="400"
                        radii="Pill"
                        aria-pressed
                        onClick={() => {
                          if (searchInputRef.current) {
                            searchInputRef.current.value = '';
                            searchInputRef.current.focus();
                          }
                          resetSearch();
                        }}
                        after={<Icon size="50" src={Icons.Cross} />}
                      >
                        <Text size="B300">{`${result.items.length || 'No'} ${
                          result.items.length === 1 ? 'Result' : 'Results'
                        }`}</Text>
                      </Chip>
                    )
                  }
                />
              </Box>
            </Box>

            <ScrollTopContainer scrollRef={scrollRef} anchorRef={scrollTopAnchorRef}>
              <IconButton
                onClick={() => virtualizer.scrollToOffset(0)}
                variant="Surface"
                radii="Pill"
                outlined
                size="300"
                aria-label="Scroll to Top"
              >
                <Icon src={Icons.ChevronTop} size="300" />
              </IconButton>
            </ScrollTopContainer>

            {!fetchingMembers && !result && processMembers.length === 0 && (
              <Text style={{ padding: config.space.S300 }} align="Center">
                {`No "${membershipFilter.name}" Members`}
              </Text>
            )}

            <Box className={css.MembersGroup} direction="Column" gap="100">
              <div
                role="listbox"
                aria-label="Members"
                aria-orientation="vertical"
                onKeyDown={handleListKeyDown}
                onFocus={(evt) => {
                  // Sync focusedVirtIndex when any member button receives focus.
                  const userId = (evt.target as HTMLElement).getAttribute('data-user-id');
                  if (!userId) return;
                  const idx = groupedVirtualItems.findIndex(
                    (m) => 'userId' in m && !isPresenceHeader(m) && (m as RoomMember).userId === userId
                  );
                  if (idx >= 0) setFocusedVirtIndex(idx);
                }}
                style={{ position: 'relative', height: virtualizer.getTotalSize() }}
              >
                {virtualizer.getVirtualItems().map((vItem) => {
                  const tagOrMember = groupedVirtualItems[vItem.index];

                  // Presence section header (ONLINE / OFFLINE)
                  if (isPresenceHeader(tagOrMember)) {
                    const presenceColor =
                      tagOrMember.label === 'ONLINE' ? '#23a55a' : '#747f8d';
                    return (
                      <Text
                        style={{
                          transform: `translateY(${vItem.start}px)`,
                          color: presenceColor,
                        }}
                        data-index={vItem.index}
                        ref={virtualizer.measureElement}
                        key={`${memberRoom.roomId}-presence-${tagOrMember.label}`}
                        className={classNames(css.MembersGroupLabel, css.DrawerVirtualItem)}
                        size="L400"
                      >
                        {`${tagOrMember.label} — ${tagOrMember.count}`}
                      </Text>
                    );
                  }

                  // Power-tag / role section header
                  if (!('userId' in tagOrMember)) {
                    return (
                      <Text
                        style={{
                          transform: `translateY(${vItem.start}px)`,
                        }}
                        data-index={vItem.index}
                        ref={virtualizer.measureElement}
                        key={`${memberRoom.roomId}-${vItem.index}`}
                        className={classNames(css.MembersGroupLabel, css.DrawerVirtualItem)}
                        size="L400"
                      >
                        {tagOrMember.name}
                      </Text>
                    );
                  }

                  const member = tagOrMember as RoomMember;
                  const isFocused = focusedVirtIndex === vItem.index;
                  const memberPresence = getMemberPresence(mx, member.userId);
                  // Roving tabindex: first member starts as tabIndex=0 (Tab entry point),
                  // then whichever member last had focus keeps tabIndex=0.
                  const memberTabIndex =
                    focusedVirtIndex >= 0
                      ? isFocused ? 0 : -1
                      : vItem.index === memberIndices[0] ? 0 : -1;
                  return (
                    <div
                      style={{
                        transform: `translateY(${vItem.start}px)`,
                      }}
                      className={css.DrawerVirtualItem}
                      data-index={vItem.index}
                       key={`${memberRoom.roomId}-${member.userId}`}
                      ref={virtualizer.measureElement}
                    >
                      <MemberItem
                        mx={mx}
                        useAuthentication={useAuthentication}
                         room={memberRoom}
                        member={member}
                        onClick={handleMemberClick}
                        pressed={openProfileUserId === member.userId}
                        typing={typingMembers.some(
                          (receipt) => receipt.userId === member.userId
                        )}
                        focused={isFocused}
                        optionId={`member-option-${member.userId}`}
                        tabIndex={memberTabIndex}
                        online={isOnline(memberPresence)}
                      />
                    </div>
                  );
                })}
              </div>
            </Box>

            {fetchingMembers && (
              <Box justifyContent="Center">
                <Spinner />
              </Box>
            )}
          </Box>
        </Scroll>
      </Box>
    </Box>
  );
}
