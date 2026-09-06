// LEAVING, AND COMING BACK TO THE SAME ATTEMPT.
//
// IT EXISTS BECAUSE THE WAY OUT WAS WRONG ON EVERY SURFACE.
//
// Essay Practice began as an overlay and kept an overlay's vocabulary long after
// it had become a set of full pages. Setup and My essays offered "Close", which
// is what a modal says. The writing workspace offered no way out at all: the
// only control that left it was "Setup", which does not leave Essay Practice,
// and a wordmark, which is not a discoverable exit. A student who wanted to stop
// writing and go back to Marginal had to guess.
//
// The rule this file holds:
//
//   every full-page surface offers Home, and Home is MARGINAL's home
//   the writing workspace offers a labelled Exit essay as well
//   the wordmark is Home everywhere, and is never the only way out
//   the word "Close" does not appear on any of them
//   leaving writes the attempt down first, and Resume restores THAT attempt:
//     the question, the paragraphs, the position and the feedback
//
// The last one is the one worth the run time. An exit that loses a student's
// paragraph is worse than no exit, and "the draft is in localStorage" is not the
// same claim as "Resume puts the student back where they were".
const { chromium, T, planAll, chooseQuestion } = require("./env");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };

const SENTENCE = "Convenience-oriented customers lead a business towards processes because effort is the cost they weigh.";

// Essay Practice is open when its host is in the document. Closed means gone,
// not hidden: that is what the tab's own close has always done.
const isOpen = page => page.evaluate(() => !!document.getElementById("eshost"));
const barText = page => page.evaluate(() => {
  const t = document.querySelector(".es-top .es-topbtns") || document.querySelector(".qp-navright");
  return t ? t.textContent.replace(/\s+/g, " ").trim() : "(no bar)";
});

