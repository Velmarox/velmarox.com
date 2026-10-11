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
  repoId: '',
  category: 'Community',
  categoryId: ''
};

window.BOARDS = ['General', 'Ideas', 'Bugs', 'Show off'];

window.THREADS = [
  {
    slug: 'sample-say-hi', sample: true, pinned: true,
    title: 'Say hi', date: '2026-10-11', board: 'General',
    excerpt: 'Placeholder thread. Introduce yourself, tell me what you are playing.'
  },
  {
    slug: 'sample-what-next', sample: true,
    title: 'What should I make next?', date: '2026-10-10', board: 'Ideas',
    excerpt: 'Placeholder thread for game ideas and requests.'
  },
  {
    slug: 'sample-bug-reports', sample: true,
    title: 'Bug reports: Neon Drift', date: '2026-10-09', board: 'Bugs', game: 'sample-neon-drift',
    excerpt: 'Placeholder thread. Post bugs here with your browser and device.'
  }
];
