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

const chromium = {
  launch: (opts) => pw.chromium.launch(Object.assign({}, EXECUTABLE ? { executablePath: EXECUTABLE } : {}, opts || {})),
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
  if (b) { await b.click(); await page.waitForTimeout(220); }
}
// The section list is an overlay now, not a grid column, so one left open sits on
// top of whatever the next step wants to press. A menu closes before anything
// outside it is clicked, which is what a person does without thinking about it.
async function closeMap(page) {
  const shown = await page.$eval(".es-map", e => !e.hasAttribute("hidden")).catch(() => false);
  if (!shown) return;
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(220);
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
    const b = [...document.querySelectorAll('[data-esmode]')].find(x => x.dataset.esmode === 'own');
    if (b) b.click();
  });
  await page.waitForTimeout(260);
  const box = await page.$('#esq');
  if (!box) return false;
  await page.fill('#esq', q);
  await page.waitForTimeout(180);
  return true;
}


// Setup opens on the student's own question, because that is the normal case.
// The practice bank is the other route, so a suite that picks a premade question
// has to ask for it first, exactly as a student without a question of their own
// does. Safe to call when already there.
async function usePractice(page) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('[data-esmode]')].find(x => x.dataset.esmode === 'practice');
    if (b && !b.classList.contains('on')) b.click();
  });
  await page.waitForTimeout(300);
}

module.exports = { usePractice, ownQuestion, closeMap,
  nextSection, prevSection, planAll, openMap,
  chromium, ROOT, OUT, BASE: OUT,
  WALK, T: url(WALK),
  PLAIN, P: url(PLAIN),
  fileUrl: name => url(path.join(OUT, name)),
};
