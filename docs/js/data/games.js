// THE GAME LIST. Every card, category, game page and the home page are built from this.
//
// Add a game:
//   1. Add an entry below.
//   2. Copy docs/games/_template/ to docs/games/<slug>/ (the folder name must match `slug`).
//   3. Put its images in that folder and point icon/thumb/banner/shots at them.
//
// Fields (only slug, title and genres are required):
//   slug       url name: /games/<slug>/
//   title      shown everywhere
//   tagline    one short line under the title on cards
//   genres     category keys from CATEGORIES below; they fill the Games dropdown
//   status     "live" (playable), "wip" (in the workshop) or "idea"
//   progress   0-100, only for "wip": the bar in the workshop panel
//   featured   true = rotates in the big home banner
//   trending   true = shows in Trending Now
//   released   "YYYY-MM-DD"; NEW badge for 30 days after
//   updated    "YYYY-MM-DD"; UPDATED badge for 30 days after
//   version, controls, platforms, session   the details box on the game page
//   play       link for the PLAY button (a folder in this site or any URL)
//   icon       square image, 256x256
//   thumb      card image, 640x360
//   banner     big hero image, 1600x900
//   shots      list of screenshots, 16:9
//   about      description; blank line = new paragraph
//   howto      list of short steps
//   log        devlog: [{ date: "YYYY-MM-DD", text: "..." }], newest first
//   sample     true = placeholder entry; delete these once real games are in
//
// Missing images show a placeholder frame, so a game can go up before its art is ready.

window.CATEGORIES = {
  arcade: 'Arcade',
  puzzle: 'Puzzle',
  casino: 'Casino',
  rpg: 'RPG',
  strategy: 'Strategy',
  idle: 'Idle',
  story: 'Story'
};

window.GAMES = [
  {
    slug: 'sample-neon-drift', sample: true,
    title: 'Neon Drift', tagline: 'Slide through traffic. Do not touch the walls.',
    genres: ['arcade'], status: 'live', featured: true, trending: true,
    released: '2026-10-02', updated: '2026-10-09', version: '1.1',
    controls: 'Arrow keys or swipe', platforms: 'Desktop, mobile', session: '2–5 min',
    play: '#',
    about: 'Placeholder game. Replace this entry in docs/js/data/games.js with a real one.\n\nThis paragraph shows how a second paragraph looks on the game page.',
    howto: ['Steer with the arrow keys or swipe.', 'Pass cars close for bonus points.', 'Hit a wall and the run ends.'],
    log: [{ date: '2026-10-09', text: 'v1.1: new night track, smoother steering on mobile.' }, { date: '2026-10-02', text: 'v1.0: first release.' }]
  },
  {
    slug: 'sample-hoard-keeper', sample: true,
    title: 'Hoard Keeper', tagline: 'Count the gold before the dragon wakes.',
    genres: ['casino', 'idle'], status: 'live', featured: true, trending: true,
    released: '2026-08-14', updated: '2026-10-05', version: '2.0',
    controls: 'Mouse or touch', platforms: 'Desktop, mobile', session: '10+ min',
    play: '#',
    about: 'Placeholder game. Replace this entry with a real one.',
    howto: ['Pick your numbers.', 'Draw.', 'Spend winnings on upgrades.'],
    log: [{ date: '2026-10-05', text: 'v2.0: upgrade tree, new sound.' }]
  },
  {
    slug: 'sample-tile-tactics', sample: true,
    title: 'Tile Tactics', tagline: 'Small board, big decisions.',
    genres: ['strategy', 'puzzle'], status: 'live', trending: true,
    released: '2026-06-20', updated: '2026-07-01', version: '1.0',
    controls: 'Mouse', platforms: 'Desktop', session: '15–30 min',
    play: '#',
    about: 'Placeholder game. Replace this entry with a real one.',
    howto: ['Place a unit.', 'End your turn.', 'Hold the centre to win.'],
    log: [{ date: '2026-06-20', text: 'v1.0: first release.' }]
  },
  {
    slug: 'sample-wildlands', sample: true,
    title: 'Wildlands', tagline: 'Track, tame and travel.',
    genres: ['rpg'], status: 'live', featured: true,
    released: '2026-09-28', updated: '2026-09-28', version: '0.9',
    controls: 'Keyboard', platforms: 'Desktop', session: '30+ min',
    play: '#',
    about: 'Placeholder game. Replace this entry with a real one.',
    howto: ['WASD to move.', 'E to interact.'],
    log: [{ date: '2026-09-28', text: 'v0.9: open beta.' }]
  },
  {
    slug: 'sample-block-bloom', sample: true,
    title: 'Block Bloom', tagline: 'Match colours, grow the garden.',
    genres: ['puzzle'], status: 'wip', progress: 60,
    controls: 'Mouse or touch', platforms: 'Desktop, mobile',
    about: 'Placeholder game. Replace this entry with a real one.',
    log: [{ date: '2026-10-07', text: 'Level editor works. Twenty levels drafted.' }]
  },
  {
    slug: 'sample-night-shift', sample: true,
    title: 'Night Shift', tagline: 'A short story about a long night.',
    genres: ['story'], status: 'wip', progress: 25,
    about: 'Placeholder game. Replace this entry with a real one.',
    log: [{ date: '2026-09-30', text: 'Script first draft done.' }]
  }
];
