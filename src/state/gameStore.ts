import { create } from 'zustand';
import {
  AbilityChargeEvent,
  AbilityImpactEvent,
  AbilityUpgrade,
  ActiveEvent,
  CharacterAbility,
  Die,
  DraftOption,
  EventChoice,
  EventReward,
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
import { createDie, rollValue } from '../engine/dice';
import { findSatisfyingSubset, isSubsetSatisfying } from '../engine/requirements';
import {
  applyEffect,
  effectiveAbility,
  hasUpgrade,
} from '../engine/effects';
import { RARE_ABILITY_POOL } from '../content/events';
import { unlockAchievement } from './achievements';
import {
  getAbilities,
  getCharacters,
  getEvents,
  getPhaseCards,
  getRig,
  getRigs,
  getTargets,
  getTargetsByTier,
} from './contentRegistry';
import { markCharacterCompleted } from './progress';
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

// Greedy auto-pick for the Demolitionist's BREACH path: finds a minimal-
// count subset of rolled pool dice whose values sum to >= `minSum`. Sorts
// by descending value so the player spends the fewest dice possible —
// matching the "fewest dice that satisfy" intent of findSatisfyingSubset.
// Returns null if even spending every rolled die can't reach the threshold.
function findSubsetWithMinSum(dice: Die[], minSum: number): Die[] | null {
  const rolled = dice.filter((d) => d.value !== null);
  const sorted = [...rolled].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const out: Die[] = [];
  let acc = 0;
  for (const d of sorted) {
    if (acc >= minSum) break;
    out.push(d);
    acc += d.value ?? 0;
  }
  return acc >= minSum ? out : null;
}

function sumDice(dice: Die[]): number {
  let acc = 0;
  for (const d of dice) acc += d.value ?? 0;
  return acc;
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
    // Sum the heat dice that fulfilled this tile — recorded onto the tile
    // so the Demolitionist's BREACH passive can later gate a reclaim
    // attempt. Reserved dice are guaranteed to have rolled values at this
    // point (intents are computed against rolled heat); guard with `?? 0`
    // anyway to keep the math defensive.
    const heatClaimSum = intent.reservedDice.reduce(
      (acc, d) => acc + (d.value ?? 0),
      0,
    );
    gridNext = setTile(gridNext, intent.tileId, {
      state: 'heatFulfilled',
      heatClaimSum,
    });
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
    // Resolve the upgrade overlay so reduceRequirement upgrades shrink
    // the trigger and increaseMaxCharges raises the clamp cap.
    const eff = effectiveAbility(ability);
    const subset = findSatisfyingSubset(pool, eff.trigger);
    if (!subset) continue;
    const before = charges[ability.id] ?? 0;
    if (before >= eff.maxCharges) {
      // Already at cap — no charge gained, no event emitted (the player
      // shouldn't see a pop animation for a charge they didn't actually
      // get). The ability is still considered "charged" elsewhere.
      continue;
    }
    charges[ability.id] = Math.min(eff.maxCharges, before + 1);
    gained.push(ability.name);
    events.push({
      abilityId: ability.id,
      abilityName: ability.name,
      satisfyingDiceIds: subset.map((d) => d.id),
    });
  }
  return { charges, gained, events };
}

// Apply an EventReward to a working copy of the heist + run mutables.
// Returns the new mutables plus a list of log lines to surface in the UI.
function applyEventReward(
  reward: EventReward | undefined,
  pool: Die[],
  heat: Die[],
  creds: number,
  abilities: CharacterAbility[],
): {
  pool: Die[];
  heat: Die[];
  creds: number;
  abilities: CharacterAbility[];
  log: string[];
} {
  let nextPool = pool;
  let nextHeat = heat;
  let nextCreds = creds;
  let nextAbilities = abilities;
  const log: string[] = [];
  if (!reward) return { pool: nextPool, heat: nextHeat, creds: nextCreds, abilities: nextAbilities, log };
  if (reward.creds && reward.creds !== 0) {
    nextCreds = nextCreds + reward.creds;
    log.push(`💰 +¢${reward.creds}.`);
  }
  if (reward.poolDie) {
    nextPool = [
      ...nextPool,
      { ...createDie(reward.poolDie, 'stash'), value: null },
    ];
    log.push(`✨ Gained a d${reward.poolDie}.`);
  }
  if (reward.ghostDie) {
    nextPool = [
      ...nextPool,
      { ...createDie(reward.ghostDie, 'ghost'), value: null },
    ];
    log.push(`👻 Ghost d${reward.ghostDie} grafted onto the pool.`);
  }
  if (reward.removeHeat && reward.removeHeat > 0) {
    const removeN = Math.min(nextHeat.length, reward.removeHeat);
    if (removeN > 0) {
      nextHeat = nextHeat.slice(0, nextHeat.length - removeN);
      log.push(`❄ −${removeN} heat.`);
    }
  }
  if (reward.rareAbility) {
    const ownedIds = new Set(nextAbilities.map((a) => a.id));
    const candidates = RARE_ABILITY_POOL.filter((a) => !ownedIds.has(a.id));
    if (candidates.length > 0) {
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      nextAbilities = [...nextAbilities, picked];
      log.push(`✦ Acquired ${picked.name}.`);
    } else {
      // Already own every rare — fall back to a creds payout so the slot
      // isn't a dud.
      nextCreds = nextCreds + 6;
      log.push(`✦ No rare tools to spare — +¢6 instead.`);
    }
  }
  return { pool: nextPool, heat: nextHeat, creds: nextCreds, abilities: nextAbilities, log };
}

