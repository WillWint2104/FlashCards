// SUBJECT LIFECYCLE, AND THE CONTEXT A STUDENT IS SHOWN.
//
// WHY IT EXISTS.
//
// One word was doing two jobs. "Active" meant both "the registry resolves it"
// and "the picker offers it", and because nothing told them apart, a change
// meaning to fix the second undid a locked product decision about the first.
// Ancient History went out of the picker, came back as a normal subject, and
// went out again across three passes. There are three states now and this file
// is what stops a fourth flip:
//
//   REGISTERED   esSubjectContent resolves it. Stored attempts, the /^11Anc/
//                routing rule and the worked-example set all need this.
//   SELECTABLE   offered in the current Essay Practice picker.
//   LEGACY       registered and not selectable.
//
// And the rule the original defect broke - one screen said ECONOMICS while
// another said Ancient History, and neither was reading the committed subject:
//
//   before a subject is committed, nothing pretends one is current
//   once an attempt exists, every visible label follows THE ATTEMPT
//   reopening from My essays follows the STORED attempt's subject
//   changing the picker cannot mutate an attempt that already exists
//   no label from the subject before is left on screen
//   and the responsive menu says the same thing as the form
const { chromium, T } = require("./env");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };

const LEGACY = "ancient_history";

// Every place a subject is named, plus what the picker offers as against what it
// merely shows. A disabled option is shown and not offered, and the difference is
// the whole lifecycle.
const ctxOf = page => page.evaluate(() => {
  const sel = document.getElementById("essubject");
  const bar = document.querySelector(".qp-subj");
  const opts = sel ? [...sel.options] : [];
  return {
    hasPicker: !!sel,
    offered: opts.filter(o => o.value && !o.disabled).map(o => o.value),
    shown: opts.filter(o => o.value).map(o => ({ v: o.value, t: o.text, disabled: o.disabled })),
    committed: sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].value : null,
    committedText: sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : null,
    header: bar ? bar.textContent.split("·")[0].trim() : null,
    writing: !!document.querySelector("#esline"),
  };
});

