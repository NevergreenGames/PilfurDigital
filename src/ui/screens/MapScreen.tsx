import { useGameStore, TOTAL_NODES } from '../../state/gameStore';
import { describeRequirement } from '../../engine/requirements';
import { DieGlyph } from '../components/DieGlyph';
import { GlitchButton } from '../components/GlitchButton';
import { GlitchTypewriter } from '../components/GlitchTypewriter';
import { staggerStyle } from '../transitions/transitionUtils';

export function MapScreen() {
  const run = useGameStore((s) => s.run);
  const selectTarget = useGameStore((s) => s.selectTarget);
  if (!run) return null;
  const node = run.map[run.nodeIndex];
  const isFinal = run.nodeIndex === TOTAL_NODES - 1;
  return (
    <div className="screen map">
      <header className="run-header">
        <div className="run-header-char">
          <strong>{run.character.name}</strong>
          <DieGlyph size={run.characterDie} px={22} />
        </div>
        <div>
          Node {run.nodeIndex + 1} / {TOTAL_NODES} {isFinal && '· FINAL HEIST'}
        </div>
        <div>
          <span className="creds-pill" title="Creds — spent on abilities between jobs">
            ¢ {run.creds}
          </span>{' '}
          · Heat: {run.heat.length} · Abilities: {run.abilities.length}
        </div>
      </header>
      <h2>
        <GlitchTypewriter text="Pick the job." perWordMs={70} />
      </h2>
      <div className="target-grid">
        {node.targetChoices.map((t, i) => {
          const cardDelay = 150 + i * 100;
          return (
            <div
              key={t.id}
              className={`target-card stagger-item tier-${t.tier}`}
              style={staggerStyle(i, { step: 100, initial: 150 })}
            >
              <div className="target-header">
                <div className="target-name">
                  <span className="target-icon" aria-hidden>{t.icon}</span>
                  <GlitchTypewriter text={t.name} perWordMs={50} delayMs={cardDelay} />
                </div>
                <div className="target-tier">Tier {t.tier}</div>
              </div>
              {t.flavor && (
                <div className="target-flavor">
                  <GlitchTypewriter
                    text={t.flavor}
                    perWordMs={60}
                    delayMs={cardDelay + 80}
                  />
                </div>
              )}
              <div className="target-req">
                <GlitchTypewriter
                  text={`Requirement: ${describeRequirement(t.requirement)}`}
                  perWordMs={50}
                  delayMs={cardDelay + 160}
                />
              </div>
              <div className="target-reward" title="Creds awarded on success">
                Payout: <strong>¢ {t.credsReward}</strong>
              </div>
              <GlitchButton
                className="primary"
                onClick={() => selectTarget(t.id)}
                label="PLAN THIS JOB"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
