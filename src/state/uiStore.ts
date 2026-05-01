import { create } from 'zustand';

interface UIStore {
  settingsOpen: boolean;
  creditsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  openCredits: () => void;
  closeCredits: () => void;
  closeAll: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  settingsOpen: false,
  creditsOpen: false,
  openSettings: () => set({ settingsOpen: true, creditsOpen: false }),
  closeSettings: () => set({ settingsOpen: false }),
  openCredits: () => set({ creditsOpen: true, settingsOpen: false }),
  closeCredits: () => set({ creditsOpen: false }),
  closeAll: () => set({ settingsOpen: false, creditsOpen: false }),
}));
