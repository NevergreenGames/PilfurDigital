import {
  ButtonHTMLAttributes,
  MouseEvent,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  DisplayChar,
  plainChars,
  substitute,
  substituteAggressive,
} from './glitchSubs';

/*
 * GlitchButton — drop-in replacement for native <button> that adds the
 * same screen-tear vocabulary GlitchTitle uses, but keyed off
 * interaction state instead of a periodic timer:
 *   - Hover: subtle tear bands at small offsets, soft tints, ambient.
 *   - Active (mousedown): more aggressive offsets, saturated tints,
 *     plus a brief one-shot "shock" pulse on mousedown landing.
 *
 * Two label-rendering modes:
 *   1) `label` prop set — GlitchButton owns the label and runs its own
 *      per-character 1337/emoji substitution loop. Hover ticks sub
 *      bursts at low density (~25%) every ~180ms; active state ticks
 *      at high density (~55%) with a higher emoji rate every ~110ms.
 *      No entry typewriter — the label is always present from frame 0.
 *   2) No `label` — back-compat children-rendering path. Bands are
 *      tear-only, identical to the original behavior. Call sites that
 *      haven't migrated to label-driven substitution still work.
 *
 * The bands carry pointer-events: none so they never intercept the
 * underlying button's clicks. All native button props (className,
 * disabled, type, onClick, ...) are passed through unchanged; the
 * user's onMouseEnter/Leave/Down/Up handlers are composed with our
 * internal state setters so callers don't lose their callbacks.
 */

interface GlitchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  // When provided, GlitchButton renders this string with its own glitch
  // substitution machinery (instead of children). Children, if also
  // present, render alongside the label — useful for buttons that pair
  // a label with auxiliary widgets (e.g. EventModal choice chips).
  label?: string;
}

// Render a DisplayChar array as a flat sequence of <span>s, mirroring
// GlitchTitle's per-character emoji silhouette treatment so the button
// label inherits the same visual vocabulary.
function renderDisplayChars(chars: DisplayChar[]): ReactNode {
  return chars.map((c, i) =>
    c.isEmoji ? (
      <span key={i} className="glitch-title-emoji">
        {c.ch}
      </span>
    ) : (
      <span key={i}>{c.ch}</span>
    ),
  );
}

export function GlitchButton({
  children,
  className,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  onMouseUp,
  disabled,
  label,
  ...rest
}: GlitchButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);
  // `shocked` is a one-shot key flip on mousedown that retriggers the
  // .glitch-btn--shock animation by remounting via key — without it, a
  // rapid second click wouldn't replay the burst because the animation
  // would already be at its end frame.
  const [shockKey, setShockKey] = useState(0);

  // Label substitution state. Only used when `label` is provided.
  // `labelChars` is the current snapshot — defaults to the unmutated
  // text and is regenerated at hover/active cadence.
  const [labelChars, setLabelChars] = useState<DisplayChar[]>(() =>
    plainChars(label ?? ''),
  );

  // Reset the label snapshot when the label prop changes (e.g. the
  // DraftScreen "BUY · ¢N" → "NEED ¢N" toggle as creds change). Without
  // this, the old text would linger until the next hover/active tick.
  useEffect(() => {
    setLabelChars(plainChars(label ?? ''));
  }, [label]);

  // Hover sub burst — gentle (~25% density) at ~180ms cadence.
  // Cleared cleanly when hover ends or active takes over (active has
  // its own faster, more aggressive tick).
  useEffect(() => {
    if (!label || !hovered || active || disabled) return;
    // Kick a first burst immediately so the user sees a glyph change
    // on the very first frame of hover, not after 180ms of silence.
    setLabelChars(substitute(label, 0.25));
    const id = window.setInterval(() => {
      setLabelChars(substitute(label, 0.25));
    }, 180);
    return () => {
      window.clearInterval(id);
      // On hover-out, restore the clean text. The active branch below
      // also restores on its own cleanup, so we don't fight it here.
      if (!active) setLabelChars(plainChars(label));
    };
  }, [label, hovered, active, disabled]);

  // Active sub burst — punchy (~55% density, emoji-boosted) at ~110ms.
  useEffect(() => {
    if (!label || !active || disabled) return;
    setLabelChars(substituteAggressive(label, 0.55, 0.45));
    const id = window.setInterval(() => {
      setLabelChars(substituteAggressive(label, 0.55, 0.45));
    }, 110);
    return () => {
      window.clearInterval(id);
      // After release, the hover effect (if still hovered) will pick
      // up; otherwise restore clean text so the button reads stable.
      setLabelChars(plainChars(label));
    };
  }, [label, active, disabled]);

  const handleEnter = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      if (!disabled) setHovered(true);
      onMouseEnter?.(e);
    },
    [onMouseEnter, disabled],
  );
  const handleLeave = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      setHovered(false);
      setActive(false);
      onMouseLeave?.(e);
    },
    [onMouseLeave],
  );
  const handleDown = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      if (!disabled) {
        setActive(true);
        setShockKey((k) => k + 1);
      }
      onMouseDown?.(e);
    },
    [onMouseDown, disabled],
  );
  const handleUp = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      setActive(false);
      onMouseUp?.(e);
    },
    [onMouseUp],
  );

  // Defensive: if the user releases the mouse outside the button after
  // pressing, our onMouseUp won't fire. Listen on the window while
  // active so we still drop out of the active state cleanly.
  useEffect(() => {
    if (!active) return;
    const onUp = () => setActive(false);
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [active]);

  // Bands only render while the button is engaged, AND never while the
  // button is disabled — disabled buttons should read as inert.
  const showBands = !disabled && (hovered || active);

  const stateClass = active
    ? ' glitch-btn--active'
    : hovered
      ? ' glitch-btn--hover'
      : '';
  const composedClassName = `glitch-btn${stateClass}${className ? ` ${className}` : ''}`;

  // Build the visible label content. With `label`, render the (possibly
  // mutated) per-character spans and place children alongside (children
  // are typically auxiliary widgets like EventModal's chips). Without
  // `label`, fall back to children for backwards compatibility.
  const labelContent: ReactNode = label !== undefined
    ? renderDisplayChars(labelChars)
    : children;

  // Tear bands re-render the same content so the tear is in sync with
  // any label substitution. For label mode, this means the bands echo
  // the current sub snapshot — with children-only mode it stays
  // identical to the original behavior.
  const bandContent: ReactNode = label !== undefined
    ? renderDisplayChars(labelChars)
    : children;

  return (
    <button
      {...rest}
      disabled={disabled}
      className={composedClassName}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onMouseDown={handleDown}
      onMouseUp={handleUp}
    >
      <span className="glitch-btn-main">
        {labelContent}
        {label !== undefined && children}
      </span>
      {showBands && (
        <>
          {/* Shock burst — re-keyed on each mousedown so the animation
              replays from frame 0 rather than sitting at its end. */}
          {active && (
            <span
              key={shockKey}
              className="glitch-btn-shock"
              aria-hidden="true"
            />
          )}
          <span className="glitch-btn-tear glitch-btn-tear--1" aria-hidden="true">
            {bandContent}
          </span>
          <span className="glitch-btn-tear glitch-btn-tear--2" aria-hidden="true">
            {bandContent}
          </span>
          <span className="glitch-btn-tear glitch-btn-tear--3" aria-hidden="true">
            {bandContent}
          </span>
        </>
      )}
    </button>
  );
}
