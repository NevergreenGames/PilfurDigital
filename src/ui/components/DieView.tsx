import { CSSProperties } from 'react';
import { Die, DieSize } from '../../engine/types';

interface Props {
  die: Die;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  ghost?: 'will-consume' | 'will-gain';
  // Spotlighted by an ability-charge event — the die scales up and glows
  // gold to advertise itself as "this is one of the dice that just
  // charged the ability popping in the sidebar".
  spotlight?: boolean;
  // Just transformed by an ability activation — the die enlarges, glows
  // and jiggles for ~750ms so the player sees the effect take hold.
  impacted?: boolean;
}

const SOURCE_COLORS: Record<string, string> = {
  phase: '#7aa2f7',
  character: '#e0af68',
  heat: '#f7768e',
  stash: '#9ece6a',
  // Cyan-violet for ghost dice — distinct from every other source so
  // they read as "borrowed" at a glance, before the glitch animation
  // even kicks in.
  ghost: '#bb9af7',
};

// viewBox 0..60 on each axis. Polygons sit inside a 4px inset so the stroke
// draws cleanly within the button's bounds.
const DIE_POLYGONS: Record<DieSize, string> = {
  // Triangle — point up.
  4: '30,5 56,54 4,54',
  // Square.
  6: '5,5 55,5 55,55 5,55',
  // Diamond (square rotated 45°).
  8: '30,4 56,30 30,56 4,30',
  // Pentagon — point up.
  10: '30,4 56,24 46,56 14,56 4,24',
  // Hexagon (flat-top).
  12: '18,5 42,5 56,30 42,55 18,55 4,30',
  // Octagon — near-round to distinguish from d12.
  20: '21,4 39,4 56,21 56,39 39,56 21,56 4,39 4,21',
};

export function DieView({
  die,
  selected,
  onClick,
  disabled,
  ghost,
  spotlight,
  impacted,
}: Props) {
  const color = SOURCE_COLORS[die.source] ?? '#aaa';
  const points = DIE_POLYGONS[die.size];

  const isGhostSource = die.source === 'ghost';
  const classes = [
    'die',
    `die-d${die.size}`,
    `die-shape-d${die.size}`,
    selected ? 'selected' : '',
    disabled ? 'disabled' : '',
    ghost ? `die--${ghost}` : '',
    spotlight ? 'die--spotlight' : '',
    impacted ? 'die--impacted' : '',
    isGhostSource ? 'die--ghost-source' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const polygonStyle: CSSProperties = {
    stroke: color,
    strokeWidth: 3,
    strokeLinejoin: 'round',
    // When selected, flood-fill the shape with the accent color; otherwise use bg-3.
    fill: selected ? 'var(--accent)' : 'var(--bg-3)',
  };

  // Ghost rendering for preview states.
  if (ghost === 'will-gain') {
    polygonStyle.fill = 'transparent';
    polygonStyle.strokeDasharray = '4 3';
  }

  return (
    <button
      type="button"
      className={classes}
      style={{ color }}
      onClick={onClick}
      disabled={disabled}
      title={
        isGhostSource
          ? `d${die.size} (ghost — fades on next fulfill)`
          : `d${die.size} (${die.source})`
      }
      data-die-id={die.id}
    >
      <svg className="die-svg" viewBox="0 0 60 60" aria-hidden>
        <polygon points={points} style={polygonStyle} />
      </svg>
      <div className="die-content">
        <div className="die-value">{die.value ?? '?'}</div>
        <div className="die-size">d{die.size}</div>
      </div>
    </button>
  );
}
