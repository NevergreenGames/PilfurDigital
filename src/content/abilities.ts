import { CharacterAbility } from '../engine/types';

/*
 * PILFUR — Drafted Ability Pool
 *
 * Abilities are charge-based. Each entry has two textual fields:
 *   - `text`   : the primary mechanics line ("Spend a charge to ...").
 *                Shown most prominently on the ability card.
 *   - `flavor` : narrative line, shown muted below the trigger.
 *
 * The trigger glyph is rendered separately (derived from `trigger`).
 *
 * `maxCharges` caps the stored charges (charges accumulate from rolls;
 * activation spends one). Default is 3 across the board — set lower
 * (e.g. 1) for one-shot "press the big red button" abilities. `upgrades`
 * is run-local: every freshly drafted ability arrives with an empty
 * array, populated by upgrade-draft picks and workbench events.
 */

export const draftedAbilityPool: CharacterAbility[] = [
  // --- Sum thresholds (3) ---------------------------------------------------
  {
    id: 'cold-read',
    name: 'COLD READ',
    icon: '🧠',
    text: 'Spend a charge to reroll the entire pool.',
    flavor: 'Reads the vault from across the street.',
    cost: 10,
    trigger: { kind: 'sum', op: 'eq', value: 10, minDice: 2 },
    effect: { id: 'rerollAll', text: 'Reroll all pool dice' },
    maxCharges: 3,
    upgrades: [],
  },
  {
    id: 'fencing-the-loot',
    name: 'FENCING THE LOOT',
    icon: '💵',
    text: 'Spend a charge to shed 2 heat.',
    flavor: 'Moves the take through a trusted buyer.',
    cost: 10,
    trigger: { kind: 'sum', op: 'gte', value: 16, minDice: 2 },
    effect: { id: 'removeHeat', text: 'Remove 2 heat dice', params: { count: 2 } },
    maxCharges: 3,
    upgrades: [],
  },
  {
    id: 'crowbar-work',
    name: 'CROWBAR WORK',
    icon: '🪓',
    text: 'Spend a charge to reroll the lowest die in the pool.',
    flavor: 'When finesse fails, pry.',
    cost: 4,
    trigger: { kind: 'sum', op: 'lt', value: 3, minDice: 2 },
    effect: { id: 'rerollLowest', text: 'Reroll the lowest die' },
    maxCharges: 3,
    upgrades: [],
  },

  // --- X-of-a-kind (3) ------------------------------------------------------
  {
    id: 'palm-the-coin',
    name: 'PALM THE COIN',
    icon: '🤏',
    text: 'Spend a charge to set two dice to 1.',
    flavor: 'A little misdirection, a lighter pocket.',
    cost: 6,
    trigger: { kind: 'xOfAKind', count: 3 },
    effect: { id: 'setTwoDiceToOne', text: 'Set 2 dice to 1', requiresTarget: 'dice' },
    maxCharges: 3,
    upgrades: [],
  },
  {
    id: 'forgers-touch',
    name: "FORGER'S TOUCH",
    icon: '✒',
    text: 'Spend a charge to duplicate any pool die.',
    flavor: "A signature even the bank can't tell.",
    cost: 8,
    trigger: { kind: 'xOfAKind', count: 4 },
    effect: { id: 'duplicateDie', text: 'Duplicate a die', requiresTarget: 'die' },
    maxCharges: 3,
    upgrades: [],
  },
  {
    id: 'cased-the-joint',
    name: 'CASED THE JOINT',
    icon: '🔭',
    text: 'Spend a charge to add a d6 to the pool.',
    flavor: 'Weeks of stakeout pay off in a perfect shift.',
    cost: 7,
    trigger: { kind: 'xOfAKind', count: 5 },
    effect: { id: 'addDice', text: 'Add a d6 to the pool', params: { sizes: [6] } },
    maxCharges: 3,
    upgrades: [],
  },

  // --- Straights (2) --------------------------------------------------------
  {
    id: 'chalk-the-plan',
    name: 'CHALK THE PLAN',
    icon: '📐',
    text: 'Spend a charge to reroll selected dice.',
    flavor: 'Redraws the route after the first door sticks.',
    cost: 7,
    trigger: { kind: 'straight', length: 4 },
    effect: { id: 'rerollSelected', text: 'Reroll selected dice', requiresTarget: 'dice' },
    maxCharges: 3,
    upgrades: [],
  },
  {
    id: 'second-story-climb',
    name: 'SECOND-STORY CLIMB',
    icon: '🪜',
    text: 'Spend a charge to reroll your highest die.',
    flavor: 'Pipe, ledge, window — in that order.',
    cost: 5,
    trigger: { kind: 'straight', length: 5 },
    effect: { id: 'rerollHighest', text: 'Reroll the highest die' },
    maxCharges: 3,
    upgrades: [],
  },

  // --- Single-die / creative (4) --------------------------------------------
  {
    id: 'sweep-the-floor',
    name: 'SWEEP THE FLOOR',
    icon: '🧹',
    text: 'Spend a charge to remove every die showing 1.',
    flavor: 'Kicks the scraps under the rug.',
    cost: 5,
    trigger: { kind: 'sum', op: 'eq', value: 2, minDice: 2 },
    effect: { id: 'removeOnes', text: 'Remove all dice showing 1' },
    maxCharges: 3,
    upgrades: [],
  },
  {
    id: 'lockpick-whisper',
    name: 'LOCKPICK WHISPER',
    icon: '🔓',
    text: 'Spend a charge to set any die to its max.',
    flavor: 'One clean tumbler, then the rest fall in.',
    cost: 8,
    trigger: { kind: 'sum', op: 'gte', value: 8, minDice: 1 },
    effect: { id: 'setDieToMax', text: 'Set a die to its max', requiresTarget: 'die' },
    maxCharges: 3,
    upgrades: [],
  },
  {
    id: 'marked-card',
    name: 'MARKED CARD',
    icon: '🃏',
    text: 'Spend a charge to set any die to 3.',
    flavor: 'The right number was always coming up.',
    cost: 5,
    trigger: { kind: 'sum', op: 'eq', value: 11, minDice: 2 },
    effect: {
      id: 'setDieToValue',
      text: 'Set a die to 3',
      params: { value: 3 },
      requiresTarget: 'die',
    },
    maxCharges: 3,
    upgrades: [],
  },
  {
    id: 'bribe-the-beat',
    name: 'BRIBE THE BEAT',
    icon: '🤝',
    text: 'Spend a charge to shed 1 heat.',
    flavor: 'Three palms, one guard who forgets the face.',
    cost: 6,
    trigger: { kind: 'sum', op: 'gte', value: 15, minDice: 3 },
    effect: { id: 'removeHeat', text: 'Remove 1 heat die', params: { count: 1 } },
    maxCharges: 3,
    upgrades: [],
  },

  // --- Former character signatures, now draftable ---------------------------
  {
    id: 'backdoor',
    name: 'BACKDOOR',
    icon: '💻',
    text: 'Spend a charge to set a pool die to its max.',
    flavor: 'Rigs a back channel into any system.',
    cost: 8,
    trigger: { kind: 'xOfAKind', count: 3 },
    effect: { id: 'setDieToMax', text: 'Set a die to its max', requiresTarget: 'die' },
    maxCharges: 3,
    upgrades: [],
  },
  {
    id: 'shapedCharge',
    name: 'SHAPED CHARGE',
    icon: '💣',
    text: 'Spend a charge to reroll every die in the pool.',
    flavor: 'Blows the door clean off.',
    cost: 9,
    trigger: { kind: 'sum', op: 'gte', value: 12, minDice: 2 },
    effect: { id: 'rerollAll', text: 'Reroll all pool dice' },
    maxCharges: 3,
    upgrades: [],
  },
  {
    id: 'steadyHand',
    name: 'STEADY HAND',
    icon: '🎯',
    text: 'Spend a charge to remove 2 heat.',
    flavor: 'Does the hard work calmly, even under the lights.',
    cost: 9,
    trigger: { kind: 'straight', length: 4 },
    effect: { id: 'removeHeat', text: 'Remove 2 heat dice', params: { count: 2 } },
    maxCharges: 3,
    upgrades: [],
  },
];
