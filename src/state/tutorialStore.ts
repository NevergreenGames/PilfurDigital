import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TutorialStore {
  seen: Record<string, boolean>;
  isSeen: (id: string) => boolean;
  markSeen: (id: string) => void;
  resetAll: () => void;
}

export const useTutorialStore = create<TutorialStore>()(
  persist(
    (set, get) => ({
      seen: {},
      isSeen: (id) => Boolean(get().seen[id]),
      markSeen: (id) =>
        set((s) => (s.seen[id] ? s : { seen: { ...s.seen, [id]: true } })),
      resetAll: () => set({ seen: {} }),
    }),
    { name: 'pilfur.tutorial' },
  ),
);
