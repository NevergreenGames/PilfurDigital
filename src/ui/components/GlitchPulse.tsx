import { useEffect, useRef, useState } from 'react';
import { GlitchTypewriter } from './GlitchTypewriter';
import { DisplayChar, substitute } from './glitchSubs';

/*
 * GlitchPulse — text wrapper that runs the GlitchTypewriter entrance on
 * first mount, then on every `pulseKey` change does an in-place scramble
 * burst (no remount, no opacity-fade animation). The original
 * implementation forced a remount via key={pulseKey}, which restarted
 * each GlitchWord's `glitch-flicker` keyframes (opacity: 0.4 → 1) and
 * gave a "disappear then fade back" feel on click. The scramble overlay
 * here swaps text content under a stable wrapper element so layout
 * never collapses and no fresh entrance animation plays.
 *
 * After the first pulse, the entrance typewriter is replaced by plain
 * text — the typewriter's settled output and a plain string render
 * identically, so the swap is invisible to the user.
 */

interface GlitchPulseProps {
  text: string;
  // Bump to retrigger the scramble. 0 keeps the natural first-mount
  // typewriter behavior.
  pulseKey: number;
  // First-mount typewriter pacing. Identical to GlitchTypewriter's props.
  perWordMs?: number;
  delayMs?: number;
}

const PULSE_TICK_MS = [40, 80, 120, 160];
const PULSE_SETTLE_MS = 220;
const PULSE_DENSITY = 0.65;

export function GlitchPulse({
  text,
  pulseKey,
  perWordMs = 100,
  delayMs = 0,
}: GlitchPulseProps) {
  const lastKeyRef = useRef(pulseKey);
  const [scrambled, setScrambled] = useState<DisplayChar[] | null>(null);

  useEffect(() => {
    if (pulseKey === lastKeyRef.current) return;
    lastKeyRef.current = pulseKey;
    let cancelled = false;
    const tick = () => {
      if (!cancelled) setScrambled(substitute(text, PULSE_DENSITY));
    };
    tick();
    const ids = PULSE_TICK_MS.map((d) => window.setTimeout(tick, d));
    const settle = window.setTimeout(() => {
      if (!cancelled) setScrambled(null);
    }, PULSE_SETTLE_MS);
    return () => {
      cancelled = true;
      ids.forEach((i) => window.clearTimeout(i));
      window.clearTimeout(settle);
    };
  }, [pulseKey, text]);

  // First-mount path — let GlitchTypewriter run its normal staged entrance.
  // After the first pulse fires (lastKeyRef advances past 0), we permanently
  // switch to the plain / scrambled render path. The two render the same
  // text once GlitchTypewriter has settled, so the swap is invisible.
  if (pulseKey === 0 && lastKeyRef.current === 0 && scrambled === null) {
    return (
      <GlitchTypewriter text={text} perWordMs={perWordMs} delayMs={delayMs} />
    );
  }

  if (scrambled !== null) {
    return (
      <span className="glitch-pulse">
        {scrambled.map((c, i) =>
          c.isEmoji ? (
            <span key={i} className="glitch-title-emoji">
              {c.ch}
            </span>
          ) : (
            <span key={i}>{c.ch}</span>
          ),
        )}
      </span>
    );
  }

  return <span className="glitch-pulse">{text}</span>;
}
