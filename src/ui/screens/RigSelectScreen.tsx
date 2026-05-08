import { useEffect, useState } from 'react';
import { getCharacter, getRigs } from '../../state/contentRegistry';
import { getAchievement } from '../../content/achievements';
import { useGameStore } from '../../state/gameStore';
import {
  isAchievementUnlocked,
  subscribe as subscribeAchievements,
} from '../../state/achievements';
import { getLastSelection, setLastRig } from '../../state/lastSelection';
import { DieGlyph } from '../components/DieGlyph';
import { GlitchButton } from '../components/GlitchButton';
import { GlitchPulse } from '../components/GlitchPulse';
import { GlitchTypewriter } from '../components/GlitchTypewriter';
import { staggerStyle } from '../transitions/transitionUtils';

/*
 * RigSelectScreen — second stage of run setup. Player has already
 * committed a character on CharacterSelect (id stashed in
 * gameStore.pendingCharacterId); now they pick a rig, which determines
 * the starting pool dice + starting creds.
 *
 * Rigs that gate on an achievement (`unlockAchievementId`) render in
 * their locked state with the achievement's description as the unlock
 * hint. Locked rigs are non-interactive.
 *
 * Click a rig card to highlight it; CONTINUE at the bottom commits the
 * run via initRun(characterId, rigId). BACK returns to CharacterSelect.
 */
