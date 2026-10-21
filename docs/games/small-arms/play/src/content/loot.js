// Things that last between runs: hats, skins, and weapon runes, and the slot machine that
// pays them out. Data only; spinning is in game/slots.js.

// One hat at a time: with his build, a hat is the only gear that fits.
export const HATS = {
  cap:     { name: 'Ball Cap', text: 'Run 6% faster.', bonus: { speed: 0.06 } },
  hardhat: { name: 'Hard Hat', text: '+20 most health.', bonus: { maxHp: 20 } },
  cowboy:  { name: 'Ten-Gallon', text: 'Handguns hit 15% harder.', bonus: { handgun: 0.15 } },
  beanie:  { name: 'Beanie', text: 'Guns reload 10% faster.', bonus: { reload: 0.1 } },
  party:   { name: 'Party Hat', text: 'Creatures drop 15% more coins.', bonus: { coins: 0.15 } },
  crown:   { name: 'Crown', text: 'Weapons earn 20% more XP.', bonus: { xp: 0.2 } },
  wizard:  { name: 'Wizard Hat', text: 'Abilities come back 15% sooner.', bonus: { cooldown: 0.15 } },
  tophat:  { name: 'Top Hat', text: 'Dash comes back 25% sooner.', bonus: { dash: 0.25 } },
};

// Skins repaint all of him. The first six are colour sets on the same painted face; a skin
// with png set uses that painted sheet instead (layout: models/skins/skin-sheet-guides.png).
export const SKINS = {
  peach:  { name: 'Peach', top: '#f9bd9b', low: '#e08876', limb: 0xe58f7c, blush: 'rgba(245, 140, 150, 0.75)' },
  mint:   { name: 'Mint', top: '#b8f0d0', low: '#6cc49a', limb: 0x5fb48a, blush: 'rgba(255, 150, 170, 0.6)' },
  grape:  { name: 'Grape', top: '#c9a8f0', low: '#8a62c4', limb: 0x7f58b8, blush: 'rgba(255, 140, 200, 0.6)' },
  gold:   { name: 'Gold Rush', top: '#ffe58a', low: '#d9a028', limb: 0xc8901c, blush: 'rgba(255, 130, 90, 0.6)' },
  ghost:  { name: 'Ghost', top: '#f4f4fa', low: '#b8bcd8', limb: 0xa8acc8, blush: 'rgba(170, 190, 255, 0.6)' },
  shadow: { name: 'Shadow', top: '#5a5070', low: '#2b2338', limb: 0x2b2338, blush: 'rgba(255, 60, 110, 0.6)', eyes: '#ff5a7a' },
  // Painted sheets (art/skins/ holds the originals; tools/view/skin-import.html makes these).
  watermelon: { name: 'Watermelon', png: 'models/skins/watermelon.jpg' },
  pizza:      { name: 'Pepperoni', png: 'models/skins/pizza.jpg' },
  galaxy:     { name: 'Galaxy', png: 'models/skins/galaxy.jpg' },
  lava:       { name: 'Lava Lamp', png: 'models/skins/lava.jpg' },
  disco:      { name: 'Disco Ball', png: 'models/skins/disco.jpg' },
  frost:      { name: 'Frostbite', png: 'models/skins/frost.jpg' },
  wood:       { name: 'Woodgrain', png: 'models/skins/wood.jpg' },
  honey:      { name: 'Honey Drip', png: 'models/skins/honey.jpg' },
};
export const DEFAULT_SKIN = 'peach';

// A rune is infused into one weapon for good. It changes what the weapon does and how it looks.
// Runes come in three tiers: three of one tier merge into one of the next. tiers[n] is what
// tier n + 1 does; text says it for the Armory.
export const RUNES = {
  fire: {
    name: 'Fire Rune', color: 0xff7a1a,
    tiers: [
      { text: 'Sets creatures alight: they burn for a while after each hit.', burn: 0.2 },
      { text: 'Burns hotter.', burn: 0.32 },
      { text: 'Burns hotter still, and a creature that burns to death sets those nearby alight.', burn: 0.45, spread: true },
    ],
  },
  frost: {
    name: 'Frost Rune', color: 0x7fd8ff,
    tiers: [
      { text: 'Hits slow creatures down.', slow: 1.6 },
      { text: 'Hits slow creatures down for longer.', slow: 2.6 },
      { text: 'Slows for longer, and one hit in eight freezes a creature solid.', slow: 2.6, freeze: 0.125 },
    ],
  },
  shock: {
    name: 'Shock Rune', color: 0xf8e040,
    tiers: [
      { text: 'Hits arc to one more creature nearby.', arcs: 1 },
      { text: 'Hits arc to two more creatures.', arcs: 2 },
      { text: 'Hits arc to three more creatures, harder.', arcs: 3, arcShare: 0.65 },
    ],
  },
  venom: {
    name: 'Venom Rune', color: 0x8fe040,
    tiers: [
      { text: 'Hits poison; poison stacks five deep.', poison: 0.1, stacks: 5 },
      { text: 'Stronger poison, stacking seven deep.', poison: 0.13, stacks: 7 },
      { text: 'Stacks seven deep, and a full stack bursts for all its poison at once.', poison: 0.13, stacks: 7, burst: true },
    ],
  },
  blood: {
    name: 'Blood Rune', color: 0xe0203c,
    tiers: [
      { text: 'Hits heal you a little.', heal: 0.03 },
      { text: 'Hits heal you more.', heal: 0.045 },
      { text: 'Hits heal you more, and healing past full becomes up to 25 plate.', heal: 0.06, overheal: 25 },
    ],
  },
};
export const RUNE_TIERS = 3;
export const MERGE_COUNT = 3;           // runes of one tier that make one of the next
export const SOCKET_COST = 5;           // tier I runes, of any kind, to open a weapon's second socket
export const TIER_NAMES = ['I', 'II', 'III'];

// The slot machine. Tokens are bought with coins and carry over between runs.
export const TOKEN_PRICE = 60;
// What a spin pays, by weight. Mostly common powers; the lasting things are rare.
export const PRIZES = [
  { kind: 'power', weight: 58 },
  { kind: 'coins', weight: 14 },
  { kind: 'rune', weight: 12 },
  { kind: 'hat', weight: 8 },
  { kind: 'skin', weight: 5 },
  { kind: 'jackpot', weight: 3 },
];
// The symbols on the reels, and which prize each three-of-a-kind means.
export const SYMBOLS = ['POW', 'COIN', 'RUNE', 'HAT', 'SKIN', '7'];
export const SYMBOL_FOR = { power: 'POW', coins: 'COIN', rune: 'RUNE', hat: 'HAT', skin: 'SKIN', jackpot: '7' };
