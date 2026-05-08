import { Character } from '../engine/types';

export const CHARACTERS: Character[] = [
  {
    id: 'hacker',
    name: 'THE HACKER',
    icon: '🧑‍💻',
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
    id: 'acrobat',
    name: 'THE ACROBAT',
    icon: '🤸',
    startingDie: 4,
    flavor: "Two steps ahead, three steps off-beat. Never where the dust settles.",
    passive: {
      id: 'noHeatFulfillOnPhaseFulfill',
      name: 'TUMBLE',
      icon: '🌀',
      text: "Heat doesn't claim tiles as long as you keep claiming tiles.",
      flavor: 'They keep watching where you were. You keep moving.',
    },
  },
  {
    id: 'veteran',
    name: 'THE VETERAN',
    icon: '🎖️',
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
    icon: '🥷',
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
  {
    id: 'demolitionist',
    name: 'THE DEMOLITIONIST',
    icon: '🧨',
    startingDie: 6,
    flavor: "Believes there's no lock a little more noise can't open.",
    passive: {
      id: 'reclaimHeatTilesByDiceSum',
      name: 'BREACH',
      icon: '💣',
      text: 'Spend dice summing ≥ the heat that claimed a tile to break the lock and walk through. No rewards — just the door.',
      flavor: 'Whatever they sealed, you can unseal louder.',
    },
  },
];

export function getCharacter(id: string): Character | undefined {
  return CHARACTERS.find((c) => c.id === id);
}
