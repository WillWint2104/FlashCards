// Shared paths and the browser handle, so the suites run from a clone on any
// machine rather than from one container's scratch directory.
//
//   node tests/mkwalk.py-equivalent   -> tests/out/marginal-walkthrough.html
//   node tests/ui16.js               -> runs against it
//
// Playwright is taken from the project if it is installed there, and otherwise
// from the system install used by the hosted environment.
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "out") + path.sep;
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function loadPlaywright() {
  const tries = ["playwright", "@playwright/test", "/opt/node22/lib/node_modules/playwright"];
  for (const id of tries) { try { return require(id); } catch (e) { /* try the next */ } }
  throw new Error("Playwright not found. Run: npm i -D playwright");
}
const pw = loadPlaywright();

// The hosted environment pre-installs Chromium and asks that it not be re-fetched.
// It has to be a file (or a symlink to one): a stale directory left at that path
// exists, so existsSync alone would hand Playwright something it cannot launch.
const HOSTED_CHROME = "/opt/pw-browsers/chromium";
function isExecutableFile(f) {
  try { return fs.statSync(f).isFile() && (fs.accessSync(f, fs.constants.X_OK), true); }
  catch (e) { return false; }
}
const EXECUTABLE = isExecutableFile(HOSTED_CHROME) ? HOSTED_CHROME : undefined;

