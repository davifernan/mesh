import React from 'react';
import styles from './SignalStrengthIcon.module.css';

interface SignalStrengthIconProps {
  latencyMs: number | null; // null = loading/unknown
  size?: number;
}

export function SignalStrengthIcon({ latencyMs, size = 16 }: SignalStrengthIconProps) {
  // Color based on latency
  const color =
    latencyMs === null
      ? 'var(--text-muted)'
      : latencyMs <= 50
        ? 'var(--voice-status-success, #23a55a)'
        : latencyMs <= 100
          ? 'var(--voice-status-warning, #faa61a)'
          : latencyMs <= 150
            ? '#FF8C00'
            : 'var(--voice-status-danger, #f23f43)';

  // Number of active arcs (0-4 based on latency)
  const activeArcs =
    latencyMs === null
      ? 0
      : latencyMs <= 50
        ? 4
        : latencyMs <= 100
          ? 3
          : latencyMs <= 150
            ? 2
            : 1;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      {/* Base dot */}
      <circle
        cx="3" cy="13" r="1.5"
        fill={latencyMs === null ? 'var(--text-muted)' : (activeArcs >= 1 ? color : 'var(--text-muted)')}
        className={latencyMs === null ? styles.arcLoading0 : undefined}
      />
      {/* Arc 1 (smallest) */}
      <path
        d="M5.5 11 Q5.5 9 3 9 Q0.5 9 0.5 11"
        stroke={activeArcs >= 2 ? color : 'var(--text-muted)'}
        strokeWidth="1.5"
        strokeLinecap="round"
        className={latencyMs === null ? styles.arcLoading1 : undefined}
      />
      {/* Arc 2 */}
      <path
        d="M8 9 Q8 5.5 3 5.5 Q-2 5.5 -2 9"
        stroke={activeArcs >= 3 ? color : 'var(--text-muted)'}
        strokeWidth="1.5"
        strokeLinecap="round"
        className={latencyMs === null ? styles.arcLoading2 : undefined}
      />
      {/* Arc 3 */}
      <path
        d="M10.5 7 Q10.5 2 3 2 Q-4.5 2 -4.5 7"
        stroke={activeArcs >= 4 ? color : 'var(--text-muted)'}
        strokeWidth="1.5"
        strokeLinecap="round"
        className={latencyMs === null ? styles.arcLoading3 : undefined}
      />
      {/* Arc 4 (largest) */}
      <path
        d="M13 5 Q13 -1 3 -1 Q-7 -1 -7 5"
        stroke={activeArcs >= 4 ? color : 'var(--text-muted)'}
        strokeWidth="1.5"
        strokeLinecap="round"
        className={latencyMs === null ? styles.arcLoading3 : undefined}
      />
    </svg>
  );
}
