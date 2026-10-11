// THE BLOG LIST. Cards on the home page and /blog/ are built from this.
//
// Add a post:
//   1. Add an entry below (newest at the top).
//   2. Copy docs/blog/_template/ to docs/blog/<slug>/ and write the post inside <article>.
//
// Fields:
//   slug     url name: /blog/<slug>/
//   title
//   date     "YYYY-MM-DD"
//   tag      short label: "Devlog", "Update", "Release", "Thoughts" ...
//   game     optional: a game slug; the post then also shows on that game's page
//   excerpt  one or two sentences for the card
//   cover    optional image, 16:9
//   sample   true = placeholder; delete once real posts are in

window.POSTS = [
  {
    slug: 'sample-welcome', sample: true,
    title: 'Welcome to the site', date: '2026-10-11', tag: 'News',
    excerpt: 'Placeholder post. This is where blog posts show up, newest first.'
  },
  {
    slug: 'sample-neon-drift-1-1', sample: true,
    title: 'Neon Drift 1.1: night track', date: '2026-10-09', tag: 'Update', game: 'sample-neon-drift',
    excerpt: 'Placeholder post tied to a game. It also appears on that game\'s page.'
  }
];
