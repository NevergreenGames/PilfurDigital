import { Rig } from '../engine/types';

/*
 * RIGS — kit-loadout choices the player picks immediately after
 * character select. A rig contributes the starting pool dice and
 * starting creds for the run. Most rigs are unlocked by completing
 * specific achievements; the default 'standard' rig is always
 * available so brand-new players have a viable choice.
 *
 * Author conventions:
 *   - Keep `id` short and stable (storage / patches reference it).
 *   - `unlockAchievementId` omitted = always available. Set to an id
 *     defined in content/achievements.ts to gate the rig.
 *   - `startingDice` describes the bonus dice (the character die is
 *     added separately by buildFreshHeist; you don't list it here).
 */
export const RIGS: Rig[] = [
  {
    id: 'standard',
    name: 'STANDARD KIT',
    icon: '🎒',
    flavor: 'Same loadout every job: one good die and a tight pocket.',
    startingDice: [{ size: 6, source: 'stash', count: 1 }],
    startingGold: 0,
  },
  {
    id: 'silence',
    name: 'SILENCE',
    icon: '👻',
    flavor: 'Slip in. Slip out. Nothing left for them to find.',
    startingDice: [{ size: 4, source: 'ghost', count: 4 }],
    startingGold: 4,
    unlockAchievementId: 'silenceRun',
  },
  {
    id: 'heavyMetal',
    name: 'HEAVY METAL',
    icon: '⚒️',
    flavor: 'Big iron, fewer apologies. Brought to you by experience.',
    startingDice: [
      { size: 12, source: 'stash', count: 1 },
      { size: 8, source: 'stash', count: 1 },
    ],
    startingGold: 0,
    unlockAchievementId: 'roadTested',
  },
  {
    id: 'greasePalms',
    name: 'GREASE PALMS',
    icon: '💵',
    flavor: 'A thick wad of paper opens more doors than any lockpick.',
    startingDice: [{ size: 6, source: 'stash', count: 1 }],
    startingGold: 12,
    unlockAchievementId: 'endowment',
  },
  {
    id: 'phantomShift',
    name: 'PHANTOM SHIFT',
    icon: '🌀',
    flavor: 'Half a foot in the next room. Half a foot in the last one.',
    startingDice: [
      { size: 6, source: 'ghost', count: 2 },
      { size: 8, source: 'ghost', count: 2 },
    ],
    startingGold: 0,
    unlockAchievementId: 'doubleExposed',
  },
  {
    id: 'goLoud',
    name: 'GO LOUD',
    icon: '💥',
    flavor: 'No subtlety. Three for the lock, one for whoever heard.',
    // Three d6 in the pool plus one extra d6 dropped into the heat tray
    // on the first heist (engine routes source: 'heat' into heist.heat).
    startingDice: [
      { size: 6, source: 'stash', count: 3 },
      { size: 6, source: 'heat', count: 1 },
    ],
    startingGold: 0,
  },
];

export function getRig(id: string): Rig | undefined {
  return RIGS.find((r) => r.id === id);
}
