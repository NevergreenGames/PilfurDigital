import { useEffect, useState } from 'react';
import {
  ActiveEvent,
  CharacterAbility,
  Die,
  EventChoice,
} from '../../engine/types';
import { GlitchButton } from './GlitchButton';
import { GlitchTypewriter } from './GlitchTypewriter';
import { DieGlyph } from './DieGlyph';
import { DicePoolView } from './DicePoolView';

interface Props {
  active: ActiveEvent;
  pool: Die[];
  // The current pool selection — sourced from gameStore.ui.selectedDiceIds.
  // The sidebar DicePoolView remains interactive (the modal's backdrop is
  // pointer-events: none) AND, for events that need dice, a duplicate
  // DicePoolView renders inside the modal so the player doesn't have to
  // hunt for the sidebar.
  selectedDiceIds: string[];
  abilities: CharacterAbility[];
  creds: number;
  onResolve: (
    choiceId: string,
    params?: { dieIds?: string[]; abilityId?: string },
  ) => void;
  onClose: () => void;
  // Toggle pool die selection — wired through to the gameStore action so
  // clicks inside the modal-internal DicePoolView mirror writes the same
  // selection state the sidebar reads from.
  onToggleDie: (dieId: string) => void;
}

// Per-choice viability: whether the player meets the choice's prerequisites
// right now (creds, dice, ability ownership). Used to disable the button
// when the player can't actually pick that branch.
function canCommit(
  choice: EventChoice,
  ctx: {
    pool: Die[];
    selectedDiceIds: string[];
    abilities: CharacterAbility[];
    selectedAbilityId: string | null;
    creds: number;
  },
): { ok: boolean; reason?: string } {
  const selected = ctx.pool.filter(
    (d) => ctx.selectedDiceIds.includes(d.id) && d.value !== null,
  );
  switch (choice.kind) {
    case 'walkAway':
      return { ok: true };
    case 'payCreds': {
      const cost = choice.creds ?? 0;
      if (ctx.creds < cost) return { ok: false, reason: `need ¢${cost}` };
      return { ok: true };
    }
    case 'payDie': {
      if (selected.length !== 1)
        return { ok: false, reason: `pick one d${choice.dieSize ?? '?'}` };
      const die = selected[0];
      if (choice.dieSize !== undefined && die.size !== choice.dieSize)
        return { ok: false, reason: `must be a d${choice.dieSize}` };
      return { ok: true };
    }
    case 'payAbility': {
      if (ctx.abilities.length === 0)
        return { ok: false, reason: 'no abilities to trade' };
      if (!ctx.selectedAbilityId)
        return { ok: false, reason: 'pick an ability to sacrifice' };
      return { ok: true };
    }
    case 'opposeRoll': {
      if (selected.length === 0)
        return { ok: false, reason: 'select dice from pool' };
      return { ok: true };
    }
    case 'thresholdRoll': {
      if (selected.length !== 1)
        return { ok: false, reason: 'pick one rolled die' };
      const die = selected[0];
      const threshold = choice.threshold ?? 0;
      if ((die.value ?? 0) < threshold)
        return { ok: false, reason: `need ≥ ${threshold}` };
      return { ok: true };
    }
    case 'upgradeAbility': {
      const cost = choice.creds ?? 0;
      if (ctx.creds < cost) return { ok: false, reason: `need ¢${cost}` };
      if (ctx.abilities.length === 0)
        return { ok: false, reason: 'no abilities to upgrade' };
      if (!ctx.selectedAbilityId)
        return { ok: false, reason: 'pick an ability to upgrade' };
      return { ok: true };
    }
    default:
      return { ok: false };
  }
}

