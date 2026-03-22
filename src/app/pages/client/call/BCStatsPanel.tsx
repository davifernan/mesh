import React, { useState, useEffect, useRef } from 'react';
import { useRoomContext, useConnectionState } from '@livekit/components-react';
import { ConnectionState, ConnectionQuality, RoomEvent, Track } from 'livekit-client';
import { X } from '@phosphor-icons/react';
import { getRoomStats } from '../../../features/call/roomStats';
import styles from './BCStatsPanel.module.css';

interface BCStatsPanelProps {
  onClose: () => void;
}

const qualityLabel: Record<ConnectionQuality, string> = {
  [ConnectionQuality.Excellent]: 'Excellent',
  [ConnectionQuality.Good]: 'Good',
  [ConnectionQuality.Poor]: 'Poor',
  [ConnectionQuality.Lost]: 'Lost',
  [ConnectionQuality.Unknown]: '–',
};

function getRttColor(rtt: number): string {
  if (rtt < 100) return '#23a55a';
  if (rtt < 200) return '#faa61a';
  return '#f23f43';
}

function getJitterColor(jitter: number): string {
  if (jitter < 20) return '#23a55a';
  if (jitter < 50) return '#faa61a';
  return '#f23f43';
}

function getPacketLossColor(lost: number, total: number): string {
  if (total === 0) return '#23a55a';
  const pct = (lost / total) * 100;
  if (pct < 2) return '#23a55a';
  if (pct < 5) return '#faa61a';
  return '#f23f43';
}

export function BCStatsPanel({ onClose }: BCStatsPanelProps) {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [packetsLost, setPacketsLost] = useState<number | null>(null);
  const [packetsTotal, setPacketsTotal] = useState<number>(0);
  const [jitterMs, setJitterMs] = useState<number | null>(null);
  const [quality, setQuality] = useState<ConnectionQuality>(ConnectionQuality.Unknown);
  const [audioKbps, setAudioKbps] = useState<number>(0);
  const [videoKbps, setVideoKbps] = useState<number>(0);

  useEffect(() => {
    const handler = (q: ConnectionQuality, participant: any) => {
      if (participant === room.localParticipant) setQuality(q);
    };
    room.on(RoomEvent.ConnectionQualityChanged, handler);
    return () => { room.off(RoomEvent.ConnectionQualityChanged, handler); };
  }, [room]);

  useEffect(() => {
    const isMountedRef = { current: true };
    const update = () => {
      if (!isMountedRef.current) return;
      setParticipantCount(room.numParticipants ?? 0);

      // Audio/video bitrate from local participant track objects
      const audioPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      setAudioKbps(Math.round((audioPub?.track?.currentBitrate ?? 0) / 1000));

      const videoPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      setVideoKbps(Math.round((videoPub?.track?.currentBitrate ?? 0) / 1000));

      // Delegate all private-field access to the version-safe abstraction
      getRoomStats(room).then((stats) => {
        if (!isMountedRef.current) return;
        setLatencyMs(stats.rtt);
        setJitterMs(stats.jitter);
        if (stats.packetsLost !== null) {
          setPacketsLost(stats.packetsLost);
          setPacketsTotal(stats.packetsTotal);
        }
      }).catch(() => {});
    };
    update();
    const interval = setInterval(update, 3000);
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [room]);

  const stateLabel: Record<ConnectionState, string> = {
    [ConnectionState.Connected]: 'Connected',
    [ConnectionState.Connecting]: 'Connecting',
    [ConnectionState.Disconnected]: 'Disconnected',
    [ConnectionState.Reconnecting]: 'Reconnecting',
    [ConnectionState.SignalReconnecting]: 'Reconnecting',
  };

  const rttColor = latencyMs !== null ? getRttColor(latencyMs) : undefined;
  const jitterColor = jitterMs !== null ? getJitterColor(jitterMs) : undefined;
  const packetLossColor =
    packetsLost !== null ? getPacketLossColor(packetsLost, packetsTotal) : undefined;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Call Stats</span>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close stats">
          <X size={14} />
        </button>
      </div>
      <div className={styles.rows}>
        <StatRow label="Status" value={stateLabel[connectionState] ?? connectionState} />
        <StatRow label="Quality" value={qualityLabel[quality]} />
        <StatRow label="Participants" value={String(participantCount)} />
        {latencyMs !== null && (
          <StatRow label="Signal RTT" value={`${latencyMs} ms`} valueColor={rttColor} />
        )}
        {jitterMs !== null && (
          <StatRow label="Jitter" value={`${jitterMs} ms`} valueColor={jitterColor} />
        )}
        {packetsLost !== null && (
          <StatRow
            label="Packets Lost"
            value={String(packetsLost)}
            valueColor={packetLossColor}
          />
        )}
        <StatRow label="Audio" value={`${audioKbps} kbps`} />
        <StatRow label="Video" value={`${videoKbps} kbps`} />
        {room.name && <StatRow label="Room" value={room.name} />}
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value} style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
    </div>
  );
}
