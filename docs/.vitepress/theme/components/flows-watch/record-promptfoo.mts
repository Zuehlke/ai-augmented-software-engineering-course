// Takes the screenshots that <FlowsWatch> shows in Lab 13, of promptfoo's web view: the real evals, as `task evals:view`
// shows them. Run the evals on lab/evals of Zuehlke/ai-augmented-software-engineering, start the view, and give it
// the eval id of each scene (in docs/, after npm install; it needs Google Chrome, or CHROME=<path>):
//
//   (cd <lab>/.harness && npx promptfoo view -n --port 15501)
//   node_modules/.bin/tsx .vitepress/theme/components/flows-watch/record-promptfoo.mts http://localhost:15501 \
//     lab13-skills=<eval id> lab13-too-broad=<eval id> lab13-fixed=<eval id>
//
// It writes <scene>-<n>-light.webp and -dark.webp per shot, and the shots' captions and where the parts are that a
// note can point at, into scenes.json, as record.mts does. Only localhost is reachable: the view's analytics aren't.
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer, { type Page } from 'puppeteer-core';

const [base, ...pairs] = process.argv.slice(2);
const evals = Object.fromEntries(pairs.map((pair) => pair.split('=')));
const outDir = path.dirname(fileURLToPath(import.meta.url));

// The same shape as the shots of flows watch, so <FlowsWatch> shows them alike, but smaller: promptfoo's text is
// denser, and would be hard to read at the width of the page
const VIEWPORT = { width: 1020, height: 585, deviceScaleFactor: 2 };
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

type Rect = [number, number, number, number]; // x, y, w, h in % of the screenshot

interface Shot {
  caption: string;
  do?: (page: Page) => Promise<void>; // what happens on the page before the screenshot
}

const settle = (ms = 500) => new Promise((r) => setTimeout(r, ms));

// The variables are in the description already: without them, the results fit next to it
async function onlyResults(page: Page) {
  await page.click('::-p-xpath(//button[starts-with(normalize-space(), "Columns (")])');
  await page.waitForSelector('[role="dialog"]', { visible: true });
  for (const [i, name] of ['skill', 'loads', 'prompt', 'sessionId'].entries()) await page.click(`::-p-text(Var ${i + 1}: ${name})`);
  await page.keyboard.press('Escape');
  await settle();
}
async function display(page: Page, filter: 'Failures' | 'Passes') {
  await page.click(`::-p-xpath(//button[normalize-space()="${filter}"])`);
  await settle(1000);
}
// The table's first rows right under its header, which stays at the top
async function scrollToRows(page: Page) {
  await page.evaluate(() => {
    const row = document.querySelector('tbody tr');
    const header = document.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    if (row) window.scrollTo(0, row.getBoundingClientRect().top + window.scrollY - header - 56);
  });
  await settle();
}

const scenes: Record<string, Shot[]> = {
  'lab13-skills': [{ caption: 'Every run of every case, with the share that passed and the two shares of right runs' }],
  'lab13-too-broad': [
    { caption: '"stays out when it shouldn\'t" drops: testing loads for the near misses too' },
    { caption: 'Failures shows the runs that loaded testing when they shouldn\'t have', do: async (page) => { await display(page, 'Failures'); await scrollToRows(page); } },
  ],
  'lab13-fixed': [{ caption: 'With a description that says what and when, every case passes again' }],
};

// The parts a note can point at: the share of passed runs, and the two shares of right runs
const ANCHORS: Record<string, string> = {
  passing: '//*[contains(normalize-space(), "% passing") and not(.//*[contains(normalize-space(), "% passing")])]',
  metrics: '//*[(starts-with(normalize-space(), "loads when it should") or starts-with(normalize-space(), "stays out when it shouldn")) and not(*[starts-with(normalize-space(), "loads when") or starts-with(normalize-space(), "stays out")])]',
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: VIEWPORT });
const index = existsSync(path.join(outDir, 'scenes.json')) ? JSON.parse(readFileSync(path.join(outDir, 'scenes.json'), 'utf8')) : {};
try {
  for (const [name, shots] of Object.entries(scenes)) {
    if (!evals[name]) continue;
    for (const f of readdirSync(outDir)) if (f.startsWith(`${name}-`) && f.endsWith('.webp')) rmSync(path.join(outDir, f));
    const out: { caption: string; anchors?: Record<string, Rect> }[] = [];
    for (const [i, shot] of shots.entries()) {
      let anchors: Record<string, Rect> | undefined;
      for (const theme of ['light', 'dark'] as const) {
        // A context of its own: the view keeps its column settings in localStorage
        const context = await browser.createBrowserContext();
        const page = await context.newPage();
        await page.setRequestInterception(true);
        page.on('request', (request) => (new URL(request.url()).hostname === 'localhost' ? request.continue() : request.abort()));
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
        await page.goto(`${base}/eval/${evals[name]}`, { waitUntil: 'networkidle0' });
        await page.waitForSelector('tbody tr');
        await onlyResults(page);
        await shot.do?.(page);
        await page.mouse.move(VIEWPORT.width - 2, VIEWPORT.height - 2); // no tooltip
        await settle();
        await page.screenshot({ path: path.join(outDir, `${name}-${i + 1}-${theme}.webp`), type: 'webp', quality: 88 });
        anchors = (await page.evaluate((sel: Record<string, string>, vw: number, vh: number) => {
          const r: Record<string, number[]> = {};
          for (const [k, xpath] of Object.entries(sel)) {
            const found = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            const bs = Array.from({ length: found.snapshotLength }, (_, n) => (found.snapshotItem(n) as Element).getBoundingClientRect()).filter((b) => b.width && b.bottom > 0 && b.top < vh);
            if (!bs.length) continue;
            const x = Math.min(...bs.map((b) => b.left)), y = Math.min(...bs.map((b) => b.top));
            const x2 = Math.min(vw, Math.max(...bs.map((b) => b.right))), y2 = Math.min(vh, Math.max(...bs.map((b) => b.bottom)));
            r[k] = [(x / vw) * 100, (y / vh) * 100, ((x2 - x) / vw) * 100, ((y2 - y) / vh) * 100];
          }
          return r;
        }, ANCHORS, VIEWPORT.width, VIEWPORT.height)) as Record<string, Rect>;
        await context.close();
      }
      out.push({ caption: shot.caption, ...(anchors && Object.keys(anchors).length ? { anchors } : {}) });
    }
    index[name] = out;
    console.log(name, out.length, 'shots');
  }
} finally {
  await browser.close();
}
const round = (_: string, v: unknown) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v);
writeFileSync(path.join(outDir, 'scenes.json'), JSON.stringify(Object.fromEntries(Object.entries(index).sort()), round, 1) + '\n');
