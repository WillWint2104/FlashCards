// THREE SUBJECT PACKAGES, AND NOTHING BORROWED BETWEEN THEM.
//
// WHAT IT FOUND, BEFORE IT EXISTED.
//
// Long Response was a Business Studies implementation with two other subjects
// partially attached to it. app.js contained exactly ONE ES.subject comparison
// in the whole file - a placeholder flag - and four subsystems read
// window.BUSCONTENT with no subject check at all. Reproduced on the deployed
// build: an Ancient History student typing a question containing the words
// "government policies" was told
//
//     Topic: Operations, from the syllabus terms this question names
//
// Operations being HSC Business Studies. An Ancient History question containing
// "production" resolved the same topic in the study-hints panel.
//
// Two more, from the same cause. question.subject is required by the package
// contract and its stated meaning is "which subject's marking criteria,
// paragraph models and libraries apply" - and toRuntimeQuestion dropped it, so
// every evaluation read ES.subject, a picker selection. A draft begun in one
// subject and submitted after changing the picker was marked against the other
// subject's criteria. And markingContext ended in C.markingCriteria, the
// FLASHCARD half's Economics criteria, so any subject whose label failed to
// resolve was silently marked as Economics.
//
// The rule this file holds:
//
//   all three packages are real, selectable and separately identified
//   an attempt is bound to its question's package and cannot be re-pointed
//   Business Studies academic data runs only for Business Studies
//   a subject that cannot be resolved fails closed rather than borrowing
//   nothing exposes an evidence record the publication gate would withhold
const { chromium, T, chooseQuestion } = require("./env");
const { publishThroughImporter, clearStore, toChooser, ID: PKG_ID, PKG } = require("./fixtures/lib");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };

const PKGS = ["business_studies", "economics", "ancient_history"];