export function RigSelectScreen() {
  const pendingCharacterId = useGameStore((s) => s.pendingCharacterId);
  // We watch `screen` so the defensive bounce below can tell apart
  // "player committed (we're already navigating away)" from "player
  // arrived without a pending character (e.g. dev tool)".
  const screen = useGameStore((s) => s.screen);
  const initRun = useGameStore((s) => s.initRun);
  const cancelRigSelect = useGameStore((s) => s.cancelRigSelect);

  // Re-render when achievements change (dev-panel "unlock all" /
  // "reset achievements" + live engine awards) so locked tiles flip
  // immediately.
  const [, forceTick] = useState(0);
  useEffect(() => subscribeAchievements(() => forceTick((n) => n + 1)), []);

  // Defensive: if the player hard-navigated here without a pending
  // character (e.g. dev-tool setScreen), bounce back to character select.
  // BUT only when we're still supposed to be on this screen — initRun
  // legitimately clears pendingCharacterId AND flips the screen to
  // 'map', and SceneTransition keeps RigSelectScreen mounted through
  // the 200ms exit phase. Without the screen check, this effect would
  // fire mid-exit and cancelRigSelect would clobber the in-flight
  // navigation back to 'characterSelect'.
  useEffect(() => {
    if (!pendingCharacterId && screen === 'rigSelect') cancelRigSelect();
  }, [pendingCharacterId, screen, cancelRigSelect]);

  const character = pendingCharacterId
    ? getCharacter(pendingCharacterId)
    : null;

  // Unlocked-rig id list — used both to default the selection and to
  // power left/right keyboard navigation. Recomputed each render so the
  // achievement subscription (forceTick) refreshes it live.
  const unlockedIds = getRigs().filter(
    (r) =>
      !r.unlockAchievementId || isAchievementUnlocked(r.unlockAchievementId),
  ).map((r) => r.id);

  // Default the highlighted rig from memory; fall back to first unlocked
  // ('standard' under default content). Selection is purely UI state — it
  // doesn't commit anything until CONTINUE.
  // Per-card scramble counter — bumped on click so each card's
  // GlitchPulse instances retrigger their decode burst.
  const [pulses, setPulses] = useState<Record<string, number>>({});
  const bumpPulse = (id: string) =>
    setPulses((p) => ({ ...p, [id]: (p[id] ?? 0) + 1 }));

  const [selectedRigId, setSelectedRigId] = useState<string | null>(() => {
    const remembered = getLastSelection().rigId;
    if (
      remembered &&
      getRigs().some(
        (r) =>
          r.id === remembered &&
          (!r.unlockAchievementId ||
            isAchievementUnlocked(r.unlockAchievementId)),
      )
    ) {
      return remembered;
    }
    return unlockedIds[0] ?? null;
  });

  const selectedRig = selectedRigId
    ? getRigs().find((r) => r.id === selectedRigId)
    : null;
  const selectionLocked =
    selectedRig !== null &&
    selectedRig !== undefined &&
    !!selectedRig.unlockAchievementId &&
    !isAchievementUnlocked(selectedRig.unlockAchievementId);
  const canContinue = !!selectedRigId && !!character && !selectionLocked;

  function handleContinue() {
    if (!character || !selectedRigId || selectionLocked) return;
    setLastRig(selectedRigId);
    initRun(character.id, selectedRigId);
  }

  // Arrow-key navigation: left/right cycle unlocked rigs, Enter triggers
  // CONTINUE. Defined before the early-return so the hook order stays
  // stable across renders.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (unlockedIds.length === 0) return;
        e.preventDefault();
        const cur =
          selectedRigId && unlockedIds.includes(selectedRigId)
            ? unlockedIds.indexOf(selectedRigId)
            : 0;
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const next = (cur + dir + unlockedIds.length) % unlockedIds.length;
        setSelectedRigId(unlockedIds[next]);
        return;
      }
      if (e.key === 'Enter' && canContinue) {
        if (target && target.classList.contains('select-card')) return;
        e.preventDefault();
        handleContinue();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRigId, unlockedIds, canContinue]);

  if (!character) return null;

  return (
    <div className="screen rig-select">
      <h1>
        <GlitchTypewriter text="PICK YOUR RIG" perWordMs={70} />
      </h1>
      <p className="subtitle">
        <GlitchTypewriter
          text={`The kit you bring decides how the first job opens. Loadout for ${character.name}.`}
          perWordMs={60}
          delayMs={120}
        />
      </p>

      <div className="rig-grid">
        {getRigs().map((rig, i) => {
          const unlocked =
            !rig.unlockAchievementId ||
            isAchievementUnlocked(rig.unlockAchievementId);
          const ach = rig.unlockAchievementId
            ? getAchievement(rig.unlockAchievementId)
            : null;
          const cardDelay = 120 + i * 80;
          const isSelected = unlocked && selectedRigId === rig.id;
          const pulse = pulses[rig.id] ?? 0;
          // Flatten the rig's dice spec into individual glyphs for the
          // header row — easier to scan than "4× d4 (ghost)".
          const dieGlyphs: { size: number; source: string; key: string }[] = [];
          for (const spec of rig.startingDice) {
            for (let k = 0; k < spec.count; k += 1) {
              dieGlyphs.push({
                size: spec.size,
                source: spec.source,
                key: `${spec.size}-${spec.source}-${k}`,
              });
            }
          }
          const classes = [
            'rig-card',
            'select-card',
            unlocked ? '' : 'rig-card--locked',
            isSelected ? 'select-card--selected' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            // Stagger on a wrapper div so the button's own animation
            // property (hover/active/selected) can swap freely without
            // restarting the entrance opacity:0 → 1 keyframe.
            <div
              key={rig.id}
              className="stagger-item"
              style={staggerStyle(i, { step: 80, initial: 120 })}
            >
            <button
              type="button"
              className={classes}
              onClick={() => {
                if (!unlocked) return;
                setSelectedRigId(rig.id);
                bumpPulse(rig.id);
              }}
              aria-pressed={isSelected}
              disabled={!unlocked}
            >
              <div className="rig-card-header">
                <div className="rig-card-name">
                  <span className="rig-card-icon" aria-hidden>
                    {rig.icon ?? '🎒'}
                  </span>
                  <GlitchPulse
                    text={rig.name}
                    pulseKey={pulse}
                    perWordMs={50}
                    delayMs={cardDelay}
                  />
                </div>
                <div className="rig-card-gold" title="Starting creds">
                  ¢ {rig.startingGold}
                </div>
              </div>

              {rig.flavor && (
                <div className="rig-card-flavor">
                  <GlitchPulse
                    text={rig.flavor}
                    pulseKey={pulse}
                    perWordMs={60}
                    delayMs={cardDelay + 80}
                  />
                </div>
              )}

              <div className="rig-card-dice">
                <span className="rig-card-dice-label">STARTING DICE</span>
                <span className="rig-card-dice-row">
                  {dieGlyphs.length === 0 ? (
                    <span className="muted">none</span>
                  ) : (
                    dieGlyphs.map((d) => (
                      <span
                        key={d.key}
                        className={`rig-card-die rig-card-die--${d.source}`}
                        title={`d${d.size} (${d.source})`}
                      >
                        <DieGlyph size={d.size as 4 | 6 | 8 | 10 | 12 | 20} px={28} />
                      </span>
                    ))
                  )}
                </span>
              </div>

              {!unlocked && (
                <div className="rig-card-locked">
                  <div className="rig-card-locked-badge">🔒 LOCKED</div>
                  <div className="rig-card-locked-hint">
                    <GlitchTypewriter
                      text={
                        ach
                          ? `${ach.name} — ${ach.description}`
                          : 'Locked.'
                      }
                      perWordMs={50}
                      delayMs={cardDelay + 200}
                    />
                  </div>
                </div>
              )}
            </button>
            </div>
          );
        })}
      </div>

      <div className="select-actions">
        <GlitchButton
          className="primary big"
          onClick={handleContinue}
          disabled={!canContinue}
          label="CONTINUE"
        />
      </div>

      <div className="screen-back-link">
        <button type="button" onClick={cancelRigSelect}>
          ← Back to crew
        </button>
      </div>
    </div>
  );
}
