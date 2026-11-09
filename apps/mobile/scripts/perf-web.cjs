#!/usr/bin/env node
/**
 * Feed performance benchmark for the Expo *web* build.
 *
 * Builds the app twice (EXPO_PUBLIC_FEED_IMPL=baseline and =optimized), then
 * drives each build in headless Chromium with CPU throttling and reports:
 *   - time until the first note card is in the DOM (cold load)
 *   - frame times while scrolling a fresh feed that paginates as it goes
 *   - frame times over a fixed programmatic scroll with N notes already loaded
 *   - mounted cards / DOM nodes / JS heap with N notes loaded
 *   - latency from tapping "like" to the updated count being painted
 *
 * This measures React + layout work in a browser. It is NOT a device
 * measurement: native image caching, the native UI thread and Hermes are not
 * exercised. See docs/PERFORMANCE.md for measuring on a phone.
 *
 * Usage: node scripts/perf-web.cjs [--runs 5] [--throttle 4] [--notes 500] [--skip-build]
 * Needs: the API running on :8000 with >= --notes seeded notes, and Playwright
 * with Chromium available (npm i -D playwright && npx playwright install chromium).
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) : fallback;
};
const RUNS = arg('runs', 5);
const THROTTLE = arg('throttle', 4);
const NOTES = arg('notes', 500);
const SKIP_BUILD = process.argv.includes('--skip-build');
const SCROLL_SPEED = 3000; // px per second
const SCROLL_SECONDS = 6;
const PAGINATE_SECONDS = 15;
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist-perf');
const VARIANTS = ['baseline', 'optimized'];
const VIEWPORT = { width: 390, height: 844 };

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const percentile = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const round = (x, digits = 1) => Number(x.toFixed(digits));

function build(variant) {
  console.error(`building ${variant}…`);
  execSync(`npx expo export -p web --output-dir ${path.join('dist-perf', variant)}`, {
    cwd: ROOT,
    stdio: 'ignore',
    env: { ...process.env, EXPO_PUBLIC_FEED_IMPL: variant },
  });
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
};
function serve(dir) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(dir, url);
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(dir, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

/** One photo-sized JPEG served for every remote image, so the network is not part of the test. */
async function makeJpeg(browser) {
  const page = await browser.newPage({ viewport: { width: 600, height: 800 } });
  await page.setContent(
    '<body style="margin:0;height:100vh;background:conic-gradient(from 40deg,#d9c7b8,#b8c7d9,#c9d9b8,#e3c0c0,#d9c7b8)">',
  );
  const jpeg = await page.screenshot({ type: 'jpeg', quality: 80 });
  await page.close();
  return jpeg;
}

