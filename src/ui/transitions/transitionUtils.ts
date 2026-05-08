import { CSSProperties } from 'react';

/*
 * Scene-transition style helpers.
 *
 * Two flavors of staggered reveal:
 *   - staggerStyle(i)        for linear lists (delay = i * step)
 *   - rippleStyle(r, c, …)   for 2D grids (delay = euclidean distance from
 *                            a center cell, rippling outwards)
 *
 * Both produce a CSSProperties object you spread onto the element along
 * with the matching CSS class:
 *   <div className="stagger-item" style={staggerStyle(i)}>
 *   <div className="ripple-cell" style={rippleStyle(r, c, center)}>
 *
 * The class supplies the keyframe; the style supplies the per-element
 * delay. Reduce-motion is handled globally in overlays.css — every
 * animation collapses to a near-zero duration so users who opt out
 * still see the same end state instantly.
 */

export interface StaggerOptions {
  // Milliseconds between successive items.
  step?: number;
  // Initial delay applied to every item (lets a parent fade-in finish first).
  initial?: number;
}

export function staggerStyle(
  index: number,
  { step = 50, initial = 0 }: StaggerOptions = {},
): CSSProperties {
  return { animationDelay: `${initial + index * step}ms` };
}

export interface RippleOptions extends StaggerOptions {
  // Ripple cadence in ms per unit of distance. Slightly tighter than
  // stagger by default since grids have many more cells.
  step?: number;
}

// Numeric delay for a grid cell, in ms. Same euclidean-distance shape
// as rippleStyle but exposed as a plain number so callers that pass it
// down as a prop (rather than spreading inline styles) don't have to
// round-trip through a CSS string.
export function rippleDelay(
  row: number,
  col: number,
  center: { row: number; col: number },
  { step = 35, initial = 0 }: RippleOptions = {},
): number {
  const dr = row - center.row;
  const dc = col - center.col;
  const distance = Math.sqrt(dr * dr + dc * dc);
  return initial + distance * step;
}

// Euclidean distance from `(row, col)` to `center`. Diagonal cells fire
// at sqrt(2) ≈ 1.41× the orthogonal step, which is what makes the wave
// look round rather than diamond-shaped.
export function rippleStyle(
  row: number,
  col: number,
  center: { row: number; col: number },
  opts: RippleOptions = {},
): CSSProperties {
  return { animationDelay: `${rippleDelay(row, col, center, opts)}ms` };
}
