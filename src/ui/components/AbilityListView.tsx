import { CharacterAbility, Requirement } from '../../engine/types';

function triggerGlyph(req: Requirement): string {
  const opGlyph: Record<string, string> = {
    lt: '<',
    lte: '≤',
    eq: '=',
    gte: '≥',
    gt: '>',
  };
  switch (req.kind) {
    case 'sum': {
      const op = opGlyph[req.op] ?? '=';
      const suffix = req.minDice && req.minDice > 1 ? `·${req.minDice}+` : '';
      return `Σ${op}${req.value}${suffix}`;
    }
    case 'xOfAKind':
      return `×${req.count}`;
    case 'straight':
      return `↗${req.length}`;
  }
}

interface Props {
  abilities: CharacterAbility[];
  charges: Record<string, number>;
  onActivate: (abilityId: string) => void;
  disabled?: boolean;
}

export function AbilityListView({ abilities, charges, onActivate, disabled }: Props) {
  if (abilities.length === 0) {
    return <div className="muted" style={{ fontSize: 11 }}>No abilities.</div>;
  }
  return (
    <div>
      {abilities.map((a) => {
        const count = charges[a.id] ?? 0;
        const canActivate = !disabled && count > 0;
        const charged = count > 0;
        return (
          <div
            key={a.id}
            className={`hg-ability ${charged ? 'hg-ability--charged' : ''}`}
          >
            <div className="hg-ability-header">
              <span className="hg-ability-name">{a.name}</span>
              <span className="hg-ability-trigger" title="Trigger">
                {triggerGlyph(a.trigger)}
              </span>
              <span
                className={`hg-ability-charges ${charged ? 'hg-ability-charges--on' : ''}`}
                title={`${count} charge${count === 1 ? '' : 's'}`}
              >
                {count > 0 ? `⚡${count}` : '—'}
              </span>
            </div>
            <div className="hg-ability-text">{a.text}</div>
            <button
              onClick={() => onActivate(a.id)}
              disabled={!canActivate}
              className={canActivate ? 'primary' : ''}
            >
              {canActivate ? 'ACTIVATE' : 'UNCHARGED'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
