// NO DEAD CONTROLS.
//
// "My essays" sat in the header for a while pointing at the stage behind it, so
// pressing it did what Back to setup did under a name that promised something
// else. tests/ui.js meanwhile asserted the setup screen opens by looking for an
// attribute the redesign had deleted, so it passed on nothing. Both are the same
// fault: a control, or a check, that looks right and does nothing.
//
// tests/smoke.js used to walk the app looking for exactly this and reported it
// in prose. It asserted nothing, so nothing failed when something went dead, and
// it rotted outside the harness until it no longer ran at all. This is the half
// of it worth keeping, as assertions: every tab opens a surface, and every
// control on the essay-practice flow does something when it is pressed.
//
// WHAT "DOES SOMETHING" MEANS HERE. The press changes the page: a different
// stage, or different markup. That is deliberately weak. A control that opens a
// dialog, toggles a class or fills a rail all pass, and only a control that
// leaves the document byte for byte identical fails. A stronger rule would need
// to know what each control is for, and this suite is the one that does not have
// to know.
const { chromium, T, usePractice, pageTo } = require("./env");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FAIL:", m); } };

// Controls that are destructive or leave the app, named so the sweep can skip
// them rather than pressing them and testing the rest against the wreckage.
// Each is covered by a suite that presses it on purpose.
const SKIP = {
  esx: "closes the essay surface; ui41 covers it",
  "data-esdelete": "deletes a saved essay; ui52 covers both answers to its confirmation",
  esstart: "starts the essay and leaves the picker; ui40 opens every question through it",
  esmarkfull: "submits for marking; ui2 covers the payload",
  resetAll: "clears all stored state",
  backupAll: "downloads a backup",
  saveEndpoint: "writes teacher settings",
};

const snap = page => page.evaluate(() => ({
  stage: ((document.querySelector(".qp-h1") || {}).textContent || "").trim(),
  html: (document.querySelector(".qp") || document.body).innerHTML.length,
  marker: [...document.querySelectorAll(".qp-h1, .qp-row, .qp-essay, .qp-prevq")].length,
}));

