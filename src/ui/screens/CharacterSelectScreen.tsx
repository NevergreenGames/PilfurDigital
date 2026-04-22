import { CHARACTERS } from '../../content/characters';
import { describeRequirement } from '../../engine/requirements';
import { useGameStore } from '../../state/gameStore';

export function CharacterSelectScreen() {
  const initRun = useGameStore((s) => s.initRun);
  return (
    <div className="screen character-select">
      <h1>PILFUR</h1>
      <p className="subtitle">Five jobs. One getaway. Pick your crew of one.</p>
      <div className="character-grid">
        {CHARACTERS.map((c) => (
          <div key={c.id} className="character-card">
            <div className="character-name">{c.name}</div>
            <div className="character-die-chip">starts with d{c.startingDie}</div>
            {c.flavor && <div className="character-flavor">{c.flavor}</div>}
            <div className="character-ability">
              <div className="ability-name">{c.ability.name}</div>
              <div className="ability-trigger">Trigger: {describeRequirement(c.ability.trigger)}</div>
              <div className="ability-text">{c.ability.text}</div>
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
