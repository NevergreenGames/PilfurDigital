import { CHARACTERS } from '../content/characters';

/*
 * Progress — persistent meta-progression tracked across runs.
 *
 * Currently tracks the set of unlocked character ids. The first character
 * in CHARACTERS is unlocked by default; each later character unlocks once
 * the player completes (wins) a run with the immediately-prior character.
 *
 * Persisted to localStorage so unlocks survive reloads. The dev panel can
 * also force-unlock everyone (for testing) or wipe progress.
 */

const STORAGE_KEY = 'pilfur:progress:v1';

interface ProgressState {
  // Character ids the player has finished a run with. Used to derive the
  // unlock set: a character is unlocked if it's first, or if the prior
  // character appears in this set.
  completedCharacters: string[];
}

function emptyProgress(): ProgressState {
  return { completedCharacters: [] };
}

let state: ProgressState = emptyProgress();
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

function persist(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota / privacy mode — ignore. The session keeps the in-memory copy.
  }
}

function load(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<ProgressState>;
    const ids = Array.isArray(parsed.completedCharacters)
      ? parsed.completedCharacters.filter((s): s is string => typeof s === 'string')
      : [];
    // Migration: the original 'demolitionist' was renamed to 'acrobat' when
    // the new Demolitionist (BREACH passive) took over the slot. Persisted
    // saves containing the old id need their entry mapped onto the new id
    // so the unlock chain still resolves correctly.
    const migrated = ids.map((id) => (id === 'demolitionist' ? 'acrobat' : id));
    if (migrated.some((id, i) => id !== ids[i])) {
      state = { completedCharacters: migrated };
      persist();
    } else {
      state = { completedCharacters: ids };
    }
  } catch {
    state = emptyProgress();
  }
}

load();

// The first character in the CHARACTERS array is always free; later
// characters require completing the prior one in order. Returns ids in
// CHARACTERS-order so the select screen can show locked slots in place.
export function getUnlockedCharacterIds(): string[] {
  const out: string[] = [];
  for (let i = 0; i < CHARACTERS.length; i += 1) {
    if (i === 0) {
      out.push(CHARACTERS[i].id);
      continue;
    }
    const prev = CHARACTERS[i - 1].id;
    if (state.completedCharacters.includes(prev)) {
      out.push(CHARACTERS[i].id);
    }
  }
  return out;
}

export function isCharacterUnlocked(id: string): boolean {
  return getUnlockedCharacterIds().includes(id);
}

// Returns the prior character (the one that must be completed first), or
// null when this character is the first in the chain (always unlocked).
export function getUnlockPrerequisite(id: string): string | null {
  const idx = CHARACTERS.findIndex((c) => c.id === id);
  if (idx <= 0) return null;
  return CHARACTERS[idx - 1].id;
}

// Mark a character as having completed a run. No-op if already recorded.
export function markCharacterCompleted(id: string): void {
  if (state.completedCharacters.includes(id)) return;
  state.completedCharacters = [...state.completedCharacters, id];
  persist();
  notify();
}

// Dev-panel debug: unlock everyone by recording every character as
// completed (every prerequisite is then satisfied).
export function unlockAllCharacters(): void {
  state.completedCharacters = CHARACTERS.map((c) => c.id);
  persist();
  notify();
}

// Dev-panel debug: wipe progress back to the starting state.
export function resetProgress(): void {
  state = emptyProgress();
  persist();
  notify();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
