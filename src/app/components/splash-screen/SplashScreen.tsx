import React, { ReactNode } from 'react';
import * as css from './SplashScreen.css';

type SplashScreenProps = {
  children: ReactNode;
};

function MeshLogoMark() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
      <defs>
        <linearGradient id="splashBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5ea6ff" />
          <stop offset="40%" stopColor="#4a5ef8" />
          <stop offset="100%" stopColor="#24258b" />
        </linearGradient>
        <filter id="splashShadow" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="4" dy="8" stdDeviation="6" floodColor="#070a3a" floodOpacity="0.45" />
        </filter>
        <radialGradient id="splashNode" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#f0f6ff" />
          <stop offset="100%" stopColor="#b6d0fa" />
        </radialGradient>
      </defs>
      <rect x="24" y="24" width="464" height="464" rx="115" ry="115" fill="url(#splashBg)" />
      <g filter="url(#splashShadow)">
        <g stroke="#f0f6ff" strokeWidth="22" strokeLinecap="round">
          <line x1="205" y1="115" x2="380" y2="155" />
          <line x1="380" y1="155" x2="380" y2="315" />
          <line x1="380" y1="315" x2="205" y2="385" />
          <line x1="205" y1="385" x2="110" y2="260" />
          <line x1="110" y1="260" x2="205" y2="115" />
          <line x1="205" y1="115" x2="256" y2="220" />
          <line x1="380" y1="155" x2="256" y2="220" />
          <line x1="380" y1="315" x2="256" y2="220" />
          <line x1="205" y1="385" x2="256" y2="220" />
          <line x1="110" y1="260" x2="256" y2="220" />
        </g>
        <circle cx="205" cy="115" r="30" fill="url(#splashNode)" />
        <circle cx="380" cy="155" r="30" fill="url(#splashNode)" />
        <circle cx="256" cy="220" r="32" fill="url(#splashNode)" />
        <circle cx="380" cy="315" r="30" fill="url(#splashNode)" />
        <circle cx="205" cy="385" r="30" fill="url(#splashNode)" />
        <circle cx="110" cy="260" r="30" fill="url(#splashNode)" />
      </g>
    </svg>
  );
}

export function SplashScreen({ children }: SplashScreenProps) {
  return (
    <div className={css.SplashScreen}>
      {children}
      <div className={css.SplashCenter}>
        <div className={css.PulseRing} />
        <div className={css.Logo}>
          <MeshLogoMark />
        </div>
      </div>
    </div>
  );
}
