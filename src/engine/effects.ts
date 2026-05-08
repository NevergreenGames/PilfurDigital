import {
  AbilityUpgrade,
  CharacterAbility,
  Die,
  DieSize,
  EffectSpec,
  Requirement,
} from './types';
import { createDie, rollValue } from './dice';

export interface EffectContext {
  pool: Die[];
  heat: Die[];
  selectedDiceIds: string[];
  effectParams?: Record<string, unknown>;
}

export interface EffectResult {
  pool: Die[];
  heat: Die[];
  log: string[];
  // Pool die ids whose values were rerolled by this effect. Populated only
  // by the four reroll handlers (rerollHighest, rerollLowest, rerollAll,
  // rerollSelected). Drives the per-die shake animation in the UI so the
  // player sees the same jiggle they get on a fresh whole-pool roll.
  // Undefined for non-reroll handlers.
  rerolledIds?: string[];
}

type EffectHandler = (ctx: EffectContext, spec: EffectSpec) => EffectResult;

function byId(pool: Die[], ids: string[]): Die[] {
  const set = new Set(ids);
  return pool.filter((d) => set.has(d.id));
}

function without(pool: Die[], ids: string[]): Die[] {
  const set = new Set(ids);
  return pool.filter((d) => !set.has(d.id));
}

function rerollDice(dice: Die[]): Die[] {
  return dice.map((d) => ({ ...d, value: rollValue(d.size) }));
}

const handlers: Record<string, EffectHandler> = {
  rerollHighest: (ctx) => {
    // Only rolled dice are candidates — unrolled dice (value === null) have
    // no comparable value and must be skipped to avoid a crash when the pool
    // contains only just-gained momentum dice after a fulfillment.
    const rolledIdxs = ctx.pool
      .map((d, i) => (d.value !== null ? i : -1))
      .filter((i) => i !== -1);
    if (rolledIdxs.length === 0) {
      return { pool: ctx.pool, heat: ctx.heat, log: ['No rolled dice to reroll'] };
    }
    let bestIdx = rolledIdxs[0];
    for (const i of rolledIdxs) {
      if ((ctx.pool[i].value as number) > (ctx.pool[bestIdx].value as number)) bestIdx = i;
    }
    const target = ctx.pool[bestIdx];
    const rerolled = { ...target, value: rollValue(target.size) };
    const pool = ctx.pool.map((d, i) => (i === bestIdx ? rerolled : d));
    return {
      pool,
      heat: ctx.heat,
      log: [`Rerolled highest: ${target.value} → ${rerolled.value}`],
      rerolledIds: [target.id],
    };
  },

  rerollLowest: (ctx) => {
    const rolledIdxs = ctx.pool
      .map((d, i) => (d.value !== null ? i : -1))
      .filter((i) => i !== -1);
    if (rolledIdxs.length === 0) {
      return { pool: ctx.pool, heat: ctx.heat, log: ['No rolled dice to reroll'] };
    }
    let bestIdx = rolledIdxs[0];
    for (const i of rolledIdxs) {
      if ((ctx.pool[i].value as number) < (ctx.pool[bestIdx].value as number)) bestIdx = i;
    }
    const target = ctx.pool[bestIdx];
    const rerolled = { ...target, value: rollValue(target.size) };
    const pool = ctx.pool.map((d, i) => (i === bestIdx ? rerolled : d));
    return {
      pool,
      heat: ctx.heat,
      log: [`Rerolled lowest: ${target.value} → ${rerolled.value}`],
      rerolledIds: [target.id],
    };
  },

  rerollAll: (ctx) => {
    return {
      pool: rerollDice(ctx.pool),
      heat: ctx.heat,
      log: [`Rerolled all ${ctx.pool.length} dice`],
      rerolledIds: ctx.pool.map((d) => d.id),
    };
  },

  rerollSelected: (ctx) => {
    const selectedSet = new Set(ctx.selectedDiceIds);
    const pool = ctx.pool.map((d) => (selectedSet.has(d.id) ? { ...d, value: rollValue(d.size) } : d));
    return {
      pool,
      heat: ctx.heat,
      log: [`Rerolled ${ctx.selectedDiceIds.length} dice`],
      rerolledIds: ctx.pool.filter((d) => selectedSet.has(d.id)).map((d) => d.id),
    };
  },

  setDieToMax: (ctx) => {
    const [id] = ctx.selectedDiceIds;
    if (!id) return { pool: ctx.pool, heat: ctx.heat, log: [] };
    const pool = ctx.pool.map((d) => (d.id === id ? { ...d, value: d.size } : d));
    return { pool, heat: ctx.heat, log: ['Set a die to its max'] };
  },

  setDieToValue: (ctx, spec) => {
    const value = (spec.params?.value as number) ?? 1;
    const [id] = ctx.selectedDiceIds;
    if (!id) return { pool: ctx.pool, heat: ctx.heat, log: [] };
    const pool = ctx.pool.map((d) => (d.id === id ? { ...d, value } : d));
    return { pool, heat: ctx.heat, log: [`Set a die to ${value}`] };
  },

  setTwoDiceToOne: (ctx) => {
    const targets = ctx.selectedDiceIds.slice(0, 2);
    const set = new Set(targets);
    const pool = ctx.pool.map((d) => (set.has(d.id) ? { ...d, value: 1 } : d));
    return { pool, heat: ctx.heat, log: ['Set 2 dice to 1'] };
  },

  removeOnes: (ctx) => {
    // Character dice are no longer special — they're consumed like any
    // other die when removeOnes targets a 1.
    const pool: Die[] = ctx.pool.filter((d) => d.value !== 1);
    const removed = ctx.pool.length - pool.length;
    return { pool, heat: ctx.heat, log: [`Removed ${removed} dice showing 1`] };
  },

  addDice: (ctx, spec) => {
    const sizes = (spec.params?.sizes as DieSize[]) ?? [];
    const newDice = sizes.map((s) => {
      const d = createDie(s, 'phase');
      return { ...d, value: rollValue(s) };
    });
    return { pool: [...ctx.pool, ...newDice], heat: ctx.heat, log: [`Added ${sizes.length} dice`] };
  },

  removeHeat: (ctx, spec) => {
    const count = (spec.params?.count as number) ?? 1;
    const heat = ctx.heat.slice(0, Math.max(0, ctx.heat.length - count));
    return { pool: ctx.pool, heat, log: [`Removed ${count} heat`] };
  },

  duplicateDie: (ctx) => {
    const [id] = ctx.selectedDiceIds;
    const target = ctx.pool.find((d) => d.id === id);
    if (!target) return { pool: ctx.pool, heat: ctx.heat, log: [] };
    const copy = createDie(target.size, 'phase');
    const rolled = { ...copy, value: target.value };
    return { pool: [...ctx.pool, rolled], heat: ctx.heat, log: ['Duplicated a die'] };
  },
};

