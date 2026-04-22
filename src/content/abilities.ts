import { CharacterAbility } from '../engine/types';

/*
 * PILFUR — Drafted Ability Pool
 *
 * Abilities are charge-based: when a roll produces a pool that satisfies the
 * trigger, the ability gains +1 charge. Charges persist across heists until
 * spent. Activating an ability consumes one charge and fires the effect —
 * no pool dice are consumed.
 *
 * Triggers are intentionally demanding so charges feel earned rather than
 * automatic on every roll. The trigger glyph is shown in the UI next to the
 * ability name, so the `text` field focuses on flavor + spend effect.
 */

export const draftedAbilityPool: CharacterAbility[] = [
  // --- Sum thresholds (3) ---------------------------------------------------
  {
    id: 'cold-read',
    name: 'COLD READ',
    text: 'Reads the vault from across the street. Spend a charge to reroll the entire pool.',
    trigger: { kind: 'sum', op: 'eq', value: 10, minDice: 2 },
    effect: { id: 'rerollAll', text: 'Reroll all pool dice' },
  },
  {
    id: 'fencing-the-loot',
    name: 'FENCING THE LOOT',
    text: 'Moves the take through a trusted buyer. Spend a charge to shed 2 heat.',
    trigger: { kind: 'sum', op: 'gte', value: 16, minDice: 2 },
    effect: { id: 'removeHeat', text: 'Remove 2 heat dice', params: { count: 2 } },
  },
  {
    id: 'crowbar-work',
    name: 'CROWBAR WORK',
    text: 'When finesse fails, pry. Spend a charge to reroll the lowest die in the pool.',
    trigger: { kind: 'sum', op: 'lt', value: 3, minDice: 2 },
    effect: { id: 'rerollLowest', text: 'Reroll the lowest die' },
  },

  // --- X-of-a-kind (3) ------------------------------------------------------
  {
    id: 'palm-the-coin',
    name: 'PALM THE COIN',
    text: 'A little misdirection, a lighter pocket. Spend a charge to set two dice to 1.',
    trigger: { kind: 'xOfAKind', count: 3 },
    effect: { id: 'setTwoDiceToOne', text: 'Set 2 dice to 1', requiresTarget: 'dice' },
  },
  {
    id: 'forgers-touch',
    name: "FORGER'S TOUCH",
    text: 'A signature even the bank can\'t tell. Spend a charge to duplicate any pool die.',
    trigger: { kind: 'xOfAKind', count: 4 },
    effect: { id: 'duplicateDie', text: 'Duplicate a die', requiresTarget: 'die' },
  },
  {
    id: 'cased-the-joint',
    name: 'CASED THE JOINT',
    text: 'Weeks of stakeout pay off in a perfect shift. Spend a charge to add a d6 to the pool.',
    trigger: { kind: 'xOfAKind', count: 5 },
    effect: { id: 'addDice', text: 'Add a d6 to the pool', params: { sizes: [6] } },
  },

  // --- Straights (2) --------------------------------------------------------
  {
    id: 'chalk-the-plan',
    name: 'CHALK THE PLAN',
    text: 'Redraws the route after the first door sticks. Spend a charge to reroll selected dice.',
    trigger: { kind: 'straight', length: 4 },
    effect: { id: 'rerollSelected', text: 'Reroll selected dice', requiresTarget: 'dice' },
  },
  {
    id: 'second-story-climb',
    name: 'SECOND-STORY CLIMB',
    text: 'Pipe, ledge, window — in that order. Spend a charge to reroll your highest die.',
    trigger: { kind: 'straight', length: 5 },
    effect: { id: 'rerollHighest', text: 'Reroll the highest die' },
  },

  // --- Single-die / creative (4) --------------------------------------------
  {
    id: 'sweep-the-floor',
    name: 'SWEEP THE FLOOR',
    text: 'Kicks the scraps under the rug. Spend a charge to remove every die showing 1.',
    trigger: { kind: 'sum', op: 'eq', value: 2, minDice: 2 },
    effect: { id: 'removeOnes', text: 'Remove all dice showing 1' },
  },
  {
    id: 'lockpick-whisper',
    name: 'LOCKPICK WHISPER',
    text: 'One clean tumbler, then the rest fall in. Spend a charge to set any die to its max.',
    trigger: { kind: 'sum', op: 'gte', value: 8, minDice: 1 },
    effect: { id: 'setDieToMax', text: 'Set a die to its max', requiresTarget: 'die' },
  },
  {
    id: 'marked-card',
    name: 'MARKED CARD',
    text: 'The right number was always coming up. Spend a charge to set any die to 3.',
    trigger: { kind: 'sum', op: 'eq', value: 11, minDice: 2 },
    effect: {
      id: 'setDieToValue',
      text: 'Set a die to 3',
      params: { value: 3 },
      requiresTarget: 'die',
    },
  },
  {
    id: 'bribe-the-beat',
    name: 'BRIBE THE BEAT',
    text: 'Three palms, one guard who forgets the face. Spend a charge to shed 1 heat.',
    trigger: { kind: 'sum', op: 'gte', value: 15, minDice: 3 },
    effect: { id: 'removeHeat', text: 'Remove 1 heat die', params: { count: 1 } },
  },
];
