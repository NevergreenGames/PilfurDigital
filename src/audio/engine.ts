import { Screen } from '../engine/types';
import { Station, useSettingsStore } from '../state/settingsStore';

// --- Public API -------------------------------------------------------------
//
// The audio engine plays a single looping track at a time. Tracks are bucketed
// into three "contexts" (idle / heist / outcome) and N "stations" (the radio
// presets in settings). The engine maps the current Screen to a context, picks
// a track based on the active station, and crossfades between tracks when
// either the screen-context or the station changes.
//
// Tracks are loaded lazily from `public/audio/<station>/<context>.mp3`. If the
// file isn't present (404), the engine silently no-ops — the game runs fine
// without any audio assets, which is the default state of a fresh checkout.
//
// Browsers block autoplay until the user interacts with the page, so callers
// MUST invoke `unlockAudio()` from a user-gesture handler (we wire this in
// App.tsx). Anything started before unlock is queued and applied on unlock.
//
// All other code only needs `setScreen(screen)` to keep audio in sync.

type Context = 'idle' | 'heist' | 'outcome';

const SCREEN_TO_CONTEXT: Record<Screen, Context> = {
  title: 'idle',
  characterSelect: 'idle',
  map: 'idle',
  heist: 'heist',
  draft: 'idle',
  gameOver: 'outcome',
  dev: 'idle',
};

const FADE_MS = 800;

interface ActiveTrack {
  audio: HTMLAudioElement;
  station: Station;
  context: Context;
  fadeRaf?: number;
}

let unlocked = false;
let current: ActiveTrack | null = null;
let lastDesired: { station: Station; context: Context } | null = null;
let lastSettings = { ...useSettingsStore.getState() };

function trackUrl(station: Station, context: Context): string {
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './';
  return `${base.endsWith('/') ? base : base + '/'}audio/${station}/${context}.mp3`;
}

function masterMusicVolume(): number {
  return useSettingsStore.getState().musicVolume;
}

function fadeVolume(track: ActiveTrack, toVol: number, ms: number, onDone?: () => void): void {
  if (track.fadeRaf) cancelAnimationFrame(track.fadeRaf);
  const fromVol = track.audio.volume;
  const start = performance.now();
  const step = () => {
    const t = ms <= 0 ? 1 : Math.min(1, (performance.now() - start) / ms);
    track.audio.volume = fromVol + (toVol - fromVol) * t;
    if (t < 1) track.fadeRaf = requestAnimationFrame(step);
    else onDone?.();
  };
  track.fadeRaf = requestAnimationFrame(step);
}

function applyDesired(): void {
  if (!unlocked || !lastDesired) return;
  const { station, context } = lastDesired;
  if (current && current.station === station && current.context === context) return;

  const next: ActiveTrack = {
    audio: new Audio(trackUrl(station, context)),
    station,
    context,
  };
  next.audio.loop = true;
  next.audio.volume = 0;
  // Suppress error logs in console for missing files; play() rejects when the
  // file 404s and that's a normal case.
  next.audio.play().catch(() => {
    /* missing file or autoplay blocked */
  });

  const target = masterMusicVolume();
  fadeVolume(next, target, FADE_MS);

  if (current) {
    const old = current;
    fadeVolume(old, 0, FADE_MS, () => {
      old.audio.pause();
      old.audio.src = '';
    });
  }
  current = next;
}

export function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  applyDesired();
}

export function setScreen(screen: Screen): void {
  const station = useSettingsStore.getState().station;
  const context = SCREEN_TO_CONTEXT[screen];
  lastDesired = { station, context };
  applyDesired();
}

// React to settings changes (volume + station).
useSettingsStore.subscribe((state) => {
  if (state.musicVolume !== lastSettings.musicVolume) {
    if (current) fadeVolume(current, state.musicVolume, 200);
  }
  if (state.station !== lastSettings.station && lastDesired) {
    lastDesired = { station: state.station, context: lastDesired.context };
    applyDesired();
  }
  lastSettings = { ...state };
});
