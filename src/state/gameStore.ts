import { create } from 'zustand';
import {
  AbilityChargeEvent,
  AbilityDraftOption,
  AbilityImpactEvent,
  CharacterAbility,
  Die,
  GameState,
  Grid,
  HeatIntent,
  HeistState,
  HeistTarget,
  MapNode,
  Position,
  RunState,
  Screen,
  Tile,
  TileId,
} from '../engine/types';
import { createDie, nextDieSize, rollValue } from '../engine/dice';
import { findSatisfyingSubset, isSubsetSatisfying } from '../engine/requirements';
import { applyEffect } from '../engine/effects';
import { PHASE_CARDS } from '../content/phaseCards';
import { CHARACTERS } from '../content/characters';
import { TARGETS, getTargetsByTier } from '../content/targets';
import { draftedAbilityPool } from '../content/abilities';
import { bfsReachable, generateGrid, neighbors8 } from '../engine/gridGen';

const TOTAL_NODES = 5;

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function randomPick<T>(arr: T[], count: number): T[] {
  return shuffle(arr).slice(0, count);
}

function buildMap(): MapNode[] {
  const nodes: MapNode[] = [];
  for (let i = 0; i < TOTAL_NODES; i += 1) {
    const tier: 1 | 2 | 3 = i < 2 ? 1 : i < 4 ? 2 : 3;
    const options = getTargetsByTier(tier);
    const choices = options.length >= 2 ? randomPick(options, 2) : options;
    nodes.push({
      index: i,
      targetChoices: choices.map((t, j) => ({ ...t, id: `${t.id}#${i}-${j}` })),
    });
  }
  return nodes;
}

function rollAll(dice: Die[]): Die[] {
  return dice.map((d) => ({ ...d, value: rollValue(d.size) }));
}

function findTileById(grid: Grid, tileId: TileId): Tile | undefined {
  return grid.tiles.find((t) => t.id === tileId);
}

function findTileAt(grid: Grid, pos: Position): Tile | undefined {
  return grid.tiles.find((t) => t.pos.row === pos.row && t.pos.col === pos.col);
}

function isAdjacent(a: Position, b: Position): boolean {
  if (a.row === b.row && a.col === b.col) return false;
  return Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1;
}

function isUnfulfilled(t: Tile): boolean {
  return t.state !== 'playerFulfilled' && t.state !== 'heatFulfilled';
}

function isWalkable(t: Tile): boolean {
  return t.kind === 'start' || t.state === 'playerFulfilled';
}

// For trapped-detection only: treats revealed-but-unfulfilled phase tiles as
// potentially traversable (the player may still fulfill them later). Only
// permanent blockers — walls, void porch slots, and heat-fulfilled tiles —
// count as impassable.
function isNotPermanentlyBlocked(t: Tile): boolean {
  return t.kind !== 'wall' && t.kind !== 'void' && t.state !== 'heatFulfilled';
}

function revealFogAround(grid: Grid, center: Position): Grid {
  const tiles = grid.tiles.map((t) => {
    if (t.state !== 'hidden') return t;
    const adj =
      Math.abs(t.pos.row - center.row) <= 1 && Math.abs(t.pos.col - center.col) <= 1;
    if (!adj) return t;
    return { ...t, state: 'revealed' as const };
  });
  return { ...grid, tiles };
}

function setTile(grid: Grid, tileId: TileId, update: Partial<Tile>): Grid {
  const tiles = grid.tiles.map((t) => (t.id === tileId ? { ...t, ...update } : t));
  return { ...grid, tiles };
}

// Compute heat intents — heat dice that *would* satisfy adjacent unfulfilled
// tiles get reserved (set aside) but tiles are NOT mutated. The player has
// the turn to preempt these by fulfilling the tile themselves; otherwise the
// intents resolve on End Turn (see resolveHeatIntents).
function computeHeatIntents(
  grid: Grid,
  player: Position,
  heat: Die[],
): { remainingHeat: Die[]; intents: HeatIntent[] } {
  let heatNext = [...heat];
  const intents: HeatIntent[] = [];

  const adjTiles = neighbors8(player, grid.rows, grid.cols)
    .map((p) => findTileAt(grid, p))
    .filter((t): t is Tile => !!t)
    .filter((t) => t.state === 'revealed' && isUnfulfilled(t) && t.card !== null)
    .sort((a, b) => (a.pos.row * 7 + a.pos.col) - (b.pos.row * 7 + b.pos.col));

  for (const t of adjTiles) {
    const rolledHeat = heatNext.filter((d) => d.value !== null);
    if (rolledHeat.length === 0) break;
    const card = t.card;
    if (!card) continue;
    const subset = findSatisfyingSubset(rolledHeat, card.requirement);
    if (!subset) continue;
    const consumedSet = new Set(subset.map((d) => d.id));
    heatNext = heatNext.filter((d) => !consumedSet.has(d.id));
    intents.push({
      tileId: t.id,
      tileName: card.name,
      reservedDice: subset.map((d) => ({ ...d })),
      gainedSizes: card.momentumDice ?? [],
    });
  }

  return { remainingHeat: heatNext, intents };
}

