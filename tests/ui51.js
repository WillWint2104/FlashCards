// THE QUESTION PICKER, AS A STUDENT READS IT.
//
// The setup screen was showing the data shape instead of the questions. Rows
// read "operations strategies contribute to the achievement of performance
// objectives?" because the list rendered esQuestionPreview, which strips the
// leading directive so a chip can carry it, and these rows have no chip. And the
// directive filter was built from raw display strings, so a bundled "Explain"
// and an imported "explain" were two filters over one directive.
//
// Both are display faults over correct data, and both are the kind that a suite
// asserting "the list has 13 rows" would never see. So this one reads what is on
// the screen and compares it with what the author wrote.
const { chromium, T, usePractice, allRows, pageTo } = require("./env");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const lib = require("../tools/contract/libraries.js");
const rt = require("../tools/contract/runtime.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FAIL:", m); } };
const { E } = lib.build();
const BUS = E.subjects.business_studies.questions || [];

async function chooser(page, subject) {
  await page.goto(T);
  await page.waitForSelector(".navtab", { timeout: 8000 });
  for (const t of await page.$$(".navtab")) {
    if (/essay/i.test((await t.textContent()) || "")) { await t.click(); break; }
  }
  await page.waitForSelector("#essubject", { timeout: 8000 });
  await page.selectOption("#essubject", subject || "business_studies");
  await page.waitForTimeout(300);
  await usePractice(page);
}
// Across every page of the current filter, not just the page on screen. The list
// paginates at ten, so reading .qp-row alone reads a page and calls it the set.
const rowsOf = page => allRows(page);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const errs = [];
  ctx.on("page", pg => pg.on("pageerror", e => errs.push(String(e))));

  // One page visit for every section that only READS the rendered chooser.
  // Loading the 1.9MB walkthrough once per section was most of the runtime.
  const read1 = await ctx.newPage();
  await chooser(read1);

  console.log("1. every row shows the complete authored question");
  {
    const page = read1;
    const rows = await rowsOf(page);
    ok(rows.length === BUS.length, "one row per question: " + rows.length + " of " + BUS.length);
    const wrong = [];
    rows.forEach(r => {
      const src = BUS.find(q => q.id === r.id);
      if (!src) { wrong.push(r.id + ": no such question"); return; }
      if (r.q !== String(src.text).trim()) wrong.push(r.id + ": shows " + JSON.stringify(r.q));
    });
    ok(!wrong.length, "each row is its question's text, exactly as authored: " +
      JSON.stringify(wrong, null, 1).slice(0, 700));

    // The specific defect, named. A row must not begin part way through a
    // sentence, and must not have lost its directive.
    const beheaded = rows.filter(r => {
      const src = BUS.find(q => q.id === r.id);
      const cmd = String((src && src.command) || "").trim();
      return cmd && !new RegExp("^" + cmd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(r.q);
    });
    ok(!beheaded.length, "no row has had its directive stripped: " +
      JSON.stringify(beheaded.map(r => r.id + " " + JSON.stringify(r.q.slice(0, 40)))));
    ok(rows.every(r => /^[A-Z]/.test(r.q)), "every row starts with a capital letter: " +
      JSON.stringify(rows.filter(r => !/^[A-Z]/.test(r.q)).map(r => r.q.slice(0, 40))));
    ok(rows.every(r => /[.?]$/.test(r.q)), "and ends in a full stop or a question mark: " +
      JSON.stringify(rows.filter(r => !/[.?]$/.test(r.q)).map(r => r.q.slice(-30))));
  }

  console.log("2. metadata is shown only where it is authored");
  {
    const page = read1;
    const rows = await rowsOf(page);
    const authored = BUS.filter(q => q.marks != null).map(q => q.id).sort();
    const showing = rows.filter(r => /\d+ marks/.test(r.meta)).map(r => r.id).sort();
    ok(JSON.stringify(showing) === JSON.stringify(authored),
      "marks appear on exactly the questions that author them: " + JSON.stringify(showing) +
      " vs authored " + JSON.stringify(authored));
    ok(authored.length === 4 && showing.length === 4,
      "which is four of the thirteen, not all thirteen at the form's default of 20: " + showing.length);
    rows.forEach(r => {
      const src = BUS.find(q => q.id === r.id);
      if (src && src.marks != null) ok(r.meta.indexOf(src.marks + " marks") >= 0,
        r.id + " shows its authored " + src.marks + " marks: " + JSON.stringify(r.meta));
    });
  }

  console.log("3. one directive is one filter, whatever case it was written in");
  {
    const page = read1;
    // The All pill carries an empty id, because it clears rather than selects.
    // It is not a directive and is excluded from the directive assertions.
    const dirs = await page.$$eval("[data-essetupdir]", es => es
      .filter(e => e.dataset.essetupdir)
      .map(e => ({ id: e.dataset.essetupdir, label: e.textContent.trim() })));
    const ids = dirs.map(d => d.id);
    ok(ids.length === new Set(ids).size, "no directive appears twice: " + JSON.stringify(ids));
    ok(ids.every(i => i === i.toLowerCase()), "every filter identity is canonical: " + JSON.stringify(ids));
    const authored = [...new Set(BUS.map(q => rt.directiveId(q.command)))].sort();
    ok(JSON.stringify(ids.slice().sort()) === JSON.stringify(authored),
      "and there is one per directive the bank authors: " + JSON.stringify(ids.slice().sort()));
    // The label a student reads is the authored form, not the id.
    ok(dirs.every(d => /^[A-Z]/.test(d.label)), "each is labelled for a person: " +
      JSON.stringify(dirs.map(d => d.label)));
    const topics = await page.$$eval("[data-essetuptopic]", es => es.map(e => e.dataset.essetuptopic));
    ok(topics.filter(Boolean).every(t => t === t.toLowerCase()), "topic identities are canonical too: " + JSON.stringify(topics));
    const realTopics = topics.filter(Boolean);
    ok(realTopics.length === new Set(realTopics).size, "and no topic appears twice");
  }

  console.log("4. an imported question joins the same filter, not a second one");
  {
    // The exact reported defect: "Explain 3" and "explain 1" side by side.
    const IMP = "bus-ext-picker";
    const tpl = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/contract/template-write-only.json"), "utf8"));
    const p = JSON.parse(JSON.stringify(tpl));
    p.origin = { type: "imported", packageId: IMP, author: "tests/ui51.js", authoredAt: "2026-09-04" };
    p.provenance = { reviewState: "draft", publication: "unpublished", notes: "" };
    p.requires = {}; p.provides = {};
    p.question = { id: IMP, subject: "business_studies", topicRef: null, topicLabel: "Marketing",
      directive: "explain", marks: 8,
      text: "Explain how the marketing mix of a business is shaped by the characteristics of its target market.",
      overallArgument: "x", vocabRefs: [], studyRefs: [] };
    p.relationship = { intro: "", claims: [] };
    p.decode = { verbMeaning: "give reasons", plainEnglish: "y", highlights: [], cover: { forEach: "" } };
    p.requirements = { concepts: [], relationships: [], accomplish: [], syllabusSummary: "" };
    p.coreAnswer = { mode: "causal", statement: "", acceptableThesis: "", checklist: [] };
    p.workingAnswer = { base: "" }; p.marking = { source: "authored", bands: null, bandSource: "" };
    p.areas = []; p.pathways = [];

    const page = await ctx.newPage();
    await chooser(page);
    const before = await page.$$eval("[data-essetupdir]", es => es.map(e => e.dataset.essetupdir).filter(Boolean));
    const beforeCount = await page.$eval('[data-essetupdir="explain"] .qp-n', e => Number(e.textContent));
    await page.evaluate(doc => {
      window.localStorage.setItem("marginal.import.pkg." + doc.question.id, JSON.stringify({
        schema: "marginal.published-package", version: 1,
        question: { id: doc.question.id, subject: "business_studies", subjectLabel: "Business Studies", document: doc },
        shared: [] }));
    }, p);
    await chooser(page);
    const after = await page.$$eval("[data-essetupdir]", es => es.map(e => e.dataset.essetupdir).filter(Boolean));
    ok(JSON.stringify(after) === JSON.stringify(before),
      "importing a lowercase explain adds NO new directive filter: " + JSON.stringify(after));
    const afterCount = await page.$eval('[data-essetupdir="explain"] .qp-n', e => Number(e.textContent));
    ok(afterCount === beforeCount + 1,
      "it is counted under the one that is there: " + beforeCount + " then " + afterCount);
    const rows = await rowsOf(page);
    const mine = rows.find(r => r.id === IMP);
    ok(mine && mine.q === p.question.text, "and its row shows the whole authored question: " +
      JSON.stringify(mine && mine.q));
    ok(mine && mine.meta.indexOf("Explain") >= 0 && mine.meta.indexOf("8 marks") >= 0,
      "with its directive labelled like any other and its authored marks: " + JSON.stringify(mine && mine.meta));
    // Filtering by that one directive brings back bundled AND imported together.
    await page.click('[data-essetupdir="explain"]');
    await page.waitForTimeout(250);
    const filtered = await rowsOf(page);
    ok(filtered.length === afterCount, "filtering to Explain shows all " + afterCount + ": " + filtered.length);
    ok(filtered.some(r => r.id === IMP) && filtered.some(r => r.id === "mkt-01"),
      "bundled and imported together: " + JSON.stringify(filtered.map(r => r.id)));
    await page.evaluate(id => window.localStorage.removeItem("marginal.import.pkg." + id), IMP);
    await page.close();
  }

  console.log("5. the counts beside each filter are the questions actually reachable");
  {
    const page = await ctx.newPage();
    await chooser(page);
    const read = () => page.evaluate(() => ({
      dirs: [...document.querySelectorAll("[data-essetupdir]")].filter(e => e.dataset.essetupdir).map(e => ({
        id: e.dataset.essetupdir, n: Number((e.querySelector(".qp-n") || {}).textContent) })),
      topics: [...document.querySelectorAll("[data-essetuptopic]")].filter(e => e.dataset.essetuptopic).map(e => ({
        id: e.dataset.essetuptopic, n: Number((e.querySelector(".qp-n") || {}).textContent) })),
      all: Number((document.querySelector('[data-essetupdir=""] .qp-n') || {}).textContent),
      count: (document.querySelector(".qp-count") || {}).textContent.trim(),
      rows: document.querySelectorAll(".qp-row").length,
    }));
    const all = await read();
    // The count line names the RANGE and the total, because the list paginates.
    ok(/^1–10 of 13 questions/.test(all.count),
      "the count line is above the results and says the range and the total: " + all.count);
    ok(all.rows === 10, "and a page holds ten of them: " + all.rows);
    ok(all.dirs.reduce((n, d) => n + d.n, 0) === 13, "the directive counts sum to the bank: " +
      JSON.stringify(all.dirs));
    ok(all.all === 13, "and the All pill says the same total: " + all.all);
    // Choose a topic, and the DIRECTIVE counts must be recomputed for it.
    await page.click('[data-essetuptopic="finance"]');
    await page.waitForTimeout(250);
    const fin = await read();
    ok(fin.rows === 3, "Finance has three questions: " + fin.rows);
    ok(/^1–3 of 3 questions/.test(fin.count), "the count says the range and the filtered total: " + fin.count);
    ok(fin.dirs.reduce((n, d) => n + d.n, 0) === 3,
      "and the directive counts now sum to what Finance holds, not to the bank: " + JSON.stringify(fin.dirs));
    const empty = fin.dirs.filter(d => d.n === 0);
    ok(empty.length > 0, "directives Finance has none of show zero rather than vanishing: " +
      JSON.stringify(empty.map(d => d.id)));
    const disabled = await page.$$eval("[data-essetupdir][disabled]", es => es.map(e => e.dataset.essetupdir));
    ok(JSON.stringify(disabled.sort()) === JSON.stringify(empty.map(d => d.id).sort()),
      "and are not pressable, because a filter leading nowhere is a dead end: " + JSON.stringify(disabled));
    // Clearing is the All pill at the head of each row, which is also what says
    // how many there are in total.
    const clear = await page.$('[data-essetuptopic=""]');
    ok(!!clear, "there is an All pill to go back to all of them");
    await clear.click();
    await page.waitForTimeout(250);
    ok((await read()).rows === 10, "which restores the full list, a page at a time: " + (await read()).rows);
    await page.close();
  }

  console.log("6. the app and the contract agree on identity, so they cannot drift");
  {
    const page = read1;
    const agreed = await page.evaluate(cases => {
      const M = window.MarginalImports;
      return cases.map(c => ({ c: c, d: M.directiveId(c), l: M.directiveLabel(M.directiveId(c)), t: M.topicId(c) }));
    }, ["Explain", "explain", "  Explain ", "How can", "to what extent", "Human Resources", ""]);
    agreed.forEach(a => {
      ok(a.d === rt.directiveId(a.c), "directiveId agrees on " + JSON.stringify(a.c) + ": " + a.d);
      ok(a.l === rt.directiveLabel(rt.directiveId(a.c)), "directiveLabel agrees on " + JSON.stringify(a.c) + ": " + a.l);
      ok(a.t === rt.topicId(a.c), "topicId agrees on " + JSON.stringify(a.c) + ": " + a.t);
    });
    await read1.close();
  }

  console.log("7. the preview says what the question actually offers");
  {
    const page = await ctx.newPage();
    await chooser(page);
    // mkt-01 is one of the three that report guided; ops-01 carries a stem and a
    // rubric and nothing else. If the preview said the same thing about both, it
    // would be decoration.
    const read = async id => {
      // The question may be on a later page.
      await pageTo(page, '.qp-row[data-esq="' + id + '"]');
      await page.click('.qp-row[data-esq="' + id + '"]');
      await page.evaluate(() => { const b = document.querySelector('[data-espick="preview"]'); b && b.click(); });
      await page.waitForSelector(".qp-prevq", { timeout: 8000 });
      const out = await page.evaluate(() => ({
        q: document.querySelector(".qp-prevq").textContent.trim(),
        facts: [...document.querySelectorAll(".qp-fact")].map(r => [
          r.querySelector("dt").textContent.trim(), r.querySelector("dd").textContent.trim()]),
        support: [...document.querySelectorAll(".qp-suprow")].map(r => ({
          name: r.querySelector(".qp-supname").textContent.trim(),
          state: r.querySelector(".qp-supstate").textContent.trim() })),
      }));
      await page.click("#esbacklist");
      await page.waitForSelector(".qp-row", { timeout: 8000 });
      return out;
    };
    const guided = await read("mkt-01");
    const thin = await read("ops-01");
    const src = id => BUS.find(q => q.id === id);

    ok(guided.q === src("mkt-01").text.trim(), "the preview is the authored question, whole");
    ok(thin.q === src("ops-01").text.trim(), "for a thin question as well as a guided one");

    const has = (r, n) => (r.support.find(x => x.name === n) || {}).state;
    ok(has(guided, "Pathway guidance") === "Available",
      "mkt-01 has pathway guidance, because it authors arguments: " + has(guided, "Pathway guidance"));
    ok(has(thin, "Pathway guidance") === "Not available",
      "ops-01 does not, because it authors none: " + has(thin, "Pathway guidance"));
    ok(has(guided, "Planning support") === "Available" && has(thin, "Planning support") === "Not available",
      "and the same for planning support, which is areas");
    ok(has(guided, "Marking guidance") === "Available" && has(thin, "Marking guidance") === "Available",
      "marking guidance is there for both, because it is written or generated");
    ok(JSON.stringify(guided.support) !== JSON.stringify(thin.support),
      "so the two questions do NOT report the same support");

    // Every line is checkable against the question. Nothing is asserted that the
    // question does not carry.
    const paths = (src("mkt-01").pathways || []).length;
    ok(paths > 0 && has(guided, "Learning support") ===
      ((src("mkt-01").pathways || []).some(p => (p.learning || {}).status === "authored") ? "Available" : "Not available"),
      "learning support matches whether a lesson is authored on any argument");

    // Marks: stated where authored, absent where not. The mockups showed 12
    // marks on ops-01, which authors none.
    const marksRow = r => (r.facts.find(f => f[0] === "Marks") || [])[1];
    ok(marksRow(guided) === String(src("mkt-01").marks), "marks are stated where authored: " + marksRow(guided));
    ok(src("ops-01").marks == null && marksRow(thin) === undefined,
      "and there is no Marks row at all where none is authored: " + JSON.stringify(marksRow(thin)));
    await page.close();
  }

  console.log("8. the three stages are three screens, and each has a way back");
  {
    const page = await ctx.newPage();
    await page.goto(T);
    await page.waitForSelector(".navtab", { timeout: 8000 });
    for (const t of await page.$$(".navtab")) {
      if (/essay/i.test((await t.textContent()) || "")) { await t.click(); break; }
    }
    await page.waitForSelector("#essubject", { timeout: 8000 });
    await page.selectOption("#essubject", "business_studies");
    await page.waitForTimeout(250);
    const stage = () => page.evaluate(() => ({
      heading: (document.querySelector(".qp-h1") || {}).textContent,
      rows: document.querySelectorAll(".qp-row").length,
      preview: !!document.querySelector(".qp-prevq"),
      subject: !!document.querySelector("#essubject"),
      // Present is not the question; VISIBLE is. A field inside a hidden wrapper
      // is not part of the screen even though it is in the document.
      settings: (() => { const e = document.querySelector("#esstruct"); return !!e && !!e.offsetParent; })(),
    }));
    const one = await stage();
    ok(/Set up your essay/.test(one.heading) && one.subject && one.rows === 0,
      "stage one is the subject and no list: " + JSON.stringify(one));
    await page.click('[data-espick="list"]'); await page.waitForTimeout(250);
    const two = await stage();
    ok(/Choose a practice question/.test(two.heading) && two.rows === 10 && !two.subject,
      "stage two is the list, with its own heading and no setup form: " + JSON.stringify(two));
    ok(!two.settings, "and the settings are not carried down it: " + two.settings);
    // The settings live on the SETUP stage, which is where setting up happens.
    // They must be reachable from there, folded, or a student who wants a
    // different structure has nowhere to go.
    await page.click('.qp-row[data-esq="mkt-01"]'); await page.waitForTimeout(250);
    await page.click('[data-espick="preview"]'); await page.waitForTimeout(250);
    const three = await stage();
    ok(three.preview && three.rows === 0, "stage three is the question: " + JSON.stringify(three));
    ok(!three.settings, "and the preview carries no settings either: " + three.settings);
    // Back, all the way.
    await page.click("#esbacklist"); await page.waitForTimeout(250);
    ok((await stage()).rows === 10, "back returns to the list");
    await page.click('[data-espick="subject"]'); await page.waitForTimeout(250);
    const home = await stage();
    ok(home.subject, "and back again returns to the subject");
    ok(!!(await page.$("#esmoreopts")), "where the essay options are, folded away");
    await page.click("#esmoreopts > summary"); await page.waitForTimeout(200);
    ok(!!(await page.$("#esstruct")) && !!(await page.$("#esmarks")),
      "and one press opens structure and marks, so nothing became unreachable");
    await page.close();
  }

  ok(!errs.length, "no page raised an error throughout: " + JSON.stringify(errs.slice(0, 3)));
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
