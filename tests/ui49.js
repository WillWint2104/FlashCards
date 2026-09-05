// PUBLICATION, END TO END, IN THE REAL IMPORTER.
//
// Twelve things have to be true before an imported question can be trusted, and
// this suite is one section per thing. It drives the actual page: a real file
// chosen through a real file input, walked through five screens, published by
// pressing the button, and then read back after a reload.
//
// The two mistakes it is written to catch are the two that would not look like
// mistakes. A Publish that recomputes its own write set would agree with the
// preview today and diverge the first time the bank moved. And a store that
// wrote a question and its records as separate keys would work every time
// except the one that mattered.
const { chromium } = require("./env");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const lib = require("../tools/contract/libraries.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FAIL:", m); } };
const C = f => path.join(ROOT, "docs", "contract", f);
const OUT = path.join(ROOT, "tests", "out");
const PAGE = "file://" + path.join(ROOT, "marginal-importer.html");

// Walk the read only pipeline to Review, then to Publish.
async function toPublish(page, files) {
  await page.setInputFiles("#filepick", files);
  await page.waitForFunction(n => window.__importer.state().files.length === n, files.length);
  await page.click("#continue");
  for (let step = 1; step < 5; step++) {
    await page.waitForFunction(s => window.__importer.state().step === s, step);
    await page.click("#next");
  }
  await page.waitForFunction(() => window.__importer.state().step === 5);
}
const storeState = page => page.evaluate(() => {
  const s = window.MarginalContract.store.load();
  return { questions: Object.keys(s.questions).sort(), shared: s.shared, broken: s.broken,
    index: window.MarginalContract.store.index(),
    keys: Object.keys(window.localStorage).sort() };
});

