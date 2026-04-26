import { Character } from '../engine/types';

export const CHARACTERS: Character[] = [
  {
    id: 'hacker',
    name: 'THE HACKER',
    startingDie: 6,
    flavor: 'Social engineer. Finds the seams nobody else sees.',
    ability: {
      id: 'backdoor',
      name: 'BACKDOOR',
      text: 'Spend a charge to set a pool die to its max.',
      flavor: 'Rigs a back channel into any system.',
      trigger: { kind: 'xOfAKind', count: 3 },
      effect: { id: 'setDieToMax', text: 'Set a die to its max', requiresTarget: 'die' },
    },
  },
  {
    id: 'demolitionist',
    name: 'THE DEMOLITIONIST',
    startingDie: 4,
    flavor: "Believes there's no lock a little more noise can't open.",
    ability: {
      id: 'shapedCharge',
      name: 'SHAPED CHARGE',
      text: 'Spend a charge to reroll every die in the pool.',
      flavor: 'Blows the door clean off.',
      trigger: { kind: 'sum', op: 'gte', value: 12, minDice: 2 },
      effect: { id: 'rerollAll', text: 'Reroll all pool dice' },
    },
  },
  {
    id: 'veteran',
    name: 'THE VETERAN',
    startingDie: 10,
    flavor: 'Has seen every job go sideways. Starts ahead, grows slow.',
    ability: {
      id: 'steadyHand',
      name: 'STEADY HAND',
      text: 'Spend a charge to remove 2 heat.',
      flavor: 'Does the hard work calmly, even under the lights.',
      trigger: { kind: 'straight', length: 4 },
      effect: { id: 'removeHeat', text: 'Remove 2 heat dice', params: { count: 2 } },
    },
  },
];

export function getCharacter(id: string): Character | undefined {
  return CHARACTERS.find((c) => c.id === id);
}
