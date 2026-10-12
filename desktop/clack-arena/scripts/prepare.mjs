// Builds www/: the game and the bits of Clack Attack it borrows, laid out as on velmarox.com, plus the window shell.
// Google Fonts are downloaded into www/fonts/ so the app looks right with no internet (falls back quietly if offline).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SITE = path.resolve(ROOT, '..', '..', 'docs');
const WWW = path.join(ROOT, 'www');

fs.rmSync(WWW, { recursive: true, force: true });
const copy = (from, to = from) => fs.cpSync(path.join(SITE, from), path.join(WWW, to), { recursive: true });

copy('games/clack-arena/play');
for (const f of ['Vendor/Dice_Vendor.js', 'Scripts/Dice_Geometry.js', 'Sounds/Die_Hit.wav', 'Sounds/Dice_Clatter.wav'])
  copy('tools/clack-attack/play/Table/' + f);
copy('tools/clack-attack/play/Table/Trays');   // every tray: Customize lets you pick one
copy('assets/favicon.svg');
copy('assets/brand/vrx-badge.png'); copy('assets/brand/vrx-badge.webp');
fs.cpSync(path.join(ROOT, 'shell'), path.join(WWW, 'shell'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'build', 'icon.png'), path.join(WWW, 'shell', 'icon.png'));

// Fonts: fetch the stylesheet the game links, then every font file it names.
const page = path.join(WWW, 'games/clack-arena/play/index.html');
let html = fs.readFileSync(page, 'utf8');
const link = html.match(/<link href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)" rel="stylesheet">/);
html = html.replace(/<link rel="preconnect"[^>]*>\n?/g, '');
if (link) {
  try {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';   // asks for woff2
    let css = await (await fetch(link[1].replace(/&amp;/g, '&'), { headers: { 'user-agent': ua } })).text();
    fs.mkdirSync(path.join(WWW, 'fonts'), { recursive: true });
    let n = 0;
    for (const url of [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) || [])]) {
      const name = `f${n++}.woff2`;
      fs.writeFileSync(path.join(WWW, 'fonts', name), Buffer.from(await (await fetch(url)).arrayBuffer()));
      css = css.split(url).join('/fonts/' + name);
    }
    fs.writeFileSync(path.join(WWW, 'fonts', 'fonts.css'), css);
    html = html.replace(link[0], '<link href="/fonts/fonts.css" rel="stylesheet">');
    console.log(`fonts: ${n} files`);
  } catch (e) {
    html = html.replace(link[0], '');
    console.warn('fonts: offline, using system fonts', e.message);
  }
}
fs.writeFileSync(page, html);

const count = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? count(path.join(d, e.name)) : 1), 0);
console.log(`www: ${count(WWW)} files`);
