import { create } from 'zustand';
import {
  Die,
  DieSize,
  GameState,
  HeistState,
  HeistTarget,
  MapNode,
  PhaseCard,
  PhaseSlot,
  RunState,
  Screen,
} from '../engine/types';
import { createDie, nextDieSize, rollValue } from '../engine/dice';
import { findSatisfyingSubset, isSubsetSatisfying } from '../engine/requirements';
import { applyEffect } from '../engine/effects';
import { PHASE_CARDS } from '../content/phaseCards';
import { CHARACTERS } from '../content/characters';
import { getTargetsByTier } from '../content/targets';

const STARTING_DECK_SIZE = 12;
const STARTING_HAND_SIZE = 5;
const TOTAL_NODES = 5;

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function randomPick<T>(arr: T[], count: number): T[] {
  return shuffle(arr).slice(0, count);
}

function buildStartingDeck(): PhaseCard[] {
  const pool = PHASE_CARDS.filter((c) => c.type === 'phase');
  const picks: PhaseCard[] = [];
  const shuffled = shuffle(pool);
  for (let i = 0; i < STARTING_DECK_SIZE; i += 1) {
    const base = shuffled[i % shuffled.length];
    picks.push({ ...base, id: `${base.id}#${i}` });
  }
  return picks;
}

function buildMap(): MapNode[] {
  const nodes: MapNode[] = [];
  for (let i = 0; i < TOTAL_NODES; i += 1) {
    const tier: 1 | 2 | 3 = i < 2 ? 1 : i < 4 ? 2 : 3;
    const options = getTargetsByTier(tier);
    const choices = options.length >= 2 ? randomPick(options, 2) : options;
    nodes.push({
      index: i,
      targetChoices: choices.map((t, j) => ({ ...t, id: `${t.id}#${i}-${j}` })),
    });
  }
  return nodes;
}

function makePhaseSlot(card: PhaseCard, idx: number): PhaseSlot {
  return { slotId: `slot-${idx}-${card.id}`, card, status: 'pending', assignedDice: [] };
}

function rollAll(pool: Die[]): Die[] {
  return pool.map((d) => ({ ...d, value: rollValue(d.size) }));
}

function applyLevelUp(
  pool: Die[],
  currentSize: DieSize,
): { pool: Die[]; newSize: DieSize; leveled: boolean } {
  const charAtMax = pool.find(
    (d) => d.source === 'character' && d.value !== null && d.value === d.size,
  );
  if (!charAtMax) return { pool, newSize: currentSize, leveled: false };
  const next = nextDieSize(currentSize);
  if (next === currentSize) return { pool, newSize: currentSize, leveled: false };
  const newPool = pool.map((d) => (d.id === charAtMax.id ? { ...d, size: next } : d));
  return { pool: newPool, newSize: next, leveled: true };
}

function buildHeist(
  target: HeistTarget,
  deck: PhaseCard[],
  characterDieSize: DieSize,
  characterId: string,
): { heist: HeistState; deck: PhaseCard[] } {
  const shuffled = shuffle(deck);
  const hand = shuffled.slice(0, STARTING_HAND_SIZE);
  const remaining = shuffled.slice(STARTING_HAND_SIZE);
  const targetSlot: PhaseSlot = {
    slotId: `slot-target-${target.id}`,
    card: {
      id: target.id,
      name: target.name,
      type: 'goal',
      requirement: target.requirement,
      momentumDice: target.momentumDice,
      flavor: target.flavor,
    },
    status: 'pending',
    assignedDice: [],
  };
  const charDie: Die = {
    ...createDie(characterDieSize, 'character', characterId),
    value: null,
  };
  return {
    heist: {
      target,
      hand,
      planned: [],
      targetSlot,
      activeSlotIndex: 0,
      pool: [charDie],
      hasRolled: false,
      hasRolledEscape: false,
      needsFlashbackResolution: false,
      escapeComplications: [],
      heatCatches: null,
      log: [`The job: ${target.name}.`],
    },
    deck: remaining,
  };
}