async function openPage(browser, url, jpeg, { throttle }) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.route(/picsum\.photos/, (route) =>
    route.fulfill({ status: 200, contentType: 'image/jpeg', body: jpeg }),
  );
  const cdp = await context.newCDPSession(page);
  const setThrottle = (rate) => cdp.send('Emulation.setCPUThrottlingRate', { rate });
  if (throttle) await setThrottle(THROTTLE);
  await page.addInitScript(() => {
    const seen = () => document.querySelector('[data-testid^="note-card-"]');
    const observer = new MutationObserver(() => {
      if (seen()) {
        window.__firstCardAt = performance.now();
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  const loaded = new Set();
  let exhausted = false;
  page.on('response', async (response) => {
    if (!/\/notes\?/.test(response.url()) || response.request().method() !== 'GET') return;
    try {
      const body = await response.json();
      body.items.forEach((note) => loaded.add(note.id));
      if (!body.next_cursor) exhausted = true;
    } catch {
      /* navigation interrupted the response */
    }
  });
  await page.goto(url);
  await page.waitForSelector('[data-testid^="note-card-"]', { timeout: 120_000 });
  return {
    context,
    page,
    cdp,
    setThrottle,
    loadedCount: () => loaded.size,
    isExhausted: () => exhausted,
  };
}

// Runs in the page: the element that actually scrolls the feed.
const FIND_SCROLLER = `(() => {
  const card = document.querySelector('[data-testid^="note-card-"]');
  for (let el = card; el; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 50) return el;
  }
  return document.scrollingElement;
})()`;

async function timeToFirstCard(browser, url, jpeg) {
  const samples = [];
  for (let i = 0; i < RUNS; i++) {
    const { context, page } = await openPage(browser, url, jpeg, { throttle: true });
    samples.push(await page.evaluate(() => window.__firstCardAt));
    await context.close();
  }
  return samples;
}

/** Summarise a list of frame-to-frame times (ms). */
function frameStats(deltas) {
  const total = deltas.reduce((a, b) => a + b, 0);
  return {
    fps: (deltas.length / total) * 1000,
    p95: percentile(deltas, 95),
    worst: Math.max(...deltas),
    slowPct: (deltas.filter((d) => d > 1000 / 60 + 4).length / deltas.length) * 100,
    // Time spent in frames longer than 50 ms, the usual "user notices" bound.
    jankMs: deltas.filter((d) => d > 50).reduce((a, b) => a + b, 0),
  };
}

// Runs in the page. Scrolls at constant speed for `seconds`, one step per
// animation frame, and resolves with the time between consecutive frames.
const scrollAndRecord = (seconds) => `new Promise((resolve) => {
  const el = ${FIND_SCROLLER};
  el.scrollTop = 0;
  setTimeout(() => {
    const deltas = [];
    const start = performance.now();
    let last = start;
    const step = (now) => {
      deltas.push(now - last);
      last = now;
      const elapsed = now - start;
      // The browser clamps this at the current end of the list, so the
      // scroll simply waits there until the next page has been appended.
      el.scrollTop = (elapsed / 1000) * ${SCROLL_SPEED};
      if (elapsed < ${seconds * 1000}) requestAnimationFrame(step);
      else resolve(deltas.slice(1));
    };
    requestAnimationFrame(step);
  }, 500);
})`;

/** Fresh load, then scroll continuously while infinite scroll fetches pages. */
async function scrollWhilePaginating(browser, url, jpeg) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const session = await openPage(browser, url, jpeg, { throttle: true });
    await session.page.waitForTimeout(1000);
    const stats = frameStats(await session.page.evaluate(scrollAndRecord(PAGINATE_SECONDS)));
    runs.push({ ...stats, notes: session.loadedCount() });
    await session.context.close();
  }
  return {
    paginatingScrollFps: round(median(runs.map((r) => r.fps))),
    paginatingFrameP95Ms: round(median(runs.map((r) => r.p95))),
    paginatingWorstFrameMs: round(median(runs.map((r) => r.worst))),
    paginatingSlowFramesPct: round(median(runs.map((r) => r.slowPct))),
    paginatingJankMs: Math.round(median(runs.map((r) => r.jankMs))),
    paginatingNotesReached: median(runs.map((r) => r.notes)),
  };
}

async function loadedFeedMetrics(browser, url, jpeg) {
  const session = await openPage(browser, url, jpeg, { throttle: false });
  const { page, cdp } = session;

  // Infinite-scroll until NOTES notes are loaded (unthrottled, not measured).
  const deadline = Date.now() + 240_000;
  while (session.loadedCount() < NOTES && !session.isExhausted()) {
    if (Date.now() > deadline) throw new Error(`only loaded ${session.loadedCount()} notes`);
    await page.evaluate(
      `(() => { const el = ${FIND_SCROLLER}; el.scrollTop = el.scrollHeight; })()`,
    );
    await page.waitForTimeout(120);
  }
  await page.evaluate(`(() => { ${FIND_SCROLLER}.scrollTop = 0; })()`);
  await page.waitForTimeout(1500);

  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  const dom = await page.evaluate(() => ({
    nodes: document.querySelectorAll('*').length,
    cards: document.querySelectorAll('[data-testid^="note-card-"]').length,
  }));

  await session.setThrottle(THROTTLE);

  // Scroll through the already-loaded list.
  const scrollRuns = [];
  for (let i = 0; i < RUNS; i++) {
    scrollRuns.push(frameStats(await page.evaluate(scrollAndRecord(SCROLL_SECONDS))));
  }

  // Tap like on a visible card; time until the new count has been painted.
  await page.evaluate(`(() => { ${FIND_SCROLLER}.scrollTop = 0; })()`);
  await page.waitForTimeout(800);
  const likeSamples = [];
  for (let i = 0; i < RUNS * 2; i++) {
    likeSamples.push(
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            const buttons = [...document.querySelectorAll('[data-testid^="like-button-"]')];
            const button = buttons.find((b) => {
              const r = b.getBoundingClientRect();
              return r.top > 80 && r.bottom < innerHeight - 80;
            });
            const observer = new MutationObserver(() => {
              observer.disconnect();
              // Two rAFs: the second callback runs after the frame containing
              // the mutation has been produced.
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve(performance.now() - start)),
              );
            });
            observer.observe(button, {
              childList: true,
              subtree: true,
              characterData: true,
              attributes: true,
            });
            const start = performance.now();
            button.click();
          }),
      ),
    );
    await page.waitForTimeout(400);
  }

  const result = {
    notesLoaded: session.loadedCount(),
    mountedCards: dom.cards,
    domNodes: dom.nodes,
    jsHeapMB: round(usedSize / 1024 / 1024),
    scrollFps: round(median(scrollRuns.map((r) => r.fps))),
    scrollFrameP95Ms: round(median(scrollRuns.map((r) => r.p95))),
    scrollWorstFrameMs: round(median(scrollRuns.map((r) => r.worst))),
    scrollSlowFramesPct: round(median(scrollRuns.map((r) => r.slowPct))),
    likeToPaintMs: round(median(likeSamples)),
  };
  await session.context.close();
  return result;
}

(async () => {
  if (!SKIP_BUILD) VARIANTS.forEach(build);
  const browser = await chromium.launch();
  const jpeg = await makeJpeg(browser);
  const results = {
    environment: {
      measuredAt: new Date().toISOString(),
      target: 'Expo web export (react-native-web) in headless Chromium',
      chromium: browser.version(),
      viewport: `${VIEWPORT.width}x${VIEWPORT.height} @2x`,
      cpuThrottle: `${THROTTLE}x`,
      runsPerMetric: RUNS,
      scroll: `${SCROLL_SPEED}px/s, ${PAGINATE_SECONDS}s while paginating, ${SCROLL_SECONDS}s on the loaded list`,
      host: `${require('node:os').cpus().length} vCPU ${process.platform}`,
    },
  };
  for (const variant of VARIANTS) {
    const server = await serve(path.join(OUT, variant));
    const url = `http://localhost:${server.address().port}/`;
    console.error(`measuring ${variant}…`);
    const first = await timeToFirstCard(browser, url, jpeg);
    results[variant] = {
      firstCardMs: Math.round(median(first)),
      firstCardMinMs: Math.round(Math.min(...first)),
      firstCardMaxMs: Math.round(Math.max(...first)),
      ...(await scrollWhilePaginating(browser, url, jpeg)),
      ...(await loadedFeedMetrics(browser, url, jpeg)),
    };
    server.close();
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