// Resolve heat intents — called on End Turn. Each intent fires:
// the tile is set to heatFulfilled, the gained dice enter heat as new
// unrolled dice, and the reserved dice are consumed.
function resolveHeatIntents(
  grid: Grid,
  heat: Die[],
  intents: HeatIntent[],
  log: string[],
): {
  grid: Grid;
  heat: Die[];
  log: string[];
  capturedOnTarget: boolean;
} {
  let gridNext = grid;
  let heatNext = heat;
  const logNext = [...log];
  let capturedOnTarget = false;
  for (const intent of intents) {
    const tile = findTileById(gridNext, intent.tileId);
    if (!tile) continue;
    gridNext = setTile(gridNext, intent.tileId, { state: 'heatFulfilled' });
    const newHeat: Die[] = intent.gainedSizes.map((size) => ({
      ...createDie(size, 'heat', intent.tileId),
      value: null,
    }));
    heatNext = [...heatNext, ...newHeat];
    logNext.push(`🔥 Heat took ${intent.tileName}.`);
    if (tile.kind === 'target') capturedOnTarget = true;
  }
  return { grid: gridNext, heat: heatNext, log: logNext, capturedOnTarget };
}

// Outcome detection after any mutation
function detectOutcome(grid: Grid, player: Position): 'won' | 'captured' | 'trapped' | null {
  const targetTile = findTileAt(grid, grid.target);
  if (!targetTile) return null;
  if (targetTile.state === 'playerFulfilled') return 'won';
  if (targetTile.state === 'heatFulfilled') return 'captured';

  // trapped: BFS from player over all non-permanently-blocked tiles cannot reach any
  // tile 8-adjacent to target, AND player is not currently adjacent to target.
  // Unfulfilled phase tiles count as traversable here because they can still be
  // fulfilled later; only walls and heat-fulfilled tiles truly block.
  if (isAdjacent(player, grid.target)) return null;

  const reachable = bfsReachable(grid, player, isNotPermanentlyBlocked);
  const neighborsOfTarget = neighbors8(grid.target, grid.rows, grid.cols);
  for (const n of neighborsOfTarget) {
    const t = findTileAt(grid, n);
    if (!t) continue;
    if (reachable.has(t.id)) return null;
  }
  return 'trapped';
}

// After a roll, each ability whose trigger is currently satisfied by the
// pool gains one charge. Charges accumulate across rolls and are only spent
// by activating the ability. Returns one AbilityChargeEvent per ability
// that gained a charge — the UI uses these to animate the pop on the
// ability card AND highlight the satisfying dice in the pool.
function addChargesFromRoll(
  pool: Die[],
  abilities: CharacterAbility[],
  currentCharges: Record<string, number>,
): {
  charges: Record<string, number>;
  gained: string[];
  events: AbilityChargeEvent[];
} {
  const charges = { ...currentCharges };
  const gained: string[] = [];
  const events: AbilityChargeEvent[] = [];
  for (const ability of abilities) {
    const subset = findSatisfyingSubset(pool, ability.trigger);
    if (subset) {
      charges[ability.id] = (charges[ability.id] ?? 0) + 1;
      gained.push(ability.name);
      events.push({
        abilityId: ability.id,
        abilityName: ability.name,
        satisfyingDiceIds: subset.map((d) => d.id),
      });
    }
  }
  return { charges, gained, events };
}

function buildAbilityDraft(
  owned: CharacterAbility[],
  creds: number,
): AbilityDraftOption[] {
  const ownedIds = new Set(owned.map((a) => a.id));
  const available = draftedAbilityPool.filter((a) => !ownedIds.has(a.id));
  const DRAFT_SIZE = 3;

  // Affordability-biased selection: pick the draft so the player can
  // afford at least 2 of the 3 options whenever the available pool
  // contains 2+ affordable abilities. Falls back to fewer affordable
  // entries (or none) when the pool can't satisfy the bias — better to
  // show what exists than to skip the draft entirely.
  const affordable = available.filter((a) => a.cost <= creds);
  const unaffordable = available.filter((a) => a.cost > creds);

  let picks: CharacterAbility[] = [];
  if (available.length >= DRAFT_SIZE) {
    if (affordable.length >= 2) {
      const twoAffordable = randomPick(affordable, 2);
      const remainingPool = available.filter(
        (a) => !twoAffordable.some((p) => p.id === a.id),
      );
      // Third slot can come from anywhere in the remaining pool.
      const third = randomPick(remainingPool, 1);
      picks = shuffle([...twoAffordable, ...third]);
    } else if (affordable.length === 1) {
      const filler = randomPick(unaffordable, 2);
      picks = shuffle([...affordable, ...filler]);
    } else {
      picks = randomPick(available, DRAFT_SIZE);
    }
  } else {
    // Fallback: exhaust available uniques, then allow duplicates from the full pool.
    const uniques = shuffle(available);
    const filler = randomPick(draftedAbilityPool, DRAFT_SIZE - uniques.length);
    picks = [...uniques, ...filler];
  }
  return picks.map((a) => ({ ability: a }));
}

