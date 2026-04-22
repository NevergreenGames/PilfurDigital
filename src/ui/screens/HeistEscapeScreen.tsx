import { useGameStore } from '../../state/gameStore';
import { PhaseCardView } from '../components/PhaseCardView';
import { DieView } from '../components/DieView';
import { describeRequirement } from '../../engine/requirements';

export function HeistEscapeScreen() {
  const run = useGameStore((s) => s.run);
  const ui = useGameStore((s) => s.ui);
  const rollEscape = useGameStore((s) => s.rollEscape);
  const toggleDieSelection = useGameStore((s) => s.toggleDieSelection);
  const clearSelection = useGameStore((s) => s.clearSelection);
  const assignEscapeSelectedToSlot = useGameStore((s) => s.assignEscapeSelectedToSlot);
  const rollHeat = useGameStore((s) => s.rollHeat);
  const finalizeEscape = useGameStore((s) => s.finalizeEscape);

  if (!run?.heist) return null;
  const heist = run.heist;
  const rolled = heist.hasRolledEscape;
  const heatResolved = heist.heatCatches !== null;
  const caught = heatResolved && Object.keys(heist.heatCatches ?? {}).length > 0;
  const unresolvedCount = heist.escapeComplications.filter((s) => s.status !== 'fulfilled').length;

  return (
    <div className="screen escape">
      <header className="run-header">
        <div>
          <strong>{run.character.name}</strong> · d{run.characterDie}
        </div>
        <div>ESCAPE</div>
        <div>Heat {run.heat.length}</div>
      </header>

      <section>
        <h2>Complications</h2>
        {!heatResolved && (
          <p className="hint">
            These are the phase cards you didn't play. Use your stash dice to cover them before the heat rolls.
          </p>
        )}
        <div className="card-row">
          {heist.escapeComplications.map((slot) => {
            const catchIds = heist.heatCatches?.[slot.slotId];
            const isCaught = !!catchIds && catchIds.length > 0;
            return (
              <div key={slot.slotId} className={`escape-slot ${isCaught ? 'caught' : ''}`}>
                <PhaseCardView
                  card={slot.card}
                  slot={slot}
                  onClick={!heatResolved ? () => assignEscapeSelectedToSlot(slot.slotId) : undefined}
                />
                {isCaught && (
                  <div className="caught-panel">
                    <div className="caught-label">🚨 CAUGHT BY</div>
                    <div className="caught-dice">
                      {catchIds.map((id) => {
                        const d = run.heat.find((h) => h.id === id);
                        if (!d) return null;
                        return <DieView key={id} die={d} disabled />;
                      })}
                    </div>
                    <div className="caught-req">needed {describeRequirement(slot.card.requirement)}</div>
                  </div>
                )}
              </div>
            );
          })}
          {heist.escapeComplications.length === 0 && (
            <div className="muted">No complications. Clean getaway.</div>
          )}
        </div>
      </section>

      {!heatResolved ? (
        <section className="active-panel">
          {!rolled ? (
            <button className="primary big" onClick={rollEscape}>
              ROLL {run.stash.length} ESCAPE DICE
            </button>
          ) : (
            <>
              <div className="pool-label">
                Stash pool ({heist.pool.length})
                {ui.selectedDiceIds.length > 0 && (
                  <button className="small" onClick={clearSelection}>
                    clear
                  </button>
                )}
              </div>
              <div className="dice-row">
                {heist.pool.map((d) => (
                  <DieView
                    key={d.id}
                    die={d}
                    selected={ui.selectedDiceIds.includes(d.id)}
                    onClick={() => toggleDieSelection(d.id)}
                  />
                ))}
                {heist.pool.length === 0 && <div className="muted">No stash dice left.</div>}
              </div>
              {ui.message && <div className="error">{ui.message}</div>}

              <div className="action-bar">
                <button className="danger primary" onClick={rollHeat}>
                  {unresolvedCount > 0
                    ? `ROLL THE HEAT (${run.heat.length})`
                    : 'FINISH ESCAPE'}
                </button>
              </div>
            </>
          )}
        </section>
      ) : (
        <section className="active-panel heat-resolution">
          <h2>
            {caught ? '🚨 Heat roll' : '✓ Heat roll'}
          </h2>
          <div className="pool-label">
            The heat rolls {run.heat.length} d6{run.heat.length === 1 ? '' : 's'}:
          </div>
          <div className="dice-row">
            {run.heat.map((d) => {
              const wasCatch = Object.values(heist.heatCatches ?? {}).some((ids) =>
                ids.includes(d.id),
              );
              return (
                <DieView
                  key={d.id}
                  die={d}
                  selected={wasCatch}
                  disabled
                />
              );
            })}
            {run.heat.length === 0 && <div className="muted">No heat — you left nothing behind.</div>}
          </div>

          <div className="heat-verdict">
            {caught ? (
              <div className="error">
                The heat matched {Object.keys(heist.heatCatches ?? {}).length} of your unresolved
                complication{Object.keys(heist.heatCatches ?? {}).length === 1 ? '' : 's'}. See
                above for the catches.
              </div>
            ) : (
              <div className="muted">
                No unresolved complication matched the heat. You slip away.
              </div>
            )}
          </div>

          <div className="action-bar">
            <button className="primary big" onClick={finalizeEscape}>
              {caught ? 'ACCEPT YOUR FATE →' : 'CONTINUE →'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
