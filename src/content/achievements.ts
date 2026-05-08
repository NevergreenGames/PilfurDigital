import { Achievement } from '../engine/types';

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'silenceRun',
    name: 'GHOST PROTOCOL',
    icon: '👻',
    description:
      'Complete a heist without the heat claiming a single phase card.',
  },
  {
    id: 'roadTested',
    name: 'ROAD-TESTED',
    icon: '⚒️',
    description: 'Clear a full run — all five jobs, one getaway.',
  },
  {
    id: 'endowment',
    name: 'ENDOWMENT',
    icon: '💵',
    description: 'Win a heist while sitting on at least 10 creds.',
  },
  {
    id: 'doubleExposed',
    name: 'DOUBLE-EXPOSED',
    icon: '🌀',
    description: 'Complete a heist as THE PHANTOM.',
  },
];

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
