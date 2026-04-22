import { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { PhaseCard, Requirement, Tile } from '../../engine/types';

// Track A: Icon/glyph mapping. Keyed on card id (from PHASE_CARDS + target ids).
// Falls back to a heuristic based on the card name, then a generic icon.
const ICON_BY_ID: Record<string, string> = {
  pickLock: '🔓',
  retinaScanner: '👁',
  hackTurret: '🛡',
  disableCams: '📷',
  bodyguard: '🥊',
  petGuardDog: '🐕',
  lasers: '✨',
  motionSensors: '📡',
  pressurePlates: '🟰',
  jumpFence: '🏃',
  electricFence: '⚡',
  elevatorShaft: '🛗',
  highjackTank: '🪖',
  nightVision: '🌙',
  skylightRepel: '🪂',
  airDuct: '💨',
  netsec: '🖧',
  blackout: '🌑',
  smokeBomb: '💨',
  sleightOfHand: '🤹',
  graplingHook: '🪝',
  bribeGuard: '💰',
};

function nameBasedIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('lock') || n.includes('key')) return '🔓';
  if (n.includes('cam')) return '📷';
  if (n.includes('dog')) return '🐕';
  if (n.includes('guard')) return '🥊';
  if (n.includes('safe') || n.includes('vault')) return '💰';
  if (n.includes('wire')) return '🔌';
  if (n.includes('shadow') || n.includes('dark')) return '🌑';
  if (n.includes('hack') || n.includes('net')) return '🖧';
  if (n.includes('laser')) return '✨';
  if (n.includes('fence')) return '⚡';
  if (n.includes('bomb')) return '💣';
  return '?';
}

export function iconForCard(card: PhaseCard): string {
  // strip suffix from generated ids (e.g., "pickLock#r2c3" or "safe#goal-0")
  const baseId = card.id.split('#')[0];
  if (ICON_BY_ID[baseId]) return ICON_BY_ID[baseId];
  if (card.type === 'goal') return '💎';
  return nameBasedIcon(card.name);
}

// Requirement glyph encoding:
//   Σ = sum, × = x-of-a-kind, ↗ = straight
const OP_GLYPH: Record<string, string> = {
  lt: '<',
  lte: '≤',
  eq: '=',
  gte: '≥',
  gt: '>',
};

export function requirementGlyph(req: Requirement): string {
  switch (req.kind) {
    case 'sum': {
      const op = OP_GLYPH[req.op] ?? '=';
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
  tile: Tile;
  isPlayer: boolean;
  isTargetTile: boolean;
  canMove: boolean;
  canFulfill: boolean;
  willSucceed: boolean;
  onClick?: () => void;
  onHoverStart?: (rect: DOMRect) => void;
  onHoverEnd?: () => void;
}

export function TileView({
  tile,
  isPlayer,
  isTargetTile,
  canMove,
  canFulfill,
  willSucceed,
  onClick,
  onHoverStart,
  onHoverEnd,
}: Props) {
  const classes = ['hg-tile', `hg-tile--${tile.kind}`, `hg-tile--${tile.state}`];
  if (canMove) classes.push('hg-tile--movable');
  if (canFulfill) classes.push('hg-tile--fulfillable');
  if (willSucceed) classes.push('hg-tile--will-succeed');

  const interactive = canMove || canFulfill;

  // Fog rendering: hidden tiles are obscured, but the target tile's glyph peeks through.
  const isHidden = tile.state === 'hidden';
  const showFog = isHidden;
  const peekTarget = isHidden && isTargetTile && tile.card;

  // Only show the full card (icon / requirement / reward dice) on revealed,
  // unfulfilled tiles. Fulfilled tiles are just footprints per spec.
  const showCardDetails = tile.state === 'revealed' && tile.card !== null;

  const handleMouseEnter = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!onHoverStart) return;
    onHoverStart(e.currentTarget.getBoundingClientRect());
  };

  const style: CSSProperties | undefined = interactive ? { cursor: 'pointer' } : undefined;

  return (
    <div
      className={classes.join(' ')}
      onClick={interactive ? onClick : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onHoverEnd}
      style={style}
      role={interactive ? 'button' : undefined}
      aria-label={tile.card ? tile.card.name : tile.kind}
    >
      {/* Revealed content */}
      {showCardDetails && tile.card && (
        <>
          <div className="hg-tile-head">
            <div className="hg-tile-glyph">{iconForCard(tile.card)}</div>
            <div className="hg-tile-req">{requirementGlyph(tile.card.requirement)}</div>
          </div>
          {tile.card.type === 'goal' && (
            <div className="hg-tile-name">{tile.card.name}</div>
          )}
          <div className="hg-tile-dice">
            {tile.card.momentumDice.map((size, i) => (
              <span key={i} className={`hg-die-badge hg-die-d${size}`}>
                d{size}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Start tile — just show a footprint glyph */}
      {!isHidden && tile.kind === 'start' && !isPlayer && (
        <div className="hg-tile-head">
          <div className="hg-tile-glyph">⌂</div>
        </div>
      )}

      {/* Wall tiles render no content — the background pattern carries them. */}

      {/* Fulfilled markers */}
      {tile.state === 'playerFulfilled' && <div className="hg-tile-check">✓</div>}
      {tile.state === 'heatFulfilled' && <div className="hg-tile-lock">🔒</div>}

      {/* Fog overlay */}
      {showFog && (
        <div
          className={`hg-tile-fog ${peekTarget ? 'hg-tile-fog--target-peek' : ''}`}
        >
          {peekTarget && tile.card ? iconForCard(tile.card) : ''}
        </div>
      )}

      {/* Player pawn overlay */}
      {isPlayer && (
        <div className="hg-pawn">
          <div className="hg-pawn-inner">@</div>
        </div>
      )}
    </div>
  );
}
