import { PhaseCard, PhaseSlot } from '../../engine/types';
import { describeRequirement } from '../../engine/requirements';
import { DieView } from './DieView';

interface Props {
  card: PhaseCard;
  slot?: PhaseSlot;
  onClick?: () => void;
  highlighted?: boolean;
  compact?: boolean;
}

export function PhaseCardView({ card, slot, onClick, highlighted, compact }: Props) {
  const statusClass = slot ? `slot-${slot.status}` : '';
  return (
    <div
      className={`phase-card ${statusClass} ${highlighted ? 'highlighted' : ''} ${compact ? 'compact' : ''} ${card.type}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="phase-card-header">
        <div className="phase-card-name">{card.name}</div>
        {card.type === 'goal' && <div className="phase-card-badge">TARGET</div>}
      </div>
      <div className="phase-card-req">{describeRequirement(card.requirement)}</div>
      {card.onPlayEffect && <div className="phase-card-effect">✦ {card.onPlayEffect.text}</div>}
      <div className="phase-card-dice">
        {card.momentumDice.map((size, i) => (
          <span key={i} className={`die-chip die-d${size}`}>d{size}</span>
        ))}
      </div>
      {slot && slot.assignedDice.length > 0 && (
        <div className="phase-card-assigned">
          {slot.assignedDice.map((d) => (
            <DieView key={d.id} die={d} disabled />
          ))}
        </div>
      )}
      {slot && (
        <div className={`phase-card-status status-${slot.status}`}>{slot.status.toUpperCase()}</div>
      )}
    </div>
  );
}
