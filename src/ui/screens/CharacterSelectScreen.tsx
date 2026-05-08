import { useEffect, useState } from 'react';
import { getCharacters, getCharacter } from '../../state/contentRegistry';
import { useGameStore } from '../../state/gameStore';
import {
  getUnlockPrerequisite,
  isCharacterUnlocked,
  subscribe,
} from '../../state/progress';
import { getLastSelection, setLastCharacter } from '../../state/lastSelection';
import { DieGlyph, withDieGlyphs } from '../components/DieGlyph';
import { GlitchButton } from '../components/GlitchButton';
import { GlitchPulse } from '../components/GlitchPulse';
import { GlitchTypewriter } from '../components/GlitchTypewriter';
import { staggerStyle } from '../transitions/transitionUtils';

export function CharacterSelectScreen() {
  // CONTINUE replaces the per-card CHOOSE — clicking a card highlights
  // it; the bottom CONTINUE commits the selection by routing into the
  // rig-select stage via selectCharacterForRig.
  const selectCharacterForRig = useGameStore((s) => s.selectCharacterForRig);
  const setScreen = useGameStore((s) => s.setScreen);
  // Re-render on dev-panel "unlock all" / "reset progress" so the locked
  // tiles flip live without a page reload.
  const [, forceTick] = useState(0);
  useEffect(() => subscribe(() => forceTick((n) => n + 1)), []);

  // Default the highlighted card from memory when possible — falls back
  // to the first unlocked character (always Hacker today). Re-derived
  // on every render so the dev-panel "unlock all" tick refreshes the
  // arrow-key navigation set.
  const unlockedIds = getCharacters().filter((c) =>
    isCharacterUnlocked(c.id),
  ).map((c) => c.id);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const remembered = getLastSelection().characterId;
    if (remembered && isCharacterUnlocked(remembered)) return remembered;
    return unlockedIds[0] ?? null;
  });
  // Per-card scramble counter — bumped on click so each card's
  // GlitchPulse instances retrigger their decode burst. Locked cards
  // never bump (they don't fire the click handler).
  const [pulses, setPulses] = useState<Record<string, number>>({});
  const bumpPulse = (id: string) =>
    setPulses((p) => ({ ...p, [id]: (p[id] ?? 0) + 1 }));

  const selectedCharacter = selectedId ? getCharacter(selectedId) : null;
  const selectionLocked =
    selectedCharacter !== undefined &&
    selectedCharacter !== null &&
    !isCharacterUnlocked(selectedCharacter.id);
  const canContinue = selectedId !== null && !selectionLocked;

  // Arrow-key navigation: left/right cycle through unlocked-only cards;
  // Enter triggers CONTINUE. Tab/Space still work via the native button
  // semantics on each card.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Skip keystrokes aimed at form inputs / modals / dev panel.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (unlockedIds.length === 0) return;
        e.preventDefault();
        const cur = selectedId && unlockedIds.includes(selectedId)
          ? unlockedIds.indexOf(selectedId)
          : 0;
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const next = (cur + dir + unlockedIds.length) % unlockedIds.length;
        setSelectedId(unlockedIds[next]);
        return;
      }
      if (e.key === 'Enter' && canContinue) {
        // If focus is on a card button, let the native click handle
        // selection — pressing Enter again (off-card) commits.
        if (target && target.classList.contains('select-card')) return;
        e.preventDefault();
        handleContinue();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, unlockedIds, canContinue]);

  function handleContinue() {
    if (!selectedId || selectionLocked) return;
    setLastCharacter(selectedId);
    selectCharacterForRig(selectedId);
  }

  return (
    <div className="screen character-select">
      <h1>
        <GlitchTypewriter text="PILFUR" perWordMs={70} />
      </h1>
      <p className="subtitle">
        <GlitchTypewriter
          text="Five jobs. One getaway. Pick your crew of one."
          perWordMs={70}
          delayMs={120}
        />
      </p>
      <div className="character-grid">
        {getCharacters().map((c, i) => {
          const unlocked = isCharacterUnlocked(c.id);
          const prereqId = getUnlockPrerequisite(c.id);
          const prereq = prereqId ? getCharacter(prereqId) : null;
          // The card itself appears via stagger; its text glitches in
          // immediately afterward — additive timing tied to the stagger
          // delay so each card's text reveals as the card lands.
          const cardDelay = 120 + i * 80;
          const isSelected = unlocked && selectedId === c.id;
          const pulse = pulses[c.id] ?? 0;
          const classes = [
            'character-card',
            'select-card',
            unlocked ? '' : 'character-card--locked',
            isSelected ? 'select-card--selected' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            // Stagger lives on the wrapper so the button's own animation
            // property (hover/active/selected) can swap freely without
            // restarting the entrance opacity:0 → 1 keyframe. See note in
            // globals.css under .character-grid > .stagger-item.
            <div
              key={c.id}
              className="stagger-item"
              style={staggerStyle(i, { step: 80, initial: 120 })}
            >
            <button
              type="button"
              className={classes}
              onClick={() => {
                if (!unlocked) return;
                setSelectedId(c.id);
                bumpPulse(c.id);
              }}
              aria-pressed={isSelected}
              disabled={!unlocked}
            >
              <div className="character-header">
                <div className="character-name">
                  <GlitchPulse text={c.name} pulseKey={pulse} perWordMs={50} delayMs={cardDelay} />
                </div>
                <DieGlyph size={c.startingDie} px={36} />
              </div>
              {c.flavor && (
                <div className="character-flavor">
                  <GlitchPulse text={c.flavor} pulseKey={pulse} perWordMs={60} delayMs={cardDelay + 80} />
                </div>
              )}
              <div className="character-ability">
                <div className="ability-name">
                  <span className="ability-icon" aria-hidden>{c.passive.icon}</span>
                  <GlitchPulse
                    text={c.passive.name}
                    pulseKey={pulse}
                    perWordMs={50}
                    delayMs={cardDelay + 100}
                  />
                  <span className="passive-badge">PASSIVE</span>
                </div>
                <div className="ability-effect">{withDieGlyphs(c.passive.text)}</div>
                {c.passive.flavor && (
                  <div className="ability-flavor">
                    <GlitchPulse
                      text={c.passive.flavor}
                      pulseKey={pulse}
                      perWordMs={60}
                      delayMs={cardDelay + 200}
                    />
                  </div>
                )}
              </div>
              {!unlocked && (
                <div className="character-locked">
                  <div className="character-locked-badge">🔒 LOCKED</div>
                  <div className="character-locked-hint">
                    <GlitchTypewriter
                      text={
                        prereq
                          ? `Finish a run as ${prereq.name} to unlock.`
                          : 'Complete a prior run to unlock.'
                      }
                      perWordMs={50}
                      delayMs={cardDelay + 240}
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
        <button type="button" onClick={() => setScreen('title')}>
          ← Back to main menu
        </button>
      </div>
    </div>
  );
}
