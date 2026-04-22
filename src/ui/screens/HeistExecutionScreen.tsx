import { useGameStore, getActiveSlot } from '../../state/gameStore';
import { PhaseCardView } from '../components/PhaseCardView';
import { DieView } from '../components/DieView';
import { describeRequirement, isSubsetSatisfying } from '../../engine/requirements';
import { PhaseSlot } from '../../engine/types';

export function HeistExecutionScreen() {
  const run = useGameStore((s) => s.run);
  const ui = useGameStore((s) => s.ui);
  const rollActivePhase = useGameStore((s) => s.rollActivePhase);
  const toggleDieSelection = useGameStore((s) => s.toggleDieSelection);
  const clearSelection = useGameStore((s) => s.clearSelection);
  const assignSelectedToSlot = useGameStore((s) => s.assignSelectedToSlot);
  const activateAbility = useGameStore((s) => s.activateAbility);
  const declareTotalBust = useGameStore((s) => s.declareTotalBust);
  const advancePhase = useGameStore((s) => s.advancePhase);
  const selectFlashbackHandCard = useGameStore((s) => s.selectFlashbackHandCard);
  const playFlashback = useGameStore((s) => s.playFlashback);
  const finishFlashbackPhase = useGameStore((s) => s.finishFlashbackPhase);

  if (!run?.heist) return null;
  const heist = run.heist;
  const active = getActiveSlot(run);
  if (!active) return null;
  const ability = run.character.ability;
  const selectedDice = heist.pool.filter((d) => ui.selectedDiceIds.includes(d.id));
  const inFlashback = heist.needsFlashbackResolution;

  const allSlots: PhaseSlot[] = [...heist.planned, heist.targetSlot];
  const failedSlots = allSlots.filter((s) => s.status === 'failed');

  const activeDone = active.status === 'fulfilled' || active.status === 'flashbacked';
  const canActivateAbility = !inFlashback && isSubsetSatisfying(selectedDice, ability.trigger);
  const canFulfillActive = !inFlashback && !activeDone && isSubsetSatisfying(selectedDice, active.card.requirement);

  const flashbackCard = ui.selectedFlashbackCardId
    ? heist.hand.find((c) => c.id === ui.selectedFlashbackCardId)
    : null;

  const handleSlotClick = (slot: PhaseSlot) => {
    if (inFlashback) {
      if (slot.status === 'failed') playFlashback(slot.slotId);
    } else {
      assignSelectedToSlot(slot.slotId);
    }
  };

  return (
    <div className="screen execution">
      <header className="run-header">
        <div>
          <strong>{run.character.name}</strong> · d{run.characterDie}
        </div>
        <div>
          EXECUTING: {heist.target.name}
          {inFlashback && <span className="flashback-pill"> ⏪ FLASHBACK</span>}
        </div>
        <div>Heat {run.heat.length} · Stash {run.stash.length}</div>
      </header>

      <section className="plan-row">
        {heist.planned.map((slot) => (
          <PhaseCardView
            key={slot.slotId}
            card={slot.card}
            slot={slot}
            highlighted={slot.slotId === active.slotId || (inFlashback && slot.status === 'failed')}
            compact
            onClick={() => handleSlotClick(slot)}
          />
        ))}
        <PhaseCardView
          card={heist.targetSlot.card}
          slot={heist.targetSlot}
          highlighted={
            heist.targetSlot.slotId === active.slotId ||
            (inFlashback && heist.targetSlot.status === 'failed')
          }
          compact
          onClick={() => handleSlotClick(heist.targetSlot)}
        />
      </section>

      {inFlashback ? (
        <section className="active-panel">
          <h2>⏪ Flashback opportunity</h2>
          <p className="hint">
            Play a card from your hand onto any failed phase. If the dice you select satisfy the
            new card's requirement, it covers the failed phase and its momentum dice go to your
            private stash. Unused dice become heat when you continue.
          </p>

          <div className="flashback-hand">
            <h3>Hand — pick a flashback card</h3>
            <div className="card-row">
              {heist.hand.length === 0 && <div className="muted">Hand empty.</div>}
              {heist.hand.map((c) => (
                <div
                  key={c.id}
                  className={`flashback-hand-slot ${ui.selectedFlashbackCardId === c.id ? 'selected' : ''}`}
                  onClick={() =>
                    selectFlashbackHandCard(ui.selectedFlashbackCardId === c.id ? null : c.id)
                  }
                >
                  <PhaseCardView card={c} />
                </div>
              ))}
            </div>
            {flashbackCard && (
              <div className="flashback-prompt">
                Selected: <strong>{flashbackCard.name}</strong> · needs{' '}
                {describeRequirement(flashbackCard.requirement)} — pick dice, then click a failed
                phase above.
              </div>
            )}
          </div>

          <div className="pool-label">
            Pool ({heist.pool.length})
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
            {heist.pool.length === 0 && <div className="muted">Pool is empty.</div>}
          </div>

          {ui.message && <div className="error">{ui.message}</div>}

          <div className="action-bar">
            <div className="muted">
              {failedSlots.length} failed phase(s){' '}
              {flashbackCard && '→ click one above to attempt flashback.'}
            </div>
            <button className="primary" onClick={finishFlashbackPhase}>
              CONTINUE (unused → heat)
            </button>
          </div>
        </section>
      ) : (
        <section className="active-panel">
          <h2>Active: {active.card.name}</h2>
          <div>Need: {describeRequirement(active.card.requirement)}</div>
          {active.card.onPlayEffect && <div>On play: {active.card.onPlayEffect.text}</div>}

          {!heist.hasRolled ? (
            <button className="primary big" onClick={rollActivePhase}>
              ROLL — add {active.card.momentumDice.map((s) => `d${s}`).join(' ')} + d
              {run.characterDie}
            </button>
          ) : (
            <>
              <div className="pool-label">
                Pool ({heist.pool.length}) — click dice to select
                {selectedDice.length > 0 && (
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
                {heist.pool.length === 0 && <div className="muted">Pool is empty.</div>}
              </div>

              {ui.message && <div className="error">{ui.message}</div>}

              <div className="action-bar">
                <button
                  disabled={!canFulfillActive}
                  onClick={() => assignSelectedToSlot(active.slotId)}
                >
                  PLACE ON {active.card.name} ({selectedDice.length})
                </button>
                <button disabled={!canActivateAbility} onClick={activateAbility} title={ability.text}>
                  ⚡ {ability.name}
                </button>
                {activeDone ? (
                  <button className="primary" onClick={advancePhase}>
                    ADVANCE →
                  </button>
                ) : (
                  <button className="danger" onClick={declareTotalBust}>
                    💥 TOTAL BUST
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      )}

      <section className="log">
        <h3>Log</h3>
        <ul>
          {heist.log.slice(-12).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
