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
        <img className={css.Logo} src="/res/svg/mesh-icon.svg" alt="mesh" />
      </div>
    </div>
  );
}