export function EventModal({
  active,
  pool,
  selectedDiceIds,
  abilities,
  creds,
  onResolve,
  onClose,
  onToggleDie,
}: Props) {
  const [revealedDone, setRevealedDone] = useState(false);
  const [selectedAbilityId, setSelectedAbilityId] = useState<string | null>(
    null,
  );

  // ESC dismisses the modal (same as Walk Away — but that requires a choice
  // id, so just close instead and leave the tile intact).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Reset state when a different event opens. Keyed on def.id since the
  // same modal component can host successive events in a single heist.
  useEffect(() => {
    setRevealedDone(false);
    setSelectedAbilityId(null);
  }, [active.def.id]);

  const ctx = { pool, selectedDiceIds, abilities, selectedAbilityId, creds };

  const handleChoose = (choice: EventChoice) => {
    const v = canCommit(choice, ctx);
    if (!v.ok) return;
    if (choice.kind === 'walkAway') {
      onResolve(choice.id);
      return;
    }
    if (choice.kind === 'payCreds') {
      onResolve(choice.id);
      return;
    }
    if (choice.kind === 'payAbility' || choice.kind === 'upgradeAbility') {
      onResolve(choice.id, { abilityId: selectedAbilityId ?? undefined });
      return;
    }
    onResolve(choice.id, { dieIds: [...selectedDiceIds] });
  };

  // Convenience: friendly description of the requirement next to the
  // pool-selection prompt, so the player knows exactly what to click.
  const promptForChoice = (c: EventChoice): string | null => {
    switch (c.kind) {
      case 'payDie':
        return `Tap a d${c.dieSize ?? '?'} in your pool.`;
      case 'opposeRoll':
        return 'Tap pool dice to roll against the lock.';
      case 'thresholdRoll':
        return `Tap a pool die showing ${c.threshold ?? 0} or more.`;
      case 'payAbility':
        return 'Pick an ability to sacrifice — you lose it for the rest of the run.';
      case 'upgradeAbility':
        return 'Pick an ability to upgrade.';
      default:
        return null;
    }
  };

  // Selected pool dice — used to surface the running sum on opposeRoll
  // choices so the player can see what they're committing.
  const selectedDice = pool.filter((d) => selectedDiceIds.includes(d.id));
  const playerSum = selectedDice.reduce(
    (acc, d) => acc + (d.value ?? 0),
    0,
  );

  // Show the inline pool mirror whenever the active event offers any
  // choice that consumes / inspects dice. payCreds / payAbility / walkAway
  // don't need it.
  const needsDiceSelection = active.def.choices.some(
    (c) =>
      c.kind === 'payDie' ||
      c.kind === 'opposeRoll' ||
      c.kind === 'thresholdRoll',
  );

  return (
    <div className="event-overlay" role="dialog" aria-modal="true">
      <div className="event-modal">
        <header className="event-modal-head">
          <span className="event-modal-tag">// EVENT //</span>
          <h2 className="event-modal-title">
            <GlitchTypewriter text={active.def.title} perWordMs={70} />
          </h2>
          <button
            type="button"
            className="event-modal-close"
            onClick={onClose}
            aria-label="Close event"
          >
            ✕
          </button>
        </header>

        <p className="event-modal-flavor">
          <GlitchTypewriter
            text={active.def.flavor}
            perWordMs={90}
            onDone={() => setRevealedDone(true)}
          />
        </p>

        <ul className="event-choice-list">
          {active.def.choices.map((choice) => {
            const v = canCommit(choice, ctx);
            const opposing = active.opposingRolls?.[choice.id];
            const oppSum = opposing
              ? opposing.reduce((acc, n) => acc + n, 0)
              : 0;
            const prompt = promptForChoice(choice);
            // Hide payAbility / upgradeAbility entirely if the player has
            // nothing to trade or upgrade — there's no point offering an
            // unselectable option.
            if (
              (choice.kind === 'payAbility' ||
                choice.kind === 'upgradeAbility') &&
              abilities.length === 0
            ) {
              return null;
            }
            return (
              <li
                key={choice.id}
                className={`event-choice${v.ok ? '' : ' event-choice--blocked'}`}
              >
                <div className="event-choice-row">
                  <GlitchButton
                    type="button"
                    className="event-choice-btn"
                    onClick={() => handleChoose(choice)}
                    disabled={!revealedDone || !v.ok}
                    label={choice.label}
                  >
                    <span className="event-choice-chips">
                      {choice.costLabel && (
                        <span className="event-chip event-chip--cost">
                          {choice.costLabel}
                        </span>
                      )}
                      {choice.rewardLabel && (
                        <span className="event-chip event-chip--reward">
                          → {choice.rewardLabel}
                        </span>
                      )}
                    </span>
                  </GlitchButton>
                  {!v.ok && v.reason && (
                    <span className="event-choice-reason">{v.reason}</span>
                  )}
                </div>

                {/* Inline hints + interactive widgets per choice kind. */}
                {revealedDone && choice.kind === 'opposeRoll' && opposing && (
                  <div className="event-choice-roll">
                    <span className="event-roll-label">THEIR LOCK</span>
                    <span className="event-roll-dice">
                      {opposing.map((v, i) => (
                        <span key={i} className="event-roll-die">
                          <DieGlyph
                            size={choice.opposingDice?.[i] ?? 6}
                            px={28}
                          />
                          <span className="event-roll-value">{v}</span>
                        </span>
                      ))}
                    </span>
                    <span className="event-roll-sum">Σ = {oppSum}</span>
                    <span className="event-roll-divider">vs</span>
                    <span className="event-roll-label">YOUR PICK</span>
                    <span className="event-roll-sum">Σ = {playerSum}</span>
                  </div>
                )}

                {revealedDone &&
                  (choice.kind === 'payAbility' ||
                    choice.kind === 'upgradeAbility') && (
                    <div className="event-ability-picker">
                      {abilities.length === 0 ? (
                        <span className="event-ability-empty">
                          {choice.kind === 'payAbility'
                            ? 'Nothing to trade.'
                            : 'Nothing to upgrade.'}
                        </span>
                      ) : (
                        abilities.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            className={`event-ability-pick${
                              selectedAbilityId === a.id
                                ? ' event-ability-pick--on'
                                : ''
                            }`}
                            onClick={() =>
                              setSelectedAbilityId((cur) =>
                                cur === a.id ? null : a.id,
                              )
                            }
                            title={a.text}
                          >
                            <span className="event-ability-icon" aria-hidden>
                              {a.icon}
                            </span>
                            <span className="event-ability-name">{a.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                {revealedDone &&
                  prompt &&
                  choice.kind !== 'payAbility' &&
                  choice.kind !== 'upgradeAbility' && (
                    <div className="event-choice-hint">{prompt}</div>
                  )}
              </li>
            );
          })}
        </ul>

        {/* Inline pool mirror — only rendered when at least one choice
            consumes pool dice. The selection state is shared with the
            sidebar's DicePoolView (both read selectedDiceIds and call
            the same onToggleDie action), so clicks here are
            interchangeable with the sidebar — the goal is just to put
            the dice next to the prompt so the player doesn't have to
            hunt for them. */}
        {needsDiceSelection && revealedDone && (
          <div className="event-modal-pool">
            <div className="event-modal-pool-label">YOUR POOL</div>
            <DicePoolView
              pool={pool}
              selectedIds={selectedDiceIds}
              onToggle={onToggleDie}
            />
          </div>
        )}
      </div>
    </div>
  );
}
