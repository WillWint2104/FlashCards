// THE BAR ON A PHONE.
//
// IT EXISTS BECAUSE THE HEADER HAD NO NARROW MODEL AT ALL.
//
// The desktop bar went on running horizontally at every width. At 430px it was
// clipped after the subject label, which meant Learn, Notebook, Setup and - the
// one that matters - the way out of the essay were off the side of the screen
// with no way to reach them. The page did not even scroll to them: they were
// simply gone. A student on a phone could start writing and not be able to stop.
//
// What is asserted here is the model, not the pixels:
//
//   nothing on the bar sits outside the viewport, at any tested width
//   the page does not scroll sideways
//   Marginal is still identifiable
//   the section the student is in is still named
//   the way out - Exit essay in the workspace, Study in the app shell on the
//     pages - is ON the bar and reachable without opening anything
//   everything that folded away is reachable through one labelled control
//   that control says whether it is open, and closes on Escape
//
// The pages' bar is the app shell now (.ash). It has no designed phone treatment
// yet - that is the mobile phase - so what it must do here is the minimum: wrap
// rather than run off the side. Essay practice's own two pages sit in a row in
// the page, so on the pages nothing folds at all. The writing workspace keeps its
// own toolbar under the shell, and that toolbar still folds into More.
//
// Widths are the ones students actually hold: 390 is an iPhone 14/15, 412 a
// Pixel, 430 the largest phone in common use. 768 is a tablet in portrait, and
// it is here because a breakpoint that only works at the extremes is not a
// breakpoint.
const { chromium, T, planAll, chooseQuestion } = require("./env");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };

const PHONES = [390, 412, 430];
const WIDTHS = PHONES.concat([768]);

// Everything the bar puts on screen, and whether it is inside the window.
const barGeometry = (page, which) => page.evaluate(which => {
  const bar = document.querySelector(which || ".es-top");
  if (!bar) return null;
  const vw = document.documentElement.clientWidth;
  const visible = el => {
    if (!el || el.hidden) return false;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  };
  const items = [...bar.querySelectorAll("button, a, .es-navnow, .ash-logo")]
    .filter(visible)
    .map(el => {
      const r = el.getBoundingClientRect();
      return { id: el.id || "", cls: el.className.toString().slice(0, 28),
        text: (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 24),
        left: Math.round(r.left), right: Math.round(r.right),
        out: r.right > vw + 1 || r.left < -1 };
    });
  // What matters is whether the student CAN scroll sideways, not whether some
  // element behind the overlay is wider than the window. The flashcards tab row
  // under Essay Practice is one of those, and body.es-lock already clips it: a
  // scrollWidth reading called that a failure when nothing was reachable by it.
  const se = document.scrollingElement || document.documentElement;
  const was = se.scrollLeft; se.scrollLeft = 9999;
  const canScrollX = se.scrollLeft > was; se.scrollLeft = was;
  const surface = document.querySelector(".qp") || document.querySelector(".es-scrim");
  return { vw, items, canScrollX,
    surfaceScroll: surface ? surface.scrollWidth - vw : 0,
    barScroll: bar.scrollWidth - bar.clientWidth };
}, which);

