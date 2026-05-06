import { CharacterAbility, EventDef } from '../engine/types';

/*
 * PILFUR — Event ("?") Tile Pool
 *
 * Each EventDef drives a narrative pop-up surfaced when the player triggers
 * a "?" tile. Choices map onto a small mechanic vocabulary (pay creds,
 * sacrifice a specific die, sacrifice an ability, oppose-roll, threshold
 * check). gameStore.resolveEventChoice handles the actual mutations; this
 * file is pure data.
 */

export const EVENT_POOL: EventDef[] = [
  {
    id: 'chrome-fence',
    title: 'CHROME FENCE',
    flavor:
      "Chrome fingers slide a velvet case open. \"Quality stock. New, unburned. Drop the creds.\"",
    choices: [
      {
        id: 'buy-d8',
        kind: 'payCreds',
        label: 'BUY A D8',
        creds: 4,
        costLabel: '¢ 4',
        rewardLabel: '+d8',
        reward: { poolDie: 8 },
      },
      {
        id: 'buy-d10',
        kind: 'payCreds',
        label: 'BUY A D10',
        creds: 8,
        costLabel: '¢ 8',
        rewardLabel: '+d10',
        reward: { poolDie: 10 },
      },
      {
        id: 'walk',
        kind: 'walkAway',
        label: 'WALK AWAY',
      },
    ],
  },
  {
    id: 'data-burn',
    title: 'DATA BURN',
    flavor:
      'Server fans scream behind blackmarket cabling. "Wipe a record from the grid. Cheap. Discreet."',
    choices: [
      {
        id: 'wipe-1',
        kind: 'payCreds',
        label: 'WIPE ONE',
        creds: 3,
        costLabel: '¢ 3',
        rewardLabel: '−1 heat',
        reward: { removeHeat: 1 },
      },
      {
        id: 'wipe-2',
        kind: 'payCreds',
        label: 'WIPE TWO',
        creds: 6,
        costLabel: '¢ 6',
        rewardLabel: '−2 heat',
        reward: { removeHeat: 2 },
      },
      {
        id: 'walk',
        kind: 'walkAway',
        label: 'WALK AWAY',
      },
    ],
  },
  {
    id: 'drone-patrol',
    title: 'DRONE PATROL',
    flavor:
      'Mirror visors. Two drones hum a half-step apart. "Identify. Beat their lock or burn for it."',
    choices: [
      {
        id: 'beat-roll',
        kind: 'opposeRoll',
        label: 'BEAT THE LOCK',
        opposingDice: [8, 8],
        hint: 'Sum your selected pool dice ≥ their roll.',
        rewardLabel: '−2 heat',
        reward: { removeHeat: 2 },
        penalty: { removeHeat: 0 },
      },
      {
        id: 'bribe',
        kind: 'payCreds',
        label: 'PAY THE TOLL',
        creds: 5,
        costLabel: '¢ 5',
        rewardLabel: '−2 heat',
        reward: { removeHeat: 2 },
      },
      {
        id: 'walk',
        kind: 'walkAway',
        label: 'WALK AWAY',
      },
    ],
  },
  {
    id: 'datajack',
    title: 'DATAJACK',
    flavor:
      'An offered cable, slick with sweat. "Plug in. Prove your dice are sharp."',
    choices: [
      {
        id: 'jack-high',
        kind: 'thresholdRoll',
        label: 'PROVE IT',
        threshold: 8,
        hint: 'Spend a die showing 8 or higher.',
        costLabel: '−die ≥ 8',
        rewardLabel: '+d12',
        reward: { poolDie: 12 },
      },
      {
        id: 'jack-low',
        kind: 'thresholdRoll',
        label: 'WHISPER IN',
        threshold: 5,
        hint: 'Spend a die showing 5 or higher.',
        costLabel: '−die ≥ 5',
        rewardLabel: '+d8',
        reward: { poolDie: 8 },
      },
      {
        id: 'walk',
        kind: 'walkAway',
        label: 'WALK AWAY',
      },
    ],
  },
  {
    id: 'vending-archangel',
    title: 'VENDING ARCHANGEL',
    flavor:
      'A cracked vending shrine. The slot blinks slow and red. "INSERT D6."',
    choices: [
      {
        id: 'insert-d6',
        kind: 'payDie',
        label: 'FEED THE SLOT',
        dieSize: 6,
        costLabel: '−d6',
        rewardLabel: '+¢ 5',
        reward: { creds: 5 },
      },
      {
        id: 'insert-d8',
        kind: 'payDie',
        label: 'OFFER A D8',
        dieSize: 8,
        costLabel: '−d8',
        rewardLabel: '+¢ 9',
        reward: { creds: 9 },
      },
      {
        id: 'walk',
        kind: 'walkAway',
        label: 'WALK AWAY',
      },
    ],
  },
  {
    id: 'phantom-cache',
    title: 'PHANTOM CACHE',
    flavor:
      'A discarded deck still warm from a netrunner\'s gloves. "Borrow it. It\'ll fade with the next score, but tonight it shoots straight."',
    choices: [
      {
        id: 'borrow-d8',
        kind: 'payCreds',
        label: 'BORROW A GHOST D8',
        creds: 2,
        costLabel: '¢ 2',
        rewardLabel: '+👻d8',
        hint: 'Ghost dice fade on the next fulfillment.',
        reward: { ghostDie: 8 },
      },
      {
        id: 'borrow-d12',
        kind: 'payCreds',
        label: 'BORROW A GHOST D12',
        creds: 5,
        costLabel: '¢ 5',
        rewardLabel: '+👻d12',
        hint: 'Ghost dice fade on the next fulfillment.',
        reward: { ghostDie: 12 },
      },
      {
        id: 'walk',
        kind: 'walkAway',
        label: 'WALK AWAY',
      },
    ],
  },
  {
    id: 'the-fixer',
    title: 'THE FIXER',
    flavor:
      "She wipes a tool clean on a grease cloth. \"Old toy for new. Mine's better. One time only.\"",
    choices: [
      {
        id: 'trade-up',
        kind: 'payAbility',
        label: 'MAKE THE TRADE',
        hint: 'Sacrifice an owned ability.',
        costLabel: '−ability',
        rewardLabel: '+rare',
        reward: { rareAbility: true },
      },
      {
        id: 'walk',
        kind: 'walkAway',
        label: 'WALK AWAY',
      },
    ],
  },
];

// Rare abilities — only obtainable through "?" tile events (THE FIXER).
// Never appear in the between-heist draft. Always free in cred terms (the
// price was the sacrificed ability).
export const RARE_ABILITY_POOL: CharacterAbility[] = [
  {
    id: 'mainframe-crash',
    name: 'MAINFRAME CRASH',
    icon: '🛰',
    text: 'Spend a charge to wipe every heat die.',
    flavor: 'Bigger they are, harder they fall offline.',
    cost: 0,
    trigger: { kind: 'sum', op: 'gte', value: 25, minDice: 4 },
    // count: 99 leans on the existing removeHeat handler's
    // slice(0, max(0, len - count)) → empties the heat tray.
    effect: { id: 'removeHeat', text: 'Wipe all heat dice', params: { count: 99 } },
  },
];
