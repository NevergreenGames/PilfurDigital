import { ACHIEVEMENTS } from '../content/achievements';
import { AchievementId } from '../engine/types';

/*
 * Achievements — persistent meta-progression. Each AchievementId either
 * IS unlocked (in `state.unlocked`) or isn't. Unlocks happen at game-engine
 * detection points (today: postOutcome on a heist win for the SILENCE
 * Run achievement). Used by the RigSelect screen to decide whether each
 * rig is choosable.
 *
 * Persisted to localStorage so unlocks survive reloads. Mirrors the
 * progress.ts pattern (subscribe + reset) so the dev-panel "unlock all
 * achievements" / "reset achievements" buttons can flip the in-memory
 * value and have the UI re-render live.
 */

const STORAGE_KEY = 'pilfur:achievements:v1';

interface AchievementsState {
  unlocked: string[];
}

function emptyState(): AchievementsState {
  return { unlocked: [] };
}

let state: AchievementsState = emptyState();
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

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
    const parsed = JSON.parse(raw) as Partial<AchievementsState>;
    state = {
      unlocked: Array.isArray(parsed.unlocked)
        ? parsed.unlocked.filter((s): s is string => typeof s === 'string')
        : [],
    };
  } catch {
    state = emptyState();
  }
}

load();

export function isAchievementUnlocked(id: AchievementId): boolean {
  return state.unlocked.includes(id);
}

export function getUnlockedAchievementIds(): string[] {
  return [...state.unlocked];
}

// Idempotent — a duplicate unlock call is a no-op (and won't fire a
// listener notify), which keeps consumers like a "show toast on unlock"
// hook from re-firing on every check.
export function unlockAchievement(id: AchievementId): boolean {
  if (state.unlocked.includes(id)) return false;
  state.unlocked = [...state.unlocked, id];
  persist();
  notify();
  return true;
}

// Dev-panel debug: unlock everything in the catalogue.
export function unlockAllAchievements(): void {
  state.unlocked = ACHIEVEMENTS.map((a) => a.id);
  persist();
  notify();
}

// Dev-panel debug: wipe.
export function resetAchievements(): void {
  state = emptyState();
  persist();
  notify();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
