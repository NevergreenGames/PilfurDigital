import { Die, DieSize, DieSource, DIE_PROGRESSION } from './types';

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

export function nextDieSize(current: DieSize): DieSize {
  const idx = DIE_PROGRESSION.indexOf(current);
  if (idx === -1 || idx === DIE_PROGRESSION.length - 1) return current;
  return DIE_PROGRESSION[idx + 1];
}

export function isAtMax(d: Die): boolean {
  return d.value !== null && d.value === d.size;
}

export function sum(dice: Die[]): number {
  return dice.reduce((acc, d) => acc + (d.value ?? 0), 0);
}
