import { useGameStore } from './state/gameStore';
import { CharacterSelectScreen } from './ui/screens/CharacterSelectScreen';
import { MapScreen } from './ui/screens/MapScreen';
import { HeistPlanningScreen } from './ui/screens/HeistPlanningScreen';
import { HeistExecutionScreen } from './ui/screens/HeistExecutionScreen';
import { HeistEscapeScreen } from './ui/screens/HeistEscapeScreen';
import { DraftScreen } from './ui/screens/DraftScreen';
import { GameOverScreen } from './ui/screens/GameOverScreen';

export function App() {
  const screen = useGameStore((s) => s.screen);
  switch (screen) {
    case 'characterSelect':
      return <CharacterSelectScreen />;
    case 'map':
      return <MapScreen />;
    case 'heistPlanning':
      return <HeistPlanningScreen />;
    case 'heistExecution':
      return <HeistExecutionScreen />;
    case 'heistEscape':
      return <HeistEscapeScreen />;
    case 'draft':
      return <DraftScreen />;
    case 'gameOver':
      return <GameOverScreen />;
    default:
      return <div>Unknown screen: {screen}</div>;
  }
}
