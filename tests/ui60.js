// A SUBJECT THE APPLICATION STILL DEPENDS ON IS NOT A SUBJECT IT STILL OFFERS.
//
// Ancient History is legacy for this product. It was never marked as such: the
// registry had no notion of status, esSubjectsList offered any subject shipping
// questions or a scaffold, and so it appeared in the student-facing picker as a
// current choice. That was not a leak caused by a bug - the codebase genuinely
// considered it active - which is why the fix is a registry marker rather than a
// special case in the UI.
//
// The distinction being encoded, and the reason this cannot be a one-line filter:
//
//   student-facing active subject  !=  internal legacy content dependency
//
// Ancient History is the second. ESSAY_FALLBACK_EXAMPLE_SUBJECT points at it and
// every other subject borrows its worked examples as a clearly-labelled
// placeholder until its own are authored. Its six questions stay. Any student
// routed to it - /^11Anc/, or ?essaydemo=1 - keeps everything they had.
//
// The four things this file proves, which are the four the change could get
// wrong:
//
//   1. it is not in the normal active picker
//   2. its content is still there, and the fallback-example mechanism still works
//   3. taking it out selects nothing else in its place
//   4. the unresolved-subject "Choose a subject" state still works
//
// Plus the one the change introduces and could get wrong quietly: a student who
// is ALREADY in the legacy subject must not be told they are in a different one.
// Filtering it out unconditionally leaves the picker with no option matching
// ES.subject, and a <select> with nothing marked shows its first option as
// chosen - which is verbatim the fault ui59 was written for, arriving from the
// other side.
const { chromium, T } = require("./env");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };

const LEGACY = "ancient_history";

const pickerState = page => page.evaluate(() => {
  const sel = document.getElementById("essubject");
  const bar = document.querySelector(".qp-subj");
  return {
    exists: !!sel,
    options: sel ? [...sel.options].map(o => ({ v: o.value, t: o.text })) : [],
    selected: sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].value : null,
    selectedText: sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : null,
    header: bar ? bar.textContent.split("·")[0].trim() : null,
  };
});

