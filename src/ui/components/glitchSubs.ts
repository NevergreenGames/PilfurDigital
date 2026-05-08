/*
 * Shared character-substitution palette + helpers for the glitch effects.
 *
 * Used by:
 *   - GlitchTitle: bursts on a periodic timer, hover layer per-character.
 *   - GlitchButton: hover/active label substitution for `label`-driven
 *     buttons.
 *
 * Uppercase keyed; lookup uses the uppercase form of the original char so
 * casing tweaks don't break it. Mark `emoji: true` for stand-ins that
 * should render via the silhouette trick (`color: transparent;
 * text-shadow: 0 0 0 …`) so the rasterized emoji glyph picks up the
 * surrounding color instead of being a platform-specific image.
 */

export type SubChar = { glyph: string; emoji?: boolean };

export const SUBS: Record<string, SubChar[]> = {
  A: [{ glyph: '4' }, { glyph: '∆' }, { glyph: 'Λ' }],
  B: [{ glyph: '8' }, { glyph: 'ß' }],
  C: [{ glyph: '⊂' }, { glyph: '(' }],
  D: [{ glyph: 'Ð' }],
  E: [{ glyph: '3' }, { glyph: 'Ξ' }, { glyph: '€' }],
  F: [{ glyph: 'ƒ' }, { glyph: 'Ϝ' }],
  G: [{ glyph: '9' }, { glyph: '6' }],
  H: [{ glyph: '#' }, { glyph: 'Η' }],
  I: [{ glyph: '1' }, { glyph: '|' }, { glyph: '!' }],
  J: [{ glyph: 'ʝ' }],
  K: [{ glyph: 'Κ' }],
  L: [{ glyph: '7' }, { glyph: '|' }, { glyph: '£' }],
  M: [{ glyph: 'Μ' }],
  N: [{ glyph: 'И' }, { glyph: 'Ν' }],
  O: [
    { glyph: '0' },
    { glyph: 'Ø' },
    { glyph: 'Φ' },
    // 🔘 reads as a ringed O when forced to a flat color via the
    // shadow trick — distinct enough to flicker the eye.
    { glyph: '🔘', emoji: true },
  ],
  P: [
    { glyph: 'ρ' },
    { glyph: 'Ρ' },
    // 🅿 — the parking emoji is essentially a bordered P; great match.
    { glyph: '🅿', emoji: true },
  ],
  Q: [{ glyph: 'ϙ' }],
  R: [{ glyph: '®' }, { glyph: 'Я' }, { glyph: '₹' }],
  S: [{ glyph: '5' }, { glyph: '$' }, { glyph: '§' }],
  T: [{ glyph: '7' }, { glyph: '†' }, { glyph: 'Τ' }],
  U: [{ glyph: '∪' }, { glyph: 'μ' }, { glyph: 'υ' }],
  V: [{ glyph: '√' }, { glyph: '∨' }],
  W: [{ glyph: 'Ш' }, { glyph: 'Ψ' }],
  X: [{ glyph: '×' }, { glyph: '✕' }],
  Y: [{ glyph: '¥' }, { glyph: 'γ' }],
  Z: [{ glyph: '2' }, { glyph: 'Ƶ' }],
};

export interface DisplayChar {
  ch: string;
  isEmoji: boolean;
}

export function plainChars(text: string): DisplayChar[] {
  return Array.from(text).map((ch) => ({ ch, isEmoji: false }));
}

/**
 * Build a substitution snapshot. `density` is the per-character probability
 * that an eligible character gets swapped — 0.4 means roughly 40% of the
 * eligible letters mutate per call.
 */
export function substitute(text: string, density: number): DisplayChar[] {
  const out: DisplayChar[] = [];
  for (const ch of Array.from(text)) {
    const palette = SUBS[ch.toUpperCase()];
    if (palette && Math.random() < density) {
      const sub = palette[Math.floor(Math.random() * palette.length)];
      out.push({ ch: sub.glyph, isEmoji: !!sub.emoji });
    } else {
      out.push({ ch, isEmoji: false });
    }
  }
  return out;
}

/**
 * Variant of `substitute` that also boosts the emoji-substitution rate
 * for callers (e.g. button active state) that want a more chaotic look.
 * When a character has both emoji and non-emoji entries, this prefers
 * emoji entries with probability `emojiBoost`.
 */
export function substituteAggressive(
  text: string,
  density: number,
  emojiBoost: number,
): DisplayChar[] {
  const out: DisplayChar[] = [];
  for (const ch of Array.from(text)) {
    const palette = SUBS[ch.toUpperCase()];
    if (palette && Math.random() < density) {
      const emojiOnly = palette.filter((p) => p.emoji);
      const useEmoji = emojiOnly.length > 0 && Math.random() < emojiBoost;
      const pool = useEmoji ? emojiOnly : palette;
      const sub = pool[Math.floor(Math.random() * pool.length)];
      out.push({ ch: sub.glyph, isEmoji: !!sub.emoji });
    } else {
      out.push({ ch, isEmoji: false });
    }
  }
  return out;
}
