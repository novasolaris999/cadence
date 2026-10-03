// Renders scripts/app-icon.svg to the PNG sizes the install manifest needs.
// Uses the Chromium that is preinstalled in Claude's build container (Playwright).
// Run from the repo root: node scripts/gen-pwa-icons.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire('/opt/node-tools/node_modules/');
const { chromium } = require('playwright');

const svg = readFileSync('scripts/app-icon.svg', 'utf8');
const targets = [
  // "any" icons get rounded corners baked in; "maskable" stays full-bleed for Android to shape.
  { file: 'public/icons/icon-192.png', size: 192, radius: 0.22 },
  { file: 'public/icons/icon-512.png', size: 512, radius: 0.22 },
  { file: 'public/icons/maskable-512.png', size: 512, radius: 0 },
  { file: 'public/icons/apple-touch-icon.png', size: 180, radius: 0 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">
       <div style="width:${t.size}px;height:${t.size}px;border-radius:${t.radius * t.size}px;overflow:hidden">
         ${svg.replace('<svg ', `<svg width="${t.size}" height="${t.size}" `)}
       </div></body></html>`,
  );
  await page.screenshot({ path: t.file, omitBackground: true });
  console.log('wrote', t.file);
}
await browser.close();
