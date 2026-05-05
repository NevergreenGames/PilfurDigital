import { useEffect, useState } from 'react';
import { Die } from '../../engine/types';
import { DieView } from './DieView';

interface Props {
  heat: Die[];
  // Increments each time the heat dice are rolled. Drives the jiggle.
  rollNonce?: number;
}

export function HeatTrayView({ heat, rollNonce }: Props) {
  const rolled = heat.filter((d) => d.value !== null).length;
  const [jiggling, setJiggling] = useState(false);
  useEffect(() => {
    if (rollNonce === undefined) return;
    setJiggling(true);
    const t = window.setTimeout(() => setJiggling(false), 700);
    return () => window.clearTimeout(t);
  }, [rollNonce]);
  return (
    <div>
      <div
        className={`hg-dice-row hg-heat-row ${heat.length === 0 ? 'hg-dice-row--empty' : ''} ${
          jiggling ? 'hg-dice-row--jiggling' : ''
        }`}
      >
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
