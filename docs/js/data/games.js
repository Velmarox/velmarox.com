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
//   unlisted   true = the page still works at /games/<slug>/, but nothing on the site links to it
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
  story: 'Story',
  history: 'History'
};

window.GAMES = [
  {
    slug: 'small-arms',
    title: 'Small Arms', tagline: 'One little guy, tiny arms, a lot of weapons. Survive the rounds, pick a card, go again.',
    genres: ['action', 'arcade', 'roguelike'], status: 'live', featured: true, trending: true, flag: 'Early build',
    released: '2026-10-20', updated: '2026-10-21', version: '1.5.0',
    controls: 'Keyboard and mouse, a twin-stick controller, or touch', platforms: 'Browser (desktop or phone)', session: '10-30 minutes a run',
    play: '/games/small-arms/play/',
    thumb: '/games/small-arms/thumb.jpg', banner: '/games/small-arms/cover.jpg',
    shots: ['/games/small-arms/cover.jpg', '/games/small-arms/shot-1.jpg', '/games/small-arms/shot-2.jpg', '/games/small-arms/shot-3.jpg', '/games/small-arms/shot-4.jpg', '/games/small-arms/shot-5.jpg'],
    about: "The little pink guy from Contract Zero, with weapons this time. The creatures are the same ones, and they still draw every attack on the floor before it lands. The rounds never stop.\n\nHe holds one weapon at a time and carries up to four. A handgun goes out in front in both tiny fists. For a rifle he turns side-on and shoulders it. A bat or a katana gets swung in a wide arc, a spear gets thrust, and the chainsaw gets held out and leaned on. Melee ignores the Shell's armour and knocks rocks out of the air.\n\nThere is no shop. After every round three cards are dealt, one from each deck: a weapon, an ability or a power. Take one. A weapon you already have makes its next upgrade cheap, and you pay for upgrades with the coins the creatures drop. Coins also buy a fresh deal of cards, a patch-up between rounds, or a forced upgrade with no duplicate at all. Abilities run on a cooldown, powers are used once, and you can hold three of each. They are all gone when the run ends.\n\nSome things last. Every weapon earns its own XP, and the Armory turns it into permanent ranks. Between rounds a slot machine takes tokens and pays out mostly powers, and now and then a rune, a hat or a skin. A rune infuses one weapon for good: fire, frost, shock, venom or blood. Three of a tier merge into a stronger one, up to tier III, and a weapon can open a second socket to carry two runes at once. A hat is the only gear that fits him, and each one does something small. There are fourteen skins to win, from Watermelon and Pepperoni to Galaxy and Disco Ball.\n\nThis is an early build and it has been balanced against a bot, not people, so expect rough edges. Saves stay in your browser only.\n\nThe weapons are from the 036 Weapon Pack and the muzzle flashes are from BinbunVFX. Drawing by three.js (MIT). Pixel fonts from the Not Jam font pack (CC0). Every sound is made in the browser.",
    howto: ['WASD to move, mouse to aim, hold the left button to shoot or swing. Space or right mouse dashes, and nothing can hurt you mid-dash.', 'Mouse wheel, Tab or 1 to 4 swaps weapons. A gun you are not holding reloads itself.', 'Q, E and F are your abilities. Z, X and C use your powers.', 'A red shape on the floor is an attack about to land. Get out of it. A Charger that misses you and hits a wall is stunned and takes extra damage.', 'Shoot a Shell in the back or the side, or hit it with something you swing.', 'After a round, take one of three cards, or pay to deal again. Between rounds, upgrade your weapons (cheaper with a duplicate), patch up, spin the slot machine, and spend weapon XP and runes in the Armory.', 'On a phone, hold it sideways. Put a finger anywhere on the left half to move; the right half aims, and he attacks while you hold it. Swap, Reload and Dash are along the bottom, your abilities and powers top right.', 'Controller: left stick moves, right stick aims, RT attacks, LT dashes, the bumpers swap weapons, A B Y are abilities and the D-pad uses powers.'],
    log: [
      { date: '2026-10-21', text: 'v1.5.0: more to spend coins and runes on. Deal the cards again ($50, doubling), force an upgrade without a duplicate at 2.5 times the price, and patch up 25 health between rounds. Three runes of a tier merge into the next, up to tier III, which adds a trick to each rune, and every weapon can open a second socket for two different runes.' },
      { date: '2026-10-20', text: 'v1.4.0: plays on phones and tablets, held sideways, with twin-stick touch controls: move with your left thumb, aim and attack with your right, buttons for the rest. Menus fit a phone screen.' },
      { date: '2026-10-20', text: 'v1.3.0: eight new skins to win on the slot machine: Watermelon, Pepperoni, Galaxy, Lava Lamp, Disco Ball, Frostbite, Woodgrain and Honey Drip. Skins now cover his arms and legs too, not just his body.' },
      { date: '2026-10-20', text: 'v1.2.1: first release on the site. One weapon held at a time, posed by its size, with five melee weapons. Card picks from three decks after every round, 15 abilities, 15 powers, weapon XP and permanent ranks, a slot machine, eight hats, six skins and five runes.' }
    ]
  },
  {
    slug: 'war-chats',
    title: 'War Chats', tagline: 'History as a group chat, with a live map of who is talking, what borders moved, and what really happened.',
    genres: ['history', 'story'], status: 'live', featured: true, trending: true, flag: 'Interactive',
    released: '2026-10-20', updated: '2026-10-21', version: '2.0.2',
    controls: 'Space or Next for each message; mouse or touch', platforms: 'Browser (best on desktop)', session: '20-40 minutes a war',
    play: '/games/war-chats/play/',
    thumb: '/games/war-chats/thumb.jpg', banner: '/games/war-chats/cover.jpg',
    shots: ['/games/war-chats/shot-1.jpg', '/games/war-chats/shot-2.jpg', '/games/war-chats/shot-3.jpg', '/games/war-chats/shot-4.jpg'],
    links: [{ label: 'Watch the video that started it', url: 'https://www.youtube.com/watch?v=51ZathOeW2E' }],
    about: "Whole wars played out as a Discord server. Every country (and the odd emperor) is a user, every major event is a channel, and the chat clock runs from midnight to midnight across the war, so the time stamps line up with the real calendar.\n\nNext to the chat is a war-room map. It moves to wherever the conversation is, highlights who is talking, and recolors the borders as they change: who invaded whom, who switched sides, who stopped existing. Every scene has a Notes card with what actually happened, with dates and numbers, so the jokes come with the real story behind them.\n\nAll nine chats are in: the Roman Empire (all two thousand years of it), the Three Kingdoms, the Boer War, World War I, World War II, the Pacific War, the Korean War, the Cold War and the War on Terror.\n\nThe World War II chat is the script from Server History's YouTube video IF WW2 WAS A DISCORD CHAT (HISTORICALLY ACCURATE). Every joke in it is theirs; the map, notes and timeline were added here. The other eight chats are original scripts written for this site in the same style.\n\nMap effects from the Super Pixel Effects Gigapack by Will Tice / unTied Games.",
    howto: ['Press Space (or Next) for the next message. Left arrow or Back steps back, R restarts.', 'Press P to let it play by itself.', 'Pick a war from the server icons on the left, and jump to any event from the channel list.', 'Click Notes on the map for the real history behind the current scene.', 'M turns the message ding off, N the music. The minus and plus buttons resize the chat.', 'Your place in every war is saved in your browser, so you can pick up where you left off.'],
    log: [
      { date: '2026-10-21', text: 'v2.0.2: a volume slider next to Chat sound and Music, for both the ding and the anthem. It remembers where you left it.' },
      { date: '2026-10-20', text: 'v2.0.1: map effects loop for as long as their scene is on screen: battles keep going off, arrows keep landing, alerts keep flashing.' },
      { date: '2026-10-20', text: 'v2.0.0: the Boer War chat, 1652 to 1902, and with it every server is open. Its clock speeds up so the war gets most of the day; the Boer republics are drawn on the map, then annexed, then crossed with blockhouse lines.' },
      { date: '2026-10-20', text: 'v1.9.0: pixel effects on the map. Battles go off with explosions (clashes and dust in the Roman and Three Kingdoms chats), invasion arrows land with an impact, and Petrov and the Cuban Missile Crisis get alerts. Massacres, terror attacks and atomic bombings stay quiet.' },
      { date: '2026-10-20', text: 'v1.8.0: the World War I chat, 1871 to 1919: from the Hall of Mirrors back to the Hall of Mirrors, with the Schlieffen Plan, the Western Front and occupied Belgium on the map.' },
      { date: '2026-10-20', text: 'v1.7.0: the WWII Pacific chat, 1931 to 1945: Manchuria to the Missouri, with Japanese-occupied territory spreading and shrinking on the map.' },
      { date: '2026-10-20', text: 'v1.6.0: the Cold War chat, 1945 to 1991: Yalta to the fall of the Soviet Union, with East Germany and South Vietnam drawn on the map, the Iron Curtain, the Berlin Wall and the Cuban quarantine line.' },
      { date: '2026-10-20', text: 'v1.5.0: the War on Terror chat, 2001 to 2021: 9/11, Afghanistan, Iraq, Abbottabad, ISIS and the fall of Kabul, with ISIS and Taliban territory shaded on the map.' },
      { date: '2026-10-20', text: 'v1.4.0: the Three Kingdoms chat, 184 to 280 AD: the Yellow Turbans to the Jin. The map shades Wei, Shu and Wu as their borders move, and a user called The Novel keeps adding the famous legends while everyone else corrects it.' },
      { date: '2026-10-20', text: 'v1.3.1: server icons for World War II, the Roman Empire, the Three Kingdoms, the Boer War, World War I, the Pacific War and the Korean War.' },
      { date: '2026-10-20', text: 'v1.3.0: the Korean War chat gets the same treatment as Rome: shorter messages split across lines, looser wording, no full stops at the end of everything.' },
      { date: '2026-10-20', text: 'v1.2.0: the Roman Empire chat reads like a real group chat now. Caesar and Cleopatra change their profile pictures to each other, and Cleopatra posts the photos. Nine more Roman profile pictures, and the loading screen stays up a little longer so you can read the fact.' },
      { date: '2026-10-20', text: 'v1.1.1: new profile pictures in the Roman Empire chat for Diocletian, Maximian, Constantine, Maxentius, Valens, Theodosius, Honorius, Arcadius, Alaric and Attila.' },
      { date: '2026-10-20', text: 'v1.1.0: Histcord. A loading screen with a history fact, then a login that types itself with a different joke username every time. World War II is pinned to the top of the server list with its own icon, and a pinned message explains what the whole thing is.' },
      { date: '2026-10-20', text: 'v1.0.0: on the site. World War II, the Roman Empire and the Korean War, each with its own map, notes and timeline.' }
    ]
  },
  {
    slug: 'contract-zero',
    title: 'Contract Zero', tagline: 'Creature bounties. One guy. The only way to win is to throw stuff into things.',
    genres: ['action', 'arcade', 'roguelike'], status: 'live', featured: true, trending: true, flag: 'Early build',
    released: '2026-10-13', updated: '2026-10-13', version: '0.1.0',
    controls: 'Keyboard and mouse, or a controller', platforms: 'Browser (desktop)', session: '15-30 minutes a streak',
    play: '/games/contract-zero/play/',
    thumb: '/games/contract-zero/thumb.jpg', banner: '/games/contract-zero/cover.jpg',
    shots: ['/games/contract-zero/shot-1.jpg', '/games/contract-zero/shot-2.jpg', '/games/contract-zero/shot-3.jpg', '/games/contract-zero/shot-4.jpg'],
    about: "You are one guy taking creature bounties, and hitting things does nothing. Damage comes from impact: a crate into a creature, a creature into a wall, a creature into another creature.\n\nEvery attack is drawn on the floor before it lands, and time slows while you line up a throw, so you win by reading the room and picking your moment, not by fast hands.\n\nContracts chain into a streak. After each one you choose: cash out and bank the score, or push on to something nastier. Lose and you carry an injury; the third one ends the streak and you keep half. Deeper contracts add new rules instead of bigger health bars: a creature that throws your own crates back, one armoured across the front, a spike wall, a pit, ice. Every fifth contract is a Big One that changes what it does as it gets hurt.\n\nGear you pick up changes what a throw does (it sticks, it snaps back to your hands, it bounces at full speed) and is gone when the streak ends. Rep is what you keep, and it buys new creatures, objects and rooms. None of it makes you stronger.\n\nThis is the first build and it has been balanced against bots, not people, so expect rough edges. There is no sound yet. Scores are saved in your browser only.\n\nPhysics by Planck.js and drawing by three.js (both MIT). Pixel fonts from the Not Jam font pack (CC0). Controller button sprites from the Pixel SNES Controller Pack by Dead Revolver.",
    howto: ['The first time you press Start you get Contract Zero, a short training job: walk to a crate, hold to pick it up, let go to throw.', 'WASD to move, mouse to aim. Hold the left mouse button near something to grab it and charge the throw; release to throw. Time slows while you hold, until the ring around you runs out.', 'Right mouse or Space is a shove. It makes room, and it dazes small creatures so you can pick them up and throw them too.', 'A red shape on the floor is an attack about to land. Get out of it. A Charger that misses you and hits a wall hurts itself.', 'On a controller: D-pad to move and aim, hold R to stand still and aim, hold A to grab and charge, Y to shove, Start to pause.', 'Pick one of three contracts from the board. The card shows what you are up against before you commit.', 'After a win, take one of three rewards. After a loss, choose which injury to carry.', 'Cash out from the board whenever you like. The exit on the west wall opens 20 seconds into a fight if you want out: no score, no injury.'],
    log: [
      { date: '2026-10-13', text: 'v0.1.0: first build. Five creatures and a three-phase boss, four elite modifiers, five things to throw, six gear, four arena twists, three rooms, injuries, unlocks and a tutorial. 16-bit menus over low-poly 3D, and it plays on a controller.' }
    ]
  },
  {
    slug: 'clack-arena',
    title: 'Clack Arena', tagline: 'You are a die. Throw into a shared tray, crash into the enemy, engrave your faces.',
    genres: ['roguelike', 'strategy'], status: 'live', featured: true, trending: true, flag: 'Early build',
    released: '2026-10-12', updated: '2026-10-12', version: '0.8.4',
    controls: 'Mouse or touch', platforms: 'Browser (desktop or phone), Windows app', session: '15-25 minutes a run',
    play: '/games/clack-arena/play/',
    download: { label: 'Download for Windows', url: 'https://github.com/Velmarox/velmarox.com/releases/download/clack-arena-v0.8.4/Clack-Arena-Setup-0.8.4.exe', note: 'Installs for just you, no admin needed. Windows will say unknown publisher: click More info, then Run anyway.' },
    thumb: '/games/clack-arena/thumb.jpg', banner: '/games/clack-arena/cover.jpg',
    shots: ['/games/clack-arena/cover.jpg', '/games/clack-arena/shot-1.jpg', '/games/clack-arena/shot-2.jpg'],
    about: "You are a die. You start as Caltrop, a d4, and every enemy is a die too. You both throw into the same tray at the same time, the dice crash into each other, and whatever face you land on is what you do.\n\nAim your throw: where from, which way, how hard. Hit an enemy die hard mid-tumble and it takes damage, and you might knock it off its best face. Leave a die leaning on another and it's Pinned.\n\nBetween fights, engrave new faces at the Forge, buy items and relics at the Tavern, and decide whether to grow into a d6. Bigger dice have room for more faces, but every face comes up less often.\n\nThe dice, the physics and the Green Felt tray come from Clack Attack. This is an early build: one tray, the d4 and the d6, six enemies and The House.\n\nFace icons from the Fantasy RPG Icon Pack by Franuka (franuka.itch.io, CC BY 4.0). Enemy cats from the All Cats pack.",
    howto: ['Your first run opens with a five-step How to play, and the map, Forge, Tavern and Rest each explain themselves the first time you reach them, and each rule explains itself the first time it happens in a fight. Full rules are on the title screen any time.', 'Before each run, Customize picks your die\'s colour, numbers and finish. Glass, Pearl and Metal unlock when you beat the enemy made of them.', 'Press your die and pull back like a slingshot. Let go to fling it the other way. Longer pull, harder throw. (Settings can switch to dragging the way you want to throw.)', 'Aim at the enemy die to Clack it, or throw soft into a corner for a calm landing.', 'Tap any face on a die panel to read it. The coloured bars show each die\'s odds.', 'Use items from your panel: Lucky Star and Lead Weight before a throw, Nudge and No Throw after landing.', 'Pick your route on the map. Beat The House at the end of the Green Felt.'],
    log: [
      { date: '2026-10-12', text: 'v0.8.4: plays properly on a phone held sideways, with both panels in a column and the tray beside them. Skulls now cost a pip, for you and for enemies; engrave over them or sand them off at the Forge. Growing to a d6 adds two Skulls. Chalk is now Lucky Star, Talc is No Throw and Lead Shot is Lead Weight, and every item has a pixel icon from the same pack as the faces.' },
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
    slug: 'casino',
    title: 'VRX Casino', tagline: 'One cabinet, every casino game. Pick a game, play, go back for another.',
    genres: ['casino'], status: 'live', featured: true, trending: true, flag: 'Early build',
    released: '2026-10-13', updated: '2026-10-13', version: '0.2.0',
    controls: 'Mouse or touch', platforms: 'Desktop, mobile',
    play: '/games/casino/play/',
    thumb: '/games/casino/thumb.jpg', banner: '/games/casino/cover.jpg',
    shots: ['/games/casino/cover.jpg', '/games/safari-time/shot-1.jpg', '/games/keno/shot-1.jpg', '/games/elos-hoard/shot-1.jpg'],
    about: "A multi-game cabinet, like the ones on a Montana casino floor: one machine, a menu of games, and a button that takes you back to the menu.\n\nIt holds Safari Time, Wyrmhoard Keno and Elo's Hoard. Poker is on the menu as coming soon.\n\nOne balance for all of it. Your credits follow you from game to game and stay in your browser, and Insert $20 adds play money whenever you run dry.\n\nThis is an early build.\n\nPlay money only. Nothing here takes or pays real money.",
    howto: ['Pick a game from the menu.', 'Press Games in the top bar to go back and pick another.', 'Full screen fills your monitor like a cabinet.', 'Your credits show in the top bar. Insert $20 adds play money.'],
    log: [{ date: '2026-10-13', text: 'v0.2.0: one balance. Credits follow you between Safari Time, Wyrmhoard Keno and Elo\'s Hoard, show in the cabinet\'s bar, and stay in your browser. Insert $20 adds play money. The three games now live inside the cabinet and no longer have their own listings.' }, { date: '2026-10-13', text: 'v0.1.0: first build. A game menu and a frame: Safari Time, Wyrmhoard Keno and Elo\'s Hoard in one cabinet, with Poker marked coming soon.' }]
  },
  {
    slug: 'keno',
    title: 'Wyrmhoard Keno', tagline: 'Eighty squares. Twenty drawn. Four eggs open the hoard.',
    genres: ['casino'], status: 'live', unlisted: true,
    released: '2026-09-10', updated: '2026-10-13', version: '1.31.0',
    controls: 'Mouse or touch', platforms: 'Desktop, mobile',
    play: '/games/keno/play/',
    links: [{ label: 'Verify the maths', url: '/games/keno/play/verify.html' }],
    thumb: '/games/keno/thumb.jpg', banner: '/games/keno/cover.jpg',
    shots: ['/games/keno/cover.jpg', '/games/keno/shot-1.jpg'],
    about: 'Eighty squares, pick your spots, twenty drawn. Four dragon eggs open a run of free games, and more eggs inside the run add games to the counter.\n\nEvery pay value comes from the maths, not the page. The maths verifier runs the outcome logic in your browser for as many rounds as you like and puts the return it produces next to the return the pay table claims.\n\nPlay money only. Nothing here takes or pays real money.',
    howto: ['Pick your spots on the 80-number board.', 'Set your bet and press start. Twenty numbers are drawn.', 'Catch four dragon eggs to open a run of free games.', 'Eggs inside the run add more games to the counter.'],
    log: [{ date: '2026-10-13', text: 'Now part of VRX Casino, on one balance with the other casino games.' }, { date: '2026-10-11', text: 'A new look: square corners and a wide-screen layout.' }, { date: '2026-10-11', text: 'Moved to velmarox.com.' }]
  },
  {
    slug: 'elos-hoard',
    title: "Elo's Hoard", tagline: 'Video keno with coin multipliers. Catch all three and the Hoard opens.',
    genres: ['casino'], status: 'live', unlisted: true,
    released: '2026-09-10', updated: '2026-10-13', version: '1.14.0',
    controls: 'Mouse or touch', platforms: 'Desktop, mobile',
    play: '/games/elos-hoard/play/',
    thumb: '/games/elos-hoard/thumb.jpg', banner: '/games/elos-hoard/cover.jpg',
    shots: ['/games/elos-hoard/cover.jpg', '/games/elos-hoard/shot-1.jpg'],
    about: "Montana-style video keno on an engraved stone slab. Mark four to ten, twenty drawn, and three coins land on numbers you didn't pick. Catch the second one and it multiplies your win. Catch all three and the Hoard opens.\n\nMake a free name-and-passcode account inside the game and your keno and slot plays land on the shared leaderboard. Guest play works without one.\n\nPlay money only. Nothing here takes or pays real money.",
    howto: ['Mark four to ten numbers.', 'Twenty are drawn, then three coins land on numbers you did not pick.', 'Catch a coin to multiply your win.', 'Catch all three coins and the Hoard opens.'],
    log: [{ date: '2026-10-13', text: 'Now part of VRX Casino, on one balance with the other casino games.' }, { date: '2026-10-11', text: 'A new look: square corners and a wide-screen layout.' }, { date: '2026-10-11', text: 'Moved to velmarox.com.' }]
  },
  {
    slug: 'safari-time',
    title: 'Safari Time', tagline: 'Five reels, ten lines, wilds that stick through the feature.',
    genres: ['casino', 'slots'], status: 'live', unlisted: true,
    released: '2026-09-10', updated: '2026-10-13', version: '1.9.0',
    controls: 'Mouse or touch', platforms: 'Desktop, mobile',
    play: '/games/safari-time/play/',
    thumb: '/games/safari-time/thumb.jpg', banner: '/games/safari-time/cover.jpg',
    shots: ['/games/safari-time/cover.jpg', '/games/safari-time/shot-1.jpg'],
    about: 'A five-reel, ten-line video slot. Wilds expand to fill the reel, scatters award up to twenty free games, and in the feature the wilds stick around for the whole run. Built to real machine limits.\n\nPlays count toward the shared leaderboard if you are signed in through Elo\'s Hoard.\n\nPlay money only. Nothing here takes or pays real money.',
    howto: ['Set your lines and bet.', 'Spin. Wilds expand to fill their reel.', 'Land scatters for up to twenty free games.', 'In the feature, wilds stay put for the whole run.'],
    log: [{ date: '2026-10-13', text: 'Now part of VRX Casino, on one balance with the other casino games.' }, { date: '2026-10-11', text: 'A new look: square corners and a wide-screen layout.' }, { date: '2026-10-11', text: 'Moved to velmarox.com.' }]
  },
  {
    slug: 'animalism',
    title: 'Animalism', tagline: 'A rock em sock em picture. Walk right and deal with whoever is in the way.',
    genres: ['action', 'arcade'], status: 'live', unlisted: true,
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
    released: '2026-10-09', updated: '2026-10-13', version: '1.6.0',
    controls: 'Touch, or keyboard and mouse', platforms: 'Browser (phone or desktop), Windows app',
    play: '/tools/clack-attack/play/',
    download: { label: 'Download for Windows', url: 'https://github.com/Velmarox/clack-attack-releases/releases/latest', note: 'The Windows app updates itself and can stay on top of other windows.' },
    thumb: '/tools/clack-attack/thumb.jpg', banner: '/tools/clack-attack/cover.jpg',
    shots: ['/tools/clack-attack/cover.jpg', '/tools/clack-attack/shot-2.jpg', '/tools/clack-attack/shot-3.jpg', '/tools/clack-attack/shot-4.jpg'],
    about: 'The 3D dice from the Warrior Codex as a small app of their own. Type a roll or click a dice button, watch the dice tumble across a themed tray, and keep a log of every roll. Now with an OBS overlay plugin: the Windows app puts every roll on your stream.\n\nNineteen trays, from green felt and a forest floor to cyberpunk and a nineties carpet, plus colours, skins, face icons and presets for the dice themselves.\n\nGrab the Windows app, or try it here in the browser first.',
    howto: ['Type dice like 1d20, 2d6+3 or 4d6kh3 and press Enter, or click a quick dice button.', 'Adv / Dis rolls 2d20 and keeps the higher or lower.', 'Pick a tray from the top bar, and change the dice in Dice look.', 'Esc clears the dice off the tray.'],
    log: [
      { date: '2026-10-13', text: 'The browser build here catches up with the Windows app, v1.6.0: Sketch and striped dice, the number outline setting, earlier rolls staying in the tray, and "Rolling to ..." on every roll. The OBS overlay and the menu bar are in the Windows app only.' },
      { date: '2026-10-12', text: 'Windows app v1.6.0: a menu bar with every setting in it (Dice, Tray, Roll, Log, OBS, Window). What a roll is for reads "Rolling to ..." in the app, the log and on the OBS overlay, and you can change the wording. The roll log, empty since 1.5.0, records rolls again.' },
      { date: '2026-10-12', text: 'Windows app v1.5.1: the OBS overlay is a file you add as a local Browser Source, so OBS and Clack Attack can be opened in either order.' },
      { date: '2026-10-12', text: 'Windows app v1.5.0: an overlay for OBS. Your rolls show on stream with the same dice and look as the tray, in a corner or as a replay of the exact throw.' },
      { date: '2026-10-12', text: 'Windows app v1.4.0: Sketch dice, striped dice in six pride flags, a number outline setting, and up to three earlier rolls can stay in the tray.' },
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
