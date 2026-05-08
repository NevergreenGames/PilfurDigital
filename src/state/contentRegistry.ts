import {
  Character,
  CharacterAbility,
  EventDef,
  HeistTarget,
  PhaseCard,
  Rig,
} from '../engine/types';
import { PHASE_CARDS as BASE_PHASE_CARDS } from '../content/phaseCards';
import { draftedAbilityPool as BASE_ABILITIES } from '../content/abilities';
import { TARGETS as BASE_TARGETS } from '../content/targets';
import { EVENT_POOL as BASE_EVENTS } from '../content/events';
import { CHARACTERS as BASE_CHARACTERS } from '../content/characters';
import { RIGS as BASE_RIGS } from '../content/rigs';
import { STEPS as BASE_TUTORIAL, TutorialStep } from '../tutorial/steps';

/*
 * Content registry — single source of truth for the four design-tunable
 * collections (phase cards, draft abilities, heist targets, "?" events).
 *
 * The registry sits between the static base data (compiled into the bundle)
 * and every consumer (gameStore, gridGen, screens). Dev-panel edits store
 * shallow patches keyed by id; getters merge base + patch on read.
 *
 * Patches are persisted to localStorage so the next reload sees the same
 * tuned values — that's what "permanent" means in the V1 dev panel. Power
 * users can also Export/Import the patches as JSON to share or back up.
 *
 * Patches apply to NEW content surfaced after the edit (next heist
 * generation, next draft, next event open). In-flight tiles are not
 * mutated — call them "scheduled changes" rather than "live patches" so
 * we don't have to walk the active heist's grid every time the user
 * tweaks a number.
 */

export type ContentKind =
  | 'phase'
  | 'ability'
  | 'target'
  | 'event'
  | 'tutorial'
  | 'character'
  | 'rig';

// Tutorial steps' `shouldShow` is a function and can't be serialized into a
// patch; only the editable subset (screen / text / anchor / mode) is ever
// stored in the registry override map. applyPatches's shallow `{ ...base,
// ...patch }` merge naturally leaves shouldShow intact on read.
type TutorialPatch = Partial<Pick<TutorialStep, 'screen' | 'text' | 'anchor' | 'mode'>>;

interface PatchSet {
  phase: Record<string, Partial<PhaseCard>>;
  ability: Record<string, Partial<CharacterAbility>>;
  target: Record<string, Partial<HeistTarget>>;
  event: Record<string, Partial<EventDef>>;
  tutorial: Record<string, TutorialPatch>;
  character: Record<string, Partial<Character>>;
  rig: Record<string, Partial<Rig>>;
}

const STORAGE_KEY = 'pilfur:contentPatches:v1';

function emptyPatchSet(): PatchSet {
  return {
    phase: {},
    ability: {},
    target: {},
    event: {},
    tutorial: {},
    character: {},
    rig: {},
  };
}

let patches: PatchSet = emptyPatchSet();
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

function persist(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patches));
  } catch {
    // Quota / privacy mode — ignore. The session keeps the in-memory copy.
  }
}

function load(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<PatchSet>;
    patches = {
      phase: parsed.phase ?? {},
      ability: parsed.ability ?? {},
      target: parsed.target ?? {},
      event: parsed.event ?? {},
      tutorial: parsed.tutorial ?? {},
      character: parsed.character ?? {},
      rig: parsed.rig ?? {},
    };
  } catch {
    // Corrupt patch data — start fresh rather than crash on boot.
    patches = emptyPatchSet();
  }
}

// Boot-time hydrate so the very first getter call already sees overrides.
load();

