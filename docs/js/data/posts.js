// BLOG POSTS AND NEWS. Both tabs are built from this one list.
//
// Add a post:
//   1. Add an entry below (newest at the top).
//   2. Blog: copy docs/blog/_template/ to docs/blog/<slug>/.
//      News: copy docs/news/_template/ to docs/news/<slug>/.
//      Write the post inside <article>.
//
// Blog = longer pieces (devlogs, thoughts). News = short announcements (releases, site updates).
//
// Fields:
//   slug     url name: /blog/<slug>/ or /news/<slug>/
//   type     "news" for the News tab; leave out for Blog
//   title
//   date     "YYYY-MM-DD"
//   tag      short label: "Devlog", "Update", "Release", "Thoughts" ...
//   game     optional: a game slug; the post then also shows on that game's page
//   excerpt  one or two sentences for the card
//   cover    optional image, 16:9
//   sample   true = placeholder; delete once real posts are in

// COMMENTS. Every post (blog, devlog and news) gets a comment box under the post. Comments are stored in
// GitHub Discussions on this repo (through giscus.app), in the category named below; each post is the
// discussion titled post:<slug>, made on its first comment. Visitors sign in with GitHub to comment.
window.GISCUS = {
  repo: 'Velmarox/velmarox.com',
  repoId: 'R_kgDOVFGvcA',
  category: 'Community',
  categoryId: 'DIC_kwDOVFGvcM4DHmjD'
};

// The Discord invite: the footer link and the Discord box on the home page. Leave it '' to hide both.
window.DISCORD = 'https://discord.gg/dcsAHeymNd';

window.POSTS = [
  {
    slug: 'why-war-chats',
    title: 'Nobody Knew What They Were Doing', date: '2026-10-20', tag: 'Thoughts', game: 'war-chats',
    cover: '/blog/why-war-chats/cover.jpg',
    excerpt: 'History bored me as a kid. Then a YouTube video turned World War II into a group chat, and I realized every empire in the textbook was a group of people winging it.'
  },
  {
    slug: 'conveyance',
    title: 'The Crossroads of Game Design and Web UX', date: '2026-10-17', tag: 'Thoughts',
    cover: '/blog/conveyance/cover.jpg',
    excerpt: 'Games teach you by letting you fail. Websites teach you by making sure you never do. Conveyance, the yellow paint, and the form that wipes itself.'
  },
  {
    slug: 'update-the-exe',
    title: 'Update the exe (sorry for yelling)', date: '2026-10-14', tag: 'Thoughts',
    cover: '/blog/update-the-exe/cover.jpg',
    excerpt: 'Last night I yelled at my app in all caps, then apologized to it. The yelling turned out to be the best bug report I wrote all week.'
  },
  {
    slug: 'tempers-and-a-discord-backup',
    title: 'Tempers, patch notes and a Discord backup', date: '2026-10-14', tag: 'Devlog',
    cover: '/blog/tempers-and-a-discord-backup/cover.jpg',
    excerpt: 'Warrior Codex NPCs get tempers, the players get patch notes, Datcord gets an installer, and a regency campaign exists on paper.'
  },
  {
    slug: 'your-passion-is-not-a-waste-of-time',
    title: 'Your passion is not a waste of time', date: '2026-10-13', tag: 'Thoughts',
    cover: '/blog/your-passion-is-not-a-waste-of-time/cover.jpg',
    excerpt: 'For six years I was told the things I love were holding us back. Then I started my own business and had a client in the first week.'
  },
  {
    slug: 'contract-zero-first-build', game: 'contract-zero',
    title: 'Contract Zero: from a design on paper to a first build', date: '2026-10-13', tag: 'Devlog',
    cover: '/blog/contract-zero-first-build/cover.jpg',
    excerpt: 'One guy, creature bounties, and the only way to win is to throw stuff into things. How the first playable build came together, and what is still untested.'
  },
  {
    slug: 'one-long-day',
    title: 'One long day: dice on stream, and an app that opens twice', date: '2026-10-13', tag: 'Devlog',
    cover: '/blog/one-long-day/cover.jpg',
    excerpt: 'Everything I worked on in one day: Clack Attack gets an OBS overlay, the Warrior Codex player app is fixed, and a new game exists on paper.'
  },
  {
    slug: 'you-can-make-anything-you-want',
    title: 'You Can Make Anything You Want (Terms and Conditions Apply)', date: '2026-10-12', tag: 'Thoughts',
    cover: '/blog/you-can-make-anything-you-want/cover.jpg',
    excerpt: 'My dad told me I could make anything that runs on a computer. He was right. He left out the fine print.'
  },
  {
    slug: 'three-casino-games',
    title: 'Three casino games, and the maths is the hard part', date: '2026-10-12', tag: 'Thoughts',
    cover: '/blog/three-casino-games/cover.jpg',
    excerpt: 'A slot and two kenos, built to Montana machine limits. Why I made them, how they differ, and why the cash-outs still do not match.'
  },
  {
    slug: 'installers-patchers-and-a-pixel-dog',
    title: 'Installers, patchers and a pixel dog', date: '2026-10-11', tag: 'Thoughts',
    cover: '/blog/installers-patchers-and-a-pixel-dog/cover.jpg',
    excerpt: 'I wanted to send Karmen a game without a zip and a list of instructions. Here is everything I ended up learning.'
  },
  {
    slug: 'vrx-games-is-live', type: 'news',
    title: 'VRX Games is live', date: '2026-10-11', tag: 'Site',
    cover: '/news/vrx-games-is-live/cover.jpg',
    excerpt: 'Everything I make, in one place: three casino games, a dice roller, a notepad and a roguelike.'
  },
  {
    slug: 'clack-attack-on-phones', type: 'news', game: 'clack-attack',
    title: 'Clack Attack works on phones', date: '2026-10-11', tag: 'Update',
    cover: '/news/clack-attack-on-phones/cover.jpg',
    excerpt: 'The tray moves to the top, the buttons get bigger, and a tap clears the dice.'
  },
  {
    slug: 'clack-attack-painted-trays', game: 'clack-attack',
    title: 'Clack Attack: every tray gets painted', date: '2026-10-09', tag: 'Devlog',
    cover: '/blog/clack-attack-painted-trays/cover.jpg',
    excerpt: 'From 1.0 to 1.3 in one day: nineteen trays, all with real artwork now, and an updater that actually swaps itself in.'
  },
  {
    slug: 'pokedungeon-1-23', game: 'pokedungeon',
    title: 'PokéDungeon 1.23: shops are people, and deep floors pay', date: '2026-09-21', tag: 'Devlog',
    cover: '/blog/pokedungeon-1-23/cover.jpg',
    excerpt: 'Shopkeepers you walk up to, a pier that is the only way down, and an XP curve that stops teams falling behind.'
  }
];
