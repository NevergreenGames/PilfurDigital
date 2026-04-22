import { useGameStore } from '../../state/gameStore';
import { PhaseCardView } from '../components/PhaseCardView';

export function HeistPlanningScreen() {
  const run = useGameStore((s) => s.run);
  const planCard = useGameStore((s) => s.planCard);
  const unplanCard = useGameStore((s) => s.unplanCard);
  const endPlanning = useGameStore((s) => s.endPlanning);
  if (!run?.heist) return null;
  const { heist } = run;
  return (
    <div className="screen planning">
      <header className="run-header">
        <div>
          <strong>{run.character.name}</strong> · d{run.characterDie}
        </div>
        <div>PLANNING: {heist.target.name}</div>
        <div>Heat {run.heat.length} · Stash {run.stash.length}</div>
      </header>
      <h2>Plan the heist</h2>
      <p className="hint">
        Play cards in the order you want them resolved. Cards left in hand become escape complications.
      </p>

      <section>
        <h3>Plan ({heist.planned.length} phases, then target)</h3>
        <div className="card-row">
          {heist.planned.map((slot, i) => (
            <div key={slot.slotId} className="plan-slot">
              <div className="plan-order">#{i + 1}</div>
              <PhaseCardView card={slot.card} onClick={() => unplanCard(slot.slotId)} />
            </div>
          ))}
          <div className="plan-slot target">
            <div className="plan-order">★</div>
            <PhaseCardView card={heist.targetSlot.card} />
          </div>
        </div>
      </section>

      <section>
        <h3>Hand ({heist.hand.length})</h3>
        <div className="card-row">
          {heist.hand.map((c) => (
            <PhaseCardView key={c.id} card={c} onClick={() => planCard(c.id)} />
          ))}
          {heist.hand.length === 0 && <div className="muted">Nothing left in hand.</div>}
        </div>
      </section>

      <div className="action-bar">
        <button className="primary" onClick={endPlanning}>
          THEN I STEAL THE {heist.target.name}
        </button>
      </div>
    </div>
  );
}
