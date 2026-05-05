export type DieSize = 4 | 6 | 8 | 10 | 12 | 20;

export const DIE_PROGRESSION: readonly DieSize[] = [4, 6, 8, 10, 12, 20] as const;

export type DieSource = 'phase' | 'character' | 'heat' | 'stash';

export interface Die {
  id: string;
  size: DieSize;
  value: number | null;
  source: DieSource;
  sourceId?: string;
}

export type RequirementOp = 'lt' | 'lte' | 'eq' | 'gte' | 'gt';

export type Requirement =
  | { kind: 'sum'; op: RequirementOp; value: number; minDice?: number }
  | { kind: 'xOfAKind'; count: number }
  | { kind: 'straight'; length: number };

export type EffectId =
  | 'rerollHighest'
  | 'rerollLowest'
  | 'rerollAll'
  | 'rerollSelected'
  | 'setDieToMax'
  | 'setDieToValue'
  | 'setTwoDiceToOne'
  | 'removeOnes'
  | 'addDice'
  | 'removeHeat'
  | 'duplicateDie';

export interface EffectSpec {
  id: EffectId;
  text: string;
  params?: Record<string, unknown>;
  requiresTarget?: 'none' | 'die' | 'dice';
}

export interface PhaseCard {
  id: string;
  name: string;
  type: 'phase' | 'goal';
  // Optional explicit emoji override. When set, TileView uses this instead
  // of the id/name-based heuristic. Goal cards inherit it from their
  // source HeistTarget; phase cards keep using the legacy id-based map.
  icon?: string;
  requirement: Requirement;
  momentumDice: DieSize[];
  onPlayEffect?: EffectSpec;
  flavor?: string;
  // When set, fulfilling this tile awards the listed creds in addition
  // to the usual side effects. Used for procedurally-placed Cache tiles
  // — optional, off-the-beaten-path bonuses placed far from the start
  // and the target.
  cacheReward?: number;
}

export interface CharacterAbility {
  id: string;
  name: string;
  // Single-glyph emoji shown on the ability card next to its name.
  icon: string;
  // Primary mechanics line. Shown most prominently on the ability card.
  // Pattern: "Spend a charge to <effect>."
  text: string;
  // Optional narrative / character-voice line. Shown muted, below the trigger.
  flavor?: string;
  // Cred cost to acquire this ability in the between-heist draft. The
  // signature ability owned at character select is free (cost is
  // ignored for character-supplied abilities).
  cost: number;
  trigger: Requirement;
  effect: EffectSpec;
}

export interface Character {
  id: string;
  name: string;
  startingDie: DieSize;
  ability: CharacterAbility;
  flavor?: string;
}

export interface HeistTarget {
  id: string;
  name: string;
  // Single-glyph emoji shown on the goal tile and on the map's target card.
  icon: string;
  tier: 1 | 2 | 3;
  // Creds awarded to the player on a successful heist. Spent in the
  // between-heist draft to buy abilities. Roughly scales with tier.
  credsReward: number;
  requirement: Requirement;
  flavor?: string;
}

export type Screen =
  | 'title'
  | 'characterSelect'
  | 'map'
  | 'heist'
  | 'draft'
  | 'gameOver';

export interface MapNode {
  index: number;
  targetChoices: HeistTarget[];
  chosenTargetId?: string;
}

// --- Grid / Heist types (new) ---

export type Position = { row: number; col: number };
export type TileKind = 'start' | 'wall' | 'phase' | 'target' | 'void';
export type TileState = 'hidden' | 'revealed' | 'playerFulfilled' | 'heatFulfilled';
export type TileId = string;
export type HeistOutcome = 'won' | 'captured' | 'trapped';

export interface Tile {
  id: TileId;
  pos: Position;
  kind: TileKind;
  state: TileState;
  card: PhaseCard | null;
  tier: 0 | 1 | 2 | 3;
}

export interface Grid {
  rows: number;
  cols: number;
  tiles: Tile[];
  start: Position;
  target: Position;
}

