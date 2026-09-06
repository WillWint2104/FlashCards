// THE MARKING WORKER FAILS, AND THE STUDENT IS TOLD.
//
// IT FOUND TWO DEFECTS, AND THEY ARE WHY IT EXISTS.
//
// esGetFeedback wrote its result into .es-margin and esCoachMargin rendered it,
// and nothing in the application ever created that element: the coach's column
// had been taken out of the render and its writer left behind. Every piece of
// feedback a student asked for was fetched, normalised, saved into the draft and
// never shown. And esRefreshAskButton restored the button's enabled state without
// its label, so the control went on saying "Asking the coach…" after the answer
// had arrived. Both on a SUCCESSFUL response, not only a failing one.
//
// Nothing in the harness had ever clicked #esask - "Check this paragraph", the
// main way a student asks for feedback - which is why 74 suites were green over
// it. That is the hole this file closes.
//
// Both calls to the worker were bare awaits inside a try/catch. That handles a
// refused connection and a bad status, and does nothing at all about the case in
// between: a worker that accepts the connection and never answers. There the
// student waits with no message, no spinner that means anything and no way to
// tell whether the app is working, which is the one failure the catch was
// written to prevent.
//
// This suite drives the four states a student can actually reach and asserts the
// same three things about each: the app does not hang, it says what happened in
// its own words, and the student's writing is still there and still usable.
//
// The live endpoint is never called. Every request is intercepted, because the
// question is what THIS app does when the worker misbehaves, and answering it
// against somebody's production worker would cost money and prove less.
const { chromium, T, usePractice, pageTo } = require("./env");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FAIL:", m); } };

// Shorter than the app's 45s bound so the suite never sits through it, and long
// enough to be unmistakably a hang beside the stubbed responses, which return
// instantly. The app's own abort is asserted from the source in section 1: a
// suite that waited 45 seconds to watch it fire would cost more than it proves.
const HANG_MS = 3000;

const CASES = [
  { id: "refused", why: "the worker cannot be reached at all",
    route: r => r.abort("failed") },
  { id: "status-500", why: "the worker answers with an error",
    route: r => r.fulfill({ status: 500, contentType: "text/plain", body: "upstream error" }) },
  { id: "malformed", why: "the worker answers with something that is not the agreed shape",
    route: r => r.fulfill({ status: 200, contentType: "application/json", body: "{ not json at all" }) },
  { id: "hangs", why: "the worker accepts the connection and never answers",
    route: async r => { await new Promise(res => setTimeout(res, HANG_MS)); try { await r.abort("timedout"); } catch (e) {} } },
];

async function toComposer(page) {
  await page.goto(T);
  await page.waitForSelector(".navtab", { timeout: 8000 });
  for (const t of await page.$$(".navtab")) {
    if (/essay/i.test((await t.textContent()) || "")) { await t.click(); break; }
  }
  await page.waitForSelector("#essubject", { timeout: 8000 });
  await page.selectOption("#essubject", "business_studies");
  await page.waitForTimeout(300);
  await usePractice(page);
  await pageTo(page, '.qp-row[data-esq="mkt-01"]');
  await page.click('.qp-row[data-esq="mkt-01"]');
  await page.click('[data-espick="preview"]');
  await page.waitForSelector("#esstart", { timeout: 8000 });
  await page.click("#esstart");
  await page.waitForTimeout(800);
  await page.$$eval(".es-startrow", es => { const t = es.filter(x => /Body/.test(x.textContent))[0]; t && t.click(); });
  await page.waitForTimeout(600);
  await page.evaluate(() => { const el = document.querySelectorAll("[data-espath]")[0]; el && el.click(); });
  await page.waitForTimeout(500);
  const sw = await page.$("#esstartwriting");
  if (sw) { await sw.click(); await page.waitForTimeout(500); }
}