(async () => {
  const browser = await chromium.launch();
  // ONE context. Playwright gives each browser.newPage() its own context and so
  // its own storage, which would make every "a second tab sees it" assertion
  // below pass or fail for a reason that has nothing to do with the importer.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const REG = lib.questionRegistry();

  // A genuinely external package: authored here, not generated from the bank,
  // with an id no question in Marginal holds. It also PROVIDES a shared record,
  // which no repository fixture does, because atomicity of a package and its
  // records cannot be shown by a package that provides none.
  // A GENUINELY EXTERNAL PACKAGE. Authored here rather than generated from the
  // bank, with an id no question in Marginal holds, and built from the generated
  // template so that "external" does not quietly mean "written against a
  // remembered idea of the format". It also PROVIDES two shared records, which
  // no repository fixture does, because the atomicity of a package and the
  // records it supplies cannot be shown by a package that supplies none.
  const TEMPLATE = JSON.parse(fs.readFileSync(C("template-write-only.json"), "utf8"));
  function external(id, withRecords) {
    const p = JSON.parse(JSON.stringify(TEMPLATE));
    p.origin = { type: "imported", packageId: id, author: "tests/ui49.js", authoredAt: "2026-09-04" };
    p.provenance = { reviewState: "draft", publication: "unpublished", notes: "written for tests/ui49.js" };
    p.requires = {};
    // Record ids are namespaced by the question that supplies them. Two packages
    // supplying the SAME record id is a different fault with a different code,
    // and it is not the one any of these sections is about.
    const v1 = "test.vocab." + id + ".one", v2 = "test.vocab." + id + ".two";
    p.provides = withRecords ? { vocabulary: {
      [v1]: { id: v1, term: "imported term one",
        subject: "a meaning supplied by an imported package",
        plain: "a simple meaning supplied by an imported package",
        example: "The imported package supplied this example." },
      [v2]: { id: v2, term: "imported term two",
        subject: "a second meaning supplied by an imported package",
        plain: "a second simple meaning supplied by an imported package",
        example: "The imported package supplied this second example." } } } : {};
    p.question = { id: id, subject: "business_studies", topicRef: null, topicLabel: "Imported",
      directive: "explain", text: "Explain how an imported question reaches a student.", marks: 8,
      overallArgument: "An imported question reaches a student through the same runtime as any other.",
      vocabRefs: [], studyRefs: [] };
    p.relationship = { intro: "", claims: [] };
    p.decode = { verbMeaning: "give reasons", plainEnglish: "Say how it works.", highlights: [], cover: { forEach: "" } };
    p.requirements = { concepts: [], relationships: [], accomplish: [], syllabusSummary: "" };
    p.coreAnswer = { mode: "causal", statement: "", acceptableThesis: "", checklist: [] };
    p.workingAnswer = { base: "" };
    p.marking = { source: "authored", bands: null, bandSource: "" };
    p.areas = []; p.pathways = [];
    return p;
  }
  const EXT = external("ext-atomic-01", true);
  const EXT_PATH = path.join(OUT, "ext-atomic-01.json");
  fs.writeFileSync(EXT_PATH, JSON.stringify(EXT, null, 2));

  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  await page.goto(PAGE);
  await page.evaluate(() => window.MarginalContract.store.clear());

  console.log("1. an external package with a new id passes every read only screen");
  {
    await toPublish(page, [EXT_PATH]);
    const st = await page.evaluate(() => {
      const s = window.__importer.state();
      return { verdict: s.reports[0].report.verdict, errors: s.reports[0].report.counts.error,
        adds: s.plan.questions.map(q => q.id), held: s.plan.held.length, empty: s.plan.empty };
    });
    ok(st.errors === 0, "it validates with no error: " + st.errors + " (" + st.verdict + ")");
    ok(JSON.stringify(st.adds) === '["ext-atomic-01"]', "and is the one addition: " + JSON.stringify(st.adds));
    ok(!REG.questions["ext-atomic-01"], "its id is in no bundled subject, so this is a real import");
    ok(st.empty === false && st.held === 0, "nothing is held");
    const label = await page.textContent("#publish");
    ok(label === "Publish 1 question", "the button names the real count: " + JSON.stringify(label));
  }

  console.log("2. Publish uses the reviewed plan and does not rebuild one");
  {
    // The plan object identity is the check. If Publish recomputed, the result
    // would be built from a different object even where the numbers matched.
    const same = await page.evaluate(() => {
      const s = window.__importer.state();
      const seen = [];
      const real = window.MarginalContract.apply;
      window.MarginalContract.apply = function (plan, dest, o) { seen.push(plan === s.plan); return real(plan, dest, o); };
      document.querySelector("#publish").click();
      window.MarginalContract.apply = real;
      return { seen: seen, result: window.__importer.state().result.outcome };
    });
    ok(JSON.stringify(same.seen) === "[true]",
      "apply was handed the very plan Review showed: " + JSON.stringify(same.seen));
    ok(same.result === "written", "and it wrote: " + same.result);
    await page.waitForFunction(() => window.__importer.state().step === 5 && window.__importer.state().result);
  }

  console.log("3. one adapter underneath, and the UI has no write of its own");
  {
    const src = fs.readFileSync(path.join(ROOT, "importer.js"), "utf8");
    ok(!/localStorage|sessionStorage|indexedDB|document\.cookie|fetch\s*\(|XMLHttpRequest/.test(src),
      "importer.js names no storage or network API at all");
    ok(!/\.setItem|\.removeItem/.test(src), "and calls no storage method");
    // Every key in storage was written by the adapter, under its own prefix.
    const st = await storeState(page);
    ok(st.keys.every(k => k.indexOf("marginal.import.") === 0),
      "every key in storage belongs to the adapter: " + JSON.stringify(st.keys));
    ok(st.keys.filter(k => /\.pkg\./.test(k)).length === 1,
      "one package, one key: " + JSON.stringify(st.keys));
  }

  console.log("4. the question survives a reload");
  {
    await page.reload();
    await page.waitForFunction(() => window.__importer);
    const st = await storeState(page);
    ok(st.questions.indexOf("ext-atomic-01") >= 0,
      "the imported question is still there after a reload: " + JSON.stringify(st.questions));
    ok(JSON.stringify(st.index.ids) === JSON.stringify(st.questions),
      "and the index agrees with what is stored: " + JSON.stringify(st.index.ids));
    ok(!st.broken.length, "with nothing unreadable: " + JSON.stringify(st.broken));
    // A fresh page object, not just a reload of this one.
    const p2 = await ctx.newPage();
    await p2.goto(PAGE);
    const seen = await p2.evaluate(() => Object.keys(window.MarginalContract.store.load().questions));
    ok(seen.indexOf("ext-atomic-01") >= 0, "and a new page sees it too: " + JSON.stringify(seen));
    await p2.close();
  }

  console.log("5. the whole authored document survives, forward fields included");
  {
    const stored = await page.evaluate(() =>
      window.MarginalContract.store.load().questions["ext-atomic-01"].document);
    ok(JSON.stringify(stored) === JSON.stringify(EXT),
      "the stored document is deep equal to the file as authored");
    // And a package written against a LATER contract, whose extra fields this
    // reader cannot interpret, which is the case a narrowing store would pass
    // every other test while failing.
    const AHEAD = JSON.parse(fs.readFileSync(C("ahead-minor-demo.json"), "utf8"));
    await page.evaluate(() => window.__importer.go(0));
    await toPublish(page, [C("ahead-minor-demo.json")]);
    await page.click("#publish");
    await page.waitForFunction(() => window.__importer.state().result);
    const back = await page.evaluate(() =>
      window.MarginalContract.store.load().questions["ah-religion-ahead"].document);
    ok(JSON.stringify(back) === JSON.stringify(AHEAD), "a contract 1.7 package is stored whole");
    const at = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
    const carried = ["accessibility", "marking.rubricRef", "marking.text", "question.readingAge",
                     "requirements.sourceSkills"];
    ok(carried.every(p => at(back, p) !== undefined),
      "including all five fields this reader does not interpret: " +
      JSON.stringify(carried.filter(p => at(back, p) === undefined)));
  }

  console.log("6. provided records are atomic with their package");
  {
    const st = await storeState(page);
    ok(st.shared.vocabulary && Object.keys(st.shared.vocabulary).length === 2,
      "the two records ext-atomic-01 provides are stored: " +
      JSON.stringify(Object.keys(st.shared.vocabulary || {})));
    ok(Object.values(st.shared.vocabulary).every(r => r.suppliedBy === "ext-atomic-01"),
      "each recorded against the package that supplied it: " +
      JSON.stringify(Object.keys(st.shared.vocabulary)));
    // The layout IS the rule: a package is one key, so there is no arrangement
    // that leaves the question stored and its records not.
    const unit = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("marginal.import.pkg.ext-atomic-01")));
    ok(unit.question.id === "ext-atomic-01" && unit.shared.length === 2,
      "and the question and both records are in one stored object: " + JSON.stringify(unit.shared));
  }

  console.log("7. nothing that already existed changed");
  {
    const st = await storeState(page);
    const bundled = Object.keys(REG.questions);
    ok(bundled.every(id => st.questions.indexOf(id) < 0),
      "no question that shipped with the app was written into the store: " +
      JSON.stringify(bundled.filter(id => st.questions.indexOf(id) >= 0)));
    ok(lib.questionRegistry().ids.length === 19, "and the bundled bank is still 19 on disk");
    // Publishing a package whose id is now taken by an earlier import.
    await page.evaluate(() => window.__importer.go(0));
    await page.evaluate(() => { window.__importer.state().files.length = 0; });
    const p3 = await ctx.newPage();
    await p3.goto(PAGE);
    await p3.setInputFiles("#filepick", [EXT_PATH]);
    await p3.waitForFunction(() => window.__importer.state().files.length === 1);
    await p3.click("#continue");
    await p3.waitForFunction(() => window.__importer.state().step === 1);
    for (let s2 = 1; s2 < 4; s2++) { await p3.click("#next"); await p3.waitForFunction(s => window.__importer.state().step === s + 1, s2); }
    const held = await p3.evaluate(() => {
      const p = window.__importer.state().plan;
      return { held: p.held.map(h => h.id), adds: p.questions.length, empty: p.empty };
    });
    ok(JSON.stringify(held.held) === '["ext-atomic-01"]',
      "re-importing it is held, because the earlier import is a collision too: " + JSON.stringify(held));
    ok(held.adds === 0 && held.empty, "and there is nothing to add");
    const before = await storeState(p3);
    const cont = await p3.$("#next");
    ok(await cont.isDisabled(), "Continue to Publish is off, because the plan is empty");
    // Reach the step anyway, to prove the step itself offers nothing either.
    await p3.evaluate(() => window.__importer.go(5));
    await p3.waitForFunction(() => window.__importer.state().step === 5);
    const btn = await p3.$("#publish");
    ok(btn !== null && await btn.isDisabled(), "and Publish itself is disabled for an empty plan");
    ok(JSON.stringify((await storeState(p3)).questions) === JSON.stringify(before.questions),
      "and the stored document was not touched");
    await p3.close();
  }

  console.log("8. a stale plan writes nothing and sends the teacher back to Review");
  {
    const p4 = await ctx.newPage();
    await p4.goto(PAGE);
    const EXT2 = external("ext-stale-01", false);
    const EXT2_PATH = path.join(OUT, "ext-stale-01.json");
    fs.writeFileSync(EXT2_PATH, JSON.stringify(EXT2, null, 2));
    await toPublish(p4, [EXT2_PATH]);
    // Something else lands between Review and Publish. Written through the
    // adapter, which is how it would really happen: another tab publishing.
    await p4.evaluate(() => window.MarginalContract.store.writeUnit({
      question: { id: "ext-arrived-since", subject: "business_studies", document: { note: "elsewhere" } },
      shared: [] }));
    const before = await storeState(p4);
    await p4.click("#publish");
    await p4.waitForFunction(() => window.__importer.state().result);
    const r = await p4.evaluate(() => window.__importer.state().result);
    ok(r.outcome === "destination changed", "the outcome names the destination: " + r.outcome);
    ok(r.added.length === 0 && r.failed.length === 0, "nothing written and nothing attempted");
    const body = await p4.textContent("#screen");
    ok(/The question bank changed since Review\. Nothing was written\. Review changes again before publishing\./.test(body),
      "the frozen sentence is on the screen");
    ok(!/fingerprint|checksum|registry/i.test(body), "and no machinery is named to the teacher");
    ok(/ext-arrived-since was added since/.test(body), "what arrived is named: " + /(\S+) was added since/.exec(body));
    const after = await storeState(p4);
    ok(JSON.stringify(after.questions) === JSON.stringify(before.questions),
      "the store is exactly as it was: " + JSON.stringify(after.questions));
    ok(after.questions.indexOf("ext-stale-01") < 0, "and the package in the plan did not land");
    const action = await p4.textContent("#again");
    ok(/Review changes again/.test(action), "the way on is back to Review: " + JSON.stringify(action));
    await p4.close();
  }

  console.log("9. an injected write failure leaves no half published package");
  {
    const p5 = await ctx.newPage();
    await p5.goto(PAGE);
    const EXT3 = external("ext-fail-01", true);
    const EXT3_PATH = path.join(OUT, "ext-fail-01.json");
    fs.writeFileSync(EXT3_PATH, JSON.stringify(EXT3, null, 2));
    await toPublish(p5, [EXT3_PATH]);
    const before = await storeState(p5);
    // The failure is injected into the ADAPTER, not into apply(), so what is
    // exercised is the real write path refusing rather than a simulation of it.
    const r = await p5.evaluate(() => {
      const s = window.__importer.state();
      const failing = window.MarginalContract.failingStore("ext-fail-01");
      const dest = failing.destination(window.MarginalImportData.questions);
      return window.MarginalContract.apply(s.plan, dest, {});
    });
    ok(r.outcome === "nothing was written", "the outcome says nothing was written: " + r.outcome);
    ok(r.added.length === 0 && r.failed.length === 1, "one failure, no additions");
    ok(/the store refused the write/.test(r.failed[0].reason),
      "and the reason is the store's: " + JSON.stringify(r.failed[0].reason));
    const after = await storeState(p5);
    ok(JSON.stringify(after.questions) === JSON.stringify(before.questions),
      "no question was stored: " + JSON.stringify(after.questions));
    ok(!after.keys.some(k => /ext-fail-01/.test(k)), "not even a key for it: " + JSON.stringify(after.keys));
    const orphan = Object.keys(after.shared.vocabulary || {}).filter(k => /ext-fail-01/.test(k));
    ok(!orphan.length,
      "and neither record it would have supplied is present without it: " + JSON.stringify(orphan));
    await p5.close();
  }

  console.log("9b. the adapter refuses a duplicate on its own, under admission");
  {
    // Admission stops every route to this, so it is never reached in normal use.
    // That is exactly why it needs a test: a check nothing exercises is a check
    // nobody notices the removal of.
    const p9 = await ctx.newPage();
    await p9.goto(PAGE);
    const r = await p9.evaluate(() => {
      const st = window.MarginalContract.store;
      const unit = { question: { id: "ext-adapter-dup", subject: "business_studies",
        document: { first: true } }, shared: [] };
      const out = { first: null, second: null, after: null };
      out.first = st.writeUnit(unit).key;
      try { st.writeUnit({ question: { id: "ext-adapter-dup", subject: "business_studies",
        document: { second: true } }, shared: [] }); out.second = "accepted"; }
      catch (e) { out.second = e.message; }
      out.after = st.load().questions["ext-adapter-dup"].document;
      return out;
    });
    ok(/QUESTION_ID_ALREADY_EXISTS/.test(r.second),
      "a second write of the same id is refused by the adapter: " + JSON.stringify(r.second));
    ok(JSON.stringify(r.after) === '{"first":true}',
      "and the document already stored is untouched: " + JSON.stringify(r.after));
    await p9.close();
  }

  console.log("10. one failed package does not erase one that already published");
  {
    const p6 = await ctx.newPage();
    await p6.goto(PAGE);
    await p6.evaluate(() => window.MarginalContract.store.clear());
    const mk = id => external(id, false);
    const paths = ["ext-batch-a", "ext-batch-b", "ext-batch-c"].map(id => {
      const f = path.join(OUT, id + ".json"); fs.writeFileSync(f, JSON.stringify(mk(id), null, 2)); return f; });
    await toPublish(p6, paths);
    const r = await p6.evaluate(() => {
      const s = window.__importer.state();
      const failing = window.MarginalContract.failingStore("ext-batch-b");
      const dest = failing.destination(window.MarginalImportData.questions);
      return window.MarginalContract.apply(s.plan, dest, {});
    });
    ok(r.outcome === "partially written", "the outcome is partial: " + r.outcome);
    ok(JSON.stringify(r.added.map(a => a.id)) === '["ext-batch-a","ext-batch-c"]',
      "a published before the failure and c after: " + JSON.stringify(r.added.map(a => a.id)));
    ok(JSON.stringify(r.failed.map(f => f.id)) === '["ext-batch-b"]', "only b failed");
    const st = await storeState(p6);
    ok(st.questions.indexOf("ext-batch-a") >= 0,
      "a is STILL STORED after b failed: " + JSON.stringify(st.questions));
    ok(st.questions.indexOf("ext-batch-c") >= 0, "and c was still attempted and stored");
    ok(st.questions.indexOf("ext-batch-b") < 0, "b is absent");
    ok(/a package writes completely or not at all/i.test(r.atomicUnitSays) &&
       /batch is not atomic/i.test(r.atomicUnitSays),
      "and the result states which unit is atomic: " + JSON.stringify(r.atomicUnitSays));
    await p6.close();
  }

  console.log("11. retry is a fresh review, never a replay");
  {
    const p7 = await ctx.newPage();
    await p7.goto(PAGE);
    await p7.evaluate(() => window.MarginalContract.store.clear());
    const f = path.join(OUT, "ext-retry-01.json");
    const o = external("ext-retry-01", false);
    fs.writeFileSync(f, JSON.stringify(o, null, 2));
    await toPublish(p7, [f]);
    // Publish once, successfully.
    await p7.click("#publish");
    await p7.waitForFunction(() => window.__importer.state().result);
    const first = await p7.evaluate(() => window.__importer.state().result);
    ok(first.outcome === "written", "the first attempt wrote: " + first.outcome);
    const planBefore = await p7.evaluate(() => window.__importer.state().plan.checkedAgainst.registry);
    // Retry. The same file, the same page, and the answer must CHANGE, because
    // the id is now taken by the attempt that succeeded.
    await p7.click("#again");
    await p7.waitForFunction(() => window.__importer.state().step === 4);
    const after = await p7.evaluate(() => {
      const s = window.__importer.state();
      return { held: s.plan.held.map(h => h.id), adds: s.plan.questions.length, empty: s.plan.empty,
        fingerprint: s.plan.checkedAgainst.registry, result: s.result };
    });
    ok(after.result === null, "the old result is dropped rather than shown again");
    ok(after.fingerprint !== planBefore,
      "the new plan is against a different bank: " + planBefore + " then " + after.fingerprint);
    ok(JSON.stringify(after.held) === '["ext-retry-01"]',
      "and it now says the id is taken, which a replay could never discover: " + JSON.stringify(after.held));
    ok(after.adds === 0 && after.empty, "so there is nothing to publish");
    const st = await storeState(p7);
    ok(st.questions.filter(i => i === "ext-retry-01").length === 1,
      "and the question was stored exactly once: " + JSON.stringify(st.questions));
    await p7.close();
  }

  console.log("12. Publish disables the moment it is pressed");
  {
    const p8 = await ctx.newPage();
    await p8.goto(PAGE);
    await p8.evaluate(() => window.MarginalContract.store.clear());
    const f = path.join(OUT, "ext-double-01.json");
    const o = external("ext-double-01", false);
    fs.writeFileSync(f, JSON.stringify(o, null, 2));
    await toPublish(p8, [f]);
    // Three clicks dispatched without yielding to the event loop between them,
    // which is what a double click actually is.
    const seen = await p8.evaluate(() => {
      const attempts = [], thrown = [];
      const real = window.MarginalContract.apply;
      window.MarginalContract.apply = function (p, d, o) { const r = real(p, d, o); attempts.push(r.operation); return r; };
      const b = document.querySelector("#publish");
      // Three presses with no yield between them, which is what a double click
      // is. Each is wrapped, so a press that THROWS is recorded as a throw and
      // not mistaken for a press that was correctly refused.
      for (let i = 0; i < 3; i++) { try { b.click(); } catch (e) { thrown.push(String(e)); } }
      window.MarginalContract.apply = real;
      return { attempts: attempts, thrown: thrown };
    });
    ok(seen.attempts.length === 1, "three presses produce one attempt: " + JSON.stringify(seen.attempts));
    ok(!seen.thrown.length,
      "and the presses that did nothing were REFUSED, not errors: " + JSON.stringify(seen.thrown));
    ok(/^op-\d+-/.test(seen.attempts[0]), "and it is identified: " + seen.attempts[0]);
    const st = await storeState(p8);
    ok(st.questions.filter(i => i === "ext-double-01").length === 1,
      "the question is stored once: " + JSON.stringify(st.questions));
    ok(st.keys.filter(k => /ext-double-01/.test(k)).length === 1,
      "under exactly one key: " + JSON.stringify(st.keys));
    await p8.close();
  }

  ok(!errs.length, "no page raised an error throughout: " + JSON.stringify(errs));
  ["ext-atomic-01", "ext-stale-01", "ext-fail-01", "ext-batch-a", "ext-batch-b", "ext-batch-c",
   "ext-retry-01", "ext-double-01"].forEach(id => fs.rmSync(path.join(OUT, id + ".json"), { force: true }));
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
