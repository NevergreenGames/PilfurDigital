import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Station = 'jazz' | 'tense' | 'piano' | 'lofi';

export interface StationInfo {
  id: Station;
  name: string;
  description: string;
}

export const STATIONS: readonly StationInfo[] = [
  { id: 'jazz',  name: 'Heist Jazz',       description: 'Smooth swing, late-night noir.' },
  { id: 'tense', name: 'Tense Electronic', description: 'Dark synth, ambient suspense.' },
  { id: 'piano', name: 'Minimal Piano',    description: 'Sparse, contemplative keys.' },
  { id: 'lofi',  name: 'Lo-Fi',            description: 'Chilled beats, mellow grooves.' },
] as const;

export interface Settings {
  musicVolume: number; // 0..1
  sfxVolume: number;   // 0..1
  station: Station;
  reduceMotion: boolean;
}

interface SettingsStore extends Settings {
  setMusicVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setStation: (s: Station) => void;
  setReduceMotion: (b: boolean) => void;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      musicVolume: 0.5,
      sfxVolume: 0.7,
      station: 'jazz',
      reduceMotion: false,
      setMusicVolume: (v) => set({ musicVolume: clamp01(v) }),
      setSfxVolume: (v) => set({ sfxVolume: clamp01(v) }),
      setStation: (s) => set({ station: s }),
      setReduceMotion: (b) => set({ reduceMotion: b }),
    }),
    { name: 'pilfur.settings' },
  ),
);
