import { useEffect, useState } from 'react';
import { CHARACTERS, getCharacter } from '../../content/characters';
import { useGameStore } from '../../state/gameStore';
import {
  getUnlockPrerequisite,
  isCharacterUnlocked,
  subscribe,
} from '../../state/progress';
import { DieGlyph, withDieGlyphs } from '../components/DieGlyph';

export function CharacterSelectScreen() {
  const initRun = useGameStore((s) => s.initRun);
  // Re-render on dev-panel "unlock all" / "reset progress" so the locked
  // tiles flip live without a page reload.
  const [, forceTick] = useState(0);
  useEffect(() => subscribe(() => forceTick((n) => n + 1)), []);

  return (
    <div className="screen character-select">
      <h1>PILFUR</h1>
      <p className="subtitle">Five jobs. One getaway. Pick your crew of one.</p>
      <div className="character-grid">
        {CHARACTERS.map((c) => {
          const unlocked = isCharacterUnlocked(c.id);
          const prereqId = getUnlockPrerequisite(c.id);
          const prereq = prereqId ? getCharacter(prereqId) : null;
          return (
            <div
              key={c.id}
              className={`character-card${unlocked ? '' : ' character-card--locked'}`}
            >
              <div className="character-header">
                <div className="character-name">{c.name}</div>
                <DieGlyph size={c.startingDie} px={36} />
              </div>
              {c.flavor && <div className="character-flavor">{c.flavor}</div>}
              <div className="character-ability">
                <div className="ability-name">
                  <span className="ability-icon" aria-hidden>{c.passive.icon}</span>
                  {c.passive.name}
                  <span className="passive-badge">PASSIVE</span>
                </div>
                <div className="ability-effect">{withDieGlyphs(c.passive.text)}</div>
                {c.passive.flavor && (
                  <div className="ability-flavor">{c.passive.flavor}</div>
                )}
              </div>
              {unlocked ? (
                <button className="primary" onClick={() => initRun(c.id)}>
                  CHOOSE
                </button>
              ) : (
                <div className="character-locked">
                  <div className="character-locked-badge">🔒 LOCKED</div>
                  <div className="character-locked-hint">
                    {prereq
                      ? `Finish a run as ${prereq.name} to unlock.`
                      : 'Complete a prior run to unlock.'}
                  </div>
                  <button disabled>CHOOSE</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
