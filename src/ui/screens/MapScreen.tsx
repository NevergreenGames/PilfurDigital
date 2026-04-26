import { useGameStore, TOTAL_NODES } from '../../state/gameStore';
import { describeRequirement } from '../../engine/requirements';
import { DieGlyph } from '../components/DieGlyph';

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
          Heat: {run.heat.length} · Abilities: {run.abilities.length}
        </div>
      </header>
      <h2>Pick the job.</h2>
      <div className="target-grid">
        {node.targetChoices.map((t) => (
          <div key={t.id} className={`target-card tier-${t.tier}`}>
            <div className="target-header">
              <div className="target-name">{t.name}</div>
              <div className="target-tier">Tier {t.tier}</div>
            </div>
            {t.flavor && <div className="target-flavor">{t.flavor}</div>}
            <div className="target-req">Requirement: {describeRequirement(t.requirement)}</div>
            <div className="target-dice">
              {t.momentumDice.map((s, i) => (
                <DieGlyph key={i} size={s} px={24} />
              ))}
            </div>
            <button className="primary" onClick={() => selectTarget(t.id)}>
              PLAN THIS JOB
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
