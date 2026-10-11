# velmarox.com

Personal projects hub. Static site, no build step, hosted on GitHub Pages at
**https://velmarox.com**.

## Layout

GitHub Pages publishes the `docs/` folder. Everything the website serves lives there;
README and CHANGELOG stay at the top and are not published.

```
docs/
  index.html        the one page: hero (click the name for confetti), ticker, projects, about
  404.html          shown for any missing URL
  css/site.css      styles: dark purple base, drifting colour blobs, sticker-style cards
  js/projects.js    THE PROJECT LIST: edit this to add, change or remove projects
  js/site.js        renders the cards and filter buttons, confetti, scroll-in animation
  assets/           favicon.svg and any images
  CNAME             tells GitHub Pages the custom domain (velmarox.com)
  .nojekyll         serves files as-is, no Jekyll processing
```

Animations switch off for visitors whose device is set to reduce motion.

## Adding a project

Open `docs/js/projects.js` and add an entry inside `window.PROJECTS = [ ... ]`:

```js
{ title: "My Game", blurb: "One or two sentences.", tags: ["game"], url: "https://...", status: "live" },
```

`status` is `live`, `wip` or `idea`. Leave out `url` for something not online yet.
Filter buttons appear on their own once the projects use more than one tag.

Commit and push to `main`. GitHub Pages republishes in about a minute.

## Versioning

Bump `<meta name="version">` in `docs/index.html` and add a `CHANGELOG.txt` entry with
every release (patch = fixes, minor = new content). Git history keeps the old versions.

## Keep the anonymous sites separate

Don't link VRX Games (`velmaroxie.web.app`, repo `pixel-den`) from this site. That site
is meant to stay anonymous, and a link from velmarox.com would break that.

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
