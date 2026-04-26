import { useEffect, useState } from 'react';
import { HeistOutcome } from '../../engine/types';

interface Props {
  outcome: HeistOutcome;
  // True if this heist was the player's FINAL job (5th node) — affects
  // continue-button copy and outcome flavor.
  isFinalNode: boolean;
  // Brief flavor pulled from the heist (e.g. target name).
  targetName?: string;
  // How many turns the player took before the outcome resolved.
  turnsTaken: number;
  // Heist log tail — surfaced as a 3-line summary on the overlay.
  logTail: string[];
  // Confirms the outcome and triggers the screen transition.
  onProceed: () => void;
}

const REVEAL_DELAY_MS = 1100; // demise animation runs underneath first

export function HeistEndOverlay({
  outcome,
  isFinalNode,
  targetName,
  turnsTaken,
  logTail,
  onProceed,
}: Props) {
  const [minimized, setMinimized] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Hold the overlay back briefly so the player sees the demise / win
  // animation play out underneath before this panel covers the grid.
  useEffect(() => {
    const t = window.setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  if (!revealed) return null;

  const titleByOutcome: Record<HeistOutcome, string> = {
    won: isFinalNode ? 'CLEAN GETAWAY' : 'JOB DONE',
    captured: 'CAUGHT',
    trapped: 'BOXED IN',
  };

  const flavorByOutcome: Record<HeistOutcome, string> = {
    won: isFinalNode
      ? 'Five jobs, no scratches. Walk away.'
      : `${targetName ? `${targetName} is yours. ` : ''}Onto the next.`,
    captured: 'The heat ran the score before you could.',
    trapped: 'Walls closed in. No legal move, no way through.',
  };

  const proceedLabel: Record<HeistOutcome, string> = {
    won: isFinalNode ? 'END RUN' : 'CONTINUE TO NEXT JOB',
    captured: 'NEW RUN',
    trapped: 'NEW RUN',
  };

  if (minimized) {
    return (
      <button
        type="button"
        className={`hg-end-min hg-end-min--${outcome}`}
        onClick={() => setMinimized(false)}
        aria-label="Restore heist end overlay"
      >
        <span className="hg-end-min-title">{titleByOutcome[outcome]}</span>
        <span className="hg-end-min-restore" aria-hidden>
          ▢
        </span>
      </button>
    );
  }

  return (
    <div className={`hg-end-overlay hg-end-overlay--${outcome}`} role="dialog">
      <div className="hg-end-card">
        <button
          type="button"
          className="hg-end-minimize"
          onClick={() => setMinimized(true)}
          title="Minimize — review the final state"
          aria-label="Minimize"
        >
          —
        </button>
        <div className={`hg-end-title hg-end-title--${outcome}`}>
          {titleByOutcome[outcome]}
        </div>
        <div className="hg-end-flavor">{flavorByOutcome[outcome]}</div>
        <div className="hg-end-stats">
          <div>
            <span className="hg-end-stat-label">Turns</span>
            <span className="hg-end-stat-value">{turnsTaken}</span>
          </div>
          {targetName && (
            <div>
              <span className="hg-end-stat-label">Score</span>
              <span className="hg-end-stat-value">{targetName}</span>
            </div>
          )}
        </div>
        {logTail.length > 0 && (
          <div className="hg-end-log">
            {logTail.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}
        <div className="hg-end-actions">
          <button type="button" onClick={() => setMinimized(true)}>
            REVIEW
          </button>
          <button type="button" className="primary" onClick={onProceed}>
            {proceedLabel[outcome]}
          </button>
        </div>
      </div>
    </div>
  );
}
