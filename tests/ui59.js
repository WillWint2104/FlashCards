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

// The app re-renders synchronously on a change, so waiting for two frames is
// waiting for the render rather than guessing how long it takes. This replaced a
// flat 350-400ms sleep after every selectOption and every click in this file,
// which was most of what the suite cost the checkpoint tier.
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

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

// Re-entering Essay Practice without reloading the page. Leaving and coming back
// is a route a student has, and esOpen re-reads the routed subject on the way in.
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
  // Two honest states, and no third. Either the student is in a subject, and every
  // label says the same one; or they are not, the picker says so in a real option,
  // and no label names a subject at all. This fixture's class code routes to
  // "economics", which is now a registered package, so it is the first.
  ok(s.picker !== null, "the picker has a selected option");
  ok(s.options.some(o => o.v === s.picker), "and it is one of the options it offers: " + JSON.stringify(s.picker));
  ok(agrees(s), "the header agrees with it: header=" + JSON.stringify(s.header) + " picker=" + JSON.stringify(s.pickerText));
  ok(s.picker !== "" || !s.header,
    "with no subject chosen, nothing on screen names one: " + JSON.stringify(s.header));
  // The rule is not "Economics must not appear" - Economics is a registered Long
  // Response package now and naming it is correct. The rule is that a name on
  // screen must belong to a package the application actually has: a label is
  // never invented from a routing rule for a key nothing resolves.
  const named = await p.evaluate(() => {
    const bar = document.querySelector(".qp-subj");
    if (!bar) return { shown: null, registered: true };
    const want = bar.textContent.split("·")[0].trim();
    const subs = (window.__esSubjects && window.__esSubjects()) || {};
    return { shown: want, registered: Object.keys(subs).some(k => (subs[k].label || "") === want) };
  });
  ok(named.registered, "any subject named on screen is one the application has a package for: " +
    JSON.stringify(named.shown));
  ok(s.picker !== "" || s.pickerText === "Choose a subject",
    "and the picker says so rather than showing whichever option is first: " + JSON.stringify(s.pickerText));

  // ---- 2. changing it moves everything ------------------------------------
  console.log("--- 2. changing the subject moves every label at once");
  // Every registered subject is offered, so the labels can be watched moving
  // between any two of them. The placeholder is not a subject and is not one.
  const all = s.options.map(o => o.v).filter(Boolean);
  console.log("    the picker offers:", JSON.stringify(all));
  ok(all.length >= 2, "there is more than one subject to move between: " + JSON.stringify(all));
  for (const want of all) {
    await p.selectOption("#essubject", want);
    await settled(p);
    const t = await subjectsOnScreen(p);
    ok(t.picker === want, "choosing " + want + " commits it: " + t.picker);
    ok(agrees(t), "and every label on screen says so: header=" + JSON.stringify(t.header) + " picker=" + JSON.stringify(t.pickerText));
  }

  // ---- 3. nothing carries over --------------------------------------------
  console.log("--- 3. the previous subject is not left behind anywhere");
  // Move to the second subject, then back to the first, reading the page each
  // time. Moving BACK is what catches a stale label: one hop can look right by
  // luck, two cannot.
  await p.selectOption("#essubject", all[1]); await settled(p);
  const second = await subjectsOnScreen(p);
  ok(second.picker === all[1], "moved to the second subject: " + second.picker);
  ok(agrees(second), "labels agree there: " + JSON.stringify(second.header));
  await p.selectOption("#essubject", all[0]); await settled(p);
  const back = await subjectsOnScreen(p);
  ok(back.picker === all[0], "back on the first: " + back.picker);
  ok(agrees(back), "and no label still says the one before it: " + JSON.stringify(back.header));
  ok(back.header !== second.header, "the header actually changed: " +
    JSON.stringify([second.header, back.header]));
  ok(back.options.length === second.options.length,
    "and every subject is still offered after moving between them: " +
    JSON.stringify(back.options.map(o => o.v)));

  // ---- 4. the own-question route, which is where it was seen --------------
  console.log("--- 4. the same, in the own-question flow");
  // A package with no bundled bank opens ON the own-question stage, so the route
  // to it is not rendered - there is nowhere to go. Either way the form must be
  // reachable, which is what this section is about.
  const own = await p.$('[data-espick="own"]');
  if (own) { await own.click(); await settled(p); }
  ok(!!(await p.$("#esq")), "the own-question form is reachable");
  {
    const o = await subjectsOnScreen(p);
    ok(agrees(o), "its subject agrees with the header: header=" + JSON.stringify(o.header) + " picker=" + JSON.stringify(o.pickerText));
    // and it still agrees after a change made from THIS stage
    const other = o.options.map(x => x.v).filter(Boolean).find(k => k !== o.picker);
    ok(!!other, "there is another subject to move to from here: " + JSON.stringify(other));
    if (other) {
      await p.selectOption("#essubject", other); await settled(p);
      const o2 = await subjectsOnScreen(p);
      ok(o2.picker === other, "changing subject from the own-question stage commits: " + o2.picker);
      ok(agrees(o2), "and both labels move together: header=" + JSON.stringify(o2.header) + " picker=" + JSON.stringify(o2.pickerText));
    }
  }

  // ---- 5. narrow, where the subject heading lives inside the menu ---------
  console.log("--- 5. the responsive menu carries the same subject");
  await p.setViewportSize({ width: 390, height: 900 }); await settled(p);
  const menu = await p.$("#esmenu");
  ok(!!menu, "there is a menu at 390px");
  if (menu) {
    await menu.click(); await settled(p);
    const m = await subjectsOnScreen(p);
    ok(agrees(m), "the subject in the open menu agrees with the form: header=" +
      JSON.stringify(m.header) + " picker=" + JSON.stringify(m.pickerText));
    // Change it while the menu is the thing showing the label.
    const other = m.options.map(x => x.v).filter(Boolean).find(k => k !== m.picker);
    ok(!!other, "there is another subject to move to at narrow width: " + JSON.stringify(other));
    if (other) {
      await p.keyboard.press("Escape"); await settled(p);
      await p.selectOption("#essubject", other); await settled(p);
      await p.click("#esmenu"); await settled(p);
      const m2 = await subjectsOnScreen(p);
      ok(m2.picker === other, "the change commits at narrow width too: " + m2.picker);
      ok(agrees(m2), "and the menu heading followed it: header=" + JSON.stringify(m2.header));
      await p.keyboard.press("Escape"); await p.waitForTimeout(200);
    }
  }

  // ---- 6. it survives the walk into the writing --------------------------
  console.log("--- 6. and it is still the same subject inside the writing");
  await p.setViewportSize({ width: 1500, height: 1100 }); await settled(p);
  await toPicker(p);
  await p.selectOption("#essubject", "business_studies"); await settled(p);
  const before = await subjectsOnScreen(p);
  await p.$$eval('[data-espick="own"]', es => es[0] && es[0].click()); await settled(p);
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
