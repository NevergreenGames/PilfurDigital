import { useGameStore } from '../../state/gameStore';

export function GameOverScreen() {
  const run = useGameStore((s) => s.run);
  const reset = useGameStore((s) => s.resetToCharacterSelect);
  if (!run) return null;
  const won = run.outcome === 'won';
  return (
    <div className="screen game-over">
      <h1>{won ? 'CLEAN GETAWAY' : 'CAUGHT'}</h1>
      <p className="subtitle">
        {won
          ? `You pulled off ${run.map.length} jobs as ${run.character.name} and walked away.`
          : `${run.character.name} got pinched on job ${run.nodeIndex + 1}.`}
      </p>
      <p>Final character die: d{run.characterDie}</p>
      <button className="primary big" onClick={reset}>
        NEW RUN
      </button>
    </div>
  );
}
