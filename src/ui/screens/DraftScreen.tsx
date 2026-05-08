import { useGameStore } from '../../state/gameStore';
import { describeRequirement } from '../../engine/requirements';
import { applyRequirementReductions, effectiveAbility } from '../../engine/effects';
import { AbilityUpgrade, CharacterAbility, DraftOption } from '../../engine/types';
import { DieGlyph, withDieGlyphs } from '../components/DieGlyph';
import { GlitchButton } from '../components/GlitchButton';
import { GlitchTypewriter } from '../components/GlitchTypewriter';
import { staggerStyle } from '../transitions/transitionUtils';

// Player-readable description for an upgrade option, used as the body
// of the upgrade card. Pairs with the ability icon + name in the header.
function describeUpgrade(
  upgrade: AbilityUpgrade,
  ability: CharacterAbility,
): string {
  switch (upgrade.kind) {
    case 'increaseMaxCharges':
      return `+${upgrade.by} max charge${upgrade.by === 1 ? '' : 's'} (cap 10).`;
    case 'startWithCharge':
      return 'Starts each heist primed with 1 charge (when at 0).';
    case 'extraTarget':
      return `+${upgrade.by} extra target on activation.`;
    case 'reduceRequirement': {
      // Show the player exactly what the trigger collapses to so they
      // see the win — e.g. "4 of a kind → 3 of a kind".
      const before = describeRequirement(ability.trigger);
      const after = describeRequirement(
        applyRequirementReductions(ability.trigger, upgrade.by),
      );
      return `Easier trigger: ${after} (was ${before}).`;
    }
  }
}

function NewAbilityCard({
  option,
  index,
  affordable,
  onBuy,
  credsShort,
}: {
  option: Extract<DraftOption, { kind: 'newAbility' }>;
  index: number;
  affordable: boolean;
  onBuy: () => void;
  credsShort: number;
}) {
  const cost = option.ability.cost;
  const cardDelay = 120 + index * 80;
  return (
    <div
      className={`draft-option stagger-item ${affordable ? '' : 'draft-option--unaffordable'}`}
      style={staggerStyle(index, { step: 80, initial: 120 })}
    >
      <div className="ability-name">
        <span className="ability-icon" aria-hidden>
          {option.ability.icon}
        </span>
        <GlitchTypewriter
          text={option.ability.name}
          perWordMs={50}
          delayMs={cardDelay}
        />
      </div>
      <div className="ability-effect">{withDieGlyphs(option.ability.text)}</div>
      <div className="ability-trigger">
        <span className="ability-trigger-label">Charges on</span>{' '}
        {describeRequirement(option.ability.trigger)}
      </div>
      {option.ability.flavor && (
        <div className="ability-flavor">
          <GlitchTypewriter
            text={option.ability.flavor}
            perWordMs={60}
            delayMs={cardDelay + 120}
          />
        </div>
      )}
      <div
        className={`ability-cost ${affordable ? '' : 'ability-cost--unaffordable'}`}
      >
        ¢ {cost}
      </div>
      <GlitchButton
        className="primary"
        onClick={onBuy}
        disabled={!affordable}
        title={
          affordable ? `Spend ${cost} creds` : `Need ${credsShort} more creds`
        }
        label={affordable ? `BUY · ¢${cost}` : `NEED ¢${credsShort}`}
      />
    </div>
  );
}