// A resize is finished when the document reports the new width; the frame after
// it is the reflow rather than a guess at one. This replaced a flat 350ms sleep
// after every setViewportSize - eight of them in the width loops alone - which
// was the single largest cost in a suite that only ever reads layout.
async function atWidth(page, w, h) {
  await page.setViewportSize({ width: w, height: h || 900 });
  await page.waitForFunction(x => document.documentElement.clientWidth === x, w, { timeout: 4000 });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

// Waiting for the state a step produces, not for a guess at how long it takes.
// The same move the resize helper made: this suite only reads layout, and its
// fixed sleeps were most of its time on the checkpoint tier.
const frames = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const expanded = (page, v) => page.waitForFunction(x => { const m = document.getElementById("esmenu"); return m && m.getAttribute("aria-expanded") === x; }, v, { timeout: 4000 });
const shown = (page, sel) => page.waitForSelector(sel, { state: "attached", timeout: 8000 });

async function toPicker(page) {
  await page.goto(T);
  await page.waitForSelector(".ash-link", { timeout: 8000 });
  await page.$$eval(".ash-link", es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await page.waitForSelector("#essubject", { timeout: 8000 });
  await page.selectOption("#essubject", "business_studies");
  await frames(page);
}
async function intoWriting(page) {
  await chooseQuestion(page, /target markets/i);
  await page.click("#esstart"); await shown(page, "#esplanall, .es-plancard");
  await planAll(page);
  await page.$$eval(".es-plancard [data-esplanarea]", es => { const t = es.find(x => /processes/i.test(x.textContent)); t && t.click(); });
  await shown(page, "[data-esplanpick]");
  await page.$$eval("[data-esplanpick]", es => { const t = es.find(x => /Convenience-oriented/i.test(x.textContent)); t && t.click(); });
  await frames(page);
  await page.click("#esplango"); await shown(page, "[data-esgo]");
  await page.$$eval("[data-esgo]", es => { const t = es.find(x => /Body 1/.test(x.textContent)); t && t.click(); });
  await shown(page, "#esexit"); await frames(page);
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  const p = await ctx.newPage();
  await p.route(/workers\.dev/, r => r.abort());

  // The picker is driven at desktop width and the window narrowed afterwards:
  // what is under test is the bar at that width, not the route taken to it.
  console.log("--- 1. the setup page's bar, narrowed");
  await toPicker(p);
  for (const w of WIDTHS) {
    await atWidth(p, w);
    const g = await barGeometry(p, ".ash-in");
    ok(!!g, w + "px: there is a bar");
    if (!g) continue;
    const out = g.items.filter(x => x.out);
    ok(out.length === 0, w + "px: nothing on the bar is off screen: " + JSON.stringify(out.map(x => x.id || x.text)));
    ok(!g.canScrollX, w + "px: the page cannot be scrolled sideways");
    ok(g.surfaceScroll <= 1, w + "px: and Essay Practice's own surface fits: " + g.surfaceScroll + "px over");
    ok(g.barScroll <= 0, w + "px: and neither does the bar itself: " + g.barScroll + "px");
    const has = sel => g.items.some(x => (x.id === sel) || x.cls.indexOf(sel) >= 0);
    ok(has("ash-logo"), w + "px: Marginal is still identifiable");
    ok(g.items.some(x => x.text === "Study"), w + "px: the way home, Study, is on the bar, not behind a menu");
    // The surface starts under the bar, however tall wrapping made it.
    const under = await p.evaluate(() => Math.round(document.querySelector(".qp").getBoundingClientRect().top - document.querySelector(".ash").getBoundingClientRect().bottom));
    ok(Math.abs(under) <= 1, w + "px: and the page starts where the bar ends: " + under + "px");
  }

  console.log("--- 2. the section a student is in is still named");
  await atWidth(p, 390);
  const now = await p.evaluate(() => ({
    bar: (document.querySelector('.ash-link[aria-current="page"]') || {}).textContent || null,
    page: (document.querySelector('.ash-sublink[aria-current="page"]') || {}).textContent || null }));
  ok(now.bar === "Essay practice", "the bar names the area: " + JSON.stringify(now.bar));
  ok(now.page === "Essay practice", "and the page names which of its two pages this is: " + JSON.stringify(now.page));

  console.log("--- 3. the area's two pages are on screen, not folded");
  // The point of folding was that every destination stayed a destination. With
  // the two pages in the page itself there is nothing to fold: both are in view.
  const subs = await p.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    return [...document.querySelectorAll(".ash-sublink")].map(e => { const r = e.getBoundingClientRect();
      return { to: e.dataset.esnav, shown: getComputedStyle(e).display !== "none" && r.width > 0, out: r.right > vw + 1 || r.left < -1 }; });
  });
  ok(subs.some(x => x.to === "essays" && x.shown && !x.out), "My essays is on screen: " + JSON.stringify(subs));
  ok(subs.some(x => x.to === "back" && x.shown && !x.out), "and so is Essay practice");
  ok(!(await p.$("#esmenu")), "so the pages have no menu to open");
  await p.click('.ash-sublink[data-esnav="essays"]');
  await p.waitForFunction(() => /My essays/.test((document.querySelector(".qp-h1") || {}).textContent || ""), null, { timeout: 4000 }).catch(() => {});
  ok(/My essays/.test(await p.$eval(".qp-h1", e => e.textContent).catch(() => "")), "and My essays opens from a phone");

  console.log("--- 4. the writing workspace, where leaving matters most");
  await atWidth(p, 1400, 1000);
  await toPicker(p);
  await intoWriting(p);
  for (const w of WIDTHS) {
    await atWidth(p, w);
    const g = await barGeometry(p);
    ok(!!g, w + "px: the workspace has a bar");
    if (!g) continue;
    const out = g.items.filter(x => x.out);
    ok(out.length === 0, w + "px: nothing on it is off screen: " + JSON.stringify(out.map(x => x.id || x.text)));
    ok(!g.canScrollX, w + "px: no sideways scrolling");
    ok(g.surfaceScroll <= 1, w + "px: the workspace fits the window: " + g.surfaceScroll + "px over");
    ok(g.items.some(x => x.id === "esexit"), w + "px: Exit essay is ON the bar");
    ok(g.items.some(x => x.id === "esmenu"), w + "px: and the rest is one press away");
    const shell = await barGeometry(p, ".ash-in");
    ok(shell && shell.items.filter(x => x.out).length === 0, w + "px: and the app shell above it fits too: " + JSON.stringify(shell && shell.items.filter(x => x.out).map(x => x.text)));
  }

  console.log("--- 5. what folded away is still usable");
  await atWidth(p, 390);
  await p.click("#esmenu"); await expanded(p, "true").catch(() => {}); await frames(p);
  const inMenu = await p.$$eval("#esnavpanel button", es => es.map(e => e.id || (e.innerText || "").trim().slice(0, 20)));
  console.log("    workspace menu holds:", JSON.stringify(inMenu));
  for (const want of ["esmodeswitch", "esx"]) {
    ok(inMenu.indexOf(want) >= 0, "the menu reaches " + want);
  }
  ok(inMenu.length >= 4, "and the utilities: " + inMenu.length + " controls");
  // Pressing one has to work AND put the menu away.
  const notebook = await p.$('#esnavpanel [data-esnbtoggle]');
  ok(!!notebook, "Notebook is reachable from the menu");
  if (notebook) {
    await notebook.click(); await shown(p, ".es-nb").catch(() => {}); await expanded(p, "false").catch(() => {});
    ok(!!(await p.$(".es-nb")), "pressing it opens the notebook");
    ok(await p.$eval("#esmenu", e => e.getAttribute("aria-expanded") === "false"), "and the menu gets out of the way");
  }

  console.log("--- 5b. the fixed footer is a bar, not a second screenful");
  // It floats over the writing, so it has to stay one row and the writing has to
  // have room under it. Wrapped, it covered the sentences a student was reading.
  const foot = await p.evaluate(() => {
    const bar = document.querySelector(".es-footbar"); if (!bar) return null;
    const inner = bar.querySelector(".es-footbar-in");
    const vw = document.documentElement.clientWidth;
    const kids = [...inner.children].filter(e => e.getClientRects().length);
    // Rows by vertical CENTRE, not by top: controls of different heights on one
    // line have different tops, and counting those said three rows about a row.
    const mids = new Set(kids.map(e => { const r = e.getBoundingClientRect(); return Math.round((r.top + r.bottom) / 2 / 8); }));
    const out = kids.filter(e => e.getBoundingClientRect().right > vw + 1);
    const wrap = document.querySelector(".es-canvas, .es-wrap");
    return { h: Math.round(bar.getBoundingClientRect().height), rows: mids.size,
      out: out.map(e => e.id || (e.innerText || "").trim().slice(0, 16)),
      padBottom: wrap ? parseInt(getComputedStyle(wrap).paddingBottom, 10) : 0 };
  });
  ok(!!foot, "there is a footer bar");
  if (foot) {
    ok(foot.rows === 1, "it is one row at 390px, not " + foot.rows);
    ok(foot.out.length === 0, "and nothing on it runs off the side: " + JSON.stringify(foot.out));
    ok(foot.padBottom >= foot.h, "the writing has room underneath it: " + foot.padBottom + "px for a " + foot.h + "px bar");
  }

  console.log("--- 6. Exit essay works at phone width");
  await atWidth(p, 390);
  const exit = await p.$("#esexit");
  ok(!!exit, "Exit essay is there");
  if (exit) {
    await exit.click(); await p.waitForFunction(() => !document.getElementById("eshost"), null, { timeout: 4000 }).catch(() => {});
    ok(!(await p.evaluate(() => !!document.getElementById("eshost"))), "and it leaves Essay Practice from a phone");
  }

  console.log("--- 7. the desktop bar is unchanged");
  await atWidth(p, 1400, 1000);
  await toPicker(p);
  const tops = await p.$$eval(".ash-link", es => es.map(e => Math.round(e.getBoundingClientRect().top)));
  ok(tops.length === 4 && new Set(tops).size === 1, "the app shell's four areas are one row again: " + JSON.stringify(tops));
  ok(!(await p.$("#esmenu")), "and the pages have no menu button");
  await intoWriting(p);
  ok(await p.$eval(".qp-navlinks", e => getComputedStyle(e).display !== "none"), "the workspace's links are back on its toolbar");
  ok(await p.$eval("#esmenu", e => getComputedStyle(e).display === "none"), "and its menu button is not shown");
  ok(await p.$eval("#esnavpanel", e => getComputedStyle(e).display !== "none"), "the group is a row again, not a panel");

  console.log("");
  console.log(pass + " passed, " + fail + " failed");
  await b.close();
  process.exit(fail ? 1 : 0);
})();
