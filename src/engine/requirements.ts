import { Die, Requirement, RequirementOp } from './types';

export function describeRequirement(req: Requirement): string {
  switch (req.kind) {
    case 'sum': {
      const opText: Record<RequirementOp, string> = {
        lt: '<',
        lte: '≤',
        eq: '=',
        gte: '≥',
        gt: '>',
      };
      // exactDice wins; otherwise min/max combine into a "between" range
      // when both are set, or render their own clause individually.
      let count = '';
      if (req.exactDice !== undefined) {
        count = ` (use exactly ${req.exactDice} dice)`;
      } else if (req.minDice !== undefined && req.maxDice !== undefined) {
        count = ` (use ${req.minDice}-${req.maxDice} dice)`;
      } else if (req.minDice !== undefined) {
        count = ` (use ${req.minDice}+ dice)`;
      } else if (req.maxDice !== undefined) {
        count = ` (use up to ${req.maxDice} dice)`;
      }
      return `sum ${opText[req.op]} ${req.value}${count}`;
    }
    case 'xOfAKind':
      return `${req.count} of a kind`;
    case 'straight':
      return `${req.length} in a row`;
    case 'evens':
      return req.count === 1 ? '1 even die' : `${req.count} even dice`;
    case 'odds':
      return req.count === 1 ? '1 odd die' : `${req.count} odd dice`;
    case 'maxes':
      return req.count === 1
        ? '1 die showing its max'
        : `${req.count} dice showing their max`;
  }
}

function opPass(op: RequirementOp, actual: number, target: number): boolean {
  switch (op) {
    case 'lt':
      return actual < target;
    case 'lte':
      return actual <= target;
    case 'eq':
      return actual === target;
    case 'gte':
      return actual >= target;
    case 'gt':
      return actual > target;
  }
}

export interface SumSubsetBounds {
  minDice?: number;
  maxDice?: number;
  exactDice?: number;
}

export function findSumSubset(
  dice: Die[],
  op: RequirementOp,
  target: number,
  bounds: SumSubsetBounds = {},
  mustIncludeIds?: Set<string>,
): Die[] | null {
  // exactDice takes precedence — when set, both ends collapse onto N.
  // Otherwise a missing min defaults to 1 (always need to spend at least
  // one die for a sum) and a missing max means "no upper bound".
  const minDice =
    bounds.exactDice !== undefined ? bounds.exactDice : (bounds.minDice ?? 1);
  const maxDice =
    bounds.exactDice !== undefined
      ? bounds.exactDice
      : bounds.maxDice ?? Number.POSITIVE_INFINITY;
  if (minDice > maxDice) return null;

  const rolled = dice.filter((d) => d.value !== null);
  if (rolled.length < minDice) return null;

  const n = rolled.length;
  let best: Die[] | null = null;
  let bestSum = 0;
  let bestGhostCount = 0;

  // Selection priority among satisfying subsets:
  //   1. Fewest dice possible (the player wants to spend as little as they can).
  //   2. At equal size, MORE ghost dice — they evaporate on the next
  //      fulfillment regardless, so spending them is free, and the player
  //      expects ghosts to be consumed before they fade.
  //   3. At equal size + ghost-count, leave high-value dice in the pool for
  //      later — gte/gt/eq prefer the smallest sum, lt/lte prefer the largest
  //      (uses up lower-value dice first).
  const tiebreakPreferLower = op !== 'lt' && op !== 'lte';
  const filterActive = !!mustIncludeIds && mustIncludeIds.size > 0;

  for (let mask = 1; mask < 1 << n; mask += 1) {
    const subset: Die[] = [];
    let s = 0;
    let hasMust = !filterActive;
    let ghostCount = 0;
    for (let i = 0; i < n; i += 1) {
      if (mask & (1 << i)) {
        subset.push(rolled[i]);
        s += rolled[i].value ?? 0;
        if (filterActive && mustIncludeIds!.has(rolled[i].id)) hasMust = true;
        if (rolled[i].source === 'ghost') ghostCount += 1;
      }
    }
    if (subset.length < minDice) continue;
    if (subset.length > maxDice) continue;
    if (!hasMust) continue;
    if (!opPass(op, s, target)) continue;

    if (!best || subset.length < best.length) {
      best = subset;
      bestSum = s;
      bestGhostCount = ghostCount;
      continue;
    }
    if (subset.length === best.length) {
      if (ghostCount > bestGhostCount) {
        best = subset;
        bestSum = s;
        bestGhostCount = ghostCount;
        continue;
      }
      if (ghostCount === bestGhostCount) {
        const better = tiebreakPreferLower ? s < bestSum : s > bestSum;
        if (better) {
          best = subset;
          bestSum = s;
          bestGhostCount = ghostCount;
        }
      }
    }
  }
  return best;
}

function findKindSubset(
  dice: Die[],
  count: number,
  mustIncludeIds?: Set<string>,
): Die[] | null {
  const rolled = dice.filter((d) => d.value !== null);
  const buckets = new Map<number, Die[]>();
  for (const d of rolled) {
    const v = d.value as number;
    if (!buckets.has(v)) buckets.set(v, []);
    buckets.get(v)!.push(d);
  }
  const filterActive = !!mustIncludeIds && mustIncludeIds.size > 0;
  for (const group of buckets.values()) {
    if (group.length < count) continue;
    if (filterActive) {
      const includeInGroup = group.filter((d) => mustIncludeIds!.has(d.id));
      if (includeInGroup.length === 0) continue;
      const others = group.filter((d) => !mustIncludeIds!.has(d.id));
      return [...includeInGroup, ...others].slice(0, count);
    }
    return group.slice(0, count);
  }
  return null;
}

