import { useGameStore } from '../../state/gameStore';
import { useTutorialStore } from '../../state/tutorialStore';
import { useUIStore } from '../../state/uiStore';
import { DieGlyph } from '../components/DieGlyph';

const FLOATING_DICE: Array<{ size: 4 | 6 | 8 | 10 | 12 | 20; top: string; left: string; delay: string; px: number }> = [
  { size: 6,  top: '12%', left: '8%',  delay: '0s',   px: 88 },
  { size: 20, top: '70%', left: '14%', delay: '1.4s', px: 120 },
  { size: 4,  top: '22%', left: '78%', delay: '0.7s', px: 76 },
  { size: 12, top: '58%', left: '82%', delay: '2.1s', px: 110 },
  { size: 8,  top: '40%', left: '5%',  delay: '2.8s', px: 64 },
  { size: 10, top: '85%', left: '60%', delay: '0.4s', px: 72 },
];

export function TitleScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const openSettings = useUIStore((s) => s.openSettings);
  const openCredits = useUIStore((s) => s.openCredits);
  const resetTutorial = useTutorialStore((s) => s.resetAll);

  const onPlay = () => setScreen('characterSelect');
  const onHowToPlay = () => {
    resetTutorial();
    setScreen('characterSelect');
  };

  return (
    <div className="title-screen">
      <div className="title-bg-dice" aria-hidden="true">
        {FLOATING_DICE.map((d, i) => (
          <span
            key={i}
            className="title-bg-die"
            style={{
              top: d.top,
              left: d.left,
              animationDelay: d.delay,
            }}
          >
            <DieGlyph size={d.size} px={d.px} />
          </span>
        ))}
      </div>
      <div className="title-content">
        <h1 className="title-wordmark">PILFUR</h1>
        <p className="title-tagline">Five jobs. One getaway.</p>
        <div className="title-buttons">
          <button className="primary big" onClick={onPlay}>
            PLAY
          </button>
          <button className="big" onClick={openSettings}>
            SETTINGS
          </button>
          <button className="big" onClick={onHowToPlay}>
            HOW TO PLAY
          </button>
          <button className="big" onClick={openCredits}>
            CREDITS
          </button>
        </div>
      </div>
    </div>
  );
}
