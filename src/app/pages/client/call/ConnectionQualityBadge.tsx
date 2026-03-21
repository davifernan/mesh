import React, { useState, useEffect } from 'react';
import { ConnectionQuality, RoomEvent } from 'livekit-client';
import { useLocalParticipant } from '@livekit/components-react';

const QUALITY_CONFIG: Record<ConnectionQuality, { label: string; color: string; blink?: boolean }> = {
  [ConnectionQuality.Excellent]: { label: 'Excellent', color: '#3ba55d' },
  [ConnectionQuality.Good]: { label: 'Good', color: '#faa61a' },
  [ConnectionQuality.Poor]: { label: 'Poor', color: '#ed4245' },
  [ConnectionQuality.Lost]: { label: 'Lost', color: '#ed4245', blink: true },
  [ConnectionQuality.Unknown]: { label: '', color: 'transparent' },
};

export function ConnectionQualityBadge() {
  const { localParticipant } = useLocalParticipant();
  const [quality, setQuality] = useState<ConnectionQuality>(localParticipant.connectionQuality);

  useEffect(() => {
    const handler = (q: ConnectionQuality) => setQuality(q);
    localParticipant.on(RoomEvent.ConnectionQualityChanged as any, handler);
    return () => { localParticipant.off(RoomEvent.ConnectionQualityChanged as any, handler); };
  }, [localParticipant]);

  const config = QUALITY_CONFIG[quality];
  if (!config.label) return null;

  return (
    <div
      title={`Connection: ${config.label}`}
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: config.color,
        flexShrink: 0,
        animation: config.blink ? 'blink 1s step-start infinite' : undefined,
      }}
      aria-label={`Connection quality: ${config.label}`}
    />
  );
}
