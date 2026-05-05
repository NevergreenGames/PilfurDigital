import { CHARACTERS } from '../../content/characters';
import { describeRequirement } from '../../engine/requirements';
import { useGameStore } from '../../state/gameStore';
import { DieGlyph, withDieGlyphs } from '../components/DieGlyph';

export function CharacterSelectScreen() {
  const initRun = useGameStore((s) => s.initRun);
  return (
    <div className="screen character-select">
      <h1>PILFUR</h1>
      <p className="subtitle">Five jobs. One getaway. Pick your crew of one.</p>
      <div className="character-grid">
        {CHARACTERS.map((c) => (
          <div key={c.id} className="character-card">
            <div className="character-header">
              <div className="character-name">{c.name}</div>
              <DieGlyph size={c.startingDie} px={36} />
            </div>
            {c.flavor && <div className="character-flavor">{c.flavor}</div>}
            <div className="character-ability">
              <div className="ability-name">
                <span className="ability-icon" aria-hidden>{c.ability.icon}</span>
                {c.ability.name}
              </div>
              <div className="ability-effect">{withDieGlyphs(c.ability.text)}</div>
              <div className="ability-trigger">
                <span className="ability-trigger-label">Charges on</span>{' '}
                {describeRequirement(c.ability.trigger)}
              </div>
            </div>
            <button className="primary" onClick={() => initRun(c.id)}>
              CHOOSE
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