// Event payload emitted by rollDice / reroll so the UI can animate the
// heat-resolution sequence (rolled heat dice → tiles that got heat-filled).
// Cleared when any other action runs.
export interface HeatFillEvent {
  tileId: TileId;
  tileName: string;
  consumedIds: string[];      // heat die ids consumed by the fill
  gainedSizes: DieSize[];     // momentum dice that became new (unrolled) heat
}

// A pending heat fulfillment. Reserved on roll; either resolves on End Turn
// (tile becomes heatFulfilled, dice consumed) or cancels if the player
// preempts by fulfilling the tile themselves (dice return to heat).
export interface HeatIntent {
  tileId: TileId;
  tileName: string;
  reservedDice: Die[];        // moved out of heist.heat — held until resolution
  gainedSizes: DieSize[];     // dice that will be added to heat IF intent fires
}
export interface HeatResolution {
  rolledDice: Die[];          // snapshot of rolled heat dice BEFORE consumption
  fills: HeatFillEvent[];     // in deterministic order (tile row*7+col)
  capturedOnTarget: boolean;  // true iff the target tile was heat-fulfilled
}

// Event payload for the most-recent player fulfillment, so the UI can
// animate consumed pool dice flying to the tile before it locks as
// player-fulfilled. Cleared when the next player-action fires.
export interface PlayerFulfillEvent {
  tileId: TileId;
  tileName: string;
  consumedDice: Die[];        // snapshot (pre-consumption) — for fly animation
  gainedSizes: DieSize[];
  movedTo: Position | null;   // null when fulfilling the target (stays put)
}

// Snapshot of an ability activation's per-die impact, so the UI can play
// an "enlarge / highlight / jiggle" animation on each die the ability
// just transformed (set to max, set to value, duplicated, etc.). Identity
// changes on every fresh activation; null after a roll/move clears it.
export interface AbilityImpactEvent {
  abilityId: string;
  abilityName: string;
  // Pool die ids the effect targeted. For batch fires this contains
  // every die that was hit; empty for non-targeted effects.
  impactedDieIds: string[];
}

// Snapshot of a single ability gaining a charge from the most recent roll.
// The UI uses this to play the pop animation on the ability card while
// simultaneously enlarging / highlighting the exact pool dice that
// satisfied the trigger — making the cause-and-effect visible. Multiple
// events on the same roll are processed sequentially (one at a time).
export interface AbilityChargeEvent {
  abilityId: string;
  abilityName: string;
  // Pool die ids that formed a subset satisfying the ability's trigger.
  satisfyingDiceIds: string[];
}

export interface HeistState {
  grid: Grid;
  player: Position;
  pool: Die[];
  heat: Die[];                 // unreserved heat dice
  heatIntents: HeatIntent[];   // pending heat fulfillments (looming over tiles)
  hasRolledThisTurn: boolean;
  turn: number;
  outcome: HeistOutcome | null;
  log: string[];
  lastHeatResolution: HeatResolution | null;
  lastPlayerFulfill: PlayerFulfillEvent | null;
  // Charge events from the most recent roll. Replaced on every roll/reroll
  // (empty array if no abilities triggered). The UI dequeues and animates
  // them one at a time.
  lastChargeEvents: AbilityChargeEvent[];
  // Most-recent ability activation. The UI watches this for identity
  // change and plays an impact animation on the listed dice.
  lastAbilityImpact: AbilityImpactEvent | null;
}

export interface AbilityDraftOption {
  ability: CharacterAbility;
}

// Kept as alias for back-compat with any callers still using the old name.
export type DraftOption = AbilityDraftOption;

export interface RunState {
  character: Character;
  characterDie: DieSize;
  abilities: CharacterAbility[];
  // Charges accumulate every time a roll (rollDice or reroll) produces a
  // pool satisfying the ability's trigger. Charges are spent by activating
  // the ability; they persist across heists until used.
  abilityCharges: Record<string, number>;
  // The crew's wallet. Awarded on each successful heist (per-target);
  // spent in the between-heist draft to acquire new abilities.
  creds: number;
  heat: Die[];
  nodeIndex: number;
  map: MapNode[];
  heist: HeistState | null;
  draft: AbilityDraftOption[] | null;
  outcome?: 'won' | 'caught';
}

export interface GameState {
  screen: Screen;
  run: RunState | null;
}
