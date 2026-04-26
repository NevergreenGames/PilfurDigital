import { CharacterAbility, Requirement } from '../../engine/types';
import { effectTargetMin } from '../../engine/effects';
import { withDieGlyphs } from './DieGlyph';

// Human-readable trigger description. Preferred over describeRequirement()
// from the engine (which is more terse) so the ability card reads as prose.
function triggerText(req: Requirement): string {
  switch (req.kind) {
    case 'sum': {
      const opWord: Record<string, string> = {
        lt: 'under',
        lte: 'at most',
        eq: 'exactly',
        gte: 'at least',
        gt: 'over',
      };
      const minDice =
        req.minDice && req.minDice > 1
          ? ` from ${req.minDice}+ dice`
          : req.minDice === 1
            ? ' (1 die)'
            : '';
      return `a sum ${opWord[req.op]} ${req.value}${minDice}`;
    }
    case 'xOfAKind': {
      const words: Record<number, string> = {
        2: 'a pair',
        3: 'three of a kind',
        4: 'four of a kind',
        5: 'five of a kind',
      };
      return words[req.count] ?? `${req.count} of a kind`;
    }
    case 'straight':
      return `a ${req.length}-straight`;
  }
}

interface Props {
  abilities: CharacterAbility[];
  charges: Record<string, number>;
  onActivate: (abilityId: string) => void;
  // The ability id currently waiting for the player to select target dice,
  // if any. The button on that ability is shown as a Cancel.
  waitingAbilityId?: string | null;
  // How many pool dice are currently selected — used to render the hint
  // ("Select N more dice...") on the waiting ability.
  selectedDiceCount?: number;
  disabled?: boolean;
}

export function AbilityListView({
  abilities,
  charges,
  onActivate,
  waitingAbilityId,
  selectedDiceCount = 0,
  disabled,
}: Props) {
  if (abilities.length === 0) {
    return <div className="muted" style={{ fontSize: 11 }}>No abilities.</div>;
  }
  return (
    <div>
      {abilities.map((a) => {
        const count = charges[a.id] ?? 0;
        const isWaiting = waitingAbilityId === a.id;
        const charged = count > 0;
        // While waiting, the button must always be clickable so the player
        // can cancel; otherwise normal charge-based gating applies.
        const canActivate = isWaiting || (!disabled && charged);
        const targetMin = effectTargetMin(a.effect);
        const targetsNeeded = Math.max(0, targetMin - selectedDiceCount);

        return (
          <div
            key={a.id}
            className={`hg-ability ${charged ? 'hg-ability--charged' : ''} ${
              isWaiting ? 'hg-ability--waiting' : ''
            }`}
          >
            <div className="hg-ability-header">
              <span className="hg-ability-name">{a.name}</span>
              <span
                className={`hg-ability-charges ${charged ? 'hg-ability-charges--on' : ''}`}
                title={`${count} charge${count === 1 ? '' : 's'}`}
              >
                {count > 0 ? `⚡${count}` : '—'}
              </span>
            </div>

            {/* PRIMARY: main effect */}
            <div className="hg-ability-effect">{withDieGlyphs(a.text)}</div>

            {/* SECONDARY: charge trigger */}
            <div className="hg-ability-trigger-row">
              <span className="hg-ability-trigger-label">Charges on</span>{' '}
              <span className="hg-ability-trigger">{triggerText(a.trigger)}</span>
            </div>

            {/* TERTIARY: flavor (if present) */}
            {a.flavor && (
              <div className="hg-ability-flavor">{a.flavor}</div>
            )}

            {isWaiting && (
              <div className="hg-ability-target-hint">
                Select {targetsNeeded} more die
                {targetsNeeded === 1 ? '' : 's'} from the pool…
              </div>
            )}

            <button
              onClick={() => onActivate(a.id)}
              disabled={!canActivate}
              className={
                isWaiting ? 'danger' : canActivate ? 'primary' : ''
              }
            >
              {isWaiting ? 'CANCEL' : canActivate ? 'ACTIVATE' : 'UNCHARGED'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
