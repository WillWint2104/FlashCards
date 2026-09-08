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
  await p.waitForTimeout(300);
  await p.evaluate(() => { const b = document.querySelector('[data-espick="preview"]'); b && b.click(); });
  await p.waitForSelector("#esstart", { timeout: 8000 }).catch(() => {});
  await p.click("#esstart");
  await p.waitForFunction(() => !!document.querySelector("#esline, .es-startrow"), null, { timeout: 8000 });
  return true;
}
async function section(p, re) {
  await p.evaluate(r => { const t = [...document.querySelectorAll(".es-startrow")].find(x => new RegExp(r, "i").test(x.textContent)); t && t.click(); }, re);
  await rf(p); await p.waitForTimeout(300);
  const pth = await p.$("[data-espath]"); if (pth) { await pth.click(); await rf(p); }
  const go = await p.$("#esstartwriting"); if (go) { await go.click(); await rf(p); }
  await p.waitForTimeout(300);
  return !!(await p.$("#esline"));
}
async function write(p, lines) {
  for (const l of lines) {
    if (!(await p.$("#esline"))) break;
    await p.fill("#esline", l);
    await p.click("#esaccept"); await p.waitForTimeout(350);
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
    if (b && await b.isEnabled()) { await b.click(); await p.waitForTimeout(1200); return true; }
  }
  return false;
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
  await p.$$eval(".es-rtab", es => es[0].click()); await p.waitForTimeout(300);
  row = await rowOf(p);
  ok(row.bodies === 1, "still exactly one open: " + row.bodies);
  ok(/doing its job/i.test(String(row.head)), "a slot the coach approved says so briefly: " + JSON.stringify(row.head));
  ok(!row.issue, "with no invented criticism attached to it");
  const page = await p.evaluate(() => document.body.innerText);
  ok(page.indexOf("MODEL-PROSE-ON-AN-OK-SLOT-9c1f") < 0,
    "and the model's own words about an approved sentence never reach the screen");

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
  await check(p);
  tabs = await tabsOf(p);
  const last = tabs[tabs.length - 1];
  console.log("    unreported tab:", JSON.stringify(last));
  ok(/unassessed/.test(last.cls), "it is shown as unassessed, not ok: " + last.cls);
  await p.$$eval(".es-rtab", es => es[es.length - 1].click()); await p.waitForTimeout(300);
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
  for (const [why, make] of bad) {
    await stub(p, body => ({ note: "", nudges: [], slotFeedback: make(body) }));
    await check(p);
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
  await p.$$eval(".es-rtab", (es, i2) => es[i2].click(), target); await p.waitForTimeout(300);
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
  await p.waitForTimeout(600);
  const kept = await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
    const d = Object.values(raw).flatMap(bk => (bk && bk.drafts) || [])[0];
    const pp = d && (d.paras || []).find(x => x.feedback);
    return { has: !!(pp && pp.feedback), snap: !!(pp && pp.feedback && pp.feedback.checked),
      stale: !!(pp && (pp.gradedText || "") !== (pp.text || "")) };
  });
  ok(kept.has && kept.snap, "the stale feedback and its snapshot are still stored after a reload");
  ok(kept.stale, "and it is still recorded as being about an earlier version");

  console.log("");
  console.log(pass + " passed, " + fail + " failed");
  await b.close();
  process.exit(fail ? 1 : 0);
})();