export function applyEffect(spec: EffectSpec, ctx: EffectContext): EffectResult {
  const handler = handlers[spec.id];
  if (!handler) return { pool: ctx.pool, heat: ctx.heat, log: [`Unknown effect: ${spec.id}`] };
  return handler(ctx, spec);
}

/**
 * Minimum number of pool dice an effect needs the player to have selected as
 * targets before it can be applied. 0 means the effect doesn't require any
 * target selection. The optional `bonus` is added on top of the base minimum
 * (used by the `extraTarget` upgrade, which lets a single-die effect target
 * multiple dice in one activation). When the base minimum is 0 the effect
 * truly takes no targets — the bonus is ignored, since adding "+1 target"
 * to e.g. `rerollAll` is meaningless.
 */
export function effectTargetMin(spec: EffectSpec, bonus = 0): number {
  let base: number;
  switch (spec.id) {
    case 'setDieToMax':
    case 'setDieToValue':
    case 'duplicateDie':
    case 'rerollSelected':
      base = 1;
      break;
    case 'setTwoDiceToOne':
      base = 2;
      break;
    default:
      base = 0;
  }
  if (base === 0) return 0;
  return base + Math.max(0, bonus);
}

// ───────────────────────────────────────────────────────────────────────────
// Ability-upgrade resolution
// ───────────────────────────────────────────────────────────────────────────
//
// Upgrades live on each owned ability's `upgrades[]` array. The base
// CharacterAbility data in content/* stays canonical; `effectiveAbility`
// returns a derived ability with maxCharges adjusted and trigger reduced.
// All gameplay code (charge cap, charge detection, UI display, target
// minimum) reads through this helper so upgrades apply transparently.

