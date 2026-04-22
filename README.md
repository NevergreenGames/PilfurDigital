# Pilfur Digital

Solo roguelike adaptation of the tabletop dice-heist game Pilfur. Five sequential jobs, one getaway. Built as a data-driven engine so new cards, characters, and abilities are small data edits — not code rewrites.

## Run it

```bash
# one-time: install Node.js LTS (https://nodejs.org), then
npm install
npm run dev
```

Opens at http://localhost:5173.

## Project layout

```
src/
  engine/
    types.ts         All core types (Die, Card, Requirement, Effect spec, etc.)
    dice.ts          Die creation, rolling, progression (d4 → d6 → ... → d20)
    requirements.ts  Evaluates phase/ability requirements against dice
    effects.ts       Data-driven effect runtime (reroll, setToMax, addDice, ...)
  content/
    phaseCards.ts    Phase card definitions (ported from the CSV)
    characters.ts    Characters + their dice-triggered abilities
    targets.ts       Heist targets, tiered 1–3 across map nodes
  state/
    gameStore.ts     Zustand store: screen routing + game flow transitions
  ui/
    components/      DieView, PhaseCardView
    screens/         Character select · Map · Planning · Execution · Escape · Draft · Game over
```

## How the pieces fit

- A **card** declares a `requirement` (sum, x-of-a-kind, straight) and `momentumDice` it contributes. Optionally an `onPlayEffect` that fires once when the card goes active in execution.
- A **character** has a starting die size and one **ability**: a `trigger` (same requirement shape as a card) and an `effect`. Player selects dice matching the trigger → ability consumes them → effect applies.
- An **effect** is a small typed spec (`{ id, text, params }`) that `engine/effects.ts` knows how to apply. Adding a new effect = one new handler in the `handlers` map plus a spec reference from a card/ability.
- The **character die** lives in the shared pool for the whole heist (created once at heist start). Each phase's roll rerolls the entire pool. If the character die lands on its max, the die size permanently increases one step (up to d20) and the new size takes effect on the next reroll.
- The **pool grows over the heist**. When you advance past a phase, every die currently assigned to a slot returns to the pool (to be rerolled next phase with that phase's new momentum dice added). Slot statuses are preserved. Dice not placed on anything at end-of-phase become heat (1 heat d6 each). The character die never becomes heat — it always stays in the pool.
- **Between heists**: heat carries over, unused private stash carries over, character level persists. Then you get a draft: pick one of three "new-card-for-old-card" swaps.

## What's in v1

- Full loop: character select → 5-node map → planning → execution → escape → draft → next node → game over (won or caught).
- 3 characters: Hacker (d6 / pair → set max), Demolitionist (d4 / sum≥8 → reroll all), Veteran (d10 / 3-straight → remove heat).
- 22 phase cards (the CSV set + a few extras for draft variety).
- 6 targets across 3 tiers.
- Manual dice selection for slot assignment and ability activation.
- Character die level-up fires immediately when a max is rolled.

## Total Bust + flashbacks

Total Bust fails the current phase **and** all prior phase cards (including previously fulfilled ones — their dice return to the pool as "unused", per tabletop). You draw one card per newly-failed phase, then enter a flashback opportunity.

In flashback mode you can:
1. Pick a card from your hand.
2. Select dice from the pool that satisfy the **new** card's requirement.
3. Click any failed phase to play the flashback on it — the failed phase is covered, and the flashback card's momentum dice are added to your private stash (rolled at escape).

When you click **CONTINUE**, any unused pool dice become heat (1 heat d6 each) and execution moves to the next phase.

The same flashback flow also runs after a successful phase whose leftover dice didn't cover a prior pending phase — those priors become failed and you get the same opportunity to rescue them.

## Known v1 simplifications

- **On-play effect targeting** is currently auto-resolved (e.g. `rerollHighest` just picks the highest). Interactive targeting UI would slot into the same selection pipeline used for ability activation.

## Adding a new ability / effect

1. Add a case to the `EffectId` union in `engine/types.ts`.
2. Add a handler to the `handlers` map in `engine/effects.ts`.
3. Reference it from a card's `onPlayEffect` or a character's `ability.effect`.

No state-machine changes required — the runtime dispatches on `spec.id`.

## Adding a new card / character / target

Just append an entry to the relevant file in `content/`. Types will enforce the shape.
