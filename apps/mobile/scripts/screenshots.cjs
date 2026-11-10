#!/usr/bin/env node
/**
 * Captures the README screenshots and demo GIF from the Expo web build.
 *
 * Usage: npx expo export -p web && node scripts/screenshots.cjs
 * Needs: API on :8000 (seeded), Playwright + Chromium, ffmpeg for the GIF.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.resolve(ROOT, '..', '..', 'docs', 'screenshots');
const VIEWPORT = { width: 390, height: 844 };
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function serve() {
  const server = http.createServer((req, res) => {
    let file = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(DIST, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

const card = '[data-testid^="note-card-"]';
const id = (testID) => `[data-testid="${testID}"]`;

async function open(browser, url, options = {}) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    ...options,
  });
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForSelector(card);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  return { context, page };
}

const shot = (page, name) =>
  page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 85 });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();

  // Light: feed, detail, composer, offline
  {
    const { context, page } = await open(browser, url, { colorScheme: 'light' });
    await shot(page, 'feed-light');

    await page
      .getByText(/카페 투어|citywalk|朝ごはん/)
      .first()
      .click();
    await page.waitForSelector(id('translate-button'));
    await page.locator(id('detail-like-button')).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
    await shot(page, 'detail');
    await page.locator(id('detail-like-button')).click();
    await page.locator('[aria-label*="back" i]').first().click();

    await page.locator(id('compose-button')).click();
    await page.locator(id('composer-title')).fill('Slow morning in Lisbon');
    await page.locator(id('composer-body')).fill('Flat white, a window seat and nowhere to be.');
    await page.locator(id('composer-tags')).fill('coffee ');
    await page.locator(id('composer-tags')).fill('lisbon ');
    await page.waitForTimeout(400);
    await shot(page, 'composer');
    await page.locator('[aria-label*="back" i]').first().click();

    await context.setOffline(true);
    await page.waitForSelector(id('offline-banner'));
    const likes = page.locator('[data-testid^="like-button-"]');
    await likes.nth(0).click();
    await likes.nth(1).click();
    await page.waitForTimeout(500);
    await shot(page, 'offline');
    await context.setOffline(false);
    await page.waitForTimeout(1500);
    // Undo the two likes so the capture leaves the database unchanged.
    await likes.nth(0).click();
    await likes.nth(1).click();
    await page.waitForTimeout(800);
    await context.close();
  }

  // Dark + Chinese: feed and settings
  {
    const { context, page } = await open(browser, url, { colorScheme: 'dark' });
    await page.locator(id('tab-settings')).click();
    await page.locator(id('language-zh')).click();
    await page.waitForTimeout(400);
    await shot(page, 'settings-dark-zh');
    await page.locator(id('tab-feed')).click();
    await page.waitForTimeout(600);
    await shot(page, 'feed-dark-zh');
    await context.close();
  }

  // Demo GIF: scroll, open a note, like, go back
  {
    const videoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glimpse-video-'));
    const { context, page } = await open(browser, url, {
      colorScheme: 'light',
      deviceScaleFactor: 1,
      recordVideo: { dir: videoDir, size: VIEWPORT },
    });
    for (let i = 0; i < 4; i++) {
      await page.mouse.move(195, 500);
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(700);
    }
    await page.locator(card).nth(2).click();
    await page.waitForSelector(id('detail-like-button'));
    await page.waitForTimeout(900);
    await page.locator(id('detail-like-button')).click();
    await page.waitForTimeout(700);
    await page.locator(id('detail-save-button')).click();
    await page.waitForTimeout(900);
    await page.locator(id('detail-like-button')).click();
    await page.locator(id('detail-save-button')).click();
    await page.locator('[aria-label*="back" i]').first().click();
    await page.waitForTimeout(900);
    const video = page.video();
    await context.close();
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-ss',
      '1.5',
      '-i',
      await video.path(),
      '-vf',
      'fps=10,scale=300:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer',
      path.join(OUT, 'demo.gif'),
    ]);
    fs.rmSync(videoDir, { recursive: true, force: true });
  }

  await browser.close();
  server.close();
  console.log(fs.readdirSync(OUT).join('\n'));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
