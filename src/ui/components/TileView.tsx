import { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { Die, PhaseCard, Requirement, Tile } from '../../engine/types';
import { DieGlyph } from './DieGlyph';

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
  // Explicit icon on the card always wins (used by goal tiles to surface
  // the HeistTarget's emoji).
  if (card.icon) return card.icon;
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
  // When set, the tile renders as still 'revealed' even if its underlying
  // state is heatFulfilled or playerFulfilled — used to delay the lock /
  // check animation until the flying-dice animation reaches the tile.
  pendingFill?: 'heat' | 'player';
  // Reserved heat dice currently looming over this tile (intent in flight,
  // about to fire on End Turn unless the player preempts).
  loomingDice?: Die[];
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
  pendingFill,
  loomingDice,
}: Props) {
  // Effective state for rendering. If a fill is pending, keep the tile
  // looking revealed while the dice-fly animation plays.
  const effectiveState = pendingFill ? 'revealed' : tile.state;

  const classes = ['hg-tile', `hg-tile--${tile.kind}`, `hg-tile--${effectiveState}`];
  if (canMove) classes.push('hg-tile--movable');
  if (canFulfill) classes.push('hg-tile--fulfillable');
  if (willSucceed) classes.push('hg-tile--will-succeed');
  if (pendingFill === 'heat') classes.push('hg-tile--heat-incoming');
  if (pendingFill === 'player') classes.push('hg-tile--player-incoming');
  if (loomingDice && loomingDice.length > 0) classes.push('hg-tile--threatened');
  // Cache tiles wear their gold border at every state — the player sees
  // them as caches from the start of the heist even while still under
  // fog. Only the requirement / specific card details are gated on
  // normal fog reveal.
  const isCache = !!tile.card?.cacheReward;
  if (isCache) classes.push('hg-tile--cache');

  const interactive = canMove || canFulfill;

  // Fog rendering: hidden tiles are obscured, but the target tile's
  // glyph peeks through, and cache tiles peek with a large ¢ so the
  // player can see them as caches without the requirement details.
  const isHidden = effectiveState === 'hidden';
  const showFog = isHidden;
  const peekTarget = isHidden && isTargetTile && tile.card;
  const peekCache = isHidden && isCache && !peekTarget;

  // Only show the full card (icon / requirement / reward dice) on revealed,
  // unfulfilled tiles. Fulfilled tiles are just footprints per spec.
  const showCardDetails = effectiveState === 'revealed' && tile.card !== null;

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
      data-tile-id={tile.id}
    >
      {/* Revealed content */}
      {showCardDetails && tile.card && (
        <>
          <div className="hg-tile-head">
            <div className="hg-tile-glyph">{iconForCard(tile.card)}</div>
          </div>
          {(tile.card.type === 'goal' || tile.card.cacheReward) && (
            <div className="hg-tile-name">{tile.card.name}</div>
          )}
          <div className="hg-tile-req">{requirementGlyph(tile.card.requirement)}</div>
          {tile.card.momentumDice.length > 0 && (
            <div className="hg-tile-dice">
              {tile.card.momentumDice.map((size, i) => (
                <span key={i} className={`hg-tile-die hg-tile-die-d${size}`}>
                  <DieGlyph size={size} px={16} />
                </span>
              ))}
            </div>
          )}
          {tile.card.cacheReward ? (
            <div
              className="hg-tile-cache-badge"
              title={`Cache — fulfill to bank ¢${tile.card.cacheReward}`}
            >
              +¢{tile.card.cacheReward}
            </div>
          ) : null}
        </>
      )}

      {/* Start tile — just show a footprint glyph */}
      {!isHidden && tile.kind === 'start' && !isPlayer && (
        <div className="hg-tile-head">
          <div className="hg-tile-glyph">⌂</div>
        </div>
      )}

      {/* Faint reroll glyph on walkable adjacent tiles — clicking moves the
          player onto the tile, which ends the turn and rerolls dice. */}
      {canMove && !isPlayer && (
        <div className="hg-tile-reroll-glyph" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="48" height="48">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 12a9 9 0 0 1 15.5-6.3M21 4v5h-5M21 12a9 9 0 0 1-15.5 6.3M3 20v-5h5"
            />
          </svg>
        </div>
      )}

      {/* Wall tiles render no content — the background pattern carries them. */}

      {/* Fulfilled markers */}
      {tile.state === 'playerFulfilled' && <div className="hg-tile-check">✓</div>}
      {tile.state === 'heatFulfilled' && <div className="hg-tile-lock">🔒</div>}

      {/* Fog overlay */}
      {showFog && (
        <div
          className={`hg-tile-fog ${peekTarget ? 'hg-tile-fog--target-peek' : ''} ${
            peekCache ? 'hg-tile-fog--cache-peek' : ''
          }`}
        >
          {peekTarget && tile.card
            ? iconForCard(tile.card)
            : peekCache
              ? '¢'
              : ''}
        </div>
      )}

      {/* Player pawn overlay */}
      {isPlayer && (
        <div className="hg-pawn">
          <div className="hg-pawn-inner">@</div>
        </div>
      )}
      {/* Looming heat dice are rendered by GridView in a layer above
          .hg-viewport so they can extend past the viewport's clip rectangle
          when a threatened tile is at the edge of the visible window. The
          `loomingDice` prop is consumed only to drive the `--threatened`
          class for the pulsing tile outline (see classes[] above). */}
    </div>
  );
}
