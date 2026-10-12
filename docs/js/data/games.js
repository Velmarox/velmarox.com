// THE GAME LIST. Every card, category, game page and the home page are built from this.
//
// Add a game:
//   1. Add an entry below.
//   2. Copy docs/games/_template/ to docs/games/<slug>/ (the folder name must match `slug`).
//      A tool (genres includes 'tools') lives on the Tools page instead: use docs/tools/<slug>/
//      and set data-page="game" in its index.html as usual. Tools show Download first; `play`
//      becomes a "Try it in the browser" button.
//   3. Put its images in that folder and point icon/thumb/banner/shots at them.
//   4. Put the playable build in docs/games/<slug>/play/ and set play: '/games/<slug>/play/'.
//
// Fields (only slug, title and genres are required):
//   slug       url name: /games/<slug>/
//   title      shown everywhere
//   tagline    one short line under the title on cards
//   genres     category keys from CATEGORIES below; they fill the Games dropdown ('tools' = Tools page)
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
    slug: 'clack-arena',
    title: 'Clack Arena', tagline: 'You are a die. Throw into a shared tray, crash into the enemy, engrave your faces.',
    genres: ['roguelike', 'strategy'], status: 'live', featured: true, trending: true, flag: 'Early build',
    released: '2026-10-12', updated: '2026-10-12', version: '0.8.0',
    controls: 'Mouse or touch', platforms: 'Browser (desktop or phone), Windows app', session: '15-25 minutes a run',
    play: '/games/clack-arena/play/',
    download: { label: 'Download for Windows', url: 'https://github.com/Velmarox/velmarox.com/releases/download/clack-arena-v0.8.0/Clack-Arena-Setup-0.8.0.exe', note: 'Installs for just you, no admin needed. Windows will say unknown publisher: click More info, then Run anyway.' },
    thumb: '/games/clack-arena/thumb.jpg', banner: '/games/clack-arena/cover.jpg',
    shots: ['/games/clack-arena/cover.jpg', '/games/clack-arena/shot-1.jpg', '/games/clack-arena/shot-2.jpg'],
    about: "You are a die. You start as Caltrop, a d4, and every enemy is a die too. You both throw into the same tray at the same time, the dice crash into each other, and whatever face you land on is what you do.\n\nAim your throw: where from, which way, how hard. Hit an enemy die hard mid-tumble and it takes damage, and you might knock it off its best face. Leave a die leaning on another and it's Pinned.\n\nBetween fights, engrave new faces at the Forge, buy items and relics at the Tavern, and decide whether to grow into a d6. Bigger dice have room for more faces, but every face comes up less often.\n\nThe dice, the physics and the Green Felt tray come from Clack Attack. This is an early build: one tray, the d4 and the d6, six enemies and The House.\n\nFace icons from the Fantasy RPG Icon Pack by Franuka (franuka.itch.io, CC BY 4.0). Enemy cats from the All Cats pack.",
    howto: ['Your first run opens with a five-step How to play, and the map, Forge, Tavern and Rest each explain themselves the first time you reach them, and each rule explains itself the first time it happens in a fight. Full rules are on the title screen any time.', 'Before each run, Customize picks your die\'s colour, numbers and finish. Glass, Pearl and Metal unlock when you beat the enemy made of them.', 'Press your die and pull back like a slingshot. Let go to fling it the other way. Longer pull, harder throw. (Settings can switch to dragging the way you want to throw.)', 'Aim at the enemy die to Clack it, or throw soft into a corner for a calm landing.', 'Tap any face on a die panel to read it. The coloured bars show each die\'s odds.', 'Use items from your panel: Chalk and Lead Shot before a throw, Nudge and Talc after landing.', 'Pick your route on the map. Beat The House at the end of the Green Felt.'],
    log: [
      { date: '2026-10-12', text: 'v0.8.0: finishes to unlock. Beat Glassjaw for Glass, Tumbler for Pearl and Iron Mike for Metal. The tray picker is gone from Customize: trays are being saved for difficulty levels.' },
      { date: '2026-10-12', text: 'v0.7.0: Customize before each run. Pick your die\'s colour, number colour and finish, and any of the 18 Clack Attack trays to play on. Looks only, and remembered for next time.' },
      { date: '2026-10-12', text: 'v0.6.0: the game explains its rules as they happen. The first Clack, Pin, Guard, Pierce, Charge, Thorns or Skull pauses the turn to say what it did. Face labels show the real number after pins and Charge, the turn strip says what each step does, dice show Heavy, Light and Bouncy tags, and chips are coins.' },
      { date: '2026-10-12', text: 'v0.5.0: pixel art faces and cat enemies. Every face kind has its own icon (sword, arrow, shield, potion, fire, thorns, skull, crown) on the dice and in the panels, and each enemy is a cat on the map.' },
      { date: '2026-10-12', text: 'v0.4.0: the map, the Forge, the Tavern, Rest and the after-fight screen each say what they are for the first time they come up.' },
      { date: '2026-10-12', text: 'v0.3.0: a short How to play the first time you start a run. Five steps, a Full rules button, and it only shows once.' },
      { date: '2026-10-12', text: 'v0.2.0: design overhaul. Slingshot aiming with a power meter, results that play out step by step, pip health bars, odds bars, tap-to-read faces, one-time tips, Settings, a rules page, sound effects, and pixel GUI pieces throughout.' },
      { date: '2026-10-12', text: 'v0.1.0: first playable. The Green Felt, the d4 and the d6, six enemies, the Forge, the Tavern and The House.' }
    ]
  },
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
    log: [{ date: '2026-10-11', text: 'A new look: square corners and a wide-screen layout.' }, { date: '2026-10-11', text: 'Moved to velmarox.com.' }]
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
    log: [{ date: '2026-10-11', text: 'A new look: square corners and a wide-screen layout.' }, { date: '2026-10-11', text: 'Moved to velmarox.com.' }]
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
    log: [{ date: '2026-10-11', text: 'A new look: square corners and a wide-screen layout.' }, { date: '2026-10-11', text: 'Moved to velmarox.com.' }]
  },
  {
    slug: 'clack-attack',
    title: 'Clack Attack', tagline: 'Type a roll, watch real 3D dice tumble across a themed tray.',
    genres: ['tools'], status: 'live', trending: true,
    released: '2026-10-09', updated: '2026-10-09', version: '1.3.0',
    controls: 'Touch, or keyboard and mouse', platforms: 'Browser (phone or desktop), Windows app',
    play: '/tools/clack-attack/play/',
    download: { label: 'Download for Windows', url: 'https://github.com/Velmarox/clack-attack-releases/releases/latest', note: 'The Windows app updates itself and can stay on top of other windows.' },
    thumb: '/tools/clack-attack/thumb.jpg', banner: '/tools/clack-attack/cover.jpg',
    shots: ['/tools/clack-attack/cover.jpg', '/tools/clack-attack/shot-2.jpg', '/tools/clack-attack/shot-3.jpg', '/tools/clack-attack/shot-4.jpg'],
    about: 'The 3D dice from the Warrior Codex as a small app of their own. Type a roll or click a dice button, watch the dice tumble across a themed tray, and keep a log of every roll.\n\nNineteen trays, from green felt and a forest floor to cyberpunk and a nineties carpet, plus colours, skins, face icons and presets for the dice themselves.\n\nGrab the Windows app, or try it here in the browser first.',
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
    thumb: '/games/pokedungeon/thumb.jpg', banner: '/games/pokedungeon/cover.jpg',
    shots: ['/games/pokedungeon/shot-1.png'],
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
  },
  {
    slug: 'notepadsupreme',
    title: 'NotePadSupreme', tagline: 'A simple, better notepad for Windows, with formatting and light/dark mode.',
    genres: ['tools'], status: 'live',
    released: '2026-09-13', updated: '2026-09-13', version: '0.2.0-alpha',
    controls: 'Keyboard and mouse', platforms: 'Windows 10 and 11',
    download: { label: 'Download for Windows', url: 'https://github.com/Velmarox/NotePadSupreme/releases/latest', note: 'Free. Installer or portable exe, no admin rights needed.' },
    icon: '/tools/notepadsupreme/icon.png', thumb: '/tools/notepadsupreme/thumb.jpg', banner: '/tools/notepadsupreme/cover.jpg',
    shots: ['/tools/notepadsupreme/shot-dark.png', '/tools/notepadsupreme/shot-light.png', '/tools/notepadsupreme/shot-installer.png'],
    about: "I made this because I hated Windows Notepad, and Notepad++ wasn't what I wanted either. I just wanted a little notepad. That is all this is: a simple, better notepad with formatting and light/dark mode. Free, and always will be.\n\nBold, italic, underline, strikethrough, colours, highlights, alignment, bullets and indents. Light and dark themes with matching title bar and scrollbars, word wrap and a focus mode.\n\nPlain .txt stays plain: it keeps its encoding and line endings, and if you add formatting it offers to save a formatted .rtf copy instead of silently dropping it.",
    howto: ['Download NotePadSupreme-Setup.exe and run it. It installs just for your Windows account.', 'If Windows says "Windows protected your PC", click More info, then Run anyway. The app just isn\'t code-signed.', 'Ctrl+V pastes as plain text; Ctrl+Shift+V keeps formatting.', 'F11 for focus mode.', 'To open .txt files with it: right-click a .txt, Open with, Choose another app, NotePadSupreme, Always.'],
    log: [
      { date: '2026-09-13', text: 'v0.2.0-alpha: installer with update in place and clean uninstall; readable highlights in dark mode.' },
      { date: '2026-09-13', text: 'v0.1.0-alpha: first release.' }
    ]
  }
];
