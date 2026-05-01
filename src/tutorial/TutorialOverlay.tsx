import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useTutorialStore } from '../state/tutorialStore';
import { STEPS, TutorialContext, TutorialStep } from './steps';

interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SPOTLIGHT_PAD = 8;
const POLL_MS = 250; // re-poll DOM for anchor presence + position

function getAnchorRect(selector: string | undefined): AnchorRect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = (el as HTMLElement).getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return {
    top: r.top - SPOTLIGHT_PAD,
    left: r.left - SPOTLIGHT_PAD,
    width: r.width + SPOTLIGHT_PAD * 2,
    height: r.height + SPOTLIGHT_PAD * 2,
  };
}

function clampToViewport(rect: AnchorRect): AnchorRect {
  return {
    top: Math.max(0, rect.top),
    left: Math.max(0, rect.left),
    width: Math.min(window.innerWidth, rect.width),
    height: Math.min(window.innerHeight, rect.height),
  };
}

// Pick the first eligible step. A step is eligible iff its screen matches,
// it's not yet seen, its shouldShow predicate returns true, AND — if it
// declares an anchor selector — that selector currently resolves to an
// element with non-zero size in the DOM. The anchor-presence check
// prevents the centered-modal fallback from firing for steps that are
// supposed to point at something specific (e.g. the off-screen compass).
function pickStep(
  ctx: TutorialContext,
  isSeen: (id: string) => boolean,
): TutorialStep | null {
  for (const step of STEPS) {
    if (step.screen !== ctx.screen) continue;
    if (isSeen(step.id)) continue;
    if (!step.shouldShow(ctx)) continue;
    if (step.anchor) {
      const el = document.querySelector(step.anchor) as HTMLElement | null;
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
    }
    return step;
  }
  return null;
}

export function TutorialOverlay() {
  const screen = useGameStore((s) => s.screen);
  const run = useGameStore((s) => s.run);
  const heist = run?.heist ?? null;

  const seenMap = useTutorialStore((s) => s.seen);
  const markSeen = useTutorialStore((s) => s.markSeen);
  const isSeen = (id: string) => Boolean(seenMap[id]);

  // A bare counter that ticks every POLL_MS — used purely to force a
  // re-render so anchor-presence checks (which read DOM, not React state)
  // pick up changes that happen without an accompanying state update
  // (e.g. a compass dot appearing as the player moves the camera).
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => (n + 1) % 1_000_000), POLL_MS);
    return () => window.clearInterval(t);
  }, []);

  // Active step is derived inline. No state, no setState-in-effect chain —
  // the one we used to have triggered React error #185 (max update depth)
  // when an action changed `run` and `heist` references on the same tick.
  const ctx: TutorialContext = { screen, run, heist };
  const step = pickStep(ctx, isSeen);

  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);

  // Measure / re-measure the anchor element while the step is active.
  useLayoutEffect(() => {
    if (!step) {
      setAnchorRect(null);
      return;
    }
    const measure = () => setAnchorRect(getAnchorRect(step.anchor));
    measure();
    const t = window.setInterval(measure, POLL_MS);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('resize', measure);
    };
  }, [step]);

  // When a step transitions from active to inactive without being explicitly
  // dismissed (i.e. its shouldShow gate flipped false because the prompted
  // action happened, or it was skipped because its anchor disappeared),
  // mark it seen. We do this for BOTH auto and info steps — the user has
  // effectively responded to the prompt by performing the related action,
  // so re-showing the step on the next opportunity would be noisy.
  const prevActiveIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevActiveIdRef.current;
    const curr = step?.id ?? null;
    if (prev && prev !== curr) {
      const prevStep = STEPS.find((s) => s.id === prev);
      // Only mark seen if the gate is now false (so we don't mark steps
      // that were just temporarily skipped because the anchor was missing).
      if (prevStep && !isSeen(prev) && !prevStep.shouldShow({ screen, run, heist })) {
        markSeen(prev);
      }
    }
    prevActiveIdRef.current = curr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id]);

  // Esc dismisses the current step (info steps only).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step && step.mode === 'info') {
        markSeen(step.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, markSeen]);

  if (!step) return null;

  const hasAnchor = Boolean(step.anchor && anchorRect);
  const rect = hasAnchor && anchorRect ? clampToViewport(anchorRect) : null;

  // Position the tooltip below the spotlight when there's room, else above.
  let tooltipStyle: React.CSSProperties = {};
  if (rect) {
    const belowSpace = window.innerHeight - (rect.top + rect.height);
    const placeBelow = belowSpace >= 180;
    tooltipStyle = placeBelow
      ? {
          top: rect.top + rect.height + 12,
          left: Math.min(
            Math.max(12, rect.left + rect.width / 2 - 180),
            window.innerWidth - 372,
          ),
        }
      : {
          top: Math.max(12, rect.top - 200),
          left: Math.min(
            Math.max(12, rect.left + rect.width / 2 - 180),
            window.innerWidth - 372,
          ),
        };
  }

  return (
    <div className="tut-root" role="dialog" aria-live="polite">
      {hasAnchor && rect ? (
        <>
          <div
            className="tut-spotlight"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }}
          />
          <div className="tut-tooltip tut-tooltip--anchored" style={tooltipStyle}>
            <div className="tut-text">{step.text}</div>
            {step.mode === 'info' && (
              <div className="tut-actions">
                <button
                  type="button"
                  className="primary tut-btn"
                  onClick={() => markSeen(step.id)}
                >
                  GOT IT
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="tut-backdrop" />
          <div className="tut-tooltip tut-tooltip--center">
            <div className="tut-text">{step.text}</div>
            {step.mode === 'info' && (
              <div className="tut-actions">
                <button
                  type="button"
                  className="primary tut-btn"
                  onClick={() => markSeen(step.id)}
                >
                  GOT IT
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
