import { useGameStore } from '../../state/gameStore';
import { describeRequirement } from '../../engine/requirements';
import { DieGlyph, withDieGlyphs } from '../components/DieGlyph';

export function DraftScreen() {
  const run = useGameStore((s) => s.run);
  const chooseDraft = useGameStore((s) => s.chooseDraft);
  const skipDraft = useGameStore((s) => s.skipDraft);
  if (!run?.draft) return null;

  return (
    <div className="screen draft">
      <header className="run-header">
        <div className="run-header-char">
          <strong>{run.character.name}</strong>
          <DieGlyph size={run.characterDie} px={22} />
        </div>
        <div>DRAFT</div>
        <div>
          <span className="creds-pill" title="Creds available to spend">
            ¢ {run.creds}
          </span>{' '}
          · Heat {run.heat.length} · Abilities {run.abilities.length}
        </div>
      </header>
      <h2>Pick a new ability</h2>
      <p className="hint">
        Each ability costs creds. You earned them on the last job — spend them
        here or save for a pricier option next time.
      </p>
      <div className="draft-row">
        {run.draft.map((opt, i) => {
          const cost = opt.ability.cost;
          const affordable = cost <= run.creds;
          return (
            <div
              key={i}
              className={`draft-option ${affordable ? '' : 'draft-option--unaffordable'}`}
            >
              <div className="ability-name">
                <span className="ability-icon" aria-hidden>{opt.ability.icon}</span>
                {opt.ability.name}
              </div>
              <div className="ability-effect">{withDieGlyphs(opt.ability.text)}</div>
              <div className="ability-trigger">
                <span className="ability-trigger-label">Charges on</span>{' '}
                {describeRequirement(opt.ability.trigger)}
              </div>
              {opt.ability.flavor && (
                <div className="ability-flavor">{opt.ability.flavor}</div>
              )}
              <div className={`ability-cost ${affordable ? '' : 'ability-cost--unaffordable'}`}>
                ¢ {cost}
              </div>
              <button
                className="primary"
                onClick={() => chooseDraft(i)}
                disabled={!affordable}
                title={
                  affordable
                    ? `Spend ${cost} creds`
                    : `Need ${cost - run.creds} more creds`
                }
              >
                {affordable ? `BUY · ¢${cost}` : `NEED ¢${cost - run.creds}`}
              </button>
            </div>
          );
        })}
      </div>
      <div className="action-bar">
        <button className="small" onClick={skipDraft}>
          skip · save creds
        </button>
      </div>
    </div>
  );
}
