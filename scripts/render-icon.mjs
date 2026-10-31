/**
 * Draws the home-screen icons in public/icons/ from design/app-icon.svg,
 * using the Chromium that Playwright drives.
 *
 *   node scripts/render-icon.mjs
 *
 * iOS caches home-screen icons hard: a new icon only reaches an iPad when the
 * app is removed from the home screen and added again from Safari.
 */

import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const svg = readFileSync(new URL('../design/app-icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage();

for (const size of [180, 192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({
    path: new URL(`../public/icons/icon-${size}.png`, import.meta.url).pathname,
  });
}

await browser.close();
console.log('Drew public/icons/icon-{180,192,512}.png');
