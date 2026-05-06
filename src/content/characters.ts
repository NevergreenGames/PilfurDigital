import { Character } from '../engine/types';

export const CHARACTERS: Character[] = [
  {
    id: 'hacker',
    name: 'THE HACKER',
    startingDie: 6,
    flavor: 'Social engineer. Finds the seams nobody else sees.',
    passive: {
      id: 'bonusD6OnPhaseFulfill',
      name: 'INSIDE TRACK',
      icon: '💻',
      text: 'Add a fresh d6 to your pool whenever you fulfill a phase tile.',
      flavor: 'Each door cracked feeds the next.',
    },
  },
  {
    id: 'demolitionist',
    name: 'THE DEMOLITIONIST',
    startingDie: 4,
    flavor: "Believes there's no lock a little more noise can't open.",
    passive: {
      id: 'noHeatRerollOnPhaseFulfill',
      name: 'AFTERSHOCK',
      icon: '💣',
      text: "Heat doesn't reroll when you fulfill a phase tile — only when you step onto a cleared one.",
      flavor: "The dust hasn't settled. They can't see yet.",
    },
  },
  {
    id: 'veteran',
    name: 'THE VETERAN',
    startingDie: 10,
    flavor: 'Has seen every job go sideways. Starts ahead, grows slow.',
    passive: {
      id: 'keepMomentumBetweenHeists',
      name: 'CARRYOVER',
      icon: '🎒',
      text: 'Keep the dice in your pool from one heist to the next.',
      flavor: 'What worked last time tends to work again.',
    },
  },
  {
    id: 'phantom',
    name: 'THE PHANTOM',
    startingDie: 4,
    flavor: 'Half here, half elsewhere. Every door opens twice.',
    passive: {
      id: 'ghostDiceOnPhaseFulfill',
      name: 'EVERY DOOR TWICE',
      icon: '👻',
      text: 'Each phase tile fulfilled grafts two ghost d4s onto your pool. They fade on the next fulfillment.',
      flavor: 'Borrowed from the version of you that didn\'t blink.',
    },
  },
];

export function getCharacter(id: string): Character | undefined {
  return CHARACTERS.find((c) => c.id === id);
}