function findStraightSubset(
  dice: Die[],
  length: number,
  mustIncludeIds?: Set<string>,
): Die[] | null {
  const rolled = dice.filter((d) => d.value !== null);
  const filterActive = !!mustIncludeIds && mustIncludeIds.size > 0;
  // Bias byValue toward must-include dice for shared values, so the
  // straight that's returned uses the character die for its value
  // whenever possible.
  const byValue = new Map<number, Die>();
  for (const d of rolled) {
    const v = d.value as number;
    const existing = byValue.get(v);
    if (!existing) {
      byValue.set(v, d);
    } else if (
      filterActive &&
      mustIncludeIds!.has(d.id) &&
      !mustIncludeIds!.has(existing.id)
    ) {
      byValue.set(v, d);
    }
  }
  const values = [...byValue.keys()].sort((a, b) => a - b);
  for (let i = 0; i <= values.length - length; i += 1) {
    let ok = true;
    for (let j = 1; j < length; j += 1) {
      if (values[i + j] !== values[i] + j) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const window = Array.from({ length }, (_, k) => byValue.get(values[i] + k)!);
    if (filterActive) {
      const hasMust = window.some((d) => mustIncludeIds!.has(d.id));
      if (!hasMust) continue;
    }
    return window;
  }
  return null;
}

// Generic count-based subset finder for parity / max-face requirements.
// `predicate` selects which rolled dice qualify (even, odd, max-face). The
// finder returns exactly `count` qualifying dice, biased toward must-include
// ids first so the player's character die stays in the rotation when it
// can contribute.
function findCountSubset(
  dice: Die[],
  count: number,
  predicate: (d: Die) => boolean,
  mustIncludeIds?: Set<string>,
): Die[] | null {
  const matching = dice.filter((d) => d.value !== null && predicate(d));
  if (matching.length < count) return null;
  const filterActive = !!mustIncludeIds && mustIncludeIds.size > 0;
  if (filterActive) {
    const must = matching.filter((d) => mustIncludeIds!.has(d.id));
    if (must.length === 0) return null;
    const others = matching.filter((d) => !mustIncludeIds!.has(d.id));
    return [...must, ...others].slice(0, count);
  }
  return matching.slice(0, count);
}

const isEven = (d: Die) =>
  d.value !== null && (d.value as number) % 2 === 0;
const isOdd = (d: Die) =>
  d.value !== null && (d.value as number) % 2 === 1;
const isMaxFace = (d: Die) =>
  d.value !== null && (d.value as number) === d.size;

// Internal helper that dispatches by requirement kind.
function findInner(
  dice: Die[],
  req: Requirement,
  mustIncludeIds?: Set<string>,
): Die[] | null {
  switch (req.kind) {
    case 'sum':
      return findSumSubset(
        dice,
        req.op,
        req.value,
        {
          minDice: req.minDice,
          maxDice: req.maxDice,
          exactDice: req.exactDice,
        },
        mustIncludeIds,
      );
    case 'xOfAKind':
      return findKindSubset(dice, req.count, mustIncludeIds);
    case 'straight':
      return findStraightSubset(dice, req.length, mustIncludeIds);
    case 'evens':
      return findCountSubset(dice, req.count, isEven, mustIncludeIds);
    case 'odds':
      return findCountSubset(dice, req.count, isOdd, mustIncludeIds);
    case 'maxes':
      return findCountSubset(dice, req.count, isMaxFace, mustIncludeIds);
  }
}

export function findSatisfyingSubset(dice: Die[], req: Requirement): Die[] | null {
  // Priority order:
  //  1. Subsets that include a ghost die. Ghosts evaporate on the next
  //     fulfillment regardless, so spending them as part of the
  //     fulfillment is strictly better — they at least contribute their
  //     value before fading.
  //  2. Subsets that include the character die — keeps it rolling so it
  //     can max-roll and level up.
  //  3. Anything that satisfies.
  const ghostIds = new Set(
    dice.filter((d) => d.source === 'ghost' && d.value !== null).map((d) => d.id),
  );
  if (ghostIds.size > 0) {
    const withGhost = findInner(dice, req, ghostIds);
    if (withGhost) return withGhost;
  }
  const charIds = new Set(
    dice
      .filter((d) => d.source === 'character' && d.value !== null)
      .map((d) => d.id),
  );
  if (charIds.size > 0) {
    const withChar = findInner(dice, req, charIds);
    if (withChar) return withChar;
  }
  return findInner(dice, req);
}

export function isSubsetSatisfying(subset: Die[], req: Requirement): boolean {
  if (subset.some((d) => d.value === null)) return false;
  if (req.kind === 'sum') {
    const s = subset.reduce((a, d) => a + (d.value ?? 0), 0);
    if (req.exactDice !== undefined) {
      if (subset.length !== req.exactDice) return false;
    } else {
      if (req.minDice !== undefined && subset.length < req.minDice) return false;
      if (req.maxDice !== undefined && subset.length > req.maxDice) return false;
    }
    return opPass(req.op, s, req.value);
  }
  if (req.kind === 'xOfAKind') {
    if (subset.length !== req.count) return false;
    const v = subset[0].value;
    return subset.every((d) => d.value === v);
  }
  if (req.kind === 'evens') {
    if (subset.length !== req.count) return false;
    return subset.every(isEven);
  }
  if (req.kind === 'odds') {
    if (subset.length !== req.count) return false;
    return subset.every(isOdd);
  }
  if (req.kind === 'maxes') {
    if (subset.length !== req.count) return false;
    return subset.every(isMaxFace);
  }
  if (subset.length !== req.length) return false;
  const vals = subset.map((d) => d.value as number).sort((a, b) => a - b);
  for (let i = 1; i < vals.length; i += 1) {
    if (vals[i] !== vals[i - 1] + 1) return false;
  }
  return true;
}
