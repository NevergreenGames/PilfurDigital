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
      text: 'Consume a PAIR (2 dice with the same value) to set any other pool die to its max.',
      trigger: { kind: 'xOfAKind', count: 2 },
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
      text: 'Consume 2+ dice summing to 8 or more to reroll every die in the pool.',
      trigger: { kind: 'sum', op: 'gte', value: 8, minDice: 2 },
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
      text: 'Consume 3 dice in a row (straight of 3) to remove 2 heat dice from the escape pool.',
      trigger: { kind: 'straight', length: 3 },
      effect: { id: 'removeHeat', text: 'Remove 2 heat dice', params: { count: 2 } },
    },
  },
];

export function getCharacter(id: string): Character | undefined {
  return CHARACTERS.find((c) => c.id === id);
}
