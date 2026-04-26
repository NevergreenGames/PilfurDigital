import { useGameStore } from '../../state/gameStore';
import { DieGlyph } from '../components/DieGlyph';

export function GameOverScreen() {
  const run = useGameStore((s) => s.run);
  const reset = useGameStore((s) => s.resetToCharacterSelect);
  if (!run) return null;

  const won = run.outcome === 'won';

  // When the run ended in a loss, `run.outcome` is collapsed to 'caught' but
  // the last heist's richer outcome ('captured' vs 'trapped') is preserved on
  // run.heist.outcome — surface it as flavor so the player understands how
  // the run ended.
  const heistOutcome = run.heist?.outcome ?? null;
  const lossFlavor =
    heistOutcome === 'trapped'
      ? 'Boxed in — no legal move, no way through.'
      : heistOutcome === 'captured'
        ? 'The heat caught up before the vault did.'
        : 'The job went sideways.';

  const headline = won ? 'CLEAN GETAWAY' : 'CAUGHT';
  const subtitle = won
    ? `You pulled off ${run.map.length} jobs as ${run.character.name} and walked away.`
    : `${run.character.name} got pinched on job ${run.nodeIndex + 1}.`;

  return (
    <div className="screen game-over">
      <h1>{headline}</h1>
      <p className="subtitle">{subtitle}</p>
      {!won && <p className="muted">{lossFlavor}</p>}
      <p>Final character die: <DieGlyph size={run.characterDie} px={20} /></p>
      <p className="muted">
        Abilities collected: {run.abilities.length}
      </p>
      <button className="primary big" onClick={reset}>
        {won ? 'NEW RUN' : 'TRY AGAIN'}
      </button>
    </div>
  );
}
