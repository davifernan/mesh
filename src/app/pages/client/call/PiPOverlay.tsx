import React, { useCallback, useEffect, useRef, useState } from 'react';
import { atom, useAtom } from 'jotai';
import { motion, animate, useMotionValue, type SpringOptions } from 'framer-motion';
import { RoomContext, VideoTrack, useTracks, isTrackReference } from '@livekit/components-react';
import { Track, LocalParticipant } from 'livekit-client';
import { ArrowLeft, PhoneX } from '@phosphor-icons/react';
import { useCallState } from './CallProvider';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import styles from './PiPOverlay.module.css';

// ── Constants ──────────────────────────────────────────────────────────────

const PIP_DEFAULT_WIDTH = 320;
const PIP_ASPECT_RATIO = 16 / 9;
const EDGE_PADDING = 16;

const SNAP_SPRING: SpringOptions = {
  stiffness: 520,
  damping: 42,
  mass: 0.9,
};

type Corner = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';

const pipCornerAtom = atom<Corner>('bottom-right');

// ── Helper utilities ───────────────────────────────────────────────────────

function getPiPHeight(width: number): number {
  return Math.round(width / PIP_ASPECT_RATIO);
}

function getCornerPositions(
  vw: number,
  vh: number,
  w: number,
  h: number
): Record<Corner, { x: number; y: number }> {
  const maxX = Math.max(EDGE_PADDING, vw - w - EDGE_PADDING);
  const maxY = Math.max(EDGE_PADDING, vh - h - EDGE_PADDING);
  return {
    'top-left': { x: EDGE_PADDING, y: EDGE_PADDING },
    'top-right': { x: maxX, y: EDGE_PADDING },
    'bottom-left': { x: EDGE_PADDING, y: maxY },
    'bottom-right': { x: maxX, y: maxY },
  };
}

function getNearestCorner(
  posX: number,
  posY: number,
  velX: number,
  velY: number,
  corners: Record<Corner, { x: number; y: number }>
): Corner {
  // Project by 0.2s of velocity for fling feel
  const px = posX + velX * 0.2;
  const py = posY + velY * 0.2;

  let best: Corner = 'bottom-right';
  let bestDist = Infinity;
  for (const [corner, pos] of Object.entries(corners) as [Corner, { x: number; y: number }][]) {
    const dx = pos.x - px;
    const dy = pos.y - py;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = corner;
    }
  }
  return best;
}

// ── PiPContent (inner — must be inside RoomContext) ────────────────────────

interface PiPContentProps {
  channelName: string;
  width: number;
  height: number;
  pipWidth: number;
  onResize: (w: number) => void;
  corner: Corner;
  onCornerChange: (c: Corner) => void;
  onHangUp: () => void;
  onReturnToCall: () => void;
}

