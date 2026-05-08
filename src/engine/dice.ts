import { Die, DieSize, DieSource } from './types';

let dieCounter = 0;
export function nextDieId(): string {
  dieCounter += 1;
  return `d${dieCounter}`;
}

export function createDie(size: DieSize, source: DieSource, sourceId?: string): Die {
  return { id: nextDieId(), size, value: null, source, sourceId };
}

export function rollValue(size: DieSize): number {
  return Math.floor(Math.random() * size) + 1;
}

export function rollDice(dice: Die[]): Die[] {
  return dice.map((d) => ({ ...d, value: rollValue(d.size) }));
}

export function isAtMax(d: Die): boolean {
  return d.value !== null && d.value === d.size;
}

export function sum(dice: Die[]): number {
  return dice.reduce((acc, d) => acc + (d.value ?? 0), 0);
}
