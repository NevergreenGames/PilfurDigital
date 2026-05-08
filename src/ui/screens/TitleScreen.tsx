import { useGameStore } from '../../state/gameStore';
import { useTutorialStore } from '../../state/tutorialStore';
import { useUIStore } from '../../state/uiStore';
import { DieGlyph } from '../components/DieGlyph';
import { GlitchButton } from '../components/GlitchButton';
import { GlitchTitle } from '../components/GlitchTitle';
import { GlitchTypewriter } from '../components/GlitchTypewriter';
import { staggerStyle } from '../transitions/transitionUtils';

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
        <h1 className="title-wordmark">
          <GlitchTitle text="PILFUR" perWordMs={70} />
        </h1>
        <p className="title-tagline">
          <GlitchTypewriter text="Five jobs. One getaway." perWordMs={90} delayMs={120} />
        </p>
        <div className="title-buttons">
          <GlitchButton
            className="primary big stagger-item"
            onClick={onPlay}
            style={staggerStyle(0, { initial: 200 })}
            label="PLAY"
          />
          <GlitchButton
            className="big stagger-item"
            onClick={openSettings}
            style={staggerStyle(1, { initial: 200 })}
            label="SETTINGS"
          />
          <GlitchButton
            className="big stagger-item"
            onClick={onHowToPlay}
            style={staggerStyle(2, { initial: 200 })}
            label="HOW TO PLAY"
          />
          <GlitchButton
            className="big stagger-item"
            onClick={openCredits}
            style={staggerStyle(3, { initial: 200 })}
            label="CREDITS"
          />
        </div>
      </div>
    </div>
  );
}
