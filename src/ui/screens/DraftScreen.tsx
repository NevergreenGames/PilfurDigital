import { useGameStore } from '../../state/gameStore';
import { describeRequirement } from '../../engine/requirements';

export function DraftScreen() {
  const run = useGameStore((s) => s.run);
  const chooseDraft = useGameStore((s) => s.chooseDraft);
  const skipDraft = useGameStore((s) => s.skipDraft);
  if (!run?.draft) return null;

  return (
    <div className="screen draft">
      <header className="run-header">
        <div>
          <strong>{run.character.name}</strong> · d{run.characterDie}
        </div>
        <div>DRAFT</div>
        <div>Heat {run.heat.length} · Abilities {run.abilities.length}</div>
      </header>
      <h2>Pick a new ability</h2>
      <p className="hint">Each option adds a new activated ability to your loadout.</p>
      <div className="draft-row">
        {run.draft.map((opt, i) => (
          <div key={i} className="draft-option">
            <div className="ability-name">{opt.ability.name}</div>
            <div className="ability-trigger">Trigger: {describeRequirement(opt.ability.trigger)}</div>
            <div className="ability-text">{opt.ability.text}</div>
            <button className="primary" onClick={() => chooseDraft(i)}>
              TAKE
            </button>
          </div>
        ))}
      </div>
      <div className="action-bar">
        <button className="small" onClick={skipDraft}>
          skip
        </button>
      </div>
    </div>
  );
}
