import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { useGameStore } from './state/gameStore';
import { useSettingsStore } from './state/settingsStore';
import { useTutorialStore } from './state/tutorialStore';
import { useUIStore } from './state/uiStore';
import './styles/globals.css';
import './styles/title.css';
import './styles/overlays.css';

// Runtime debug surface — handy for testing in the browser console
// (window.__pilfur.gameStore.getState() etc.). Harmless in prod.
if (typeof window !== 'undefined') {
  (window as unknown as { __pilfur: unknown }).__pilfur = {
    gameStore: useGameStore,
    settingsStore: useSettingsStore,
    tutorialStore: useTutorialStore,
    uiStore: useUIStore,
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
