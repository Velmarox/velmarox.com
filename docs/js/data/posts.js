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

window.POSTS = [
  {
    slug: 'sample-site-launch', sample: true, type: 'news',
    title: 'The site is live', date: '2026-10-11', tag: 'Site',
    excerpt: 'Placeholder news item. Short announcements go in the News tab.'
  },
  {
    slug: 'sample-shop-open', sample: true, type: 'news',
    title: 'Shop opens soon', date: '2026-10-10', tag: 'Shop',
    excerpt: 'Placeholder news item about the shop.'
  },
  {
    slug: 'sample-welcome', sample: true,
    title: 'Welcome to the site', date: '2026-10-11', tag: 'Thoughts',
    excerpt: 'Placeholder post. This is where blog posts show up, newest first.'
  },
  {
    slug: 'sample-devlog', sample: true,
    title: 'Devlog placeholder', date: '2026-10-09', tag: 'Devlog', game: 'animalism',
    excerpt: 'Placeholder post tied to a game. It also appears on that game\'s page.'
  }
];