// Cred costs for each upgrade kind on the draft. Tuned to be a touch
// cheaper than buying a fresh ability so the upgrade slot feels like
// a deliberate alternative rather than a dud.
const UPGRADE_COST: Record<AbilityUpgrade['kind'], number> = {
  increaseMaxCharges: 5,
  startWithCharge: 6,
  extraTarget: 7,
  reduceRequirement: 8,
};

// Build a single upgrade-card option for an owned ability. The chosen
// upgrade kind is biased toward upgrades that actually apply: e.g. a
// `extraTarget` only matters for target-needing abilities, so it's only
// offered when the base effect takes targets.
function makeUpgradeOptionFor(
  ability: CharacterAbility,
): { kind: 'upgrade'; abilityId: string; upgrade: AbilityUpgrade; cost: number } | null {
  // Pool the upgrade kinds that make sense for this ability.
  const candidates: AbilityUpgrade[] = [];
  // Always sensible — every ability accumulates charges.
  candidates.push({ kind: 'increaseMaxCharges', by: 1 });
  // Always sensible — primed-on-entry is a flat win.
  candidates.push({ kind: 'startWithCharge' });
  // Reducing the trigger always helps unless it's already at the floor.
  // We don't bother checking the floor here — `applyRequirementReductions`
  // clamps, so the worst case is a no-op upgrade. Still, mostly useful.
  candidates.push({ kind: 'reduceRequirement', by: 1 });
  // Only meaningful when the effect needs target dice.
  const targetMin =
    ability.effect.requiresTarget === 'die' ||
    ability.effect.requiresTarget === 'dice';
  if (targetMin) {
    candidates.push({ kind: 'extraTarget', by: 1 });
  }
  if (candidates.length === 0) return null;
  const upgrade = candidates[Math.floor(Math.random() * candidates.length)];
  return {
    kind: 'upgrade',
    abilityId: ability.id,
    upgrade,
    cost: UPGRADE_COST[upgrade.kind],
  };
}

function buildAbilityDraft(
  owned: CharacterAbility[],
  creds: number,
): DraftOption[] {
  const ownedIds = new Set(owned.map((a) => a.id));
  const draftPool = getAbilities();
  const available = draftPool.filter((a) => !ownedIds.has(a.id));
  const DRAFT_SIZE = 3;

  // Pick the new-ability options first using the same affordability-biased
  // logic as before. We then optionally swap one slot for an upgrade
  // option when the player owns at least one ability — keeps the draft
  // mix interesting once the player has a roster to maintain.
  const affordable = available.filter((a) => a.cost <= creds);
  const unaffordable = available.filter((a) => a.cost > creds);

  let abilityPicks: CharacterAbility[] = [];
  if (available.length >= DRAFT_SIZE) {
    if (affordable.length >= 2) {
      const twoAffordable = randomPick(affordable, 2);
      const remainingPool = available.filter(
        (a) => !twoAffordable.some((p) => p.id === a.id),
      );
      const third = randomPick(remainingPool, 1);
      abilityPicks = shuffle([...twoAffordable, ...third]);
    } else if (affordable.length === 1) {
      const filler = randomPick(unaffordable, 2);
      abilityPicks = shuffle([...affordable, ...filler]);
    } else {
      abilityPicks = randomPick(available, DRAFT_SIZE);
    }
  } else {
    const uniques = shuffle(available);
    const filler = randomPick(draftPool, DRAFT_SIZE - uniques.length);
    abilityPicks = [...uniques, ...filler];
  }

  const newAbilityOptions: DraftOption[] = abilityPicks.map((a) => ({
    kind: 'newAbility',
    ability: a,
  }));

  // Offer an upgrade slot in 2-of-3 layout when the player owns ≥ 1
  // ability AND has at least one ownable upgrade to apply. The first
  // draft (no abilities yet) stays purely new-ability so the player
  // has something to upgrade later.
  if (owned.length === 0) return newAbilityOptions;

  // Pick a random owned ability and roll an upgrade for it. Bail if
  // the random target somehow has no candidates (shouldn't happen with
  // current logic, but defensive).
  const subject = owned[Math.floor(Math.random() * owned.length)];
  const upgradeOption = makeUpgradeOptionFor(subject);
  if (!upgradeOption) return newAbilityOptions;

  // Replace one slot (random) with the upgrade option — the result is a
  // 2 new + 1 upgrade mix in arbitrary order.
  const swapIdx = Math.floor(Math.random() * newAbilityOptions.length);
  const result = [...newAbilityOptions];
  result[swapIdx] = upgradeOption;
  return result;
}

