#!/usr/bin/env node
/**
 * Renders the app icon, Android adaptive icon layers, splash image and favicon
 * from one SVG glyph (a two-column masonry grid). Needs Playwright + Chromium.
 *
 * Usage: node scripts/generate-assets.cjs
 */
const path = require('node:path');
const { chromium } = require('playwright');

const ASSETS = path.resolve(__dirname, '..', 'assets');
const GRADIENT = 'linear-gradient(135deg,#FF8A5B 0%,#F0456A 55%,#C2338F 100%)';

/** Four rounded tiles in two uneven columns, drawn in a 100x100 box. */
const glyph = (fill) => `
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <g fill="${fill}">
      <rect x="14" y="14" width="33" height="44" rx="8"/>
      <rect x="14" y="64" width="33" height="22" rx="8"/>
      <rect x="53" y="14" width="33" height="24" rx="8"/>
      <rect x="53" y="44" width="33" height="42" rx="8"/>
    </g>
  </svg>`;

const page = (background, inner, scale) => `
  <body style="margin:0;width:100vw;height:100vh;display:grid;place-items:center;background:${background}">
    <div style="width:${scale}%;height:${scale}%">${inner}</div>
  </body>`;

const FILES = [
  { name: 'icon.png', size: 1024, html: page(GRADIENT, glyph('#fff'), 62) },
  // Adaptive icons are masked by the launcher; keep the glyph in the centre 2/3.
  {
    name: 'android-icon-foreground.png',
    size: 1024,
    html: page('transparent', glyph('#fff'), 44),
    transparent: true,
  },
  { name: 'android-icon-background.png', size: 1024, html: page(GRADIENT, '', 0) },
  {
    name: 'android-icon-monochrome.png',
    size: 1024,
    html: page('transparent', glyph('#fff'), 44),
    transparent: true,
  },
  {
    name: 'splash-icon.png',
    size: 512,
    html: page('transparent', glyph('#F0456A'), 80),
    transparent: true,
  },
  { name: 'favicon.png', size: 48, html: page(GRADIENT, glyph('#fff'), 64) },
];

(async () => {
  const browser = await chromium.launch();
  for (const file of FILES) {
    const tab = await browser.newPage({ viewport: { width: file.size, height: file.size } });
    await tab.setContent(file.html);
    await tab.screenshot({
      path: path.join(ASSETS, file.name),
      omitBackground: Boolean(file.transparent),
    });
    await tab.close();
    console.log(`wrote assets/${file.name}`);
  }
  await browser.close();
})();
