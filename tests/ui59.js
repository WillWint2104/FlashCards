// THE APP NEVER SHOWS TWO SUBJECTS AT ONCE.
//
// IT FOUND ONE, AND IT WAS ON SCREEN IN A SCREENSHOT SENT FOR APPROVAL.
//
// The header said ECONOMICS and the setup form said Ancient History, at the same
// moment, on the same page. Neither was showing ES.subject.
//
// A class code matching /^12Ec/ routes to "economics" and no economics subject
// has ever existed. esSubjectLabel humanised the key into a plausible-looking
// "Economics" for the header. The picker offers only subjects that ship
// questions or a scaffold, so it had no option to mark selected, and a <select>
// with nothing marked displays its FIRST option - Ancient History - exactly as
// if a student had chosen it. One label named a subject with nothing behind it;
// the other named a subject the student was not in.
//
// The fix is neither label's. ES.subject is reconciled on the way in to a
// subject the application can actually represent, so there is one committed
// value and every label reads it. What this file asserts is that rule, from the
// outside, at the two places a student can see a subject and at both widths:
//
//   the committed subject is always one the picker offers
//   every visible subject label agrees with it, at all times
//   changing it in the form moves every label at once, with nothing left behind
//   the label survives the walk into the writing and back
//   the narrow menu, which carries the subject heading, agrees too
const { chromium, T } = require("./env");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };

// Every place a subject is named, read off the rendered page. Not from ES: the
// point is what a student can see, and the defect was two rendered labels
// disagreeing while the state behind them was single and consistent.
const subjectsOnScreen = page => page.evaluate(() => {
  const sel = document.getElementById("essubject");
  const seen = {};
  seen.picker = sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].value : null;
  seen.pickerText = sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : null;
  // The bar's subject line, on either surface. It carries "Label · Stage" on the
  // picker and "Label" on the workspace, so only the part before the dot is read.
  const bar = document.querySelector(".qp-subj");
  seen.header = bar ? bar.textContent.split("·")[0].trim() : null;
  seen.options = sel ? [...sel.options].map(o => ({ v: o.value, t: o.text })) : [];
  return seen;
});

// The labels are text and the committed value is a key, so they are compared
// through the option list the application itself built.
const agrees = s => {
  if (!s.header) return true;                     // no subject shown is not a disagreement
  if (!s.picker) return true;                     // one-subject builds render no picker
  const opt = s.options.find(o => o.v === s.picker);
  return !!opt && opt.t === s.header;
};

// The class code is read from the stored trial state at runtime, so a login is
// changed by rewriting the seed. It only has to be written ONCE: localStorage
// survives navigation within the context, and esOpen re-reads the code every
// time Essay Practice is entered.
// One reload, because currentClassCode() reads the in-memory state loaded at boot
// before it reaches CONFIG - writing the seed alone changes nothing until the
// page is read again. Called ONCE for the whole suite; every later re-entry goes
// through toPicker, which does not reload.
async function loginAs(page, code) {
  await page.evaluate(c => {
    try {
      const raw = JSON.parse(localStorage.getItem("marginal.trial.v1") || "{}");
      raw.code = c; localStorage.setItem("marginal.trial.v1", JSON.stringify(raw));
    } catch (e) { /* private mode */ }
  }, code);
  await page.reload();
  await page.waitForSelector(".navtab", { timeout: 8000 });
}

