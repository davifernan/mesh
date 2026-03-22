import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { getCanonicalAliasOrRoomId } from '../../utils/matrix';
import { getDirectRoomPath, getHomeRoomPath, getSpaceRoomPath } from '../../pages/pathUtils';
import { mDirectAtom } from '../../state/mDirectList';
import { roomToParentsAtom } from '../../state/room/roomToParents';

interface QuickSwitcherModalProps {
  onClose: () => void;
}

export function QuickSwitcherModal({ onClose }: QuickSwitcherModalProps) {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const mDirects = useAtomValue(mDirectAtom);
  const roomToParents = useAtomValue(roomToParentsAtom);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allRooms = useMemo(() => mx.getVisibleRooms(), [mx]);

  const filteredRooms = useMemo(() => {
    if (!query.trim()) return allRooms.slice(0, 8);
    const q = query.toLowerCase();
    return allRooms
      .filter(
        (room) =>
          room.name?.toLowerCase().includes(q) ||
          room.getCanonicalAlias()?.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [allRooms, query]);

  const handleSelect = useCallback(
    (roomId: string) => {
      const roomIdOrAlias = getCanonicalAliasOrRoomId(mx, roomId);
      const isDirect = mDirects.has(roomId);
      if (isDirect) {
        navigate(getDirectRoomPath(roomIdOrAlias));
      } else {
        const parents = roomToParents.get(roomId);
        if (parents && parents.size > 0) {
          const spaceId = Array.from(parents)[0];
          const spaceIdOrAlias = getCanonicalAliasOrRoomId(mx, spaceId);
          navigate(getSpaceRoomPath(spaceIdOrAlias, roomIdOrAlias));
        } else {
          navigate(getHomeRoomPath(roomIdOrAlias));
        }
      }
      onClose();
    },
    [mx, navigate, mDirects, roomToParents, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredRooms.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filteredRooms[selectedIndex]) {
        handleSelect(filteredRooms[selectedIndex].roomId);
      }
    },
    [filteredRooms, selectedIndex, handleSelect, onClose]
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          borderRadius: '12px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          width: '100%',
          maxWidth: '560px',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Quick Switcher"
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Jump to a room or DM..."
          aria-label="Search rooms"
          style={{
            width: '100%',
            padding: '16px 20px',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--bg-surface-border)',
            outline: 'none',
            fontSize: '16px',
            color: 'var(--text-primary)',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {filteredRooms.length === 0 ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '14px',
              }}
            >
              No rooms found
            </div>
          ) : (
            filteredRooms.map((room, i) => (
              <button
                key={room.roomId}
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '10px 20px',
                  background:
                    i === selectedIndex ? 'var(--bg-surface-hover)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'var(--text-primary)',
                }}
                onClick={() => handleSelect(room.roomId)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--bg-surface-low)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: 600,
                  }}
                >
                  {(room.name ?? '?')[0]?.toUpperCase()}
                </span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>{room.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {room.getCanonicalAlias() ?? room.roomId}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
        <div
          style={{
            padding: '8px 20px',
            borderTop: '1px solid var(--bg-surface-border)',
            display: 'flex',
            gap: '12px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}
        >
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
