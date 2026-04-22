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

export function findSumSubset(dice: Die[], op: RequirementOp, target: number, minDice = 1): Die[] | null {
  const rolled = dice.filter((d) => d.value !== null);
  if (rolled.length < minDice) return null;

  const n = rolled.length;
  let best: Die[] | null = null;

  for (let mask = 1; mask < 1 << n; mask += 1) {
    const subset: Die[] = [];
    let s = 0;
    for (let i = 0; i < n; i += 1) {
      if (mask & (1 << i)) {
        subset.push(rolled[i]);
        s += rolled[i].value ?? 0;
      }
    }
    if (subset.length < minDice) continue;
    if (opPass(op, s, target)) {
      if (!best || subset.length > best.length) {
        best = subset;
      }
    }
  }
  return best;
}

function findKindSubset(dice: Die[], count: number): Die[] | null {
  const rolled = dice.filter((d) => d.value !== null);
  const buckets = new Map<number, Die[]>();
  for (const d of rolled) {
    const v = d.value as number;
    if (!buckets.has(v)) buckets.set(v, []);
    buckets.get(v)!.push(d);
  }
  for (const group of buckets.values()) {
    if (group.length >= count) return group.slice(0, count);
  }
  return null;
}

function findStraightSubset(dice: Die[], length: number): Die[] | null {
  const rolled = dice.filter((d) => d.value !== null);
  const byValue = new Map<number, Die>();
  for (const d of rolled) {
    const v = d.value as number;
    if (!byValue.has(v)) byValue.set(v, d);
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
    if (ok) {
      return Array.from({ length }, (_, k) => byValue.get(values[i] + k)!);
    }
  }
  return null;
}

export function findSatisfyingSubset(dice: Die[], req: Requirement): Die[] | null {
  if (req.kind === 'sum') return findSumSubset(dice, req.op, req.value, req.minDice);
  if (req.kind === 'xOfAKind') return findKindSubset(dice, req.count);
  return findStraightSubset(dice, req.length);
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
