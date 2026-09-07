// WHAT A SUBJECT WITH NO CRITERIA PROMISES, AND WHOSE EXAMPLE A STUDENT IS SHOWN.
//
// TWO STUDENT-FACING BOUNDARIES, both of which were decided by accident before
// this suite existed.
//
// ONE. An imported package may declare a subject nothing registers. The runtime
// gives it a container so its question is not invisible, and a container has no
// marking criteria. The student could select it, plan, write the whole response,
// press Check this paragraph, and only then be refused - a fail-closed at the
// latest possible moment, which is a nasty surprise wearing a safety property's
// clothes. Writing is NOT taken away, because Marginal lets a student practise
// where support is incomplete. What changes is that the state is declared before
// a word is written:
//
//     Writing available
//     Coach and marking feedback unavailable for this subject
//
// and then held to: the check control is withheld with its reason where it would
// have been, no request is sent, no criteria are borrowed, and saving and
// resuming work exactly as they do anywhere else. When a package with criteria
// arrives, assessment turns on without the question's identity changing.
//
// TWO. A sentence shape is shared across subjects on purpose. The EXAMPLE filling
// it is academic material and belongs to the course it was written for. All four
// authored examples are Business Studies and were reachable from any subject that
// used the same shape: "See this shape used elsewhere" discloses a context, not
// an owner. They now name their subject and resolve against the attempt's, with
// no fallback - a subject with no example of its own is shown none.
//
// The worked-example set is the OTHER mechanism and is deliberately left alone:
// it borrows across subjects on purpose and says so on screen. What is asserted
// here is that it still says so.
//
// FULL TIER. It publishes through the real importer and walks a student from the
// picker into the workspace and back out.
const path = require("path");
const { chromium, T, loginAs } = require("./env");
const { publishThroughImporter, clearStore } = require("./fixtures/lib");
const SUBJ = require("./fixtures/subjects");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };
const rf = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

