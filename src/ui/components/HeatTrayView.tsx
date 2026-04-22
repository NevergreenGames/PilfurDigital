import { Die } from '../../engine/types';
import { DieView } from './DieView';

interface Props {
  heat: Die[];
}

export function HeatTrayView({ heat }: Props) {
  const rolled = heat.filter((d) => d.value !== null).length;
  return (
    <div>
      <div className={`hg-dice-row hg-heat-row ${heat.length === 0 ? 'hg-dice-row--empty' : ''}`}>
        {heat.length === 0 && <span>No heat. Yet.</span>}
        {heat.map((die) => (
          <DieView key={die.id} die={die} disabled />
        ))}
      </div>
      <div className="hg-dice-summary">
        <span>
          {heat.length} heat · {rolled} rolled
        </span>
      </div>
    </div>
  );
}