async function enter(page) {
  await page.goto(T);
  await page.waitForSelector(".navtab", { timeout: 8000 });
  await page.$$eval(".navtab", es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await page.waitForSelector("#essubject", { timeout: 8000 });
  await page.waitForTimeout(300);
}
const pkg = (page, k) => page.evaluate(key => {
  const subs = (window.__esSubjects && window.__esSubjects()) || {};
  const s = subs[key];
  if (!s) return null;
  return { key: s.key, label: s.label, questions: (s.questions || []).length,
    criteria: (s.markingCriteria || []).length, criteriaText: (s.markingCriteria || []).join(" | "),
    scaffolds: !!s.scaffolds, concepts: Object.keys(s.concepts || {}).length };
}, k);

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1100 } })).newPage();
  await p.route(/workers\.dev/, r => r.abort());

  // ---- 1. three packages, three identities -------------------------------
  console.log("--- 1. all three are real, selectable packages");
  await enter(p);
  const offered = await p.$$eval("#essubject option", es => es.map(o => o.value).filter(Boolean));
  console.log("    offered:", JSON.stringify(offered));
  for (const k of PKGS) ok(offered.indexOf(k) >= 0, k + " is offered as a Long Response subject");

  const packs = {};
  for (const k of PKGS) packs[k] = await pkg(p, k);
  for (const k of PKGS) {
    ok(!!packs[k], k + " is a registered package");
    ok(packs[k] && packs[k].key === k, k + " knows its own key: " + (packs[k] && packs[k].key));
    ok(packs[k] && packs[k].criteria === 4, k + " owns four marking criteria: " + (packs[k] && packs[k].criteria));
  }
  // Each package's criteria are ITS OWN, not another's.
  const texts = PKGS.map(k => packs[k].criteriaText);
  ok(new Set(texts).size === 3, "no two packages share a criteria set");
  ok(/business case studies/.test(packs.business_studies.criteriaText), "Business Studies marks case studies");
  ok(/sources and evidence/.test(packs.ancient_history.criteriaText), "Ancient History marks sources");
  ok(/economic terminology/.test(packs.economics.criteriaText), "Economics marks economic terminology");

  console.log("--- 1b. thin is allowed, borrowed is not");
  ok(packs.business_studies.questions === 13, "Business Studies is the deep package: " + packs.business_studies.questions + " questions");
  ok(packs.ancient_history.questions === 6, "Ancient History keeps its six: " + packs.ancient_history.questions);
  ok(packs.economics.questions === 0, "Economics is honestly thin: " + packs.economics.questions + " questions");
  ok(!packs.economics.scaffolds && !packs.ancient_history.scaffolds,
    "neither thin package borrowed Business Studies' scaffolds");
  ok(packs.economics.concepts === 0 && packs.ancient_history.concepts === 0,
    "nor its concept library");

  // ---- 2. every label agrees, for each package ---------------------------
  console.log("--- 2. every visible label agrees, in each package");
  for (const k of PKGS) {
    await p.selectOption("#essubject", k); await p.waitForTimeout(400);
    const seen = await p.evaluate(() => {
      const sel = document.getElementById("essubject");
      const bar = document.querySelector(".qp-subj");
      return { picker: sel.options[sel.selectedIndex].value,
        pickerText: sel.options[sel.selectedIndex].text,
        header: bar ? bar.textContent.split("·")[0].trim() : null };
    });
    ok(seen.picker === k, k + ": the picker commits it");
    ok(seen.header === packs[k].label, k + ": the header says the same: " + JSON.stringify(seen.header));
  }

  // ---- 3. the Business readers do not run elsewhere ----------------------
  console.log("--- 3. Business Studies data runs only for Business Studies");
  // The topic detector is the one reproduced on the deployed build. A question
  // containing a Business syllabus phrase must not be classified for a student
  // who is not in Business Studies.
  const BUS_PHRASE_Q = "Analyse how government policies influence the distribution of income and wealth in the Australian economy.";
  const topicFor = async (subject) => {
    await p.selectOption("#essubject", subject); await p.waitForTimeout(350);
    await p.$$eval('[data-espick="own"]', es => es[0] && es[0].click()); await p.waitForTimeout(300);
    await p.fill("#esq", BUS_PHRASE_Q);
    await p.dispatchEvent("#esq", "input"); await p.waitForTimeout(200);
    // the panel renders on a render, so force one through the picker
    const other = subject === "economics" ? "ancient_history" : "economics";
    await p.selectOption("#essubject", other); await p.waitForTimeout(300);
    await p.selectOption("#essubject", subject); await p.waitForTimeout(350);
    await p.$$eval('[data-espick="own"]', es => es[0] && es[0].click()); await p.waitForTimeout(300);
    await p.$$eval("button, summary, [data-esopt]", es => {
      const t = es.find(x => /Essay options/i.test(x.textContent || "")); t && t.click(); });
    await p.waitForTimeout(500);
    return p.evaluate(() => {
      const pre = document.querySelector(".qp-rubpre");
      const txt = pre ? pre.textContent : "";
      return { topic: (txt.match(/Topic\n([^\n]*)/) || [])[1] || null,
        concepts: (txt.match(/named in the question\n([^\n]*)/) || [])[1] || null };
    });
  };
  const BUS_TOPICS = /\b(Operations|Marketing|Finance|Human resources)\b/;
  for (const k of ["ancient_history", "economics"]) {
    const g = await topicFor(k);
    console.log("    " + k + " -> " + JSON.stringify(g.topic));
    ok(!BUS_TOPICS.test(String(g.topic)),
      k + ": a Business Studies topic is not claimed for it: " + JSON.stringify(g.topic));
    ok(!/government policies/.test(String(g.concepts)),
      k + ": no Business syllabus phrase is quoted back as its own: " + JSON.stringify(g.concepts));
  }
  // and it still works where it belongs
  const bus = await topicFor("business_studies");
  console.log("    business_studies -> " + JSON.stringify(bus.topic));
  ok(BUS_TOPICS.test(String(bus.topic)),
    "Business Studies still gets its own topic detection: " + JSON.stringify(bus.topic));

  console.log("--- 3b. the evidence and Learn resolvers are gated at one seam");
  const gated = await p.evaluate(() => {
    const src = String((window.__esSubjects || function () {}).toString());
    return src.length > 0;   // presence only; the real check is below, in-page
  });
  ok(gated, "the app exposes its registry for inspection");
  // Read the gate from the built source: one predicate, used by every reader.
  const fs = require("fs"), path = require("path");
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  ok(/function busAllowed\(/.test(app), "there is a single Business-data gate");
  ok(/function busContent\(\) \{ return busAllowed\(\)/.test(app),
    "and busContent goes through it, so every reader that uses busContent is gated");
  // Counting occurrences says nothing; what matters is that no READ escapes the
  // gate. Every non-comment line touching window.BUSCONTENT must be either the
  // gate itself or a read already guarded by busAllowed().
  const busLines = app.split("\n")
    .map((l, i) => ({ n: i + 1, l: l }))
    .filter(x => /window\.BUSCONTENT/.test(x.l) && !/^\s*\/\//.test(x.l));
  const ungated = busLines.filter(x =>
    !/busAllowed\(\)/.test(x.l) && !/function busContent\(\)/.test(x.l));
  ok(busLines.length > 0, "the Business bank is still reachable somewhere: " + busLines.length + " lines");
  ok(ungated.length === 0, "every read of it passes the subject gate; ungated: " +
    JSON.stringify(ungated.map(x => "app.js:" + x.n)));

  // ---- 4. an attempt is bound to its question's package ------------------
  console.log("--- 4. changing the picker cannot re-point an existing attempt");
  await enter(p);
  await p.selectOption("#essubject", "business_studies"); await p.waitForTimeout(400);
  await p.$$eval('[data-espick="list"]', es => es[0] && es[0].click()); await p.waitForTimeout(400);
  await p.$$eval(".qp-row", es => es[0] && es[0].click()); await p.waitForTimeout(400);
  await p.$$eval('[data-espick="preview"]', es => es[0] && es[0].click()).catch(() => {});
  await p.waitForTimeout(300);
  await p.click("#esstart"); await p.waitForTimeout(700);
  const bound = await p.evaluate(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
      const drafts = Object.values(raw).flatMap(bk => (bk && bk.drafts) || []);
      const d = drafts[0];
      return d ? { subject: d.subject, questionSubject: d.questionSubject } : null;
    } catch (e) { return null; }
  });
  ok(!!bound, "the attempt was written down");
  ok(bound && bound.subject === "business_studies", "bound to Business Studies: " + JSON.stringify(bound && bound.subject));
  ok(bound && bound.questionSubject === "business_studies",
    "and it records the package its question came from: " + JSON.stringify(bound && bound.questionSubject));
  // The source-level invariant: nothing on the marking path reads ES.subject.
  ok(/const sc = esAttemptPackage\(d\);/.test(app),
    "esMarkCard resolves the attempt's package, not the picker's");
  ok(!/subject: ES\.subject \|\| undefined/.test(app),
    "and the coach payload no longer sends the picker's subject");

  // ---- 5. unknown subject fails closed ----------------------------------
  console.log("--- 5. an unresolvable subject is refused, not substituted");
  ok(/unresolved: true/.test(app), "markingContext can report an unresolved subject");
  ok(/subject-unresolved/.test(app), "and gradeWritten refuses rather than sending");
  // the Economics fallthrough is gone from the declared path
  ok(/if \(!declares && !criteria\) criteria = C\.markingCriteria/.test(app),
    "C.markingCriteria is reached only when nothing declares a subject, which is flashcard content");
  ok(!/if \(!criteria\) criteria = \(sub && sub\.markingCriteria\) \|\| C\.markingCriteria/.test(app),
    "the old unconditional fallthrough to Economics is gone");

  // ---- 6. no path shows evidence the gate withholds ---------------------
  console.log("--- 6. withheld evidence stays withheld everywhere");
  const evState = await p.evaluate(() => {
    const bus = window.BUSCONTENT || {};
    const all = Object.keys(bus.evidence || {}).flatMap(k => bus.evidence[k]);
    const usable = all.filter(e => e && String(e.source || "").trim() && String(e.checked || "").trim());
    return { total: all.length, usable: usable.length };
  });
  console.log("    evidence records:", evState.total, " passing the gate:", evState.usable);
  ok(evState.total > 0, "there is an evidence bank to withhold: " + evState.total);
  ok(/const ev = evAll\.filter\(esEvidenceUsable\)/.test(app),
    "the study-hints panel applies the same publication gate as the Evidence tool");
  ok(!/const ev = \(busContent\(\)\.evidence \|\| \{\}\)\[key\] \|\| \[\];/.test(app),
    "and no longer reads the bank raw");

  // ---- 7. an imported package keeps its identity all the way through -----
  console.log("--- 7. question.subject survives publish, reload and reaches the draft");
  // This is the chain the contract already required and the runtime silently
  // broke: fields.js makes question.subject required and says it decides which
  // package applies, and toRuntimeQuestion dropped it. Nothing noticed, because
  // the picker lists one subject at a time so ES.subject agreed by accident.
  const ctx2 = await b.newContext({ viewport: { width: 1500, height: 1100 } });
  const page2 = await ctx2.newPage();
  await page2.route(/workers\.dev/, r => r.abort());
  await clearStore(ctx2);
  const published = await publishThroughImporter(ctx2);
  ok(published && published.outcome === "written", "the external package publishes: " + (published && published.outcome));
  ok(published && (published.added || []).some(x => x.id === PKG_ID),
    "and its question is the one added: " + JSON.stringify((published && published.added || []).map(x => x.id)));

  await toChooser(page2);
  const runtimeQ = await page2.evaluate(id => {
    const subs = (window.__esSubjects && window.__esSubjects()) || {};
    for (const k of Object.keys(subs)) {
      const q = (subs[k].questions || []).find(x => x.id === id);
      if (q) return { bucket: k, id: q.id, subject: q.subject || null };
    }
    return null;
  }, PKG_ID);
  ok(!!runtimeQ, "the imported question reached the runtime: " + JSON.stringify(runtimeQ));
  ok(runtimeQ && runtimeQ.bucket === "business_studies", "filed under its own package: " + (runtimeQ && runtimeQ.bucket));
  // THE assertion. Without it, evaluation has nothing to read but the picker.
  ok(runtimeQ && runtimeQ.subject === "business_studies",
    "and the runtime question CARRIES its subject: " + JSON.stringify(runtimeQ && runtimeQ.subject));

  console.log("--- 7b. and the attempt started from it inherits that identity");
  // The bank paginates, so the row is reached with the harness's own walker
  // rather than by looking on whichever page happens to be showing.
  const words = String(PKG.question.text || "").split(/\s+/).slice(0, 5).join(" ");
  await chooseQuestion(page2, new RegExp(words.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")).catch(() => {});
  await page2.waitForTimeout(400);
  const started = await page2.evaluate(() => !!document.querySelector("#esstart"));
  ok(started, "the imported question can be chosen from the ordinary list");
  if (started) {
    await page2.waitForTimeout(400);
    await page2.$$eval('[data-espick="preview"]', es => es[0] && es[0].click()).catch(() => {});
    await page2.waitForTimeout(300);
    await page2.click("#esstart").catch(() => {});
    await page2.waitForTimeout(700);
    const d2 = await page2.evaluate(() => {
      try {
        const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
        const drafts = Object.values(raw).flatMap(bk => (bk && bk.drafts) || []);
        const d = drafts[0];
        return d ? { subject: d.subject, questionSubject: d.questionSubject, questionId: d.questionId } : null;
      } catch (e) { return null; }
    });
    ok(!!d2, "the attempt was written down: " + JSON.stringify(d2));
    ok(d2 && d2.questionSubject === "business_studies",
      "the draft records the IMPORTED question's package: " + JSON.stringify(d2 && d2.questionSubject));
  }
  await ctx2.close();

  console.log("");
  console.log(pass + " passed, " + fail + " failed");
  await b.close();
  process.exit(fail ? 1 : 0);
})();
