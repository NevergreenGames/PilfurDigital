import { useGameStore } from '../../state/gameStore';
import { PhaseCardView } from '../components/PhaseCardView';

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
        <div>Heat {run.heat.length} · Stash {run.stash.length}</div>
      </header>
      <h2>Pick one swap</h2>
      <p className="hint">Each option replaces the paired card currently in your deck.</p>
      <div className="draft-row">
        {run.draft.map((opt, i) => {
          const oldCard = run.deck.find((c) => c.id === opt.pairedDeckCardId);
          return (
            <div key={i} className="draft-option">
              <div className="draft-new">
                <div className="draft-label">NEW</div>
                <PhaseCardView card={opt.newCard} />
              </div>
              <div className="draft-arrow">replaces ↓</div>
              <div className="draft-old">
                <div className="draft-label">OLD</div>
                {oldCard && <PhaseCardView card={oldCard} />}
              </div>
              <button className="primary" onClick={() => chooseDraft(i)}>
                SWAP
              </button>
            </div>
          );
        })}
      </div>
      <div className="action-bar">
        <button className="small" onClick={skipDraft}>
          skip
        </button>
      </div>
    </div>
  );
}