function buildDraft(deck: PhaseCard[]): { newCard: PhaseCard; pairedDeckCardId: string }[] {
  const pool = PHASE_CARDS.filter((c) => c.type === 'phase');
  const options: { newCard: PhaseCard; pairedDeckCardId: string }[] = [];
  const usedPairs = new Set<string>();
  let attempts = 0;
  while (options.length < 3 && attempts < 30 && usedPairs.size < deck.length) {
    attempts += 1;
    const base = pool[Math.floor(Math.random() * pool.length)];
    const pair = deck[Math.floor(Math.random() * deck.length)];
    if (usedPairs.has(pair.id)) continue;
    usedPairs.add(pair.id);
    options.push({
      newCard: { ...base, id: `${base.id}#draft-${options.length}-${Date.now()}` },
      pairedDeckCardId: pair.id,
    });
  }
  return options;
}

function getActiveSlot(run: RunState): PhaseSlot | null {
  if (!run.heist) return null;
  const { heist } = run;
  if (heist.activeSlotIndex < heist.planned.length) return heist.planned[heist.activeSlotIndex];
  if (heist.activeSlotIndex === heist.planned.length) return heist.targetSlot;
  return null;
}

interface UIState {
  selectedDiceIds: string[];
  selectedFlashbackCardId: string | null;
  message: string | null;
}

const initialUI: UIState = { selectedDiceIds: [], selectedFlashbackCardId: null, message: null };

interface GameStore extends GameState {
  ui: UIState;

  initRun: (characterId: string) => void;
  resetToCharacterSelect: () => void;

  selectTarget: (targetId: string) => void;

  planCard: (handCardId: string) => void;
  unplanCard: (slotId: string) => void;
  endPlanning: () => void;

  rollActivePhase: () => void;
  toggleDieSelection: (dieId: string) => void;
  clearSelection: () => void;
  assignSelectedToSlot: (slotId: string) => void;
  activateAbility: () => void;
  declareTotalBust: () => void;
  advancePhase: () => void;
  selectFlashbackHandCard: (cardId: string | null) => void;
  playFlashback: (targetSlotId: string) => void;
  finishFlashbackPhase: () => void;

  rollEscape: () => void;
  assignEscapeSelectedToSlot: (slotId: string) => void;
  rollHeat: () => void;
  finalizeEscape: () => void;

  chooseDraft: (optionIndex: number) => void;
  skipDraft: () => void;
  continueToNextNode: () => void;
}

