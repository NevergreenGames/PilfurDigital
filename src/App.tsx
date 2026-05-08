import { Component, ErrorInfo, ReactNode, useEffect } from 'react';
import { setScreen as audioSetScreen, unlockAudio } from './audio/engine';
import { useGameStore } from './state/gameStore';
import { useSettingsStore } from './state/settingsStore';
import { CharacterSelectScreen } from './ui/screens/CharacterSelectScreen';
import { RigSelectScreen } from './ui/screens/RigSelectScreen';
import { CreditsModal } from './ui/components/CreditsModal';
import { DevPanelButton } from './ui/components/DevPanelButton';
import { DevPanelScreen } from './ui/screens/DevPanelScreen';
import { DraftScreen } from './ui/screens/DraftScreen';
import { GameOverScreen } from './ui/screens/GameOverScreen';
import { GearIcon } from './ui/components/GearIcon';
import { HeistScreen } from './ui/screens/HeistScreen';
import { MapScreen } from './ui/screens/MapScreen';
import { SettingsModal } from './ui/components/SettingsModal';
import { TitleScreen } from './ui/screens/TitleScreen';
import { SceneTransition } from './ui/transitions/SceneTransition';
import { TutorialOverlay } from './tutorial/TutorialOverlay';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.warn('[Pilfur ErrorBoundary]', error.message, error.stack, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: '#fff', fontFamily: 'monospace', maxWidth: 900, margin: '40px auto', whiteSpace: 'pre-wrap' }}>
          <h2 style={{ color: '#ff8aa0' }}>Crash</h2>
          <div style={{ color: '#f7c87a', marginBottom: 12 }}>{this.state.error.message}</div>
          <pre style={{ fontSize: 11, color: '#a0a0b8' }}>{this.state.error.stack}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 12 }}>Reset</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const screen = useGameStore((s) => s.screen);
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);

  // Plumb reduce-motion preference onto the body so CSS can disable
  // heavy animations site-wide.
  useEffect(() => {
    document.body.dataset.reduceMotion = reduceMotion ? 'true' : 'false';
  }, [reduceMotion]);

  // Keep audio in sync with the current screen.
  useEffect(() => {
    audioSetScreen(screen);
  }, [screen]);

  // Unlock the audio context on the first user interaction. Browsers
  // block autoplay until then; once unlocked, the engine can crossfade
  // into the desired track.
  useEffect(() => {
    const handler = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('pointerdown', handler, { once: false });
    window.addEventListener('keydown', handler, { once: false });
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, []);

  let body: React.ReactNode;
  switch (screen) {
    case 'title':
      body = <TitleScreen />;
      break;
    case 'characterSelect':
      body = <CharacterSelectScreen />;
      break;
    case 'rigSelect':
      body = <RigSelectScreen />;
      break;
    case 'map':
      body = <MapScreen />;
      break;
    case 'heist':
      body = <HeistScreen />;
      break;
    case 'draft':
      body = <DraftScreen />;
      break;
    case 'gameOver':
      body = <GameOverScreen />;
      break;
    case 'dev':
      body = <DevPanelScreen />;
      break;
    default:
      body = <div>Unknown screen: {screen}</div>;
  }

  return (
    <>
      <ErrorBoundary>
        <SceneTransition sceneKey={screen}>{body}</SceneTransition>
      </ErrorBoundary>
      <GearIcon />
      <SettingsModal />
      <CreditsModal />
      <TutorialOverlay />
      <DevPanelButton />
    </>
  );
}
