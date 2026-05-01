import { HeistTarget } from '../engine/types';

export const TARGETS: HeistTarget[] = [
  // ---------------- TIER 1 ----------------
  {
    id: 'prisonBreak',
    name: 'PRISON BREAK',
    tier: 1,
    requirement: { kind: 'sum', op: 'lt', value: 10, minDice: 5 },
    flavor: 'Five names on the list. Nobody gets left behind.',
  },
  {
    id: 'vaultOfGold',
    name: 'VAULT OF GOLD',
    tier: 1,
    requirement: { kind: 'xOfAKind', count: 5 },
    flavor: 'Dumb, heavy, and exactly as advertised.',
  },
  // The city's oldest private vault. Padded walls, padded stories, old money.
  {
    id: 'velvet-vault',
    name: 'THE VELVET VAULT',
    tier: 1,
    requirement: { kind: 'sum', op: 'gte', value: 12, minDice: 2 },
    flavor: 'Soft walls, hard locks. The money inside is older than the city.',
  },
  // A hilltop telegraph station — climb it, tap the wire, walk out with the ciphers.
  {
    id: 'rooks-hill-relay',
    name: 'SIGNAL RELAY ON ROOK’S HILL',
    tier: 1,
    requirement: { kind: 'straight', length: 3 },
    flavor: 'Three ciphers in sequence. The operator never hears you come up.',
  },
  // The Baron keeps three identical keys so no servant can guess which
  // unlocks the liquor cabinet. You need all three.
  {
    id: 'barons-brass-key',
    name: 'THE BARON’S BRASS KEYS',
    tier: 1,
    requirement: { kind: 'xOfAKind', count: 3 },
    flavor: 'He had three cut identical, so no servant could guess which.',
  },

  // ---------------- TIER 2 ----------------
  {
    id: 'artGallery',
    name: 'ART GALLERY',
    tier: 2,
    requirement: { kind: 'sum', op: 'eq', value: 15, minDice: 4 },
    flavor: 'The forgery is on the wall by morning.',
  },
  {
    id: 'crownJewels',
    name: 'CROWN JEWELS',
    tier: 2,
    requirement: { kind: 'sum', op: 'gte', value: 20 },
    flavor: 'Every country wants them. None deserve them.',
  },
  // The off-books book. Names, bribes, and every deal the Mayor pretends not
  // to remember.
  {
    id: 'mayors-black-ledger',
    name: 'THE MAYOR’S BLACK LEDGER',
    tier: 2,
    requirement: { kind: 'sum', op: 'gte', value: 17 },
    flavor: 'Every bribe, every favor. He thinks it’s in a safer place than it is.',
  },
  // A four-in-hand cash-coach on the north road. The combination is set by
  // the dispatcher and changes every run — sequence it or walk.
  {
    id: 'iron-courier-coach',
    name: 'THE IRON COURIER COACH',
    tier: 2,
    requirement: { kind: 'straight', length: 4 },
    flavor: 'Four-in-hand, iron-shod, and the combination rotates on the hour.',
  },
  // A boutique aviary full of automaton birds. The bounty is paid by exact
  // count — too few and the buyer balks; too many and the cage is missed.
  {
    id: 'glasshouse-menagerie',
    name: 'THE GLASSHOUSE MENAGERIE',
    tier: 2,
    requirement: { kind: 'sum', op: 'eq', value: 15, minDice: 4 },
    flavor: 'The buyer pays by exact weight. Over or under and the deal walks.',
  },

  // ---------------- TIER 3 ----------------
  {
    id: 'theMoon',
    name: 'THE MOON',
    tier: 3,
    requirement: { kind: 'sum', op: 'gte', value: 25 },
    flavor: 'A metaphor. Also literal.',
  },
  {
    id: 'alienRelic',
    name: 'ALIEN RELIC',
    tier: 3,
    requirement: { kind: 'xOfAKind', count: 4 },
    flavor: 'Nobody knows what it does. The buyer has cash.',
  },
  // The crown of a dead empire, kept behind ritual and weight. The prize of
  // the run.
  {
    id: 'obsidian-crown',
    name: 'THE OBSIDIAN CROWN',
    tier: 3,
    requirement: { kind: 'sum', op: 'gte', value: 24, minDice: 4 },
    flavor: 'Heavier than it looks. Every king who wore it died wearing it.',
  },
  // Four identical tumblers, each linked to the next. You set them all at
  // once or not at all.
  {
    id: 'thornwick-vault',
    name: 'THE THORNWICK VAULT',
    tier: 3,
    requirement: { kind: 'xOfAKind', count: 4 },
    flavor: 'Four tumblers, one motion. Thornwick built it so greed had to be precise.',
  },
  // A clocktower full of clocks that must be made to chime in order for the
  // vault behind them to open. Five bells, one chance.
  {
    id: 'cathedral-of-clocks',
    name: 'THE CATHEDRAL OF CLOCKS',
    tier: 3,
    requirement: { kind: 'straight', length: 5 },
    flavor: 'Five bells, in order. The vault behind them opens on the final chime.',
  },
];

export function getTargetsByTier(tier: 1 | 2 | 3): HeistTarget[] {
  return TARGETS.filter((t) => t.tier === tier);
}