function buildFreshHeist(
  run: RunState,
  target: HeistTarget,
  nodeIndex: number,
): HeistState {
  const grid = generateGrid(nodeIndex, getPhaseCards(), getTargets(), getEvents());
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
  // Characters add their dice to the starting pool of every heist.
  // (Schema today only supports a single startingDie per character;
  // when the schema grows to `startingDice: DieSize[]`, materialize
  // the full list here.) A fresh character die is minted on every
  // node — character dice can be consumed like any other die now,
  // so they don't carry across heists.
  const charDice: Die[] = [
    {
      ...createDie(run.characterDie, 'character', run.character.id),
      value: null,
    },
  ];
  // Default starting pool: character die(s) + a fresh d6.
  // Priority order:
  //   1. Veteran's CARRYOVER passive — when the run carries a stashedPool
  //      from the previous heist, use that. The passive is the whole
  //      point of the character; it overrides the rig.
  //   2. Rig starting dice — the player's chosen loadout reseeds the
  //      pool every heist. SILENCE re-injects 4 ghost d4s on each new
  //      job so the rig isn't a "first job only" perk. Fresh `Die`
  //      instances are minted per heist so ids stay unique.
  //   3. Default — a lone fresh d6 (used by rigs that supply no
  //      starting dice and characters without a stashed pool).
  const keepsMomentum =
    run.character.passive.id === 'keepMomentumBetweenHeists';
  // Rig starting dice flagged with source 'heat' route into the heat tray
  // instead of the pool — a "go in loud" archetype that tacks extra heat
  // onto the first heist on top of the level-scaled baseline. Everything
  // else goes into the pool as before.
  const rigPoolDice = run.rigStartingDice.filter((d) => d.source !== 'heat');
  const rigHeatDice = run.rigStartingDice.filter((d) => d.source === 'heat');
  const carriedDice: Die[] = (() => {
    if (keepsMomentum && run.stashedPool.length > 0) {
      return run.stashedPool.map((d) => ({ ...d, value: null }));
    }
    if (rigPoolDice.length > 0) {
      return rigPoolDice.map((d) => ({
        ...createDie(d.size, d.source, d.sourceId),
        value: null,
      }));
    }
    return [{ ...createDie(6, 'stash'), value: null }];
  })();
  // Heat scales by level. Level 1 (nodeIndex 0) → 2 heat dice;
  // Level 5 (nodeIndex 4) → 6 heat dice. Plus any rig-supplied heat dice
  // (only consumed on the first heist, since rigStartingDice is cleared
  // after).
  const heatCount = nodeIndex + 2;
  const heat: Die[] = [];
  for (let i = 0; i < heatCount; i += 1) {
    heat.push({ ...createDie(6, 'heat'), value: null });
  }
  for (const d of rigHeatDice) {
    heat.push({ ...createDie(d.size, 'heat'), value: null });
  }
  // Reveal fog around the start tile so the player can see their immediate
  // neighbors on the playable grid above the porch.
  const gridRevealed = revealFogAround(grid, grid.start);
  return {
    grid: gridRevealed,
    player: grid.start,
    pool: [...charDice, ...carriedDice],
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
    activeEvent: null,
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
  // CharacterSelect commits a character but defers the actual run-init
  // until the player picks a rig. Stashes pendingCharacterId on
  // GameState and routes to 'rigSelect'.
  selectCharacterForRig: (characterId: string) => void;
  // Cancel the rig-select flow — clears pendingCharacterId and routes
  // back to characterSelect.
  cancelRigSelect: () => void;
  // Final commit: build the run with the chosen character + rig and
  // route to the map.
  initRun: (characterId: string, rigId?: string) => void;
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
  /**
   * End the current turn, then roll fresh.
   *
   * `skipHeatResolution` — when true, pending heat intents do NOT fire
   * this turn. Reserved heat dice flow back into the heat tray to reroll
   * afresh; no tiles get heat-fulfilled. Used by Demolitionist's
   * AFTERSHOCK: heat can't claim tiles on turns the player claims one.
   */
  reroll: (opts?: { skipHeatResolution?: boolean }) => void;
  endTurn: () => void;
  activateAbility: (abilityId: string) => void;

  /** Open the event modal for an adjacent revealed "?" tile. No-op if the
   * tile isn't an event or isn't adjacent. */
  openEvent: (tileId: TileId) => void;
  /** Apply the chosen branch of the active event. `params.dieIds` carries
   * the player's pool selection (for payDie / opposeRoll / thresholdRoll);
   * `params.abilityId` is the ability being sacrificed for payAbility. */
  resolveEventChoice: (
    choiceId: string,
    params?: { dieIds?: string[]; abilityId?: string },
  ) => void;
  /** Dismiss the event modal without consuming the tile. */
  closeEvent: () => void;

  chooseDraft: (optionIndex: number) => void;
  /** Apply an upgrade to an owned ability on RunState. Push-only — the
   * upgrade is appended to the matching ability's `upgrades` array and
   * resolved via `effectiveAbility` everywhere it's read. */
  upgradeAbility: (abilityId: string, upgrade: AbilityUpgrade) => void;
  skipDraft: () => void;
  continueToNextNode: () => void;
  proceedFromOutcome: () => void;
}

const initialState: GameState = { screen: 'title' as Screen, run: null };

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  ui: initialUI,

  setScreen: (screen) => set({ screen }),

  selectCharacterForRig: (characterId) => {
    const character = getCharacters().find((c) => c.id === characterId);
    if (!character) return;
    set({ screen: 'rigSelect', pendingCharacterId: characterId });
  },

  cancelRigSelect: () => {
    set({ screen: 'characterSelect', pendingCharacterId: undefined });
  },

  initRun: (characterId, rigId = 'standard') => {
    const character = getCharacters().find((c) => c.id === characterId);
    if (!character) return;
    // Look up the rig — fall back to the first rig in the catalogue if
    // the requested id is unknown (defensive: keeps a stale dev-tool
    // call from no-op'ing the run).
    const rig = getRig(rigId) ?? getRigs()[0];
    // Materialize the rig's starting dice now (each created with a
    // unique id) so they can be slotted into the first heist's pool by
    // buildFreshHeist. Stored unrolled — the auto-roll on heist entry
    // produces fresh values.
    const rigStartingDice: Die[] = rig.startingDice.flatMap((spec) =>
      Array.from({ length: spec.count }, () => ({
        ...createDie(spec.size, spec.source),
        value: null,
      })),
    );
    const run: RunState = {
      character,
      rigId: rig.id,
      rigStartingDice,
      characterDie: character.startingDie,
      // Characters no longer ship with a signature ability — their unique
      // edge is the always-on passive. Abilities are acquired exclusively
      // through the between-heist draft.
      abilities: [],
      abilityCharges: {},
      creds: rig.startingGold,
      stashedPool: [],
      heat: [],
      nodeIndex: 0,
      map: buildMap(),
      heist: null,
      draft: null,
    };
    set({ screen: 'map', run, ui: initialUI, pendingCharacterId: undefined });
  },

  selectCharacter: (characterId) => {
    // Legacy entry point — preserved for any back-compat callers (tutorial,
    // dev tools). Routes through the new rig-select flow rather than
    // jumping straight into the run.
    get().selectCharacterForRig(characterId);
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
    // `startWithCharge` upgrade: when entering a heist with 0 charges,
    // the ability begins primed at 1. Walks every owned ability and
    // bumps any that match. Abilities already carrying charges from a
    // previous heist are left alone — the upgrade only seeds, it
    // doesn't top off. Capped at 1, never above the ability's
    // effective maxCharges.
    const seededCharges: Record<string, number> = { ...run.abilityCharges };
    for (const a of run.abilities) {
      if (!hasUpgrade(a.upgrades, 'startWithCharge')) continue;
      if ((seededCharges[a.id] ?? 0) > 0) continue;
      const eff = effectiveAbility(a);
      seededCharges[a.id] = Math.min(1, eff.maxCharges);
    }
    set({
      screen: 'heist',
      run: { ...run, heist, map: nextMap, abilityCharges: seededCharges },
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
    if (!isAdjacent(heist.player, tile.pos)) {
      set({ ui: { ...state.ui, message: 'Tile is not adjacent.' } });
      return;
    }

    // Demolitionist BREACH: heat-fulfilled phase tiles can be reclaimed by
    // spending pool dice whose values sum to >= the heat that claimed the
    // tile (stamped on the tile by resolveHeatIntents). No rewards are
    // paid; the only effect is converting the tile to playerFulfilled so
    // it becomes walkable. Target tiles are excluded — heat capturing the
    // target is already game-over.
    if (
      tile.state === 'heatFulfilled' &&
      run.character.passive.id === 'reclaimHeatTilesByDiceSum' &&
      tile.kind !== 'target' &&
      tile.heatClaimSum !== undefined
    ) {
      const minSum = tile.heatClaimSum;
      const manual = heist.pool.filter((d) =>
        state.ui.selectedDiceIds.includes(d.id) && d.value !== null,
      );
      let breachDice: Die[];
      if (manual.length > 0) {
        if (sumDice(manual) < minSum) {
          set({
            ui: {
              ...state.ui,
              message: `Selected dice sum ${sumDice(manual)}, need ≥ ${minSum} to breach.`,
            },
          });
          return;
        }
        breachDice = manual;
      } else {
        const auto = findSubsetWithMinSum(heist.pool, minSum);
        if (!auto) {
          set({
            ui: {
              ...state.ui,
              message: `Pool can't sum to ≥ ${minSum}. Roll harder.`,
            },
          });
          return;
        }
        breachDice = auto;
      }
      const consumedSet = new Set(breachDice.map((d) => d.id));
      // Ghost dice fade on this fulfillment as they would on any other.
      const ghostsInPool = heist.pool.filter((d) => d.source === 'ghost');
      const burnedGhostCount = ghostsInPool.filter(
        (d) => !consumedSet.has(d.id),
      ).length;
      const breachLog = [
        ...heist.log,
        `💣 BREACH: cracked ${tile.card?.name ?? 'tile'} for ${sumDice(breachDice)} (≥ ${minSum}).`,
      ];
      if (burnedGhostCount > 0) {
        breachLog.push(
          `👻 ${burnedGhostCount} ghost ${burnedGhostCount === 1 ? 'die' : 'dice'} faded.`,
        );
      }
      const remainingPool = heist.pool
        .filter((d) => !consumedSet.has(d.id))
        .filter((d) => d.source !== 'ghost');
      const fulfilledGrid = setTile(heist.grid, tile.id, {
        state: 'playerFulfilled',
      });
      const newPlayer = tile.pos;
      const grid = revealFogAround(fulfilledGrid, newPlayer);
      breachLog.push(`Moved to (${newPlayer.row}, ${newPlayer.col}).`);
      let outcome: HeistState['outcome'] = heist.outcome;
      if (!outcome) outcome = detectOutcome(grid, newPlayer);
      const consumedSnapshot = breachDice.map((d) => ({ ...d }));
      set({
        run: {
          ...run,
          heist: {
            ...heist,
            grid,
            player: newPlayer,
            pool: remainingPool,
            lastPlayerFulfill: {
              tileId: tile.id,
              tileName: tile.card?.name ?? 'tile',
              consumedDice: consumedSnapshot,
              gainedSizes: [],
              movedTo: newPlayer,
            },
            log: breachLog,
            outcome: outcome ?? null,
          },
        },
        ui: { ...state.ui, selectedDiceIds: [], message: null },
      });
      if (outcome) {
        postOutcome(outcome);
        return;
      }
      // Reclaiming is an action that ends the turn. AFTERSHOCK doesn't
      // apply to the Demolitionist (different passive), so heat resolves
      // as normal on the chained reroll.
      get().reroll({});
      return;
    }

    if (tile.state !== 'revealed' || !isUnfulfilled(tile)) {
      set({ ui: { ...state.ui, message: 'Tile is not a valid fulfill target.' } });
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

    // Consume selected dice. Character dice are no longer special — they
    // leave the pool just like stash dice when used.
    const selectedIds = new Set(selected.map((d) => d.id));
    // Ghost dice burn on every fulfillment, whether or not they were used.
    // Count the survivors (ghosts left in the pool that didn't make it
    // into `selected`) so we can log how many faded — and so the player
    // sees their power surge expire visibly.
    const ghostsInPool = heist.pool.filter((d) => d.source === 'ghost');
    const burnedGhostCount = ghostsInPool.filter(
      (d) => !selectedIds.has(d.id),
    ).length;
    const remainingPool = heist.pool
      .filter((d) => !selectedIds.has(d.id))
      .filter((d) => d.source !== 'ghost');

    // Push tile momentum dice to pool unrolled.
    const gained: Die[] = (tileCard.momentumDice ?? []).map((size) => ({
      ...createDie(size, 'phase', tileCard.id),
      value: null,
    }));
    let pool = [...remainingPool, ...gained];
    let heat = heist.heat;
    const log = [...heist.log, `✔ ${tileCard.name} fulfilled.`];
    if (burnedGhostCount > 0) {
      log.push(
        `👻 ${burnedGhostCount} ghost ${burnedGhostCount === 1 ? 'die' : 'dice'} faded.`,
      );
    }

    // Hacker's INSIDE TRACK passive: every phase tile fulfilled adds a
    // fresh d6 to the pool (unrolled — gets rolled by the chained reroll).
    // Skipped on target tiles since the heist ends and there's no further
    // roll to consume the die.
    const isPhaseFulfill = tile.kind !== 'target';
    const grantsBonusD6 =
      isPhaseFulfill &&
      run.character.passive.id === 'bonusD6OnPhaseFulfill';
    if (grantsBonusD6) {
      pool = [...pool, { ...createDie(6, 'stash'), value: null }];
      log.push(`💻 Inside track: +d6 to pool.`);
    }

    // Phantom's EVERY DOOR TWICE passive: every phase fulfillment grafts
    // two ghost d4s onto the pool. They roll with the chained reroll and
    // then evaporate on the next fulfillment regardless of use — short
    // surge, then fade.
    const grantsGhostDice =
      isPhaseFulfill &&
      run.character.passive.id === 'ghostDiceOnPhaseFulfill';
    if (grantsGhostDice) {
      pool = [
        ...pool,
        { ...createDie(4, 'ghost'), value: null },
        { ...createDie(4, 'ghost'), value: null },
      ];
      log.push(`👻 Every door twice: +2 ghost d4s.`);
    }

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

    // Character dice no longer level up on max — they're consumed like
    // stash dice. The next heist's buildFreshHeist will mint a fresh
    // character die from `run.characterDie` (which is set at run-init
    // and never changes).

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
      // Demolitionist's AFTERSHOCK: heat can't claim tiles on turns the
      // player claims one. Reserved-heat-die intents are dissolved and the
      // heat dice come back to be rerolled with the rest.
      const skipHeatResolution =
        run.character.passive.id === 'noHeatFulfillOnPhaseFulfill';
      get().reroll({ skipHeatResolution });
    }
  },

  // Reroll == End Turn + Roll. Resolves all pending heat intents (locking
  // tiles, generating new heat from gained dice), advances the turn, then
  // rolls the pool fresh and adds a fresh d6 to heat (heat goes up by +1
  // d6 every roll). Pool gets no automatic bonus die — that lever is now
  // owned by the Hacker's INSIDE TRACK passive (added on phase fulfill).
  // `skipHeatResolution` honors the Demolitionist's AFTERSHOCK: heat
  // intents are dissolved (no tiles claimed by heat this turn) and the
  // reserved dice flow back into the heat tray to reroll fresh.
  reroll: (opts) => {
    const skipHeatResolution = opts?.skipHeatResolution ?? false;
    const state = get();
    const run = state.run;
    if (!run?.heist) return;
    const heist = run.heist;
    if (heist.outcome) return;

    // Step 1 — End-turn resolution: heat intents fire.
    const resolveLog = [...heist.log, `— end of turn ${heist.turn} —`];
    const resolved = skipHeatResolution
      ? {
          // AFTERSHOCK: heat does not claim a tile this turn. Each
          // intent's reserved dice are returned to the heat tray (they'll
          // reroll in step 3), and gainedSizes are dropped — they only
          // mattered if the intent had fired.
          grid: heist.grid,
          heat: [
            ...heist.heat,
            ...heist.heatIntents.flatMap((it) => it.reservedDice),
          ],
          log:
            heist.heatIntents.length > 0
              ? [
                  ...resolveLog,
                  `AFTERSHOCK: heat could not claim a tile (${heist.heatIntents.length} intent${heist.heatIntents.length === 1 ? '' : 's'} dissolved).`,
                ]
              : resolveLog,
          capturedOnTarget: false,
        }
      : resolveHeatIntents(
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

    // Step 2 — Fresh roll. Pool always rerolls. Heat rerolls and gains a
    // fresh d6 every turn (AFTERSHOCK no longer freezes heat — it dissolves
    // pending intents instead, handled in step 1 above).
    const pool = rollAll(heist.pool);
    let heat: Die[] = rollAll(resolved.heat);
    const newHeatDie: Die = { ...createDie(6, 'heat'), value: rollValue(6) };
    heat = [...heat, newHeatDie];

    const log = [
      ...resolved.log,
      `Reroll: rolled ${pool.length} pool + ${heat.length} heat dice (+1 d6 to heat).`,
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
    const rerolledDieIds: string[] = [];
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
      // Reroll handlers report the exact ids whose values changed —
      // pipe these through to the UI so they shake.
      if (res.rerolledIds && res.rerolledIds.length > 0) {
        rerolledDieIds.push(...res.rerolledIds);
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
      rerolledDieIds,
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

  openEvent: (tileId) => {
    const state = get();
    const run = state.run;
    if (!run?.heist) return;
    const heist = run.heist;
    if (heist.outcome) return;
    if (heist.activeEvent) return;
    const tile = findTileById(heist.grid, tileId);
    if (!tile || tile.kind !== 'event' || !tile.eventDef) return;
    if (tile.state !== 'revealed') return;
    if (!isAdjacent(heist.player, tile.pos)) {
      set({ ui: { ...state.ui, message: 'Tile is not adjacent.' } });
      return;
    }
    // Pre-roll any opposing dice on opposeRoll choices so the player sees
    // exactly what they're up against before committing.
    const opposingRolls: Record<string, number[]> = {};
    for (const choice of tile.eventDef.choices) {
      if (choice.kind === 'opposeRoll' && choice.opposingDice) {
        opposingRolls[choice.id] = choice.opposingDice.map((s) => rollValue(s));
      }
    }
    const activeEvent: ActiveEvent = {
      tileId: tile.id,
      def: tile.eventDef,
      opposingRolls: Object.keys(opposingRolls).length > 0 ? opposingRolls : undefined,
    };
    set({
      run: {
        ...run,
        heist: { ...heist, activeEvent },
      },
      ui: { ...state.ui, selectedDiceIds: [], message: null },
    });
  },

  closeEvent: () => {
    // Closing the modal without picking is equivalent to "walk away" —
    // both consume the tile and end the turn (no cost, no reward).
    const active = get().run?.heist?.activeEvent;
    if (!active) return;
    consumeEventTileAndEndTurn(get, set, 'Walked past');
  },

  resolveEventChoice: (choiceId, params) => {
    const state = get();
    const run = state.run;
    if (!run?.heist) return;
    const heist = run.heist;
    if (heist.outcome) return;
    const active = heist.activeEvent;
    if (!active) return;
    const choice: EventChoice | undefined = active.def.choices.find(
      (c) => c.id === choiceId,
    );
    if (!choice) return;

    // Walk-away choice — same shape as closing the modal: consume the
    // tile and end the turn, but log the explicit walk-away pick.
    if (choice.kind === 'walkAway') {
      consumeEventTileAndEndTurn(get, set, 'Walked away from');
      return;
    }

    // Working copies — choice cost mutates these before reward.
    let pool = [...heist.pool];
    let heat = heist.heat;
    let creds = run.creds;
    let abilities = run.abilities;
    let abilityCharges = run.abilityCharges;
    let outcomeWinSide: 'win' | 'lose' = 'win';
    const log: string[] = [];

    switch (choice.kind) {
      case 'payCreds': {
        const cost = choice.creds ?? 0;
        if (creds < cost) {
          set({ ui: { ...state.ui, message: 'Not enough creds.' } });
          return;
        }
        creds = creds - cost;
        log.push(`Paid ¢${cost}.`);
        break;
      }
      case 'payDie': {
        const dieId = params?.dieIds?.[0];
        const die = dieId ? pool.find((d) => d.id === dieId) : undefined;
        if (!die || (choice.dieSize !== undefined && die.size !== choice.dieSize)) {
          set({ ui: { ...state.ui, message: `Pick a d${choice.dieSize ?? '?'} from your pool.` } });
          return;
        }
        pool = pool.filter((d) => d.id !== dieId);
        log.push(`Spent a d${die.size}.`);
        break;
      }
      case 'payAbility': {
        const abilityId = params?.abilityId;
        const ability = abilityId ? abilities.find((a) => a.id === abilityId) : undefined;
        if (!ability) {
          set({ ui: { ...state.ui, message: 'Pick an ability to sacrifice.' } });
          return;
        }
        abilities = abilities.filter((a) => a.id !== abilityId);
        // Drop any accumulated charges for the sacrificed ability.
        if (abilityCharges[abilityId!] !== undefined) {
          const next = { ...abilityCharges };
          delete next[abilityId!];
          abilityCharges = next;
        }
        log.push(`Traded away ${ability.name}.`);
        break;
      }
      case 'opposeRoll': {
        const dieIds = params?.dieIds ?? [];
        const selected = pool.filter((d) => dieIds.includes(d.id) && d.value !== null);
        if (selected.length === 0) {
          set({ ui: { ...state.ui, message: 'Select dice to roll against the lock.' } });
          return;
        }
        const playerSum = selected.reduce((acc, d) => acc + (d.value ?? 0), 0);
        const opposing = active.opposingRolls?.[choiceId] ?? [];
        const oppSum = opposing.reduce((acc, v) => acc + v, 0);
        outcomeWinSide = playerSum >= oppSum ? 'win' : 'lose';
        log.push(
          `Roll: ${playerSum} vs ${oppSum} — ${outcomeWinSide === 'win' ? 'win.' : 'lose.'}`,
        );
        break;
      }
      case 'upgradeAbility': {
        const cost = choice.creds ?? 0;
        if (creds < cost) {
          set({ ui: { ...state.ui, message: 'Not enough creds.' } });
          return;
        }
        const upg = choice.upgrade;
        if (!upg) {
          set({ ui: { ...state.ui, message: 'Choice is missing its upgrade.' } });
          return;
        }
        const targetAbilityId = params?.abilityId;
        const target = targetAbilityId
          ? abilities.find((a) => a.id === targetAbilityId)
          : undefined;
        if (!target) {
          set({ ui: { ...state.ui, message: 'Pick an ability to upgrade.' } });
          return;
        }
        creds = creds - cost;
        abilities = abilities.map((a) =>
          a.id === targetAbilityId
            ? { ...a, upgrades: [...(a.upgrades ?? []), upg] }
            : a,
        );
        log.push(`🛠 Upgraded ${target.name}.`);
        if (cost > 0) log.push(`Paid ¢${cost}.`);
        break;
      }
      case 'thresholdRoll': {
        const dieId = params?.dieIds?.[0];
        const die = dieId ? pool.find((d) => d.id === dieId) : undefined;
        const threshold = choice.threshold ?? 0;
        if (!die || die.value === null) {
          set({ ui: { ...state.ui, message: 'Pick a rolled die from your pool.' } });
          return;
        }
        if (die.value < threshold) {
          set({ ui: { ...state.ui, message: `That die isn't high enough (need ≥ ${threshold}).` } });
          return;
        }
        // The chosen die is consumed regardless of reward.
        pool = pool.filter((d) => d.id !== dieId);
        log.push(`Burnt a d${die.size} showing ${die.value}.`);
        break;
      }
      default:
        return;
    }

    // Apply outcome (reward on win / non-roll choices, penalty on a lost roll).
    const useReward = outcomeWinSide === 'win';
    const applied = applyEventReward(
      useReward ? choice.reward : choice.penalty,
      pool,
      heat,
      creds,
      abilities,
    );
    pool = applied.pool;
    heat = applied.heat;
    creds = applied.creds;
    abilities = applied.abilities;
    log.push(...applied.log);

    // Mark the tile consumed (treated as walkable terrain afterward).
    const tile = findTileById(heist.grid, active.tileId);
    if (!tile) return;
    const grid = setTile(heist.grid, tile.id, { state: 'playerFulfilled' });

    // Player walks onto the consumed tile and reveals fog around it.
    const newPlayer = tile.pos;
    const revealed = revealFogAround(grid, newPlayer);
    const fullLog = [
      ...heist.log,
      `★ ${active.def.title}: ${choice.label}.`,
      ...log,
      `Moved to (${newPlayer.row}, ${newPlayer.col}).`,
    ];

    let outcome: HeistState['outcome'] = heist.outcome;
    if (!outcome) outcome = detectOutcome(revealed, newPlayer);

    set({
      run: {
        ...run,
        creds,
        abilities,
        abilityCharges,
        heist: {
          ...heist,
          grid: revealed,
          player: newPlayer,
          pool,
          heat,
          activeEvent: null,
          log: fullLog,
          outcome: outcome ?? null,
        },
      },
      ui: { ...state.ui, selectedDiceIds: [], message: null },
    });
    if (outcome) {
      postOutcome(outcome);
      return;
    }
    // Resolving an event ends the turn (same as fulfilling a tile or
    // stepping). Demolitionist's AFTERSHOCK applies because the player did
    // not "step onto" a previously-cleared tile — they consumed a new one.
    const skipHeatResolution =
      run.character.passive.id === 'noHeatFulfillOnPhaseFulfill';
    get().reroll({ skipHeatResolution });
  },

  chooseDraft: (optionIndex) => {
    const run = get().run;
    if (!run?.draft) return;
    const option = run.draft[optionIndex];
    if (!option) return;
    // Two paths depending on the option kind:
    //   • newAbility — append to run.abilities, charge the ability's cost.
    //   • upgrade    — push onto the matching ability's `upgrades`, charge
    //                  the upgrade's per-kind cost.
    // Both gate on affordability — the UI also disables unaffordable
    // buttons, but the store is the source of truth.
    if (option.kind === 'newAbility') {
      if (option.ability.cost > run.creds) return;
      // Defensive: ensure the freshly drafted ability has the new
      // upgrade-system fields even if a stale content fork forgot them.
      const acquired: CharacterAbility = {
        ...option.ability,
        maxCharges: option.ability.maxCharges ?? 3,
        upgrades: option.ability.upgrades ?? [],
      };
      set({
        run: {
          ...run,
          abilities: [...run.abilities, acquired],
          creds: run.creds - option.ability.cost,
          draft: null,
        },
      });
      get().continueToNextNode();
      return;
    }
    // Upgrade option.
    if (option.cost > run.creds) return;
    const target = run.abilities.find((a) => a.id === option.abilityId);
    if (!target) {
      // The owned ability disappeared between draft assembly and pick —
      // refund the slot by clearing the draft and continuing.
      set({ run: { ...run, draft: null } });
      get().continueToNextNode();
      return;
    }
    const nextAbilities = run.abilities.map((a) =>
      a.id === option.abilityId
        ? { ...a, upgrades: [...(a.upgrades ?? []), option.upgrade] }
        : a,
    );
    set({
      run: {
        ...run,
        abilities: nextAbilities,
        creds: run.creds - option.cost,
        draft: null,
      },
    });
    get().continueToNextNode();
  },

  upgradeAbility: (abilityId, upgrade) => {
    const run = get().run;
    if (!run) return;
    const target = run.abilities.find((a) => a.id === abilityId);
    if (!target) return;
    const nextAbilities = run.abilities.map((a) =>
      a.id === abilityId
        ? { ...a, upgrades: [...(a.upgrades ?? []), upgrade] }
        : a,
    );
    set({ run: { ...run, abilities: nextAbilities } });
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
    // Veteran's CARRYOVER: snapshot the surviving pool (minus the
    // character die, which is regenerated next heist) for buildFreshHeist
    // to pick up. Stored on the run regardless of character — non-Veterans
    // simply ignore it. Strip values so the next heist's auto-roll
    // produces fresh ones.
    const stashedPool: Die[] = run.heist
      ? run.heist.pool
          .filter((d) => d.source !== 'character' && d.source !== 'ghost')
          .map((d) => ({ ...d, value: null }))
      : run.stashedPool;
    const isFinalNode = run.nodeIndex === TOTAL_NODES - 1;
    if (isFinalNode) {
      // Meta-progression: finishing the last node with this character
      // unlocks the next one in the roster on the character-select screen.
      markCharacterCompleted(run.character.id);
      // ROAD-TESTED — full-run completion. Awarded here (not in
      // detectHeistAchievements) because the achievement requires
      // knowing this is the final node, not just any winning heist.
      unlockAchievement('roadTested');
      set({ screen: 'gameOver', run: { ...run, creds: credsAfter, stashedPool } });
      return;
    }
    // Won a non-final node — go to draft for the next job.
    const draft = buildAbilityDraft(run.abilities, credsAfter);
    set({
      screen: 'draft',
      run: { ...run, creds: credsAfter, stashedPool, draft, heist: null },
    });
  },
}));

// Post-outcome handler (called after mutations set an outcome). The player
// stays on the heist screen — a HeistEndOverlay renders on top while the
// final grid state remains visible underneath. The actual transition (to
// draft, to character select, to the run-end summary) is triggered by the
// player via `proceedFromOutcome` once they dismiss/confirm the overlay.
// Shared by closeEvent + the walkAway choice in resolveEventChoice. Both
// flows skip the cost/reward step but otherwise behave like a normal
// event resolution: tile flips to playerFulfilled (walkable), the player
// moves onto it, fog reveals, and the chained reroll ends the turn.
function consumeEventTileAndEndTurn(
  getState: () => GameStore,
  setState: (partial: Partial<GameStore>) => void,
  logVerb: string,
): void {
  const state = getState();
  const run = state.run;
  if (!run?.heist) return;
  const heist = run.heist;
  if (heist.outcome) return;
  const active = heist.activeEvent;
  if (!active) return;
  const tile = findTileById(heist.grid, active.tileId);
  if (!tile) return;
  const grid = setTile(heist.grid, tile.id, { state: 'playerFulfilled' });
  const newPlayer = tile.pos;
  const revealed = revealFogAround(grid, newPlayer);
  const fullLog = [
    ...heist.log,
    `${logVerb} ${active.def.title}.`,
    `Moved to (${newPlayer.row}, ${newPlayer.col}).`,
  ];
  let outcome: HeistState['outcome'] = heist.outcome;
  if (!outcome) outcome = detectOutcome(revealed, newPlayer);
  setState({
    run: {
      ...run,
      heist: {
        ...heist,
        grid: revealed,
        player: newPlayer,
        activeEvent: null,
        log: fullLog,
        outcome: outcome ?? null,
      },
    },
    ui: { ...state.ui, selectedDiceIds: [], message: null },
  });
  if (outcome) {
    postOutcome(outcome);
    return;
  }
  // Same end-turn semantics as a fulfill — Demolitionist (Acrobat)'s
  // AFTERSHOCK / TUMBLE applies because the player consumed a tile.
  const skipHeatResolution =
    run.character.passive.id === 'noHeatFulfillOnPhaseFulfill';
  useGameStore.getState().reroll({ skipHeatResolution });
}

function postOutcome(outcome: 'won' | 'captured' | 'trapped') {
  const state = useGameStore.getState();
  const run = state.run;
  if (!run) return;
  // Achievement detection runs on every winning heist (not just the
  // run-clearing one). Done here at the moment the win is locked in so
  // the unlock sticks even if the player's session ends before they
  // dismiss the end-of-heist overlay.
  if (outcome === 'won' && run.heist) {
    detectHeistAchievements(run);
  }
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

// Achievement detection — runs once per winning heist, AFTER the engine
// has finalized the grid state but BEFORE the player dismisses the
// end-of-heist overlay. Each branch corresponds to one achievement and
// awards via unlockAchievement (idempotent). Add new branches here as
// the achievement catalogue grows. Run-level achievements that depend
// on finishing all five jobs (e.g. ROAD-TESTED) are awarded inside
// proceedFromOutcome where isFinalNode is in scope, not here.
function detectHeistAchievements(run: RunState): void {
  const heist = run.heist;
  if (!heist) return;
  // GHOST PROTOCOL — no phase tile was claimed by heat. Target tiles
  // don't count (heat-fulfilling the target is a loss outcome anyway).
  // Wall / void / event tiles can't be heat-fulfilled by construction.
  const heatClaimedAnyPhase = heist.grid.tiles.some(
    (t) => t.kind === 'phase' && t.state === 'heatFulfilled',
  );
  if (!heatClaimedAnyPhase) {
    unlockAchievement('silenceRun');
  }
  // ENDOWMENT — wallet has 10+ creds at the moment the win locks in.
  // Checked before the heist's reward payout (which lands in
  // proceedFromOutcome) so it represents the player's *carry-in* spending
  // discipline, not the cumulative bag.
  if (run.creds >= 10) {
    unlockAchievement('endowment');
  }
  // DOUBLE-EXPOSED — won a heist as THE PHANTOM. Cheap unlock for
  // anyone who plays the dimensional-shifter character at all.
  if (run.character.id === 'phantom') {
    unlockAchievement('doubleExposed');
  }
}

export { TOTAL_NODES };
