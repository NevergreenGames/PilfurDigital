import { Fragment, ReactNode } from 'react';
import { DieSize } from '../../engine/types';

// Polygon shapes must match DieView. Declared inline here so DieGlyph has no
// hard dependency on DieView.
const DIE_POLYGONS: Record<DieSize, string> = {
  4: '30,5 56,54 4,54',
  6: '5,5 55,5 55,55 5,55',
  8: '30,4 56,30 30,56 4,30',
  10: '30,4 56,24 46,56 14,56 4,24',
  12: '18,5 42,5 56,30 42,55 18,55 4,30',
  20: '21,4 39,4 56,21 56,39 39,56 21,56 4,39 4,21',
};

export interface DieGlyphProps {
  size: DieSize;
  // Show the "d{size}" label inside the shape. Default true — disambiguates
  // between similar polygons (pentagon/hexagon/octagon) at small scales.
  showLabel?: boolean;
  // Pixel dimension of the glyph. Default 18 (inline-height friendly).
  px?: number;
}

export function DieGlyph({ size, showLabel = true, px = 18 }: DieGlyphProps) {
  const points = DIE_POLYGONS[size];
  // Scale the label font with the glyph so it fits inside the polygon at
  // small sizes and stays legible at large ones.
  const fontSize = Math.max(7, Math.round(px * 0.36));
  return (
    <span
      className="die-glyph"
      title={`d${size}`}
      style={{ width: px, height: px }}
    >
      <svg className="die-glyph-svg" viewBox="0 0 60 60" aria-hidden>
        <polygon className="die-glyph-polygon" points={points} />
      </svg>
      {showLabel && (
        <span className="die-glyph-label" style={{ fontSize }}>
          d{size}
        </span>
      )}
    </span>
  );
}

/**
 * Parses a string for die references like "d4", "d6", "d20" and substitutes
 * each occurrence with a <DieGlyph> while preserving the surrounding text.
 * Used to render ability effect text with real polygon symbols inline.
 */
export function withDieGlyphs(text: string): ReactNode {
  const re = /\bd(4|6|8|10|12|20)\b/g;
  const parts: ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(
        <Fragment key={`t${key++}`}>{text.slice(lastIdx, match.index)}</Fragment>,
      );
    }
    const s = parseInt(match[1], 10) as DieSize;
    parts.push(<DieGlyph key={`g${key++}`} size={s} />);
    lastIdx = re.lastIndex;
  }
  if (lastIdx < text.length) {
    parts.push(<Fragment key={`t${key++}`}>{text.slice(lastIdx)}</Fragment>);
  }
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