const initialState: GameState = { screen: 'characterSelect' as Screen, run: null };

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  ui: initialUI,

  initRun: (characterId) => {
    const character = CHARACTERS.find((c) => c.id === characterId);
    if (!character) return;
    const deck = buildStartingDeck();
    const run: RunState = {
      character,
      characterDie: character.startingDie,
      deck,
      heat: [],
      stash: [],
      nodeIndex: 0,
      map: buildMap(),
      heist: null,
      draft: null,
    };
    set({ screen: 'map', run, ui: initialUI });
  },

  resetToCharacterSelect: () => {
    set({ ...initialState, ui: initialUI });
  },

  selectTarget: (targetId) => {
    const run = get().run;
    if (!run) return;
    const node = run.map[run.nodeIndex];
    const target = node.targetChoices.find((t) => t.id === targetId);
    if (!target) return;
    const { heist, deck } = buildHeist(target, run.deck, run.characterDie, run.character.id);
    const nextMap = run.map.map((n, i) =>
      i === run.nodeIndex ? { ...n, chosenTargetId: targetId } : n,
    );
    set({
      screen: 'heistPlanning',
      run: { ...run, heist, deck, map: nextMap },
      ui: initialUI,
    });
  },

  planCard: (handCardId) => {
    const run = get().run;
    if (!run?.heist) return;
    const heist = run.heist;
    const cardIdx = heist.hand.findIndex((c) => c.id === handCardId);
    if (cardIdx === -1) return;
    const card = heist.hand[cardIdx];
    const newPlanned = [...heist.planned, makePhaseSlot(card, heist.planned.length)];
    const newHand = heist.hand.filter((_, i) => i !== cardIdx);
    set({ run: { ...run, heist: { ...heist, hand: newHand, planned: newPlanned } } });
  },

  unplanCard: (slotId) => {
    const run = get().run;
    if (!run?.heist) return;
    const heist = run.heist;
    const slot = heist.planned.find((s) => s.slotId === slotId);
    if (!slot) return;
    const newHand = [...heist.hand, slot.card];
    const newPlanned = heist.planned.filter((s) => s.slotId !== slotId);
    set({ run: { ...run, heist: { ...heist, hand: newHand, planned: newPlanned } } });
  },

  endPlanning: () => {
    const run = get().run;
    if (!run?.heist) return;
    set({
      screen: 'heistExecution',
      run: { ...run, heist: { ...run.heist, log: [...run.heist.log, 'Plan locked. Executing.'] } },
    });
  },

  rollActivePhase: () => {
    const run = get().run;
    if (!run?.heist) return;
    const heist = run.heist;
    const active = getActiveSlot(run);
    if (!active) return;
    if (heist.hasRolled) return;

    const addedPhaseDice: Die[] = active.card.momentumDice.map((size) => ({
      ...createDie(size, 'phase', active.card.id),
      value: null,
    }));
    let pool: Die[] = [...heist.pool, ...addedPhaseDice];
    pool = rollAll(pool);

    const rolledCount = pool.length;
    const log = [...heist.log, `${active.card.name}: rolled ${rolledCount} dice.`];

    let size = run.characterDie;
    const firstLevel = applyLevelUp(pool, size);
    pool = firstLevel.pool;
    size = firstLevel.newSize;
    if (firstLevel.leveled) log.push(`★ ${run.character.name}'s die leveled up to d${size}!`);

    let heat = run.heat;
    const onPlay = active.card.onPlayEffect;
    if (onPlay) {
      const res = applyEffect(onPlay, { pool, heat, selectedDiceIds: [] });
      pool = res.pool;
      heat = res.heat;
      log.push(`On play (${active.card.name}): ${onPlay.text}`, ...res.log);
      const secondLevel = applyLevelUp(pool, size);
      pool = secondLevel.pool;
      size = secondLevel.newSize;
      if (secondLevel.leveled) log.push(`★ ${run.character.name}'s die leveled up to d${size}!`);
    }

    set({
      run: {
        ...run,
        characterDie: size,
        heat,
        heist: { ...heist, pool, hasRolled: true, log },
      },
    });
  },

  toggleDieSelection: (dieId) => {
    const ui = get().ui;
    const has = ui.selectedDiceIds.includes(dieId);
    set({
      ui: {
        ...ui,
        selectedDiceIds: has
          ? ui.selectedDiceIds.filter((id) => id !== dieId)
          : [...ui.selectedDiceIds, dieId],
        message: null,
      },
    });
  },

  clearSelection: () => set({ ui: { ...get().ui, selectedDiceIds: [], message: null } }),

  assignSelectedToSlot: (slotId) => {
    const state = get();
    const run = state.run;
    if (!run?.heist) return;
    const heist = run.heist;
    const selected = heist.pool.filter((d) => state.ui.selectedDiceIds.includes(d.id));
    if (selected.length === 0) return;

    const allSlots: PhaseSlot[] = [...heist.planned, heist.targetSlot];
    const slot = allSlots.find((s) => s.slotId === slotId);
    if (!slot || slot.status === 'fulfilled') return;

    if (!isSubsetSatisfying(selected, slot.card.requirement)) {
      set({ ui: { ...state.ui, message: `Those dice do not satisfy "${slot.card.name}".` } });
      return;
    }

    const assignedDice = [...slot.assignedDice, ...selected];
    const newPool = heist.pool.filter((d) => !state.ui.selectedDiceIds.includes(d.id));
    const newPlanned = heist.planned.map((s) =>
      s.slotId === slotId ? { ...s, status: 'fulfilled' as const, assignedDice } : s,
    );
    const newTargetSlot =
      heist.targetSlot.slotId === slotId
        ? { ...heist.targetSlot, status: 'fulfilled' as const, assignedDice }
        : heist.targetSlot;

    set({
      run: {
        ...run,
        heist: {
          ...heist,
          pool: newPool,
          planned: newPlanned,
          targetSlot: newTargetSlot,
          log: [...heist.log, `Satisfied: ${slot.card.name}.`],
        },
      },
      ui: { ...state.ui, selectedDiceIds: [], message: null },
    });
  },

  activateAbility: () => {
    const state = get();
    const run = state.run;
    if (!run?.heist) return;
    const heist = run.heist;
    const ability = run.character.ability;
    const selected = heist.pool.filter((d) => state.ui.selectedDiceIds.includes(d.id));
    if (!isSubsetSatisfying(selected, ability.trigger)) {
      set({ ui: { ...state.ui, message: `Selected dice do not meet ${ability.name}'s trigger.` } });
      return;
    }
    const remainingPool = heist.pool.filter((d) => !state.ui.selectedDiceIds.includes(d.id));
    const res = applyEffect(ability.effect, {
      pool: remainingPool,
      heat: run.heat,
      selectedDiceIds: [],
    });
    const level = applyLevelUp(res.pool, run.characterDie);
    const log = [...heist.log, `⚡ ${ability.name} activated.`, ...res.log];
    if (level.leveled) log.push(`★ ${run.character.name}'s die leveled up to d${level.newSize}!`);
    set({
      run: {
        ...run,
        heat: res.heat,
        characterDie: level.newSize,
        heist: { ...heist, pool: level.pool, log },
      },
      ui: { ...state.ui, selectedDiceIds: [], message: null },
    });
  },

  declareTotalBust: () => {
    const run = get().run;
    if (!run?.heist) return;
    const heist = run.heist;
    const active = getActiveSlot(run);
    if (!active) return;

    const activeIdx = heist.activeSlotIndex;
    const returnedDice: Die[] = [];
    let newlyFailed = 0;

    const newPlanned = heist.planned.map((s, i) => {
      if (i > activeIdx) return s;
      if (s.status !== 'failed') newlyFailed += 1;
      if (s.status === 'fulfilled') returnedDice.push(...s.assignedDice);
      return { ...s, status: 'failed' as const, assignedDice: [] };
    });

    let newTarget = heist.targetSlot;
    if (activeIdx === heist.planned.length) {
      if (heist.targetSlot.status !== 'failed') newlyFailed += 1;
      if (heist.targetSlot.status === 'fulfilled') returnedDice.push(...heist.targetSlot.assignedDice);
      newTarget = { ...heist.targetSlot, status: 'failed' as const, assignedDice: [] };
    }

    const newDeck = [...run.deck];
    const drawn: PhaseCard[] = [];
    for (let i = 0; i < newlyFailed && newDeck.length > 0; i += 1) {
      drawn.push(newDeck.shift()!);
    }
    const newHand = [...heist.hand, ...drawn];

    set({
      run: {
        ...run,
        deck: newDeck,
        heist: {
          ...heist,
          hand: newHand,
          pool: [...heist.pool, ...returnedDice],
          planned: newPlanned,
          targetSlot: newTarget,
          needsFlashbackResolution: true,
          log: [
            ...heist.log,
            `💥 TOTAL BUST on ${active.card.name}. ${newlyFailed} phase(s) failed. Drew ${drawn.length} card(s). Flashback opportunity.`,
          ],
        },
      },
      ui: initialUI,
    });
  },

  advancePhase: () => {
    const run = get().run;
    if (!run?.heist) return;
    const heist = run.heist;
    const active = getActiveSlot(run);
    if (!active) return;

    if (active.status !== 'fulfilled' && active.status !== 'flashbacked') {
      set({
        ui: {
          ...get().ui,
          message: `${active.card.name} is not satisfied. Fulfill it, flashback on it, or declare Total Bust.`,
        },
      });
      return;
    }

    let newlyFailed = 0;
    const newPlanned = heist.planned.map((s, i) => {
      if (i < heist.activeSlotIndex && s.status === 'pending') {
        newlyFailed += 1;
        return { ...s, status: 'failed' as const };
      }
      return s;
    });

    const newDeck = [...run.deck];
    const drawn: PhaseCard[] = [];
    for (let i = 0; i < newlyFailed && newDeck.length > 0; i += 1) {
      drawn.push(newDeck.shift()!);
    }
    const newHand = [...heist.hand, ...drawn];

    const anyFailed =
      newPlanned.some((s) => s.status === 'failed') || heist.targetSlot.status === 'failed';

    if (anyFailed) {
      set({
        run: {
          ...run,
          deck: newDeck,
          heist: {
            ...heist,
            hand: newHand,
            planned: newPlanned,
            needsFlashbackResolution: true,
            log:
              newlyFailed > 0
                ? [
                    ...heist.log,
                    `${newlyFailed} prior phase(s) fell through. Drew ${drawn.length} card(s). Flashback opportunity.`,
                  ]
                : [...heist.log, 'Flashback opportunity on failed phases.'],
          },
        },
        ui: initialUI,
      });
      return;
    }

    set({
      run: {
        ...run,
        deck: newDeck,
        heist: { ...heist, hand: newHand, planned: newPlanned },
      },
      ui: initialUI,
    });
    get().finishFlashbackPhase();
  },

  selectFlashbackHandCard: (cardId) => {
    set({ ui: { ...get().ui, selectedFlashbackCardId: cardId, message: null } });
  },

  playFlashback: (targetSlotId) => {
    const state = get();
    const run = state.run;
    if (!run?.heist) return;
    const heist = run.heist;
    if (!heist.needsFlashbackResolution) return;

    const handCardId = state.ui.selectedFlashbackCardId;
    if (!handCardId) {
      set({ ui: { ...state.ui, message: 'Pick a hand card to flashback with first.' } });
      return;
    }
    const handCard = heist.hand.find((c) => c.id === handCardId);
    if (!handCard) return;

    const slotInPlanned = heist.planned.find((s) => s.slotId === targetSlotId);
    const slot =
      slotInPlanned ?? (heist.targetSlot.slotId === targetSlotId ? heist.targetSlot : null);
    if (!slot || slot.status !== 'failed') {
      set({ ui: { ...state.ui, message: 'Flashback can only target a failed phase.' } });
      return;
    }

    const selected = heist.pool.filter((d) => state.ui.selectedDiceIds.includes(d.id));
    if (!isSubsetSatisfying(selected, handCard.requirement)) {
      set({
        ui: {
          ...state.ui,
          message: `${handCard.name}'s requirement is not met by the selected dice.`,
        },
      });
      return;
    }

    const newHand = heist.hand.filter((c) => c.id !== handCardId);
    const newPool = heist.pool.filter((d) => !state.ui.selectedDiceIds.includes(d.id));
    const flashbackDice: Die[] = handCard.momentumDice.map((size) => ({
      ...createDie(size, 'stash'),
      value: null,
    }));
    const newStash = [...run.stash, ...flashbackDice];

    const updateSlot = (s: PhaseSlot): PhaseSlot =>
      s.slotId === targetSlotId
        ? {
            ...s,
            status: 'flashbacked',
            assignedDice: [...s.assignedDice, ...selected],
            flashbackCardId: handCard.id,
          }
        : s;
    const newPlanned = heist.planned.map(updateSlot);
    const newTarget = updateSlot(heist.targetSlot);

    set({
      run: {
        ...run,
        stash: newStash,
        heist: {
          ...heist,
          hand: newHand,
          pool: newPool,
          planned: newPlanned,
          targetSlot: newTarget,
          log: [
            ...heist.log,
            `⏪ Flashback: ${handCard.name} covers ${slot.card.name}. +${flashbackDice.length} stash.`,
          ],
        },
      },
      ui: initialUI,
    });
  },

  finishFlashbackPhase: () => {
    const run = get().run;
    if (!run?.heist) return;
    const heist = run.heist;

    const charInPool = heist.pool.filter((d) => d.source === 'character');
    const nonCharUnused = heist.pool.filter((d) => d.source !== 'character');

    const newHeat: Die[] = [...run.heat];
    for (let i = 0; i < nonCharUnused.length; i += 1) {
      newHeat.push({ ...createDie(6, 'heat'), value: null });
    }
    const heatGained = nonCharUnused.length;

    const returnedFromPlanned = heist.planned.flatMap((s) => s.assignedDice);
    const returnedFromTarget = heist.targetSlot.assignedDice;
    const returnedDice = [...returnedFromPlanned, ...returnedFromTarget].map((d) => ({
      ...d,
      value: null,
    }));

    const newPlanned = heist.planned.map((s) => ({ ...s, assignedDice: [] }));
    const newTargetSlot = { ...heist.targetSlot, assignedDice: [] };

    const preservedCharPool = charInPool.map((d) => ({ ...d, value: null }));
    const hasChar = preservedCharPool.length > 0 || returnedDice.some((d) => d.source === 'character');
    const newPool = [...preservedCharPool, ...returnedDice];
    if (!hasChar) {
      newPool.push({
        ...createDie(run.characterDie, 'character', run.character.id),
        value: null,
      });
    }

    const nextIdx = heist.activeSlotIndex + 1;
    const lastIdx = heist.planned.length;
    const baseLog = [
      ...heist.log,
      ...(heatGained > 0 ? [`+${heatGained} heat from unused dice.`] : []),
      ...(returnedDice.length > 0
        ? [`${returnedDice.length} used die/dice return to the pool for next phase.`]
        : []),
    ];

    if (nextIdx > lastIdx) {
      const escapeComplications: PhaseSlot[] = heist.hand.map((c, i) => ({
        slotId: `escape-${i}-${c.id}`,
        card: c,
        status: 'pending',
        assignedDice: [],
      }));
      set({
        screen: 'heistEscape',
        run: {
          ...run,
          heat: newHeat,
          heist: {
            ...heist,
            planned: newPlanned,
            targetSlot: newTargetSlot,
            pool: [],
            hasRolled: false,
            needsFlashbackResolution: false,
            activeSlotIndex: nextIdx,
            escapeComplications,
            log: [...baseLog, 'Execution complete. Time to run.'],
          },
        },
        ui: initialUI,
      });
      return;
    }

    set({
      run: {
        ...run,
        heat: newHeat,
        heist: {
          ...heist,
          planned: newPlanned,
          targetSlot: newTargetSlot,
          pool: newPool,
          hasRolled: false,
          needsFlashbackResolution: false,
          activeSlotIndex: nextIdx,
          log: [...baseLog, 'Next phase.'],
        },
      },
      ui: initialUI,
    });
  },

  rollEscape: () => {
    const run = get().run;
    if (!run?.heist) return;
    const heist = run.heist;
    const stashPool: Die[] = run.stash.map((d) => ({ ...d, source: 'stash' }));
    const rolled = rollAll(stashPool);
    set({
      run: {
        ...run,
        heist: {
          ...heist,
          pool: rolled,
          hasRolledEscape: true,
          log: [...heist.log, `Rolled ${rolled.length} escape dice.`],
        },
      },
    });
  },

  assignEscapeSelectedToSlot: (slotId) => {
    const state = get();
    const run = state.run;
    if (!run?.heist) return;
    const heist = run.heist;
    const selected = heist.pool.filter((d) => state.ui.selectedDiceIds.includes(d.id));
    if (selected.length === 0) return;
    const slot = heist.escapeComplications.find((s) => s.slotId === slotId);
    if (!slot || slot.status === 'fulfilled') return;
    if (!isSubsetSatisfying(selected, slot.card.requirement)) {
      set({ ui: { ...state.ui, message: `Those dice do not satisfy "${slot.card.name}".` } });
      return;
    }
    const newComplications = heist.escapeComplications.map((s) =>
      s.slotId === slotId
        ? { ...s, status: 'fulfilled' as const, assignedDice: [...s.assignedDice, ...selected] }
        : s,
    );
    const newPool = heist.pool.filter((d) => !state.ui.selectedDiceIds.includes(d.id));
    set({
      run: { ...run, heist: { ...heist, pool: newPool, escapeComplications: newComplications } },
      ui: { ...state.ui, selectedDiceIds: [], message: null },
    });
  },

  rollHeat: () => {
    const run = get().run;
    if (!run?.heist) return;
    const heist = run.heist;
    if (heist.heatCatches !== null) return;

    const unresolved = heist.escapeComplications.filter((s) => s.status !== 'fulfilled');
    if (unresolved.length === 0) {
      set({
        run: {
          ...run,
          heist: {
            ...heist,
            heatCatches: {},
            log: [...heist.log, 'Clean getaway — no heat roll needed.'],
          },
        },
      });
      return;
    }

    const rolled = rollAll(run.heat.map((d) => ({ ...d, source: 'heat' as const })));
    const catches: Record<string, string[]> = {};
    const log = [...heist.log, `Rolling ${rolled.length} heat dice.`];
    for (const comp of unresolved) {
      const subset = findSatisfyingSubset(rolled, comp.card.requirement);
      if (subset !== null) {
        catches[comp.slotId] = subset.map((d) => d.id);
        log.push(`Heat caught you on ${comp.card.name}.`);
      }
    }
    if (Object.keys(catches).length === 0) log.push('You slipped the heat.');

    set({
      run: {
        ...run,
        heat: rolled,
        heist: { ...heist, heatCatches: catches, log },
      },
    });
  },

  finalizeEscape: () => {
    const run = get().run;
    if (!run?.heist) return;
    const heist = run.heist;
    if (heist.heatCatches === null) return;

    const caught = Object.keys(heist.heatCatches).length > 0;
    const isFinalNode = run.nodeIndex === TOTAL_NODES - 1;

    if (caught) {
      set({ screen: 'gameOver', run: { ...run, outcome: 'caught' } });
      return;
    }
    if (isFinalNode) {
      set({ screen: 'gameOver', run: { ...run, outcome: 'won' } });
      return;
    }
    const draft = buildDraft(run.deck);
    set({
      screen: 'draft',
      run: { ...run, draft, stash: heist.pool, heist: null },
    });
  },

  chooseDraft: (optionIndex) => {
    const run = get().run;
    if (!run?.draft) return;
    const option = run.draft[optionIndex];
    if (!option) return;
    const newDeck = run.deck.map((c) => (c.id === option.pairedDeckCardId ? option.newCard : c));
    set({ run: { ...run, deck: newDeck, draft: null } });
    get().continueToNextNode();
  },

  skipDraft: () => {
    const run = get().run;
    if (!run) return;
    set({ run: { ...run, draft: null } });
    get().continueToNextNode();
  },

  continueToNextNode: () => {
    const run = get().run;
    if (!run) return;
    set({ screen: 'map', run: { ...run, nodeIndex: run.nodeIndex + 1 } });
  },
}));

export { getActiveSlot, TOTAL_NODES };