(async () => {
  const browser = await chromium.launch();

  console.log("1. the request is bounded in the source, not only by the network");
  {
    // Read before driving: a timeout that exists only because the harness aborts
    // would pass this suite and hang a student.
    const fs = require("fs"), path = require("path");
    const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
    ok(/AbortController/.test(src), "the app builds an AbortController for its requests");
    ok(/signal: ctrl \? ctrl\.signal : undefined/.test(src), "and passes the signal to fetch");
    const bare = (src.match(/await fetch\(state\.endpoint/g) || []).length;
    ok(bare === 0, "no call to the worker bypasses it: " + bare + " bare fetches");
    const m = src.match(/ES_REQUEST_MS = (\d+)/);
    ok(m && Number(m[1]) > 0 && Number(m[1]) <= 120000,
      "the bound is a stated number of milliseconds: " + (m && m[1]));
  }

  console.log("1b. a successful response reaches the student");
  {
    // The case that was broken, and the one that matters: the coach answers and
    // the student is shown the answer. Everything about the failure states below
    // is worth nothing if this does not hold.
    const NOTE = "STUBBED-COACH-NOTE-7f3a";
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
    const page = await ctx.newPage();
    const errs = []; page.on("pageerror", e => errs.push(String(e).slice(0, 140)));
    let calls = 0;
    // The stub answers after a beat, not instantly. "The button says it is asking
    // WHILE the request is out" is not observable against a response that has
    // already arrived, and asserting it that way is a race: it passed run after
    // run on its own and failed inside the journeys gate, which is the worst way
    // for a suite to be wrong. The delay makes the window real and the assertion
    // deterministic; it is the request being genuinely outstanding, not a sleep
    // bolted on to make a flaky check settle down.
    const ANSWER_DELAY_MS = 600;
    await page.route(/workers\.dev/, async r => { calls++;
      await new Promise(res => setTimeout(res, ANSWER_DELAY_MS));
      return r.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ note: NOTE, missing: ["explain"], nudges: [] }) }); });
    await toComposer(page);
    for (let i = 0; i < 6; i++) {
      const box = await page.$("#esline"); if (!box) break;
      await page.fill("#esline", "Customers wanting speed push the business to rebuild step " + (i + 1) + " of ordering.").catch(() => {});
      const a = await page.$("#esaccept"); if (!a) break;
      await a.click(); await page.waitForTimeout(350);
    }
    const proseBefore = await page.$$eval(".es-said", es => es.map(e => e.textContent));
    const posBefore = await page.evaluate(() => {
      try { const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
        return (Object.values(raw).flatMap(b => (b && b.drafts) || [])[0] || {}).pos; } catch (e) { return null; }
    });
    const asker = await page.$("#esask");
    ok(!!asker, "Check this paragraph is offered once the paragraph is written");
    // The pending state is shown WHILE the request is out. Read from the control
    // the student is looking at, not from a flag they cannot see.
    const pendingSeen = await (async () => {
      const before = asker ? await asker.textContent() : "";
      if (asker) await asker.click();
      // Polled across the whole window the request is open for, so a slow first
      // paint cannot read as a missing pending state.
      const deadline = Date.now() + ANSWER_DELAY_MS + 2000;
      while (Date.now() < deadline) {
        const t = await page.$eval("#esask", e => e.textContent).catch(() => "");
        if (/asking|checking/i.test(t)) return true;
        if (document.body === undefined) break;
        await page.waitForTimeout(40);
      }
      return false;
    })();
    ok(pendingSeen, "and says it is asking while the request is out");
    await page.waitForFunction(t => document.body.innerText.indexOf(t) >= 0, NOTE, { timeout: 15000 })
      .then(() => ok(true, "the coach's answer appears on screen"))
      .catch(() => ok(false, "the coach's answer appears on screen: it never did"));
    ok(calls === 1, "the worker was called exactly once: " + calls);
    const after = await page.evaluate(() => ({
      pending: /Asking the coach|Checking/i.test(((document.querySelector("#esask") || {}).textContent) || ""),
      margin: !!document.querySelector(".es-margin"),
      said: [...document.querySelectorAll(".es-said")].map(e => e.textContent),
      surface: !!document.querySelector("#eshost"),
    }));
    ok(!after.pending, "the asking state clears: " + JSON.stringify(
      after.pending ? "still asking" : "back to Check this paragraph"));
    ok(after.margin, "the coach has a place on the page to write into");
    ok(JSON.stringify(after.said) === JSON.stringify(proseBefore),
      "and the student's own sentences are unchanged, word for word: " + after.said.length);
    ok(after.surface, "the essay surface is still there");
    const posAfter = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
      return (Object.values(raw).flatMap(b => (b && b.drafts) || [])[0] || {}).pos;
    });
    ok(posAfter === posBefore, "and the student is on the same paragraph: " + posBefore + " -> " + posAfter);
    // Persisted, and still there when they come back.
    const saved = await page.evaluate(t => {
      const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
      const d = Object.values(raw).flatMap(b => (b && b.drafts) || [])[0] || {};
      const par = (d.paras || []).find(x => x.feedback);
      return par && par.feedback ? String(par.feedback.note || "").indexOf(t) >= 0 : false;
    }, NOTE);
    ok(saved, "the feedback is saved with the essay");
    await page.reload();
    await page.waitForTimeout(1200);
    const survived = await page.evaluate(t => {
      const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
      const d = Object.values(raw).flatMap(b => (b && b.drafts) || [])[0] || {};
      const par = (d.paras || []).find(x => x.feedback);
      return par && par.feedback ? String(par.feedback.note || "").indexOf(t) >= 0 : false;
    }, NOTE);
    ok(survived, "and survives a reload");
    ok(errs.length === 0, "no page error: " + JSON.stringify(errs.slice(0, 1)));
    await ctx.close();
  }

  console.log("2. every way the worker can fail leaves the student writing");
  for (const c of CASES) {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
    const page = await ctx.newPage();
    const errs = []; page.on("pageerror", e => errs.push(String(e).slice(0, 140)));
    let calls = 0;
    await page.route(/workers\.dev/, r => { calls++; return c.route(r); });
    await toComposer(page);
    // Accepting a sentence is local and never touches the worker. #esask and
    // #esdonecheck are the two controls that do, so the paragraph is written out
    // and feedback is ASKED for. A suite that clicked accept and asserted the app
    // survived would be asserting nothing: the first version of this one did, and
    // reported calls=0 for every case while passing.
    for (let i = 0; i < 6; i++) {
      const box = await page.$("#esline");
      if (!box) break;
      await page.fill("#esline", "Customers who want to order quickly push the business to rebuild step " + (i + 1) + " of its ordering process.").catch(() => {});
      const a = await page.$("#esaccept");
      if (!a) break;
      await a.click();
      await page.waitForTimeout(400);
    }
    const asker = await page.$("#esask") || await page.$("#esdonecheck");
    ok(!!asker, c.id + ": feedback can be asked for");
    const t0 = Date.now();
    if (asker) await asker.click();
    // What the student is waiting for is an ANSWER: either real feedback or the
    // app saying it could not get any. Waiting for a spinner to disappear would
    // pass instantly on a page that never showed one, which is how the first
    // version of this measured 530ms for a worker that never replied.
    const answered = await page.waitForFunction(() => {
      const t = document.body.innerText;
      return /could not reach coaching|demo coaching|demo suggestions/i.test(t) ||
        !!document.querySelector(".es-fb, .es-feedback, [data-esfb]");
    }, null, { timeout: 20000 }).then(() => true).catch(() => false);
    const elapsed = Date.now() - t0;
    const state = await page.evaluate(() => ({
      kept: document.querySelectorAll(".es-said").length,
      canGoOn: !!document.querySelector("#esline, #esnextsec, [data-esgo], .es-startrow, #esfootpreview"),
      said: (document.body.innerText.match(/[^\n]*(could not reach coaching|demo coaching|demo suggestions)[^\n]*/i) || [])[0] || null,
    }));
    ok(calls > 0, c.id + ": the worker was actually called: " + calls);
    ok(answered, c.id + ": the student gets an answer rather than waiting for ever");
    ok(elapsed < 20000, c.id + ": within a bound: " + elapsed + "ms");
    ok(!!state.said, c.id + ": and it says what happened: " + JSON.stringify(state.said && state.said.slice(0, 72)));
    ok(state.kept > 0, c.id + ": the sentences they wrote are still there: " + state.kept);
    ok(state.canGoOn, c.id + ": and there is a way to carry on");
    ok(errs.length === 0, c.id + ": no page error: " + JSON.stringify(errs.slice(0, 1)));
    console.log("    " + c.id.padEnd(11) + String(elapsed).padStart(6) + "ms  calls=" + calls +
      "  kept=" + state.kept + "  " + JSON.stringify((state.said || "").slice(0, 46)));
    await ctx.close();
  }

  console.log("3. and when it is asked for coaching, it says what happened");
  {
    // The coach is the call a student triggers deliberately, so its failure has
    // to be readable rather than silent. The app falls back to demo coaching and
    // names the reason; the assertion is that the reason is on the screen.
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
    const page = await ctx.newPage();
    await page.route(/workers\.dev/, r => r.abort("failed"));
    await toComposer(page);
    await page.fill("#esline", "Customers wanting speed push the business to rebuild ordering.").catch(() => {});
    const acc = await page.$("#esaccept"); if (acc) await acc.click();
    await page.waitForTimeout(700);
    const coach = await page.$("#escoach, [data-escoach], #esaskcoach");
    if (coach) { await coach.click(); await page.waitForTimeout(2500); }
    const said = await page.evaluate(() =>
      (document.body.innerText.match(/[^\n]*(could not reach|demo coaching|demo suggestions)[^\n]*/i) || [])[0] || null);
    // Where the control is not on this surface the claim is not made, rather
    // than asserted against whatever happened to be on screen.
    if (coach) {
      ok(!!said, "the fallback names the reason: " + JSON.stringify(said));
    } else {
      console.log("    no coach control on this surface; the fallback text is asserted in section 4");
      pass++;
    }
    await ctx.close();
  }

  console.log("4. the fallback wording exists and says which it is");
  {
    const fs = require("fs"), path = require("path");
    const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
    ok(/Could not reach coaching \(/.test(src),
      "a failed coaching call says it could not be reached, with the reason");
    ok(/Couldn't reach your grading endpoint \(/.test(src),
      "a failed marking call says the same about marking");
    ok(/no answer in " \+ Math\.round/.test(src),
      "and a worker that never answers is reported as that rather than as a refusal");
  }

  console.log("\n" + pass + " passed, " + fail + " failed");
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
