// Renders art/wallpapers/dual-brand-qr.html to art/wallpapers/out/dual-brand-qr-android.png (1440x3200, Android lock screen).
// Needs Playwright with Chromium (npm i -g playwright; set NODE_PATH to the global node_modules): node tools/build_wallpaper.mjs
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'art/wallpapers/dual-brand-qr.html');
const out = path.join(root, 'art/wallpapers/out/dual-brand-qr-android.png');

const browser = await chromium.launch();
// The page is laid out at 1290 CSS px wide; the scale factor brings it to 1440x3200.
const page = await browser.newPage({ viewport: { width: 1290, height: 2868 }, deviceScaleFactor: 1440 / 1290 });
await page.goto(pathToFileURL(src).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1290, height: 2867.5 } });
await browser.close();
console.log(out);