function buildFreshHeist(
  run: RunState,
  target: HeistTarget,
  nodeIndex: number,
): HeistState {
  const grid = generateGrid(nodeIndex, PHASE_CARDS, TARGETS);
  // Make sure the target card's name matches the chosen target (generateGrid picks by tier).
  // We override the target tile's card to the actually-selected target so the map choice is honored.
  const targetTile = findTileAt(grid, grid.target);
  if (targetTile) {
    targetTile.card = {
      id: `${target.id}#goal-${nodeIndex}`,
      name: target.name,
      type: 'goal',
      icon: target.icon,
      requirement: target.requirement,
      momentumDice: [],
      flavor: target.flavor,
    };
  }
  const charDie: Die = {
    ...createDie(run.characterDie, 'character', run.character.id),
    value: null,
  };
  // Every heist starts with the character die plus a fresh d6.
  const starterD6: Die = { ...createDie(6, 'stash'), value: null };
  // Heat scales by level. Level 1 (nodeIndex 0) → 2 heat dice;
  // Level 5 (nodeIndex 4) → 6 heat dice.
  const heatCount = nodeIndex + 2;
  const heat: Die[] = [];
  for (let i = 0; i < heatCount; i += 1) {
    heat.push({ ...createDie(6, 'heat'), value: null });
  }
  // Reveal fog around the start tile so the player can see their immediate
  // neighbors on the playable grid above the porch.
  const gridRevealed = revealFogAround(grid, grid.start);
  return {
    grid: gridRevealed,
    player: grid.start,
    pool: [charDie, starterD6],
    heat,
    heatIntents: [],
    hasRolledThisTurn: false,
    turn: 1,
    outcome: null,
    log: [`The job: ${target.name}.`],
    lastHeatResolution: null,
    lastPlayerFulfill: null,
    lastChargeEvents: [],
    lastAbilityImpact: null,
  };
}

interface UIState {
  selectedDiceIds: string[];
  message: string | null;
}

const initialUI: UIState = { selectedDiceIds: [], message: null };

interface GameStore extends GameState {
  ui: UIState;

  setScreen: (screen: Screen) => void;
  initRun: (characterId: string) => void;
  selectCharacter: (characterId: string) => void;
  resetToTitle: () => void;
  /** @deprecated alias of resetToTitle, kept for back-compat */
  resetToCharacterSelect: () => void;

  selectTarget: (targetId: string) => void;

  toggleDieSelection: (dieId: string) => void;
  clearSelection: () => void;

  movePlayer: (tileId: TileId) => void;
  rollDice: () => void;
  playerFulfillTile: (tileId: TileId) => void;
  reroll: () => void;
  endTurn: () => void;
  activateAbility: (abilityId: string) => void;

  chooseDraft: (optionIndex: number) => void;
  skipDraft: () => void;
  continueToNextNode: () => void;
  proceedFromOutcome: () => void;
}

