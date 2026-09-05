// The external package, and the two steps every suite that uses it has to take
// first: publish it through the real importer, and reach the ordinary question
// list the way a student does. Two suites drive this package now, and a second
// copy of the publish walk would be two things that have to stay the same.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const { T, usePractice } = require("../env");

const PKG_PATH = path.join(ROOT, "tests/fixtures/external-ops-package.json");
const PKG = JSON.parse(fs.readFileSync(PKG_PATH, "utf8"));
const ID = PKG.question.id;
const IMPORTER = "file://" + path.join(ROOT, "marginal-importer.html");
const TOPICS = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/contract/topic-index.json"), "utf8")).topics;

// Through the real importer's own file input and its own five steps. Nothing
// here writes to the store directly: the claim being tested is that the path a
// teacher takes ends with a question a student can be given.
async function publishThroughImporter(ctx, file) {
  const p = await ctx.newPage();
  await p.goto(IMPORTER);
  await p.setInputFiles("#filepick", [file || PKG_PATH]);
  await p.waitForFunction(() => window.__importer.state().files.length === 1);
  await p.click("#continue");
  for (let s = 1; s < 5; s++) { await p.waitForFunction(x => window.__importer.state().step === x, s); await p.click("#next"); }
  await p.waitForFunction(() => window.__importer.state().step === 5);
  await p.click("#publish");
  await p.waitForFunction(() => window.__importer.state().result);
  const r = await p.evaluate(() => window.__importer.state().result);
  await p.close();
  return r;
}

// A store with nothing in it, so a suite is never reading another suite's import.
async function clearStore(ctx) {
  const p = await ctx.newPage();
  await p.goto(IMPORTER);
  await p.evaluate(() => window.MarginalContract.store.clear());
  await p.close();
}

async function toChooser(page) {
  await page.goto(T);
  await page.waitForSelector(".navtab", { timeout: 8000 });
  for (const t of await page.$$(".navtab")) {
    if (/essay/i.test((await t.textContent()) || "")) { await t.click(); break; }
  }
  await page.waitForSelector("#essubject", { timeout: 8000 });
  await page.selectOption("#essubject", "business_studies");
  await page.waitForTimeout(300);
  await usePractice(page);
}

// The fixture a ui suite loads is built from app.js by two build steps that
// running a suite directly skips, so a change can be "tested" against a file
// that predates it. Checked, never assumed.
function stale(OUT) {
  const walk = fs.statSync(path.join(OUT, "marginal-walkthrough.html")).mtimeMs;
  return ["app.js", "index.html", "tools/contract/runtime.js", "tools/contract/store.js",
          "tools/contract/bundle.js", "tools/contract/capabilities.js", "build.js"]
    .filter(f => fs.statSync(path.join(ROOT, f)).mtimeMs > walk);
}

module.exports = { ROOT, PKG, PKG_PATH, ID, IMPORTER, TOPICS,
                   publishThroughImporter, clearStore, toChooser, stale };
