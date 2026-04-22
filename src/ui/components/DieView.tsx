import { Die } from '../../engine/types';

interface Props {
  die: Die;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  // Preview states (mutually exclusive with selected):
  // "will-consume": a real pool die that will be consumed on click-to-fulfill.
  // "will-gain": a phantom die preview (not in the pool yet) showing the reward.
  ghost?: 'will-consume' | 'will-gain';
}

const SOURCE_COLORS: Record<string, string> = {
  phase: '#7aa2f7',
  character: '#e0af68',
  heat: '#f7768e',
  stash: '#9ece6a',
};

export function DieView({ die, selected, onClick, disabled, ghost }: Props) {
  const color = SOURCE_COLORS[die.source] ?? '#aaa';
  const classes = [
    'die',
    `die-d${die.size}`,
    selected ? 'selected' : '',
    disabled ? 'disabled' : '',
    ghost ? `die--${ghost}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      className={classes}
      style={{ borderColor: color, color }}
      onClick={onClick}
      disabled={disabled}
      title={`d${die.size} (${die.source})`}
    >
      <div className="die-value">{die.value ?? '?'}</div>
      <div className="die-size">d{die.size}</div>
    </button>
  );
}
