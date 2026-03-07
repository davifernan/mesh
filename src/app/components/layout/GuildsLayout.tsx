import React, { ReactNode } from 'react';
import styles from './GuildsLayout.module.css';

interface GuildsLayoutProps {
  guildList: ReactNode;
  channelList: ReactNode;
  children: ReactNode;
}

export function GuildsLayout({ guildList, channelList, children }: GuildsLayoutProps) {
  return (
    <div className={styles.guildsLayout}>
      {/* Left: Guild/Space icons (72px) */}
      <div className={styles.guildListColumn}>
        {guildList}
      </div>

      {/* Right: Channel list + main content */}
      <div className={styles.contentContainer}>
        {/* Channel sidebar (270px) */}
        <div className={styles.channelListColumn}>
          {channelList}
        </div>

        {/* Main content (messages etc.) */}
        <div className={styles.mainContent}>
          {children}
        </div>
      </div>
    </div>
  );
}
