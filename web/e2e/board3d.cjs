// Plays the browser build (build/web) in headless Chromium (WebGL 2 on
// SwiftShader) with the real Java game under CheerpJ and Strata's real grid
// relay, and checks the 3D board beside the console:
//
// - it starts in 3D and mirrors the board the game prints;
// - a click on a tile types that move into the console, which the game plays
//   (or refuses, for a taken space) exactly as if it were typed;
// - a move typed in the text field still plays, and the cell it names is lit;
// - a finished game shows its result on the board, and a click starts the next;
// - the "3D board" button hides it (text only) and shows it again mid-game;
// - on a phone (390 x 844, touch) taps play a game to a result;
// - ?view=2d never downloads the 3D board and the console plays alone;
// - without WebGL 2 the page stays text-only and says why;
// - nothing is logged as an error.
//
//   ./web/build.sh
//   npm install --no-save playwright && npx playwright install chromium
//   node web/e2e/board3d.cjs build/web <screenshot directory>
//
// Needs the network for CheerpJ's runtime (cjrtnc.leaningtech.com). Where the
// browser itself can't reach it (a sandbox), E2E_PROXY_CDN=1 fetches CheerpJ's
// files from Node instead and hands them to the page. CHROMIUM=<path> picks
// the browser binary. Exits 1 on any failed check.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const site = path.resolve(process.argv[2] || 'build/web');
const shots = path.resolve(process.argv[3] || 'e2e-shots');
fs.mkdirSync(shots, { recursive: true });
const executablePath = process.env.CHROMIUM || undefined;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.jar': 'application/java-archive' };
function serve() {
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.join(site, name);
    if (!file.startsWith(site) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    const body = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

let failures = 0;
function check(ok, what) {
  console.log((ok ? 'ok   ' : 'FAIL ') + what);
  if (!ok) failures++;
}

async function open(browser, url, device, init) {
  const context = await browser.newContext(device);
  if (process.env.E2E_PROXY_CDN) {
    await context.route('https://cjrtnc.leaningtech.com/**', async (route) => {
      try { await route.fulfill({ response: await route.fetch() }); } catch (e) { await route.abort(); }
    });
  }
  const page = await context.newPage();
  if (init) await page.addInitScript(init);
  const errors = [], wasm = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // through the sandbox's stand-in for the network, a CheerpJ file that fails to load is
    // the stand-in's doing, not the page's: said, not counted
    if (process.env.E2E_PROXY_CDN && /^Failed to load resource/.test(m.text()) &&
        String((m.location() || {}).url || '').startsWith('https://cjrtnc.leaningtech.com/')) {
      console.log('note ' + m.text() + ' (' + m.location().url + ')');
      return;
    }
    errors.push(m.text() + (m.location() && m.location().url ? ' (' + m.location().url + ')' : ''));
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => { if (r.url().endsWith('grid-relay-scene.wasm')) wasm.push(r.url()); });
  await page.goto(url);
  return { page, context, errors, wasm };
}

const PROMPT_END = 'like a1 or B2.\n';
const terminal = (page) => page.locator('#terminal').textContent();
const game = (page) => page.evaluate(() => window.TicTacToe3D.game());
const count = (cells, mark) => cells.filter((c) => c === mark).length;

async function ready(page, in3d) {
  await page.waitForFunction(() => !document.getElementById('move').disabled, null, { timeout: 120000 });
  await page.waitForFunction(() => document.getElementById('terminal').textContent.endsWith('like a1 or B2.\n'), null, { timeout: 180000 });
  if (in3d) await page.waitForFunction(() => window.TicTacToe3D.showing(), null, { timeout: 180000 });
  await page.waitForTimeout(600);
}

// Where cell i is on the page, by the scene's own camera.
async function cellPoint(page, i) {
  const box = await page.locator('#relay').boundingBox();
  const p = await page.evaluate(([i, w, h]) => {
    const S = window.TicTacToeScene;
    const c = S.cellCenter(i);
    return S.projectToScreen(S.fitCamera(w / h), [c[0], S.BED_TOP, c[1]], w, h);
  }, [i, box.width, box.height]);
  return [box.x + p[0], box.y + p[1]];
}

async function press(page, how, i) {
  const [x, y] = await cellPoint(page, i);
  if (how === 'tap') await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

// After a move: the game has answered (a new prompt, or a result).
async function answered(page, before) {
  await page.waitForFunction((n) => {
    const t = document.getElementById('terminal').textContent;
    return t.length > n && (t.endsWith('like a1 or B2.\n') || /(You won!|You lost!|It was a tie!)\n/.test(t.slice(n)));
  }, before, { timeout: 30000 });
  await page.waitForTimeout(300);
}

// Plays free cells on the board until the game ends.
async function playOut(page, how) {
  for (let moves = 0; moves < 9; moves++) {
    const g = await game(page);
    if (g.result) return g;
    const free = g.cells.findIndex((c) => !c);
    const before = (await terminal(page)).length;
    await press(page, how, free);
    await answered(page, before);
  }
  return game(page);
}

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({
    executablePath,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  try {
    {
      const t = await open(browser, base, { viewport: { width: 1100, height: 800 } });
      const { page } = t;
      await ready(page, true);
      check(true, 'desktop: starts in 3D beside the console');
      await page.screenshot({ path: path.join(shots, 'tic-tac-toe-java-3d-desktop-start.png') });
      let before = (await terminal(page)).length;
      await press(page, 'click', 4);
      await answered(page, before);
      let text = await terminal(page);
      let g = await game(page);
      check(text.slice(before).startsWith('b2\n'), 'desktop: a click on the middle tile types b2 into the console');
      check(g.cells[4] === 'X' && /\n2 \[.\] \[X\] \[.\]\n/.test(text.slice(before)), 'desktop: the game played X at b2, and the board mirrors it');
      check(count(g.cells, 'O') === 1, 'desktop: the computer answered, and its O is on the board');
      before = text.length;
      await press(page, 'click', 4);
      await answered(page, before);
      check((await terminal(page)).slice(before).includes('That space is taken! Choose another one.'),
        'desktop: a click on a taken tile is refused by the game, as typing it is');
      // typing still plays; the typed cell is lit while it is typed
      const free = (await game(page)).cells.findIndex((c) => !c);
      const move = await page.evaluate((i) => window.TicTacToeScene.moveFor(i).toUpperCase(), free);
      await page.locator('#move').fill(move);
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(shots, 'tic-tac-toe-java-3d-desktop-typed-highlight.png') });
      before = (await terminal(page)).length;
      await page.locator('#move').press('Enter');
      await answered(page, before);
      g = await game(page);
      check(g.cells[free] === 'X' || g.result, `desktop: typing ${move} still plays it, and the 3D board shows it`);
      g = await playOut(page, 'click');
      check(!!g.result, 'desktop: clicks play the game to a result (' + g.result + ')');
      await page.waitForFunction(() => window.TicTacToe3D.game().again, null, { timeout: 10000 });
      await page.mouse.move(5, 5);
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(shots, 'tic-tac-toe-java-3d-desktop-result.png') });
      before = (await terminal(page)).length;
      const box = await page.locator('#relay').boundingBox();
      await page.mouse.click(box.x + 10, box.y + box.height - 10);
      await page.waitForFunction((n) => document.getElementById('terminal').textContent.slice(n).endsWith('like a1 or B2.\n'), before, { timeout: 30000 });
      g = await game(page);
      check(!g.result && count(g.cells, 'X') === 0, 'desktop: a click after the result presses Enter for the next game');
      await page.getByRole('button', { name: '3D board' }).click();
      await page.waitForTimeout(300);
      check(await page.locator('#board3d').isHidden() && !(await page.evaluate(() => window.TicTacToe3D.showing())),
        'desktop: the 3D board button hides it (text only)');
      before = (await terminal(page)).length;
      await page.locator('#move').fill('a1');
      await page.locator('#move').press('Enter');
      await answered(page, before);
      check((await game(page)).cells[0] === 'X', 'desktop: text only, typing plays');
      await page.screenshot({ path: path.join(shots, 'tic-tac-toe-java-3d-desktop-text-only.png') });
      await page.getByRole('button', { name: '3D board' }).click();
      await page.waitForFunction(() => window.TicTacToe3D.showing(), null, { timeout: 30000 });
      await page.waitForTimeout(500);
      check(await page.locator('#board3d').isVisible(), 'desktop: 3D on again mid-game, showing the same board');
      await page.screenshot({ path: path.join(shots, 'tic-tac-toe-java-3d-desktop-back-in-3d.png') });
      check(t.errors.length === 0, 'desktop: no errors logged' + (t.errors.length ? ': ' + t.errors.join(' | ') : ''));
      await t.context.close();
    }
    {
      const t = await open(browser, base, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const { page } = t;
      await ready(page, true);
      await page.screenshot({ path: path.join(shots, 'tic-tac-toe-java-3d-phone-start.png') });
      const box = await page.locator('#relay').boundingBox();
      check(box.width <= 390 - 32 + 1 && box.x >= 15, 'phone: the board fits the screen with its gutter (' + Math.round(box.width) + ' px)');
      const g = await playOut(page, 'tap');
      check(!!g.result, 'phone: taps on tiles play a game to a result (' + g.result + ')');
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(shots, 'tic-tac-toe-java-3d-phone-result.png') });
      await page.screenshot({ path: path.join(shots, 'tic-tac-toe-java-3d-phone-result-full.png'), fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      check(!overflow, 'phone: no sideways scrolling');
      check(t.errors.length === 0, 'phone: no errors logged' + (t.errors.length ? ': ' + t.errors.join(' | ') : ''));
      await t.context.close();
    }
    {
      const t = await open(browser, base + '?view=2d', { viewport: { width: 1100, height: 800 } });
      const { page } = t;
      await ready(page, false);
      check(t.wasm.length === 0 && await page.locator('#board3d').isHidden(), '?view=2d: text only, and the 3D board not downloaded');
      const before = (await terminal(page)).length;
      await page.locator('#move').fill('b2');
      await page.locator('#move').press('Enter');
      await answered(page, before);
      check(/\n2 \[.\] \[X\] \[.\]\n/.test((await terminal(page)).slice(before)), '?view=2d: the console plays');
      await page.screenshot({ path: path.join(shots, 'tic-tac-toe-java-view-2d.png') });
      check(t.errors.length === 0, '?view=2d: no errors logged' + (t.errors.length ? ': ' + t.errors.join(' | ') : ''));
      await t.context.close();
    }
    {
      // a browser without WebGL 2
      const t = await open(browser, base, { viewport: { width: 1100, height: 800 } }, () => {
        const get = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
          return kind === 'webgl2' ? null : get.call(this, kind, ...rest);
        };
      });
      const { page } = t;
      await ready(page, false);
      await page.waitForFunction(() => window.TicTacToe3D.state().startsWith('failed:'), null, { timeout: 30000 });
      await page.waitForTimeout(300);
      const note = await page.locator('#view3d-note').textContent();
      check(await page.locator('#board3d').isHidden() && /^Text only: .+\(.+\)\.$/.test(note),
        'no WebGL 2: text only, with the reason (' + note + ')');
      check(await page.locator('#view3d').isDisabled(), 'no WebGL 2: the 3D board button is disabled');
      await page.screenshot({ path: path.join(shots, 'tic-tac-toe-java-no-webgl2.png') });
      await t.context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