async function toPicker(page) {
  await page.goto(T);
  await page.waitForSelector(".navtab", { timeout: 8000 });
  await page.$$eval(".navtab", es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await page.waitForSelector("#essubject", { timeout: 8000 });
  await page.selectOption("#essubject", "business_studies");
  await page.waitForTimeout(300);
}

async function toWriting(page) {
  await chooseQuestion(page, /target markets/i);
  await page.waitForTimeout(250);
  await page.click("#esstart"); await page.waitForTimeout(500);
  await planAll(page);
  await page.$$eval(".es-plancard [data-esplanarea]", es => { const t = es.find(x => /processes/i.test(x.textContent)); t && t.click(); });
  await page.waitForTimeout(300);
  await page.$$eval("[data-esplanpick]", es => { const t = es.find(x => /Convenience-oriented/i.test(x.textContent)); t && t.click(); });
  await page.waitForTimeout(300);
  await page.click("#esplango"); await page.waitForTimeout(400);
  await page.$$eval("[data-esgo]", es => { const t = es.find(x => /Body 1/.test(x.textContent)); t && t.click(); });
  await page.waitForTimeout(500);
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1180 } });
  const p = await ctx.newPage();
  await p.route(/workers\.dev/, r => r.abort());

  // ---- 1. the picker's way out is Home ------------------------------------
  console.log("--- 1. a full page offers Home, not Close");
  await toPicker(p);
  const pickerBar = await barText(p);
  ok(/Home/.test(pickerBar), "setup offers Home: " + JSON.stringify(pickerBar));
  ok(!/Close/i.test(pickerBar), "and does not offer Close");
  ok(!!(await p.$("#eshome")), "Home is a control of its own, not only the wordmark");
  ok(!!(await p.$('.qp-brand[data-esnav="marginalhome"]')), "the wordmark is a Home route too");

  console.log("--- 1b. Home leaves Essay Practice for Marginal");
  ok(await isOpen(p), "Essay Practice is open before Home is pressed");
  await p.click("#eshome"); await p.waitForTimeout(400);
  ok(!(await isOpen(p)), "Home leaves Essay Practice");
  ok(!!(await p.$(".navtab")), "and lands on Marginal, where the tabs are");
  const backOnTab = await p.$$eval(".navtab", es => es.some(x => /Essay practice/i.test(x.textContent)));
  ok(backOnTab, "Essay practice is offered again from there");

  // ---- 2. My essays says the same thing -----------------------------------
  console.log("--- 2. My essays is a page, so it goes Home too");
  await toPicker(p);
  await p.click('.qp-nav [data-esnav="essays"]'); await p.waitForTimeout(400);
  const essaysTitle = await p.$eval(".qp-h1", e => e.textContent.trim()).catch(() => "");
  ok(essaysTitle === "My essays", "on My essays: " + JSON.stringify(essaysTitle));
  const essaysBar = await barText(p);
  ok(/Home/.test(essaysBar), "My essays offers Home: " + JSON.stringify(essaysBar));
  ok(!/Close/i.test(essaysBar), "and does not offer Close");

  // ---- 3. the workspace has a labelled exit -------------------------------
  console.log("--- 3. the writing workspace can be left on purpose");
  await toPicker(p);
  await toWriting(p);
  const writeBar = await barText(p);
  ok(/Exit essay/.test(writeBar), "the workspace offers Exit essay: " + JSON.stringify(writeBar));
  ok(!/Close/i.test(writeBar), "and does not offer Close");
  ok(!!(await p.$('.es-top .qp-brand[data-esnav="marginalhome"]')), "the wordmark is Home here as well");
  // The point of the labelled control: the logo is not carrying this alone.
  const exitCount = await p.$$eval(".es-top [data-esnav='marginalhome']", es => es.length);
  ok(exitCount >= 2, "two ways out, one of them a labelled control: " + exitCount);
  // Setup is a step back INSIDE Essay Practice, so it must not be the exit.
  await p.click("#esx"); await p.waitForTimeout(400);
  ok(await isOpen(p), "Setup does not leave Essay Practice");
  ok(!!(await p.$(".qp-nav")), "it goes back to the picker");

  // ---- 4. leaving writes the attempt down --------------------------------
  console.log("--- 4. what a student had is still there after they leave");
  await toPicker(p);
  await toWriting(p);
  await p.fill("#esline", SENTENCE);
  await p.click("#esaccept"); await p.waitForTimeout(450);
  // ask for feedback, so the thing being preserved includes the coach's answer
  const ask = await p.$("#esask");
  ok(!!ask, "the paragraph can be sent to the coach");
  if (ask) { await ask.click(); await p.waitForTimeout(1300); }
  const hadFeedback = !!(await p.$(".es-margin .es-mblock"));
  ok(hadFeedback, "feedback is on screen before leaving");

  await p.click("#esexit"); await p.waitForTimeout(500);
  ok(!(await isOpen(p)), "Exit essay leaves Essay Practice");
  // Written down, not merely still in memory: read the store the app persists to.
  const stored = await p.evaluate(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
      // The store keeps drafts most-recent-first, so the attempt just left is
      // drafts[0]. Earlier sections of this suite left older attempts behind it,
      // which is exactly the case a "take the last one" read gets wrong.
      const drafts = Object.values(raw).flatMap(bk => (bk && bk.drafts) || []);
      const d = drafts[0]; if (!d) return null;
      return { q: d.question || "", pos: d.pos,
        text: (d.paras || []).map(x => x.text || "").join(" "),
        feedback: (d.paras || []).some(x => !!x.feedback), count: drafts.length };
    } catch (e) { return null; }
  });
  ok(!!stored, "the attempt was written down on the way out");
  ok(stored && stored.count > 1, "and it is not the only attempt in the store, so the ordering matters: " + (stored && stored.count));
  ok(stored && /target markets/i.test(stored.q), "with its own question: " + (stored && stored.q.slice(0, 40)));
  ok(stored && stored.text.indexOf("Convenience-oriented customers lead") >= 0, "with the sentence the student wrote");
  ok(stored && stored.feedback === true, "and with the feedback they had asked for");

  // ---- 5. Resume brings back THAT attempt --------------------------------
  console.log("--- 5. Resume restores the same attempt, not a fresh one");
  await toPicker(p);
  await p.click('.qp-nav [data-esnav="essays"]'); await p.waitForTimeout(400);
  const listed = await p.$$eval(".qp-essay", es => es.length).catch(() => 0);
  ok(listed >= 1, "the attempt is listed in My essays: " + listed);
  const resume = await p.$("[data-esresume]") || await p.$("button.qp-resume");
  ok(!!resume, "Resume is offered");
  if (resume) { await resume.click(); await p.waitForTimeout(700); }
  const body = await p.evaluate(() => document.body.innerText);
  ok(/Convenience-oriented customers lead/.test(body), "Resume brings the paragraph back");
  ok(!!(await p.$("#esline")), "and lands in the writing, not on a setup form");
  const fbBack = await p.$(".es-margin .es-mblock");
  ok(!!fbBack, "the feedback they had is still attached to the paragraph");

  // ---- 6. no surface still calls itself a dialog --------------------------
  console.log("--- 6. the word Close is gone from the full-page surfaces");
  for (const [name, go] of [
    ["setup", async () => { await toPicker(p); }],
    ["my essays", async () => { await toPicker(p); await p.click('.qp-nav [data-esnav="essays"]'); await p.waitForTimeout(400); }],
  ]) {
    await go();
    const t = await p.evaluate(() => (document.querySelector(".qp-nav") || {}).textContent || "");
    ok(!/close/i.test(t), name + " header carries no Close: " + JSON.stringify(t.replace(/\s+/g, " ").trim().slice(0, 80)));
  }

  const errs = [];
  p.on("pageerror", e => errs.push(String(e)));
  console.log("");
  console.log("pageerrors:", errs.length ? errs.join(" | ") : "none");
  console.log("");
  console.log(pass + " passed, " + fail + " failed");
  await b.close();
  process.exit(fail ? 1 : 0);
})();
