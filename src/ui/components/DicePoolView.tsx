import { useEffect, useState } from 'react';
import { Die, DieSize } from '../../engine/types';
import { DieView } from './DieView';

interface Props {
  pool: Die[];
  selectedIds: string[];
  onToggle: (dieId: string) => void;
  disabled?: boolean;
  // Preview: which pool die ids will be consumed if the player fulfills the
  // currently hovered tile, and which dice the tile will add on success.
  previewConsumedIds?: Set<string>;
  previewGainedSizes?: DieSize[];
  // Increments each time the dice are rolled. The pool jiggles for ~700ms
  // each time this changes, so the player sees the cup shake and the dice
  // tumble inside it.
  rollNonce?: number;
  // Pool die ids the active charge event is "spotlighting" right now —
  // these dice were the subset that satisfied the popping ability's
  // trigger. The pool enlarges and glows them for the duration of the
  // event so the player sees which dice caused the charge.
  highlightedDieIds?: Set<string>;
  // Pool die ids the most-recent ability activation just transformed.
  // Plays a brief enlarge / glow / jiggle on each — the dice the player
  // can see have just changed react visibly so the cause-and-effect
  // (ability fires → these dice change) is unmistakable.
  impactedDieIds?: Set<string>;
  // Pool die ids the most-recent ability activation just rerolled (a
  // reroll-class effect like rerollHighest / rerollLowest / rerollAll /
  // rerollSelected). Plays the same shake the whole-pool roll plays —
  // composes with `impactedDieIds` on dice that are both targeted and
  // rerolled. Reroll uses translate/rotate; impact uses filter/scale —
  // the two animations don't fight.
  rerollingDieIds?: Set<string>;
}

export function DicePoolView({
  pool,
  selectedIds,
  onToggle,
  disabled,
  previewConsumedIds,
  previewGainedSizes,
  rollNonce,
  highlightedDieIds,
  impactedDieIds,
  rerollingDieIds,
}: Props) {
  const [jiggling, setJiggling] = useState(false);
  useEffect(() => {
    if (rollNonce === undefined) return;
    setJiggling(true);
    const t = window.setTimeout(() => setJiggling(false), 700);
    return () => window.clearTimeout(t);
  }, [rollNonce]);
  const selected = pool.filter((d) => selectedIds.includes(d.id));
  const selectedSum = selected.reduce((a, d) => a + (d.value ?? 0), 0);
  const rolledCount = pool.filter((d) => d.value !== null).length;

  const hasConsumePreview = !!previewConsumedIds && previewConsumedIds.size > 0;
  const hasGainPreview = !!previewGainedSizes && previewGainedSizes.length > 0;

  return (
    <div>
      <div
        className={`hg-dice-row ${pool.length === 0 ? 'hg-dice-row--empty' : ''} ${
          jiggling ? 'hg-dice-row--jiggling' : ''
        }`}
      >
        {pool.length === 0 && !hasGainPreview && <span>Pool empty — end turn</span>}
        {pool.map((die) => {
          const willConsume = previewConsumedIds?.has(die.id);
          const spotlight = highlightedDieIds?.has(die.id) ?? false;
          const impacted = impactedDieIds?.has(die.id) ?? false;
          const rerolling = rerollingDieIds?.has(die.id) ?? false;
          return (
            <DieView
              key={die.id}
              die={die}
              selected={selectedIds.includes(die.id)}
              onClick={disabled ? undefined : () => onToggle(die.id)}
              disabled={disabled}
              ghost={willConsume ? 'will-consume' : undefined}
              spotlight={spotlight}
              impacted={impacted}
              rerolling={rerolling}
            />
          );
        })}
        {/* Phantom gained dice, shown only while hovering a fulfillable tile. */}
        {hasGainPreview && (
          <>
            <span className="hg-dice-plus" aria-hidden>+</span>
            {previewGainedSizes!.map((size, i) => (
              <DieView
                key={`gain-${i}`}
                die={{
                  id: `gain-preview-${i}`,
                  size,
                  value: null,
                  source: 'phase',
                }}
                ghost="will-gain"
                disabled
              />
            ))}
          </>
        )}
      </div>
      <div className="hg-dice-summary">
        <span>
          {pool.length} dice · {rolledCount} rolled
        </span>
        {selected.length > 0 && (
          <span className="hg-dice-sum">
            selected {selected.length} · Σ = {selectedSum}
          </span>
        )}
        {hasConsumePreview && selected.length === 0 && (
          <span className="hg-dice-sum">
            will consume {previewConsumedIds!.size}
          </span>
        )}
      </div>
    </div>
  );
}
