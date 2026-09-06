// MY ESSAYS IS A DESTINATION, NOT A LABEL.
//
// The header carries two nav links. "My essays" was wired to the picker's own
// setup stage, so pressing it did exactly what "Back to setup" did, under a name
// that promised something else. A nav item that looks right and goes nowhere is
// worse than no nav item, because a student trusts it and loses their place.
//
// So this suite refuses to accept the styling as evidence. It presses the link
// and reads the page it lands on: the heading, the absence of the setup form,
// the list of essays the app itself saved, and the route back out of the empty
// state. Then it proves the press is navigation and nothing else, by building up
// real picker state - a subject, a directive filter, a chosen question, changed
// settings - going to My essays, coming back, and finding all of it intact.
const { chromium, T, usePractice, pageTo } = require("./env");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FAIL:", m); } };

const nav = (page, re) => page.evaluate(src => {
  const r = new RegExp(src, "i");
  const b = [...document.querySelectorAll(".qp-navlink")].find(x => r.test(x.textContent));
  if (!b) return false; b.click(); return true;
}, re instanceof RegExp ? re.source : String(re));

const stageOf = page => page.evaluate(() => ({
  heading: ((document.querySelector(".qp-h1") || {}).textContent || "").trim(),
  rows: document.querySelectorAll(".qp-row").length,
  subjectField: !!document.querySelector("#essubject"),
  essays: document.querySelectorAll(".qp-essay").length,
  empty: !!document.querySelector(".qp-empty2"),
  // The page shell is part of the claim: a destination is a page, not a panel.
  header: !!document.querySelector(".qp-nav"),
  rail: !!document.querySelector(".qp-rail"),
  foot: !!document.querySelector(".qp-foot"),
  current: [...document.querySelectorAll(".qp-navlink.on")].map(x => x.textContent.trim()),
}));