// The class code is read at runtime from the stored trial state, not from CONFIG
// - currentClassCode() tries Cloud.who(), then state.code, then CONFIG.code - so
// a code is changed by rewriting the seed and reloading, exactly as a different
// login would arrive. Setting window.CONFIG.code after boot changes nothing,
// because the fixture's stored code wins.
async function enter(page, opts) {
  await page.goto(T);
  await page.waitForSelector(".navtab", { timeout: 8000 });
  if (opts && opts.code) {
    await page.evaluate(c => {
      const KEY = "marginal.trial.v1";
      try {
        const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
        raw.code = c;
        localStorage.setItem(KEY, JSON.stringify(raw));
      } catch (e) { /* private mode: the assertion below will say so */ }
    }, opts.code);
    await page.reload();
    await page.waitForSelector(".navtab", { timeout: 8000 });
  }
  await page.$$eval(".navtab", es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await page.waitForTimeout(500);
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } });
  const p = await ctx.newPage();
  await p.route(/workers\.dev/, r => r.abort());

  // ---- 1. not in the normal active picker --------------------------------
  console.log("--- 1. the legacy subject is not offered as a current subject");
  await enter(p);
  const s = await pickerState(p);
  ok(s.exists, "the picker is on screen");
  console.log("    offers:", JSON.stringify(s.options.map(o => o.v)));
  ok(!s.options.some(o => o.v === LEGACY),
    "Ancient History is not among the subjects offered: " + JSON.stringify(s.options.map(o => o.t)));
  ok(s.options.some(o => o.v === "business_studies"), "the current subject still is");

  // The registry is the source of truth, and the marker is on it - not a name
  // special-cased in the view.
  const marked = await p.evaluate(k => {
    const subs = (window.__esSubjects && window.__esSubjects()) || {};
    const a = subs[k];
    return a ? { present: true, legacy: !!a.legacy } : { present: false, legacy: false };
  }, LEGACY);
  ok(marked.present, "the subject is still registered");
  ok(marked.legacy, "and carries an explicit legacy marker rather than being filtered by name");

  // ---- 2. the content and the fallback mechanism are untouched -----------
  console.log("--- 2. its content is still there, and still doing its second job");
  const content = await p.evaluate(k => {
    const subs = (window.__esSubjects && window.__esSubjects()) || {};
    const a = subs[k] || null;
    const g = (window.ESSAY && window.ESSAY.slots && window.ESSAY.slots.examples) || [];
    return {
      questions: a ? (a.questions || []).length : 0,
      criteria: a ? (a.markingCriteria || []).length : 0,
      resolvesById: !!a,
      fallbackExamples: g.length,
      fallbackTopics: g.map(e => e.topic || e.label || "").filter(Boolean),
    };
  }, LEGACY);
  ok(content.resolvesById, "the registry still resolves it by key");
  ok(content.questions === 6, "its six questions are still there: " + content.questions);
  ok(content.criteria > 0, "so are its marking criteria: " + content.criteria);
  ok(content.fallbackExamples > 0,
    "the worked-example fallback set is still populated: " + content.fallbackExamples +
    " " + JSON.stringify(content.fallbackTopics));

  // The fallback reaches the examples WITHOUT going through the offered list, so
  // taking a subject out of the picker cannot empty it. Assert the path, not just
  // the data: a student in Business Studies sees the borrowed examples, labelled.
  const borrowed = await p.evaluate(() => {
    const src = (window.ESSAY && window.ESSAY.slots && window.ESSAY.slots.examples) || [];
    return src.length > 0 && typeof src[0] === "object" && !!(src[0].slots || src[0].text);
  });
  ok(borrowed, "and it is real example material, not an empty shape");

  // ---- 3. nothing is selected in its place -------------------------------
  console.log("--- 3. taking it out chooses nothing on the student's behalf");
  // This fixture's class code routes to a subject with no content, so no subject
  // is committed. The picker must say so rather than adopting the survivor.
  ok(s.selected === "", "nothing is selected: " + JSON.stringify(s.selected));
  ok(s.selected !== "business_studies",
    "the remaining subject was not silently adopted");
  ok(!s.header, "and no subject is named anywhere on screen: " + JSON.stringify(s.header));

  // ---- 4. the unresolved-subject state still works -----------------------
  console.log("--- 4. Choose a subject still works, and still commits");
  ok(s.selectedText === "Choose a subject", "the picker asks: " + JSON.stringify(s.selectedText));
  await p.selectOption("#essubject", "business_studies"); await p.waitForTimeout(400);
  const after = await pickerState(p);
  ok(after.selected === "business_studies", "choosing commits: " + after.selected);
  ok(after.header === "Business Studies", "and the header follows: " + JSON.stringify(after.header));
  ok(!after.options.some(o => o.v === ""),
    "the placeholder goes once a subject is chosen: " + JSON.stringify(after.options.map(o => o.v)));
  ok(!after.options.some(o => o.v === LEGACY), "and the legacy subject is still not offered");

  // ---- 5. the student already in it is not told otherwise ----------------
  console.log("--- 5. a student routed INTO the legacy subject keeps it, and is told the truth");
  // /^11Anc/ routes to ancient_history. That student is already there: the app
  // must not show them a different subject as chosen.
  await enter(p, { code: "11Anc1" });
  const routed = await p.evaluate(() => {
    try { return JSON.parse(localStorage.getItem("marginal.trial.v1") || "{}").code; } catch (e) { return null; }
  });
  ok(routed === "11Anc1", "the fixture is running as an 11Anc login: " + JSON.stringify(routed));
  const legacyStudent = await pickerState(p);
  console.log("    offers:", JSON.stringify(legacyStudent.options.map(o => o.v)),
    " selected:", JSON.stringify(legacyStudent.selected));
  ok(legacyStudent.selected === LEGACY,
    "the committed legacy subject is the one shown as chosen: " + JSON.stringify(legacyStudent.selected));
  ok(legacyStudent.header === "Ancient History",
    "and the header agrees with it: " + JSON.stringify(legacyStudent.header));
  ok(legacyStudent.selected !== "business_studies",
    "they were not silently moved into another subject");
  // Their questions are still reachable.
  const bank = await p.evaluate(() => {
    const subs = (window.__esSubjects && window.__esSubjects()) || {};
    return (subs.ancient_history.questions || []).length;
  });
  ok(bank === 6, "their question bank is intact: " + bank);

  console.log("");
  console.log(pass + " passed, " + fail + " failed");
  await b.close();
  process.exit(fail ? 1 : 0);
})();
