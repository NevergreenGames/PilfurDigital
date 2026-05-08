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

// Requirement glyph encoding (compact, one-line per tile face):
//   Σ = sum, × = x-of-a-kind, ↗ = straight,
//   ◐ = evens, ◑ = odds, ★ = maxes (count follows the symbol).
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
      // Compact suffix encoding for the dice-count constraints.
      //   exactDice=N     → "·=N"
      //   min+max         → "·M-N"
      //   min only (>1)   → "·M+"
      //   max only        → "·≤N"
      let suffix = '';
      if (req.exactDice !== undefined) {
        suffix = `·=${req.exactDice}`;
      } else if (req.minDice !== undefined && req.maxDice !== undefined) {
        suffix = `·${req.minDice}-${req.maxDice}`;
      } else if (req.minDice && req.minDice > 1) {
        suffix = `·${req.minDice}+`;
      } else if (req.maxDice !== undefined) {
        suffix = `·≤${req.maxDice}`;
      }
      return `Σ${op}${req.value}${suffix}`;
    }
    case 'xOfAKind':
      return `×${req.count}`;
    case 'straight':
      return `↗${req.length}`;
    case 'evens':
      return `◐${req.count}`;
    case 'odds':
      return `◑${req.count}`;
    case 'maxes':
      return `★${req.count}`;
  }
}

interface Props {
  tile: Tile;
  isPlayer: boolean;
  isTargetTile: boolean;
  canMove: boolean;
  canFulfill: boolean;
  willSucceed: boolean;
  // True when the active character (Demolitionist BREACH) can reclaim
  // this heat-fulfilled tile by spending dice >= heatClaimSum. Drives
  // the alternate render: card name + Σ ≥ N requirement instead of the
  // bare lock emoji.
  breachable?: boolean;
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
  // Ripple-in animation delay (ms). When set, the tile gains the
  // .ripple-cell class so it pops into view at the chosen offset. Set
  // once on initial heist mount via rippleStyle() in GridView.
  rippleDelayMs?: number;
  // Glyph rendered as the player pawn — usually the active character's
  // emoji icon. Falls back to '@' when not provided so legacy callers
  // and tests still get a recognizable pawn.
  playerIcon?: string;
}

export function TileView({
  tile,
  isPlayer,
  isTargetTile,
  canMove,
  canFulfill,
  willSucceed,
  breachable,
  onClick,
  onHoverStart,
  onHoverEnd,
  pendingFill,
  loomingDice,
  rippleDelayMs,
  playerIcon,
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
  if (breachable) classes.push('hg-tile--breachable');
  // Cache tiles wear their gold border at every state — the player sees
  // them as caches from the start of the heist even while still under
  // fog. Only the requirement / specific card details are gated on
  // normal fog reveal.
  const isCache = !!tile.card?.cacheReward;
  if (isCache) classes.push('hg-tile--cache');
  // Event tiles ("?" nodes) wear a magenta accent at every state so the
  // player can spot them through fog and aim for them — same idea as the
  // cache treatment.
  const isEvent = tile.kind === 'event' && !!tile.eventDef;
  if (isEvent) classes.push('hg-tile--event');
  if (rippleDelayMs !== undefined) classes.push('ripple-cell');

  const interactive = canMove || canFulfill;

  // Fog rendering: hidden tiles are obscured, but the target tile's
  // glyph peeks through, and cache tiles peek with a large ¢ so the
  // player can see them as caches without the requirement details.
  const isHidden = effectiveState === 'hidden';
  const showFog = isHidden;
  const peekTarget = isHidden && isTargetTile && tile.card;
  const peekCache = isHidden && isCache && !peekTarget;
  const peekEvent = isHidden && isEvent && !peekTarget && !peekCache;

  // Only show the full card (icon / requirement / reward dice) on revealed,
  // unfulfilled tiles. Fulfilled tiles are just footprints per spec.
  const showCardDetails = effectiveState === 'revealed' && tile.card !== null;

  const handleMouseEnter = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!onHoverStart) return;
    onHoverStart(e.currentTarget.getBoundingClientRect());
  };

  const style: CSSProperties =
    interactive ? { cursor: 'pointer' } : {};
  if (rippleDelayMs !== undefined) {
    style.animationDelay = `${rippleDelayMs}ms`;
  }

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

      {/* Event tile — large "?" sigil. Renders only while still revealed
          (unconsumed). After the player resolves the modal the tile state
          flips to playerFulfilled, which the ✓ marker below picks up. */}
      {!isHidden && isEvent && tile.state === 'revealed' && (
        <div className="hg-tile-head">
          <div className="hg-tile-event-glyph" aria-hidden>?</div>
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
      {tile.state === 'heatFulfilled' && !breachable && (
        <div className="hg-tile-lock">🔒</div>
      )}
      {/* Demolitionist BREACH — show the reclaim requirement (Σ ≥ N) and a
          ghost of the original card name in place of the lock so the player
          can see what they're cracking and what it'll cost. */}
      {tile.state === 'heatFulfilled' && breachable && tile.heatClaimSum !== undefined && (
        <>
          {tile.card && (
            <div className="hg-tile-head hg-tile-head--breach">
              <div className="hg-tile-glyph">{iconForCard(tile.card)}</div>
            </div>
          )}
          <div className="hg-tile-breach-req" title={`Spend dice summing ≥ ${tile.heatClaimSum}`}>
            ≥ {tile.heatClaimSum}
          </div>
        </>
      )}

      {/* Fog overlay */}
      {showFog && (
        <div
          className={`hg-tile-fog ${peekTarget ? 'hg-tile-fog--target-peek' : ''} ${
            peekCache ? 'hg-tile-fog--cache-peek' : ''
          } ${peekEvent ? 'hg-tile-fog--event-peek' : ''}`}
        >
          {peekTarget && tile.card
            ? iconForCard(tile.card)
            : peekCache
              ? '¢'
              : peekEvent
                ? '?'
                : ''}
        </div>
      )}

      {/* Player pawn overlay */}
      {isPlayer && (
        <div className="hg-pawn">
          <div className="hg-pawn-inner">{playerIcon ?? '@'}</div>
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
