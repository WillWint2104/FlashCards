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
//   the way out - Exit essay in the workspace, Home on the pages - is ON the bar
//     and reachable without opening anything
//   everything that folded away is reachable through one labelled control
//   that control says whether it is open, and closes on Escape
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
const barGeometry = page => page.evaluate(() => {
  const bar = document.querySelector(".qp-navin") || document.querySelector(".es-top");
  if (!bar) return null;
  const vw = document.documentElement.clientWidth;
  const visible = el => {
    if (!el || el.hidden) return false;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  };
  const items = [...bar.querySelectorAll("button, .es-navnow, .qp-word, .qp-logo")]
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
});

async function toPicker(page) {
  await page.goto(T);
  await page.waitForSelector(".navtab", { timeout: 8000 });
  await page.$$eval(".navtab", es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await page.waitForSelector("#essubject", { timeout: 8000 });
  await page.selectOption("#essubject", "business_studies");
  await page.waitForTimeout(300);
}
async function intoWriting(page) {
  await chooseQuestion(page, /target markets/i); await page.waitForTimeout(250);
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
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  const p = await ctx.newPage();
  await p.route(/workers\.dev/, r => r.abort());

  // The picker is driven at desktop width and the window narrowed afterwards:
  // what is under test is the bar at that width, not the route taken to it.
  console.log("--- 1. the setup page's bar, narrowed");
  await toPicker(p);
  for (const w of WIDTHS) {
    await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(350);
    const g = await barGeometry(p);
    ok(!!g, w + "px: there is a bar");
    if (!g) continue;
    const out = g.items.filter(x => x.out);
    ok(out.length === 0, w + "px: nothing on the bar is off screen: " + JSON.stringify(out.map(x => x.id || x.text)));
    ok(!g.canScrollX, w + "px: the page cannot be scrolled sideways");
    ok(g.surfaceScroll <= 1, w + "px: and Essay Practice's own surface fits: " + g.surfaceScroll + "px over");
    ok(g.barScroll <= 0, w + "px: and neither does the bar itself: " + g.barScroll + "px");
    const has = sel => g.items.some(x => (x.id === sel) || x.cls.indexOf(sel) >= 0);
    ok(has("qp-logo"), w + "px: Marginal is still identifiable");
    ok(has("eshome"), w + "px: Home is on the bar, not behind a menu");
  }

  console.log("--- 2. the section a student is in is still named");
  await p.setViewportSize({ width: 390, height: 900 }); await p.waitForTimeout(350);
  const now = await p.$eval(".es-navnow", e => e.innerText.trim()).catch(() => null);
  ok(now === "Essay practice", "the bar names the section: " + JSON.stringify(now));
  // The links are INSIDE the group, so what folds is the group. Reading
  // getComputedStyle on the links themselves would report "flex" for a nav that
  // is inside a hidden panel, which is why this asks about the panel.
  const groupHidden = await p.$eval("#esnavpanel", e => getComputedStyle(e).display === "none").catch(() => false);
  ok(groupHidden, "and the group holding them has folded away");

  console.log("--- 3. one control reaches everything that folded");
  const menu = await p.$("#esmenu");
  ok(!!menu, "there is a labelled menu control");
  ok(await p.$eval("#esmenu", e => e.getAttribute("aria-expanded") === "false"), "which starts closed and says so");
  ok(await p.$eval("#esnavpanel", e => getComputedStyle(e).display === "none"), "the panel is not on screen until it is asked for");
  await menu.click(); await p.waitForTimeout(300);
  ok(await p.$eval("#esmenu", e => e.getAttribute("aria-expanded") === "true"), "pressing it opens the menu, and it says so");
  const panel = await p.evaluate(() => {
    const el = document.getElementById("esnavpanel"); if (!el) return null;
    const r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth;
    return { shown: getComputedStyle(el).display !== "none", right: Math.round(r.right), left: Math.round(r.left),
      out: r.right > vw + 1 || r.left < -1,
      items: [...el.querySelectorAll("button")].map(x => x.id || (x.innerText || "").trim().slice(0, 20)) };
  });
  ok(panel && panel.shown, "the panel is on screen");
  ok(panel && !panel.out, "and inside the window: " + JSON.stringify(panel && [panel.left, panel.right]));
  // The picker's panel carries the subject label; the workspace's carries the
  // tools. Either way it must not be an empty box.
  console.log("    panel holds:", JSON.stringify(panel && panel.items));
  // The point of folding rather than hiding: every destination is still a
  // destination. A link that is display:none at 390px and not in the menu is a
  // section of the application a student on a phone cannot reach at all.
  const routes = await p.$$eval("#esnavpanel [data-esnav]", es => es.map(e => e.dataset.esnav));
  ok(routes.indexOf("essays") >= 0, "My essays is reachable from the menu: " + JSON.stringify(routes));
  ok(routes.indexOf("back") >= 0, "and so is Essay practice");

  console.log("--- 3b. it closes the ways a menu closes");
  await p.keyboard.press("Escape"); await p.waitForTimeout(250);
  ok(await p.$eval("#esmenu", e => e.getAttribute("aria-expanded") === "false"), "Escape closes it");
  await menu.click(); await p.waitForTimeout(250);
  await p.mouse.click(180, 620); await p.waitForTimeout(300);
  ok(await p.$eval("#esmenu", e => e.getAttribute("aria-expanded") === "false"), "and so does pressing away from it");

  console.log("--- 4. the writing workspace, where leaving matters most");
  await p.setViewportSize({ width: 1400, height: 1000 }); await p.waitForTimeout(300);
  await toPicker(p);
  await intoWriting(p);
  for (const w of WIDTHS) {
    await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(350);
    const g = await barGeometry(p);
    ok(!!g, w + "px: the workspace has a bar");
    if (!g) continue;
    const out = g.items.filter(x => x.out);
    ok(out.length === 0, w + "px: nothing on it is off screen: " + JSON.stringify(out.map(x => x.id || x.text)));
    ok(!g.canScrollX, w + "px: no sideways scrolling");
    ok(g.surfaceScroll <= 1, w + "px: the workspace fits the window: " + g.surfaceScroll + "px over");
    ok(g.items.some(x => x.id === "esexit"), w + "px: Exit essay is ON the bar");
    ok(g.items.some(x => x.id === "esmenu"), w + "px: and the rest is one press away");
  }

  console.log("--- 5. what folded away is still usable");
  await p.setViewportSize({ width: 390, height: 900 }); await p.waitForTimeout(350);
  await p.click("#esmenu"); await p.waitForTimeout(300);
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
    await notebook.click(); await p.waitForTimeout(500);
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
  await p.setViewportSize({ width: 390, height: 900 }); await p.waitForTimeout(300);
  const exit = await p.$("#esexit");
  ok(!!exit, "Exit essay is there");
  if (exit) {
    await exit.click(); await p.waitForTimeout(500);
    ok(!(await p.evaluate(() => !!document.getElementById("eshost"))), "and it leaves Essay Practice from a phone");
  }

  console.log("--- 7. the desktop bar is unchanged");
  await p.setViewportSize({ width: 1400, height: 1000 }); await p.waitForTimeout(300);
  await toPicker(p);
  ok(await p.$eval(".qp-navlinks", e => getComputedStyle(e).display !== "none"), "the links are back on the bar");
  ok(await p.$eval("#esmenu", e => getComputedStyle(e).display === "none"), "and the menu button is not shown");
  ok(await p.$eval("#esnavpanel", e => getComputedStyle(e).display !== "none"), "the group is a row again, not a panel");

  console.log("");
  console.log(pass + " passed, " + fail + " failed");
  await b.close();
  process.exit(fail ? 1 : 0);
})();