function applyPatches<T extends { id: string }>(
  base: readonly T[],
  kind: keyof PatchSet,
): T[] {
  const map = patches[kind];
  return base.map((item) => {
    const p = map[item.id];
    if (!p) return item;
    return { ...item, ...(p as Partial<T>) };
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Public getters — every consumer downstream of the registry must call
// these (never import the *_POOL constants directly), otherwise patches
// won't apply.
// ───────────────────────────────────────────────────────────────────────────

export function getPhaseCards(): PhaseCard[] {
  return applyPatches(BASE_PHASE_CARDS, 'phase');
}

export function getAbilities(): CharacterAbility[] {
  return applyPatches(BASE_ABILITIES, 'ability');
}

export function getTargets(): HeistTarget[] {
  return applyPatches(BASE_TARGETS, 'target');
}

export function getEvents(): EventDef[] {
  return applyPatches(BASE_EVENTS, 'event');
}

export function getTutorialSteps(): TutorialStep[] {
  return applyPatches(BASE_TUTORIAL, 'tutorial');
}

export function getCharacters(): Character[] {
  return applyPatches(BASE_CHARACTERS, 'character');
}

export function getCharacter(id: string): Character | undefined {
  return getCharacters().find((c) => c.id === id);
}

export function getRigs(): Rig[] {
  return applyPatches(BASE_RIGS, 'rig');
}

export function getRig(id: string): Rig | undefined {
  return getRigs().find((r) => r.id === id);
}

export function getTargetsByTier(tier: 1 | 2 | 3): HeistTarget[] {
  return getTargets().filter((t) => t.tier === tier);
}

// Surface the unpatched base for the dev panel's "compare to default" view.
export function getBase(kind: ContentKind): Array<{ id: string; [k: string]: unknown }> {
  switch (kind) {
    case 'phase':
      return BASE_PHASE_CARDS as unknown as Array<{ id: string }>;
    case 'ability':
      return BASE_ABILITIES as unknown as Array<{ id: string }>;
    case 'target':
      return BASE_TARGETS as unknown as Array<{ id: string }>;
    case 'event':
      return BASE_EVENTS as unknown as Array<{ id: string }>;
    case 'tutorial':
      return BASE_TUTORIAL as unknown as Array<{ id: string }>;
    case 'character':
      return BASE_CHARACTERS as unknown as Array<{ id: string }>;
    case 'rig':
      return BASE_RIGS as unknown as Array<{ id: string }>;
  }
}

export function getMerged(kind: ContentKind): Array<{ id: string; [k: string]: unknown }> {
  switch (kind) {
    case 'phase':
      return getPhaseCards() as unknown as Array<{ id: string }>;
    case 'ability':
      return getAbilities() as unknown as Array<{ id: string }>;
    case 'target':
      return getTargets() as unknown as Array<{ id: string }>;
    case 'event':
      return getEvents() as unknown as Array<{ id: string }>;
    case 'tutorial':
      return getTutorialSteps() as unknown as Array<{ id: string }>;
    case 'character':
      return getCharacters() as unknown as Array<{ id: string }>;
    case 'rig':
      return getRigs() as unknown as Array<{ id: string }>;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Mutations — used by the dev panel to author overrides. Each writes
// through to localStorage and notifies any subscribers (so a panel
// watching the patches re-renders when a sibling save lands).
// ───────────────────────────────────────────────────────────────────────────

export function setOverride(
  kind: ContentKind,
  id: string,
  patch: Record<string, unknown>,
): void {
  const map = patches[kind] as Record<string, Record<string, unknown>>;
  map[id] = patch;
  persist();
  notify();
}

export function clearOverride(kind: ContentKind, id: string): void {
  const map = patches[kind] as Record<string, unknown>;
  delete map[id];
  persist();
  notify();
}

export function clearAllOverrides(): void {
  patches = emptyPatchSet();
  persist();
  notify();
}

export function getOverride(
  kind: ContentKind,
  id: string,
): Record<string, unknown> | null {
  const map = patches[kind] as Record<string, Record<string, unknown>>;
  return map[id] ?? null;
}

export function getAllPatches(): PatchSet {
  return JSON.parse(JSON.stringify(patches));
}

export function setAllPatches(p: PatchSet): void {
  patches = {
    phase: p.phase ?? {},
    ability: p.ability ?? {},
    target: p.target ?? {},
    event: p.event ?? {},
    tutorial: p.tutorial ?? {},
    character: p.character ?? {},
    rig: p.rig ?? {},
  };
  persist();
  notify();
}

// Subscribe / unsubscribe pair for the dev panel to react to its own
// (and any sibling-tab) edits.
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Quick metric for the dev-panel "modified" counters per tab.
export function patchCount(kind: ContentKind): number {
  return Object.keys(patches[kind]).length;
}
