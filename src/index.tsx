/* eslint-disable import/first */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { enableMapSet } from 'immer';
import '@fontsource/inter/variable.css';
import 'folds/dist/style.css';
import { configClass, varsClass } from 'folds';
import './app/styles/global.css';

enableMapSet();

import './index.css';

import { trimTrailingSlash } from './app/utils/common';
import App from './app/pages/App';

// import i18n (needs to be bundled ;))
import './app/i18n';
import { pushSessionToSW } from './sw-session';
import { getSessionAsync } from './app/state/sessions';

document.body.classList.add(configClass, varsClass);

// Service worker in dev frequently causes stale-cache / white-screen issues on
// localhost after branch switches or Vite restarts. Keep SW for production only
// and proactively unregister any old localhost registrations in development.
if ('serviceWorker' in navigator) {
  const sendSessionToSW = async () => {
    const session = await getSessionAsync();
    pushSessionToSW(session?.baseUrl, session?.accessToken);
  };

  if (import.meta.env.DEV) {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        void registration.unregister();
      });
    });
  } else {
    const swUrl = `${trimTrailingSlash(import.meta.env.BASE_URL)}/sw.js`;

    navigator.serviceWorker.register(swUrl).then(() => void sendSessionToSW());
    navigator.serviceWorker.ready.then(() => void sendSessionToSW());

    navigator.serviceWorker.addEventListener('message', (ev) => {
      const { type } = ev.data ?? {};

      if (type === 'requestSession') {
        void sendSessionToSW();
      }
    });
  }
}

const mountApp = () => {
  const rootContainer = document.getElementById('root');

  if (rootContainer === null) {
    console.error('Root container element not found!');
    return;
  }

  const root = createRoot(rootContainer);
  root.render(<App />);
};

mountApp();
