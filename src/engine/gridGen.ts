import {
  DieSize,
  Grid,
  HeistTarget,
  PhaseCard,
  Position,
  Tile,
  TileId,
} from './types';

// Per-node grid configuration. Earlier nodes use a smaller grid so the first
// heist is bite-sized; later nodes ramp back up to the full 7x7.
interface NodeGridConfig {
  rows: number;
  cols: number;
  startPos: Position;
  minTargetDist: number;
  minWalls: number;
  maxWalls: number;
}

function configForNode(nodeIndex: number): NodeGridConfig {
  if (nodeIndex === 0) {
    return {
      rows: 5,
      cols: 5,
      startPos: { row: 4, col: 2 },
      minTargetDist: 3,
      minWalls: 3,
      maxWalls: 5,
    };
  }
  return {
    rows: 7,
    cols: 7,
    startPos: { row: 6, col: 3 },
    minTargetDist: 5,
    minWalls: 6,
    maxWalls: 10,
  };
}

const MAX_WALL_ATTEMPTS = 20;

function defaultRng(): number {
  return Math.random();
}

export function chebyshev(a: Position, b: Position): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

export function neighbors8(pos: Position, rows: number, cols: number): Position[] {
  const out: Position[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const r = pos.row + dr;
      const c = pos.col + dc;
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
      out.push({ row: r, col: c });
    }
  }
  return out;
}

export function tileIdOf(pos: Position): TileId {
  return `t${pos.row}${pos.col}`;
}

function findTile(tiles: Tile[], pos: Position): Tile | undefined {
  return tiles.find((t) => t.pos.row === pos.row && t.pos.col === pos.col);
}

export function bfsReachable(
  grid: Grid,
  from: Position,
  passable: (t: Tile) => boolean,
): Set<TileId> {
  const visited = new Set<TileId>();
  const queue: Position[] = [];
  const startTile = findTile(grid.tiles, from);
  if (!startTile) return visited;
  if (!passable(startTile)) return visited;
  queue.push(from);
  visited.add(startTile.id);
  while (queue.length > 0) {
    const cur = queue.shift() as Position;
    for (const n of neighbors8(cur, grid.rows, grid.cols)) {
      const nt = findTile(grid.tiles, n);
      if (!nt) continue;
      if (visited.has(nt.id)) continue;
      if (!passable(nt)) continue;
      visited.add(nt.id);
      queue.push(n);
    }
  }
  return visited;
}

export function cardDifficulty(card: PhaseCard): 1 | 2 | 3 {
  const req = card.requirement;
  if (req.kind === 'sum') {
    const { op, value, minDice } = req;
    if (op === 'lt' || op === 'lte') {
      if ((minDice ?? 0) >= 3) return 3;
      // default: treat low-sum constraints as easier unless heavy minDice
      if (value <= 8) return 1;
      if (value <= 12) return 2;
      return 3;
    }
    if (op === 'eq') return 2;
    if (op === 'gt' || op === 'gte') {
      if (value <= 8) return 1;
      if (value <= 12) return 2;
      return 3;
    }
  }
  if (req.kind === 'xOfAKind') {
    if (req.count <= 2) return 1;
    if (req.count === 3) return 2;
    return 3;
  }
  if (req.kind === 'straight') {
    if (req.length <= 3) return 2;
    return 3;
  }
  return 2;
}

function tileTierForDistance(d: number): 0 | 1 | 2 | 3 {
  if (d <= 0) return 0;
  if (d <= 2) return 1;
  if (d <= 4) return 2;
  return 3;
}

