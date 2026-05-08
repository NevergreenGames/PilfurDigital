import { useEffect, useRef, useState } from 'react';
import { GlitchTypewriter } from './GlitchTypewriter';
import {
  DisplayChar,
  SUBS,
  plainChars,
  substitute,
} from './glitchSubs';

/*
 * GlitchTitle — drop-in for headlines that want the GlitchTypewriter
 * scramble entry AND an idle-loop intermittent glitch made up of:
 *   - per-character 1337 / shape-alike substitutions (sometimes
 *     emojis rendered via the transparent-fill + text-shadow trick so
 *     the glyph silhouette inherits the title color rather than the
 *     platform's emoji rasters)
 *   - screen-tear style RGB-channel separation (three horizontal
 *     bands, each clipped + shifted on the X axis, tinted, blended).
 *
 * Bursts are scheduled at randomized intervals so the destabilization
 * doesn't repeat on a metronome. Each burst can include character
 * substitution, tear, or both — randomly chosen per burst.
 *
 * On top of the burst loop, an INDEPENDENT hover layer mutates a single
 * character while the cursor is on it — the hovered character ticks
 * through different substitutions every ~120ms and reverts on leave.
 * The two layers compose: bursts keep firing on top, and the hovered
 * char overrides whatever the burst layer is displaying for that index.
 *
 * Reduce-motion users get a quiet title: the entry typewriter still
 * runs (briefly) but the burst loop is skipped entirely. The CSS
 * also short-circuits any shadow/clip animations through the global
 * data-reduce-motion override in overlays.css.
 */

// Per-character substitution palette and helpers live in `./glitchSubs`
// and are shared with GlitchButton. Re-import the bits we need.

interface Props {
  text: string;
  // GlitchTypewriter cadence for the one-shot entrance reveal.
  perWordMs?: number;
  // Average ms between bursts (uniformly randomized within ±40%).
  burstIntervalMs?: number;
  // How long each burst's destabilization holds.
  burstMs?: number;
}

