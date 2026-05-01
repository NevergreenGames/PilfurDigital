# Pilfur Audio — Sourcing Guide

The game ships **without audio files**. The audio engine is wired up; it expects MP3 files at:

```
public/audio/<station>/<context>.mp3
```

…where `<station>` is one of `jazz | tense | piano | lofi` and `<context>` is one of `idle | heist | outcome`. That's 12 tracks total. The game runs silently when files are missing — the engine swallows missing-file errors.

Screen → context mapping:
- `title`, `characterSelect`, `map`, `draft` → `idle`
- `heist` → `heist`
- `gameOver` → `outcome`

## License recommendations

Use **CC0** (public domain) tracks where possible. **CC-BY 4.0** is acceptable but requires you to credit the artist on the in-game CREDITS screen. Avoid Pixabay Music (its license restricts redistribution in apps) and YouTube Audio Library (not licensed for redistribution).

Trusted sources:
- **FreePD.com** — fully public domain (CC0).
- **incompetech.com** (Kevin MacLeod) — CC-BY 4.0; massive catalog, mood-tagged.
- **opengameart.org** — filter by CC0 / CC-BY only.
- **Free Music Archive** — filter by CC0 / CC-BY only.

## Suggested track shopping list

For each cell you want filled, pick a track that:
- Is at least ~90s (so it loops without feeling repetitive in 5–10 min stretches).
- Doesn't fade out / has a clean loop.
- Stays under ~600 KB at 96 kbps mono (or up to ~1 MB at 128 kbps stereo) so the total bundle stays under ~10 MB.

| Station | Context | Mood notes |
|---------|---------|------------|
| jazz    | idle    | Smooth swing, walking bass. "Bossa Antigua", "Sneaky Snitch" (incompetech), or any Free Music Archive jazz tagged "noir". |
| jazz    | heist   | Tighter, syncopated; cool but pressing. Look for jazz with "tension" or "spy" tags. |
| jazz    | outcome | Slower, more reflective swing. |
| tense   | idle    | Sparse synth pads, low pulse. |
| tense   | heist   | Driving synth, suspense — "Dark Mystery" (incompetech) and similar. |
| tense   | outcome | Cold, resolved synth — fade-friendly. |
| piano   | idle    | Solo piano, slow tempo, a few sustained chords. |
| piano   | heist   | More urgent piano figures, still sparse. |
| piano   | outcome | Single-line resolution piece. |
| lofi    | idle    | Soft beat, vinyl crackle, mellow. |
| lofi    | heist   | Stickier beat, bass-led, still chill. |
| lofi    | outcome | Slow lo-fi outro. |

## Drop-in workflow

1. Pick tracks from a trusted source.
2. Save them as `public/audio/<station>/<context>.mp3`.
3. (Optional) For CC-BY tracks, add a line to the CREDITS screen — see `src/ui/components/CreditsModal.tsx`. Keep the format `"<title>" by <artist> — <license> — <source url>`.
4. Reload the game; the engine picks up the new file on the next screen-context change. Hard reload (`Ctrl-F5`) if your browser is aggressively caching.

## Optional: fetch script

If you settle on a curated list of direct download URLs, drop them into the table at the top of `scripts/fetch-audio.mjs`. Then `npm run fetch-audio` (after adding the script to `package.json`) will populate `public/audio/`.