function pickInt(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function scaleMomentum(base: DieSize[], tier: 0 | 1 | 2 | 3): DieSize[] {
  const dice = [...base];
  if (tier === 1) {
    dice.push(6);
  } else if (tier === 3) {
    if (dice.length > 1) {
      let minIdx = 0;
      for (let i = 1; i < dice.length; i += 1) {
        if (dice[i] < dice[minIdx]) minIdx = i;
      }
      dice.splice(minIdx, 1);
    }
  }
  return dice;
}

function nodeIndexToGoalTier(nodeIndex: number): 1 | 2 | 3 {
  if (nodeIndex < 2) return 1;
  if (nodeIndex < 4) return 2;
  return 3;
}

function goalTargetToPhaseCard(target: HeistTarget, nodeIndex: number): PhaseCard {
  return {
    id: `${target.id}#goal-${nodeIndex}`,
    name: target.name,
    type: 'goal',
    requirement: target.requirement,
    momentumDice: [],
    flavor: target.flavor,
  };
}

export function generateGrid(
  nodeIndex: number,
  phasePool: PhaseCard[],
  goalPool: HeistTarget[],
  rng: () => number = defaultRng,
): Grid {
  const cfg = configForNode(nodeIndex);
  const ROWS_N = cfg.rows;
  const COLS_N = cfg.cols;
  const START_POS: Position = cfg.startPos;
  const MIN_TARGET_DIST = cfg.minTargetDist;
  const MIN_WALLS = cfg.minWalls;
  const MAX_WALLS = cfg.maxWalls;

  // 1. Init all tiles as phase/hidden
  const tiles: Tile[] = [];
  for (let r = 0; r < ROWS_N; r += 1) {
    for (let c = 0; c < COLS_N; c += 1) {
      tiles.push({
        id: tileIdOf({ row: r, col: c }),
        pos: { row: r, col: c },
        kind: 'phase',
        state: 'hidden',
        card: null,
        tier: 0,
      });
    }
  }

  // 2. Mark start
  const startTile = findTile(tiles, START_POS);
  if (startTile) {
    startTile.kind = 'start';
    startTile.state = 'revealed';
    startTile.tier = 0;
    startTile.card = null;
  }

  // 3. Pick target
  const candidateTargets: Position[] = [];
  for (let r = 0; r < ROWS_N; r += 1) {
    for (let c = 0; c < COLS_N; c += 1) {
      const p = { row: r, col: c };
      if (p.row === START_POS.row && p.col === START_POS.col) continue;
      if (chebyshev(START_POS, p) >= MIN_TARGET_DIST) candidateTargets.push(p);
    }
  }
  const fallbackTarget: Position = { row: 0, col: Math.floor(COLS_N / 2) };
  const targetPos =
    candidateTargets[Math.floor(rng() * candidateTargets.length)] ?? fallbackTarget;
  const targetTile = findTile(tiles, targetPos);
  const goalTier = nodeIndexToGoalTier(nodeIndex);
  const goalCandidates = goalPool.filter((g) => g.tier === goalTier);
  const goalSource =
    goalCandidates.length > 0
      ? goalCandidates[Math.floor(rng() * goalCandidates.length)]
      : goalPool[Math.floor(rng() * goalPool.length)];
  if (targetTile && goalSource) {
    targetTile.kind = 'target';
    targetTile.state = 'revealed';
    targetTile.tier = 3;
    targetTile.card = goalTargetToPhaseCard(goalSource, nodeIndex);
  }

  // 4. Walls — retry loop for BFS reachability.
  const wallCount = pickInt(rng, MIN_WALLS, MAX_WALLS);
  const nonReserved: Position[] = [];
  for (const t of tiles) {
    if (t.kind === 'start' || t.kind === 'target') continue;
    nonReserved.push(t.pos);
  }

  const tempGridShell = (): Grid => ({
    rows: ROWS_N,
    cols: COLS_N,
    tiles,
    start: START_POS,
    target: targetPos,
  });

  let wallsPlaced: Position[] = [];
  for (let attempt = 0; attempt < MAX_WALL_ATTEMPTS; attempt += 1) {
    // reset any previously placed walls
    for (const p of wallsPlaced) {
      const t = findTile(tiles, p);
      if (t) {
        t.kind = 'phase';
        t.state = 'hidden';
      }
    }
    wallsPlaced = [];

    // sample without replacement
    const pool = [...nonReserved];
    for (let i = 0; i < wallCount && pool.length > 0; i += 1) {
      const idx = Math.floor(rng() * pool.length);
      const pick = pool.splice(idx, 1)[0];
      const t = findTile(tiles, pick);
      if (t) {
        t.kind = 'wall';
        t.state = 'hidden';
        wallsPlaced.push(pick);
      }
    }

    // BFS reachability from start to target over non-wall tiles
    const reachable = bfsReachable(tempGridShell(), START_POS, (tt) => tt.kind !== 'wall');
    const targetId = tileIdOf(targetPos);
    if (reachable.has(targetId)) break;

    if (attempt === MAX_WALL_ATTEMPTS - 1) {
      // fallback: clear walls
      for (const p of wallsPlaced) {
        const t = findTile(tiles, p);
        if (t) {
          t.kind = 'phase';
          t.state = 'hidden';
        }
      }
      wallsPlaced = [];
      break;
    }
  }

  // 5. Compute tier for each remaining (phase) tile by distance.
  for (const t of tiles) {
    if (t.kind === 'phase') {
      const d = chebyshev(START_POS, t.pos);
      t.tier = tileTierForDistance(d);
    }
  }

  // 6. Partition phase pool by card difficulty, assign cards.
  const bucket: Record<1 | 2 | 3, PhaseCard[]> = { 1: [], 2: [], 3: [] };
  for (const c of phasePool) {
    if (c.type !== 'phase') continue;
    bucket[cardDifficulty(c)].push(c);
  }
  const pickFromTier = (tier: 1 | 2 | 3): PhaseCard | null => {
    const primary = bucket[tier];
    if (primary.length > 0) return primary[Math.floor(rng() * primary.length)];
    // nearest non-empty bucket fallback
    const order: (1 | 2 | 3)[] = [];
    if (tier === 1) order.push(2, 3);
    else if (tier === 2) order.push(1, 3);
    else order.push(2, 1);
    for (const alt of order) {
      if (bucket[alt].length > 0) return bucket[alt][Math.floor(rng() * bucket[alt].length)];
    }
    return null;
  };

  for (const t of tiles) {
    if (t.kind !== 'phase') continue;
    const tier = t.tier === 0 ? 1 : t.tier;
    const base = pickFromTier(tier as 1 | 2 | 3);
    if (!base) continue;
    // 7. Apply reward scaling to momentumDice based on tile tier.
    const scaled = scaleMomentum(base.momentumDice, t.tier);
    t.card = {
      ...base,
      id: `${base.id}#r${t.pos.row}c${t.pos.col}`,
      momentumDice: scaled,
    };
  }

  return tempGridShell();
}