function PiPContent({
  channelName,
  width,
  height,
  pipWidth,
  onResize,
  corner,
  onCornerChange,
  onHangUp,
  onReturnToCall,
}: PiPContentProps) {
  const { speakingUsers, isFrontCamera } = useCallState();
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; edge: string } | null>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Snap to corner with spring animation
  const snapToCorner = useCallback(
    (target: Corner) => {
      const pos = getCornerPositions(window.innerWidth, window.innerHeight, width, height)[target];
      animate(x, pos.x, SNAP_SPRING);
      animate(y, pos.y, SNAP_SPRING);
    },
    [x, y, width, height]
  );

  // Initialize position + re-snap on corner/size changes (from outside)
  useEffect(() => {
    if (!isDraggingRef.current) {
      snapToCorner(corner);
    }
  }, [corner, snapToCorner]);

  // Re-clamp on window resize
  useEffect(() => {
    const handleWindowResize = () => {
      if (!isDraggingRef.current) snapToCorner(corner);
    };
    window.addEventListener('resize', handleWindowResize, { passive: true });
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [corner, snapToCorner]);

  // ── Resize handles ────────────────────────────────────────────────────
  const handleResizeStart = useCallback((e: React.PointerEvent, edge: string) => {
    e.stopPropagation();
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: pipWidth, edge };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pipWidth]);

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const { startX, startW, edge } = resizeRef.current;
    let delta = 0;
    if (edge.includes('E')) delta = e.clientX - startX;
    else if (edge.includes('W')) delta = startX - e.clientX;
    else if (edge.includes('N') || edge.includes('S')) delta = Math.abs(e.clientY - resizeRef.current.startY);
    const newW = Math.min(720, Math.max(240, startW + delta));
    onResize(newW);
  }, [onResize]);

  const handleResizeEnd = useCallback(() => {
    resizeRef.current = null;
  }, []);

  // ── VideoTrack: active speaker priority ───────────────────────────────
  const allTracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ]);

  const isCameraAvailable = (t: (typeof allTracks)[number]) =>
    t.source === Track.Source.Camera &&
    isTrackReference(t) &&
    t.publication != null &&
    !t.publication.isMuted;

  const activeSpeakerId = speakingUsers.size > 0 ? [...speakingUsers][0] : null;

  const cameraTrackRef = activeSpeakerId
    ? (allTracks.find((t) => isCameraAvailable(t) && t.participant.identity === activeSpeakerId) ??
       allTracks.find(isCameraAvailable))
    : allTracks.find(isCameraAvailable);

  return (
    <motion.div
      className={styles.container}
      style={{ x, y, width, height }}
      data-speaking={speakingUsers.size > 0 ? 'true' : 'false'}
      drag
      dragMomentum={false}
      dragElastic={0}
      onDragStart={() => {
        isDraggingRef.current = true;
        setIsDragging(true);
      }}
      onDragEnd={(_e, info) => {
        isDraggingRef.current = false;
        setIsDragging(false);
        const currentX = x.get();
        const currentY = y.get();
        const recalcCorners = getCornerPositions(
          window.innerWidth,
          window.innerHeight,
          width,
          height
        );
        const target = getNearestCorner(
          currentX,
          currentY,
          info.velocity.x,
          info.velocity.y,
          recalcCorners
        );
        onCornerChange(target);
        snapToCorner(target);
      }}
      whileDrag={{ scale: 1.02 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      {/* ── Resize handles ───────────────────────────────────────────── */}
      {(['NW', 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W'] as const).map((edge) => (
        <div
          key={edge}
          className={`${styles.resizeHandle} ${styles[`resize${edge}`]}`}
          onPointerDown={(e) => handleResizeStart(e, edge)}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
        />
      ))}

      {/* ── Media: camera video or avatar fallback ───────────────────── */}
      {cameraTrackRef && isTrackReference(cameraTrackRef) ? (
        <VideoTrack
          className={[
            styles.video,
            cameraTrackRef.participant instanceof LocalParticipant && isFrontCamera ? styles.videoMirrored : '',
          ].filter(Boolean).join(' ')}
          trackRef={cameraTrackRef}
        />
      ) : (
        <div className={styles.avatarFallback}>
          <div className={styles.avatarCircle}>
            {channelName.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* ── Hover overlay ─────────────────────────────────────────────── */}
      <div className={[styles.hoverOverlay, (isHovered || isDragging) ? styles.hoverOverlayVisible : ''].filter(Boolean).join(' ')}>
        {/* Top bar */}
        <div className={styles.topBar}>
          <button
            type="button"
            className={styles.returnBtn}
            onClick={(e) => { e.stopPropagation(); onReturnToCall(); }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Return to call"
          >
            <ArrowLeft size={13} weight="bold" />
            <span className={styles.returnLabel}>#{channelName}</span>
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={(e) => { e.stopPropagation(); onHangUp(); }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Hang up"
          >
            <PhoneX size={13} weight="fill" />
          </button>
        </div>

        {/* Bottom bar */}
        <div className={styles.bottomBar}>
          <span className={styles.channelName}>{channelName}</span>
          <button
            type="button"
            className={styles.hangupBtn}
            onClick={(e) => { e.stopPropagation(); onHangUp(); }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="End call"
          >
            <PhoneX size={13} weight="fill" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── PiPOverlay (outer — sets up RoomContext) ───────────────────────────────

export function PiPOverlay() {
  const { livekitRoom, activeCallRoomId, callStatus, hangUp } = useCallState();
  const mx = useMatrixClient();
  const [corner, setCorner] = useAtom(pipCornerAtom);
  const [pipWidth, setPipWidth] = useState(PIP_DEFAULT_WIDTH);

  const width = pipWidth;
  const height = getPiPHeight(width);

  const channelName = activeCallRoomId
    ? (mx.getRoom(activeCallRoomId)?.name ?? 'Voice Call')
    : 'Voice Call';

  const handleReturnToCall = useCallback(() => {
    // Navigate back — in mesh the router handles this via the active call room
    // The user can re-click the voice channel in the sidebar to return
    window.history.back();
  }, []);

  if (!livekitRoom || callStatus !== 'connected') return null;

  return (
    <RoomContext.Provider value={livekitRoom}>
      <PiPContent
        channelName={channelName}
        width={width}
        height={height}
        pipWidth={pipWidth}
        onResize={setPipWidth}
        corner={corner}
        onCornerChange={setCorner}
        onHangUp={hangUp}
        onReturnToCall={handleReturnToCall}
      />
    </RoomContext.Provider>
  );
}
