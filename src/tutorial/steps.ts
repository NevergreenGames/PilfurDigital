import { Screen, RunState, HeistState } from '../engine/types';

export type TutorialMode =
  // Auto-advance: the step is shown until its `shouldShow` predicate
  // becomes false (e.g. the user performed the prompted action).
  | 'auto'
  // User must dismiss with a Got It button (or Esc).
  | 'info';

export interface TutorialContext {
  screen: Screen;
  run: RunState | null;
  heist: HeistState | null;
}

export interface TutorialStep {
  id: string;
  screen: Screen;
  text: string;
  // Optional CSS selector. When provided, the overlay renders a spotlight
  // around the matching element; otherwise it renders a centered modal.
  anchor?: string;
  mode: TutorialMode;
  // While this returns true (and the step isn't yet seen) the step is shown.
  // For mode='auto' steps, the gate flipping false marks the step as seen.
  shouldShow: (ctx: TutorialContext) => boolean;
}

// Predicate helpers ---------------------------------------------------------

const onScreen = (s: Screen) => (ctx: TutorialContext) => ctx.screen === s;

const heistRolled = (ctx: TutorialContext) =>
  Boolean(ctx.heist && ctx.heist.pool.some((d) => d.value !== null));

const playerHasFulfilledATile = (ctx: TutorialContext) => {
  if (!ctx.heist) return false;
  return ctx.heist.grid.tiles.some((t) => t.state === 'playerFulfilled');
};

// Steps ---------------------------------------------------------------------
// IDs are stable strings used as keys in localStorage — do not rename casually.

export const STEPS: TutorialStep[] = [
  {
    id: 'characterSelect.intro',
    screen: 'characterSelect',
    text: "Pick your crew of one. Each character starts with a unique die and an always-on passive that bends a core rule. Click a character to choose.",
    anchor: '.character-grid',
    mode: 'auto',
    shouldShow: onScreen('characterSelect'),
  },
  {
    id: 'map.intro',
    screen: 'map',
    text: "Pick the next job. Higher tiers are harder but it's still one heist at a time. Click a target to begin.",
    anchor: '.target-grid',
    mode: 'auto',
    shouldShow: onScreen('map'),
  },
  {
    id: 'heist.intro',
    screen: 'heist',
    text: "This is the score. You start at the bottom; your goal is the diamond tile. Tiles around you reveal as you approach.",
    mode: 'info',
    shouldShow: (ctx) => onScreen('heist')(ctx) && !heistRolled(ctx),
  },
  {
    id: 'heist.firstFulfillable',
    screen: 'heist',
    text: "Tiles glow GREEN when your dice can fulfill their requirement. Click a green tile to spend the dice and step onto it.",
    anchor: '.hg-tile--will-succeed',
    mode: 'info',
    shouldShow: (ctx) => {
      if (!onScreen('heist')(ctx)) return false;
      if (!ctx.heist || !heistRolled(ctx)) return false;
      if (playerHasFulfilledATile(ctx)) return false;
      // Must have at least one fulfillable tile on the board.
      return ctx.heist.grid.tiles.some(
        (t) => t.state === 'revealed' && t.kind !== 'start',
      );
    },
  },
  {
    id: 'heist.firstHeatLooming',
    screen: 'heist',
    text: "Red dice looming over a tile mean Heat will fulfill it on your next End Turn. Beat them to it — or accept the loss.",
    anchor: '.hg-loom-cluster',
    mode: 'info',
    shouldShow: (ctx) =>
      onScreen('heist')(ctx) && Boolean(ctx.heist?.heatIntents.length),
  },
  {
    id: 'heist.firstAbilityCharge',
    screen: 'heist',
    text: "Your roll satisfied this ability's trigger, so it gained a charge. Charges persist between heists. Click ACTIVATE to spend one.",
    anchor: '.hg-ability--charged',
    mode: 'info',
    shouldShow: (ctx) =>
      onScreen('heist')(ctx) &&
      Boolean(ctx.run && Object.values(ctx.run.abilityCharges).some((n) => n > 0)),
  },
  {
    id: 'heist.firstMovementReroll',
    screen: 'heist',
    text: "Movement ends your turn — stepping onto an already-cleared tile (or fulfilling a phase tile) re-rolls your dice and lets heat act.",
    anchor: '.hg-tile--movable',
    mode: 'info',
    shouldShow: (ctx) =>
      onScreen('heist')(ctx) && Boolean(ctx.heist && ctx.heist.turn >= 2),
  },
  {
    id: 'heist.firstCompass',
    screen: 'heist',
    text: "When the target or your pawn is off-screen, a compass dot appears at the edge. Click it to pan the camera.",
    anchor: '.hg-compass',
    mode: 'info',
    shouldShow: (ctx) =>
      onScreen('heist')(ctx) && Boolean(ctx.heist && ctx.heist.turn >= 1),
  },
  {
    id: 'heist.outcome.won',
    screen: 'heist',
    text: "Score! Carry the heat into the next job — or quit while you're ahead.",
    mode: 'info',
    shouldShow: (ctx) =>
      onScreen('heist')(ctx) && ctx.heist?.outcome === 'won',
  },
  {
    id: 'heist.outcome.captured',
    screen: 'heist',
    text: "Heat caught up to you. The run ends here.",
    mode: 'info',
    shouldShow: (ctx) =>
      onScreen('heist')(ctx) && ctx.heist?.outcome === 'captured',
  },
  {
    id: 'heist.outcome.trapped',
    screen: 'heist',
    text: "No path forward. The job collapses around you.",
    mode: 'info',
    shouldShow: (ctx) =>
      onScreen('heist')(ctx) && ctx.heist?.outcome === 'trapped',
  },
  {
    id: 'draft.intro',
    screen: 'draft',
    text: "Pick one ability to add for the rest of the run. Skip if none of these fit your plan.",
    anchor: '.draft-row',
    mode: 'auto',
    shouldShow: onScreen('draft'),
  },
];

