import { useEffect, useState } from 'react';
import { HeatResolution } from '../../engine/types';
import { DieView } from './DieView';
import { DieGlyph } from './DieGlyph';

interface Props {
  resolution: HeatResolution;
}

// Stages of the narration:
//   0: just appeared, rolled heat dice shown
//   1: each fill revealed one at a time (1 per STAGE_MS)
//   last: done — auto-dismiss
const STAGE_MS = 650;
const FINAL_HOLD_MS = 900;

export function HeatResolutionBanner({ resolution }: Props) {
  const { fills, capturedOnTarget, rolledDice } = resolution;
  const [stage, setStage] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Reset and re-run the sequence whenever we get a new resolution.
  useEffect(() => {
    setStage(0);
    setDismissed(false);
  }, [resolution]);

  // Advance through stages: 1, 2, ..., fills.length, then wait FINAL_HOLD_MS and dismiss.
  useEffect(() => {
    if (dismissed) return;
    if (stage < fills.length) {
      const t = window.setTimeout(() => setStage(stage + 1), STAGE_MS);
      return () => window.clearTimeout(t);
    }
    // All fills revealed — hold briefly, then auto-dismiss.
    const t = window.setTimeout(() => setDismissed(true), FINAL_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [stage, dismissed, fills.length]);

  if (dismissed) return null;

  const hasFills = fills.length > 0;
  const revealedFills = fills.slice(0, stage);

  return (
    <div className="hg-heat-banner" role="status" aria-live="polite">
      <div className="hg-heat-banner-row">
        <span className="hg-heat-banner-label">HEAT</span>
        <div className="hg-heat-banner-dice">
          {rolledDice.length === 0 && (
            <span className="hg-heat-banner-empty">no heat</span>
          )}
          {rolledDice.map((d) => (
            <DieView key={d.id} die={d} disabled />
          ))}
        </div>
        <button
          className="hg-heat-banner-skip"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
      {hasFills ? (
        <div className="hg-heat-banner-fills">
          {revealedFills.map((f, i) => (
            <div
              key={f.tileId}
              className={`hg-heat-fill ${i === revealedFills.length - 1 ? 'hg-heat-fill--new' : ''}`}
            >
              <span className="hg-heat-fill-arrow">→</span>
              <span className="hg-heat-fill-name">{f.tileName}</span>
              <span className="hg-heat-fill-note">looming</span>
              {f.gainedSizes.length > 0 && (
                <span className="hg-heat-fill-gain">
                  +
                  {f.gainedSizes.map((s, gi) => (
                    <DieGlyph key={gi} size={s} px={16} />
                  ))}
                  <span style={{ marginLeft: 4 }}>heat</span>
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="hg-heat-banner-fills">
          <span className="hg-heat-banner-nothing">No tiles in range. Clear turn.</span>
        </div>
      )}
      {capturedOnTarget && (
        <div className="hg-heat-banner-captured">The heat took the score.</div>
      )}
    </div>
  );
}
