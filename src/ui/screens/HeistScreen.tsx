import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore, TOTAL_NODES } from '../../state/gameStore';
import { HeatIntent, PlayerFulfillEvent, Tile } from '../../engine/types';
import { findSatisfyingSubset, isSubsetSatisfying } from '../../engine/requirements';
import { effectTargetMin } from '../../engine/effects';
import { GridView } from '../components/GridView';
import { DicePoolView } from '../components/DicePoolView';
import { HeatTrayView } from '../components/HeatTrayView';
import { AbilityListView } from '../components/AbilityListView';
import { HeatResolutionBanner } from '../components/HeatResolutionBanner';
import { DieGlyph } from '../components/DieGlyph';
import { DiceFlyOverlay, FlyingDieInstance } from '../components/DiceFlyOverlay';
import { HeistEndOverlay } from '../components/HeistEndOverlay';
import '../heist-grid.css';

const HEAT_STAGE_MS = 700;
const FLY_MS = 480;

function isWalkable(t: Tile): boolean {
  return t.kind === 'start' || t.state === 'playerFulfilled';
}

function isUnfulfilledRevealed(t: Tile): boolean {
  return t.state === 'revealed' && !!t.card;
}

export function HeistScreen() {
  const run = useGameStore((s) => s.run);
  const ui = useGameStore((s) => s.ui);
  const toggleDieSelection = useGameStore((s) => s.toggleDieSelection);
  const movePlayer = useGameStore((s) => s.movePlayer);
  const rollDiceAction = useGameStore((s) => s.rollDice);
  const playerFulfillTile = useGameStore((s) => s.playerFulfillTile);
  // `reroll` is no longer wired to a button — see hidden REROLL note below.
  // Movement / fulfillment trigger it internally via the gameStore.
  const activateAbility = useGameStore((s) => s.activateAbility);
  const proceedFromOutcome = useGameStore((s) => s.proceedFromOutcome);

  if (!run?.heist) return null;
  const { heist } = run;
  const outcome = heist.outcome;
  const isOver = !!outcome;
  const isFinalNode = run.nodeIndex === TOTAL_NODES - 1;

  const selectedDice = heist.pool.filter((d) => ui.selectedDiceIds.includes(d.id));

  // Targeted-ability flow: when the player clicks Activate on an ability whose
  // effect needs target dice, we enter a "waiting" mode. The button on that
  // ability becomes Cancel; selecting the right number of target dice
  // auto-fires the activation. Pre-selecting targets before clicking Activate
  // skips the wait entirely.
  const [waitingAbilityId, setWaitingAbilityId] = useState<string | null>(null);

  // Auto-roll on heist entry. ROLL is no longer a button — the first roll
  // fires the moment the player lands on the heist screen. Every subsequent
  // roll is implicit too (movement / fulfillment chain into a reroll).
  useEffect(() => {
    if (isOver) return;
    if (heist.hasRolledThisTurn) return;
    rollDiceAction();
  }, [heist.hasRolledThisTurn, isOver, rollDiceAction]);

  const onActivateAbility = useCallback(
    (abilityId: string) => {
      if (!run) return;
      // If the user clicks the button while waiting on this same ability,
      // it's a Cancel.
      if (waitingAbilityId === abilityId) {
        setWaitingAbilityId(null);
        return;
      }
      const ability = run.abilities.find((a) => a.id === abilityId);
      if (!ability) return;
      const min = effectTargetMin(ability.effect);
      const currentSelection = run.heist
        ? run.heist.pool.filter((d) => ui.selectedDiceIds.includes(d.id))
        : [];
      if (min > 0 && currentSelection.length < min) {
        setWaitingAbilityId(abilityId);
        return;
      }
      activateAbility(abilityId);
      setWaitingAbilityId(null);
    },
    [run, ui.selectedDiceIds, waitingAbilityId, activateAbility],
  );

  // While waiting on a targeted ability, fire as soon as the player has
  // selected enough target dice.
  useEffect(() => {
    if (!waitingAbilityId || !run) return;
    const ability = run.abilities.find((a) => a.id === waitingAbilityId);
    if (!ability) {
      setWaitingAbilityId(null);
      return;
    }
    // Bail if the ability has no charges left. Without this gate the
    // useEffect can re-fire after a successful activation (zustand
    // notifies its subscribers synchronously, ahead of the
    // setWaitingAbilityId(null) React update getting flushed) and call
    // activateAbility a second time. The second call hits the
    // "not charged" branch which still mutates state, triggering another
    // re-render — infinite loop, React error #185.
    const charges = run.abilityCharges[waitingAbilityId] ?? 0;
    if (charges <= 0) {
      setWaitingAbilityId(null);
      return;
    }
    const min = effectTargetMin(ability.effect);
    if (selectedDice.length >= min) {
      activateAbility(waitingAbilityId);
      setWaitingAbilityId(null);
    }
  }, [waitingAbilityId, selectedDice, run, activateAbility]);

  // Hover state for pool-preview: which pool dice would be consumed and which
  // dice would be added on click-to-fulfill.
  const [hoveredTile, setHoveredTile] = useState<Tile | null>(null);
  const onHoverChange = useCallback((t: Tile | null) => setHoveredTile(t), []);

  const { previewConsumedIds, previewGainedSizes } = useMemo(() => {
    if (!hoveredTile || !hoveredTile.card || hoveredTile.state !== 'revealed') {
      return { previewConsumedIds: undefined, previewGainedSizes: undefined };
    }
    // Only preview if the tile is actually fulfillable right now:
    // must be adjacent to the player.
    const dr = Math.abs(hoveredTile.pos.row - heist.player.row);
    const dc = Math.abs(hoveredTile.pos.col - heist.player.col);
    const adjacent = dr <= 1 && dc <= 1 && (dr + dc) > 0;
    if (!adjacent) return { previewConsumedIds: undefined, previewGainedSizes: undefined };

    const req = hoveredTile.card.requirement;
    let consumed: { id: string }[] | null = null;
    if (selectedDice.length > 0 && isSubsetSatisfying(selectedDice, req)) {
      consumed = selectedDice;
    } else if (selectedDice.length === 0) {
      const rolled = heist.pool.filter((d) => d.value !== null);
      consumed = findSatisfyingSubset(rolled, req);
    }
    if (!consumed) {
      return { previewConsumedIds: undefined, previewGainedSizes: undefined };
    }
    return {
      previewConsumedIds: new Set(consumed.map((d) => d.id)),
      previewGainedSizes: hoveredTile.card.momentumDice,
    };
  }, [hoveredTile, selectedDice, heist.pool, heist.player.row, heist.player.col]);

  const onTileClick = (tile: Tile) => {
    if (isOver) return;
    // Revealed-unfulfilled tile: fulfill (store auto-picks dice if none selected,
    // and also moves the player onto the tile on success).
    if (isUnfulfilledRevealed(tile)) {
      playerFulfillTile(tile.id);
      return;
    }
    // Otherwise, plain move onto walkable terrain (start or playerFulfilled).
    if (isWalkable(tile)) {
      movePlayer(tile.id);
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  // Dice-fly animation orchestration.
  //
  // Heat now reserves dice as "intents" (loom over tiles). The fly system:
  //   • forward fly — when a new intent appears, banner dice fly to the tile
  //     and arrive as looming dice (rendered by TileView while the intent
  //     persists AND `arrivedHeatIntents` includes the tileId).
  //   • reverse fly — when an intent disappears AND the tile is NOT now
  //     heatFulfilled (i.e. the player preempted, or a reroll wiped intents),
  //     looming dice fly back to the heat tray.
  //   • end-turn lock — intent disappears AND tile becomes heatFulfilled:
  //     no fly; the tile's CSS lock-in keyframe plays.
  // Player fulfill: dice fly from pool to the tile (player-incoming).
  // ────────────────────────────────────────────────────────────────────────

  const [arrivedHeatIntents, setArrivedHeatIntents] = useState<Set<string>>(new Set());
  const [pendingPlayerTile, setPendingPlayerTile] = useState<string | null>(null);
  const [flyingDice, setFlyingDice] = useState<FlyingDieInstance[]>([]);
  const prevIntentsRef = useRef<HeatIntent[]>([]);
  const lastHeatResRef = useRef<unknown>(null);
  const handledPlayerRef = useRef<PlayerFulfillEvent | null>(null);

  // Diff intents on each render to fire forward/reverse flies appropriately.
  // A "new roll" (lastHeatResolution identity change) replaces intents
  // wholesale — we forward-fly the new ones and don't reverse-fly stale ones.
  // Otherwise (preempt / end-turn), we diff and reverse-fly removed intents.
  useEffect(() => {
    const res = heist.lastHeatResolution;
    const isNewRoll = !!res && res !== lastHeatResRef.current;
    if (isNewRoll) lastHeatResRef.current = res;

    const prev = prevIntentsRef.current;
    const curr = heist.heatIntents;
    const prevByTile = new Map(prev.map((i) => [i.tileId, i] as const));
    const currTileIds = new Set(curr.map((i) => i.tileId));

    const timers: number[] = [];

    if (isNewRoll) {
      // Drop any lingering arrived flags from the previous turn — looming
      // dice from the prior generation are no longer relevant.
      setArrivedHeatIntents(new Set());
    }

    // Newly added intents — forward fly + scheduled arrival.
    // On a new roll, every current intent counts as new (we don't compare
    // identity since the underlying dice are freshly rolled).
    const added = isNewRoll
      ? curr
      : curr.filter((i) => !prevByTile.has(i.tileId));
    added.forEach((intent, i) => {
      timers.push(
        window.setTimeout(() => {
          const tileEl = document.querySelector(
            `[data-tile-id="${intent.tileId}"]`,
          ) as HTMLElement | null;
          if (!tileEl) {
            setArrivedHeatIntents((prevS) => new Set(prevS).add(intent.tileId));
            return;
          }
          const tileRect = tileEl.getBoundingClientRect();
          const flyInstances: FlyingDieInstance[] = intent.reservedDice
            .map((die): FlyingDieInstance | null => {
              // Scope to the heat banner — the same die id may also appear in
              // a looming dice cluster on a different tile, and we want the
              // fly to start from the banner specifically.
              const el = document.querySelector(
                `.hg-heat-banner [data-die-id="${die.id}"]`,
              ) as HTMLElement | null;
              if (!el) return null;
              return {
                id: `heat-fwd-${intent.tileId}-${die.id}`,
                die,
                fromRect: el.getBoundingClientRect(),
                toRect: tileRect,
                durationMs: FLY_MS,
              };
            })
            .filter((x): x is FlyingDieInstance => x !== null);

          setFlyingDice((prevF) => [...prevF, ...flyInstances]);
          timers.push(
            window.setTimeout(() => {
              setFlyingDice((prevF) =>
                prevF.filter(
                  (fd) => !flyInstances.some((fi) => fi.id === fd.id),
                ),
              );
              setArrivedHeatIntents((prevS) =>
                new Set(prevS).add(intent.tileId),
              );
            }, FLY_MS),
          );
        }, i * HEAT_STAGE_MS),
      );
    });

    // Intents that disappeared since last render. Skip on a new roll —
    // the previous generation is fully replaced, no reverse-fly is meaningful.
    const removed = isNewRoll
      ? []
      : prev.filter((i) => !currTileIds.has(i.tileId));
    removed.forEach((intent) => {
      const tile = heist.grid.tiles.find((t) => t.id === intent.tileId);
      const becameHeatLocked = tile?.state === 'heatFulfilled';

      if (becameHeatLocked) {
        // End-turn lock — looming dice vanish; CSS heat-lock keyframe plays.
        setArrivedHeatIntents((prevS) => {
          const next = new Set(prevS);
          next.delete(intent.tileId);
          return next;
        });
        return;
      }

      // Otherwise: player preempted the tile, or a reroll cancelled the
      // intent. Fly the looming dice back to the heat tray.
      const tileEl = document.querySelector(
        `[data-tile-id="${intent.tileId}"]`,
      ) as HTMLElement | null;
      const trayEl = document.querySelector('.hg-heat .hg-dice-row') as
        | HTMLElement
        | null;
      if (!tileEl || !trayEl) {
        setArrivedHeatIntents((prevS) => {
          const next = new Set(prevS);
          next.delete(intent.tileId);
          return next;
        });
        return;
      }
      const tileRect = tileEl.getBoundingClientRect();
      const trayRect = trayEl.getBoundingClientRect();
      const dieWidth = 56;
      const flyInstances: FlyingDieInstance[] = intent.reservedDice.map(
        (die, idx): FlyingDieInstance => {
          const stepX =
            intent.reservedDice.length > 1
              ? Math.min(
                  56,
                  (trayRect.width - dieWidth) /
                    Math.max(1, intent.reservedDice.length - 1),
                )
              : 0;
          const targetLeft = trayRect.left + stepX * idx;
          return {
            id: `heat-rev-${intent.tileId}-${die.id}-${Date.now()}`,
            die,
            fromRect: tileRect,
            toRect: new DOMRect(targetLeft, trayRect.top, dieWidth, dieWidth),
            durationMs: FLY_MS,
          };
        },
      );
      // Hide the looming display immediately so the fly origin reads as the
      // tile center (the looming dice are "leaving").
      setArrivedHeatIntents((prevS) => {
        const next = new Set(prevS);
        next.delete(intent.tileId);
        return next;
      });
      setFlyingDice((prevF) => [...prevF, ...flyInstances]);
      timers.push(
        window.setTimeout(() => {
          setFlyingDice((prevF) =>
            prevF.filter(
              (fd) => !flyInstances.some((fi) => fi.id === fd.id),
            ),
          );
        }, FLY_MS),
      );
    });

    prevIntentsRef.current = curr;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [heist.heatIntents, heist.grid, heist.lastHeatResolution]);

  // Player fulfill: source = pool panel (dice already gone from DOM by the
  // time we run). Target = the tile.
  useEffect(() => {
    const ev = heist.lastPlayerFulfill;
    if (!ev || ev === handledPlayerRef.current) return;
    handledPlayerRef.current = ev;

    setPendingPlayerTile(ev.tileId);

    const timers: number[] = [];
    timers.push(
      window.setTimeout(() => {
        const tileEl = document.querySelector(
          `[data-tile-id="${ev.tileId}"]`,
        ) as HTMLElement | null;
        const poolEl = document.querySelector('.hg-dice-row') as HTMLElement | null;
        if (!tileEl || !poolEl) {
          setPendingPlayerTile(null);
          return;
        }
        const tileRect = tileEl.getBoundingClientRect();
        const poolRect = poolEl.getBoundingClientRect();
        // Spread dice across the pool's width so they don't all launch from
        // the exact same point.
        const dieWidth = 56;
        const flyInstances: FlyingDieInstance[] = ev.consumedDice.map(
          (d, idx): FlyingDieInstance => {
            const stepX = ev.consumedDice.length > 1
              ? (poolRect.width - dieWidth) / (ev.consumedDice.length - 1)
              : 0;
            const fromLeft = poolRect.left + stepX * idx;
            const fromRect = new DOMRect(
              fromLeft,
              poolRect.top,
              dieWidth,
              dieWidth,
            );
            return {
              id: `player-${ev.tileId}-${d.id}`,
              die: d,
              fromRect,
              toRect: tileRect,
              durationMs: FLY_MS,
            };
          },
        );
        setFlyingDice((prev) => [...prev, ...flyInstances]);

        timers.push(
          window.setTimeout(() => {
            setFlyingDice((prev) =>
              prev.filter((fd) => !flyInstances.some((fi) => fi.id === fd.id)),
            );
            setPendingPlayerTile(null);
          }, FLY_MS),
        );
      }, 30), // tiny delay to let React's post-mutation commit land
    );

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [heist.lastPlayerFulfill]);


  const character = run.character;
  const characterDie = heist.pool.find((d) => d.source === 'character');

  // Roll nonce — a counter that increments each time the dice are rolled,
  // so DicePoolView and HeatTrayView can play their jiggle animation. We
  // tick it on heist.lastHeatResolution identity change (rollDice and
  // reroll both replace this object on every roll).
  const [rollNonce, setRollNonce] = useState(0);
  const lastRollResRef = useRef<unknown>(null);
  useEffect(() => {
    const res = heist.lastHeatResolution;
    if (res && res !== lastRollResRef.current) {
      lastRollResRef.current = res;
      setRollNonce((n) => n + 1);
    }
  }, [heist.lastHeatResolution]);

  // Charge-event queue. When a roll grants charges to multiple abilities,
  // the events are processed sequentially: one ability pops while the
  // exact pool dice that satisfied its trigger are enlarged in the pool,
  // then the next event takes over. This makes cause-and-effect visible
  // and prevents the previous "all animations at once" mush.
  const CHARGE_EVENT_MS = 1100;
  const CHARGE_EVENT_GAP_MS = 180;
  const [chargeQueue, setChargeQueue] = useState<typeof heist.lastChargeEvents>([]);
  const [currentChargeEvent, setCurrentChargeEvent] = useState<
    (typeof heist.lastChargeEvents)[number] | null
  >(null);
  const lastChargeEventsRef = useRef<unknown>(null);
  // Seed the queue from the freshly-arrived charge events.
  useEffect(() => {
    const events = heist.lastChargeEvents;
    if (events !== lastChargeEventsRef.current) {
      lastChargeEventsRef.current = events;
      if (events.length > 0) {
        // Replace any in-flight queue — a fresh roll supersedes leftover
        // events from the previous one.
        setChargeQueue(events);
      }
    }
  }, [heist.lastChargeEvents]);
  // Effect 1: dequeue the next event after a short visual gap, so the
  // hand-off between abilities reads as a separate beat instead of one
  // blob of motion. We split dequeue from end-of-event scheduling to
  // avoid the cleanup of this effect clobbering its own timeout when
  // setCurrentChargeEvent forces a re-render.
  useEffect(() => {
    if (currentChargeEvent) return;
    if (chargeQueue.length === 0) return;
    const t = window.setTimeout(() => {
      const [head, ...rest] = chargeQueue;
      setCurrentChargeEvent(head);
      setChargeQueue(rest);
    }, CHARGE_EVENT_GAP_MS);
    return () => window.clearTimeout(t);
  }, [chargeQueue, currentChargeEvent]);
  // Effect 2: while an event is in flight, count down to its end. Only
  // depends on currentChargeEvent so it isn't re-scheduled by queue
  // mutations inside effect 1.
  useEffect(() => {
    if (!currentChargeEvent) return;
    const t = window.setTimeout(() => {
      setCurrentChargeEvent(null);
    }, CHARGE_EVENT_MS);
    return () => window.clearTimeout(t);
  }, [currentChargeEvent]);

  const highlightedDieIds = useMemo(
    () => new Set(currentChargeEvent?.satisfyingDiceIds ?? []),
    [currentChargeEvent],
  );

  // Ability-impact spotlight: when activateAbility lands a transform on
  // one or more pool dice, those dice scale up + glow + jiggle for a
  // beat. We watch the lastAbilityImpact identity and hold the impacted
  // ids in local state for ~750ms.
  const ABILITY_IMPACT_MS = 750;
  const [impactedDieIds, setImpactedDieIds] = useState<Set<string>>(new Set());
  const lastImpactRef = useRef<unknown>(null);
  useEffect(() => {
    const ev = heist.lastAbilityImpact;
    if (!ev || ev === lastImpactRef.current) return;
    lastImpactRef.current = ev;
    if (ev.impactedDieIds.length === 0) return;
    setImpactedDieIds(new Set(ev.impactedDieIds));
    const t = window.setTimeout(() => {
      setImpactedDieIds(new Set());
    }, ABILITY_IMPACT_MS);
    return () => window.clearTimeout(t);
  }, [heist.lastAbilityImpact]);

  return (
    <div
      className={`hg-screen ${isOver ? `hg-screen--ended hg-screen--ended-${outcome}` : ''}`}
    >
      <div className="hg-main">
        <header className="hg-header">
          <div>
            <span className="hg-header-title">JOB {run.nodeIndex + 1}</span>
            <span className="hg-header-meta">
              {' '}
              · Turn {heist.turn} · {heist.hasRolledThisTurn ? 'rolled' : 'ready to roll'}
            </span>
          </div>
          <div className="hg-header-meta">
            <span className="creds-pill" title="Creds — spent on abilities between jobs">
              ¢ {run.creds}
            </span>{' '}
            · {character.name} · <DieGlyph size={run.characterDie} px={16} /> ·{' '}
            {run.abilities.length} ability
            {run.abilities.length === 1 ? '' : 'ies'}
          </div>
        </header>

        {ui.message && <div className="hg-message">{ui.message}</div>}

        {heist.lastHeatResolution && (
          <HeatResolutionBanner
            key={`${heist.turn}-${heist.lastHeatResolution.rolledDice.map((d) => d.id).join(',')}`}
            resolution={heist.lastHeatResolution}
          />
        )}

        <GridView
          heist={heist}
          selectedDice={selectedDice}
          onTileClick={onTileClick}
          onHoverChange={onHoverChange}
          arrivedHeatIntents={arrivedHeatIntents}
          pendingPlayerTile={pendingPlayerTile}
        />
      </div>

      <aside className="hg-sidebar">
        {/* Character */}
        <section className="hg-panel">
          <div className="hg-panel-title">Crew</div>
          <div className="hg-character">
            <div className="hg-character-portrait">
              {character.name.slice(0, 1)}
            </div>
            <div className="hg-character-info">
              <div className="hg-character-name">{character.name}</div>
              <div className="hg-character-die">
                <DieGlyph size={run.characterDie} px={18} />
                {characterDie?.value !== undefined && characterDie?.value !== null
                  ? ` · ${characterDie.value}`
                  : ' · unrolled'}
              </div>
            </div>
          </div>
        </section>

        {/* Pool */}
        <section className="hg-panel">
          <div className="hg-panel-title">Pool</div>
          <DicePoolView
            pool={heist.pool}
            selectedIds={ui.selectedDiceIds}
            onToggle={toggleDieSelection}
            disabled={isOver}
            previewConsumedIds={previewConsumedIds}
            previewGainedSizes={previewGainedSizes}
            rollNonce={rollNonce}
            highlightedDieIds={highlightedDieIds}
            impactedDieIds={impactedDieIds}
          />
        </section>

        {/* Heat */}
        <section className="hg-panel hg-heat">
          <div className="hg-panel-title">Heat</div>
          <HeatTrayView heat={heist.heat} rollNonce={rollNonce} />
        </section>

        {/* Actions panel is intentionally hidden — both ROLL and REROLL are
            now implicit. ROLL fires automatically on heist entry (see the
            useEffect below); REROLL fires whenever the player moves onto a
            walkable tile or fulfills a phase tile. The faint reroll glyph
            on adjacent walkable tiles surfaces the reroll affordance. */}

        {/* Abilities */}
        <section className="hg-panel">
          <div className="hg-panel-title">Abilities</div>
          <AbilityListView
            abilities={run.abilities}
            charges={run.abilityCharges}
            onActivate={onActivateAbility}
            waitingAbilityId={waitingAbilityId}
            selectedDiceCount={selectedDice.length}
            disabled={isOver}
            poppingAbilityId={currentChargeEvent?.abilityId ?? null}
          />
        </section>

        {/* Log */}
        <section className="hg-panel">
          <div className="hg-panel-title">Log</div>
          <div className="hg-log">
            <ol>
              {heist.log.slice(-30).map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ol>
          </div>
        </section>

        {/* Turn counter */}
        <section className="hg-panel">
          <div className="hg-turn">
            <span>Turn {heist.turn}</span>
            <span>Node {run.nodeIndex + 1} / {TOTAL_NODES}</span>
          </div>
        </section>
      </aside>

      {/* Flying-dice overlay — rendered at screen-root so it can animate
          across the entire viewport regardless of container boundaries. */}
      <DiceFlyOverlay flying={flyingDice} />

      {/* Heist-end overlay — replaces the old gameOver-screen cut. The grid
          remains visible underneath; the player can minimize this overlay
          to inspect the final board state before proceeding. */}
      {isOver && outcome && (
        <HeistEndOverlay
          outcome={outcome}
          isFinalNode={isFinalNode}
          targetName={
            heist.grid.tiles.find((t) => t.kind === 'target')?.card?.name
          }
          turnsTaken={heist.turn}
          logTail={heist.log.slice(-3)}
          onProceed={proceedFromOutcome}
        />
      )}
    </div>
  );
}