async function enter(page) {
  await page.goto(T);
  await page.waitForSelector(".navtab", { timeout: 8000 });
  await page.$$eval(".navtab", es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await page.waitForSelector("#essubject", { timeout: 8000 });
  await page.waitForTimeout(300);
}
const capState = page => page.evaluate(() => {
  const el = document.querySelector(".qp-cap");
  if (!el) return null;
  const t = el.innerText.replace(/\s+/g, " ").trim();
  return { reason: el.dataset.escap, text: t };
});

(async () => {
  const cases = SUBJ.build();
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  await clearStore(ctx);
  const published = await publishThroughImporter(ctx, cases.unk.file);
  const p = await ctx.newPage();

  // EVERY request to the coach, counted rather than merely blocked. "No worker
  // request is attempted" is a claim about what leaves the page, and a test that
  // only aborts them cannot tell an abort from a request never made.
  const asked = [];
  await p.route(/workers\.dev/, r => { asked.push(r.request().url()); return r.abort(); });

  console.log("--- 1. the state is declared before anything is written");
  ok(published && published.outcome === "written", "the unregistered-subject package publishes");
  await enter(p);
  for (const known of ["business_studies", "economics"]) {
    await p.selectOption("#essubject", known); await p.waitForTimeout(350);
    ok((await capState(p)) === null, known + " carries criteria, so nothing is declared about it");
  }
  await p.selectOption("#essubject", "geography"); await p.waitForTimeout(400);
  const cap = await capState(p);
  console.log("    " + JSON.stringify(cap && cap.text.slice(0, 120)));
  ok(cap && cap.reason === "no-criteria", "the setup screen declares the state: " + JSON.stringify(cap && cap.reason));
  ok(cap && /Writing available/.test(cap.text), "it says writing is available");
  ok(cap && /feedback unavailable for this subject/i.test(cap.text),
    "and that feedback is not: " + JSON.stringify(cap && cap.text.slice(0, 90)));
  ok(cap && /carries no marking criteria/.test(cap.text), "with the reason named");
  ok(cap && /another subject/.test(cap.text), "and the promise that nothing is borrowed");

  console.log("--- 1b. and again on the screen the attempt actually starts from");
  await p.$$eval('[data-espick="list"]', es => es[0] && es[0].click()); await p.waitForTimeout(400);
  await p.$$eval(".qp-row", es => es[0] && es[0].click()); await p.waitForTimeout(350);
  await p.$$eval('[data-espick="preview"]', es => es[0] && es[0].click()).catch(() => {});
  await p.waitForTimeout(400);
  const onPreview = await capState(p);
  ok(!!(await p.$("#esstart")), "the preview offers to start the question");
  ok(onPreview && onPreview.reason === "no-criteria",
    "and carries the same declaration beside the start button: " + JSON.stringify(onPreview && onPreview.reason));

  console.log("--- 2. the workspace withholds the control and says why");
  await p.click("#esstart"); await p.waitForTimeout(700);
  // Straight into a paragraph; the plan route is not what is under test here.
  await p.$$eval(".es-startrow", es => { const t = es.find(x => /Body 1|introduction/i.test(x.textContent)); t && t.click(); });
  await rf(p); await p.waitForTimeout(400);
  const pth = await p.$("[data-espath]"); if (pth) { await pth.click(); await rf(p); }
  const go = await p.$("#esstartwriting"); if (go) { await go.click(); await rf(p); }
  await p.waitForTimeout(400);
  ok(!!(await p.$("#esline")), "the student can write");
  await p.fill("#esline", "Ritual practice organised the year, and the calendar it set is what the evidence records.");
  await p.waitForTimeout(200);
  await p.click("#esaccept"); await p.waitForTimeout(500);
  const foot = await p.evaluate(() => {
    const n = document.querySelector(".es-nofb");
    return { ask: !!document.getElementById("esask"), check: !!document.getElementById("esdonecheck"),
      nofb: n ? n.innerText.replace(/\s+/g, " ").trim() : null, reason: n ? n.dataset.escap : null };
  });
  console.log("    " + JSON.stringify(foot));
  ok(!foot.ask, "there is no Check control to press");
  ok(foot.nofb, "and something stands where it would have been: " + JSON.stringify(foot.nofb));
  ok(/no marking criteria/i.test(String(foot.nofb)), "which names the reason rather than going quiet");
  ok(/Geography/.test(String(foot.nofb)), "and names the subject it is about: " + JSON.stringify(foot.nofb));

  console.log("--- 2b. nothing was sent");
  ok(asked.length === 0, "no request reached the coach at any point: " + JSON.stringify(asked));

  console.log("--- 3. writing, saving and resuming are untouched");
  const written = await p.evaluate(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
      const drafts = Object.values(raw).flatMap(bk => (bk && bk.drafts) || []);
      const d = drafts[0];
      return d ? { subject: d.subject, questionSubject: d.questionSubject,
        text: (d.paras || []).map(x => x.text || "").join(" ").trim().slice(0, 60) } : null;
    } catch (e) { return null; }
  });
  ok(written && written.text.length > 10, "the paragraph was saved: " + JSON.stringify(written && written.text));
  ok(written && written.subject === "geography" && written.questionSubject === "geography",
    "bound to the subject it was written in: " + JSON.stringify(written));
  const exit = await p.$("#esexit");
  if (exit) { await exit.click(); await p.waitForTimeout(600); }
  await enter(p);
  await p.$$eval("[data-esnav]", es => { const t = es.find(x => x.dataset.esnav === "essays"); t && t.click(); });
  await p.waitForTimeout(500);
  const listed = await p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  ok(/Geography/i.test(listed), "and the attempt is listed under its own subject after leaving");

  console.log("--- 4. criteria arriving later turn assessment on, identity unchanged");
  // A registered package for this subject is what a later build would ship. The
  // criteria below are the test's own strings and are marked as such: the point is
  // that the CAPABILITY follows the package, and inventing plausible Geography
  // criteria to make the state look complete is the thing this project does not do.
  await enter(p);
  await p.evaluate(() => {
    const subs = window.ESSAY.subjects, next = {};
    Object.keys(subs).forEach(k => { next[k] = subs[k]; });
    next.geography = { key: "geography", label: "Geography", stage: "Year 11",
      markingCriteria: ["a criterion supplied by tests/ui64.js", "a second one", "a third one", "a fourth one"] };
    window.ESSAY.subjects = next;   // a new object, so the merge is recomputed
  });
  await p.selectOption("#essubject", "geography").catch(() => {});
  await p.waitForTimeout(450);
  // Committed, and checked: a select that silently did nothing would make the
  // declaration disappear for the wrong reason and this section would pass on it.
  const committed = await p.$eval("#essubject", e => e.value);
  ok(committed === "geography", "the student is still in the same subject: " + JSON.stringify(committed));
  ok((await capState(p)) === null, "with criteria present the state is no longer declared");
  const after = await p.evaluate(() => {
    const subs = (window.__esSubjects && window.__esSubjects()) || {};
    const q = ((subs.geography || {}).questions || [])[0] || null;
    let d = null;
    try {
      const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
      d = Object.values(raw).flatMap(bk => (bk && bk.drafts) || [])[0] || null;
    } catch (e) { /* sandboxed */ }
    return { qid: q && q.id, qsubject: q && q.subject,
      dsubject: d && d.subject, dquestionSubject: d && d.questionSubject };
  });
  ok(after.qid === cases.unk.id, "the same imported question is still there: " + JSON.stringify(after.qid));
  ok(after.qsubject === "geography", "still declaring its own subject: " + JSON.stringify(after.qsubject));
  ok(after.dsubject === "geography" && after.dquestionSubject === "geography",
    "and the attempt's identity did not move: " + JSON.stringify(after));
  ok(asked.length === 0, "and still nothing has been sent: " + JSON.stringify(asked));

  console.log("--- 5. a shape example belongs to a subject");
  // Asked of the resolver, against the real authored data, for whichever subject
  // is committed. A rendered route cannot ask it: a shape only resolves where a
  // question authors pathways, which today is Business Studies alone - so the
  // leak was one authored pathway away from being live in another subject, which
  // is exactly when nobody would have been looking.
  const ctx2 = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  const p2 = await ctx2.newPage();
  await p2.route(/workers\.dev/, r => r.abort());
  await enter(p2);
  const SHAPES = ["causal.body.topic", "causal.introduction.thesis",
                  "causal.conclusion.restate", "causal.conclusion.judgement"];
  const owners = await p2.evaluate(() => {
    const ex = ((window.ESSAY || {}).shapes || {}).examples || {};
    return Object.keys(ex).map(k => ({ shape: k,
      subjects: (ex[k] || []).map(x => x && x.subject) }));
  });
  console.log("    " + JSON.stringify(owners));
  ok(owners.length > 0, "there are authored shape examples: " + owners.length + " shapes");
  ok(owners.every(o => o.subjects.length && o.subjects.every(s => !!s)),
    "every one of them names the subject that owns it: " + JSON.stringify(owners));

  await p2.selectOption("#essubject", "business_studies"); await p2.waitForTimeout(350);
  const bus = await p2.evaluate(ids => ids.map(id => {
    const x = window.__esShapeExample(id); return { id: id, got: !!x, subject: x && x.subject }; }), SHAPES);
  ok(bus.every(x => x.got && x.subject === "business_studies"),
    "Business Studies still reaches its own examples: " + JSON.stringify(bus.map(x => x.got)));

  for (const other of ["economics"]) {
    await p2.selectOption("#essubject", other); await p2.waitForTimeout(350);
    const r = await p2.evaluate(ids => ids.map(id => window.__esShapeExample(id)), SHAPES);
    ok(r.every(x => x === null),
      other + " is shown none of them, though the shapes are the same: " + JSON.stringify(r.map(x => !!x)));
  }
  // The legacy subject, reached the way a student in it is reached.
  await loginAs(p2, "11Anc1", T);
  const ah = await p2.evaluate(ids => ({
    subject: (window.__esShapeExample && true) ? null : null,
    got: ids.map(id => window.__esShapeExample(id)),
  }), SHAPES);
  ok(ah.got.every(x => x === null),
    "and neither is the legacy Ancient History attempt: " + JSON.stringify(ah.got.map(x => !!x)));

  console.log("--- 6. the worked-example fallback still discloses itself");
  // A DIFFERENT mechanism, and one that borrows on purpose. It stays, because it
  // says on screen that the model is from another subject; what would make it a
  // leak is the label going missing, so that is what is asserted.
  const wk = await p2.evaluate(() => {
    const w = window.__esWorkedExamples();
    return { n: (w.list || []).length, placeholder: w.placeholder };
  });
  ok(wk.n > 0, "the fallback set is there: " + wk.n + " examples");
  ok(wk.placeholder === false,
    "and for the subject that OWNS them it is not labelled as borrowed: " + wk.placeholder);
  await p2.goto(T); await p2.waitForSelector(".navtab", { timeout: 8000 });
  await enter(p2);
  await p2.selectOption("#essubject", "economics"); await p2.waitForTimeout(350);
  const wk2 = await p2.evaluate(() => {
    const w = window.__esWorkedExamples();
    return { n: (w.list || []).length, placeholder: w.placeholder };
  });
  ok(wk2.n > 0 && wk2.placeholder === true,
    "for any other subject the same set is flagged as borrowed: " + JSON.stringify(wk2));
  const fs = require("fs");
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  ok(/ex\.placeholder \? `<div class="es-exph">/.test(app),
    "and the flag is what renders the disclosure, so it cannot be shown without one");
  ok(/a model from another subject/.test(app),
    "which says in words that it came from another subject");
  await ctx2.close();

  console.log("");
  console.log(pass + " passed, " + fail + " failed");
  await b.close();
  process.exit(fail ? 1 : 0);
})();
