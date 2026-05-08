import {
  CSSProperties,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

/*
 * SceneTransition — universal screen-level enter / exit wrapper.
 *
 * The contract is purely declarative: pass `sceneKey` (the current screen
 * identifier) and the children to render. When `sceneKey` changes:
 *
 *   1. We add `.scene--exit` to the wrapper. CSS plays a quick glitch-out
 *      on text (h1/h2/.glitch-text) and a brief fade on the surrounding
 *      box. Old children stay mounted while this plays.
 *   2. After `exitMs`, we swap to the new children and add `.scene--enter`.
 *      CSS plays a longer fade-in. Children that opt into staggerStyle()
 *      or rippleStyle() will reveal sequentially after that.
 *
 * Exit is intentionally much shorter than enter — leaving feels snappy,
 * arriving feels deliberate, per spec.
 *
 * Same-scene children updates (e.g., re-render on state change) flow
 * through immediately without retriggering the transition.
 */

interface Props {
  sceneKey: string | number;
  children: ReactNode;
  enterMs?: number;
  exitMs?: number;
}

type Phase = 'enter' | 'idle' | 'exit';

export function SceneTransition({
  sceneKey,
  children,
  enterMs = 700,
  exitMs = 200,
}: Props) {
  const [renderedKey, setRenderedKey] = useState(sceneKey);
  const [renderedChildren, setRenderedChildren] = useState<ReactNode>(children);
  const [phase, setPhase] = useState<Phase>('enter');

  // Keep a fresh snapshot of `children` so the swap-in (which fires from
  // a setTimeout closure) picks up whatever's current at the moment the
  // exit completes — not the value captured when the transition began.
  const childrenRef = useRef<ReactNode>(children);
  childrenRef.current = children;

  // Same-scene children updates: pass them through without re-triggering
  // the enter animation. Skipped while exit is playing — those are still
  // logically the OLD children (the new screen hasn't shown yet).
  useEffect(() => {
    if (sceneKey === renderedKey && phase !== 'exit') {
      setRenderedChildren(children);
    }
    // We intentionally only depend on `children` + `phase`. `sceneKey` /
    // `renderedKey` changes are handled by the dedicated effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, phase]);

  // Scene-change effect: starts the exit, then swaps to the new scene
  // and starts the enter. Single source of truth for transitions — if
  // `sceneKey` changes again mid-flight, the cleanup cancels the
  // pending swap so we don't accidentally render a stale scene.
  useEffect(() => {
    if (sceneKey === renderedKey) return;
    setPhase('exit');
    const timer = window.setTimeout(() => {
      setRenderedKey(sceneKey);
      setRenderedChildren(childrenRef.current);
      setPhase('enter');
    }, exitMs);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);

  // After enterMs, settle into idle so animations don't leak onto
  // subsequent same-scene re-renders (the .scene--enter class is what
  // drives the keyframe; we drop it once it's served its purpose).
  useEffect(() => {
    if (phase !== 'enter') return;
    const timer = window.setTimeout(() => setPhase('idle'), enterMs);
    return () => window.clearTimeout(timer);
  }, [phase, enterMs]);

  const style: CSSProperties = {
    // CSS reads these to size its keyframes; both are exposed so authors
    // can override per-screen if a particular scene wants a slower exit
    // or a punchier enter.
    ['--scene-enter-ms' as string]: `${enterMs}ms`,
    ['--scene-exit-ms' as string]: `${exitMs}ms`,
  };

  return (
    <div
      className={`scene scene--${phase}`}
      style={style}
      data-scene-key={String(renderedKey)}
    >
      {renderedChildren}
    </div>
  );
}