const MAX_CHARGE_CAP = 10;

/**
 * Reduce a Requirement by `by`, clamped at sane minimums per kind.
 * - xOfAKind: count -= by, min 2 (a "pair" is the floor).
 * - straight: length -= by, min 2 (two-in-a-row floor).
 * - evens / odds / maxes: count -= by, min 1.
 * - sum: value -= by, min 1 — the dice constraint (min/max/exactDice) is
 *   left untouched; this reduces the threshold, not the dice budget.
 */
export function applyRequirementReductions(
  req: Requirement,
  by: number,
): Requirement {
  if (by <= 0) return req;
  switch (req.kind) {
    case 'xOfAKind':
      return { ...req, count: Math.max(2, req.count - by) };
    case 'straight':
      return { ...req, length: Math.max(2, req.length - by) };
    case 'evens':
    case 'odds':
    case 'maxes':
      return { ...req, count: Math.max(1, req.count - by) };
    case 'sum':
      return { ...req, value: Math.max(1, req.value - by) };
  }
}

/**
 * Sum the `by` totals for a given upgrade kind. Used to fold multiple
 * upgrades of the same kind into a single net adjustment.
 */
function sumUpgradeBy(
  upgrades: AbilityUpgrade[],
  kind: 'increaseMaxCharges' | 'extraTarget' | 'reduceRequirement',
): number {
  let total = 0;
  for (const u of upgrades) {
    if (u.kind === kind) total += u.by;
  }
  return total;
}

/**
 * Returns true if any upgrade in the list matches the given marker kind.
 */
export function hasUpgrade(
  upgrades: AbilityUpgrade[] | undefined,
  kind: AbilityUpgrade['kind'],
): boolean {
  if (!upgrades) return false;
  return upgrades.some((u) => u.kind === kind);
}

/**
 * Single point of upgrade resolution. Returns a new CharacterAbility with:
 *   • `maxCharges` bumped by every increaseMaxCharges, capped at 10.
 *   • `trigger` reduced by every reduceRequirement upgrade (cumulative).
 * Other upgrades (`extraTarget`, `startWithCharge`) don't change the shape
 * of the ability — they're consumed at their respective use sites
 * (effectTargetMin and heist init).
 *
 * Upgrades remain on the returned ability so callers that need to inspect
 * markers (e.g. `hasUpgrade(eff.upgrades, 'startWithCharge')`) can do so.
 */
export function effectiveAbility(a: CharacterAbility): CharacterAbility {
  const upgrades = a.upgrades ?? [];
  const baseMax = a.maxCharges ?? 3;
  const bump = sumUpgradeBy(upgrades, 'increaseMaxCharges');
  const maxCharges = Math.min(MAX_CHARGE_CAP, Math.max(1, baseMax + bump));

  const reduceBy = sumUpgradeBy(upgrades, 'reduceRequirement');
  const trigger =
    reduceBy > 0 ? applyRequirementReductions(a.trigger, reduceBy) : a.trigger;

  return { ...a, maxCharges, trigger, upgrades };
}

/**
 * Like `effectiveAbility` but only the trigger — handy when the caller
 * just needs to inspect the upgrade-resolved trigger without rebuilding
 * the whole ability.
 */
export function effectiveTrigger(a: CharacterAbility): Requirement {
  const reduceBy = sumUpgradeBy(a.upgrades ?? [], 'reduceRequirement');
  if (reduceBy <= 0) return a.trigger;
  return applyRequirementReductions(a.trigger, reduceBy);
}

/**
 * Effective minimum target count for an ability, including any
 * extraTarget upgrades. Mirrors effectTargetMin but folds in the upgrade
 * bonus so the UI / activation code only needs the ability handle.
 */
export function abilityTargetMin(a: CharacterAbility): number {
  const bonus = sumUpgradeBy(a.upgrades ?? [], 'extraTarget');
  return effectTargetMin(a.effect, bonus);
}

export { byId, without, MAX_CHARGE_CAP };
