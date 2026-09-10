// THE DECLARED SUBJECT DECIDES, AND CROSS-WIRING IS REFUSED.
//
// WHAT IT FOUND.
//
// ui61 established that an attempt is bound to its question's package rather
// than to the picker. That fixed the reading end. This suite went at the
// WRITING end - what an author can publish - and found the same fault arriving
// from the other side, still open.
//
// A package declaring subject "economics" whose question carried
// topicRef "business.operations" published cleanly through all five importer
// steps, filed into the Economics bank, and reached the runtime reading
//
//     topic: "Operations"
//
// on an Economics question. Nothing in the contract compared the subject a
// package declares against the subject that OWNS the records it uses, because
// the manifest a validator reads carried only whether each record was finished,
// never whose it was. Two changes close it, and both are in this diff:
// libraries.js now carries the owner into the manifest, and validate.js refuses
// the mismatch as SUBJECT_CROSS_WIRED, in both directions - reaching into
// another subject's library, and shipping another subject's records inside.
//
// THE RULE THIS FILE HOLDS.
//
//   a package files where it DECLARES, never where its prose sounds like
//   a legacy subject stays unoffered even when a question is imported into it
//   a subject nothing registers gets a container and no marking criteria
//   a declaration contradicting the records it uses is refused, visibly, at
//     the importer's validate step, before it can reach a student
//
// The marking refusal itself - a declared subject that resolves to no criteria
// is not marked against somebody else's - is held at its own seam by ui61.
//
// FULL TIER, and only there. It publishes four packages through the real
// five-step importer and validates four more against the shipped manifest: an
// exhaustive cross-product of declared subjects, which is the kind of sweep the
// exhaustive tier exists for.
const path = require("path");
const { chromium, T } = require("./env");
const { publishThroughImporter, clearStore, IMPORTER } = require("./fixtures/lib");
const SUBJ = require("./fixtures/subjects");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };

