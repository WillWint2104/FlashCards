// THE PARAGRAPH REVIEW.
//
// WHAT IT REPLACED. The coach returned six kinds of finding and the panel showed
// all of them at once: a band note, the missing elements, questions to push the
// student's thinking, wording advice, word-swap chips, a factual warning. Every
// one of them true, all of them on screen together, and a student whose Explain
// sentence was the problem had to read the lot to find out which sentence to
// change.
//
// It is one structural job at a time now, and the rules that make that safe are
// what this suite holds:
//
//   the rows are the AUTHORED slot model, whatever it declares
//   a status is what the coach SAID, never what it failed to say
//   a diagnosis names a sentence by id, and an id it cannot verify is dropped
//   the scaffold is authored, and never enters the student's paragraph
//   Save revision writes the student's characters and nothing else
//   an edit makes the finding stale, and only a new check can clear it
//
// THE TEST OF THE FOURTH RULE is worth stating plainly, because it is the one a
// reasonable implementation gets wrong: a tab does not go green because the coach
// returned no criticism of it. Silence is not a judgement. An element the coach
// did not report is shown as unchecked and says so.
const { chromium, T, usePractice } = require("./env");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };
const rf = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
// A click that triggers a re-render is finished when the render is, so these wait
// for two frames rather than for a number. The 1200ms after a check stays: that
// one is a round trip, not a repaint.
const settled = rf;
// A check is finished when the panel stops saying it is asking. The route is
// stubbed and answers at once, so waiting a flat 1200ms for it was waiting for
// nothing eleven times over.
const answered = async p => {
  await p.waitForFunction(() => !/Asking the coach/i.test(document.body.innerText), null, { timeout: 8000 })
    .catch(() => {});
  await settled(p);
};

const SENTENCES = [
  "Convenience-oriented customers value speed and low effort.",
  "Because these customers prefer quick service, the business can simplify its ordering process.",
  "For example, mobile ordering can reduce waiting and make purchasing easier.",
];

async function enter(p, subject) {
  await p.goto(T); await p.waitForSelector(".navtab", { timeout: 8000 });
  await p.evaluate(() => localStorage.removeItem("marginal.essay.v1"));
  await p.goto(T); await p.waitForSelector(".navtab", { timeout: 8000 });
  await p.$$eval(".navtab", es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await p.waitForSelector("#essubject", { timeout: 8000 });
  await p.selectOption("#essubject", subject || "business_studies");
  await usePractice(p);
}
async function startQuestion(p, re) {
  const got = await p.evaluate(r => {
    const t = [...document.querySelectorAll(".qp-row")].find(x => new RegExp(r, "i").test(x.textContent));
    if (t) { t.click(); return true; } return false; }, re);
  if (!got) return false;
  await settled(p);
  await p.evaluate(() => { const b = document.querySelector('[data-espick="preview"]'); b && b.click(); });
  await p.waitForSelector("#esstart", { timeout: 8000 }).catch(() => {});
  await p.click("#esstart");
  await p.waitForFunction(() => !!document.querySelector("#esline, .es-startrow"), null, { timeout: 8000 });
  return true;
}
async function section(p, re, want) {
  await p.evaluate(r => { const t = [...document.querySelectorAll(".es-startrow")].find(x => new RegExp(r, "i").test(x.textContent)); t && t.click(); }, re);
  await rf(p); await settled(p);
  // The pathway decides the scaffold, so a caller that cares about the scaffold has
  // to name the pathway rather than take whichever is listed first.
  const took = await p.evaluate(w => {
    const list = [...document.querySelectorAll("[data-espath]")];
    if (!list.length) return null;
    const t = w ? list.find(x => new RegExp(w, "i").test(x.textContent)) : list[0];
    if (!t) return null; t.click(); return true;
  }, want || null);
  if (took) await rf(p);
  const go = await p.$("#esstartwriting"); if (go) { await go.click(); await rf(p); }
  await settled(p);
  return !!(await p.$("#esline"));
}
async function write(p, lines) {
  for (const l of lines) {
    if (!(await p.$("#esline"))) break;
    await p.fill("#esline", l);
    await p.click("#esaccept"); await settled(p);
  }
}
const blocksOf = p => p.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
  const d = Object.values(raw).flatMap(bk => (bk && bk.drafts) || [])[0];
  const pp = d && (d.paras || []).find(x => (x.blocks || []).length);
  return ((pp && pp.blocks) || []).map(b => ({ id: b.id, slot: b.slot || null, text: b.text }));
});
const tabsOf = p => p.$$eval(".es-rtab", es => es.map(e => ({
  label: e.innerText.trim(), cls: e.className, on: e.getAttribute("aria-pressed") === "true" })));
