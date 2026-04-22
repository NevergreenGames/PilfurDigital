import { Die } from '../../engine/types';

interface Props {
  die: Die;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

const SOURCE_COLORS: Record<string, string> = {
  phase: '#7aa2f7',
  character: '#e0af68',
  heat: '#f7768e',
  stash: '#9ece6a',
};

export function DieView({ die, selected, onClick, disabled }: Props) {
  const color = SOURCE_COLORS[die.source] ?? '#aaa';
  return (
    <button
      className={`die die-d${die.size} ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
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
