import { useEffect, useState } from 'react';
import { Die, HeistState, Tile } from '../../engine/types';
import { findSatisfyingSubset, isSubsetSatisfying } from '../../engine/requirements';
import { TileView } from './TileView';
import { TileHoverCard } from './TileHoverCard';

interface Props {
  heist: HeistState;
  selectedDice: Die[];
  onTileClick: (tile: Tile) => void;
  // Emits the currently hovered revealed tile (with a card) upward so the
  // sidebar can preview cost/reward on the pool view. null when nothing is hovered.
  onHoverChange?: (tile: Tile | null) => void;
}

function isAdjacent(ar: number, ac: number, br: number, bc: number): boolean {
  if (ar === br && ac === bc) return false;
  return Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1;
}

function isWalkable(t: Tile): boolean {
  return t.kind === 'start' || t.state === 'playerFulfilled';
}

function isUnfulfilledRevealed(t: Tile): boolean {
  return t.state === 'revealed' && !!t.card;
}

export function GridView({ heist, selectedDice, onTileClick, onHoverChange }: Props) {
  const [hover, setHover] = useState<{ tile: Tile; rect: DOMRect } | null>(null);
  const { grid, player } = heist;
  const isOver = !!heist.outcome;

  // Emit hover upward whenever the hovered tile changes.
  useEffect(() => {
    if (!onHoverChange) return;
    onHoverChange(hover?.tile ?? null);
  }, [hover?.tile.id, onHoverChange]);

  // Emit null on unmount so the sidebar preview clears if the grid unmounts.
  useEffect(() => {
    return () => {
      if (onHoverChange) onHoverChange(null);
    };
  }, [onHoverChange]);

  // findSatisfyingSubset needs rolled dice; filter.
  const rolledPool = heist.pool.filter((d) => d.value !== null);

  return (
    <div className="hg-grid-wrap">
      <div className="hg-grid" role="grid" aria-label="Heist grid">
        {grid.tiles.map((tile) => {
          const isPlayer = tile.pos.row === player.row && tile.pos.col === player.col;
          const isTargetTile =
            tile.pos.row === grid.target.row && tile.pos.col === grid.target.col;

          const adjacent = isAdjacent(
            player.row,
            player.col,
            tile.pos.row,
            tile.pos.col,
          );

          const canMove =
            !isOver && adjacent && isWalkable(tile) && !isPlayer;

          const fulfillable =
            !isOver && adjacent && isUnfulfilledRevealed(tile) && tile.card !== null;

          const willSucceed =
            fulfillable && tile.card
              ? selectedDice.length > 0
                ? isSubsetSatisfying(selectedDice, tile.card.requirement)
                : findSatisfyingSubset(rolledPool, tile.card.requirement) !== null
              : false;

          const canFulfill = fulfillable;

          const hoverable =
            !isOver &&
            tile.card !== null &&
            tile.state === 'revealed';

          return (
            <TileView
              key={tile.id}
              tile={tile}
              isPlayer={isPlayer}
              isTargetTile={isTargetTile}
              canMove={canMove}
              canFulfill={canFulfill}
              willSucceed={willSucceed}
              onClick={() => onTileClick(tile)}
              onHoverStart={
                hoverable
                  ? (rect) => setHover({ tile, rect })
                  : undefined
              }
              onHoverEnd={
                hoverable
                  ? () => setHover((h) => (h?.tile.id === tile.id ? null : h))
                  : undefined
              }
            />
          );
        })}
      </div>
      {hover && hover.tile.card && (
        <TileHoverCard card={hover.tile.card} anchor={hover.rect} />
      )}
    </div>
  );
}
