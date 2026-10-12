// COMMUNITY THREADS. The thread list on /community/ is built from this.
//
// Replies are stored in GitHub Discussions on this repo (through giscus.app). Visitors sign in
// with a GitHub account to reply. Until GISCUS below is filled in, threads show a
// "replies open soon" box instead of the reply form.
//
// Turn replies on (one time):
//   1. github.com/Velmarox/velmarox.com > Settings > General > Features: tick Discussions.
//   2. Install the giscus app: https://github.com/apps/giscus (choose only this repo).
//   3. In Discussions, add a category called "Community" (type: Announcement, so only you can start threads).
//   4. Go to https://giscus.app, enter Velmarox/velmarox.com, pick that category, and copy
//      data-repo-id and data-category-id into repoId and categoryId below.
//
// Add a thread:
//   1. Add an entry below.
//   2. Copy docs/community/_template/ to docs/community/<slug>/, set data-slug, write the opening post in <article>.
//
// Fields: slug, title, date, board (General, Ideas, Bugs, Show off ...), excerpt, pinned (true/false),
//         game (optional game slug), sample (true = placeholder).

window.GISCUS = {
  repo: 'Velmarox/velmarox.com',
  repoId: 'R_kgDOVFGvcA',
  category: 'Community',
  categoryId: 'DIC_kwDOVFGvcM4DHmjD'
};

// The Discord invite: the Join the Discord button on /community/. Leave it '' to hide the button.
window.DISCORD = 'https://discord.gg/dcsAHeymNd';

window.BOARDS = ['General', 'Ideas', 'Bugs', 'Show off'];

window.THREADS = [
  {
    slug: 'say-hi', pinned: true,
    title: 'Say hi', date: '2026-10-11', board: 'General',
    excerpt: 'Introduce yourself. What are you playing?'
  },
  {
    slug: 'what-next', 
    title: 'What should I make next?', date: '2026-10-11', board: 'Ideas',
    excerpt: 'Game ideas, tool ideas, requests. All welcome.'
  },
  {
    slug: 'bug-reports',
    title: 'Bug reports', date: '2026-10-11', board: 'Bugs',
    excerpt: 'Something broke? Post it here with the game, your browser and your device.'
  }
];
