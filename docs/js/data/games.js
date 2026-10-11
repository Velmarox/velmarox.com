// THE GAME LIST. Every card, category, game page and the home page are built from this.
//
// Add a game:
//   1. Add an entry below.
//   2. Copy docs/games/_template/ to docs/games/<slug>/ (the folder name must match `slug`).
//   3. Put its images in that folder and point icon/thumb/banner/shots at them.
//   4. Put the playable build in docs/games/<slug>/play/ and set play: '/games/<slug>/play/'.
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
//   links      extra buttons under PLAY: [{ label: '...', url: '...' }]
//   download   { label: 'Download for Windows', url: '...', note: '...' } (url blank = "no public download yet")
//   flag       short badge on cards, e.g. 'Fan game'
//   warning    { title: '...', text: '...' } big hazard banner at the top of the game page
//
// Missing images show a placeholder frame, so a game can go up before its art is ready.

window.CATEGORIES = {
  casino: 'Casino',
  slots: 'Slots',
  action: 'Action',
  arcade: 'Arcade',
  roguelike: 'Roguelike',
  tools: 'Tools',
  puzzle: 'Puzzle',
  rpg: 'RPG',
  strategy: 'Strategy',
  idle: 'Idle',
  story: 'Story'
};

window.GAMES = [
  {
    slug: 'keno',
    title: 'Wyrmhoard Keno', tagline: 'Eighty squares. Twenty drawn. Four eggs open the hoard.',
    genres: ['casino'], status: 'live', featured: true, trending: true,
    released: '2026-09-10',
    controls: 'Mouse or touch', platforms: 'Desktop, mobile',
    play: '/games/keno/play/',
    links: [{ label: 'Verify the maths', url: '/games/keno/play/verify.html' }],
    thumb: '/games/keno/thumb.jpg', banner: '/games/keno/cover.jpg',
    shots: ['/games/keno/cover.jpg', '/games/keno/shot-1.jpg'],
    about: 'Eighty squares, pick your spots, twenty drawn. Four dragon eggs open a run of free games, and more eggs inside the run add games to the counter.\n\nEvery pay value comes from the maths, not the page. The maths verifier runs the outcome logic in your browser for as many rounds as you like and puts the return it produces next to the return the pay table claims.\n\nPlay money only. Nothing here takes or pays real money.',
    howto: ['Pick your spots on the 80-number board.', 'Set your bet and press start. Twenty numbers are drawn.', 'Catch four dragon eggs to open a run of free games.', 'Eggs inside the run add more games to the counter.'],
    log: [{ date: '2026-10-11', text: 'Moved to velmarox.com.' }]
  },
  {
    slug: 'elos-hoard',
    title: "Elo's Hoard", tagline: 'Video keno with coin multipliers. Catch all three and the Hoard opens.',
    genres: ['casino'], status: 'live', featured: true, trending: true,
    released: '2026-09-10',
    controls: 'Mouse or touch', platforms: 'Desktop, mobile',
    play: '/games/elos-hoard/play/',
    thumb: '/games/elos-hoard/thumb.jpg', banner: '/games/elos-hoard/cover.jpg',
    shots: ['/games/elos-hoard/cover.jpg', '/games/elos-hoard/shot-1.jpg'],
    about: "Montana-style video keno on an engraved stone slab. Mark four to ten, twenty drawn, and three coins land on numbers you didn't pick. Catch the second one and it multiplies your win. Catch all three and the Hoard opens.\n\nMake a free name-and-passcode account inside the game and your keno and slot plays land on the shared leaderboard. Guest play works without one.\n\nPlay money only. Nothing here takes or pays real money.",
    howto: ['Mark four to ten numbers.', 'Twenty are drawn, then three coins land on numbers you did not pick.', 'Catch a coin to multiply your win.', 'Catch all three coins and the Hoard opens.'],
    log: [{ date: '2026-10-11', text: 'Moved to velmarox.com.' }]
  },
  {
    slug: 'safari-time',
    title: 'Safari Time', tagline: 'Five reels, ten lines, wilds that stick through the feature.',
    genres: ['casino', 'slots'], status: 'live', featured: true, trending: true,
    released: '2026-09-10',
    controls: 'Mouse or touch', platforms: 'Desktop, mobile',
    play: '/games/safari-time/play/',
    thumb: '/games/safari-time/thumb.jpg', banner: '/games/safari-time/cover.jpg',
    shots: ['/games/safari-time/cover.jpg', '/games/safari-time/shot-1.jpg'],
    about: 'A five-reel, ten-line video slot. Wilds expand to fill the reel, scatters award up to twenty free games, and in the feature the wilds stick around for the whole run. Built to real machine limits.\n\nPlays count toward the shared leaderboard if you are signed in through Elo\'s Hoard.\n\nPlay money only. Nothing here takes or pays real money.',
    howto: ['Set your lines and bet.', 'Spin. Wilds expand to fill their reel.', 'Land scatters for up to twenty free games.', 'In the feature, wilds stay put for the whole run.'],
    log: [{ date: '2026-10-11', text: 'Moved to velmarox.com.' }]
  },
  {
    slug: 'animalism',
    title: 'Animalism', tagline: 'A rock em sock em picture. Walk right and deal with whoever is in the way.',
    genres: ['action', 'arcade'], status: 'live', featured: true, trending: true,
    released: '2026-09-10',
    controls: 'Keyboard or gamepad', platforms: 'Desktop',
    play: '/games/animalism/play/',
    thumb: '/games/animalism/thumb.jpg', banner: '/games/animalism/cover.jpg',
    shots: ['/games/animalism/cover.jpg', '/games/animalism/shot-1.jpg'],
    about: 'You are Animal. Walk right and deal with whoever is in the way.\n\nA belt-scroll beat \'em up with hand-drawn sprites, physics written from scratch and full controller support. Press F1 in-game to see the hitboxes.',
    howto: ['Walk right.', 'Hit whoever is in the way.', 'Plug in a controller if you have one.', 'Press F1 to show the hitboxes.'],
    log: [{ date: '2026-10-11', text: 'Moved to velmarox.com.' }]
  },
  {
    slug: 'clack-attack',
    title: 'Clack Attack', tagline: 'Type a roll, watch real 3D dice tumble across a themed tray.',
    genres: ['tools'], status: 'live', trending: true,
    released: '2026-10-09', updated: '2026-10-09', version: '1.3.0',
    controls: 'Touch, or keyboard and mouse', platforms: 'Browser (phone or desktop), Windows app',
    play: '/games/clack-attack/play/',
    download: { label: 'Windows app', url: 'https://github.com/Velmarox/clack-attack-releases/releases/latest', note: 'The Windows app updates itself and can stay on top of other windows.' },
    thumb: '/games/clack-attack/thumb.jpg', banner: '/games/clack-attack/cover.jpg',
    shots: ['/games/clack-attack/cover.jpg', '/games/clack-attack/shot-2.jpg', '/games/clack-attack/shot-3.jpg', '/games/clack-attack/shot-4.jpg'],
    about: 'The 3D dice from the Warrior Codex as a small app of their own. Type a roll or click a dice button, watch the dice tumble across a themed tray, and keep a log of every roll.\n\nNineteen trays, from green felt and a forest floor to cyberpunk and a nineties carpet, plus colours, skins, face icons and presets for the dice themselves.\n\nPlay it here in the browser, or grab the Windows app.',
    howto: ['Type dice like 1d20, 2d6+3 or 4d6kh3 and press Enter, or click a quick dice button.', 'Adv / Dis rolls 2d20 and keeps the higher or lower.', 'Pick a tray from the top bar, and change the dice in Dice look.', 'Esc clears the dice off the tray.'],
    log: [
      { date: '2026-10-11', text: 'Phone layout: tray on top, bigger buttons, tap the tray to clear the dice.' },
      { date: '2026-10-11', text: 'Playable in the browser on velmarox.com.' },
      { date: '2026-10-09', text: 'v1.3.0: Forest Druid gets its own painted tray. Every tray now has artwork.' },
      { date: '2026-10-09', text: 'v1.2.0: painted artwork for 14 trays, plus Green Felt, Magenta Felt and Nineties.' },
      { date: '2026-10-09', text: 'v1.0.0: first release.' }
    ]
  },
  {
    slug: 'pokedungeon',
    title: 'PokéDungeon', tagline: 'An endless Mystery Dungeon roguelike. Descend forever, collect everyone.',
    genres: ['roguelike', 'rpg'], status: 'live', featured: true, trending: true, flag: 'Fan game',
    released: '2026-09-11', updated: '2026-09-21', version: '1.23.0',
    controls: 'Keyboard and mouse', platforms: 'Windows', session: 'As long as you like',
    download: { label: 'Download', url: '', note: 'No public download yet.' },
    warning: {
      title: 'Unofficial fan game',
      text: 'PokéDungeon is a free, non-commercial fan project. It is not made, approved or endorsed by Nintendo, The Pokémon Company, Game Freak, Creatures or Spike Chunsoft. Pokémon and all related names, characters and artwork belong to their owners. The sprites and tilesets come from the community PMDCollab project and remain the work of their artists. Nothing about it is for sale.'
    },
    about: 'An endless Mystery Dungeon style roguelike. Pick one of the nine classic starters on the beach, choose Manual or Auto, descend forever, and collect every Pokémon that decides to come with you.\n\nThe dungeon is filled with around 850 species. Friendly Pokémon give you quests on the floor (fetch a keepsake, escort them to the stairs, rescue a downed friend, find three hidden kids) and join you when you finish. Hostiles you knock out sometimes get back up impressed and ask to join too.\n\nSwitch to any Pokémon you have picked up at any time. The run only ends when nobody is left, on the floor or in the Pokédex.\n\nAuto mode plays the leader for you: it eats, heals, fights, takes quests, grabs items and heads for the stairs.',
    howto: ['Move with the arrow keys or WASD; Q, E, Z and C for diagonals.', 'Walk into a hostile Pokémon to attack. Space attacks what you face, 1–4 use moves.', 'Walk into a friendly (marked ?) to take its quest. Finish it and it joins you.', 'M switches between Manual and Auto at any time.', 'Step on an exit pad to go back to the beach, heal and rearrange the team.'],
    log: [
      { date: '2026-09-21', text: 'v1.23.0: shops are Pokémon you walk up to, the pier is the way down, deep floors are worth a level.' },
      { date: '2026-09-11', text: 'v0.1.0: first build.' }
    ]
  }
];
