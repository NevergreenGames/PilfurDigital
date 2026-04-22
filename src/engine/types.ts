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
  | 'heistPlanning'
  | 'heistExecution'
  | 'heistEscape'
  | 'draft'
  | 'gameOver';

export type PhaseSlotStatus =
  | 'pending'
  | 'active'
  | 'fulfilled'
  | 'failed'
  | 'flashbacked';

export interface PhaseSlot {
  slotId: string;
  card: PhaseCard;
  status: PhaseSlotStatus;
  assignedDice: Die[];
  flashbackCardId?: string;
}

export interface MapNode {
  index: number;
  targetChoices: HeistTarget[];
  chosenTargetId?: string;
}

export interface DraftOption {
  newCard: PhaseCard;
  pairedDeckCardId: string;
}

export interface HeistState {
  target: HeistTarget;
  hand: PhaseCard[];
  planned: PhaseSlot[];
  targetSlot: PhaseSlot;
  activeSlotIndex: number;
  pool: Die[];
  hasRolled: boolean;
  hasRolledEscape: boolean;
  needsFlashbackResolution: boolean;
  escapeComplications: PhaseSlot[];
  heatCatches: Record<string, string[]> | null;
  log: string[];
}

export interface RunState {
  character: Character;
  characterDie: DieSize;
  deck: PhaseCard[];
  heat: Die[];
  stash: Die[];
  nodeIndex: number;
  map: MapNode[];
  heist: HeistState | null;
  draft: DraftOption[] | null;
  outcome?: 'won' | 'caught';
}

export interface GameState {
  screen: Screen;
  run: RunState | null;
}
