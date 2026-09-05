// FOUR STUDENTS, ONE QUESTION NOBODY IN THIS REPOSITORY WROTE INTO THE APP.
//
// The end-to-end proof for the importer, stated as a chain and tested as one:
//
//   external JSON -> import -> persistence -> question picker -> preview
//                 -> workspace -> a completed response
//
// Everything before this suite tested a link. tests/ui50.js publishes a small
// package and finds it in the list; the bots walk four simulated students
// through questions that SHIPPED with the app. Neither answers the question this
// one exists for: can a question authored entirely outside Marginal carry a
// student who knows nothing through to a finished response, on nothing but the
// support its own author wrote?
//
// The package is tests/fixtures/external-ops-package.json, built by the script
// beside it from docs/contract/template-causal.json. It authors its own
// vocabulary, its own concepts and its own lessons, and it references nothing
// that was written for another question. It authors no evidence, because an
// evidence record needs a source somebody checked and inventing one would be
// fabricating a citation, so evidence-complete is not reached and the students
// have to finish without it.
//
// TWO THINGS THIS IS WATCHING FOR, either of which would make the whole chain a
// fiction. A source question edited to make the imported one work. And support
// shown to a student that the imported question does not carry, borrowed from a
// question that happens to have more.
const { chromium, T, OUT, usePractice, allRows, pageTo } = require("./env");
const { runJourney } = require("./bots/journey");
const { ZERO, STRONG, WRONG, PARTIAL } = require("./bots/profiles");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const lib = require("../tools/contract/libraries.js");
const rt = require("../tools/contract/runtime.js");
const { validate } = require("../tools/contract/validate.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FAIL:", m); } };
const IMPORTER = "file://" + path.join(ROOT, "marginal-importer.html");
const PKG_PATH = path.join(ROOT, "tests/fixtures/external-ops-package.json");
const PKG = JSON.parse(fs.readFileSync(PKG_PATH, "utf8"));
const ID = PKG.question.id;
const MAN = lib.manifest();
const TOPICS = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/contract/topic-index.json"), "utf8")).topics;

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
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
  const errs = [];
  ctx.on("page", pg => pg.on("pageerror", e => errs.push(String(e).slice(0, 220))));
  const SOURCE_IDS = lib.questionRegistry().ids;

  console.log("0. the fixture under test is not stale");
  {
    const walk = fs.statSync(path.join(OUT, "marginal-walkthrough.html")).mtimeMs;
    const sources = ["app.js", "index.html", "tools/contract/runtime.js", "tools/contract/store.js",
                     "tools/contract/bundle.js", "tools/contract/capabilities.js", "build.js"]
      .map(f => ({ f: f, m: fs.statSync(path.join(ROOT, f)).mtimeMs }));
    const stale = sources.filter(x => x.m > walk);
    ok(!stale.length, "the walkthrough fixture is newer than every source it is built from" +
      (stale.length ? ", but these are newer: " + JSON.stringify(stale.map(x => x.f)) : ""));
  }

  console.log("1. the package is external, and honest about what it is not");
  {
    ok(SOURCE_IDS.indexOf(ID) < 0, "its id is in no source subject: " + ID);
    const r = validate(PKG, MAN, {});
    ok(r.verdict === "accepted" && r.counts.error === 0,
      "it validates against the published contract: " + r.verdict + " " + JSON.stringify(r.counts));
    const dims = r.capability.dimensions;
    ["importable", "writing-ready", "pathway-guided", "learning-complete", "assessment-complete"]
      .forEach(k => ok(dims[k].status === "reached", "it reaches " + k + ": " + dims[k].status));
    // The state the whole design depends on being able to report honestly. This
    // package authors no evidence because it has no source it could cite, and
    // saying so is the point rather than a gap to be closed later.
    ok(dims["evidence-complete"].status === "not-reached",
      "and does not claim evidence-complete: " + dims["evidence-complete"].status);
    // Nothing it references was written for another question.
    const own = new Set(Object.keys(PKG.provides.lessons || {}).concat(Object.keys(PKG.provides.concepts || {})));
    const borrowed = (PKG.pathways || []).flatMap(p => [p.learningRef, p.conceptRef])
      .filter(Boolean).filter(x => !own.has(x));
    ok(!borrowed.length, "every lesson and concept it names is its own: " + JSON.stringify(borrowed));
  }

  console.log("2. it publishes through the real importer, and persists");
  {
    const clean = await ctx.newPage();
    await clean.goto(IMPORTER);
    await clean.evaluate(() => window.MarginalContract.store.clear());
    await clean.close();
    const r = await publishThroughImporter(ctx, PKG_PATH);
    ok(r.outcome === "written", "it published: " + r.outcome);
    ok(r.added.length === 1 && r.added[0].id === ID, "one question added: " + JSON.stringify(r.added.map(a => a.id)));
    const wantShared = Object.keys(PKG.provides.vocabulary).length +
      Object.keys(PKG.provides.concepts).length + Object.keys(PKG.provides.lessons).length;
    ok(wantShared === 11, "the package provides eleven shared records: " + wantShared);
    // The stored unit, read back through the same store the student app reads.
    // The atomic unit is the package TOGETHER with the records it provides, so
    // both are checked from one read.
    const back = await (async () => {
      const p = await ctx.newPage();
      await p.goto(IMPORTER);
      const d = await p.evaluate(i => {
        // The importer's own store, already bound to this origin's
        // localStorage. Building a second one here would be a test reading a
        // store of its own making rather than the one that was written to.
        const loaded = window.MarginalContract.store.load();
        const q = loaded.questions[i] || null;
        const shared = {};
        Object.keys(loaded.shared || {}).forEach(k =>
          shared[k] = Object.keys(loaded.shared[k]).filter(x => loaded.shared[k][x].suppliedBy === i));
        return { question: q, shared: shared, broken: loaded.broken };
      }, ID);
      await p.close();
      return d;
    })();
    ok(!!back.question, "the package is in the store afterwards");
    ok(!(back.broken || []).length, "and nothing in the store is unreadable: " + JSON.stringify(back.broken));
    ok(JSON.stringify(back.question.document) === JSON.stringify(PKG),
      "the stored document is the file that was uploaded, whole");
    const storedShared = Object.values(back.shared).reduce((n, a) => n + a.length, 0);
    ok(storedShared === wantShared,
      "and the records it provides landed with it: " + storedShared + " of " + wantShared);
  }

  console.log("3. the picker offers it, with the support IT carries");
  {
    const page = await ctx.newPage();
    await toChooser(page);
    const rows = await allRows(page);
    const row = rows.find(r => r.id === ID);
    ok(!!row, "the imported question is in the list: " + rows.length + " rows");
    ok(row && row.q === PKG.question.text.trim(), "as its whole authored wording: " + JSON.stringify(row && row.q));
    ok(row && /Operations/.test(row.meta) && /Explain/.test(row.meta) && /20 marks/.test(row.meta),
      "with its topic, directive and authored marks: " + JSON.stringify(row && row.meta));
    // Every source question is still offered. An import adds.
    const missing = SOURCE_IDS.filter(id => /^(ops|mkt|fin|hr)-/.test(id) && !rows.some(r => r.id === id));
    ok(!missing.length, "and every bundled Business Studies question is still there: " + JSON.stringify(missing));

    await pageTo(page, '.qp-row[data-esq="' + ID + '"]');
    await page.click('.qp-row[data-esq="' + ID + '"]');
    await page.waitForSelector(".qp-suprow", { timeout: 8000 });
    const sup = await page.$$eval(".qp-suprow", es => es.map(e => ({
      name: e.querySelector(".qp-supname").textContent.trim(),
      has: e.classList.contains("yes"),
    })));
    const state = Object.fromEntries(sup.map(s => [s.name, s.has]));
    ok(state["Marking guidance"] && state["Planning support"] && state["Pathway guidance"] &&
       state["Learning support"], "it offers the four kinds of support it authored: " + JSON.stringify(state));
    ok(state["Evidence support"] === false,
      "and does not offer the one it did not: " + state["Evidence support"]);

    console.log("4. the preview states what the package says, and nothing more");
    await page.click('[data-espick="preview"]');
    await page.waitForSelector(".qp-prevq", { timeout: 8000 });
    const prev = await page.evaluate(() => ({
      q: document.querySelector(".qp-prevq").textContent.trim(),
      facts: [...document.querySelectorAll(".qp-fact")].map(f =>
        f.querySelector("dt").textContent.trim() + ": " + f.querySelector("dd").textContent.trim()),
    }));
    ok(prev.q === PKG.question.text.trim(), "the preview is the authored question: " + JSON.stringify(prev.q.slice(0, 50)));
    ok(prev.facts.some(f => /^Marks: 20$/.test(f)), "with its authored marks: " + JSON.stringify(prev.facts));
    ok(prev.facts.some(f => /^Topic: Operations/.test(f)),
      "and the topic label from the syllabus record its ref names: " + JSON.stringify(prev.facts));
    await page.close();
  }

  console.log("5. four students write it, on its own support");
  const q = rt.toRuntimeQuestion(PKG, { topics: TOPICS });
  const subjectContent = (() => {
    const { E } = lib.build();
    return E.subjects.business_studies;
  })();
  const RUNS = [
    { prof: ZERO, bodies: 3 },
    { prof: PARTIAL, bodies: 3 },
    { prof: WRONG, bodies: 3 },
    { prof: STRONG, bodies: 2 },
  ];
  const by = {};
  const page = await ctx.newPage();
  const traces = [];
  for (const r of RUNS) {
    const res = await runJourney(page, {
      T, subject: "business_studies", qre: new RegExp("operations strategies affect the quality", "i"),
      q: q, subjectContent: subjectContent, prof: r.prof, bodies: r.bodies,
    });
    by[r.prof.name] = res;
    traces.push(res.trace.report());
    console.log(res.trace.report() + "\n");
  }
  fs.writeFileSync(path.join(OUT, "external-journeys.txt"), traces.join("\n\n") + "\n");

  console.log("6. every one of them finished, and the four journeys differ");
  // Never refused means every paragraph started was finished, in prose. It is
  // NOT trace.m.blocked, which counts something else: a student writing without
  // a concept it needed and the app could have explained. That number is above
  // zero on the questions that shipped too, so asserting zero here would be
  // asserting that an imported question is better resourced than a bundled one.
  RUNS.forEach(r => {
    const t = by[r.prof.name].trace;
    ok(t.m.paragraphs === r.bodies,
      r.prof.name + " finished every paragraph it started: " + t.m.paragraphs + " of " + r.bodies);
    ok(t.m.sentences >= r.bodies,
      r.prof.name + " wrote prose in all of them: " + t.m.sentences + " sentences");
    console.log("    " + r.prof.name + ": wrote without a concept it needed " + t.m.blocked + " time(s)" +
      (t.m.unexplained.length ? "; never explained: " + t.m.unexplained.join(", ") : ""));
  });
  const zero = by["zero knowledge"].trace.m, strong = by["strong independent"].trace.m;
  const wrong = by["plausible wrong turn"].trace.m, part = by["partial knowledge"].trace.m;
  // The four profiles differ only in what they know and what they will do about
  // it, so if their journeys look the same the harness is not modelling students
  // and nothing above this line means anything.
  ok(zero.surfacesOpened > strong.surfacesOpened,
    "the student who knew nothing opened more support than the one who knew it: " +
    zero.surfacesOpened + " against " + strong.surfacesOpened);
  ok(zero.lessonOpens > 0, "and read a lesson: " + zero.lessonOpens + " (" + zero.lessonWords + " words)");
  ok(strong.lessonOpens === 0, "while the strong student read none: " + strong.lessonOpens);
  ok(zero.termsAcquired > 0,
    "the zero-knowledge student learned something from this question's own words: " +
    zero.termsAcquired + " of " + zero.teachable);
  ok(wrong.helpRungs > 0 || wrong.prompts > 0,
    "the wrong turn was answered rather than blocked: " + wrong.helpRungs + " rungs, " + wrong.prompts + " prompts");
  ok(part.lessonOpens > 0 && part.surfacesOpened <= zero.surfacesOpened,
    "and the partial student took the middle road: " + part.lessonOpens + " lessons, " +
    part.surfacesOpened + " surfaces");

  console.log("7. nothing was borrowed, and nothing in the source bank moved");
  {
    const p = await ctx.newPage();
    await p.goto(T);
    await p.waitForTimeout(500);
    const source = await p.evaluate(() => {
      const s = (window.ESSAY && window.ESSAY.subjects) || {};
      return Object.keys(s).map(k => ({ k: k, ids: (s[k].questions || []).map(q => q.id) }));
    });
    const bus = (source.find(x => x.k === "business_studies") || {}).ids || [];
    ok(bus.indexOf(ID) < 0, "the imported question is not in window.ESSAY: " + (bus.indexOf(ID) < 0));
    const shipped = SOURCE_IDS.filter(id => /^(ops|mkt|fin|hr)-/.test(id));
    ok(shipped.every(id => bus.indexOf(id) >= 0) && bus.length === shipped.length,
      "and the source bank is exactly what it shipped as: " + bus.length + " of " + shipped.length);
    await p.close();

    // The support the students were actually shown. Every guidance line and
    // lesson step reachable on this question has to be a string this package
    // wrote. A line arriving from another question's content would mean the
    // runtime filled a gap from somewhere, which is the fault this whole slice
    // exists to rule out.
    const mine = new Set();
    (PKG.pathways || []).forEach(pw => Object.values(pw.guidance || {}).forEach(g => {
      if (g.direct) mine.add(g.direct.trim());
      (g.ladder || []).forEach(r => mine.add(String(r.text).trim()));
    }));
    (PKG.areas || []).forEach(a => Object.values(a.guidance || {}).forEach(g => {
      if (g.direct) mine.add(g.direct.trim());
    }));
    const runtime = rt.toRuntimeQuestion(PKG, { topics: TOPICS });
    const shown = [];
    (runtime.pathways || []).forEach(pw => {
      Object.values(pw.guides || {}).forEach(v => shown.push(String(v).trim()));
      // help.<slot> is an object of named rungs, not a list: hint and needs are
      // strings and the rest are { text }.
      Object.values(pw.help || {}).forEach(h => Object.values(h || {}).forEach(rung =>
        shown.push(String(rung && rung.text != null ? rung.text : rung).trim())));
    });
    ok(shown.length > 0, "the runtime question carries guidance at all: " + shown.length + " lines");
    const foreign = shown.filter(s => !mine.has(s));
    ok(!foreign.length, "and every line of it was written in this package: " +
      JSON.stringify(foreign.slice(0, 2)));
    // The four lessons in the shared library were written for mkt-01. None of
    // them may be reachable from this question.
    const shared = Object.keys((MAN.records || {}).lessons || {});
    const reached = (PKG.pathways || []).map(pw => pw.learningRef).filter(Boolean)
      .filter(r => shared.indexOf(r) >= 0);
    ok(!reached.length, "and no lesson written for another question is reachable: " + JSON.stringify(reached));
  }

  console.log("\npageerrors:", errs.length ? errs.join(" | ") : "none");
  ok(errs.length === 0, "no page errors across the whole chain");
  await browser.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
