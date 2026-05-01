import { MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Die, HeatIntent, HeistState, Position, Tile } from '../../engine/types';
import { findSatisfyingSubset, isSubsetSatisfying } from '../../engine/requirements';
import { TileView } from './TileView';
import { TileHoverCard } from './TileHoverCard';
import { DieView } from './DieView';

interface Props {
  heist: HeistState;
  selectedDice: Die[];
  onTileClick: (tile: Tile) => void;
  onHoverChange?: (tile: Tile | null) => void;
  // Heat intents whose forward fly has arrived — looming dice render on tile.
  arrivedHeatIntents?: Set<string>;
  // Player fulfill mid-fly — render tile as still revealed.
  pendingPlayerTile?: string | null;
}

// Viewport / camera constants. Must match the CSS (TILE_PX + GAP_PX).
const VIEWPORT_TILES = 5; // visible window
const TILE_PX = 120;
const GAP_PX = 4;
const STEP_PX = TILE_PX + GAP_PX;
const CAMERA_MIN = Math.floor(VIEWPORT_TILES / 2); // 2 — viewport-center offset

// Camera bounds depend on the grid's dimensions. When the grid is larger
// than the viewport (the standard 7x7 case), the camera is clamped so the
// viewport never shows past the grid edge. When the grid fits inside the
// viewport (e.g. the 5x5 first heist), the camera is locked to the grid's
// center so the grid stays centered with no panning available.
function cameraBoundsFor(rows: number, cols: number): {
  minR: number;
  maxR: number;
  minC: number;
  maxC: number;
} {
  const half = CAMERA_MIN;
  const minR = Math.min(half, Math.floor((rows - 1) / 2));
  const maxR = Math.max(minR, rows - 1 - half);
  const minC = Math.min(half, Math.floor((cols - 1) / 2));
  const maxC = Math.max(minC, cols - 1 - half);
  return { minR, maxR, minC, maxC };
}

