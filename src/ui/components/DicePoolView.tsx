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
}

export function DicePoolView({
  pool,
  selectedIds,
  onToggle,
  disabled,
  previewConsumedIds,
  previewGainedSizes,
}: Props) {
  const selected = pool.filter((d) => selectedIds.includes(d.id));
  const selectedSum = selected.reduce((a, d) => a + (d.value ?? 0), 0);
  const rolledCount = pool.filter((d) => d.value !== null).length;

  const hasConsumePreview = !!previewConsumedIds && previewConsumedIds.size > 0;
  const hasGainPreview = !!previewGainedSizes && previewGainedSizes.length > 0;

  return (
    <div>
      <div className={`hg-dice-row ${pool.length === 0 ? 'hg-dice-row--empty' : ''}`}>
        {pool.length === 0 && !hasGainPreview && <span>Pool empty — end turn</span>}
        {pool.map((die) => {
          const willConsume = previewConsumedIds?.has(die.id);
          return (
            <DieView
              key={die.id}
              die={die}
              selected={selectedIds.includes(die.id)}
              onClick={disabled ? undefined : () => onToggle(die.id)}
              disabled={disabled}
              ghost={willConsume ? 'will-consume' : undefined}
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
