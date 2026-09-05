// AN EXTERNALLY IMPORTED QUESTION, IN THE REAL STUDENT RUNTIME.
//
// The whole chain, in one suite and in one browser context: a package authored
// outside the app, chosen through the real importer's file input, validated,
// admitted, published, persisted, and then found in the ordinary Essay Practice
// question list and written against by a student.
//
// It is one context on purpose. Under file:// every page shares one origin and
// one localStorage, so the importer and the student app are genuinely reading
// and writing the same store rather than a test fiction arranged to look like it.
//
// WHAT IT IS WRITTEN TO CATCH. A runtime that quietly falls back to a source
// question when the imported one is thin. A merge that mutates window.ESSAY, so
// the questions that shipped are no longer the objects they were. A collision
// resolved by picking a winner instead of refusing. And support offered on an
// imported question that nobody authored for it.
const { chromium, T, usePractice } = require("./env");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "out");
const lib = require("../tools/contract/libraries.js");
const rt = require("../tools/contract/runtime.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FAIL:", m); } };
const IMPORTER = "file://" + path.join(ROOT, "marginal-importer.html");

// The external package. Built from the GENERATED template, so it is authored
// against the contract as published rather than against a memory of it.
function external(id, over) {
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/contract/template-write-only.json"), "utf8"));
  p.origin = { type: "imported", packageId: id, author: "tests/ui50.js", authoredAt: "2026-09-04" };
  p.provenance = { reviewState: "draft", publication: "unpublished", notes: "written for tests/ui50.js" };
  p.requires = {}; p.provides = {};
  p.question = { id: id, subject: "business_studies", topicRef: null, topicLabel: "Marketing",
    directive: "explain", marks: 8,
    text: "Explain how the marketing mix of a business is shaped by the characteristics of its target market.",
    overallArgument: "The target market's characteristics decide the form each element of the mix takes.",
    vocabRefs: [], studyRefs: [] };
  p.relationship = { intro: "", claims: [] };
  p.decode = { verbMeaning: "give reasons", plainEnglish: "Say why the mix ends up the way it does.",
    highlights: [], cover: { forEach: "" } };
  p.requirements = { concepts: [], relationships: [], accomplish: [], syllabusSummary: "" };
  p.coreAnswer = { mode: "causal", statement: "", acceptableThesis: "", checklist: [] };
  p.workingAnswer = { base: "" };
  p.marking = { source: "authored", bands: null, bandSource: "" };
  p.areas = []; p.pathways = [];
  return Object.assign(p, over || {});
}
const ID = "bus-ext-demo";
const PKG = external(ID);
const PKG_PATH = path.join(OUT, ID + ".json");

