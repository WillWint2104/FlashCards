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
const { chromium, T, OUT, usePractice, allRows, pageTo, climbLadder } = require("./env");
const { runJourney } = require("./bots/journey");
const { PARTIAL } = require("./bots/profiles");
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

  let ladderPage = null;
  console.log("4b. an authored help ladder reaches the student, rung by rung");
  {
    // The fault this section exists for. The app discriminates the rungs above
    // "what this part has to do" by a type tag, and the runtime adapter emitted
    // none, so on an imported question the direction, the frame, the start and
    // the worked example were all withheld however carefully they were authored.
    // A simulated student climbed six times and was handed rung two every time.
    // Nothing said so: the package validated clean and the picker reported
    // pathway guidance as available, which it was, one rung deep.
    const authored = (PKG.pathways || []).map(pw => ({
      id: pw.id,
      rungs: ((pw.guidance.explain || {}).ladder || []).map(r => r.rung),
    }));
    ok(authored.every(a => a.rungs.length === 6),
      "every argument authors a full six-rung ladder: " +
      JSON.stringify(authored.map(a => a.rungs.length)));
    const runtimeQ = rt.toRuntimeQuestion(PKG, { topics: TOPICS });
    runtimeQ.pathways.forEach(pw => {
      const h = (pw.help || {}).explain || {};
      // The tags the app checks for. Without them the rung is dropped and the
      // student is told there is nothing further to show.
      ok((h.direction || {}).type === "reasoningDirection", pw.id + ": the direction is typed");
      ok((h.frame || {}).type === "scaffoldFrame", pw.id + ": the frame is typed");
      ok((h.starter || {}).type === "sentenceStarter", pw.id + ": the start is typed");
      ok((h.example || {}).type === "differentContextExample", pw.id + ": the example is typed");
      ok(String((h.example || {}).context || "").trim(),
        pw.id + ": and names the different context it is set in");
    });
    // And in the running app: five rungs, because a direction and a frame are
    // alternatives at rung three by design, not six.
    const page = await ctx.newPage();
    await toChooser(page);
    await pageTo(page, '.qp-row[data-esq="' + ID + '"]');
    await page.click('.qp-row[data-esq="' + ID + '"]');
    await page.click('[data-espick="preview"]');
    await page.waitForSelector("#esstart", { timeout: 8000 });
    await page.click("#esstart");
    await page.waitForTimeout(800);
    await page.$$eval(".es-startrow", es => { const t = es.filter(x => /Body/.test(x.textContent))[0]; t && t.click(); });
    await page.waitForTimeout(600);
    // Whichever argument this paragraph offers. The pathways are filtered by the
    // area the paragraph is about, so naming one here would be naming the plan.
    const chose = await page.$$eval("[data-espath]", es => { if (!es[0]) return null; es[0].click(); return es[0].dataset.espath; });
    ok(!!chose, "an argument is offered in the first body paragraph: " + chose);
    await page.waitForTimeout(600);
    const sw = await page.$("#esstartwriting");
    if (sw) { await sw.click(); await page.waitForTimeout(600); }
    // The ladder is authored on the explain slot, which is the second sentence,
    // so the first one is written and accepted to get there. That is the route a
    // student takes, and the rung the ladder was silently truncated at.
    await page.fill("#esline", "Checking quality at each stage affects the number of defects at McDonald's.").catch(() => {});
    const accept = await page.$("#esaccept, #esok, [data-esaccept]");
    if (accept) { await accept.click(); await page.waitForTimeout(600); }
    const deepest = await climbLadder(page);
    ok(deepest >= 5, "the ladder climbs past the second rung in the app: reached " + deepest);
    const labels = await page.$$eval(".es-runglbl", es => es.map(e => e.textContent.replace(/\s+/g, " ").trim()));
    ok(labels.some(l => /direction|structure to fill/i.test(l)),
      "the third rung is the authored direction or frame: " + JSON.stringify(labels));
    ok(labels.some(l => /start you finish/i.test(l)), "the fourth is the start: " + JSON.stringify(labels));
    ok(labels.some(l => /somewhere else/i.test(l)), "the fifth is the worked example: " + JSON.stringify(labels));
    // Left open on purpose: the next section asks a different question of this
    // same sentence, and reopening it would be eight seconds spent re-walking.
    await page.keyboard.press("Escape").catch(() => {});
    ladderPage = page;
  }

  console.log("4c. the response still needs evidence, and Marginal says it has none");
  {
    // Two facts, and the suite exists because they are easy to collapse into one.
    // "This paragraph needs a case study" is about the essay and is true whatever
    // Marginal holds. "Marginal has a case study for you" is about the content and
    // is false here: this package authors no evidence, because it has no source it
    // could cite. Removing the sentence job would delete something the response is
    // marked on; saying nothing would send a student hunting through an empty tool.
    // The same composer 4b left open. Walking back in from the question list to
    // ask a second question of the same sentence costs another eight seconds and
    // proves nothing the first walk did not.
    const page = ladderPage;
    // Walk the sentence jobs to the one that asks for evidence.
    let atEvidence = null;
    for (let i = 0; i < 6; i++) {
      const st = await page.evaluate(() => ({
        head: ((document.querySelector(".es-guideh") || {}).textContent || "").trim(),
        job: ((document.querySelector(".es-guidejob") || {}).textContent || "").trim(),
        gap: ((document.querySelector(".es-evgap") || {}).textContent || "").trim(),
      }));
      if (/example|evidence/i.test(st.head)) { atEvidence = st; break; }
      const next = await page.$("#esnextguide:not([disabled])");
      if (!next) break;
      await next.click(); await page.waitForTimeout(320);
    }
    ok(!!atEvidence, "the composer reaches a sentence that asks for evidence: " +
      JSON.stringify(atEvidence && atEvidence.head));
    if (atEvidence) {
      // FACT ONE. The job is still there. This is the assertion that fails if
      // anybody "fixes" the empty evidence bank by deleting the demand.
      ok(/example|evidence|case study/i.test(atEvidence.job),
        "the sentence still asks for a case study or example: " + JSON.stringify(atEvidence.job));
      // FACT TWO, and it is a different sentence in a different element, so one
      // cannot be mistaken for the other or quietly absorbed into the other.
      ok(/no evidence authored for this question/i.test(atEvidence.gap),
        "and says plainly that Marginal has none for this question: " + JSON.stringify(atEvidence.gap));
      ok(/your own course/i.test(atEvidence.gap),
        "handing the work back explicitly rather than leaving a gap: " + JSON.stringify(atEvidence.gap));
      ok(atEvidence.job.indexOf(atEvidence.gap) < 0,
        "the two are separate statements, not one sentence doing both jobs");
    }
    // And the Evidence tool itself does not pretend. It offers nothing, says so,
    // and repeats where the evidence has to come from instead.
    await page.click('[data-estool="evidence"]').catch(() => {});
    await page.waitForTimeout(500);
    const drawer = await page.evaluate(() => ({
      none: ((document.querySelector(".es-drawer-none") || {}).textContent || "").trim(),
      note: [...document.querySelectorAll(".es-drawer-note")].map(e => e.textContent.trim()).join(" "),
      rows: document.querySelectorAll(".es-evrow, .es-evitem").length,
    }));
    ok(drawer.rows === 0, "the Evidence tool offers no items: " + drawer.rows);
    ok(/no verified evidence/i.test(drawer.none), "it says so: " + JSON.stringify(drawer.none));
    ok(/still needs a case study or example/i.test(drawer.note),
      "and still names what the response needs: " + JSON.stringify(drawer.note));
    ok(/will not supply one/i.test(drawer.note),
      "without offering to supply it: " + JSON.stringify(drawer.note));
    await page.close(); ladderPage = null;

    // THE OTHER STATE, or the assertions above only prove the note is always
    // printed. The bundled evidence bank ships with no checked sources, which is
    // why it is withheld, so the suite supplies sources rather than weakening the
    // rule under test, and then the same sentence must carry the job and NOT the
    // note: Marginal does have evidence here.
    const p2 = await ctx.newPage();
    await p2.route(/workers\.dev/, r => r.abort());
    await p2.goto(T);
    await p2.waitForSelector(".navtab", { timeout: 8000 });
    await p2.evaluate(() => { Object.keys((window.BUSCONTENT || {}).evidence || {}).forEach(k =>
      window.BUSCONTENT.evidence[k].forEach(e => { e.source = "test fixture source"; e.checked = "2026-08-19"; })); });
    for (const t of await p2.$$(".navtab")) {
      if (/essay/i.test((await t.textContent()) || "")) { await t.click(); break; }
    }
    await p2.waitForSelector("#essubject", { timeout: 8000 });
    await p2.selectOption("#essubject", "business_studies");
    await p2.waitForTimeout(300);
    await usePractice(p2);
    await pageTo(p2, '.qp-row[data-esq="mkt-01"]');
    await p2.click('.qp-row[data-esq="mkt-01"]');
    await p2.click('[data-espick="preview"]');
    await p2.waitForSelector("#esstart", { timeout: 8000 });
    await p2.click("#esstart");
    await p2.waitForTimeout(900);
    await p2.$$eval(".es-startrow", es => { const t = es.filter(x => /Body/.test(x.textContent))[0]; t && t.click(); });
    await p2.waitForTimeout(700);
    await p2.$$eval("[data-espath]", es => es[0] && es[0].click());
    await p2.waitForTimeout(600);
    const sw3 = await p2.$("#esstartwriting");
    if (sw3) { await sw3.click(); await p2.waitForTimeout(600); }
    let withEvidence = null;
    for (let i = 0; i < 6; i++) {
      const st = await p2.evaluate(() => ({
        head: ((document.querySelector(".es-guideh") || {}).textContent || "").trim(),
        job: ((document.querySelector(".es-guidejob") || {}).textContent || "").trim(),
        gap: ((document.querySelector(".es-evgap") || {}).textContent || "").trim(),
      }));
      if (/example|evidence/i.test(st.head)) { withEvidence = st; break; }
      const next = await p2.$("#esnextguide:not([disabled])");
      if (!next) break;
      await next.click(); await p2.waitForTimeout(320);
    }
    ok(!!withEvidence, "a question WITH usable evidence reaches the same sentence: " +
      JSON.stringify(withEvidence && withEvidence.head));
    if (withEvidence) {
      ok(/example|evidence|case study/i.test(withEvidence.job),
        "which still asks for a case study: " + JSON.stringify(withEvidence.job));
      ok(withEvidence.gap === "",
        "and carries no note about Marginal having none, because it has some: " +
        JSON.stringify(withEvidence.gap));
    }
    await p2.close();
  }

  console.log("5. one student writes it, end to end, on its own support");
  // ONE student here, on purpose. This tier answers "does the seam between the
  // importer and the student runtime still work", and one representative walk
  // answers it. The full four-profile matrix - zero knowledge, competent, wrong
  // turn, strong independent - is tests/ui54.js, which runs in the full tier:
  // four walks through one question is a study of the pedagogy rather than a
  // check on the architecture, and paying for it on every journeys run turned
  // this tier into a small full suite.
  //
  // The partial-knowledge student is the representative one. It chooses a
  // supplied argument, reads the pathway lesson, climbs the help ladder and
  // finishes, so a single walk crosses store, picker, preview, workspace,
  // lesson and ladder. tests/bots/profiles.js calls it the profile a real
  // student is likeliest to be, and that is the same reason.
  const q = rt.toRuntimeQuestion(PKG, { topics: TOPICS });
  const subjectContent = (() => {
    const { E } = lib.build();
    return E.subjects.business_studies;
  })();
  const page5 = await ctx.newPage();
  const res = await runJourney(page5, {
    T, subject: "business_studies", qre: new RegExp("operations strategies affect the quality", "i"),
    q: q, subjectContent: subjectContent, prof: PARTIAL, bodies: 3,
  });
  console.log(res.trace.report() + "\n");
  fs.writeFileSync(path.join(OUT, "external-smoke-journey.txt"), res.trace.report() + "\n");

  console.log("6. it finished, on the support this package carries");
  {
    const t = res.trace;
    ok(t.m.paragraphs === 3, "every paragraph started was finished: " + t.m.paragraphs + " of 3");
    ok(t.m.sentences >= 3, "in prose: " + t.m.sentences + " sentences");
    ok(t.m.suppliedArguments > 0,
      "it chose arguments this package authored: " + t.m.suppliedArguments);
    ok(t.m.lessonOpens > 0,
      "and read a lesson this package wrote: " + t.m.lessonOpens + " (" + t.m.lessonWords + " words)");
    ok(t.m.termsAcquired > 0,
      "learning something from the question's own words: " + t.m.termsAcquired + " of " + t.m.teachable);
    console.log("    wrote without a concept it needed " + t.m.blocked + " time(s)" +
      (t.m.unexplained.length ? "; never explained: " + t.m.unexplained.join(", ") : ""));
  }

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
