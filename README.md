# velmarox.com

Personal projects hub. Static site, no build step, hosted on GitHub Pages at
**https://velmarox.com**.

## Layout

GitHub Pages publishes the `docs/` folder. README and CHANGELOG stay at the top and are not published.

```
docs/
  index.html              home: featured banner, trending, new releases, latest posts, workshop
  games/index.html        all games; ?cat=<key> filters by category (the Games dropdown links here)
  games/<slug>/           one folder per game: index.html + that game's images
  games/_template/        copy this to start a new game page
  blog/index.html         all posts
  blog/<slug>/            one folder per post: the post text lives in its index.html
  blog/_template/         copy this to start a new post
  news/                   same as blog, for short announcements (news/_template/ to start one)
  community/index.html    thread list with board filters
  community/<slug>/       one folder per thread: opening post in index.html, replies via giscus
  community/_template/
  shop/index.html         product grid with type filters; images go in shop/img/
  404.html
  css/site.css            the look: black, crimson, electric yellow, cut corners, hazard stripes
  js/data/games.js        THE GAME LIST: every card, category and game page is built from it
  js/data/posts.js        BLOG + NEWS LIST: titles, dates, tags, excerpts (type: 'news' = News tab)
  js/data/threads.js      COMMUNITY: thread list, boards, giscus settings
  js/data/products.js     SHOP: products, prices, store links
  js/site.js              builds the header, dropdown, footer and every page from the two lists
  assets/favicon.svg
  CNAME, .nojekyll
```

Header and footer are added by `site.js`, so every page gets the same nav automatically.

## Adding a game

1. Open `docs/js/data/games.js` and add an entry. The comment at the top lists every field.
2. Copy `docs/games/_template/` to `docs/games/<slug>/` and change `data-slug="CHANGE-ME"` to the slug.
3. Drop the images into that folder and reference them, e.g. `thumb: '/games/<slug>/thumb.jpg'`.

| Image  | Size      | Where it shows |
|--------|-----------|----------------|
| icon   | 256x256   | card corner, game page header |
| thumb  | 640x360   | cards |
| banner | 1600x900  | home banner (featured games), game page |
| shots  | 16:9      | game page gallery |

Missing images show a placeholder frame. Categories in the dropdown come from the games' `genres`;
add new category names to `CATEGORIES` at the top of games.js.

## Writing a blog post

1. Add an entry at the top of `docs/js/data/posts.js` (title, date, tag, excerpt; `game` to link it to a game).
2. Copy `docs/blog/_template/` to `docs/blog/<slug>/`, set `data-slug`, write the post inside `<article>`.

## Community replies (one-time setup)

Threads are pages you start; replies are stored in GitHub Discussions on this repo through
[giscus](https://giscus.app). Visitors need a GitHub account to reply. Until it's set up, threads
show "Replies open soon". Steps are at the top of `docs/js/data/threads.js`.

## Shop

The shop is a storefront only. Each product's `link` points to where it's actually sold
(itch.io, Ko-fi, Gumroad, a print-on-demand store). No payments happen on this site.

## Removing the samples

Entries with `sample: true` are placeholders, and while any exist a striped "Preview" bar shows under
the header. Delete them from every list in `docs/js/data/` and delete the matching `sample-*` folders under games/, blog/, news/ and community/.

## Versioning

Bump `<meta name="version">` in every page (`grep -rl 'name="version"' docs`) and add a `CHANGELOG.txt` entry with
every release (patch = fixes, minor = new content). Git history keeps the old versions.

## The games (ported from VRX Games / pixel-den)

The four games came from the `pixel-den` repo (velmaroxie.web.app) and live here at
`docs/games/<slug>/play/`. Their info pages are `docs/games/<slug>/`. Changes made when porting:

- `keno/play/casino-ledger.js` and `safari-time/play/casino-ledger.js`: `CREATE_URL` and `BOARD_URL`
  point at `/games/elos-hoard/play/`.
- The VRX badge on every game page links to `../` (the game's info page) and uses the
  crimson/yellow logo in `docs/assets/brand/`.

When a game is rebuilt, copy its build into `play/` again and re-apply those two edits.

Elo's Hoard accounts (and the shared leaderboard in Keno and Safari Time) sign in against the
`elos-hoard` Firebase project, which only accepts sign-ins from its authorised domains. Add
`velmarox.com` in Firebase console > elos-hoard > Authentication > Settings > Authorised domains,
or sign-in fails here. Guest play is unaffected.

## Hosting setup (one time)

### 1. Turn on GitHub Pages

Repo **Settings → Pages**:
- Source: **Deploy from a branch**, branch **main**, folder **/docs**. Save.
- Custom domain: `velmarox.com` (the `docs/CNAME` file already sets it). Save.
- Once the DNS check passes, tick **Enforce HTTPS**. The certificate can take up to an
  hour to issue.

### 2. Point the domain at GitHub (GoDaddy)

GoDaddy → **My Products → velmarox.com → DNS → Manage DNS**. Delete any existing `A`
record for `@` (GoDaddy's parked page) and the default `CNAME` for `www`, then add:

| Type  | Name | Value               |
|-------|------|---------------------|
| A     | @    | 185.199.108.153     |
| A     | @    | 185.199.109.153     |
| A     | @    | 185.199.110.153     |
| A     | @    | 185.199.111.153     |
| CNAME | www  | velmarox.github.io  |

Optional IPv6 (`AAAA`, name `@`): `2606:50c0:8000::153`, `2606:50c0:8001::153`,
`2606:50c0:8002::153`, `2606:50c0:8003::153`.

If GoDaddy has **Domain Forwarding** switched on for velmarox.com, turn it off. It
overrides the records above.

DNS changes usually show up within an hour, though they can take up to 48.

### 3. (Recommended) Verify the domain with GitHub

GitHub **Settings (your profile) → Pages → Add a domain**. GitHub gives you a `TXT`
record to add in GoDaddy. Once it's verified, nobody else can attach velmarox.com to
their own GitHub Pages site.