async function toPicker(page) {
  await page.goto(T);
  await page.waitForSelector(".navtab", { timeout: 8000 });
  for (const t of await page.$$(".navtab")) {
    if (/essay/i.test((await t.textContent()) || "")) { await t.click(); break; }
  }
  await page.waitForSelector("#essubject", { timeout: 8000 });
  await page.selectOption("#essubject", "business_studies");
  await page.waitForTimeout(300);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const errs = [];
  ctx.on("page", pg => pg.on("pageerror", e => errs.push(String(e).slice(0, 200))));
  const page = await ctx.newPage();
  await page.route(/workers\.dev/, r => r.abort());

  console.log("1. the link lands on a page of its own, not on the setup form");
  await toPicker(page);
  const setup = await stageOf(page);
  ok(/Set up your essay/.test(setup.heading), "the picker opens on setup: " + JSON.stringify(setup.heading));
  ok(await nav(page, /my essays/i), "the header offers My essays");
  await page.waitForTimeout(250);
  const mine = await stageOf(page);
  ok(/My essays/.test(mine.heading), "pressing it lands on My essays: " + JSON.stringify(mine.heading));
  // The specific failure this suite exists for: it used to land back on setup.
  ok(!/Set up your essay/.test(mine.heading), "and not back on the setup page under a different name");
  ok(!mine.subjectField, "the setup form is not on it: " + mine.subjectField);
  ok(mine.rows === 0, "and neither is the question list: " + mine.rows);
  ok(mine.header && mine.rail && mine.foot, "it is a full page like the rest of the flow: "
    + JSON.stringify({ header: mine.header, rail: mine.rail, foot: mine.foot }));
  ok(mine.current.length === 1 && /My essays/.test(mine.current[0]),
    "and the header says which destination you are on: " + JSON.stringify(mine.current));

  console.log("2. with nothing saved it says so, and offers a real way on");
  ok(mine.empty, "an empty state is rendered rather than a blank page: " + mine.empty);
  ok(mine.essays === 0, "with no essay rows: " + mine.essays);
  const outOfEmpty = await page.evaluate(() => {
    const b = document.querySelector(".qp-empty2 [data-esnav]");
    if (!b) return null; b.click(); return b.textContent.trim();
  });
  ok(outOfEmpty, "the empty state carries a control out of it: " + JSON.stringify(outOfEmpty));
  await page.waitForTimeout(250);
  ok(/Set up your essay/.test((await stageOf(page)).heading), "which reaches setup");

  console.log("3. an essay the app actually saved is listed there");
  // Made through the real flow, not written into storage by the suite: the claim
  // is that this page shows the student's own work, so the work has to be theirs.
  await usePractice(page);
  await pageTo(page, '.qp-row[data-esq="mkt-01"]');
  await page.click('.qp-row[data-esq="mkt-01"]');
  await page.click('[data-espick="preview"]');
  await page.waitForSelector("#esstart", { timeout: 8000 });
  const started = await page.$eval(".qp-prevq", e => e.textContent.trim());
  await page.click("#esstart");
  await page.waitForTimeout(700);
  const saved = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
    return Object.values(raw).reduce((n, bag) => n + ((bag && bag.drafts) || []).length, 0);
  });
  ok(saved === 1, "starting a question saved one essay: " + saved);
  // Back to the picker the way a student gets there, then to My essays.
  await page.click("#esqchange");
  await page.waitForTimeout(300);
  ok(await nav(page, /my essays/i), "My essays is reachable from the picker again");
  await page.waitForTimeout(250);
  const withOne = await stageOf(page);
  ok(withOne.essays === 1, "the saved essay is listed: " + withOne.essays);
  ok(!withOne.empty, "and the empty state is gone: " + withOne.empty);
  const listed = await page.$eval(".qp-essayq", e => e.textContent.trim());
  ok(listed === started, "it is the question that was started, whole: " + JSON.stringify(listed));
  const acts = await page.$$eval(".qp-essay [data-esresume], .qp-essay [data-estemplate], .qp-essay [data-esdelete]",
    es => es.map(e => e.textContent.trim()));
  ok(acts.length === 3, "with its three controls on it: " + JSON.stringify(acts));

  console.log("4. Resume from that page reaches the writing, not a new essay");
  await page.click("[data-esresume]");
  await page.waitForTimeout(600);
  const resumed = await page.evaluate(() => ({
    picker: !!document.querySelector(".qp"),
    writing: !!document.querySelector("#eshost, #esline, .es-startrow, [data-espath]"),
    drafts: Object.values(JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}"))
      .reduce((n, bag) => n + ((bag && bag.drafts) || []).length, 0),
  }));
  ok(resumed.writing, "Resume opens the essay: " + JSON.stringify(resumed));
  ok(!resumed.picker, "and leaves the picker");
  ok(resumed.drafts === 1, "without making a second copy of it: " + resumed.drafts);

  console.log("5. going there and back changes nothing a student set up");
  // The other half of the requirement. A nav press is navigation; it may not
  // quietly clear a filter, a selection, a page or a setting on the way.
  const p2 = await ctx.newPage();
  await p2.route(/workers\.dev/, r => r.abort());
  await toPicker(p2);
  // The settings live on the setup stage, so they are set there before the walk.
  // They are state a student changed, and a nav press may not lose them.
  await p2.evaluate(() => {
    const d = document.querySelector(".qp-opts"); if (d) d.open = true;
    const m = document.querySelector("#esmarks");
    if (m) { m.value = "17"; m.dispatchEvent(new Event("input", { bubbles: true })); }
  });
  await p2.waitForTimeout(200);
  await usePractice(p2);
  await p2.evaluate(() => {
    const d = [...document.querySelectorAll("[data-essetupdir]")]
      .find(x => /explain/i.test(x.textContent) && x.dataset.essetupdir);
    d && d.click();
  });
  await p2.waitForTimeout(250);
  // fin-02 deliberately: it authors no mark value, so the student's own setting
  // is the only thing that can be holding the number. Choosing a question that
  // DOES author marks adopts them, which is correct and is pinned below, but it
  // would hide whether navigation lost the setting.
  await p2.evaluate(() => { const r = document.querySelector('.qp-row[data-esq="fin-02"]'); r && r.click(); });
  await p2.waitForTimeout(250);
  const before = await p2.evaluate(() => ({
    stage: ((document.querySelector(".qp-h1") || {}).textContent || "").trim(),
    subject: (document.querySelector("#essubject") || {}).value || null,
    dir: [...document.querySelectorAll("[data-essetupdir].on")].map(x => x.dataset.essetupdir),
    chosen: ((document.querySelector(".qp-row.on") || {}).dataset || {}).esq || null,
    rail: ((document.querySelector(".qp-rcq") || {}).textContent || "").trim(),
    rows: document.querySelectorAll(".qp-row").length,
  }));
  ok(before.chosen && before.dir.length === 1 && before.rows > 0,
    "state to lose: " + JSON.stringify(before));

  ok(await nav(p2, /my essays/i), "to My essays");
  await p2.waitForTimeout(250);
  const away = await stageOf(p2);
  ok(/My essays/.test(away.heading), "and it is the same destination from the list: " + JSON.stringify(away.heading));
  // Leaving returns to the stage that was left, not to the top of the flow.
  ok(await nav(p2, /essay practice/i), "back through the header");
  await p2.waitForTimeout(250);
  const after = await p2.evaluate(() => ({
    stage: ((document.querySelector(".qp-h1") || {}).textContent || "").trim(),
    subject: (document.querySelector("#essubject") || {}).value || null,
    dir: [...document.querySelectorAll("[data-essetupdir].on")].map(x => x.dataset.essetupdir),
    chosen: ((document.querySelector(".qp-row.on") || {}).dataset || {}).esq || null,
    rail: ((document.querySelector(".qp-rcq") || {}).textContent || "").trim(),
    rows: document.querySelectorAll(".qp-row").length,
    marks: (document.querySelector("#esmarks") || {}).value || null,
  }));
  ok(after.stage === before.stage, "the stage returned to is the one left: " + JSON.stringify(after.stage));
  ok(after.chosen === before.chosen, "the chosen question survived: " + JSON.stringify(after.chosen));
  ok(String(after.dir) === String(before.dir), "the directive filter survived: " + JSON.stringify(after.dir));
  ok(after.rows === before.rows, "the filtered list is the same length: " + after.rows);
  ok(after.rail === before.rail, "the rail still holds the same question");
  // The settings are not on the list stage, so the check goes back to where they
  // are. That is one more press, and it is the press that reads the real value.
  await p2.evaluate(() => { const b = document.querySelector(".qp-back"); b && b.click(); });
  await p2.waitForTimeout(250);
  const marks = await p2.evaluate(() => {
    const d = document.querySelector(".qp-opts"); if (d) d.open = true;
    return (document.querySelector("#esmarks") || {}).value || null;
  });
  ok(String(marks) === "17", "and a setting changed inside the fold survived: " + marks);
  // The one thing that is ALLOWED to change that number, so the assertion above
  // is a statement about navigation rather than an accident of which row it hit.
  await p2.evaluate(() => { const b = document.querySelector('[data-espick="list"]'); b && b.click(); });
  await p2.waitForTimeout(250);
  await p2.evaluate(() => { const r = document.querySelector('.qp-row[data-esq="mkt-01"]'); r && r.click(); });
  await p2.waitForTimeout(250);
  await p2.evaluate(() => { const b = document.querySelector(".qp-back"); b && b.click(); });
  await p2.waitForTimeout(250);
  const adopted = await p2.evaluate(() => {
    const d = document.querySelector(".qp-opts"); if (d) d.open = true;
    return (document.querySelector("#esmarks") || {}).value || null;
  });
  ok(String(adopted) === "20",
    "choosing a question that authors marks adopts the authored value: " + adopted);

  console.log("5b. removing a saved essay is asked about first");
  {
    // The control sits beside Resume and there is no undo behind it, so the two
    // halves are tested separately: cancelling must change nothing at all, and
    // confirming must remove exactly the one that was aimed at.
    const ctx5 = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    ctx5.on("page", pg => pg.on("pageerror", e => errs.push(String(e).slice(0, 200))));
    const p5 = await ctx5.newPage();
    await p5.route(/workers\.dev/, r => r.abort());
    await toPicker(p5);
    // Two essays, made through the real flow, so there is a wrong one to lose.
    for (const id of ["mkt-01", "fin-02"]) {
      await usePractice(p5);
      await pageTo(p5, '.qp-row[data-esq="' + id + '"]');
      await p5.click('.qp-row[data-esq="' + id + '"]');
      await p5.click('[data-espick="preview"]');
      await p5.waitForSelector("#esstart", { timeout: 8000 });
      await p5.click("#esstart");
      await p5.waitForTimeout(700);
      await p5.click("#esqchange");
      await p5.waitForTimeout(350);
    }
    const toEssays = async () => {
      await p5.evaluate(() => [...document.querySelectorAll(".qp-navlink")]
        .find(x => /my essays/i.test(x.textContent)).click());
      await p5.waitForTimeout(300);
    };
    const listed = () => p5.$$eval(".qp-essay", es => es.map(e => e.dataset.resrow));
    await toEssays();
    const before = await listed();
    ok(before.length === 2, "two essays are saved: " + before.length);

    // CANCEL. Nothing is asked of the store and nothing leaves the page.
    let asked = null;
    p5.once("dialog", async d => { asked = d.message(); await d.dismiss(); });
    await p5.click(".qp-essay [data-esdelete]");
    await p5.waitForTimeout(400);
    ok(!!asked, "pressing remove asks first: " + JSON.stringify(asked));
    ok(/cannot be undone/i.test(asked || ""),
      "and says the essay is not coming back: " + JSON.stringify(asked));
    const afterCancel = await listed();
    ok(String(afterCancel) === String(before),
      "cancelling leaves both essays exactly where they were: " + JSON.stringify(afterCancel));
    const storedAfterCancel = await p5.evaluate(() => Object.values(
      JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}"))
      .reduce((n, b) => n + ((b && b.drafts) || []).length, 0));
    ok(storedAfterCancel === 2, "and nothing was removed from the store: " + storedAfterCancel);

    // CONFIRM, on the first one. Only that one goes.
    const target = before[0], survivor = before[1];
    p5.once("dialog", async d => { await d.accept(); });
    await p5.click('.qp-essay[data-resrow="' + target + '"] [data-esdelete]');
    await p5.waitForTimeout(500);
    const afterConfirm = await listed();
    ok(afterConfirm.length === 1 && afterConfirm[0] === survivor,
      "confirming removes only the one it was aimed at: " + JSON.stringify(afterConfirm));
    const storedAfterConfirm = await p5.evaluate(() => Object.values(
      JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}"))
      .reduce((n, b) => n + ((b && b.drafts) || []).length, 0));
    ok(storedAfterConfirm === 1, "and the store agrees: " + storedAfterConfirm);

    // The last one out leaves the page in its empty state rather than an empty
    // card with nothing in it.
    p5.once("dialog", async d => { await d.accept(); });
    await p5.click('.qp-essay[data-resrow="' + survivor + '"] [data-esdelete]');
    await p5.waitForTimeout(600);
    const emptied = await stageOf(p5);
    ok(emptied.essays === 0 && emptied.empty,
      "removing the last one leaves the empty state: " + JSON.stringify(emptied));
    await ctx5.close();
  }

  console.log("6. an essay is filed under its own question's topic");
  // Found by looking at My essays with two essays on it: the second was chipped
  // with the first one's topic. Choosing a row only filled the topic when it was
  // empty, which was right when a student typed one and wrong once that field was
  // removed. The topic reaches marking, so this is not a label problem.
  {
    // Its own context: the pages above already saved essays into this one, and a
    // count of what is listed has to be a count of what THIS walk saved.
    const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    ctx3.on("page", pg => pg.on("pageerror", e => errs.push(String(e).slice(0, 200))));
    const p3 = await ctx3.newPage();
    await p3.route(/workers\.dev/, r => r.abort());
    await toPicker(p3);
    for (const id of ["mkt-01", "fin-02"]) {
      await usePractice(p3);
      await pageTo(p3, '.qp-row[data-esq="' + id + '"]');
      await p3.click('.qp-row[data-esq="' + id + '"]');
      await p3.click('[data-espick="preview"]');
      await p3.waitForSelector("#esstart", { timeout: 8000 });
      await p3.click("#esstart");
      await p3.waitForTimeout(700);
      await p3.click("#esqchange");
      await p3.waitForTimeout(350);
    }
    const filed = await p3.evaluate(() => {
      const bags = JSON.parse(localStorage.getItem("marginal.essay.v1") || "{}");
      return Object.values(bags).flatMap(b => (b && b.drafts) || [])
        .map(d => ({ id: d.questionId, topic: d.topic }));
    });
    const byId = Object.fromEntries(filed.map(r => [r.id, r.topic]));
    ok(byId["mkt-01"] === "Marketing", "the Marketing question is filed under Marketing: " + byId["mkt-01"]);
    ok(byId["fin-02"] === "Finance",
      "and the Finance question under Finance, not the one chosen before it: " + byId["fin-02"]);
    await p3.evaluate(() => [...document.querySelectorAll(".qp-navlink")]
      .find(x => /my essays/i.test(x.textContent)).click());
    await p3.waitForTimeout(300);
    const chips = await p3.$$eval(".qp-essay .qp-chip", es => es.map(e => e.textContent.trim()));
    ok(chips.length === 2 && chips.indexOf("Finance") >= 0 && chips.indexOf("Marketing") >= 0,
      "and My essays shows both topics rather than one twice: " + JSON.stringify(chips));
    await ctx3.close();
  }

  console.log("7. the setup page no longer implies a default mark value");
  // Marks are academic metadata. Nine of the thirteen bundled questions author
  // none, and the app may not tell a student it has one for them anyway.
  const copy = await p2.evaluate(() => {
    const rails = [...document.querySelectorAll(".qp-rail")].map(x => x.innerText).join("\n");
    return {
      rails: rails,
      label: [...document.querySelectorAll(".qp-label")].map(x => x.textContent.trim()),
    };
  });
  ok(!/sensible defaults/i.test(copy.rails), "the Top tip no longer promises sensible defaults");
  ok(!/marks[^.]*default/i.test(copy.rails), "and nothing in the rail offers a default mark value");
  ok(/only need a question to start/i.test(copy.rails), "it still says a question is all you need");
  ok(!copy.label.some(l => /marks this question is worth/i.test(l)),
    "the marks field no longer states a mark value as a fact about the question: " + JSON.stringify(copy.label));

  console.log("\npageerrors:", errs.length ? errs.join(" | ") : "none");
  ok(errs.length === 0, "no page errors anywhere in this walk");
  await browser.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
