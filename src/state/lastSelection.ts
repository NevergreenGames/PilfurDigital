/*
 * lastSelection — remembers the last committed character / rig pick so
 * the select screens can preselect the player's previous choice on
 * re-entry. Mirrors the load/persist shape of progress.ts.
 *
 * Persisted keys:
 *   characterId — set when the player CONTINUES out of CharacterSelect.
 *   rigId       — set when the player CONTINUES out of RigSelect.
 *
 * Each is independent: clearing only one is fine. Unknown ids are
 * ignored on read by the consumer (the screen falls back to its first
 * unlocked option).
 */

const STORAGE_KEY = 'pilfur:lastSelection:v1';

interface LastSelectionState {
  characterId?: string;
  rigId?: string;
}

let state: LastSelectionState = {};

function persist(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota / privacy mode — keep the in-memory copy.
  }
}

function load(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<LastSelectionState>;
    state = {
      characterId:
        typeof parsed.characterId === 'string' ? parsed.characterId : undefined,
      rigId: typeof parsed.rigId === 'string' ? parsed.rigId : undefined,
    };
  } catch {
    state = {};
  }
}

load();

export function getLastSelection(): LastSelectionState {
  return { ...state };
}

export function setLastCharacter(id: string): void {
  state = { ...state, characterId: id };
  persist();
}

export function setLastRig(id: string): void {
  state = { ...state, rigId: id };
  persist();
}