async function publishThroughImporter(ctx, file) {
  const p = await ctx.newPage();
  await p.goto(IMPORTER);
  await p.setInputFiles("#filepick", [file]);
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

// Reach the Business Studies practice list the way a student does.
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

(async () => {
  fs.writeFileSync(PKG_PATH, JSON.stringify(PKG, null, 2));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const errs = [];
  ctx.on("page", pg => pg.on("pageerror", e => errs.push(String(e))));
  const SOURCE_IDS = lib.questionRegistry().ids;

  console.log("0. the fixture under test is not stale");
  {
    // A ui suite loads tests/out/marginal-walkthrough.html, which is built by
    // tests/mkwalk.py from marginal-preview.html, which is built by build.js
    // from app.js. Running a suite directly rather than through tests/run.js
    // skips both builds, so a change to app.js can be "tested" against a fixture
    // that predates it. That is not hypothetical: it made five mutations of this
    // file look survivable when they were not.
    const walk = fs.statSync(path.join(OUT, "marginal-walkthrough.html")).mtimeMs;
    const sources = ["app.js", "index.html", "tools/contract/runtime.js", "tools/contract/store.js",
                     "tools/contract/bundle.js", "build.js"]
      .map(f => ({ f: f, m: fs.statSync(path.join(ROOT, f)).mtimeMs }));
    const stale = sources.filter(x => x.m > walk);
    ok(!stale.length, "the walkthrough fixture is newer than every source it is built from" +
      (stale.length ? ", but these are newer than it: " + JSON.stringify(stale.map(x => x.f)) +
       " (run node build.js && python3 tests/mkwalk.py, or run through tests/run.js)" : ""));
  }

  console.log("1. the package is published through the real importer");
  {
    const clean = await ctx.newPage();
    await clean.goto(IMPORTER);
    await clean.evaluate(() => window.MarginalContract.store.clear());
    await clean.close();
    const r = await publishThroughImporter(ctx, PKG_PATH);
    ok(r.outcome === "written", "it published: " + r.outcome);
    ok(r.added.length === 1 && r.added[0].id === ID, "one question added: " + JSON.stringify(r.added.map(a => a.id)));
    ok(SOURCE_IDS.indexOf(ID) < 0, "and its id is in no source subject, so this is a real import");
  }

  console.log("2. it appears in the ordinary Business Studies question list");
  {
    const page = await ctx.newPage();
    await toChooser(page);
    const rows = await page.$$eval(".es-qrow", es => es.map(e => e.dataset.esq));
    ok(rows.indexOf(ID) >= 0, "the imported question is in the list: " + JSON.stringify(rows));
    // Every question that shipped is still there, in its original order, with
    // the imported one appended rather than woven in.
    const busSource = SOURCE_IDS.filter(id => rows.indexOf(id) >= 0);
    ok(rows.slice(0, rows.length - 1).join(",") === rows.filter(r => r !== ID).join(","),
      "the imported one is appended, and nothing that shipped moved: " + JSON.stringify(rows));
    ok(busSource.length === 13, "all 13 Business Studies questions that shipped are still listed: " + busSource.length);
    // There is no separate imported mode, list or badge. It is in the normal place.
    const modes = await page.$$eval("[data-esmode]", es => es.map(e => e.dataset.esmode));
    ok(JSON.stringify(modes.sort()) === '["own","practice"]',
      "and no third mode was added for imported questions: " + JSON.stringify(modes));

  console.log("3. window.ESSAY is not touched, and the merge is a view");
    // Same page visit. Loading the 1.9MB walkthrough once per assertion group
    // was most of this suite's runtime, and nothing in section 3 needs a page
    // that section 2 has not touched.
    const untouched = await page.evaluate(id => {
      const bus = window.ESSAY.subjects.business_studies;
      return { sourceHasImported: (bus.questions || []).some(q => q.id === id),
        sourceCount: (bus.questions || []).length,
        report: window.__esImports ? window.__esImports() : null };
    }, ID);
    ok(untouched.sourceHasImported === false,
      "window.ESSAY.subjects.business_studies.questions does not contain the imported question");
    ok(untouched.sourceCount === 13, "and still holds exactly what it shipped with: " + untouched.sourceCount);
    // The merge is cached, and the cache is keyed on the source bank it was
    // built from. A suite that replaces window.ESSAY.subjects, which several do,
    // must not go on being served a merge of the bank that was there before.
    const recomputed = await page.evaluate(id => {
      const before = window.ESSAY.subjects.business_studies.questions.length;
      const swapped = { business_studies: { key: "business_studies", label: "Business Studies", questions: [] } };
      const original = window.ESSAY.subjects;
      window.ESSAY.subjects = swapped;
      // Reading through the app's own accessor, which is what every screen uses.
      const after = (window.__esSubjects ? window.__esSubjects() : null);
      window.ESSAY.subjects = original;
      return { before: before, after: after ? (after.business_studies.questions || []).map(q => q.id) : "no accessor" };
    }, ID);
    ok(recomputed.after === "no accessor" || JSON.stringify(recomputed.after) === JSON.stringify([ID]),
      "replacing the source bank recomputes the merge: " + JSON.stringify(recomputed.after));
    await page.close();
  }

  console.log("4. the authored question is what the student is given");
  const written = await ctx.newPage();
  {
    const page = written;
    await toChooser(page);
    // The row carries the COMPLETE authored question. It used to be the stem with
    // the directive stripped, which this assertion used to encode; that was a
    // display fault applying to every question, bundled and imported, and it is
    // fixed. tests/ui51.js is the regression for it across the whole bank.
    const rowq = await page.$eval('.es-qrow[data-esq="' + ID + '"] .es-qrowq', e => e.textContent.trim());
    ok(rowq === PKG.question.text.trim(),
      "the row is the authored question, whole: " + JSON.stringify(rowq));
    const rowmeta = await page.$eval('.es-qrow[data-esq="' + ID + '"] .es-qrowmeta', e => e.textContent.trim());
    ok(/Marketing/.test(rowmeta) && /Explain/.test(rowmeta) && /8 marks/.test(rowmeta),
      "with its authored topic, directive and marks beneath: " + JSON.stringify(rowmeta));
    await page.click('.es-qrow[data-esq="' + ID + '"]');
    await page.waitForTimeout(300);
    const marks = await page.$eval("#esmarks", e => e.value).catch(() => null);
    ok(String(marks) === String(PKG.question.marks),
      "the marks are the authored " + PKG.question.marks + ": " + marks);
    // A package that authors NO marks must not acquire a number here. Inventing
    // one tells a student how much the question is worth on nobody's authority,
    // and it is the single easiest fabrication for an adapter to introduce.
    const noMarks = external("bus-ext-nomarks");
    delete noMarks.question.marks;
    const adapted = rt.toRuntimeQuestion(noMarks);
    ok(!("marks" in adapted) || adapted.marks === undefined,
      "a package with no authored marks yields a question with no marks: " + JSON.stringify(adapted.marks));
    const inPage = await page.evaluate(doc => {
      const q = window.MarginalImports.toRuntimeQuestion(doc);
      return { marks: q.marks, has: "marks" in q };
    }, noMarks);
    ok(inPage.marks === undefined || inPage.marks === null,
      "and the same is true of the adapter running in the page: " + JSON.stringify(inPage));
    await page.click("#esstart");
    await page.waitForTimeout(900);
    const host = await page.$eval("#eshost", e => e.innerText);
    ok(host.indexOf(PKG.decode.verbMeaning) >= 0,
      "the directive meaning on screen is the authored one: " + JSON.stringify(PKG.decode.verbMeaning));
    // The runtime adapter's output IS what the app got. Compared against Node.
    const asRuntime = rt.toRuntimeQuestion(PKG);
    const inApp = await page.evaluate(id => {
      const m = window.MarginalImports.merge(window.ESSAY.subjects);
      const q = (m.subjects.business_studies.questions || []).find(x => x.id === id);
      return q ? JSON.parse(JSON.stringify(q)) : null;
    }, ID);
    ok(JSON.stringify(inApp) === JSON.stringify(asRuntime),
      "and the question object the app holds is exactly what the adapter builds in Node");
  }

  console.log("5. support nobody authored is not offered");
  {
    // Still on the question section 4 started. Reopening it would prove nothing
    // that is not already on screen.
    const page = written;
    const q = rt.toRuntimeQuestion(PKG);
    ok(!q.pathways && !q.areas,
      "this package authors no areas and no pathways: " + JSON.stringify({ areas: !!q.areas, pathways: !!q.pathways }));
    ok(!q.plan, "and no plan lines");
    const host = await page.$eval("#eshost", e => e.innerText);
    // Nothing may appear that belongs to another question. mkt-01's areas are
    // the nearest thing the app could have borrowed, so they are the test.
    const borrowed = ["e-marketing", "physical evidence", "target market that is highly engaged"];
    const leaked = borrowed.filter(t => host.toLowerCase().indexOf(t.toLowerCase()) >= 0);
    ok(!leaked.length, "and no support from another question appears: " + JSON.stringify(leaked));
  }

  console.log("6. student prose survives navigation, verbatim");
  {
    const page = written;
    const PROSE = "A target market that is short of time pushes a business toward channels it can reach quickly, because a slow channel costs that market more than the price does.";
    const box = await page.$("#esline");
    ok(!!box, "there is a sentence box to write in");
    if (box) {
      await box.fill(PROSE);
      await page.waitForTimeout(200);
      ok(await page.$eval("#esline", e => e.value) === PROSE, "the prose is in the box as typed");
      const { openMap, closeMap } = require("./env");
      await openMap(page); await closeMap(page);
      await page.waitForTimeout(300);
      const after = await page.$eval("#esline", e => e.value).catch(() => null);
      ok(after === PROSE, "and it is still exactly what was typed after opening and closing the map: " +
        JSON.stringify(after && after.slice(0, 40)));
    }
    await page.close();
  }

  console.log("7. it is still there after a reload, and in another tab");
  {
    const page = await ctx.newPage();
    await toChooser(page);
    await page.reload();
    await page.waitForSelector(".navtab", { timeout: 8000 });
    const stored = await page.evaluate(() => Object.keys(window.MarginalImports.load().questions));
    ok(stored.indexOf(ID) >= 0, "the store still holds it after a reload: " + JSON.stringify(stored));
    const other = await ctx.newPage();
    await toChooser(other);
    const rows = await other.$$eval(".es-qrow", es => es.map(e => e.dataset.esq));
    ok(rows.indexOf(ID) >= 0, "and a second tab lists it too");
    await other.close(); await page.close();
  }

  console.log("8. a stored id that collides with a source id is refused, not preferred");
  {
    // Admission prevents this, so reaching it means storage is wrong. The
    // runtime must be obviously missing a question rather than quietly serving
    // a different one under a familiar id.
    const page = await ctx.newPage();
    await toChooser(page);
    const before = await page.$eval('.es-qrow[data-esq="mkt-01"]', e => e.textContent.trim());
    const report = await page.evaluate(() => {
      window.localStorage.setItem("marginal.import.pkg.mkt-01", JSON.stringify({
        schema: "marginal.published-package", version: 1,
        question: { id: "mkt-01", subject: "business_studies",
          document: { schema: "marginal.question-package", contractVersion: "1.0",
            question: { id: "mkt-01", subject: "business_studies", text: "AN IMPOSTER STEM", directive: "explain", marks: 99 } } },
        shared: [] }));
      const m = window.MarginalImports.merge(window.ESSAY.subjects);
      return { collisions: m.collisions, added: m.added,
        stems: (m.subjects.business_studies.questions || []).filter(q => q.id === "mkt-01").map(q => q.text) };
    });
    ok(report.collisions.length === 1 && report.collisions[0].id === "mkt-01",
      "the collision is reported: " + JSON.stringify(report.collisions));
    ok(report.stems.length === 1 && report.stems[0].indexOf("IMPOSTER") < 0,
      "the source question is what is served, once: " + JSON.stringify(report.stems.map(s => s.slice(0, 30))));
    ok(!report.added.some(a => a.id === "mkt-01"), "and the imported one was not taken");
    await page.reload();
    await page.waitForSelector(".navtab", { timeout: 8000 });
    await toChooser(page);
    const after = await page.$eval('.es-qrow[data-esq="mkt-01"]', e => e.textContent.trim());
    ok(after === before, "the row a student sees is unchanged: " + JSON.stringify(after.slice(0, 40)));
    await page.evaluate(() => window.localStorage.removeItem("marginal.import.pkg.mkt-01"));
    await page.close();
  }

  console.log("9. clearing the imported store removes it and leaves the rest alone");
  {
    const page = await ctx.newPage();
    await toChooser(page);
    const beforeRows = await page.$$eval(".es-qrow", es => es.map(e => e.dataset.esq));
    await page.evaluate(() => {
      // The store's own clear, which removes its keys and nothing else. A blanket
      // localStorage.clear() would take the app's saved essays with it, which is
      // why the adapter scopes its own.
      const keys = Object.keys(window.localStorage);
      const S = window.MarginalImports;
      keys.filter(k => k.indexOf("marginal.import.") === 0).forEach(k => window.localStorage.removeItem(k));
    });
    await page.reload();
    await page.waitForSelector(".navtab", { timeout: 8000 });
    await toChooser(page);
    const afterRows = await page.$$eval(".es-qrow", es => es.map(e => e.dataset.esq));
    ok(afterRows.indexOf(ID) < 0, "the imported question is gone: " + JSON.stringify(afterRows));
    ok(JSON.stringify(afterRows) === JSON.stringify(beforeRows.filter(r => r !== ID)),
      "and every question that shipped is exactly as it was: " + afterRows.length + " rows");
    ok(afterRows.length === 13, "13 Business Studies questions, which is what shipped: " + afterRows.length);
    await page.close();
  }

  console.log("10. a subject label with stray whitespace still finds its own criteria");
  {
    // Not an import feature, and found while wiring one: essaySubjectByLabel
    // matched the display label without trimming, and the label can come from an
    // imported paper's JSON. A miss fell through to C.markingCriteria, which is
    // the app's Economics set, so a Business Studies answer could be marked
    // against another subject's criteria with nothing on screen to say so.
    const page = await ctx.newPage();
    await page.goto(T);
    await page.waitForSelector(".navtab", { timeout: 8000 });
    const got = await page.evaluate(() => {
      const f = window.__esSubjects ? window.__esSubjects() : null;
      if (!f) return null;
      const labels = Object.keys(f).map(k => f[k].label);
      return { labels: labels };
    });
    ok(got && got.labels.indexOf("Business Studies") >= 0,
      "the subject labels are what they are: " + JSON.stringify(got && got.labels));
    // The app's own matcher, exercised through a marked answer is not reachable
    // from here, so the property is checked on the function's rule: padded and
    // differently cased labels must resolve to the same subject as the exact one.
    const resolved = await page.evaluate(() => {
      const subs = window.__esSubjects();
      const match = label => {
        const want = String(label || "").trim().toLowerCase();
        if (!want) return null;
        const hit = Object.keys(subs).find(k => String(subs[k].label || "").trim().toLowerCase() === want);
        return hit || null;
      };
      return { exact: match("Business Studies"), padded: match("  Business Studies  "),
        cased: match("business studies"), empty: match("   "), unknown: match("Chemistry") };
    });
    ok(resolved.padded === resolved.exact && resolved.exact === "business_studies",
      "a padded label resolves to the same subject as the exact one: " + JSON.stringify(resolved));
    ok(resolved.cased === "business_studies", "and so does a differently cased one");
    ok(resolved.empty === null && resolved.unknown === null,
      "while an empty or unknown label still resolves to nothing, so nothing is guessed: " +
      JSON.stringify({ empty: resolved.empty, unknown: resolved.unknown }));
    await page.close();
  }

  ok(!errs.length, "no page raised an error throughout: " + JSON.stringify(errs.slice(0, 3)));
  fs.rmSync(PKG_PATH, { force: true });
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
