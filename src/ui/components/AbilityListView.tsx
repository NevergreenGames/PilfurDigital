import { CharacterAbility, Requirement } from '../../engine/types';
import { abilityTargetMin, effectiveAbility } from '../../engine/effects';
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
      // Same precedence as describeRequirement: exactDice → min+max →
      // min only → max only.
      let countClause = '';
      if (req.exactDice !== undefined) {
        countClause = ` from exactly ${req.exactDice} dice`;
      } else if (req.minDice !== undefined && req.maxDice !== undefined) {
        countClause = ` from ${req.minDice}-${req.maxDice} dice`;
      } else if (req.minDice && req.minDice > 1) {
        countClause = ` from ${req.minDice}+ dice`;
      } else if (req.minDice === 1) {
        countClause = ' (1 die)';
      } else if (req.maxDice !== undefined) {
        countClause = ` from up to ${req.maxDice} dice`;
      }
      return `a sum ${opWord[req.op]} ${req.value}${countClause}`;
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
    case 'evens':
      return req.count === 1 ? 'an even die' : `${req.count} even dice`;
    case 'odds':
      return req.count === 1 ? 'an odd die' : `${req.count} odd dice`;
    case 'maxes':
      return req.count === 1
        ? 'a die showing its max'
        : `${req.count} dice showing their max`;
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
  // The ability id currently being spotlighted by a charge event. Only
  // this ability plays its pop animation; the others stay still even if
  // their counts also went up on the same roll. Events are queued by
  // HeistScreen so each ability gets its own moment in the spotlight.
  poppingAbilityId?: string | null;
}

export function AbilityListView({
  abilities,
  charges,
  onActivate,
  waitingAbilityId,
  selectedDiceCount = 0,
  disabled,
  poppingAbilityId,
}: Props) {
  if (abilities.length === 0) {
    return <div className="muted" style={{ fontSize: 11 }}>No abilities.</div>;
  }
  return (
    <div>
      {abilities.map((a) => (
        <AbilityRow
          key={a.id}
          ability={a}
          count={charges[a.id] ?? 0}
          onActivate={onActivate}
          isWaiting={waitingAbilityId === a.id}
          selectedDiceCount={selectedDiceCount}
          disabled={disabled}
          popping={poppingAbilityId === a.id}
        />
      ))}
    </div>
  );
}

interface RowProps {
  ability: CharacterAbility;
  count: number;
  onActivate: (abilityId: string) => void;
  isWaiting: boolean;
  selectedDiceCount: number;
  disabled?: boolean;
  // Driven externally by HeistScreen's charge-event queue: true while
  // this row is the current spotlight. A short pop animation plays for
  // ~700ms each time it flips true.
  popping: boolean;
}

function AbilityRow({
  ability: rawA,
  count,
  onActivate,
  isWaiting,
  selectedDiceCount,
  disabled,
  popping,
}: RowProps) {
  // Resolve any owned upgrades — caps maxCharges, reduces the trigger.
  // The base data stays untouched in run.abilities; this is just the
  // display overlay.
  const a = effectiveAbility(rawA);

  const charged = count > 0;
  const canActivate = isWaiting || (!disabled && charged);
  const targetMin = abilityTargetMin(rawA);
  const targetsNeeded = Math.max(0, targetMin - selectedDiceCount);
  const maxCharges = a.maxCharges;

  return (
    <div
      className={`hg-ability ${charged ? 'hg-ability--charged' : ''} ${
        isWaiting ? 'hg-ability--waiting' : ''
      } ${popping ? 'hg-ability--popping' : ''}`}
    >
      <div className="hg-ability-header">
        <span className="hg-ability-name">
          <span className="hg-ability-icon" aria-hidden>{a.icon}</span>
          {a.name}
        </span>
        <span
          className={`hg-ability-charges ${charged ? 'hg-ability-charges--on' : ''} ${
            popping ? 'hg-ability-charges--popping' : ''
          }`}
          title={`${count} / ${maxCharges} charge${maxCharges === 1 ? '' : 's'}`}
        >
          {`⚡${count}/${maxCharges}`}
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
      {a.flavor && <div className="hg-ability-flavor">{a.flavor}</div>}

      {isWaiting && (
        <div className="hg-ability-target-hint">
          Select {targetsNeeded} more die
          {targetsNeeded === 1 ? '' : 's'} from the pool…
        </div>
      )}

      <button
        onClick={() => onActivate(a.id)}
        disabled={!canActivate}
        className={isWaiting ? 'danger' : canActivate ? 'primary' : ''}
      >
        {isWaiting ? 'CANCEL' : canActivate ? 'ACTIVATE' : 'UNCHARGED'}
      </button>

      {/* Sparkle burst — only rendered while popping. Three CSS-positioned
          sparkles fly outward from the charge badge as a celebratory cue. */}
      {popping && (
        <div className="hg-ability-sparkles" aria-hidden>
          <span className="hg-ability-sparkle hg-ability-sparkle--1">⚡</span>
          <span className="hg-ability-sparkle hg-ability-sparkle--2">✨</span>
          <span className="hg-ability-sparkle hg-ability-sparkle--3">⚡</span>
        </div>
      )}
    </div>
  );
}