// Every page gets external requests blocked before it loads anything.
//
// The app under test is one self-contained file. It also asks for web fonts and
// a CDN, which no suite asserts anything about, and which in a sandbox do not
// fail fast: they hang until the proxy gives up. goto() waits for the load event,
// so every page load cost 12.7 SECONDS of waiting for resources that were never
// going to arrive. Blocked, the same load takes 0.14s and the app renders
// identically.
//
// Done here rather than in 39 suites, because every one of them takes its
// chromium from this module.
async function armPage(page) {
  await page.route(/^https?:\/\//, r => r.abort());
  return page;
}
function wrapContext(ctx) {
  // Playwright's default action timeout is 30 seconds. A suite that wraps an
  // action in .catch() to handle "this control may not be here" then pays that
  // full 30 seconds every time it is not, invisibly: ui17 spent 30 of its 34
  // seconds inside one, and reported nothing because the catch was doing its job.
  //
  // Nothing in this app takes 8 seconds. A page load is 0.15s. So a swallowed
  // failure now costs about a second instead of half a minute, and a real hang
  // still fails rather than passing slowly.
  ctx.setDefaultTimeout(8000);
  const orig = ctx.newPage.bind(ctx);
  ctx.newPage = async function () { return armPage(await orig()); };
  return ctx;
}
function wrapBrowser(b) {
  const origCtx = b.newContext.bind(b);
  b.newContext = async function (o) { return wrapContext(await origCtx(o)); };
  const origPage = b.newPage.bind(b);
  b.newPage = async function (o) { return armPage(await origPage(o)); };
  return b;
}
const chromium = {
  launch: async (opts) => wrapBrowser(await pw.chromium.launch(Object.assign({}, EXECUTABLE ? { executablePath: EXECUTABLE } : {}, opts || {}))),
};

const url = f => "file://" + f.split(path.sep).join("/");
const WALK = path.join(OUT, "marginal-walkthrough.html");
// The plain build: shipped defaults, no walkthrough seed, marking switch off.
// Suites that test those defaults must use PLAIN, not the walkthrough.
const PLAIN = path.join(OUT, "test.html");
// Move to the next section the way a student does: through the response map, or
// the completion card when the paragraph is finished.
// The response map is a popover now, not a standing column, so reaching another
// section takes the step a student takes: open it, then pick.
async function openMap(page) {
  const shown = await page.$eval(".es-map", e => !e.hasAttribute("hidden")).catch(() => false);
  if (shown) return;
  const b = await page.$("#esmappop");
  if (b) { await b.click(); await page.waitForFunction(() => { const m = document.querySelector(".es-map"); return m && !m.hasAttribute("hidden"); }, null, { timeout: 8000 }).catch(() => {}); }
}
// The section list is an overlay now, not a grid column, so one left open sits on
// top of whatever the next step wants to press. A menu closes before anything
// outside it is clicked, which is what a person does without thinking about it.
async function closeMap(page) {
  const shown = await page.$eval(".es-map", e => !e.hasAttribute("hidden")).catch(() => false);
  if (!shown) return;
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForFunction(() => { const m = document.querySelector(".es-map"); return !m || m.hasAttribute("hidden"); }, null, { timeout: 8000 }).catch(() => {});
}
async function nextSection(page) {
  await closeMap(page);
  const done = await page.$("#esdonenext");
  if (done) { await done.click(); await page.waitForTimeout(420); return; }
  await openMap(page);
  await page.$$eval(".es-mapitem", es => {
    const i = es.findIndex(e => /(^|\s)on(\s|$)/.test(e.className));
    const t = es[i + 1] || es[0]; t && t.click();
  });
  await page.waitForTimeout(420);
}
async function prevSection(page) {
  await closeMap(page);
  await openMap(page);
  await page.$$eval(".es-mapitem", es => {
    const i = es.findIndex(e => /(^|\s)on(\s|$)/.test(e.className));
    const t = es[Math.max(0, i - 1)]; t && t.click();
  });
  await page.waitForTimeout(420);
}

// Planning everything up front is now one route in, not the way the screen
// opens. Suites that exercise the full planner ask for it.
async function planAll(page) {
  const b = await page.$("#esplanall");
  if (b) { await b.click(); await page.waitForTimeout(400); }
}


// Setup now asks whether you are choosing a practice question or bringing your
// own, and the question box only exists in the second mode. A suite that types
// its own question has to say so first, which is also what a student does.
async function ownQuestion(page, q) {
  await page.evaluate(() => {
    const b = document.querySelector('[data-espick="own"]')
      || [...document.querySelectorAll('[data-esmode]')].find(x => x.dataset.esmode === 'own');
    if (b) b.click();
  });
  // The textarea lives on the own-question stage, which the click above opens.
  const box = await page.waitForSelector('#esq', { timeout: 8000 }).catch(() => null);
  if (!box) return false;
  await page.fill('#esq', q);
  // The value landing is what the caller depends on, and it is synchronous.
  await page.waitForFunction(v => { const e = document.querySelector('#esq'); return !!e && e.value === v; }, q, { timeout: 8000 }).catch(() => {});
  return true;
}


// Setup opens on the student's own question, because that is the normal case.
// The practice bank is the other route, so a suite that picks a premade question
// has to ask for it first, exactly as a student without a question of their own
// does. Safe to call when already there.
// Choosing a practice question is three stages now: a subject, then the list,
// then the question itself. This helper takes a suite to the LIST, which is what
// every caller meant by "use practice", and it is one helper so the flow changing
// again is one edit rather than a dozen.
async function usePractice(page) {
  await page.evaluate(() => {
    const b = document.querySelector('[data-espick="list"]')
      || [...document.querySelectorAll('[data-esmode]')].find(x => x.dataset.esmode === 'practice');
    if (b) b.click();
  });
  // The rows are the point of switching, so wait for them rather than for 300ms.
  await page.waitForSelector('.qp-row', { timeout: 8000 }).catch(() => {});
}

// Walk to the page holding a question. Each step re-queries, because pressing a
// page button re-renders the list and every handle taken before it is detached.
async function pageTo(page, sel) {
  const n = await page.$$eval('.qp-pagenums .qp-page', bs => bs.length).catch(() => 0);
  for (let i = 1; i <= Math.max(1, n); i++) {
    if (await page.$(sel)) return true;
    const b = await page.$('.qp-pagenums [data-espage="' + i + '"]');
    if (!b) break;
    await b.click();
    await page.waitForTimeout(140);
  }
  return !!(await page.$(sel));
}

// Every question in the CURRENT filter, across every page. The list paginates at
// ten, so a suite that reads .qp-row sees a page and not the result set, and
// "all 13 are listed" quietly became "10 are listed". This walks the pages and
// puts the reader back on the one it started on.
async function allRows(page) {
  const out = [];
  const pages = await page.$$eval('.qp-pagenums .qp-page', bs => Math.max(1, bs.length));
  const start = await page.$eval('.qp-page.on', e => Number(e.dataset.espage)).catch(() => 1);
  for (let n = 1; n <= pages; n++) {
    const btn = await page.$('.qp-pagenums [data-espage="' + n + '"]');
    if (btn) { await btn.click(); await page.waitForTimeout(140); }
    out.push(...await page.$$eval('.qp-row', es => es.map(e => ({
      id: e.dataset.esq,
      q: ((e.querySelector('.qp-q') || {}).textContent || '').trim(),
      meta: ((e.querySelector('.qp-meta') || {}).textContent || '').trim(),
      on: e.classList.contains('on') }))));
  }
  const back = await page.$('.qp-pagenums [data-espage="' + start + '"]');
  if (back) { await back.click(); await page.waitForTimeout(120); }
  return out;
}

// Match a question by its WORDING, not by the whole row. Rows carry the topic,
// the directive and the marks under the question now, so /operations/i against
// the row text matches every Operations question rather than the one whose
// wording says it. The question is .qp-rowq; everything else is about it.
async function chooseQuestion(page, re) {
  await usePractice(page);
  // The question may be on a later page, so walk to the one holding it first.
  const want = re instanceof RegExp ? re : new RegExp(String(re), 'i');
  const rows = await allRows(page);
  const target = rows.find(r => want.test(r.q));
  if (!target) return null;
  await pageTo(page, '.qp-row[data-esq="' + target.id + '"]');
  const hit0 = await page.evaluate(src => {
    const r = new RegExp(src, 'i');
    const rows = [...document.querySelectorAll('.qp-row')];
    const t = rows.find(x => r.test((x.querySelector('.qp-rowq') || x).textContent));
    if (!t) return null;
    t.click();
    return t.dataset.esq;
  }, re instanceof RegExp ? re.source : String(re));
  if (!hit0) return null;
  // Choosing a row SELECTS it and fills the rail; the preview is the next step.
  // A suite that wants the question open has to take it, which is also what a
  // student does.
  const prev = await page.waitForSelector('[data-espick="preview"]', { timeout: 8000 }).catch(() => null);
  if (prev) { await prev.click(); await page.waitForSelector('#esstart', { timeout: 8000 }).catch(() => {}); }
  return hit0;
}

// Choose a question and get past the preview into the writing surface. A row now
// opens the question rather than starting it, so a suite that wants to WRITE has
// to say so; one that wants to look at the preview calls usePractice and clicks
// the row itself.
async function pickQuestion(page, id) {
  await usePractice(page);
  const sel = id ? '.qp-row[data-esq="' + id + '"]' : '.qp-row';
  const row = await page.$(sel);
  if (!row) return false;
  await row.click();
  const prev = await page.waitForSelector('[data-espick="preview"]', { timeout: 8000 }).catch(() => null);
  if (prev) await prev.click();
  await page.waitForSelector('#esstart', { timeout: 8000 }).catch(() => {});
  const go = await page.$('#esstart');
  if (!go) return false;
  await go.click();
  await page.waitForTimeout(500);
  return true;
}

// The help ladder used to open from a generic control sitting under the guide.
// It opens from "I am stuck on this sentence" now, which is a menu of routes
// anchored to the sentence, and #esmorehelp is only the escalation once help is
// already showing. These two helpers are the ladder's route, so a suite asks the
// question it means to ask -- is help available here, and how deep does it go --
// without also encoding which control opens it.
// The job row is never disabled, because the sentence's instruction is on screen
// whether or not a longer explanation is authored. data-esjob is the app saying
// which of the two this row will do, so "is an authored ladder available here"
// stays answerable without opening anything.
async function ladderOffered(page) {
  if (await page.$('#esmorehelp')) return true;
  return !!(await page.$('[data-esstuck="job"][data-esjob="ladder"]:not([disabled])'));
}
// Opens the ladder and climbs it as far as it goes. Returns the number of rungs
// on screen at the top, which is 0 when no ladder is authored for this sentence.
async function climbLadder(page) {
  if (!(await page.$('#esmorehelp'))) {
    const b = await page.$('#esstuck');
    if (!b) return 0;
    await b.click();
    const row = await page.$('[data-esstuck="job"][data-esjob="ladder"]:not([disabled])');
    if (!row) { await page.keyboard.press('Escape').catch(() => {}); return 0; }
    await row.click();
    await page.waitForSelector('.es-rung', { timeout: 8000 }).catch(() => {});
  }
  for (let k = 0; k < 6; k++) {
    const btn = await page.$('#esmorehelp');
    if (!btn) break;
    await btn.click();
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
  return page.$$eval('.es-rung', es => es.length).catch(() => 0);
}

module.exports = { usePractice, ownQuestion, closeMap, ladderOffered, climbLadder,
  nextSection, prevSection, planAll, openMap,
  chromium, ROOT, OUT, BASE: OUT, pickQuestion, chooseQuestion, allRows, pageTo,
  WALK, T: url(WALK),
  PLAIN, P: url(PLAIN),
  fileUrl: name => url(path.join(OUT, name)),
};