// The app, entered as a student, with whatever is in the store already imported.
async function enter(page) {
  await page.goto(T);
  await page.waitForSelector(".navtab", { timeout: 8000 });
  await page.$$eval(".navtab", es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await page.waitForSelector("#essubject", { timeout: 8000 });
  await page.waitForTimeout(300);
}
// Where a question ended up, what it says it is, and what the bank it landed in
// can mark. One evaluate, because the interesting failure is a DISAGREEMENT
// between these and reading them apart would let the page change in between.
const landed = (page, id) => page.evaluate(qid => {
  const subs = (window.__esSubjects && window.__esSubjects()) || {};
  let bucket = null, q = null;
  Object.keys(subs).forEach(k => {
    const hit = (subs[k].questions || []).find(x => x.id === qid);
    if (hit) { bucket = k; q = { id: hit.id, subject: hit.subject || null, topic: hit.topic || null }; }
  });
  const pkg = bucket ? subs[bucket] : null;
  const sel = document.getElementById("essubject");
  return { bucket: bucket, q: q,
    criteria: (pkg && (pkg.markingCriteria || []).length) || 0,
    label: pkg && pkg.label,
    offered: [...sel.options].map(o => o.value).filter(v => v && !o_disabled(sel, v)) };
  function o_disabled(s, v) { const o = [...s.options].find(x => x.value === v); return !!(o && o.disabled); }
}, id);

(async () => {
  const cases = SUBJ.build();
  const b = await chromium.launch();

  // ---- 1. one package, four declarations, four destinations ---------------
  console.log("--- 1. a package files where it declares");
  // Each publish gets a clean store: the claim is about one package's
  // declaration, and four packages in one bank would let a pass come from
  // whichever happened to be found first.
  const expect = [
    [cases.bus, "business_studies", "the Business Studies package, as authored"],
    [cases.anc, "ancient_history", "the Ancient History package, as authored"],
    [cases.eco, "economics", "the same package re-declared as Economics"],
    [cases.unk, "geography", "a subject nothing registers"],
  ];
  const seen = {};
  for (const [c, subject, why] of expect) {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
    await clearStore(ctx);
    const r = await publishThroughImporter(ctx, c.file);
    ok(r && r.outcome === "written", why + ": it publishes (" + (r && r.outcome) + ")");
    ok(r && (r.added || []).some(x => x.id === c.id && x.subject === subject),
      why + ": and the store files it under " + subject + ": " +
      JSON.stringify((r && r.added || []).map(x => x.id + "->" + x.subject)));
    const p = await ctx.newPage();
    await p.route(/workers\.dev/, x => x.abort());
    await enter(p);
    const L = await landed(p, c.id);
    seen[subject] = L;
    console.log("    " + c.id + " -> " + JSON.stringify({ bucket: L.bucket, subject: L.q && L.q.subject, topic: L.q && L.q.topic }));
    ok(L.bucket === subject, why + ": it reaches the runtime in " + subject + ", not " + L.bucket);
    ok(L.q && L.q.subject === subject, why + ": and the question carries its own subject: " + JSON.stringify(L.q && L.q.subject));
    await ctx.close();
  }

  // ---- 2. the three states, after an import into each ---------------------
  console.log("--- 2. importing into a subject does not make it selectable");
  // REGISTERED, SELECTABLE and LEGACY are three states, and an import is exactly
  // the event that used to collapse them: a question arrives, a container is
  // made for it, and a subject nobody decided to offer is suddenly on the menu.
  ok(seen.business_studies.offered.indexOf("business_studies") >= 0, "Business Studies is offered");
  ok(seen.economics.offered.indexOf("economics") >= 0, "Economics is offered");
  ok(seen.ancient_history.offered.indexOf("ancient_history") < 0,
    "Ancient History stays legacy WITH a question imported into it: " + JSON.stringify(seen.ancient_history.offered));
  ok(seen.ancient_history.bucket === "ancient_history",
    "and the imported question is still there to be resolved, which is what registered means");

  // A subject nothing registers gets a container so its question is not
  // invisible, and it carries no marking criteria, because none were authored.
  // A response in it is refused at marking rather than marked against another
  // subject's - the fail-closed ui61 holds at that seam. It IS offered today,
  // which means a student can begin an essay that cannot be marked. Recorded
  // here as the behaviour that exists, not asserted as the behaviour that should.
  console.log("    an unregistered subject: offered=" +
    (seen.geography.offered.indexOf("geography") >= 0) + " criteria=" + seen.geography.criteria);
  ok(seen.geography.bucket === "geography", "an unregistered subject still gets its question a container");
  ok(seen.geography.criteria === 0,
    "and it carries no marking criteria, so marking has nothing to borrow: " + seen.geography.criteria);
  ok(seen.business_studies.criteria === 4 && seen.economics.criteria === 4,
    "while the registered subjects carry their own four");

  // ---- 3. a declaration that contradicts the records is refused ----------
  console.log("--- 3. cross-wired packages are refused by the shipped validator");
  // Through the importer's OWN bundled contract and the manifest it ships with,
  // not this repo's modules: what matters is what a teacher's copy refuses.
  const ctx3 = await b.newContext();
  const p3 = await ctx3.newPage();
  await p3.goto(IMPORTER);
  const errorsFor = file => p3.evaluate(async src => {
    const pkg = JSON.parse(src);
    // Exactly as the importer calls it: the directive registry is supplied
    // because a browser cannot walk the content files to build one.
    const D = window.MarginalImportData;
    const rep = window.MarginalContract.validate(pkg, D.manifest, { registry: D.directives });
    const errs = (rep.findings || []).filter(f => f.severity === "error");
    return { n: errs.length, codes: [...new Set(errs.map(e => e.code))],
      where: errs.slice(0, 3).map(e => e.path) };
  }, require("fs").readFileSync(file, "utf8"));

  const clean = await errorsFor(cases.bus.file);
  ok(clean.n === 0, "the control publishes with no errors: " + JSON.stringify(clean));

  // The rule has two halves and they are named apart, because a fixture caught by
  // both proves neither. `at` says which half found it: a path inside question or
  // pathways is a REFERENCE into another subject's library; a path under provides
  // is another subject's record shipped inside the file.
  const xw = [
    [cases.busInEco, "question.", "Business Studies records under an Economics declaration"],
    [cases.busInAnc, "question.", "the same records under a legacy Ancient History declaration"],
    [cases.ecoInBus, "provides.", "Economics-owned records shipped inside a Business Studies package"],
    [cases.libRefOnly, "question.topicRef",
      "a self-contained package re-declared as Economics that only REFERENCES a Business topic"],
  ];
  for (const [c, at, why] of xw) {
    const r = await errorsFor(c.file);
    console.log("    " + c.id + " -> " + r.n + " errors " + JSON.stringify(r.codes) + " at " + JSON.stringify(r.where));
    ok(r.codes.indexOf("SUBJECT_CROSS_WIRED") >= 0, why + ": refused as cross-wired, codes " + JSON.stringify(r.codes));
    ok(r.n > 0, why + ": with at least one error, so it cannot be published");
    ok(r.where.some(x => String(x).indexOf(at) === 0),
      why + ": and the half that found it is " + at + ", not somewhere else: " + JSON.stringify(r.where));
  }
  // AND THE OTHER SIDE OF THE SAME RULE, in the importer a teacher actually runs.
  // The check above used to be satisfied by a value that merely LOOKED like a
  // subject key, which meant a vocabulary record whose course meaning was the
  // single word "training" was refused with the same code, severity and verdict
  // as the genuine cross-wire on the line above it. Ownership is typed now, so
  // both halves can be true at once: the cross-wire is caught and the prose is not.
  const terse = await errorsFor(cases.terseMeaning.file);
  console.log("    " + cases.terseMeaning.id + " -> " + terse.n + " errors " + JSON.stringify(terse.codes));
  ok(terse.codes.indexOf("SUBJECT_CROSS_WIRED") < 0,
    "a one-word course meaning is prose, not an ownership claim: " + JSON.stringify(terse.codes));
  ok(terse.n === 0, "and the package carrying it publishes: " + JSON.stringify(terse));

  // The reference case again, on its own terms: ONE error and nothing else, so a
  // pass here cannot be coming from a second rule firing on the same file.
  const only = await errorsFor(cases.libRefOnly.file);
  ok(only.n === 1 && only.where[0] === "question.topicRef",
    "the reference into another subject's syllabus is refused on its own: " + JSON.stringify(only));
  const none = await errorsFor(cases.noSubject.file);
  ok(none.codes.indexOf("FIELD_MISSING") >= 0,
    "a package naming no subject at all is refused for the missing field: " + JSON.stringify(none.codes));

  // The finding has to be readable, not just counted: an ungrouped code lands in
  // a group of its own and says the grouping is out of date.
  const grouped = await p3.evaluate(() => {
    const g = window.MarginalContract.groupOf("SUBJECT_CROSS_WIRED");
    return g ? { id: g.id, title: g.title } : null;
  });
  ok(grouped && grouped.id === "self",
    "and it is filed under the package disagreeing with itself: " + JSON.stringify(grouped));
  await ctx3.close();

  // ---- 4. and the importer screen actually stops -------------------------
  console.log("--- 4. the screen a teacher is looking at stops at validate");
  const ctx4 = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  const p4 = await ctx4.newPage();
  await p4.goto(IMPORTER);
  await p4.setInputFiles("#filepick", [cases.busInEco.file]);
  await p4.waitForFunction(() => window.__importer.state().files.length === 1);
  await p4.click("#continue");
  let blockedAt = null;
  for (let s = 1; s < 5 && blockedAt === null; s++) {
    await p4.waitForFunction(x => window.__importer.state().step === x, s);
    await p4.waitForTimeout(300);
    const st = await p4.evaluate(() => {
      const btn = document.getElementById("next");
      return { step: window.__importer.state().step, disabled: !!(btn && btn.disabled),
        onScreen: (document.body.innerText.match(/SUBJECT_CROSS_WIRED/g) || []).length };
    });
    if (st.disabled) { blockedAt = st; break; }
    await p4.click("#next");
  }
  ok(!!blockedAt, "the walk cannot be completed: " + JSON.stringify(blockedAt));
  ok(blockedAt && blockedAt.step === 2, "it stops at the validate step: " + (blockedAt && blockedAt.step));
  ok(blockedAt && blockedAt.onScreen > 0,
    "and the reason is named on screen, not just counted: SUBJECT_CROSS_WIRED x" + (blockedAt && blockedAt.onScreen));
  await ctx4.close();

  console.log("");
  console.log(pass + " passed, " + fail + " failed");
  await b.close();
  process.exit(fail ? 1 : 0);
})();