// Re-entering Essay Practice, WITHOUT reloading the page. Leaving and coming
// back is a route a student has, esOpen re-routes the subject from the stored
// code on the way in, and it costs nothing: four page reloads were most of what
// this suite spent. Falls back to a reload only if the surface is not open.
async function toPicker(page) {
  const open = await page.evaluate(() => !!document.getElementById("eshost"));
  if (open) {
    const home = await page.$("#eshome") || await page.$("#esexit") || await page.$("#esbrandhome");
    if (home) { await home.click(); await page.waitForTimeout(250); }
  }
  if (!(await page.$(".navtab"))) {
    await page.goto(T);
    await page.waitForSelector(".navtab", { timeout: 8000 });
  }
  await page.$$eval(".navtab", es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await page.waitForSelector("#essubject", { timeout: 8000 });
  await page.waitForTimeout(250);
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } });
  const p = await ctx.newPage();
  await p.route(/workers\.dev/, r => r.abort());

  // ---- 1. on the way in ---------------------------------------------------
  console.log("--- 1. the subject a student lands on is one they could have chosen");
  await p.goto(T);
  await p.waitForSelector(".navtab", { timeout: 8000 });
  await toPicker(p);
  let s = await subjectsOnScreen(p);
  console.log("    picker:", JSON.stringify(s.picker), " header:", JSON.stringify(s.header));
  // Two honest states, and no third. Either the student is in a subject, and
  // every label says the same one; or they are not, the picker says so in a real
  // option, and no label names a subject at all. This fixture's class code routes
  // to "economics", which has never had any content, so it is the second.
  ok(s.picker !== null, "the picker has a selected option");
  ok(s.options.some(o => o.v === s.picker), "and it is one of the options it offers: " + JSON.stringify(s.picker));
  ok(agrees(s), "the header agrees with it: header=" + JSON.stringify(s.header) + " picker=" + JSON.stringify(s.pickerText));
  ok(s.picker !== "" || !s.header,
    "with no subject chosen, nothing on screen names one: " + JSON.stringify(s.header));
  ok(s.header !== "Economics", "no subject is named that the application has no content for");
  ok(s.picker !== "" || s.pickerText === "Choose a subject",
    "and the picker says so rather than showing whichever option is first: " + JSON.stringify(s.pickerText));

  // ---- 2. changing it moves everything ------------------------------------
  console.log("--- 2. changing the subject moves every label at once");
  // Two subjects are needed to watch the labels move, and since Ancient History
  // became legacy the only login offered two is one already routed into it. That
  // is the harder case anyway: a legacy subject shown as chosen, beside a current
  // one, is exactly where a stale label would hide.
  // One login switch for the rest of the suite. Ancient History is offered only
  // to a student the routing already put there, so this is the only login that
  // sees two subjects - and it is the harder case: a legacy subject shown as
  // chosen, beside a current one, is where a stale label would hide.
  await loginAs(p, "11Anc1");
  await toPicker(p);
  s = await subjectsOnScreen(p);
  const all = s.options.map(o => o.v).filter(Boolean);
  console.log("    as an 11Anc login the picker offers:", JSON.stringify(all));
  ok(all.length >= 2, "there is more than one subject to move between: " + JSON.stringify(all));
  ok(agrees(s), "and the labels agree before anything is changed: header=" +
    JSON.stringify(s.header) + " picker=" + JSON.stringify(s.pickerText));
  for (const want of all) {
    await p.selectOption("#essubject", want);
    await p.waitForTimeout(350);
    const t = await subjectsOnScreen(p);
    ok(t.picker === want, "choosing " + want + " commits it: " + t.picker);
    ok(agrees(t), "and every label on screen says so: header=" + JSON.stringify(t.header) + " picker=" + JSON.stringify(t.pickerText));
  }

  // ---- 3. nothing carries over --------------------------------------------
  console.log("--- 3. the previous subject is not left behind anywhere");
  // Start again on the login that offers both, note the legacy subject as the
  // committed one, then leave it. A label that lags by one change is the failure
  // this section is for.
  await toPicker(p);
  const before3 = await subjectsOnScreen(p);
  ok(before3.picker === "ancient_history", "starting committed to the legacy subject: " + before3.picker);
  await p.selectOption("#essubject", "business_studies"); await p.waitForTimeout(400);
  const after3 = await subjectsOnScreen(p);
  ok(after3.picker === "business_studies", "moved to the current subject: " + after3.picker);
  ok(agrees(after3), "and no label still says the one before it: " + JSON.stringify(after3.header));
  ok(after3.header !== before3.header, "the header actually changed: " +
    JSON.stringify([before3.header, after3.header]));
  // Leaving a legacy subject is a one-way door, and that is deliberate: it is
  // offered only to a student the routing already put there, never as a choice to
  // someone who has moved on. Asserted because it is a rule, not a side effect.
  ok(!after3.options.some(o => o.v === "ancient_history"),
    "and the legacy subject is no longer offered once it has been left: " +
    JSON.stringify(after3.options.map(o => o.v)));

  // ---- 4. the own-question route, which is where it was seen --------------
  console.log("--- 4. the same, in the own-question flow");
  // Back on the login that offers two, so a change can be made from this stage.
  await toPicker(p);
  const own = await p.$('[data-espick="own"]');
  ok(!!own, "there is an own-question route");
  if (own) {
    await own.click(); await p.waitForTimeout(400);
    const o = await subjectsOnScreen(p);
    ok(!!(await p.$("#esq")), "the own-question form is on screen");
    ok(agrees(o), "its subject agrees with the header: header=" + JSON.stringify(o.header) + " picker=" + JSON.stringify(o.pickerText));
    // and it still agrees after a change made from THIS stage
    const other = o.options.map(x => x.v).filter(Boolean).find(k => k !== o.picker);
    ok(!!other, "there is another subject to move to from here: " + JSON.stringify(other));
    if (other) {
      await p.selectOption("#essubject", other); await p.waitForTimeout(400);
      const o2 = await subjectsOnScreen(p);
      ok(o2.picker === other, "changing subject from the own-question stage commits: " + o2.picker);
      ok(agrees(o2), "and both labels move together: header=" + JSON.stringify(o2.header) + " picker=" + JSON.stringify(o2.pickerText));
    }
  }

  // ---- 5. narrow, where the subject heading lives inside the menu ---------
  console.log("--- 5. the responsive menu carries the same subject");
  // Section 4 left the picker on a current subject, and a legacy subject is not
  // offered once it has been left. Re-enter as the login that has two, then
  // narrow: the menu heading has to agree with the form at this width as well.
  await toPicker(p);
  await p.setViewportSize({ width: 390, height: 900 }); await p.waitForTimeout(400);
  const menu = await p.$("#esmenu");
  ok(!!menu, "there is a menu at 390px");
  if (menu) {
    await menu.click(); await p.waitForTimeout(350);
    const m = await subjectsOnScreen(p);
    ok(agrees(m), "the subject in the open menu agrees with the form: header=" +
      JSON.stringify(m.header) + " picker=" + JSON.stringify(m.pickerText));
    // Change it while the menu is the thing showing the label.
    const other = m.options.map(x => x.v).filter(Boolean).find(k => k !== m.picker);
    ok(!!other, "there is another subject to move to at narrow width: " + JSON.stringify(other));
    if (other) {
      await p.keyboard.press("Escape"); await p.waitForTimeout(250);
      await p.selectOption("#essubject", other); await p.waitForTimeout(400);
      await p.click("#esmenu"); await p.waitForTimeout(350);
      const m2 = await subjectsOnScreen(p);
      ok(m2.picker === other, "the change commits at narrow width too: " + m2.picker);
      ok(agrees(m2), "and the menu heading followed it: header=" + JSON.stringify(m2.header));
      await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    }
  }

  // ---- 6. it survives the walk into the writing --------------------------
  console.log("--- 6. and it is still the same subject inside the writing");
  await p.setViewportSize({ width: 1500, height: 1100 }); await p.waitForTimeout(300);
  await toPicker(p);
  await p.selectOption("#essubject", "business_studies"); await p.waitForTimeout(400);
  const before = await subjectsOnScreen(p);
  await p.$$eval('[data-espick="own"]', es => es[0] && es[0].click()); await p.waitForTimeout(400);
  await p.fill("#esq", "Explain how one operations strategy affects the cost of production.").catch(() => {});
  await p.waitForTimeout(200);
  const start = await p.$("#esstart");
  ok(!!start, "the own question can be started");
  if (start) {
    await start.click(); await p.waitForTimeout(700);
    const inside = await p.evaluate(() => {
      const bar = document.querySelector(".qp-subj");
      return bar ? bar.textContent.split("·")[0].trim() : null;
    });
    ok(inside === before.pickerText, "the writing surface names the subject the student chose: " +
      JSON.stringify(inside) + " vs " + JSON.stringify(before.pickerText));
  }

  console.log("");
  console.log(pass + " passed, " + fail + " failed");
  await b.close();
  process.exit(fail ? 1 : 0);
})();