function clampCamera(p: Position, rows: number, cols: number): Position {
  const b = cameraBoundsFor(rows, cols);
  return {
    row: Math.max(b.minR, Math.min(b.maxR, p.row)),
    col: Math.max(b.minC, Math.min(b.maxC, p.col)),
  };
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

export function GridView({
  heist,
  selectedDice,
  onTileClick,
  onHoverChange,
  arrivedHeatIntents,
  pendingPlayerTile,
}: Props) {
  const intentByTileId = new Map(
    heist.heatIntents.map((i) => [i.tileId, i] as const),
  );
  const [hover, setHover] = useState<{ tile: Tile; rect: DOMRect } | null>(null);
  const { grid, player } = heist;
  const isOver = !!heist.outcome;

  // Camera state.
  const [camera, setCamera] = useState<Position>(() => clampCamera(player, grid.rows, grid.cols));

  useEffect(() => {
    setCamera(clampCamera(player, grid.rows, grid.cols));
  }, [player.row, player.col, grid.rows, grid.cols]);

  const pan = useCallback((dr: number, dc: number) => {
    setCamera((c) => clampCamera({ row: c.row + dr, col: c.col + dc }, grid.rows, grid.cols));
  }, [grid.rows, grid.cols]);

  // Keyboard pan (kept).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          pan(-1, 0);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          pan(1, 0);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          pan(0, -1);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          pan(0, 1);
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pan]);

  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Click-and-drag: hold mouse on the viewport to grab the grid; releasing
  // snaps the camera to the nearest tile alignment based on drag distance.
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startCamera: Position;
    moved: boolean;
  } | null>(null);
  // Set true when a mouse-up ends a real drag — used to suppress the trailing
  // click event so the player doesn't accidentally fulfill/move on release.
  const wasDragRef = useRef(false);
  const DRAG_THRESHOLD_PX = 4;

  // Window-level mouse listeners while a drag is active, so the gesture
  // continues smoothly even if the cursor leaves the viewport.
  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      const ref = dragRef.current;
      if (!ref) return;
      const dx = e.clientX - ref.startX;
      const dy = e.clientY - ref.startY;
      // Clamp to the camera's reachable bounds so the grid can't be dragged
      // into empty space beyond the world edge. Bounds are grid-size-aware:
      // when the grid fits in the viewport, both min and max collapse to a
      // single position so the drag is effectively disabled.
      const bounds = cameraBoundsFor(grid.rows, grid.cols);
      const maxX = (ref.startCamera.col - bounds.minC) * STEP_PX;
      const minX = -(bounds.maxC - ref.startCamera.col) * STEP_PX;
      const maxY = (ref.startCamera.row - bounds.minR) * STEP_PX;
      const minY = -(bounds.maxR - ref.startCamera.row) * STEP_PX;
      const cdx = Math.max(minX, Math.min(maxX, dx));
      const cdy = Math.max(minY, Math.min(maxY, dy));
      if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
        ref.moved = true;
      }
      setDragOffset({ x: cdx, y: cdy });
    };

    const onUp = () => {
      const ref = dragRef.current;
      if (!ref) return;
      if (ref.moved) {
        // Snap camera based on whole-tile drag distance. Negative because
        // dragging the grid right exposes leftward tiles (camera moves left).
        const dCols = Math.round(dragOffset.x / STEP_PX);
        const dRows = Math.round(dragOffset.y / STEP_PX);
        setCamera(
          clampCamera({
            row: ref.startCamera.row - dRows,
            col: ref.startCamera.col - dCols,
          }, grid.rows, grid.cols),
        );
        wasDragRef.current = true;
        // Clear after the trailing click event has had a tick to fire.
        window.setTimeout(() => {
          wasDragRef.current = false;
        }, 0);
      }
      setDragOffset({ x: 0, y: 0 });
      dragRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, dragOffset.x, dragOffset.y]);

  const onViewportMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // left-click only
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startCamera: camera,
      moved: false,
    };
    setIsDragging(true);
  };

  // Wraps the tile-click prop so a drag-release doesn't fire a tile action.
  const guardedTileClick = (tile: Tile) => {
    if (wasDragRef.current) return;
    onTileClick(tile);
  };

  // Emit hover upward whenever the hovered tile changes.
  useEffect(() => {
    if (!onHoverChange) return;
    onHoverChange(hover?.tile ?? null);
  }, [hover?.tile.id, onHoverChange]);

  useEffect(() => {
    return () => {
      if (onHoverChange) onHoverChange(null);
    };
  }, [onHoverChange]);

  // Rolled pool: explicit useMemo so React re-derives the filtered list (and
  // the per-tile fulfillability that depends on it) whenever heist.pool
  // changes — a roll, reroll, fulfill, or ability that mutates dice values.
  const rolledPool = useMemo(
    () => heist.pool.filter((d) => d.value !== null),
    [heist.pool],
  );

  // Per-tile fulfillability map. Recomputed whenever the pool, the player's
  // selection, or the grid changes, so the green "will-succeed" outline
  // reflects the current dice state at all times.
  const willSucceedByTileId = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const tile of grid.tiles) {
      if (tile.state !== 'revealed' || !tile.card) continue;
      const reqMet =
        selectedDice.length > 0
          ? isSubsetSatisfying(selectedDice, tile.card.requirement)
          : findSatisfyingSubset(rolledPool, tile.card.requirement) !== null;
      map.set(tile.id, reqMet);
    }
    return map;
  }, [grid.tiles, selectedDice, rolledPool]);

  // Translate offset for the absolutely-positioned grid inside the viewport.
  // While dragging, add the in-flight drag offset on top of the camera-derived
  // translation for sub-tile precision, and disable the CSS transition so the
  // grid follows the cursor 1:1.
  const offsetX = -(camera.col - CAMERA_MIN) * STEP_PX + dragOffset.x;
  const offsetY = -(camera.row - CAMERA_MIN) * STEP_PX + dragOffset.y;
  const translate = `translate(${offsetX}px, ${offsetY}px)`;

  // ───────────────────────────────────────────────────────────────────────
  // Off-screen indicators: one for the target, one for the player. Each
  // appears only when its entity is outside the visible viewport, and
  // clicking it pans the camera to bring that entity back into view.
  // ───────────────────────────────────────────────────────────────────────
  const VIEW_PX = VIEWPORT_TILES * TILE_PX + (VIEWPORT_TILES - 1) * GAP_PX;
  const COMPASS_PX = 56;
  const COMPASS_INSET = 6;
  const HALF = COMPASS_PX / 2;
  const WRAP_PADDING = 12;
  const center = VIEW_PX / 2;

  // Helper: project an entity's pixel position onto the viewport rectangle.
  // Returns { inside, left, top, bearingDeg }, where left/top are
  // wrap-relative for absolute placement of the compass widget.
  const computeEdge = (entityRow: number, entityCol: number) => {
    const vx = (entityCol - camera.col + CAMERA_MIN) * STEP_PX + TILE_PX / 2;
    const vy = (entityRow - camera.row + CAMERA_MIN) * STEP_PX + TILE_PX / 2;
    const inside = vx >= 0 && vx <= VIEW_PX && vy >= 0 && vy <= VIEW_PX;
    let edgeX = Math.max(0, Math.min(VIEW_PX, vx));
    let edgeY = Math.max(0, Math.min(VIEW_PX, vy));
    if (inside) {
      // Slide to the nearest edge so the (still-rendered) widget hugs that side.
      const dL = vx;
      const dR = VIEW_PX - vx;
      const dT = vy;
      const dB = VIEW_PX - vy;
      const m = Math.min(dL, dR, dT, dB);
      if (m === dL) edgeX = 0;
      else if (m === dR) edgeX = VIEW_PX;
      else if (m === dT) edgeY = 0;
      else edgeY = VIEW_PX;
    }
    const minB = HALF + COMPASS_INSET;
    const maxB = VIEW_PX - HALF - COMPASS_INSET;
    const ix = Math.max(minB, Math.min(maxB, edgeX));
    const iy = Math.max(minB, Math.min(maxB, edgeY));
    const bearingDeg = (Math.atan2(vy - center, vx - center) * 180) / Math.PI;
    return {
      inside,
      left: WRAP_PADDING + ix - HALF,
      top: WRAP_PADDING + iy - HALF,
      bearingDeg,
    };
  };

  // Recenter helper — called when an indicator is clicked.
  const recenterOn = (row: number, col: number) => {
    setCamera(clampCamera({ row, col }, grid.rows, grid.cols));
  };

  // ───────────────────────────────────────────────────────────────────────
  // Looming heat dice positions — rendered in a layer above the viewport
  // (sibling to .hg-viewport, child of .hg-grid-wrap) so they can extend
  // past the viewport's clip rectangle when a threatened tile sits on the
  // edge of the visible window. Position is computed in wrap-coordinates
  // and tracks the camera in real-time via the same translate transform.
  // ───────────────────────────────────────────────────────────────────────
  const LOOM_OFFSET_TOP_PX = 22;
  const loomPositions = useMemo(() => {
    if (!arrivedHeatIntents) return [] as Array<{
      intent: HeatIntent;
      left: number;
      top: number;
      visible: boolean;
    }>;
    return heist.heatIntents
      .filter((intent) => arrivedHeatIntents.has(intent.tileId))
      .map((intent) => {
        const tile = grid.tiles.find((t) => t.id === intent.tileId);
        if (!tile) return null;
        // Track drag offset so the loom stays glued to the tile during a
        // click-and-drag pan (the grid uses dragOffset on its transform).
        const tileLeft =
          WRAP_PADDING +
          (tile.pos.col - camera.col + CAMERA_MIN) * STEP_PX +
          dragOffset.x;
        const tileTop =
          WRAP_PADDING +
          (tile.pos.row - camera.row + CAMERA_MIN) * STEP_PX +
          dragOffset.y;
        const visible =
          Math.abs(tile.pos.row - camera.row) <= 2 &&
          Math.abs(tile.pos.col - camera.col) <= 2;
        return {
          intent,
          left: tileLeft + TILE_PX / 2,
          top: tileTop - LOOM_OFFSET_TOP_PX,
          visible,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [heist.heatIntents, arrivedHeatIntents, grid.tiles, camera, dragOffset]);

  // Target indicator
  const targetEdge = computeEdge(grid.target.row, grid.target.col);
  const targetDist = Math.max(
    Math.abs(grid.target.row - player.row),
    Math.abs(grid.target.col - player.col),
  );
  const showTargetCompass = !targetEdge.inside;

  // Player indicator (visible only when the camera is panned off the player)
  const playerEdge = computeEdge(player.row, player.col);
  const showPlayerCompass = !playerEdge.inside;

  return (
    <div className="hg-grid-wrap">
      <div
        className={`hg-viewport ${isDragging ? 'hg-viewport--dragging' : ''}`}
        aria-label="Heist grid viewport"
        ref={viewportRef}
        onMouseDown={onViewportMouseDown}
      >
        <div
          className="hg-grid"
          role="grid"
          style={{
            gridTemplateColumns: `repeat(${grid.cols}, ${TILE_PX}px)`,
            gridTemplateRows: `repeat(${grid.rows}, ${TILE_PX}px)`,
            transform: translate,
            transition: isDragging ? 'none' : undefined,
          }}
        >
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
              fulfillable && (willSucceedByTileId.get(tile.id) ?? false);

            const canFulfill = fulfillable;

            const hoverable =
              !isOver &&
              tile.card !== null &&
              tile.state === 'revealed';

            const pendingFill: 'heat' | 'player' | undefined =
              pendingPlayerTile === tile.id ? 'player' : undefined;

            // Looming heat dice — only render once the forward fly has arrived.
            const intent = intentByTileId.get(tile.id);
            const loomingDice: Die[] | undefined =
              intent && arrivedHeatIntents?.has(tile.id)
                ? intent.reservedDice
                : undefined;

            return (
              <TileView
                key={tile.id}
                tile={tile}
                isPlayer={isPlayer}
                isTargetTile={isTargetTile}
                canMove={canMove}
                canFulfill={canFulfill}
                willSucceed={willSucceed}
                pendingFill={pendingFill}
                loomingDice={loomingDice}
                onClick={() => guardedTileClick(tile)}
                onHoverStart={
                  hoverable ? (rect) => setHover({ tile, rect }) : undefined
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

      {/* Looming heat dice layer — sibling of viewport, so the cluster can
          extend above the viewport's clip rectangle and still stay centered
          over its threatened tile. */}
      {loomPositions.map(({ intent, left, top, visible }) => (
        <div
          key={intent.tileId}
          className="hg-loom-cluster"
          style={{
            left,
            top,
            transition: isDragging ? 'none' : undefined,
            visibility: visible ? 'visible' : 'hidden',
          }}
          aria-label="Heat looming over tile"
        >
          {intent.reservedDice.map((d) => (
            <DieView key={d.id} die={d} disabled />
          ))}
        </div>
      ))}

      {/* Target indicator — only when target is outside the viewport.
          Click pans the camera to bring the target into view. */}
      {showTargetCompass && (
        <button
          type="button"
          className="hg-compass hg-compass--target"
          style={{ left: targetEdge.left, top: targetEdge.top }}
          title={`Pan to target — ${targetDist} tile${targetDist === 1 ? '' : 's'} away`}
          aria-label={`Pan camera to target, ${targetDist} tiles away`}
          onClick={() => recenterOn(grid.target.row, grid.target.col)}
        >
          <div
            className="hg-compass-arrow"
            style={{ transform: `rotate(${targetEdge.bearingDeg}deg)` }}
            aria-hidden
          >
            ➤
          </div>
          <div className="hg-compass-distance">{targetDist}</div>
        </button>
      )}

      {/* Player indicator — only when the player pawn is off-screen
          (camera was panned away). Click pans back to the player. */}
      {showPlayerCompass && (
        <button
          type="button"
          className="hg-compass hg-compass--player"
          style={{ left: playerEdge.left, top: playerEdge.top }}
          title="Pan to player"
          aria-label="Pan camera to player"
          onClick={() => recenterOn(player.row, player.col)}
        >
          <div
            className="hg-compass-arrow"
            style={{ transform: `rotate(${playerEdge.bearingDeg}deg)` }}
            aria-hidden
          >
            ➤
          </div>
          <div className="hg-compass-distance">@</div>
        </button>
      )}
    </div>
  );
}
