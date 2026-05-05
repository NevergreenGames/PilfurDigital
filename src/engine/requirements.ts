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
      const count = req.minDice ? ` (use ${req.minDice}+ dice)` : '';
      return `sum ${opText[req.op]} ${req.value}${count}`;
    }
    case 'xOfAKind':
      return `${req.count} of a kind`;
    case 'straight':
      return `${req.length} in a row`;
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

export function findSumSubset(
  dice: Die[],
  op: RequirementOp,
  target: number,
  minDice = 1,
  mustIncludeIds?: Set<string>,
): Die[] | null {
  const rolled = dice.filter((d) => d.value !== null);
  if (rolled.length < minDice) return null;

  const n = rolled.length;
  let best: Die[] | null = null;
  let bestSum = 0;

  // Prefer the fewest dice possible (the player wants to spend as little as
  // they can). Tiebreaker: leave high-value dice in the pool for later —
  // for gte/gt/eq use the subset with the smallest sum; for lt/lte use the
  // one with the largest sum (uses up lower-value dice first).
  const tiebreakPreferLower = op !== 'lt' && op !== 'lte';
  const filterActive = !!mustIncludeIds && mustIncludeIds.size > 0;

  for (let mask = 1; mask < 1 << n; mask += 1) {
    const subset: Die[] = [];
    let s = 0;
    let hasMust = !filterActive;
    for (let i = 0; i < n; i += 1) {
      if (mask & (1 << i)) {
        subset.push(rolled[i]);
        s += rolled[i].value ?? 0;
        if (filterActive && mustIncludeIds!.has(rolled[i].id)) hasMust = true;
      }
    }
    if (subset.length < minDice) continue;
    if (!hasMust) continue;
    if (!opPass(op, s, target)) continue;

    if (!best || subset.length < best.length) {
      best = subset;
      bestSum = s;
      continue;
    }
    if (subset.length === best.length) {
      const better = tiebreakPreferLower ? s < bestSum : s > bestSum;
      if (better) {
        best = subset;
        bestSum = s;
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

// Internal helper that dispatches by requirement kind.
function findInner(
  dice: Die[],
  req: Requirement,
  mustIncludeIds?: Set<string>,
): Die[] | null {
  if (req.kind === 'sum') return findSumSubset(dice, req.op, req.value, req.minDice, mustIncludeIds);
  if (req.kind === 'xOfAKind') return findKindSubset(dice, req.count, mustIncludeIds);
  return findStraightSubset(dice, req.length, mustIncludeIds);
}

export function findSatisfyingSubset(dice: Die[], req: Requirement): Die[] | null {
  // Prefer subsets that include the player's character die — keeps it
  // rolling so it can max-roll and level up. If no satisfying subset
  // includes a character die, fall back to the regular search.
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
    if (req.minDice && subset.length < req.minDice) return false;
    return opPass(req.op, s, req.value);
  }
  if (req.kind === 'xOfAKind') {
    if (subset.length !== req.count) return false;
    const v = subset[0].value;
    return subset.every((d) => d.value === v);
  }
  if (subset.length !== req.length) return false;
  const vals = subset.map((d) => d.value as number).sort((a, b) => a - b);
  for (let i = 1; i < vals.length; i += 1) {
    if (vals[i] !== vals[i - 1] + 1) return false;
  }
  return true;
}
