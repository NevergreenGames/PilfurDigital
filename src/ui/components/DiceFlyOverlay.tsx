import { CSSProperties, useLayoutEffect, useRef, useState } from 'react';
import { Die } from '../../engine/types';
import { DieView } from './DieView';

export interface FlyingDieInstance {
  id: string;               // unique per flight (tileId + dieId)
  die: Die;
  fromRect: DOMRect;
  toRect: DOMRect;
  durationMs?: number;      // default 500
  onArrive?: () => void;
}

interface Props {
  flying: FlyingDieInstance[];
}

export function DiceFlyOverlay({ flying }: Props) {
  return (
    <>
      {flying.map((f) => (
        <FlyingDie key={f.id} instance={f} />
      ))}
    </>
  );
}

function FlyingDie({ instance }: { instance: FlyingDieInstance }) {
  const { die, fromRect, toRect, durationMs = 500, onArrive } = instance;
  const [armed, setArmed] = useState(false);
  const arrivedRef = useRef(false);

  useLayoutEffect(() => {
    // Double-rAF so the initial-transform render commits before the final-transform
    // render applies; otherwise the browser may collapse them into one paint.
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => setArmed(true));
      (raf1 as unknown as { next?: number }).next = raf2;
    });
    return () => cancelAnimationFrame(raf1);
  }, []);

  const dx = toRect.left + toRect.width / 2 - (fromRect.left + fromRect.width / 2);
  const dy = toRect.top + toRect.height / 2 - (fromRect.top + fromRect.height / 2);

  const style: CSSProperties = {
    position: 'fixed',
    left: fromRect.left,
    top: fromRect.top,
    width: fromRect.width,
    height: fromRect.height,
    zIndex: 100,
    pointerEvents: 'none',
    transition: `transform ${durationMs}ms cubic-bezier(0.34, 1.1, 0.64, 1), opacity ${durationMs}ms ease-out`,
    transform: armed
      ? `translate(${dx}px, ${dy}px) scale(0.6)`
      : 'translate(0, 0) scale(1)',
    opacity: armed ? 0.3 : 1,
    filter: 'drop-shadow(0 0 6px rgba(247, 118, 142, 0.6))',
  };

  const handleTransitionEnd = () => {
    if (arrivedRef.current) return;
    arrivedRef.current = true;
    onArrive?.();
  };

  return (
    <div style={style} onTransitionEnd={handleTransitionEnd}>
      <DieView die={die} disabled />
    </div>
  );
}