// Every control a student can see on this stage, with a stable way to name it.
const controlsOn = page => page.evaluate(skip => {
  const named = [];
  document.querySelectorAll(".qp button, .qp [role='radio']").forEach(b => {
    if (b.disabled || !b.offsetParent) return;
    // A control that says it is already the current one is not dead when
    // pressing it changes nothing: that is what being current means. The All
    // pill on an unfiltered list, page 1 while on page 1, the nav link for the
    // page you are on, and the row already chosen are all this. They are marked
    // in the markup, so the sweep reads the mark rather than guessing.
    if (b.classList.contains("on")) return;
    if (b.getAttribute("aria-checked") === "true") return;
    if (b.getAttribute("aria-current")) return;
    const id = b.id || "";
    const attrs = [...b.attributes].map(a => a.name);
    if (id && skip[id]) return;
    if (attrs.some(a => skip[a])) return;
    named.push({
      id: id,
      sel: id ? "#" + id
        : b.dataset.esq ? '.qp-row[data-esq="' + b.dataset.esq + '"]'
        : b.dataset.espick ? '[data-espick="' + b.dataset.espick + '"]'
        : b.dataset.esnav ? '[data-esnav="' + b.dataset.esnav + '"]'
        : b.dataset.espage ? '[data-espage="' + b.dataset.espage + '"]'
        : b.dataset.essetupdir !== undefined ? '[data-essetupdir="' + b.dataset.essetupdir + '"]'
        : b.dataset.essetuptopic !== undefined ? '[data-essetuptopic="' + b.dataset.essetuptopic + '"]'
        : null,
      label: (b.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
    });
  });
  return named.filter(x => x.sel);
}, SKIP);

async function toStage(page, stage) {
  await page.goto(T);
  await page.waitForSelector(".navtab", { timeout: 8000 });
  for (const t of await page.$$(".navtab")) {
    if (/essay/i.test((await t.textContent()) || "")) { await t.click(); break; }
  }
  await page.waitForSelector("#essubject", { timeout: 8000 });
  await page.selectOption("#essubject", "business_studies");
  await page.waitForTimeout(300);
  if (stage === "setup") return;
  await usePractice(page);
  if (stage === "list") return;
  if (stage === "selected") {
    await page.click(".qp-row"); await page.waitForTimeout(250); return;
  }
  if (stage === "preview") {
    await page.click(".qp-row"); await page.waitForTimeout(250);
    await page.click('[data-espick="preview"]');
    await page.waitForSelector(".qp-prevq", { timeout: 8000 }); return;
  }
  if (stage === "essays") {
    await page.evaluate(() => [...document.querySelectorAll(".qp-navlink")]
      .find(x => /my essays/i.test(x.textContent)).click());
    await page.waitForTimeout(300); return;
  }
  if (stage === "own") {
    await page.click('[data-espick="own"]'); await page.waitForTimeout(300); return;
  }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const errs = [];
  ctx.on("page", pg => pg.on("pageerror", e => errs.push(String(e).slice(0, 200))));
  const page = await ctx.newPage();
  await page.route(/workers\.dev/, r => r.abort());

  console.log("1. every tab in the hub opens a surface");
  {
    await page.goto(T);
    await page.waitForSelector(".navtab", { timeout: 8000 });
    // The tab the app opens on is already current, so pressing it changes
    // nothing and that is correct. It is checked for being marked current
    // instead, which is the claim that matters about it.
    const tabs = await page.$$eval(".navtab", es => es.map(e => ({
      label: e.textContent.trim(), current: e.classList.contains("on") })));
    ok(tabs.length >= 3, "the hub offers its tabs: " + JSON.stringify(tabs.map(t => t.label)));
    const current = tabs.filter(t => t.current);
    ok(current.length === 1, "exactly one is marked as the one you are on: " +
      JSON.stringify(current.map(t => t.label)));
    for (const { label, current: isCurrent } of tabs) {
      if (isCurrent) continue;
      await page.goto(T);
      await page.waitForSelector(".navtab", { timeout: 8000 });
      const before = await page.evaluate(() => document.body.innerHTML.length);
      await page.$$eval(".navtab", (es, l) => { const t = es.find(x => x.textContent.trim() === l); t && t.click(); }, label);
      await page.waitForTimeout(450);
      const after = await page.evaluate(() => document.body.innerHTML.length);
      ok(after !== before, JSON.stringify(label) + " opens something: " + before + " -> " + after);
    }
  }

  console.log("2. every control on every stage of the picker does something");
  const STAGES = ["setup", "list", "selected", "preview", "essays", "own"];
  const dead = [];
  for (const stage of STAGES) {
    await toStage(page, stage);
    const controls = await controlsOn(page);
    ok(controls.length > 0, stage + " offers controls: " + controls.length);
    for (const c of controls) {
      await toStage(page, stage);
      const before = await snap(page);
      const clicked = await page.evaluate(sel => {
        const el = document.querySelector(sel);
        if (!el) return false; el.click(); return true;
      }, c.sel);
      if (!clicked) { dead.push(stage + " " + c.sel + " (not found on a second visit)"); continue; }
      await page.waitForTimeout(320);
      const after = await snap(page);
      const moved = after.stage !== before.stage || after.html !== before.html || after.marker !== before.marker;
      if (!moved) dead.push(stage + " " + c.sel + " " + JSON.stringify(c.label));
    }
    console.log("    " + stage + ": " + controls.length + " controls");
  }
  ok(!dead.length, "no control leaves the page exactly as it found it: " + JSON.stringify(dead));

  console.log("3. the header's destinations are different places");
  {
    // The specific fault. Two nav links that render the same stage are one link
    // and a lie, whatever they are labelled.
    await toStage(page, "setup");
    const seen = {};
    for (const which of ["back", "essays"]) {
      await toStage(page, "setup");
      await page.evaluate(w => { const b = document.querySelector('[data-esnav="' + w + '"]'); b && b.click(); }, which);
      await page.waitForTimeout(320);
      seen[which] = (await snap(page)).stage;
    }
    ok(seen.back !== seen.essays,
      "Essay practice and My essays land on different pages: " + JSON.stringify(seen));
    ok(/My essays/i.test(seen.essays), "and My essays lands on My essays: " + JSON.stringify(seen.essays));
  }

  console.log("\npageerrors:", errs.length ? errs.join(" | ") : "none");
  ok(errs.length === 0, "no page errors while pressing every control");
  await browser.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
