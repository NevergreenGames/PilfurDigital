import { HeistTarget } from '../engine/types';

export const TARGETS: HeistTarget[] = [
  {
    id: 'prisonBreak',
    name: 'PRISON BREAK',
    tier: 1,
    requirement: { kind: 'sum', op: 'lt', value: 10, minDice: 5 },
    momentumDice: [6, 6, 6],
    flavor: 'Five names on the list. Nobody gets left behind.',
  },
  {
    id: 'vaultOfGold',
    name: 'VAULT OF GOLD',
    tier: 1,
    requirement: { kind: 'xOfAKind', count: 5 },
    momentumDice: [6, 6, 6],
    flavor: 'Dumb, heavy, and exactly as advertised.',
  },
  {
    id: 'artGallery',
    name: 'ART GALLERY',
    tier: 2,
    requirement: { kind: 'sum', op: 'eq', value: 15, minDice: 4 },
    momentumDice: [6, 6, 20],
    flavor: 'The forgery is on the wall by morning.',
  },
  {
    id: 'crownJewels',
    name: 'CROWN JEWELS',
    tier: 2,
    requirement: { kind: 'sum', op: 'gte', value: 20 },
    momentumDice: [6, 6, 20],
    flavor: 'Every country wants them. None deserve them.',
  },
  {
    id: 'theMoon',
    name: 'THE MOON',
    tier: 3,
    requirement: { kind: 'sum', op: 'gte', value: 25 },
    momentumDice: [6, 6, 6, 20],
    flavor: 'A metaphor. Also literal.',
  },
  {
    id: 'alienRelic',
    name: 'ALIEN RELIC',
    tier: 3,
    requirement: { kind: 'xOfAKind', count: 4 },
    momentumDice: [20, 20],
    flavor: 'Nobody knows what it does. The buyer has cash.',
  },
];

export function getTargetsByTier(tier: 1 | 2 | 3): HeistTarget[] {
  return TARGETS.filter((t) => t.tier === tier);
}