const initialState: GameState = { screen: 'title' as Screen, run: null };

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  ui: initialUI,

  setScreen: (screen) => set({ screen }),

  initRun: (characterId) => {
    const character = CHARACTERS.find((c) => c.id === characterId);
    if (!character) return;
    const run: RunState = {
      character,
      characterDie: character.startingDie,
      abilities: [character.ability],
      abilityCharges: {},
      creds: 0,
      heat: [],
      nodeIndex: 0,
      map: buildMap(),
      heist: null,
      draft: null,
    };
    set({ screen: 'map', run, ui: initialUI });
  },

  selectCharacter: (characterId) => {
    get().initRun(characterId);
  },

  resetToTitle: () => {
    set({ ...initialState, ui: initialUI });
  },
  resetToCharacterSelect: () => {
    set({ ...initialState, ui: initialUI });
  },

  selectTarget: (targetId) => {
    const run = get().run;
    if (!run) return;
    const node = run.map[run.nodeIndex];
    const target = node.targetChoices.find((t) => t.id === targetId);
    if (!target) return;
    const heist = buildFreshHeist(run, target, run.nodeIndex);
    const nextMap = run.map.map((n, i) =>
      i === run.nodeIndex ? { ...n, chosenTargetId: targetId } : n,
    );
    set({
      screen: 'heist',
      run: { ...run, heist, map: nextMap },
      ui: initialUI,
    });
  },

  toggleDieSelection: (dieId) => {
    const ui = get().ui;
    const has = ui.selectedDiceIds.includes(dieId);
    set({
      ui: {
        ...ui,
        selectedDiceIds: has
          ? ui.selectedDiceIds.filter((id) => id !== dieId)
          : [...ui.selectedDiceIds, dieId],
        message: null,
      },
    });
  },

  clearSelection: () => set({ ui: { ...get().ui, selectedDiceIds: [], message: null } }),

  movePlayer: (tileId) => {
    const state = get();
    const run = state.run;
    if (!run?.heist) return;
    const heist = run.heist;
    if (heist.outcome) return;

    const dest = findTileById(heist.grid, tileId);
    if (!dest) return;
    if (!isWalkable(dest)) {
      set({ ui: { ...state.ui, message: 'Can only move onto start or player-fulfilled tiles.' } });
      return;
    }
    if (!isAdjacent(heist.player, dest.pos)) {
      set({ ui: { ...state.ui, message: 'Target tile is not adjacent.' } });
      return;
    }

    // 1) Apply the move + fog reveal.
    const grid = revealFogAround(heist.grid, dest.pos);
    const log = [...heist.log, `Moved to (${dest.pos.row}, ${dest.pos.col}).`];
    const moveOutcome = detectOutcome(grid, dest.pos);
    set({
      run: {
        ...run,
        heist: {
          ...heist,
          grid,
          player: dest.pos,
          log,
          outcome: moveOutcome ?? heist.outcome,
        },
      },
      ui: { ...state.ui, message: null },
    });
    if (moveOutcome) {
      postOutcome(moveOutcome);
      return;
    }
    // 2) Movement also ends the turn and rerolls the dice — same sequence
    //    as clicking REROLL. Heat intents fire, fresh roll happens, abilities
    //    re-charge from the new roll.
    get().reroll();
  },

  rollDice: () => {
    const state = get();
    const run = state.run;
    if (!run?.heist) return;
    const heist = run.heist;
    if (heist.outcome) return;
    if (heist.hasRolledThisTurn) return;

    const pool = rollAll(heist.pool);
    const heatRolled = rollAll(heist.heat);
    // Snapshot for the UI banner — copies of rolled heat dice BEFORE reservation.
    const rolledSnapshot = heatRolled
      .filter((d) => d.value !== null)
      .map((d) => ({ ...d }));
    const log = [
      ...heist.log,
      `Turn ${heist.turn}: rolled ${pool.length} pool + ${heatRolled.length} heat dice.`,
    ];

    // Compute heat intents — heat dice are reserved (not consumed) for tiles
    // they can satisfy. Tiles stay revealed; intents resolve on End Turn unless
    // the player preempts by fulfilling the tile themselves.
    const { remainingHeat, intents } = computeHeatIntents(
      heist.grid,
      heist.player,
      heatRolled,
    );
    if (intents.length > 0) {
      log.push(
        `🔥 Heat is looming over: ${intents.map((i) => i.tileName).join(', ')}.`,
      );
    }

    // Banner data — represent intents as "fills" for the existing UI.
    const fills = intents.map((i) => ({
      tileId: i.tileId,
      tileName: i.tileName,
      consumedIds: i.reservedDice.map((d) => d.id),
      gainedSizes: i.gainedSizes,
    }));

    // Grant ability charges for any trigger met by the freshly rolled pool.
    const chargeRes = addChargesFromRoll(pool, run.abilities, run.abilityCharges);
    if (chargeRes.gained.length > 0) {
      log.push(`⚡ Charged: ${chargeRes.gained.join(', ')}.`);
    }

    set({
      run: {
        ...run,
        abilityCharges: chargeRes.charges,
        heist: {
          ...heist,
          pool,
          heat: remainingHeat,
          heatIntents: intents,
          hasRolledThisTurn: true,
          log,
          lastHeatResolution: {
            rolledDice: rolledSnapshot,
            fills,
            capturedOnTarget: false,
          },
          lastPlayerFulfill: null,
          lastChargeEvents: chargeRes.events,
        },
      },
    });
  },

  playerFulfillTile: (tileId) => {
    const state = get();
    const run = state.run;
    if (!run?.heist) return;
    const heist = run.heist;
    if (heist.outcome) return;

    const tile = findTileById(heist.grid, tileId);
    if (!tile) return;
    if (tile.state !== 'revealed' || !isUnfulfilled(tile)) {
      set({ ui: { ...state.ui, message: 'Tile is not a valid fulfill target.' } });
      return;
    }
    if (!isAdjacent(heist.player, tile.pos)) {
      set({ ui: { ...state.ui, message: 'Tile is not adjacent.' } });
      return;
    }
    const tileCard = tile.card;
    if (!tileCard) {
      set({ ui: { ...state.ui, message: 'Tile has no card.' } });
      return;
    }

    // If the player selected dice, use them. Otherwise auto-pick the minimum
    // satisfying subset from the pool.
    const manualSelection = heist.pool.filter((d) =>
      state.ui.selectedDiceIds.includes(d.id),
    );
    let selected: Die[];
    if (manualSelection.length > 0) {
      if (!isSubsetSatisfying(manualSelection, tileCard.requirement)) {
        set({ ui: { ...state.ui, message: `Those dice do not satisfy "${tileCard.name}".` } });
        return;
      }
      selected = manualSelection;
    } else {
      const auto = findSatisfyingSubset(heist.pool, tileCard.requirement);
      if (!auto) {
        set({ ui: { ...state.ui, message: `Pool can't satisfy "${tileCard.name}".` } });
        return;
      }
      selected = auto;
    }

    // Consume selected dice — except character die, which returns to pool unrolled.
    const selectedIds = new Set(selected.map((d) => d.id));
    const charSelected = selected.filter((d) => d.source === 'character');
    const remainingPool = heist.pool
      .filter((d) => !selectedIds.has(d.id))
      .concat(charSelected.map((d) => ({ ...d, value: null })));

    // Push tile momentum dice to pool unrolled.
    const gained: Die[] = (tileCard.momentumDice ?? []).map((size) => ({
      ...createDie(size, 'phase', tileCard.id),
      value: null,
    }));
    let pool = [...remainingPool, ...gained];
    let heat = heist.heat;
    const log = [...heist.log, `✔ ${tileCard.name} fulfilled.`];

    // Cache payout — only awarded when the PLAYER fulfills the tile
    // (heat-fulfillment never pays). Banked into run.creds, spent later
    // in the between-heist draft.
    const cacheReward = tileCard.cacheReward ?? 0;
    if (cacheReward > 0) {
      log.push(`💰 Cache! +¢${cacheReward}.`);
    }

    // Fire onPlayEffect if present.
    if (tileCard.onPlayEffect) {
      const effectRes = applyEffect(tileCard.onPlayEffect, {
        pool,
        heat,
        selectedDiceIds: [],
      });
      pool = effectRes.pool;
      heat = effectRes.heat;
      log.push(`On play: ${tileCard.onPlayEffect.text}`, ...effectRes.log);
    }

    // Character die level-up if any selected char die maxed.
    const charWasMaxed = charSelected.some((d) => d.value !== null && d.value === d.size);
    let characterDie = run.characterDie;
    if (charWasMaxed) {
      const next = nextDieSize(characterDie);
      if (next !== characterDie) {
        characterDie = next;
        // resize the character die in pool
        pool = pool.map((d) =>
          d.source === 'character' ? { ...d, size: characterDie } : d,
        );
        log.push(`★ ${run.character.name}'s die leveled up to d${characterDie}!`);
      }
    }

    // Mark tile fulfilled, then move the player onto it and reveal fog around
    // the new position. (Target tile is the exception — the player wins but
    // does not "move onto" it, since the target tile is a score, not terrain.)
    const fulfilledGrid = setTile(heist.grid, tile.id, { state: 'playerFulfilled' });
    const newPlayer = tile.kind === 'target' ? heist.player : tile.pos;
    const grid =
      tile.kind === 'target' ? fulfilledGrid : revealFogAround(fulfilledGrid, newPlayer);
    if (tile.kind !== 'target') {
      log.push(`Moved to (${newPlayer.row}, ${newPlayer.col}).`);
    }

    // If heat was looming on this tile (intent), the player just preempted it.
    // Release the reserved dice back to the heat pool — they'll be available
    // again next roll. The intent goes away.
    const preemptedIntent = heist.heatIntents.find((i) => i.tileId === tile.id);
    let heatNext = heat;
    let intentsNext = heist.heatIntents;
    if (preemptedIntent) {
      heatNext = [...heat, ...preemptedIntent.reservedDice];
      intentsNext = heist.heatIntents.filter((i) => i.tileId !== tile.id);
      log.push(`✋ Preempted heat on ${preemptedIntent.tileName}.`);
    }

    // Outcome detection.
    let outcome: HeistState['outcome'] = heist.outcome;
    if (tile.kind === 'target') outcome = 'won';
    if (!outcome) outcome = detectOutcome(grid, newPlayer);

    // Snapshot consumed dice (with values) so the UI can animate them flying
    // to the tile before the tile visually "locks" as fulfilled.
    const consumedSnapshot = selected.map((d) => ({ ...d }));

    set({
      run: {
        ...run,
        characterDie,
        creds: run.creds + cacheReward,
        heist: {
          ...heist,
          grid,
          pool,
          heat: heatNext,
          heatIntents: intentsNext,
          log,
          player: newPlayer,
          outcome: outcome ?? null,
          lastHeatResolution: null,
          lastPlayerFulfill: {
            tileId: tile.id,
            tileName: tileCard.name,
            consumedDice: consumedSnapshot,
            gainedSizes: tileCard.momentumDice ?? [],
            movedTo: tile.kind === 'target' ? null : newPlayer,
          },
        },
      },
      ui: { ...state.ui, selectedDiceIds: [], message: null },
    });
    if (outcome) {
      postOutcome(outcome);
      return;
    }
    // Fulfilling a non-target tile auto-moves the player onto it AND
    // ends the turn — same end-turn-and-roll sequence as movement.
    // Target tiles are the exception: a target fulfill is the WIN, the
    // run is over, no reroll needed.
    if (tile.kind !== 'target') {
      get().reroll();
    }
  },

  // Reroll == End Turn + Roll. Resolves all pending heat intents (locking
  // tiles, generating new heat from gained dice), advances the turn, then
  // rolls everything fresh and grants the +1 d6 bonus to pool and heat.
  reroll: () => {
    const state = get();
    const run = state.run;
    if (!run?.heist) return;
    const heist = run.heist;
    if (heist.outcome) return;

    // Step 1 — End-turn resolution: heat intents fire.
    const resolveLog = [...heist.log, `— end of turn ${heist.turn} —`];
    const resolved = resolveHeatIntents(
      heist.grid,
      heist.heat,
      heist.heatIntents,
      resolveLog,
    );

    let outcome: HeistState['outcome'] = heist.outcome;
    if (resolved.capturedOnTarget) outcome = 'captured';
    const detectedAfterResolve = detectOutcome(resolved.grid, heist.player);
    if (detectedAfterResolve && !outcome) outcome = detectedAfterResolve;

    // If end-turn resolution ends the run, commit and skip the roll.
    if (outcome) {
      set({
        run: {
          ...run,
          heist: {
            ...heist,
            grid: resolved.grid,
            heat: resolved.heat,
            heatIntents: [],
            turn: heist.turn + 1,
            hasRolledThisTurn: false,
            log: resolved.log,
            outcome,
          },
        },
        ui: { ...state.ui, selectedDiceIds: [], message: null },
      });
      postOutcome(outcome);
      return;
    }

    // Step 2 — Fresh roll (with the +1 d6 reroll bonus to each pool).
    let pool = rollAll(heist.pool);
    let heat = rollAll(resolved.heat);
    const newPoolDie: Die = { ...createDie(6, 'phase'), value: rollValue(6) };
    const newHeatDie: Die = { ...createDie(6, 'heat'), value: rollValue(6) };
    pool = [...pool, newPoolDie];
    heat = [...heat, newHeatDie];

    const log = [
      ...resolved.log,
      `Reroll: rolled ${pool.length} pool + ${heat.length} heat dice (+1 d6 each).`,
    ];
    const rolledSnapshot = heat
      .filter((d) => d.value !== null)
      .map((d) => ({ ...d }));

    // Step 3 — Compute new heat intents against the fresh roll.
    const { remainingHeat, intents } = computeHeatIntents(
      resolved.grid,
      heist.player,
      heat,
    );
    if (intents.length > 0) {
      log.push(
        `🔥 Heat is looming over: ${intents.map((i) => i.tileName).join(', ')}.`,
      );
    }
    const fills = intents.map((i) => ({
      tileId: i.tileId,
      tileName: i.tileName,
      consumedIds: i.reservedDice.map((d) => d.id),
      gainedSizes: i.gainedSizes,
    }));

    // Reroll counts as a roll for ability-charging purposes.
    const chargeRes = addChargesFromRoll(pool, run.abilities, run.abilityCharges);
    if (chargeRes.gained.length > 0) {
      log.push(`⚡ Charged: ${chargeRes.gained.join(', ')}.`);
    }

    set({
      run: {
        ...run,
        abilityCharges: chargeRes.charges,
        heist: {
          ...heist,
          grid: resolved.grid,
          pool,
          heat: remainingHeat,
          heatIntents: intents,
          turn: heist.turn + 1,
          hasRolledThisTurn: true,
          log,
          lastHeatResolution: {
            rolledDice: rolledSnapshot,
            fills,
            capturedOnTarget: false,
          },
          // Preserve lastPlayerFulfill from the spread so a fulfill that
          // chained into reroll can still play its fly animation.
          lastChargeEvents: chargeRes.events,
        },
      },
      ui: { ...state.ui, selectedDiceIds: [], message: null },
    });
  },

  endTurn: () => {
    const state = get();
    const run = state.run;
    if (!run?.heist) return;
    const heist = run.heist;
    if (heist.outcome) return;

    // Resolve any pending heat intents — reserved dice are consumed, tiles
    // become heatFulfilled, gained dice enter heat as new unrolled dice.
    const log = [...heist.log, `— end of turn ${heist.turn} —`];
    const resolved = resolveHeatIntents(heist.grid, heist.heat, heist.heatIntents, log);

    let outcome: HeistState['outcome'] = heist.outcome;
    if (resolved.capturedOnTarget) outcome = 'captured';
    const detected = detectOutcome(resolved.grid, heist.player);
    if (detected && !outcome) outcome = detected;

    set({
      run: {
        ...run,
        heist: {
          ...heist,
          grid: resolved.grid,
          heat: resolved.heat,
          heatIntents: [],
          turn: heist.turn + 1,
          hasRolledThisTurn: false,
          log: resolved.log,
          outcome: outcome ?? null,
        },
      },
      ui: { ...state.ui, selectedDiceIds: [], message: null },
    });
    if (outcome) postOutcome(outcome);
  },

  activateAbility: (abilityId) => {
    const state = get();
    const run = state.run;
    if (!run?.heist) return;
    const heist = run.heist;
    if (heist.outcome) return;

    const ability = run.abilities.find((a) => a.id === abilityId);
    if (!ability) {
      set({ ui: { ...state.ui, message: 'Ability not found.' } });
      return;
    }

    const currentCharges = run.abilityCharges[abilityId] ?? 0;
    if (currentCharges <= 0) {
      set({ ui: { ...state.ui, message: `${ability.name} is not charged.` } });
      return;
    }

    // Batch-fire path: when the ability targets a single die but the
    // player has multiple dice selected, repeat the ability — one fire
    // per selected die, one charge per fire — until either we run out
    // of charges or every selected die has been hit. For everything
    // else (non-targeted effects, multi-target effects like
    // `setTwoDiceToOne`, single-target with a single selection) the
    // loop runs exactly once with the original selection.
    const isSingleTargetEffect = ability.effect.requiresTarget === 'die';
    const selectedIds = state.ui.selectedDiceIds;
    const batchTargets: Array<string[]> =
      isSingleTargetEffect && selectedIds.length > 1
        ? selectedIds
            .slice(0, currentCharges)
            .map((id) => [id])
        : [selectedIds];

    let pool = heist.pool;
    let heat = heist.heat;
    const effectLog: string[] = [];
    const impactedDieIds: string[] = [];
    let chargesUsed = 0;
    for (const targetIds of batchTargets) {
      if (currentCharges - chargesUsed <= 0) break;
      const res = applyEffect(ability.effect, {
        pool,
        heat,
        selectedDiceIds: targetIds,
      });
      pool = res.pool;
      heat = res.heat;
      effectLog.push(...res.log);
      // Record which dice this fire impacted. For target-bearing
      // effects (single or multi) it's the targeted ids; for non-target
      // effects we treat the originally-selected ids as impacted (the
      // effect may consume / transform them — e.g. rerollSelected).
      for (const id of targetIds) {
        if (id) impactedDieIds.push(id);
      }
      chargesUsed += 1;
    }

    const chargesLeft = currentCharges - chargesUsed;
    const log = [
      ...heist.log,
      chargesUsed > 1
        ? `⚡ Activated ${ability.name} ×${chargesUsed}. (${chargesLeft} charge${
            chargesLeft === 1 ? '' : 's'
          } left)`
        : `⚡ Activated ${ability.name}. (${chargesLeft} charge${
            chargesLeft === 1 ? '' : 's'
          } left)`,
      `Effect: ${ability.effect.text}`,
      ...effectLog,
    ];

    const outcome: HeistState['outcome'] = heist.outcome ?? detectOutcome(heist.grid, heist.player);

    // Build the impact event so the UI can light up the affected dice.
    // For non-targeted effects (rerollAll, removeOnes, etc.) we still
    // ping the entire pool by leaving impactedDieIds empty — the UI
    // treats an empty list as "no specific spotlight" and skips the
    // animation rather than enlarging every die.
    const impactEvent: AbilityImpactEvent = {
      abilityId,
      abilityName: ability.name,
      impactedDieIds,
    };

    set({
      run: {
        ...run,
        abilityCharges: {
          ...run.abilityCharges,
          [abilityId]: chargesLeft,
        },
        heist: {
          ...heist,
          pool,
          heat,
          log,
          outcome: outcome ?? null,
          lastAbilityImpact: impactEvent,
        },
      },
      // Clear the dice selection: the selected dice were the ability's
      // targets and have now been "consumed" (their values transformed,
      // duplicated, etc.). Crucially, this also flips the
      // `selectedDice.length >= min` trigger in HeistScreen's
      // fire-when-targeted useEffect to false on the next render — without
      // this, the effect re-fires after every successful activation
      // (zustand notifies subscribers synchronously, ahead of React
      // flushing `setWaitingAbilityId(null)`) and burns through every
      // remaining charge in a single click.
      ui: { ...state.ui, selectedDiceIds: [], message: null },
    });
    if (outcome) postOutcome(outcome);
  },

  chooseDraft: (optionIndex) => {
    const run = get().run;
    if (!run?.draft) return;
    const option = run.draft[optionIndex];
    if (!option) return;
    // Gate the purchase on affordability — the UI also disables
    // unaffordable buttons, but the store enforces it as the source of
    // truth. Skip silently if the player can't actually pay.
    if (option.ability.cost > run.creds) return;
    set({
      run: {
        ...run,
        abilities: [...run.abilities, option.ability],
        creds: run.creds - option.ability.cost,
        draft: null,
      },
    });
    get().continueToNextNode();
  },

  skipDraft: () => {
    const run = get().run;
    if (!run) return;
    set({ run: { ...run, draft: null } });
    get().continueToNextNode();
  },

  continueToNextNode: () => {
    const run = get().run;
    if (!run) return;
    set({ screen: 'map', run: { ...run, nodeIndex: run.nodeIndex + 1, heist: null } });
  },

  // Called when the player dismisses/confirms the heist-end overlay. Routes
  // to the appropriate next screen based on the heist outcome. While the
  // overlay is open, the heist screen stays visible (state is non-interactive
  // because run.heist.outcome is set, gating all per-tile actions).
  proceedFromOutcome: () => {
    const run = get().run;
    if (!run?.heist) return;
    const heistOutcome = run.heist.outcome;
    if (!heistOutcome) return;
    if (heistOutcome === 'captured' || heistOutcome === 'trapped') {
      // End of run — full reset back to character select.
      set({ ...initialState, ui: initialUI });
      return;
    }
    // Heist won — pay out the target's creds reward.
    const node = run.map[run.nodeIndex];
    const chosenTargetId = node.chosenTargetId;
    const chosenTarget = chosenTargetId
      ? node.targetChoices.find((t) => t.id === chosenTargetId)
      : undefined;
    const reward = chosenTarget?.credsReward ?? 0;
    const credsAfter = run.creds + reward;
    const isFinalNode = run.nodeIndex === TOTAL_NODES - 1;
    if (isFinalNode) {
      set({ screen: 'gameOver', run: { ...run, creds: credsAfter } });
      return;
    }
    // Won a non-final node — go to draft for the next job.
    const draft = buildAbilityDraft(run.abilities, credsAfter);
    set({
      screen: 'draft',
      run: { ...run, creds: credsAfter, draft, heist: null },
    });
  },
}));

// Post-outcome handler (called after mutations set an outcome). The player
// stays on the heist screen — a HeistEndOverlay renders on top while the
// final grid state remains visible underneath. The actual transition (to
// draft, to character select, to the run-end summary) is triggered by the
// player via `proceedFromOutcome` once they dismiss/confirm the overlay.
function postOutcome(outcome: 'won' | 'captured' | 'trapped') {
  const state = useGameStore.getState();
  const run = state.run;
  if (!run) return;
  // Only update run.outcome (used by GameOverScreen later) — do not change
  // `screen`, do not clear heist, do not pre-build draft. Those happen in
  // proceedFromOutcome when the player explicitly continues.
  if (outcome === 'captured' || outcome === 'trapped') {
    useGameStore.setState({ run: { ...run, outcome: 'caught' } });
    return;
  }
  if (outcome === 'won' && run.nodeIndex === TOTAL_NODES - 1) {
    useGameStore.setState({ run: { ...run, outcome: 'won' } });
  }
  // 'won' on a non-final node: leave run as-is. The overlay will show
  // "Continue to Next Job"; pressing it calls proceedFromOutcome which
  // builds the draft and transitions screen there.
}

export { TOTAL_NODES };
