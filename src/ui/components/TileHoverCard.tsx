import { CSSProperties, useLayoutEffect, useRef, useState } from 'react';
import { PhaseCard } from '../../engine/types';
import { describeRequirement } from '../../engine/requirements';

interface Props {
  card: PhaseCard;
  anchor: DOMRect;
}

const CARD_WIDTH = 220;
const VIEWPORT_PAD = 8;

export function TileHoverCard({ card, anchor }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [clamp, setClamp] = useState<{ left: number; top: number } | null>(null);

  // Preferred position: to the right of the anchor, vertically centered.
  const preferredLeft = anchor.right + 8;
  const preferredTop = anchor.top + anchor.height / 2 - 60;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = preferredLeft;
    let top = preferredTop;
    if (left + CARD_WIDTH + VIEWPORT_PAD > vw) {
      left = anchor.left - CARD_WIDTH - 8;
    }
    if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;
    if (top + h + VIEWPORT_PAD > vh) top = vh - h - VIEWPORT_PAD;
    if (top < VIEWPORT_PAD) top = VIEWPORT_PAD;
    setClamp({ left, top });
  }, [anchor, preferredLeft, preferredTop]);

  const style: CSSProperties = {
    left: clamp?.left ?? preferredLeft,
    top: clamp?.top ?? preferredTop,
    width: CARD_WIDTH,
    visibility: clamp ? 'visible' : 'hidden',
  };

  return (
    <div ref={ref} className="hg-hover-card" style={style} role="tooltip">
      <div className="hg-hover-card-name">
        {card.name}
        {card.type === 'goal' && <span className="hg-hover-card-badge">TARGET</span>}
      </div>
      <div className="hg-hover-card-req">{describeRequirement(card.requirement)}</div>
      {card.onPlayEffect && (
        <div className="hg-hover-card-effect">✦ {card.onPlayEffect.text}</div>
      )}
      {card.momentumDice.length > 0 && (
        <>
          <div className="hg-hover-card-dice-label">Reward</div>
          <div className="hg-hover-card-dice">
            {card.momentumDice.map((size, i) => (
              <span key={i} className={`die-chip die-d${size}`}>d{size}</span>
            ))}
          </div>
        </>
      )}
      {card.flavor && (
        <div className="hg-hover-card-effect" style={{ color: 'var(--muted)' }}>
          <em>{card.flavor}</em>
        </div>
      )}
    </div>
  );
}