async function loginAs(page, code) {
  await page.goto(T);
  await page.waitForSelector(".navtab", { timeout: 8000 });
  await page.evaluate(c => {
    try {
      const raw = JSON.parse(localStorage.getItem("marginal.trial.v1") || "{}");
      raw.code = c; localStorage.setItem("marginal.trial.v1", JSON.stringify(raw));
    } catch (e) { /* private mode */ }
  }, code);
  await page.reload();
  await page.waitForSelector(".navtab", { timeout: 8000 });
}
async function intoEssay(page) {
  await page.$$eval(".navtab", es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await page.waitForSelector("#essubject", { timeout: 8000 });
  await page.waitForTimeout(300);
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } });
  const p = await ctx.newPage();
  await p.route(/workers\.dev/, r => r.abort());

  // ---- 1. the three states are distinguishable from outside ---------------
  console.log("--- 1. registered, selectable and legacy are three different things");
  await loginAs(p, "12Ec126");
  await intoEssay(p);
  const c1 = await ctxOf(p);
  console.log("    offered:", JSON.stringify(c1.offered));
  const registered = await p.evaluate(() => {
    const subs = (window.__esSubjects && window.__esSubjects()) || {};
    return Object.keys(subs).map(k => ({ key: k, legacy: !!subs[k].legacy }));
  });
  console.log("    registered:", JSON.stringify(registered));
  ok(registered.length >= 3, "three packages are registered: " + registered.length);
  ok(registered.some(r => r.key === LEGACY && r.legacy), "Ancient History is marked legacy in the registry");
  ok(c1.offered.indexOf(LEGACY) < 0, "and is not offered to a student who is not in it: " + JSON.stringify(c1.offered));
  ok(c1.shown.every(o => o.v !== LEGACY), "nor shown to them at all: " + JSON.stringify(c1.shown.map(o => o.v)));
  ok(c1.offered.indexOf("business_studies") >= 0 && c1.offered.indexOf("economics") >= 0,
    "the two current courses are offered: " + JSON.stringify(c1.offered));
  // Registered means resolvable. A legacy package that stopped resolving would
  // break every stored attempt written in it.
  const resolves = await p.evaluate(k => {
    const subs = (window.__esSubjects && window.__esSubjects()) || {};
    const s = subs[k];
    return s ? { questions: (s.questions || []).length, criteria: (s.markingCriteria || []).length } : null;
  }, LEGACY);
  ok(resolves && resolves.questions === 6 && resolves.criteria === 4,
    "the legacy package still resolves in full: " + JSON.stringify(resolves));

  // ---- 2. a student already in it is told the truth ----------------------
  console.log("--- 2. a student routed into the legacy subject sees THEIR subject");
  await loginAs(p, "11Anc1");
  await intoEssay(p);
  const c2 = await ctxOf(p);
  console.log("    shown:", JSON.stringify(c2.shown));
  ok(c2.committed === LEGACY, "the committed subject is the legacy one: " + JSON.stringify(c2.committed));
  ok(c2.header === "Ancient History", "and the header says so: " + JSON.stringify(c2.header));
  ok(c2.offered.indexOf(LEGACY) < 0, "it is still not OFFERED: " + JSON.stringify(c2.offered));
  const legacyOpt = c2.shown.find(o => o.v === LEGACY);
  ok(legacyOpt && legacyOpt.disabled, "the option is shown disabled rather than offered");
  ok(legacyOpt && /not a current course/i.test(legacyOpt.t),
    "and says what it is: " + JSON.stringify(legacyOpt && legacyOpt.t));
  ok(c2.offered.length >= 1, "the current courses are still reachable from here: " + JSON.stringify(c2.offered));

  // ---- 3. before commit, nothing pretends a subject is current -----------
  console.log("--- 3. an unresolvable routed subject names nothing");
  await loginAs(p, "99Zz9");                  // matches no routing rule
  await intoEssay(p);
  const c3 = await ctxOf(p);
  ok(c3.committed === "" || c3.committed === null,
    "no subject is committed: " + JSON.stringify(c3.committed));
  ok(!c3.header, "and no subject is named anywhere: " + JSON.stringify(c3.header));
  ok(c3.committedText === "Choose a subject", "the picker asks: " + JSON.stringify(c3.committedText));

  // ---- 4. once an attempt exists, the labels follow the attempt ----------
  console.log("--- 4. the visible context follows the attempt, not the picker");
  await loginAs(p, "12Ec126");
  await intoEssay(p);
  await p.selectOption("#essubject", "business_studies"); await p.waitForTimeout(400);
  await p.$$eval('[data-espick="list"]', es => es[0] && es[0].click()); await p.waitForTimeout(400);
  await p.$$eval(".qp-row", es => es[0] && es[0].click()); await p.waitForTimeout(400);
  await p.$$eval('[data-espick="preview"]', es => es[0] && es[0].click()).catch(() => {});
  await p.waitForTimeout(300);
  await p.click("#esstart"); await p.waitForTimeout(700);
  const inAttempt = await ctxOf(p);
  ok(inAttempt.writing, "an attempt was started");
  ok(inAttempt.header === "Business Studies", "the workspace names the attempt's subject: " + JSON.stringify(inAttempt.header));

  console.log("--- 4b. and the picker cannot re-point it");
  // Back to setup, change the picker, and read what the attempt still says it is.
  await p.click("#esx"); await p.waitForTimeout(500);
  await p.selectOption("#essubject", "economics"); await p.waitForTimeout(450);
  const afterSwitch = await ctxOf(p);
  ok(afterSwitch.committed === "economics", "the picker moved: " + afterSwitch.committed);
  const stored = await p.evaluate(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
      const drafts = Object.values(raw).flatMap(bk => (bk && bk.drafts) || []);
      const d = drafts.find(x => (x.questionSubject || x.subject) === "business_studies") || drafts[0];
      return d ? { subject: d.subject, questionSubject: d.questionSubject } : null;
    } catch (e) { return null; }
  });
  ok(stored && stored.subject === "business_studies",
    "the attempt is still bound to the subject it was written in: " + JSON.stringify(stored));
  ok(stored && stored.questionSubject === "business_studies",
    "and still records its question's package: " + JSON.stringify(stored && stored.questionSubject));

  // ---- 5. reopening follows the STORED attempt --------------------------
  console.log("--- 5. reopening from My essays follows the stored attempt");
  await p.click('.qp-nav [data-esnav="essays"]').catch(() => {});
  await p.waitForTimeout(500);
  const listed = await p.$$eval(".qp-essay", es => es.length).catch(() => 0);
  console.log("    essays listed under the current subject:", listed);
  // Attempts are bagged per subject, so the Business Studies attempt is not in
  // the Economics list. That IS the binding working - and it is why the picker
  // has to go back before Resume.
  await p.click('.qp-nav [data-esnav="back"]').catch(() => {});
  await p.waitForTimeout(400);
  await p.selectOption("#essubject", "business_studies").catch(() => {});
  await p.waitForTimeout(400);
  await p.click('.qp-nav [data-esnav="essays"]').catch(() => {});
  await p.waitForTimeout(500);
  const resume = await p.$("[data-esresume]");
  ok(!!resume, "the attempt is listed under its own subject");
  if (resume) {
    await resume.click(); await p.waitForTimeout(800);
    const back = await ctxOf(p);
    ok(back.writing, "Resume reaches the writing");
    ok(back.header === "Business Studies",
      "and the reopened attempt names its own subject: " + JSON.stringify(back.header));
  }

  // ---- 6. the responsive menu says the same thing -----------------------
  console.log("--- 6. the narrow menu agrees with the form");
  // Reached explicitly, and asserted before anything is read off it: the previous
  // version read the picker from whichever screen happened to be showing and
  // reported a mismatch that was its own navigation, not the product's.
  // Setup remembers the stage it was left on, and it was left on My essays - so
  // #esx alone lands there, correctly, and there is no picker on that stage. The
  // Essay practice nav link is the way to the form.
  const toSetup = await p.$("#esx");
  if (toSetup) { await toSetup.click(); await p.waitForTimeout(600); }
  await p.click('.qp-nav [data-esnav="back"]').catch(() => {});
  await p.waitForTimeout(500);
  ok(!!(await p.$("#essubject")), "the setup page, with its picker, is on screen before the narrow check");
  await p.setViewportSize({ width: 390, height: 900 }); await p.waitForTimeout(600);
  const menu = await p.$("#esmenu");
  ok(!!menu, "there is a menu at 390px");
  if (menu) {
    await menu.click(); await p.waitForTimeout(350);
    const narrow = await ctxOf(p);
    ok(narrow.hasPicker, "the picker is present at this width");
    const opt = narrow.shown.find(o => o.v === narrow.committed);
    ok(!narrow.header || (opt && opt.t === narrow.header),
      "the menu's subject heading matches the form: menu=" + JSON.stringify(narrow.header) +
      " form=" + JSON.stringify(narrow.committedText));
    ok(narrow.offered.indexOf(LEGACY) < 0,
      "and the legacy subject is not offered at this width either: " + JSON.stringify(narrow.offered));
    await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  }
  await p.setViewportSize({ width: 1500, height: 1100 }); await p.waitForTimeout(300);

  console.log("");
  console.log(pass + " passed, " + fail + " failed");
  await b.close();
  process.exit(fail ? 1 : 0);
})();