export function GlitchTitle({
  text,
  perWordMs = 70,
  burstIntervalMs = 6500,
  burstMs = 280,
}: Props) {
  const [entryDone, setEntryDone] = useState(false);
  const [chars, setChars] = useState<DisplayChar[]>(() => plainChars(text));
  const [tearing, setTearing] = useState(false);
  const cancelledRef = useRef(false);
  // Hover layer — independent of the burst loop. `hoveredIdx` tracks
  // which character (if any) is being hovered; `hoverTick` ticks while
  // the hover is active to drive the per-character substitution cycle.
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoverTick, setHoverTick] = useState(0);

  // After the entry typewriter settles, kick off the burst loop. Each
  // tick rolls dice for "include subs?" and "include tear?" so the
  // overall pattern feels organic — sometimes a subtle char flicker,
  // sometimes only the tear, often both at once.
  useEffect(() => {
    if (!entryDone) return;
    cancelledRef.current = false;

    let nextTimer: number | undefined;
    let endTimer: number | undefined;
    let midTimer: number | undefined;

    function scheduleNext() {
      if (cancelledRef.current) return;
      const delta = burstIntervalMs * (0.6 + Math.random() * 0.8);
      nextTimer = window.setTimeout(burst, delta);
    }

    function burst() {
      if (cancelledRef.current) return;
      const includeSub = Math.random() < 0.75;
      const includeTear = Math.random() < 0.7;
      if (!includeSub && !includeTear) {
        scheduleNext();
        return;
      }
      if (includeSub) setChars(substitute(text, 0.42));
      if (includeTear) setTearing(true);
      // Mid-burst re-roll for extra chaos when subbing — the burst
      // sometimes "stutters" through two glyph snapshots.
      if (includeSub && Math.random() < 0.45) {
        midTimer = window.setTimeout(() => {
          if (cancelledRef.current) return;
          setChars(substitute(text, 0.32));
        }, burstMs * 0.5);
      }
      // End the burst, restore the clean text, schedule the next.
      endTimer = window.setTimeout(() => {
        if (cancelledRef.current) return;
        setChars(plainChars(text));
        setTearing(false);
        scheduleNext();
      }, burstMs);
    }

    scheduleNext();
    return () => {
      cancelledRef.current = true;
      if (nextTimer !== undefined) window.clearTimeout(nextTimer);
      if (endTimer !== undefined) window.clearTimeout(endTimer);
      if (midTimer !== undefined) window.clearTimeout(midTimer);
    };
  }, [entryDone, text, burstIntervalMs, burstMs]);

  // Hover loop — only ticks while a character is hovered. Cleared on
  // unhover so we don't burn a timer when nothing's interactive.
  useEffect(() => {
    if (hoveredIdx === null) return;
    const id = window.setInterval(() => {
      setHoverTick((t) => t + 1);
    }, 120);
    return () => window.clearInterval(id);
  }, [hoveredIdx]);

  if (!entryDone) {
    // Entry phase: defer to the existing GlitchTypewriter. When it
    // finishes settling we flip entryDone and the burst loop kicks in.
    return (
      <GlitchTypewriter
        text={text}
        perWordMs={perWordMs}
        onDone={() => setEntryDone(true)}
      />
    );
  }

  // Original text (post-entry) so the hover layer can resolve "what
  // letter is at index i" even when the burst layer has already
  // mutated `chars[i]`.
  const origChars = Array.from(text);

  // Per-index "what glyph to render" decision. Hover wins over burst.
  // Returns the DisplayChar to draw at index `i` — both the main span
  // and the tear bands route through this so they stay in sync.
  function displayedAt(i: number): DisplayChar {
    if (i === hoveredIdx) {
      const orig = origChars[i] ?? '';
      const palette = SUBS[orig.toUpperCase()];
      if (palette && palette.length > 0) {
        const sub = palette[hoverTick % palette.length];
        return { ch: sub.glyph, isEmoji: !!sub.emoji };
      }
      // No palette for this char — fall through to burst layer.
    }
    return chars[i] ?? { ch: origChars[i] ?? '', isEmoji: false };
  }

  // After entry: the wordmark is a stack of one main span + (when
  // tearing) three clipped tear bands. Each band re-renders the same
  // chars so substitutions show consistently across all four layers.
  // We render `origChars.length` spans rather than reading from `chars`
  // so hover can address indices even before a burst has mutated them.
  const renderChars = (interactive: boolean) =>
    origChars.map((_orig, i) => {
      const c = displayedAt(i);
      const handlers = interactive
        ? {
            onMouseEnter: () => setHoveredIdx(i),
            onMouseLeave: () => setHoveredIdx(null),
          }
        : undefined;
      return c.isEmoji ? (
        <span key={i} className="glitch-title-emoji" {...handlers}>
          {c.ch}
        </span>
      ) : (
        <span key={i} {...handlers}>{c.ch}</span>
      );
    });

  return (
    <span
      className={`glitch-title${tearing ? ' glitch-title--tearing' : ''}`}
      data-glitching={tearing ? 'true' : 'false'}
      // Defensive clear: if the cursor zips off the title fast enough
      // that no individual char's onMouseLeave fires, the parent's
      // leave still nukes the hover state.
      onMouseLeave={() => setHoveredIdx(null)}
    >
      <span className="glitch-title-main">{renderChars(true)}</span>
      {tearing && (
        <>
          <span
            className="glitch-title-tear glitch-title-tear--1"
            aria-hidden="true"
          >
            {renderChars(false)}
          </span>
          <span
            className="glitch-title-tear glitch-title-tear--2"
            aria-hidden="true"
          >
            {renderChars(false)}
          </span>
          <span
            className="glitch-title-tear glitch-title-tear--3"
            aria-hidden="true"
          >
            {renderChars(false)}
          </span>
        </>
      )}
    </span>
  );
}
