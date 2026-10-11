// Writes link-preview tags (Open Graph / Twitter) into every page's <head>, plus docs/sitemap.xml and
// docs/robots.txt, from the same data files the site uses. Run after adding a game, post or thread:
//   node tools/build_meta.mjs
// Each page gets a block between <!-- meta --> and <!-- /meta -->; the script replaces only that block.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'docs');
const SITE = 'https://velmarox.com';
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['games', 'posts', 'threads']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/data', f + '.js'), 'utf8'), ctx);
const { GAMES = [], POSTS = [], THREADS = [] } = ctx.window;

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const abs = u => (u ? (u.startsWith('http') ? u : SITE + u) : SITE + '/assets/brand/og-default.jpg');
const pages = [];
const add = (url, title, desc, image, type = 'website') => pages.push({ url, title, desc, image: abs(image), type });

add('/', 'VRX Games', 'Games, tools and devlogs, made by one person. Play in your browser, no installs, no ads.');
add('/games/', 'All games | VRX Games', 'Every game and tool on VRX Games, from finished to half-built.');
add('/blog/', 'Blog | VRX Games', 'Devlogs, thoughts and whatever else is on my mind.');
add('/news/', 'News | VRX Games', 'Releases, updates and announcements.');
add('/community/', 'Community | VRX Games', 'Talk about the games, report bugs, pitch ideas.');
add('/shop/', 'Shop | VRX Games', 'Soundtracks, extras and merch. Coming soon.');
for (const g of GAMES) add(`/games/${g.slug}/`, `${g.title} | VRX Games`, g.tagline || '', g.banner || g.thumb);
for (const p of POSTS) {
  const g = GAMES.find(x => x.slug === p.game);
  add(`/${p.type === 'news' ? 'news' : 'blog'}/${p.slug}/`, `${p.title} | VRX Games`, p.excerpt || '', p.cover || (g && (g.banner || g.thumb)), 'article');
}
for (const t of THREADS) add(`/community/${t.slug}/`, `${t.title} | Community | VRX Games`, t.excerpt || '', null, 'article');

let n = 0;
for (const p of pages) {
  const file = path.join(ROOT, p.url, 'index.html');
  if (!fs.existsSync(file)) { console.warn('missing page:', p.url); continue; }
  let html = fs.readFileSync(file, 'utf8');
  const block = [
    '<!-- meta -->',
    `  <link rel="canonical" href="${SITE}${p.url}">`,
    `  <meta name="description" content="${esc(p.desc)}">`,
    `  <meta property="og:site_name" content="VRX Games">`,
    `  <meta property="og:type" content="${p.type}">`,
    `  <meta property="og:url" content="${SITE}${p.url}">`,
    `  <meta property="og:title" content="${esc(p.title)}">`,
    `  <meta property="og:description" content="${esc(p.desc)}">`,
    `  <meta property="og:image" content="${esc(p.image)}">`,
    `  <meta name="twitter:card" content="summary_large_image">`,
    '  <!-- /meta -->'
  ].join('\n');
  html = html.replace(/\s*<meta name="description" content="[^"]*">/, '');
  html = /<!-- meta -->[\s\S]*?<!-- \/meta -->/.test(html)
    ? html.replace(/<!-- meta -->[\s\S]*?<!-- \/meta -->/, block)
    : html.replace(/(\s*)<\/head>/, `\n  ${block}\n</head>`);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(p.title)}</title>`);
  fs.writeFileSync(file, html);
  n++;
}
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  pages.map(p => `  <url><loc>${SITE}${p.url}</loc></url>`).join('\n') + '\n</urlset>\n');
fs.writeFileSync(path.join(ROOT, 'robots.txt'),
  `User-agent: *\nDisallow: /games/_template/\nDisallow: /blog/_template/\nDisallow: /news/_template/\nDisallow: /community/_template/\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`meta written to ${n} pages; sitemap has ${pages.length} urls`);
