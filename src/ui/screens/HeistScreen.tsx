import { useCallback, useMemo, useState } from 'react';
import { useGameStore, TOTAL_NODES } from '../../state/gameStore';
import { Tile } from '../../engine/types';
import { findSatisfyingSubset, isSubsetSatisfying } from '../../engine/requirements';
import { GridView } from '../components/GridView';
import { DicePoolView } from '../components/DicePoolView';
import { HeatTrayView } from '../components/HeatTrayView';
import { AbilityListView } from '../components/AbilityListView';
import '../heist-grid.css';

function isWalkable(t: Tile): boolean {
  return t.kind === 'start' || t.state === 'playerFulfilled';
}

function isUnfulfilledRevealed(t: Tile): boolean {
  return t.state === 'revealed' && !!t.card;
}

export function HeistScreen() {
  const run = useGameStore((s) => s.run);
  const ui = useGameStore((s) => s.ui);
  const toggleDieSelection = useGameStore((s) => s.toggleDieSelection);
  const movePlayer = useGameStore((s) => s.movePlayer);
  const rollDiceAction = useGameStore((s) => s.rollDice);
  const playerFulfillTile = useGameStore((s) => s.playerFulfillTile);
  const reroll = useGameStore((s) => s.reroll);
  const endTurn = useGameStore((s) => s.endTurn);
  const activateAbility = useGameStore((s) => s.activateAbility);
  const continueToNextNode = useGameStore((s) => s.continueToNextNode);
  const resetToCharacterSelect = useGameStore((s) => s.resetToCharacterSelect);

  if (!run?.heist) return null;
  const { heist } = run;
  const outcome = heist.outcome;
  const isOver = !!outcome;
  const isFinalNode = run.nodeIndex === TOTAL_NODES - 1;

  const selectedDice = heist.pool.filter((d) => ui.selectedDiceIds.includes(d.id));

  // Hover state for pool-preview: which pool dice would be consumed and which
  // dice would be added on click-to-fulfill.
  const [hoveredTile, setHoveredTile] = useState<Tile | null>(null);
  const onHoverChange = useCallback((t: Tile | null) => setHoveredTile(t), []);

  const { previewConsumedIds, previewGainedSizes } = useMemo(() => {
    if (!hoveredTile || !hoveredTile.card || hoveredTile.state !== 'revealed') {
      return { previewConsumedIds: undefined, previewGainedSizes: undefined };
    }
    // Only preview if the tile is actually fulfillable right now:
    // must be adjacent to the player.
    const dr = Math.abs(hoveredTile.pos.row - heist.player.row);
    const dc = Math.abs(hoveredTile.pos.col - heist.player.col);
    const adjacent = dr <= 1 && dc <= 1 && (dr + dc) > 0;
    if (!adjacent) return { previewConsumedIds: undefined, previewGainedSizes: undefined };

    const req = hoveredTile.card.requirement;
    let consumed: { id: string }[] | null = null;
    if (selectedDice.length > 0 && isSubsetSatisfying(selectedDice, req)) {
      consumed = selectedDice;
    } else if (selectedDice.length === 0) {
      const rolled = heist.pool.filter((d) => d.value !== null);
      consumed = findSatisfyingSubset(rolled, req);
    }
    if (!consumed) {
      return { previewConsumedIds: undefined, previewGainedSizes: undefined };
    }
    return {
      previewConsumedIds: new Set(consumed.map((d) => d.id)),
      previewGainedSizes: hoveredTile.card.momentumDice,
    };
  }, [hoveredTile, selectedDice, heist.pool, heist.player.row, heist.player.col]);

  const onTileClick = (tile: Tile) => {
    if (isOver) return;
    // Revealed-unfulfilled tile: fulfill (store auto-picks dice if none selected,
    // and also moves the player onto the tile on success).
    if (isUnfulfilledRevealed(tile)) {
      playerFulfillTile(tile.id);
      return;
    }
    // Otherwise, plain move onto walkable terrain (start or playerFulfilled).
    if (isWalkable(tile)) {
      movePlayer(tile.id);
    }
  };

  // Outcome banner continue-action:
  // - won non-final: continueToNextNode — but the store also auto-transitions
  //   to draft via postOutcome, so by the time the banner shows we'd be on the
  //   draft screen. The banner is mostly for captured/trapped/won-final.
  const onContinue = () => {
    if (outcome === 'won' && !isFinalNode) {
      continueToNextNode();
    } else {
      resetToCharacterSelect();
    }
  };

  const character = run.character;
  const characterDie = heist.pool.find((d) => d.source === 'character');

  return (
    <div className="hg-screen">
      <div className="hg-main">
        <header className="hg-header">
          <div>
            <span className="hg-header-title">JOB {run.nodeIndex + 1}</span>
            <span className="hg-header-meta">
              {' '}
              · Turn {heist.turn} · {heist.hasRolledThisTurn ? 'rolled' : 'ready to roll'}
            </span>
          </div>
          <div className="hg-header-meta">
            {character.name} · d{run.characterDie} · {run.abilities.length} ability
            {run.abilities.length === 1 ? '' : 'ies'}
          </div>
        </header>

        {ui.message && <div className="hg-message">{ui.message}</div>}

        {isOver && (
          <div
            className={`hg-banner hg-banner--${
              outcome === 'won' ? 'won' : outcome === 'captured' ? 'captured' : 'trapped'
            }`}
          >
            <div className="hg-banner-title">
              {outcome === 'won' ? 'CLEAN' : outcome === 'captured' ? 'CAUGHT' : 'TRAPPED'}
            </div>
            <div className="hg-header-meta">
              {outcome === 'won'
                ? isFinalNode
                  ? 'Final score secured. Walk away.'
                  : 'Onto the next job.'
                : outcome === 'captured'
                  ? 'Heat overran the score.'
                  : 'No way forward.'}
            </div>
            <button className="primary" onClick={onContinue}>
              {outcome === 'won' && !isFinalNode ? 'CONTINUE' : 'NEW RUN'}
            </button>
          </div>
        )}

        <GridView
          heist={heist}
          selectedDice={selectedDice}
          onTileClick={onTileClick}
          onHoverChange={onHoverChange}
        />
      </div>

      <aside className="hg-sidebar">
        {/* Character */}
        <section className="hg-panel">
          <div className="hg-panel-title">Crew</div>
          <div className="hg-character">
            <div className="hg-character-portrait">
              {character.name.slice(0, 1)}
            </div>
            <div className="hg-character-info">
              <div className="hg-character-name">{character.name}</div>
              <div className="hg-character-die">
                d{run.characterDie}
                {characterDie?.value !== undefined && characterDie?.value !== null
                  ? ` · ${characterDie.value}`
                  : ' · unrolled'}
              </div>
            </div>
          </div>
        </section>

        {/* Pool */}
        <section className="hg-panel">
          <div className="hg-panel-title">Pool</div>
          <DicePoolView
            pool={heist.pool}
            selectedIds={ui.selectedDiceIds}
            onToggle={toggleDieSelection}
            disabled={isOver}
            previewConsumedIds={previewConsumedIds}
            previewGainedSizes={previewGainedSizes}
          />
        </section>

        {/* Heat */}
        <section className="hg-panel hg-heat">
          <div className="hg-panel-title">Heat</div>
          <HeatTrayView heat={heist.heat} />
        </section>

        {/* Actions */}
        <section className="hg-panel">
          <div className="hg-panel-title">Actions</div>
          <div className="hg-actions">
            <button
              onClick={rollDiceAction}
              disabled={isOver || heist.hasRolledThisTurn}
              className={!heist.hasRolledThisTurn && !isOver ? 'primary' : ''}
            >
              ROLL
            </button>
            <button
              onClick={reroll}
              disabled={isOver || !heist.hasRolledThisTurn}
              title="Rolls everything and adds a d6 to pool + heat"
            >
              REROLL
            </button>
            <button onClick={endTurn} disabled={isOver}>
              END TURN
            </button>
          </div>
        </section>

        {/* Abilities */}
        <section className="hg-panel">
          <div className="hg-panel-title">Abilities</div>
          <AbilityListView
            abilities={run.abilities}
            charges={run.abilityCharges}
            onActivate={activateAbility}
            disabled={isOver}
          />
        </section>

        {/* Log */}
        <section className="hg-panel">
          <div className="hg-panel-title">Log</div>
          <div className="hg-log">
            <ol>
              {heist.log.slice(-30).map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ol>
          </div>
        </section>

        {/* Turn counter */}
        <section className="hg-panel">
          <div className="hg-turn">
            <span>Turn {heist.turn}</span>
            <span>Node {run.nodeIndex + 1} / {TOTAL_NODES}</span>
          </div>
        </section>
      </aside>
    </div>
  );
}
