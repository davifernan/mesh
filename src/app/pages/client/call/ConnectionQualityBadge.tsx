/**
 * ConnectionQualityBadge.tsx — #65
 *
 * Small inline badge showing the local participant's connection quality.
 * Renders a colored dot + label: Excellent (green) / Good (green) /
 * Poor (yellow) / Lost (red) / Unknown (grey).
 *
 * Usage: drop it anywhere inside a LiveKitRoom context (e.g. NativeCallView).
 */

import React, { useEffect, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { ConnectionQuality, RoomEvent } from 'livekit-client';

// ─── Colour map ───────────────────────────────────────────────────────────────

const QUALITY_COLOR: Record<ConnectionQuality, string> = {
  [ConnectionQuality.Excellent]: '#23A55A',
  [ConnectionQuality.Good]:      '#23A55A',
  [ConnectionQuality.Poor]:      '#faa61a',
  [ConnectionQuality.Lost]:      '#F23F43',
  [ConnectionQuality.Unknown]:   '#747f8d',
};

const QUALITY_LABEL: Record<ConnectionQuality, string> = {
  [ConnectionQuality.Excellent]: 'Excellent',
  [ConnectionQuality.Good]:      'Good',
  [ConnectionQuality.Poor]:      'Poor',
  [ConnectionQuality.Lost]:      'Lost',
  [ConnectionQuality.Unknown]:   '–',
};

// ─── Component ───────────────────────────────────────────────────────────────

type Props = {
  /** If true, only the dot is rendered (no label text). Useful for compact UIs. */
  dotOnly?: boolean;
  style?: React.CSSProperties;
};

export function ConnectionQualityBadge({ dotOnly, style }: Props) {
  const room = useRoomContext();
  const [quality, setQuality] = useState<ConnectionQuality>(
    room.localParticipant.connectionQuality ?? ConnectionQuality.Unknown,
  );

  useEffect(() => {
    const handler = (q: ConnectionQuality, participant: unknown) => {
      // ConnectionQualityChanged fires for all participants; we only care about local.
      if ((participant as typeof room.localParticipant).identity === room.localParticipant.identity) {
        setQuality(q);
      }
    };
    room.on(RoomEvent.ConnectionQualityChanged, handler);
    return () => { room.off(RoomEvent.ConnectionQualityChanged, handler); };
  }, [room]);

  const color = QUALITY_COLOR[quality];
  const label = QUALITY_LABEL[quality];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '12px',
        color: '#949ba4',
        userSelect: 'none',
        ...style,
      }}
      title={`Connection quality: ${label}`}
    >
      {/* Pulsing dot for Poor/Lost quality */}
      <span
        style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
          animation:
            quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost
              ? 'bcQualityPulse 1.2s ease-in-out infinite'
              : undefined,
        }}
      />
      {!dotOnly && (
        <span style={{ color }}>{label}</span>
      )}
      <style>{`
        @keyframes bcQualityPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </span>
  );
}