const rowOf = p => p.evaluate(() => ({
  head: (document.querySelector(".es-rhead") || {}).innerText || null,
  issue: (document.querySelector(".es-rissue") || {}).innerText || null,
  frame: (document.querySelector(".es-rframe") || {}).innerText || null,
  box: (document.querySelector("[data-esrbox]") || {}).value,
  bodies: document.querySelectorAll(".es-rbody").length,
  lit: [...document.querySelectorAll(".es-rlit")].map(x => x.dataset.esblock),
}));
// A stubbed coach, so a status is whatever this suite decided it is.
async function stub(p, make) {
  await p.unroute(/workers\.dev/).catch(() => {});
  await p.route(/workers\.dev/, async route => {
    let body = {};
    try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) { /* not json */ }
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(make(body)) });
  });
}
// Re-check is the deliberate action once feedback is on screen; #esask carries a
// cooldown and is disabled until the paragraph changes, so an enabled control is
// what this looks for rather than the first one it finds.
async function check(p) {
  for (const sel of ["#esrecheck", "#esask", "#esdonecheck"]) {
    const b = await p.$(sel);
    if (b && await b.isEnabled()) { await b.click(); await answered(p); return true; }
  }
  return false;
}
// A SECOND CHECK NEEDS SOMETHING TO CHECK. Re-check is offered only once the
// paragraph no longer matches what was checked, which is the point of it: asking
// the coach the same question about the same words costs a worker call and can
// only return the same answer. A suite that wants a fresh result therefore does
// what a student does - changes a sentence - rather than pressing a control the
// product deliberately holds closed.
async function editThenCheck(p, text) {
  // ON A ROW THAT HAS A SENTENCE. The box on a MISSING row is empty and writing in
  // it creates a new sentence for that element rather than revising one, which
  // silently changed the paragraph the caller was making assertions about: the
  // element left unreported on purpose acquired a sentence and stopped being the
  // unreported one.
  // ONE CLICK AT A TIME. Pressing a tab re-renders the panel, so clicking them all
  // inside a single evaluate leaves every element after the first one detached and
  // the loop silently finds nothing.
  const keys = await p.$$eval(".es-rtab", es => es.map(e => e.dataset.esrtab));
  let landed = null, fallback = null;
  for (const k of keys) {
    await p.evaluate(kk => { const t = [...document.querySelectorAll(".es-rtab")].find(x => x.dataset.esrtab === kk); t && t.click(); }, k);
    await settled(p);
    const has = await p.$("[data-esrbox]");
    if (!has) continue;                                   // an ok row has no editor
    const v = await p.$eval("[data-esrbox]", e => e.value).catch(() => "");
    if (String(v || "").trim()) { landed = k; break; }
    if (!fallback) fallback = k;                          // a missing row: empty box
  }
  // Every row either approved or missing is a real state, and the change available
  // in it is writing the sentence that is not there. That is a student action and
  // it dates the check exactly as a revision does.
  if (!landed && fallback) {
    await p.evaluate(kk => { const t = [...document.querySelectorAll(".es-rtab")].find(x => x.dataset.esrtab === kk); t && t.click(); }, fallback);
    await settled(p);
    landed = fallback;
  }
  const box = landed ? await p.$("[data-esrbox]") : null;
  if (!box) return check(p);
  await p.fill("[data-esrbox]", text);
  await p.$eval("[data-esrbox]", e => e.dispatchEvent(new Event("input", { bubbles: true })));
  await settled(p);
  const sv = await p.$("#esrsave");
  if (sv && await sv.isEnabled()) { await sv.click(); await settled(p); await p.waitForTimeout(500); }
  return check(p);
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } });
  const p = await ctx.newPage();
  await p.evaluate(() => 0).catch(() => {});

  // ---- 1. the rows are the authored model ---------------------------------
  console.log("--- 1. the rows come from the paragraph model, not from a picture");
  await stub(p, () => ({ note: "", nudges: [], slotFeedback: [] }));
  await enter(p);
  ok(await startQuestion(p, "target markets"), "the question opens");
  ok(await section(p, "Body 1"), "a body paragraph opens");
  await write(p, SENTENCES);
  const blocks = await blocksOf(p);
  console.log("    blocks:", JSON.stringify(blocks.map(x => x.id + ":" + x.slot)));
  ok(blocks.length >= 3, "the sentences were written as blocks: " + blocks.length);
  ok(blocks.every(x => x.slot), "each carries the structural job it was written for");

  const model = await p.evaluate(() => ({
    teeec: window.ESSAY.subjects.business_studies.scaffolds.teeec.body.map(x => x.key),
    intro: window.ESSAY.slots.roleSets.introduction.map(x => x.key),
    concl: window.ESSAY.slots.roleSets.conclusion.map(x => x.key),
  }));
  // A real result, one entry per authored slot, so the tab row can be compared
  // against the model rather than against a number written into this file.
  await stub(p, body => ({
    note: "", nudges: [],
    slotFeedback: (body.slots || []).map((s, i) => {
      const own = (body.blocks || []).find(x => x.slot === s.key);
      if (!own) return { slot: s.key, status: "missing", blockId: "", issue: "No sentence is doing this job." };
      return i === 1
        ? { slot: s.key, status: "needs_work", blockId: own.id,
            issue: "You identify the change but do not explain why the characteristic causes it." }
        // An APPROVED slot carrying model prose anyway. The app writes its own line
        // for a slot doing its job, from the authored job text, so nothing written
        // here may reach the student. A worker that praises in its own words is the
        // easiest way for content to arrive on the one path nobody is watching.
        : { slot: s.key, status: "ok", blockId: own.id, issue: "MODEL-PROSE-ON-AN-OK-SLOT-9c1f" };
    }),
  }));
  ok(await check(p), "the paragraph can be checked");
  let tabs = await tabsOf(p);
  console.log("    tabs:", JSON.stringify(tabs.map(t => t.label)));
  ok(tabs.length === model.teeec.length,
    "one tab per authored TEEEC slot, " + model.teeec.length + " of them, not a number from a mockup: " + tabs.length);
  ok(tabs.filter(t => /needs_work/.test(t.cls)).length === 1, "one row needs work");
  ok(tabs.filter(t => /\bok\b/.test(t.cls)).length >= 1, "and the rest are reported as doing their job");

  // ---- 2. one issue open, and it names the sentence -----------------------
  console.log("--- 2. one issue at a time, tied to its own sentence");
  let row = await rowOf(p);
  ok(row.bodies === 1, "exactly one detailed issue is open: " + row.bodies);
  ok(/needs work/i.test(String(row.head)), "and it is the one that needs work: " + JSON.stringify(row.head));
  ok(/do not explain why/i.test(String(row.issue)), "the diagnosis is about what the student wrote");
  const owner = blocks.find(x => x.slot === model.teeec[1]);
  ok(row.lit.length === 1 && row.lit[0] === owner.id,
    "exactly the owning sentence is lit: " + JSON.stringify(row.lit) + " wanted " + owner.id);
  ok(String(row.box || "").trim() === owner.text.trim(),
    "and the revision box starts as their own sentence, unchanged");

  console.log("--- 2b. and pressing another tab moves, rather than stacking");
  await p.$$eval(".es-rtab", es => es[0].click()); await settled(p);
  row = await rowOf(p);
  ok(row.bodies === 1, "still exactly one open: " + row.bodies);
  ok(/doing its job/i.test(String(row.head)), "a slot the coach approved says so briefly: " + JSON.stringify(row.head));
  ok(!row.issue, "with no invented criticism attached to it");
  const page = await p.evaluate(() => document.body.innerText);
  ok(page.indexOf("MODEL-PROSE-ON-AN-OK-SLOT-9c1f") < 0,
    "and the model's own words about an approved sentence never reach the screen");
  // Not only unprinted: not KEPT. What is written down is what a later render, a
  // reload or a surface built next year would read, so the prose has to be gone
  // from the stored result rather than merely skipped by today's renderer.
  const stored = await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
    const d = Object.values(raw).flatMap(bk => (bk && bk.drafts) || [])[0];
    const pp = d && (d.paras || []).find(x => x.feedback);
    return JSON.stringify((pp && pp.feedback && pp.feedback.slotFeedback) || []);
  });
  ok(stored.indexOf("MODEL-PROSE-ON-AN-OK-SLOT-9c1f") < 0,
    "nor is it stored on the attempt: " + stored.slice(0, 120));
  ok(/"status":"ok"/.test(stored), "and the approved result itself was kept");

  // ---- 3. silence is not a pass ------------------------------------------
  console.log("--- 3. an element the coach did not report is not green");
  await stub(p, body => ({
    note: "", nudges: [],
    // Everything reported EXCEPT the last slot, which is simply left out.
    slotFeedback: (body.slots || []).slice(0, -1).map(s => {
      const own = (body.blocks || []).find(x => x.slot === s.key);
      return own ? { slot: s.key, status: "ok", blockId: own.id, issue: "" }
                 : { slot: s.key, status: "missing", blockId: "", issue: "Nothing does this job." };
    }),
  }));
  await editThenCheck(p, "The business shifts its promotion into the platforms these customers already use every day.");
  tabs = await tabsOf(p);
  const last = tabs[tabs.length - 1];
  console.log("    unreported tab:", JSON.stringify(last));
  ok(/unassessed/.test(last.cls), "it is shown as unassessed, not ok: " + last.cls);
  await p.$$eval(".es-rtab", es => es[es.length - 1].click()); await settled(p);
  const un = await rowOf(p);
  ok(/not checked/i.test(String(un.head)), "and says so when opened: " + JSON.stringify(un.head));

  // ---- 4. a reference it cannot verify is dropped ------------------------
  console.log("--- 4. an unverifiable reference is refused, not re-pointed");
  const bad = [
    ["an id that was never sent", body => [{ slot: (body.slots || [])[0].key, status: "needs_work", blockId: "b-not-real", issue: "x y z" }]],
    ["a slot this paragraph does not have", body => [{ slot: "judgement", status: "needs_work", blockId: (body.blocks || [])[0].id, issue: "x y z" }]],
    ["a slot that disagrees with the sentence", body => [{ slot: (body.slots || [])[2].key, status: "needs_work", blockId: (body.blocks || [])[0].id, issue: "x y z" }]],
    ["needs_work pointing at nothing", body => [{ slot: (body.slots || [])[0].key, status: "needs_work", blockId: "", issue: "x y z" }]],
  ];
  let nth = 0;
  for (const [why, make] of bad) {
    await stub(p, body => ({ note: "", nudges: [], slotFeedback: make(body) }));
    nth++;
    await editThenCheck(p, "The business moves its promotion onto those platforms, revision " + nth + ".");
    const t = await tabsOf(p);
    const anyGraded = t.some(x => /needs_work|missing|\bok\b/.test(x.cls));
    console.log("    " + why + " -> " + JSON.stringify(t.map(x => x.cls.replace("es-rtab ", ""))));
    ok(!anyGraded, why + ": nothing was graded from it");
    ok(t.length && t.every(x => /unassessed/.test(x.cls)), why + ": every row is left unassessed");
    ok(!!(await p.$(".es-rstale")), why + ": and the panel says the answer could not be matched");
  }

  // ---- 5. a sentence with no structural job is never labelled with one ----
  console.log("--- 5. the app never writes a structural job onto a sentence");
  // The old locator ended in `sents[i] || sents[0]`: when the quote did not match,
  // the diagnosis was attached to whichever sentence sat in that position. That is
  // the guess this replaced, and nothing in the new path may reintroduce it - not
  // by position, and not by labelling an unowned sentence to make a row resolve.
  const app = require("fs").readFileSync(require("path").join(__dirname, "..", "app.js"), "utf8");
  const fn = app.slice(app.indexOf("function esSlotStatuses"), app.indexOf("function esActiveReviewSlot"));
  ok(/byBlock\[blockId\]/.test(fn) && !/\[i\]|\[0\]|indexOf\(/.test(fn),
    "the review resolves a sentence by id alone, with no index anywhere in it");
  ok(/if \(b\.slot && b\.slot !== f\.slot\) return false;/.test(app),
    "a slot that disagrees with the sentence it names is refused rather than repaired");
  const wrote = await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
    const d = Object.values(raw).flatMap(bk => (bk && bk.drafts) || [])[0];
    const pp = d && (d.paras || []).find(x => (x.blocks || []).length);
    return ((pp && pp.blocks) || []).map(b => ({ id: b.id, slot: b.slot || null }));
  });
  ok(wrote.every(b => b.slot === null || typeof b.slot === "string"),
    "every stored slot is either what it was written as, or nothing");

  // ---- 6. save revision writes the student's characters, and only those ----
  console.log("--- 6. Save revision saves what the student typed");
  await stub(p, body => ({
    note: "", nudges: [],
    slotFeedback: (body.slots || []).map(s2 => {
      const own = (body.blocks || []).find(x => x.slot === s2.key);
      return own
        ? { slot: s2.key, status: s2.key === (body.slots || [])[1].key ? "needs_work" : "ok", blockId: own.id,
            issue: s2.key === (body.slots || [])[1].key ? "You do not explain why the characteristic causes the change." : "" }
        : { slot: s2.key, status: "missing", blockId: "", issue: "Nothing does this job." };
    }),
  }));
  await check(p);
  const target = (await tabsOf(p)).findIndex(t => /needs_work/.test(t.cls));
  ok(target >= 0, "there is a row that needs work to revise");
  await p.$$eval(".es-rtab", (es, i2) => es[i2].click(), target); await settled(p);
  const before = await rowOf(p);
  const frameText = String(before.frame || "");
  ok(frameText.length > 10, "an authored scaffold is shown: " + JSON.stringify(frameText.slice(0, 60)));
  ok(/\[.+\]/.test(frameText), "with blanks the student fills, not a finished sentence");
  const MINE = "Because convenience customers want to spend less time ordering, the business simplifies its process.";
  await p.fill("[data-esrbox]", MINE);
  await p.click("#esrsave"); await p.waitForTimeout(700);
  const after = await blocksOf(p);
  const saved = after.find(x => x.text.trim() === MINE);
  ok(!!saved, "the paragraph now contains exactly what the student typed");
  const para = await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
    const d = Object.values(raw).flatMap(bk => (bk && bk.drafts) || [])[0];
    const pp = d && (d.paras || []).find(x => (x.blocks || []).length);
    return (pp && pp.text) || "";
  });
  ok(para.indexOf(MINE) >= 0, "and it is in the paragraph text");
  // The scaffold is a shape to type over. Not one word of it may arrive in the
  // essay on its own, which is the whole no-answer-assembly rule in one assertion.
  const bare = frameText.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
  ok(bare.length < 4 || para.indexOf(bare) < 0,
    "and no part of the scaffold was written into the essay: " + JSON.stringify(bare.slice(0, 40)));

  // ---- 7. an edit makes the finding stale, and only a check clears it -----
  console.log("--- 7. edited, not fixed");
  const rows7 = await tabsOf(p);
  const edited = rows7.filter(t => /edited/.test(t.cls));
  console.log("    tabs after saving:", JSON.stringify(rows7.map(t => t.cls.replace("es-rtab ", ""))));
  ok(edited.length >= 1, "the row whose sentence changed is marked edited: " + edited.length);
  ok(!edited.some(t => /\bok\b/.test(t.cls)), "and it did not become ok merely because the text changed");
  ok(!!(await p.$(".es-rstale")), "the panel says the check was of the previous version");
  const stillThere = await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
    const d = Object.values(raw).flatMap(bk => (bk && bk.drafts) || [])[0];
    const pp = d && (d.paras || []).find(x => x.feedback);
    return !!(pp && pp.feedback && pp.feedback.checked && (pp.feedback.checked.blocks || []).length);
  });
  ok(stillThere, "the previous feedback and its snapshot were kept, not deleted");

  console.log("--- 7b. and it survives a reload");
  await p.reload(); await p.waitForSelector(".navtab", { timeout: 8000 });
  await p.$$eval(".navtab", es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await settled(p);
  const kept = await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
    const d = Object.values(raw).flatMap(bk => (bk && bk.drafts) || [])[0];
    const pp = d && (d.paras || []).find(x => x.feedback);
    return { has: !!(pp && pp.feedback), snap: !!(pp && pp.feedback && pp.feedback.checked),
      stale: !!(pp && (pp.gradedText || "") !== (pp.text || "")) };
  });
  ok(kept.has && kept.snap, "the stale feedback and its snapshot are still stored after a reload");
  ok(kept.stale, "and it is still recorded as being about an earlier version");

  // ---- 8. review is a MODE: one editor, and the composer stands down ------
  console.log("--- 8. one editing surface, not two");
  // A fresh attempt: section 7b reloaded the page to prove the stale feedback
  // survives it, so this starts from the picker rather than from wherever that left.
  await enter(p);
  ok(await startQuestion(p, "target markets"), "a fresh attempt opens");
  ok(await section(p, "Body 1"), "on a body paragraph");
  await write(p, SENTENCES);
  // AN INLINE EDITOR IS ALREADY OPEN when the check comes back. This is not a
  // contrived order: pressing a sentence opens the editor and leaves "Check this
  // paragraph" enabled beside it, so a student who reopens a line and then checks
  // arrives in the review with ES.ui.editBlock still set. The review renders the
  // paragraph above itself, and without the guard that editor renders with it,
  // beside the review's own box.
  const openedEditorFirst = await p.evaluate(() => {
    const t = document.querySelector("[data-esreopen]"); if (!t) return false; t.click(); return true;
  });
  await settled(p);
  ok(openedEditorFirst, "a sentence can be reopened while writing");
  ok(!!(await p.$(".es-linebox")), "which opens the inline editor");
  ok(await p.$eval("#esask", e => !e.disabled).catch(() => false),
    "and Check this paragraph is still offered beside it, so this order is reachable");
  await stub(p, body => ({
    note: "", nudges: [],
    slotFeedback: (body.slots || []).map((s2, i) => {
      const own = (body.blocks || []).find(x => x.slot === s2.key);
      return own
        ? { slot: s2.key, status: i === 1 ? "needs_work" : "ok", blockId: own.id,
            issue: i === 1 ? "You identify the change but do not explain why it follows." : "" }
        : { slot: s2.key, status: "missing", blockId: "", issue: "Nothing is doing this job yet." };
    }),
  }));
  await check(p);
  {
    // The first version layered the review under a live composer, so the page said
    // "the sentence you are writing" while the coach reviewed a different sentence,
    // and a missing slot gave the student two boxes to write it in.
    const surfaces = await p.evaluate(() => ({
      composer: !!document.querySelector("#esline"),
      guide: !!document.querySelector(".es-guide"),
      done: !!document.querySelector(".es-done"),
      boxes: document.querySelectorAll("#esline, [data-esrbox], [data-esedit]").length,
      prose: !!document.querySelector(".es-prose"),
      back: !!document.querySelector("#esrclose"),
    }));
    console.log("    " + JSON.stringify(surfaces));
    ok(!surfaces.composer, "the sentence composer is not on screen");
    ok(!surfaces.guide, "nor the step header telling them which sentence they are writing");
    ok(!surfaces.done, "nor the completion card, which belongs to writing");
    ok(surfaces.boxes === 1, "exactly one place to type: " + surfaces.boxes);
    ok(!(await p.$(".es-linebox")),
      "the inline editor that was open before the check did not come through with it");
    ok(surfaces.prose, "and the paragraph itself is still on screen above it");
    ok(surfaces.back, "with a way back to writing");
    // AND THE PARAGRAPH IS NOT A SECOND WAY IN. Every sentence on screen used to
    // carry data-esreopen, so pressing one opened the inline sentence editor beside
    // the review's rewrite box: two live textareas, reached from the one surface
    // the review deliberately leaves on screen. This section asserted "exactly one
    // place to type" and never pressed a sentence to find out.
    const reopen = await p.$$eval("[data-esreopen]", es => es.length);
    ok(reopen === 0, "no sentence in the paragraph is a control while the review is open: " + reopen);
    await p.evaluate(() => { const t = document.querySelector("[data-esreopen]"); t && t.click(); });
    await settled(p);
    const stillOne = await p.evaluate(() =>
      [...document.querySelectorAll("textarea")].filter(t => t.offsetParent !== null).length);
    ok(stillOne === 1, "and pressing one cannot open a second editor: " + stillOne + " visible textarea(s)");
    // ONE CHECK ACTION. The bar carried its own Check this paragraph beside the
    // review's Re-check, one of them disabled, competing for the same press.
    const checks = await p.evaluate(() => [...document.querySelectorAll("button")]
      .map(b => (b.innerText || "").trim())
      .filter(t => /^(check|re-check)/i.test(t)));
    console.log("    check controls: " + JSON.stringify(checks));
    ok(checks.length === 1 && /re-check/i.test(checks[0]),
      "one check action, and it is the one this state calls for: " + JSON.stringify(checks));
    await p.click("#esrclose"); await settled(p);
    ok(!!(await p.$("#esline")), "Continue writing brings the composer back");
    // Never TWO. One or none: with the paragraph unchanged since the check there is
    // nothing to re-check, which is the cooldown this app has always had, and the
    // stood-down strip is what says the findings are still there.
    const after = await p.evaluate(() => [...document.querySelectorAll("button")]
      .map(b => (b.innerText || "").trim()).filter(t => /^(check|re-check)/i.test(t)));
    ok(after.length <= 1, "and never two check actions at once: " + JSON.stringify(after));
    const shut = await p.$eval(".es-rshut", e => e.innerText.replace(/\s+/g, " ")).catch(() => "");
    ok(/still to work on|still here/i.test(shut), "the findings are stood down, not thrown away: " + JSON.stringify(shut));
    ok(!!(await p.$("#esropen")), "and one press brings them back");
    // WITH A SENTENCE REOPENED IN BETWEEN, which is the order that reaches the
    // guard. Arriving feedback clears ES.ui.editBlock, so an editor opened before a
    // check never survives into the review; but the findings can be stood down,
    // a sentence reopened in the writer, and the feedback then brought back with
    // "Open the feedback", which does not clear it. Without the guard the inline
    // editor renders inside the review beside its rewrite box.
    const reopenedMid = await p.evaluate(() => {
      const t = document.querySelector("[data-esreopen]"); if (!t) return false; t.click(); return true;
    });
    await settled(p);
    ok(reopenedMid, "a sentence can be reopened while the findings are stood down");
    ok(!!(await p.$(".es-linebox")), "which opens the inline editor in the writer");
    await p.click("#esropen"); await settled(p);
    ok(!!(await p.$(".es-rtabs")), "which it does");
    ok(!(await p.$(".es-linebox")),
      "and bringing the feedback back closes that editor rather than sitting beside it");
    const bothOpen = await p.evaluate(() =>
      [...document.querySelectorAll("textarea")].filter(t => t.offsetParent !== null).length);
    ok(bothOpen === 1, "still exactly one place to type: " + bothOpen);
  }

  // ---- 9. a missing part cannot coexist with a complete paragraph --------
  console.log("--- 9. composition completeness is not academic quality");
  {
    // A fresh result with parts outstanding, so the claim under test is about THIS
    // check rather than about whatever the previous section left behind.
    await p.click("#esrclose").catch(() => {});
    await settled(p);
    await p.fill("#esline", "A further sentence, so the paragraph differs from the checked version.").catch(() => {});
    await p.click("#esaccept").catch(() => {});
    await settled(p);
    await check(p);
    const st = await p.evaluate(() => {
      const t = document.body.innerText;
      return { done: /Paragraph complete/i.test(t), memorise: /Ready to memorise/i.test(t),
        attempted: /All parts attempted/i.test(t),
        open: [...document.querySelectorAll(".es-rtab")].filter(x => /needs_work|missing/.test(x.className)).length };
    });
    console.log("    " + JSON.stringify(st));
    ok(st.open > 0, "this paragraph has parts outstanding: " + st.open);
    ok(!st.done, "so it is not called complete");
    ok(!st.memorise, "and it is not offered for memorising");
    await p.click("#esrclose"); await settled(p);
    const st2 = await p.evaluate(() => {
      const t = document.body.innerText;
      return { done: /Paragraph complete/i.test(t), memorise: /Ready to memorise/i.test(t),
        attempted: /All parts attempted/i.test(t) };
    });
    console.log("    back in writing: " + JSON.stringify(st2));
    ok(!st2.done && !st2.memorise, "and the same holds with the composer back");
    // "All parts attempted" is itself only true when every job HAS a sentence, and
    // this paragraph is missing two, so the card is not there to say anything. What
    // matters is that nothing claims more than that - and `attempted` was collected
    // to check exactly that and then never read, the line under it repeating the
    // assertion above word for word.
    ok(!st2.attempted, "and nothing claims every part was attempted: " + JSON.stringify(st2));
  }

  // ---- 10. the scaffold answers the diagnosis --------------------------
  console.log("--- 10. the scaffold is for the job that was diagnosed");
  {
    // The fault this replaced, exactly: the Explanation diagnosis was about
    // characteristic causing the strategy change, and the generic slot template
    // underneath it taught strategy causing the downstream objective. A student
    // following it would not have answered the criticism above it.
    // Its own attempt, so the row under test is the Explanation of mkt-01 Body 1
    // and not whatever the section before it happened to leave selected.
    await enter(p);
    await startQuestion(p, "target markets");
    await section(p, "Body 1");
    await write(p, SENTENCES);
    await stub(p, body => ({
      note: "", nudges: [],
      slotFeedback: (body.slots || []).map(s2 => {
        const own = (body.blocks || []).find(x => x.slot === s2.key);
        if (!own) return { slot: s2.key, status: "missing", blockId: "", issue: "Nothing does this job yet." };
        return s2.key === "explain"
          ? { slot: "explain", status: "needs_work", blockId: own.id,
              issue: "You identify the strategy change, but you do not explain why this target-market characteristic causes the business to make that change." }
          : { slot: s2.key, status: "ok", blockId: own.id, issue: "" };
      }),
    }));
    await check(p);
    const rows2 = await tabsOf(p);
    const at = rows2.findIndex(t => /needs_work/.test(t.cls));
    ok(at >= 0, "the Explanation row is the one that needs work");
    if (at >= 0) { await p.$$eval(".es-rtab", (es, i2) => es[i2].click(), at); await settled(p); }
    const seen = await rowOf(p);
    console.log("    diagnosis: " + JSON.stringify(String(seen.issue || "").slice(0, 70)));
    console.log("    scaffold:  " + JSON.stringify(String(seen.frame || "")));
    ok(/target-market characteristic/i.test(String(seen.frame)),
      "it names the cause the diagnosis is about: " + JSON.stringify(seen.frame));
    ok(!/the effect on the objective/i.test(String(seen.frame)),
      "and is not the downstream objective frame the generic template supplied");
    const authoredFrame = await p.evaluate(() => {
      const q = ((window.__esSubjects && window.__esSubjects()) || {}).business_studies.questions.find(x => x.id === "mkt-01");
      const pw = (q.pathways || []).find(x => x.id === "mkt01-em-digital");
      return ((pw.help || {}).explain || {}).frame.text;
    });
    ok(String(seen.frame).trim() === String(authoredFrame).trim(),
      "because it is the frame the pathway authors for this slot on this question");
  }


  // ---- 11. SAVE AND RE-CHECK FOLLOW THE PARAGRAPH --------------------------
  console.log("--- 11. the actions are live only when there is something to do");
  {
    // ON SECTION 10'S REVIEW, not a fresh one. That attempt is already a checked
    // mkt-01 Body 1 on the digital pathway with the Explanation flagged, which is
    // exactly the state these transitions start from. Building a second identical
    // attempt cost the full gate a measured 0.7s to arrive at the same screen.
    // PRESENCE IS READ SEPARATELY FROM DISABLED, because `(el || {}).disabled` is
    // undefined for a control that is not on the page, and !!undefined is false -
    // which reads as "enabled". Every assertion below that expects an ENABLED
    // control would therefore have passed if the control had disappeared entirely,
    // which is the regression this section exists to catch.
    const state = () => p.evaluate(() => ({
      hasSave: !!document.querySelector("#esrsave"),
      hasRecheck: !!document.querySelector("#esrecheck"),
      save: !!(document.querySelector("#esrsave") || {}).disabled,
      recheck: !!(document.querySelector("#esrecheck") || {}).disabled,
      stale: !!document.querySelector(".es-rstale"),
      edited: [...document.querySelectorAll(".es-rtab")].filter(x => /edited/.test(x.className)).length,
    }));
    // FRESH
    let st = await state();
    ok(st.hasSave && st.hasRecheck, "both actions are on the page to begin with: " + JSON.stringify(st));
    ok(st.save, "fresh: Save is disabled, because the box holds the sentence it opened with");
    ok(st.recheck, "fresh: Re-check is disabled, because nothing has changed");
    ok(!st.stale, "fresh: nothing is stale");
    // TYPING THE SAME TEXT BACK IS NOT AN EDIT
    const was = await p.$eval("[data-esrbox]", e => e.value);
    await p.fill("[data-esrbox]", was + " ");
    await p.$eval("[data-esrbox]", e => e.dispatchEvent(new Event("input", { bubbles: true })));
    await settled(p);
    ok((await state()).save, "re-typing the same sentence with trailing space does not enable Save");
    // A REAL EDIT
    await p.fill("[data-esrbox]", "Because these customers spend their attention on social platforms, the business puts its offers where that attention already is.");
    await p.$eval("[data-esrbox]", e => e.dispatchEvent(new Event("input", { bubbles: true })));
    await settled(p);
    const stEdit = await state();
    ok(stEdit.hasSave && !stEdit.save, "a genuine change enables Save, and it is still on the page");
    await p.click("#esrsave"); await settled(p); await p.waitForTimeout(600);
    st = await state();
    ok(st.stale, "after saving: the check is stale");
    ok(st.edited >= 1, "after saving: the part is marked edited");
    ok(st.hasRecheck && !st.recheck, "after saving: Re-check is on the page and is the live action");
    // AND BACK TO REST
    await p.click("#esrecheck");
    await p.waitForFunction(() => { const r = document.querySelector(".es-review"); return r && !r.querySelector(".es-rstale"); }, null, { timeout: 12000 }).catch(() => {});
    await settled(p); await p.waitForTimeout(400);
    st = await state();
    ok(!st.stale, "after re-checking: the stale state is gone");
    ok(st.edited === 0, "after re-checking: nothing is still marked edited");
    ok(st.hasRecheck && st.recheck, "after re-checking: Re-check is still there and inactive again until another edit");
  }

  // ---- 12. CHANGING THE ARGUMENT DATES THE CHECK ---------------------------
  console.log("--- 12. a check obtained under a different argument is not current");
  {
    // The review resolves the diagnosis's scaffold and More help through the
    // paragraph's CURRENT pathway. A student may change that pathway after writing,
    // and the app already flags every written sentence when they do; the review read
    // none of it, so the guidance quietly re-pointed at prose written for the old
    // argument. The check is dated instead, using the presentation that already
    // exists for a paragraph that has moved on.
    const before = await p.evaluate(() => ({
      stale: !!document.querySelector(".es-rstale"),
    }));
    ok(!before.stale, "the check starts current");
    // BACK TO THE WRITER FIRST, because that is where the argument chip lives and
    // the writer stands down while the review is open. Querying for the chip found
    // it in a surface the student cannot press, so the click went nowhere and the
    // argument never changed.
    const back = await p.$("#esrclose"); if (back) { await back.click(); await settled(p); }
    const changed = await p.evaluate(() => {
      const chip = document.querySelector('[data-esrestchange="argument"]');
      if (!chip) return "no argument control"; chip.click(); return "opened";
    });
    ok(changed === "opened", "the argument can be changed from the writer: " + changed);
    await settled(p); await p.waitForTimeout(400);
    const picked = await p.evaluate(() => {
      const list = [...document.querySelectorAll("[data-espath]")];
      const t = list.find(x => !/digital marketing/i.test(x.textContent));
      if (!t) return { ok: false, saw: list.map(x => x.textContent.replace(/\s+/g, " ").trim().slice(0, 40)) };
      t.click(); return { ok: true, took: t.textContent.replace(/\s+/g, " ").trim().slice(0, 40) };
    });
    console.log("    pathway pick:", JSON.stringify(picked));
    await settled(p);
    ok(picked && picked.ok, "and a different pathway chosen with prose already written");
    await settled(p); await p.waitForTimeout(600);
    const after = await p.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
      const d = Object.values(raw).flatMap(bk => (bk && bk.drafts) || [])[0] || {};
      const x = (d.paras || [])[d.pos] || {};
      return { arg: x.argumentId, cv: x.contextVersion || 0,
        checkedCv: ((x.feedback || {}).checked || {}).contextVersion,
        flagged: (x.blocks || []).filter(b => b.needsReview).length };
    });
    ok(after.checkedCv !== undefined, "the check recorded which argument it was made under");
    ok(after.cv !== after.checkedCv, "the paragraph has moved to another one: " + after.cv + " vs " + after.checkedCv);
    ok(after.flagged > 0, "and the sentences written for the previous argument are flagged: " + after.flagged);
    const op = await p.$("#esropen") || await p.$("#esrecheck");
    if (op) { await op.click().catch(() => {}); await settled(p); }
    const bar = await p.$eval(".es-rstale", e => e.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
    ok(!!bar, "the review says the check is no longer current");
    ok(/argues something different|previous argument/i.test(bar),
      "and says why, rather than blaming an edit that did not happen: " + JSON.stringify(bar.slice(0, 90)));
  }
  // ---- 13. NO SCAFFOLD RATHER THAN THE WRONG ONE ---------------------------
  console.log("--- 13. a pathway that authors no frame gets no scaffold");
  {
    // The same question, the same directive, the same structural job and the same
    // diagnosis as section 10. The only difference is that this pathway authors no
    // frame for it - which is the position 27 of the 28 Explain pathways in this
    // subject are in. The generic slot template used to fill the gap, and it taught
    // strategy to outcome underneath a characteristic to strategy diagnosis.
    await enter(p);
    await startQuestion(p, "target markets");
    ok(await section(p, "Body 1", "Price sensitivity"), "Body 1 opens on a second pathway");
    const arg = await p.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
      const d = Object.values(raw).flatMap(bk => (bk && bk.drafts) || [])[0] || {};
      return ((d.paras || [])[d.pos] || {}).argumentId || null;
    });
    ok(arg && arg !== "mkt01-em-digital", "on an argument other than the one that authors a frame: " + arg);
    const authored = await p.evaluate(a => {
      const q = ((window.__esSubjects && window.__esSubjects()) || {}).business_studies.questions.find(x => x.id === "mkt-01");
      const pw = (q.pathways || []).find(x => x.id === a);
      return !!(((pw || {}).help || {}).explain || {}).frame;
    }, arg);
    ok(!authored, "and this pathway genuinely authors no explain frame");
    await write(p, SENTENCES);
    await stub(p, body => ({
      note: "", nudges: [],
      slotFeedback: (body.slots || []).map(s2 => {
        const own = (body.blocks || []).find(x => x.slot === s2.key);
        if (!own) return { slot: s2.key, status: "missing", blockId: "", issue: "Nothing does this job yet." };
        return s2.key === "explain"
          ? { slot: "explain", status: "needs_work", blockId: own.id,
              issue: "You identify the strategy change, but you do not explain why this target-market characteristic causes the business to make that change." }
          : { slot: s2.key, status: "ok", blockId: own.id, issue: "" };
      }),
    }));
    await check(p);
    const rows3 = await tabsOf(p);
    const at3 = rows3.findIndex(t => /needs_work/.test(t.cls));
    if (at3 >= 0) { await p.$$eval(".es-rtab", (es, i2) => es[i2].click(), at3); await settled(p); }
    const seen3 = await rowOf(p);
    ok(!!seen3.issue, "the diagnosis is still given: " + JSON.stringify(String(seen3.issue).slice(0, 60)));
    ok(!(await p.$(".es-rscaff")), "and no try this structure section is rendered at all");
    const panel = await p.$eval(".es-review", e => e.innerText).catch(() => "");
    ok(!/the effect on the objective/i.test(panel),
      "the rejected strategy-to-objective frame is nowhere on the panel");
    ok(!!(await p.$("[data-esrbox]")) && !!(await p.$("#esrhelp")),
      "the student still has the revision editor and More help");
  }


  console.log("");
  console.log(pass + " passed, " + fail + " failed");
  await b.close();
  process.exit(fail ? 1 : 0);
})();
