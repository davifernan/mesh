import React, { ReactNode } from 'react';
import * as css from './SplashScreen.css';

type SplashScreenProps = {
  children: ReactNode;
};

export function SplashScreen({ children }: SplashScreenProps) {
  return (
    <div className={css.SplashScreen}>
      {children}
      <div className={css.SplashCenter}>
        <div className={css.PulseRing} />
        <div className={css.Logo}>BC</div>
      </div>
    </div>
  );
}
