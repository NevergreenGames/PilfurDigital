import { useEffect, useState } from 'react';

const GLITCH_CHARS = '!@#$%^&*<>{}[]/\\01ABFXZΣΔ░▒▓█';

function scrambleSameLength(word: string): string {
  let out = '';
  for (const ch of word) {
    if (/\s/.test(ch)) {
      out += ch;
      continue;
    }
    out += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
  }
  return out;
}

interface GlitchWordProps {
  word: string;
  // ms before the scrambled stand-in resolves into the real word.
  settleMs?: number;
}

function GlitchWord({ word, settleMs = 110 }: GlitchWordProps) {
  const [text, setText] = useState(() => scrambleSameLength(word));
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Cycle the scramble a few times so the flicker reads as live decoding,
    // not a static placeholder. Each tick: re-scramble and rerender.
    const ticks = [0, 35, 70];
    const ids = ticks.map((delay) =>
      window.setTimeout(() => {
        if (!cancelled) setText(scrambleSameLength(word));
      }, delay),
    );
    const settle = window.setTimeout(() => {
      if (!cancelled) {
        setText(word);
        setResolved(true);
      }
    }, settleMs);
    return () => {
      cancelled = true;
      ids.forEach((i) => window.clearTimeout(i));
      window.clearTimeout(settle);
    };
  }, [word, settleMs]);

  return (
    <span
      className={`glitch-word${resolved ? ' glitch-word--resolved' : ''}`}
    >
      {text}
    </span>
  );
}

interface GlitchTypewriterProps {
  text: string;
  // ms between successive words appearing.
  perWordMs?: number;
  // Fires once after the final word has settled.
  onDone?: () => void;
}

export function GlitchTypewriter({
  text,
  perWordMs = 100,
  onDone,
}: GlitchTypewriterProps) {
  // Preserve original whitespace by splitting into [word, gap, word, gap, ...].
  const tokens = text.split(/(\s+)/);
  const wordCount = tokens.filter((t) => t.trim().length > 0).length;

  // Number of WORD tokens revealed so far. Skipped (whitespace) tokens
  // appear alongside their neighboring words.
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (revealed >= wordCount) {
      if (onDone) onDone();
      return;
    }
    const t = window.setTimeout(() => setRevealed((n) => n + 1), perWordMs);
    return () => window.clearTimeout(t);
  }, [revealed, wordCount, perWordMs, onDone]);

  let wordIdx = 0;
  return (
    <span className="glitch-typewriter">
      {tokens.map((token, i) => {
        const isWord = token.trim().length > 0;
        if (!isWord) {
          // Render the gap only if its preceding word has been revealed.
          if (wordIdx <= revealed) return <span key={i}>{token}</span>;
          return null;
        }
        const showThisWord = wordIdx < revealed;
        wordIdx += 1;
        if (!showThisWord) return null;
        return <GlitchWord key={i} word={token} />;
      })}
    </span>
  );
}
