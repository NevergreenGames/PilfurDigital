import { Die, DieSize, EffectSpec } from './types';
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
    return { pool, heat: ctx.heat, log: [`Rerolled highest: ${target.value} → ${rerolled.value}`] };
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
    return { pool, heat: ctx.heat, log: [`Rerolled lowest: ${target.value} → ${rerolled.value}`] };
  },

  rerollAll: (ctx) => {
    return { pool: rerollDice(ctx.pool), heat: ctx.heat, log: [`Rerolled all ${ctx.pool.length} dice`] };
  },

  rerollSelected: (ctx) => {
    const selectedSet = new Set(ctx.selectedDiceIds);
    const pool = ctx.pool.map((d) => (selectedSet.has(d.id) ? { ...d, value: rollValue(d.size) } : d));
    return { pool, heat: ctx.heat, log: [`Rerolled ${ctx.selectedDiceIds.length} dice`] };
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
    const pool = ctx.pool.filter((d) => d.value !== 1);
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

export { byId, without };