function UpgradeCard({
  option,
  index,
  affordable,
  ability,
  onBuy,
  credsShort,
}: {
  option: Extract<DraftOption, { kind: 'upgrade' }>;
  index: number;
  affordable: boolean;
  ability: CharacterAbility | undefined;
  onBuy: () => void;
  credsShort: number;
}) {
  const cardDelay = 120 + index * 80;
  // If the player no longer owns the upgrade target (shouldn't happen
  // mid-draft, but defensive), render a graceful "missing" state.
  if (!ability) {
    return (
      <div
        className="draft-option draft-option--unaffordable stagger-item"
        style={staggerStyle(index, { step: 80, initial: 120 })}
      >
        <div className="ability-name">
          <span className="draft-pill" aria-hidden>
            UPGRADE
          </span>
        </div>
        <div className="ability-effect">Target ability is missing.</div>
      </div>
    );
  }
  // Display vs. effective trigger so the cap-at-10 / floor-clamps show
  // through where they apply.
  const eff = effectiveAbility(ability);
  return (
    <div
      className={`draft-option draft-option--upgrade stagger-item ${
        affordable ? '' : 'draft-option--unaffordable'
      }`}
      style={staggerStyle(index, { step: 80, initial: 120 })}
    >
      <div className="ability-name">
        <span className="draft-pill" aria-hidden>
          UPGRADE
        </span>
        <span className="ability-icon" aria-hidden>
          {ability.icon}
        </span>
        <GlitchTypewriter
          text={ability.name}
          perWordMs={50}
          delayMs={cardDelay}
        />
      </div>
      <div className="ability-effect">
        {withDieGlyphs(describeUpgrade(option.upgrade, ability))}
      </div>
      <div className="ability-trigger">
        <span className="ability-trigger-label">Currently charges on</span>{' '}
        {describeRequirement(eff.trigger)}
      </div>
      <div
        className={`ability-cost ${affordable ? '' : 'ability-cost--unaffordable'}`}
      >
        ¢ {option.cost}
      </div>
      <GlitchButton
        className="primary"
        onClick={onBuy}
        disabled={!affordable}
        title={
          affordable
            ? `Spend ${option.cost} creds`
            : `Need ${credsShort} more creds`
        }
        label={
          affordable ? `UPGRADE · ¢${option.cost}` : `NEED ¢${credsShort}`
        }
      />
    </div>
  );
}

export function DraftScreen() {
  const run = useGameStore((s) => s.run);
  const chooseDraft = useGameStore((s) => s.chooseDraft);
  const skipDraft = useGameStore((s) => s.skipDraft);
  if (!run?.draft) return null;

  return (
    <div className="screen draft">
      <header className="run-header">
        <div className="run-header-char">
          <strong>{run.character.name}</strong>
          <DieGlyph size={run.characterDie} px={22} />
        </div>
        <div>DRAFT</div>
        <div>
          <span className="creds-pill" title="Creds available to spend">
            ¢ {run.creds}
          </span>{' '}
          · Heat {run.heat.length} · Abilities {run.abilities.length}
        </div>
      </header>
      <h2>
        <GlitchTypewriter text="Pick a new ability" perWordMs={70} />
      </h2>
      <p className="hint">
        <GlitchTypewriter
          text="Each ability costs creds. You earned them on the last job — spend them here or save for a pricier option next time."
          perWordMs={50}
          delayMs={120}
        />
      </p>
      <div className="draft-row">
        {run.draft.map((opt, i) => {
          if (opt.kind === 'newAbility') {
            const cost = opt.ability.cost;
            const affordable = cost <= run.creds;
            return (
              <NewAbilityCard
                key={i}
                option={opt}
                index={i}
                affordable={affordable}
                onBuy={() => chooseDraft(i)}
                credsShort={Math.max(0, cost - run.creds)}
              />
            );
          }
          // Upgrade card.
          const affordable = opt.cost <= run.creds;
          const targetAbility = run.abilities.find(
            (a) => a.id === opt.abilityId,
          );
          return (
            <UpgradeCard
              key={i}
              option={opt}
              index={i}
              affordable={affordable}
              ability={targetAbility}
              onBuy={() => chooseDraft(i)}
              credsShort={Math.max(0, opt.cost - run.creds)}
            />
          );
        })}
      </div>
      <div className="action-bar">
        <button className="small" onClick={skipDraft}>
          skip · save creds
        </button>
      </div>
    </div>
  );
}
