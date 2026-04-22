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
  requirement: Requirement;
  momentumDice: DieSize[];
  onPlayEffect?: EffectSpec;
  flavor?: string;
}

export interface CharacterAbility {
  id: string;
  name: string;
  text: string;
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
  tier: 1 | 2 | 3;
  requirement: Requirement;
  momentumDice: DieSize[];
  flavor?: string;
}

export type Screen =
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
export type TileKind = 'start' | 'wall' | 'phase' | 'target';
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
  rows: 7;
  cols: 7;
  tiles: Tile[];
  start: Position;
  target: Position;
}

export interface HeistState {
  grid: Grid;
  player: Position;
  pool: Die[];
  heat: Die[];
  hasRolledThisTurn: boolean;
  turn: number;
  outcome: HeistOutcome | null;
  log: string[];
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
