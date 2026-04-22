import { useGameStore, TOTAL_NODES } from '../../state/gameStore';
import { describeRequirement } from '../../engine/requirements';

export function MapScreen() {
  const run = useGameStore((s) => s.run);
  const selectTarget = useGameStore((s) => s.selectTarget);
  if (!run) return null;
  const node = run.map[run.nodeIndex];
  const isFinal = run.nodeIndex === TOTAL_NODES - 1;
  return (
    <div className="screen map">
      <header className="run-header">
        <div>
          <strong>{run.character.name}</strong> · d{run.characterDie}
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
              Momentum: {t.momentumDice.map((s) => `d${s}`).join(', ')}
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
