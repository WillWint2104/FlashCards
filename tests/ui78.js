// THE APP SHELL: ONE BAR, ONE STATE, ON EVERY PAGE.
//
// Marginal had two navigation systems: a static header with a hard-coded
// Economics unit and a pill switcher over Study, Create and Test mode, and a bar
// of Essay practice's own. The owner approved one shared shell in the Essay
// practice bar's language (docs/mockups/00-app-shell*.html) and locked these
// rules, which this file holds:
//
//   exactly one bar on every signed-in page, rendered by one renderer, and none
//     of the old chrome anywhere
//   Study | Create | Test mode | Essay practice, with the open area marked
//   the subject is the most specific authoritative context the open workspace
//     supplies, and display only:
//       Study                Economics · Year 12 (its declared key); a set the
//                            student made names nothing
//       Create               nothing
//       Test mode library    nothing
//       a Test mode paper    Business Studies · Stage 6: the resolved subject
//                            and the stage the paper itself declares
//       Essay practice       the chosen course's package, Business Studies ·
//                            Year 12; on a writing screen, the attempt's own
//   Essay practice keeps its own two pages, below the bar
//   the account (class code · student number) and Sign out on every page, and
//     Sign out leaves wherever the student is, Essay practice included
//   1024px and up: the whole bar. 861px to 1023px: the subject is left out and
//     everything else stays, on one row
//   the pages under the bar keep their columns; the overlays start below it
//   the bar is the approved drawing, to the pixel, and its CSS is the drawing's
//
// The harness runs with cloud sign-in off, where there is no account. To see the
// account and Sign out, the page is given a stand-in for the Supabase client: a
// signed-in session for a sample student, and nothing else.
const fs = require("fs");
const path = require("path");
const { chromium, T, ROOT } = require("./env");
const { serveFonts } = require("./fontcache");
const { IMPORTER, publishThroughImporter } = require("./fixtures/lib");
const { allRows, usePractice } = require("./env");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const MOCK = path.join(ROOT, "docs", "mockups");

// A stand-in for supabase-js: a session for the sample student, a profile, no
// sets. The page's config is given a URL and key so the app takes the cloud path.
function cloud(opts) {
  const S = { user: { id: "shell-test" } };
  let session = opts.signedIn ? S : null;
  window.__cloud = { signOuts: 0 };
  const done = v => Promise.resolve(v);
  const chain = () => {
    const c = { select: () => c, eq: () => c, order: () => c, insert: () => c, update: () => c, delete: () => c,
      maybeSingle: () => done({ data: session ? { class_code: "12Ec126", student_number: opts.number } : null }),
      single: () => done({ data: null, error: null }),
      then: (a, b) => done({ data: [], error: null }).then(a, b) };
    return c;
  };
  window.supabase = { createClient: () => ({
    auth: {
      getSession: () => done({ data: { session } }),
      signOut: () => { session = null; window.__cloud.signOuts++; return done({}); },
      signInWithPassword: () => { session = S; return done({ data: { session: S }, error: null }); },
    },
    from: chain,
    functions: { invoke: () => done({ data: null }) },
  }) };
  let cfg;
  Object.defineProperty(window, "MARGINAL_CONFIG", { configurable: true, get: () => cfg,
    set: v => { cfg = Object.assign({}, v, { supabaseUrl: "https://shell-test.invalid", supabaseAnonKey: "shell-test-key" },
      opts.essayMode === false ? { essayMode: false } : {}); } });
}

async function open(b, opts) {
  opts = Object.assign({ signedIn: true, number: "1234", width: 1440, query: "" }, opts || {});
  const ctx = await b.newContext({ viewport: { width: opts.width, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); await serveFonts(p);
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
  await p.route(/workers\.dev/, r => r.abort());
  if (opts.cloud !== false) await p.addInitScript(cloud, { signedIn: opts.signedIn, number: opts.number, essayMode: opts.essayMode });
  await p.goto(T + opts.query);
  await p.waitForSelector(opts.signedIn ? ".ash-link" : "#ado", { timeout: 8000 });
  await settled(p); await p.evaluate(() => document.fonts.ready);
  return { p, ctx, errs };
}

// Everything the chrome says about itself, read off the page.
const chrome = p => p.evaluate(() => {
  const ash = document.querySelector(".ash"), r = ash && ash.getBoundingClientRect();
  const shown = e => !!e && getComputedStyle(e).display !== "none";
  const ctx = document.querySelector(".ash-ctx");
  return {
    shells: document.querySelectorAll(".ash").length,
    headers: document.querySelectorAll("header").length,
    top: r ? Math.round(r.top * 10) / 10 : null, height: r ? Math.round(r.height * 10) / 10 : null,
    links: [...document.querySelectorAll(".ash-link")].map(e => e.textContent),
    current: [...document.querySelectorAll('.ash-link[aria-current="page"]')].map(e => e.textContent),
    ctx: shown(ctx) ? ctx.textContent : "",
    who: (document.querySelector(".ash-who > span") || {}).textContent || "",
    out: !!document.querySelector(".ash-out"),
    old: ["div.nav", ".navtab", ".whoami", "#signout", "header.qp-nav", ".qp-nav", ".qp-navin", ".qp-brand",
      "#eshome", "#esbrandhome", ".qp-subj", ".es-demobadge", "header .unit", "header .brand"].filter(s => document.querySelector(s)),
    oldText: /HSC Economics|Distribution of Income/i.test(ash ? ash.textContent : "") || /HSC Economics/.test(document.body.innerText),
    bar: ash ? [...ash.querySelectorAll(".ash-brand, .ash-link, .ash-out")].map(e => { const b = e.getBoundingClientRect();
      return [Math.round(b.left * 10) / 10, Math.round(b.top * 10) / 10, Math.round(b.width * 10) / 10]; }) : null,
  };
});
const go = (p, area) => p.click('.ash [data-shell="' + area + '"]').then(() => settled(p));

// Whether the bar holds one row: every link on one line, the bar its full height,
// nothing overflowing or overlapping (the same test the drawings' build makes).
const fits = p => p.evaluate(() => {
  const h = document.querySelector(".ash"), inn = h.querySelector(".ash-in"), right = h.querySelector(".ash-right");
  const box = e => e.getBoundingClientRect();
  const shownKids = [...right.children].filter(e => getComputedStyle(e).display !== "none");
  const links = [...h.querySelectorAll(".ash-link")].map(box), items = shownKids.map(box), last = shownKids[shownKids.length - 1];
  const end = last ? box(last).right + parseFloat(getComputedStyle(last).marginRight) : 0;
  const full = sel => { const e = h.querySelector(sel); return !e || getComputedStyle(e).display === "none" ? null : e.scrollWidth <= e.clientWidth; };
  return {
    oneRow: new Set(links.map(l => Math.round(l.top))).size === 1 && Math.round(box(h).height * 10) / 10 === 67.4
      && inn.scrollWidth <= inn.clientWidth && box(h.querySelector(".ash-brand")).right <= links[0].left
      && (!items.length || links[links.length - 1].right <= items[0].left)
      && items.every((r, i) => !i || items[i - 1].right <= r.left) && (!last || end <= box(right).right + 0.5),
    subject: full(".ash-ctx"), account: full(".ash-who > span"), signOut: !!h.querySelector(".ash-out"),
    demo: !!h.querySelector(".ash-demo") && getComputedStyle(h.querySelector(".ash-demo")).display !== "none",
  };
});
const atWidth = async (p, w) => { await p.setViewportSize({ width: w, height: 900 }); await p.waitForFunction(x => document.documentElement.clientWidth === x, w); await settled(p); };

// Pixels that differ between two PNGs, counted in the browser.
const diffPixels = (page, a, b) => page.evaluate(async ([a, b]) => {
  const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const [x, y] = await Promise.all([load(a), load(b)]);
  if (x.width !== y.width || x.height !== y.height) return -1;
  const px = img => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
  const p = px(x), q = px(y); let d = 0;
  for (let i = 0; i < p.length; i += 4) if (p[i] !== q[i] || p[i + 1] !== q[i + 1] || p[i + 2] !== q[i + 2]) d++;
  return d;
}, ["data:image/png;base64," + a.toString("base64"), "data:image/png;base64," + b.toString("base64")]);

async function toEssay(p, subject) {
  // From inside Essay practice the bar's link is the area's own route, which on a
  // writing screen stays put; so leave first and come in fresh, as a student would.
  if (await p.$("#eshost .es-top")) await go(p, "study");
  await go(p, "essay"); await p.waitForSelector("#essubject");
  await p.selectOption("#essubject", subject); await settled(p);
}
async function toWriting(p) {
  await p.evaluate(() => { const b = document.querySelector('[data-espick="list"]'); b && b.click(); });
  await p.waitForSelector(".qp-row");
  for (let i = 1; i <= 4 && !(await p.$('.qp-row[data-esq="mkt-01"]')); i++) {
    const b = await p.$('.qp-pagenums [data-espage="' + i + '"]'); if (!b) break; await b.click(); await settled(p); }
  await p.click('.qp-row[data-esq="mkt-01"]'); await p.click('[data-espick="preview"]');
  await p.waitForSelector("#esstart"); await p.click("#esstart");
  await p.waitForSelector("#eshost .es-top"); await settled(p);
}
async function toPaper(p) {
  await go(p, "test"); await p.waitForSelector(".tm-paper [data-tmopen]");
  await p.click(".tm-paper [data-tmopen]"); await p.waitForSelector("#exampickgo, #tmresume"); await settled(p);
}
// Into the sitting from the overview: a new attempt, or the one already going.
async function toSitting(p) {
  await toPaper(p);
  await p.click((await p.$("#tmresume")) ? "#tmresume" : "#exampickgo"); await settled(p);
  const c = await p.$('[data-examchoose="0"]'); if (c) { await c.click(); await settled(p); }
  await p.waitForSelector("#examquit");
}

(async () => {
  const b = await chromium.launch();
  const WHO = "12Ec126 · #1234";

  console.log("--- 1. one bar on every page, and nothing of the old chrome");
  const { p, errs } = await open(b);
  const PAGES = [
    ["Study home", "Study", "Economics · Year 12", async () => {}],
    ["a Study topic", "Study", "Economics · Year 12", async () => { await p.click(".topiccard:not(.locked)"); await p.waitForSelector(".area"); }],
    ["a Study card", "Study", "Economics · Year 12", async () => { await p.click(".area"); await p.click(".mode:not([disabled])"); await p.waitForSelector("#quit"); }],
    ["Create", "Create", "", async () => { await go(p, "create"); await p.waitForSelector("#setname"); }],
    ["the Test mode library", "Test mode", "", async () => { await go(p, "test"); await p.waitForSelector(".tm-lib"); }],
    ["Test mode import", "Test mode", "", async () => { await p.click("#tmimport"); await settled(p); }],
    ["a Test mode paper", "Test mode", "Business Studies · Stage 6", async () => { await toPaper(p); }],
    ["a question-type practice", "Test mode", "Business Studies · Stage 6", async () => { await go(p, "test"); await p.click('[data-tmtypeopen="short_answer"]'); await settled(p); }],
    ["the Test mode sitting", "Test mode", "Business Studies · Stage 6", async () => { await toSitting(p); }],
    ["Essay practice", "Essay practice", "Business Studies · Year 12", async () => { await toEssay(p, "business_studies"); }],
    ["My essays", "Essay practice", "Business Studies · Year 12", async () => { await p.click('.ash-sub [data-esnav="essays"]'); await settled(p); }],
    ["Essay practice, Economics", "Essay practice", "Economics · Year 12", async () => { await p.click('.ash-sub [data-esnav="back"]'); await settled(p);
      await p.selectOption("#essubject", "economics"); await settled(p); }],
    ["the essay writing screen", "Essay practice", "Business Studies · Year 12", async () => { await p.selectOption("#essubject", "business_studies"); await settled(p); await toWriting(p); }],
  ];
  let ref = null;
  for (const [name, area, ctx, step] of PAGES) {
    await step(); await settled(p);
    const c = await chrome(p);
    ok(c.shells === 1 && c.headers === 1, name + ": exactly one bar, and it is the only header: " + JSON.stringify([c.shells, c.headers]));
    ok(c.top === 0 && c.height === 67.4, name + ": at the top of the window, 67.4px tall: " + JSON.stringify([c.top, c.height]));
    ok(c.links.join("|") === "Study|Create|Test mode|Essay practice", name + ": the four areas: " + c.links.join("|"));
    ok(c.current.length === 1 && c.current[0] === area, name + ": " + area + " is the area marked current: " + JSON.stringify(c.current));
    ok(c.ctx === ctx, name + ": the subject is " + JSON.stringify(ctx) + ": " + JSON.stringify(c.ctx));
    ok(c.who === WHO && c.out, name + ": the account and Sign out are there: " + JSON.stringify(c.who));
    ok(!c.old.length && !c.oldText, name + ": none of the old chrome: " + JSON.stringify(c.old) + (c.oldText ? " (and the old Economics unit)" : ""));
    // The bar does not move between pages: brand, links and Sign out sit where they sat.
    if (!ref) ref = c.bar;
    ok(JSON.stringify(c.bar) === JSON.stringify(ref), name + ": the bar is where it is on every page: " + JSON.stringify(c.bar));
  }

  console.log("--- 2. the pages under it keep their place");
  // Study, Create and Test mode keep their 1180px column; the overlays start
  // where the bar ends; the sitting still reaches the bottom of the window.
  {
    const q = p;
    const essay = await q.evaluate(() => {
      const bar = document.querySelector(".ash").getBoundingClientRect().bottom;
      const top = document.querySelector("#eshost .es-scrim").getBoundingClientRect().top;
      const tool = document.querySelector("#eshost .es-top").getBoundingClientRect().top;
      return { bar: Math.round(bar * 100) / 100, scrim: Math.round(top * 100) / 100, toolbar: Math.round(tool * 100) / 100,
        links: [...document.querySelectorAll("#eshost .es-top [data-esnav]")].map(e => e.dataset.esnav) };
    });
    ok(essay.scrim === essay.bar && essay.toolbar === essay.bar, "the writing screen starts where the bar ends, its toolbar first: " + JSON.stringify(essay));
    ok(["back", "essays"].every(k => essay.links.indexOf(k) >= 0), "and the toolbar keeps Essay practice's two pages: " + JSON.stringify(essay.links));
    // Two navigations on one screen, each named for what it holds.
    const navs = await q.$$eval("nav", ns => ns.map(n => n.getAttribute("aria-label")));
    ok(navs.length === 2 && new Set(navs).size === 2, "the bar's areas and the toolbar's pages are two landmarks with two names: " + JSON.stringify(navs));
    // The floating windows open under the toolbar, which now sits under the bar.
    const under = async what => q.evaluate(() => {
      const w = document.querySelector("#esstudyhost .es-study"), t = document.querySelector("#eshost .es-top");
      return w && t ? Math.round(w.getBoundingClientRect().top - t.getBoundingClientRect().bottom) : null; });
    // Learn is a tool of a paragraph, so a paragraph is opened first.
    await q.click("#eshost [data-esgo]"); await settled(q);
    await q.click('#eshost [data-estool="understand"]'); await q.waitForSelector("#esstudyhost .es-study"); await settled(q);
    const learn = await under();
    ok(learn !== null && learn >= 0, "Learn opens below the writing toolbar, not over it: " + learn + "px");
    await q.click("#esmodeswitch"); await q.waitForSelector("#esstudyhost .es-study"); await settled(q);
    const full = await under();
    ok(full !== null && full >= 0, "and stays below it on the full attempt, where it is placed without the writing columns: " + full + "px");
    await q.click("#esmodeswitch"); await settled(q);
    await q.click("#esstudyhost [data-esstudyclose]").catch(() => {}); await settled(q);
    await toEssay(q, "business_studies");
    const picker = await q.evaluate(() => {
      const b = e => document.querySelector(e).getBoundingClientRect();
      return { bar: Math.round(b(".ash").bottom * 100) / 100, page: Math.round(b(".qp").top * 100) / 100,
        grid: [b(".qp-grid").left, b(".qp-grid").width], row: b(".ash-subrow").left, brand: b(".ash-logo").left,
        current: (document.querySelector('.ash-sublink[aria-current="page"]') || {}).textContent };
    });
    ok(picker.page === picker.bar, "Essay practice's page starts where the bar ends: " + JSON.stringify(picker));
    ok(picker.grid[0] === 60 && picker.grid[1] === 1320, "its 1320px grid is where it was: " + JSON.stringify(picker.grid));
    ok(picker.row === picker.brand, "and its own row lines up with the bar's brand: " + JSON.stringify([picker.row, picker.brand]));
    ok(picker.current === "Essay practice", "with Essay practice marked: " + JSON.stringify(picker.current));
    for (const area of ["study", "create", "test"]) {
      await go(q, area);
      const col = await q.evaluate(() => { const r = document.getElementById("app").getBoundingClientRect(); return [r.left, r.width]; });
      ok(col[0] === 130 && col[1] === 1180, area + ": the page column is the 1180px it was: " + JSON.stringify(col));
    }
    await toSitting(q);
    const foot = await q.evaluate(() => { const r = document.querySelector(".tm-footer").getBoundingClientRect(); return [Math.round(r.bottom * 100) / 100, window.innerHeight,
      document.documentElement.scrollHeight]; });
    ok(Math.abs(foot[0] - foot[1]) < 0.5 && foot[2] === foot[1], "the sitting fills the window under the bar, its footer on the bottom edge: " + JSON.stringify(foot));
  }

  console.log("--- 3. moving between areas moves the mark, and the brand goes to Study");
  for (const [area, label] of [["create", "Create"], ["test", "Test mode"], ["study", "Study"], ["essay", "Essay practice"], ["test", "Test mode"]]) {
    await go(p, area);
    const c = await chrome(p);
    ok(c.current.length === 1 && c.current[0] === label, label + " is marked after pressing it: " + JSON.stringify(c.current));
    ok((await p.evaluate(() => !!document.getElementById("eshost"))) === (area === "essay"), label + ": Essay practice is open only when it is the area");
  }
  await p.click(".ash .ash-brand"); await settled(p);
  ok((await chrome(p)).current[0] === "Study" && /What are we studying/.test(await p.$eval("#app", e => e.innerText)),
    "the brand returns to the Study home");

  console.log("--- 4. the subject a writing screen names is its attempt's, not the picker's");
  // Economics ships no question bank, so its picker opens on the own-question form,
  // which carries the subject control. Start an Economics attempt there, go to My
  // essays from the draft, change the subject to Business Studies, and go back to
  // the draft: the picker now says Business Studies and the attempt is still
  // Economics. The bar has to name the attempt.
  await toEssay(p, "economics");
  await p.fill("#esq", "Explain how the distribution of income is measured in Australia.");
  await p.click("#esstart"); await p.waitForSelector("#eshost .es-top"); await settled(p);
  ok((await chrome(p)).ctx === "Economics · Year 12", "an Economics attempt is named Economics: " + (await chrome(p)).ctx);
  await p.click('#eshost .es-top [data-esnav="essays"]'); await settled(p);
  if (await p.$("#essubject")) { await p.selectOption("#essubject", "business_studies"); await settled(p); }
  const picked = await p.evaluate(() => { const s = document.getElementById("essubject"); return s ? s.value : null; });
  await p.click('#eshost [data-esnav="back"]'); await settled(p);
  const back = await chrome(p);
  ok(!!(await p.$("#eshost .es-top")), "back on the draft's writing screen");
  ok(back.ctx === "Economics · Year 12", "the bar names the attempt's subject, whatever the picker was moved to (" + picked + "): " + JSON.stringify(back.ctx));

  console.log("--- 5. Study's keys stay with Study");
  // A flash card is waiting on Space. Pressed on the bar's links, or in Essay
  // practice opened over the card, Space is not the card's.
  const toFlash = async () => { await go(p, "study"); await p.click(".topiccard:not(.locked)").catch(() => {}); await p.waitForSelector(".area"); await p.click(".area");
    await p.click('.mode[data-mode="flash"]'); await p.waitForSelector("#flip"); await settled(p); };
  const flipped = () => p.evaluate(() => { const f = document.querySelector("#app #flip"); return f ? f.classList.contains("flipped") : null; });
  await toFlash();
  await p.focus('.ash [data-shell="create"]'); await p.keyboard.press("Space"); await settled(p);
  ok((await flipped()) === false, "Space on a link in the bar does not flip the card");
  await go(p, "essay"); await p.waitForSelector("#essubject"); await p.focus("#essubject"); await p.keyboard.press("Space"); await settled(p);
  await p.keyboard.press("Escape"); await settled(p);
  ok((await flipped()) === false, "nor does Space pressed in Essay practice, with the card underneath it");
  await toFlash();
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press("Space"); await settled(p);
  ok((await flipped()) === true, "the card still flips on Space when nothing else has it");
  await p.focus('.ash [data-shell="create"]'); await p.keyboard.press("Enter"); await settled(p);
  ok((await chrome(p)).current[0] === "Create", "and Enter on a link in the bar follows the link");

  console.log("--- 5b. a marking reply for a card the student has left lands nowhere");
  {
    // The marker answers slowly, and the bar lets the student leave while it is
    // out. Its reply has no card to land on and must not throw on the page they
    // went to.
    const t = await open(b);
    let asked = 0;
    await t.p.unroute(/workers\.dev/);
    await t.p.route(/workers\.dev/, async r => { asked++; await new Promise(res => setTimeout(res, 1500)); r.abort().catch(() => {}); });
    await t.p.click(".topiccard:not(.locked)"); await t.p.waitForSelector(".area");
    const n = await t.p.$$eval(".area", es => es.length);
    let found = false;
    for (let i = 0; i < n && !found; i++) {
      await t.p.$$eval(".area", (es, i) => es[i].click(), i); await settled(t.p);
      if (await t.p.$('.mode[data-mode="long"]:not([disabled])')) found = true;
      else { await t.p.click("#quit"); await t.p.waitForSelector(".area"); }
    }
    ok(found, "a Study area offers long answers");
    if (found) {
      await t.p.click('.mode[data-mode="long"]'); await t.p.waitForSelector("#ans");
      await t.p.fill("#ans", "Progressive taxation narrows the gap between high and low incomes because higher earners pay a larger share.");
      await t.p.click("#check");
      await go(t.p, "create"); await t.p.waitForSelector("#setname");
      await t.p.waitForTimeout(2200);
      ok(asked >= 1, "the answer went to the marker: " + asked + " request(s)");
      ok(!t.errs.length, "and its late reply threw nothing: " + JSON.stringify(t.errs));
      ok((await chrome(t.p)).current[0] === "Create" && !!(await t.p.$("#setname")), "the student is still on Create");
    }
    await t.ctx.close();
  }

  console.log("--- 6. Sign out leaves wherever the student is");
  await toEssay(p, "business_studies"); await toWriting(p);
  await p.click("#eshost [data-esgo]"); await settled(p);
  await p.click('#eshost [data-esnbtoggle]'); await p.waitForSelector("#esnbhost .es-nb", { state: "attached" }); await settled(p);
  await p.click(".ash .ash-out");
  await p.waitForSelector("#ado", { timeout: 8000 }); await settled(p);
  const out = await p.evaluate(() => ({ essay: !!document.getElementById("eshost"), lock: document.body.classList.contains("es-lock"),
    tm: document.body.classList.contains("tm-on"), calls: window.__cloud.signOuts, html: document.getElementById("ash").innerHTML }));
  ok(out.calls === 1, "Sign out signs out, once: " + out.calls);
  ok(!out.essay && !out.lock, "Essay practice is closed, not left over the sign-in page: " + JSON.stringify(out));
  ok(await p.evaluate(() => !document.getElementById("esnbhost") && !document.getElementById("esstudyhost")),
    "and the notebook the student had open is gone with it, not floating over the sign-in page");
  const signedOut = await chrome(p);
  ok(signedOut.shells === 1 && !signedOut.links.length && !signedOut.who && !signedOut.out, "the bar is the brand alone: " + JSON.stringify(signedOut));
  // The signed-out bar is what index.html writes before any script runs, exactly.
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const skeleton = (html.match(/<header class="ash" id="ash">([\s\S]*?)<\/header>/) || [])[1];
  const same = await p.evaluate(s => { const d = document.createElement("div"); d.innerHTML = s; return d.innerHTML === document.getElementById("ash").innerHTML; }, skeleton || "");
  ok(!!skeleton && same, "and it is index.html's own bar, markup for markup");
  {
    const t = await open(b);
    await toPaper(t.p);
    await t.p.click(".ash .ash-out"); await t.p.waitForSelector("#ado"); await settled(t.p);
    ok(await t.p.evaluate(() => !document.body.classList.contains("tm-on") && window.__cloud.signOuts === 1), "Sign out from Test mode leaves Test mode behind too");
    ok(!t.errs.length, "no page errors signing out of Test mode: " + JSON.stringify(t.errs));
    await t.ctx.close();
  }
  {
    const t = await open(b, { signedIn: false });
    const c = await chrome(t.p);
    ok(c.shells === 1 && !c.links.length && !c.who, "a student not signed in sees the brand alone: " + JSON.stringify(c));
    ok(await t.p.evaluate(s => { const d = document.createElement("div"); d.innerHTML = s; return d.innerHTML === document.getElementById("ash").innerHTML; }, skeleton || ""),
      "the same bar index.html writes");
    await t.ctx.close();
  }
  ok(!errs.length, "no page errors on any page: " + JSON.stringify(errs));

  console.log("--- 7. 1024px and up the whole bar; 861px to 1023px the same bar without the subject");
  for (const [name, opts, step, ctx] of [
    ["a Test mode paper", {}, toPaper, "Business Studies · Stage 6"],
    ["Essay practice's demo route", { query: "?essaydemo=1" }, async q => { await q.waitForSelector("#eshost .qp"); await settled(q); }, "Ancient History · Year 11"],
    ["the demo route, with a nine-digit student number", { query: "?essaydemo=1", number: "123456789" }, async q => { await q.waitForSelector("#eshost .qp"); await settled(q); }, "Ancient History · Year 11"],
  ]) {
    const t = await open(b, opts);
    await step(t.p);
    ok((await chrome(t.p)).ctx === ctx, name + ": the bar names " + ctx);
    const long = !!opts.number && opts.number.length > 4;
    for (const w of [1024, 1023, 861]) {
      await atWidth(t.p, w);
      const f = await fits(t.p);
      ok(f.oneRow, name + " at " + w + "px: one row, the bar's full height, nothing overlapping: " + JSON.stringify(f));
      if (w === 1024) ok(f.subject === true || (long && f.subject === false), name + " at 1024px: the subject is on the bar" + (long ? "" : ", in full") + ": " + f.subject);
      else ok(f.subject === null, name + " at " + w + "px: the subject is left out: " + f.subject);
      ok(f.signOut && (f.account === true || (long && w < 1024 && f.account === false)), name + " at " + w + "px: the account and Sign out stay: " + JSON.stringify([f.account, f.signOut]));
      if (opts.query) ok(f.demo, name + " at " + w + "px: and so does the demo badge");
    }
    await t.ctx.close();
  }

  console.log("--- 8. the bar is the approved drawing");
  // The CSS is the drawing's, rule for rule, less its drawing aid.
  const drawn = fs.readFileSync(path.join(MOCK, "00-app-shell.html"), "utf8").match(/<style id="ash-css">\n([\s\S]*?)<\/style>/)[1];
  const approved = drawn.slice(0, drawn.indexOf("/* Drawing aid only:")).trim();
  const block = html.slice(html.indexOf("/* THE SHARED APP SHELL (proposed)."), html.indexOf("</style>"));
  const norm = s => s.split("\n").map(l => l.trim()).filter(Boolean).join("\n");
  ok(approved.length > 2000 && norm(block) === norm(approved), "index.html carries the approved drawing's shell CSS, unchanged: " + block.length + " vs " + approved.length);
  // And it draws the same bar, to the pixel, where the drawing and the app say
  // the same things: the Study home, and the paper with its Stage 6.
  for (const [file, name, step] of [["00-app-shell.html", "the Study home", async () => {}], ["00-app-shell-test-paper.html", "a Test mode paper", toPaper]]) {
    const t = await open(b);
    await step(t.p); await t.p.mouse.move(2, 2); await settled(t.p);
    const live = await t.p.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 68 } });
    const d = await t.ctx.newPage(); await serveFonts(d);
    await d.goto("file://" + path.join(MOCK, file)); await d.evaluate(() => document.fonts.ready); await d.mouse.move(2, 2); await settled(d);
    const pic = await d.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 68 } });
    const n = await diffPixels(d, live, pic);
    ok(n === 0, name + ": the app's bar and the approved drawing's differ by " + n + " pixels");
    await t.ctx.close();
  }

  console.log("--- 9. a set the student made names no subject");
  {
    const set = { id: "shell-set", name: "My own set", cards: [{ id: "shell-c1", type: "define", prompt: "Define a term.", model: "A definition.", marks: 2 }] };
    // Added to what the walkthrough stored on its first load, so its own seeding
    // (which writes only when no paper is stored) leaves the set alone.
    const t = await open(b, { cloud: false });
    await t.p.evaluate(s => { const raw = JSON.parse(localStorage.getItem("marginal.trial.v1") || "{}");
      raw.customSets = [s]; localStorage.setItem("marginal.trial.v1", JSON.stringify(raw)); }, set);
    await t.p.reload(); await t.p.waitForSelector(".ash-link"); await settled(t.p);
    const home = await chrome(t.p);
    ok(home.ctx === "Economics · Year 12" && !home.who && !home.out, "with cloud sign-in off: Study names its course, and there is no account: " + JSON.stringify(home));
    await t.p.click('[data-open="shell-set"]'); await settled(t.p);
    const own = await chrome(t.p);
    ok(own.current[0] === "Study" && own.ctx === "", "the student's own set is Study, and names no subject: " + JSON.stringify(own));
    await t.ctx.close();
  }

  console.log("--- 10. Essay practice switched off, opened by its demo route");
  {
    // The bar offers Essay practice when it is switched on, and always while it is
    // the open area: the demo route opens it with the switch off.
    const t = await open(b, { essayMode: false });
    ok((await chrome(t.p)).links.join("|") === "Study|Create|Test mode", "switched off, the bar offers three areas");
    await t.ctx.close();
    const d = await open(b, { essayMode: false, query: "?essaydemo=1" });
    await d.p.waitForSelector("#eshost .qp"); await settled(d.p);
    const c = await chrome(d.p);
    ok(c.current.length === 1 && c.current[0] === "Essay practice", "on its demo route Essay practice is on the bar, marked: " + JSON.stringify(c));
    await d.ctx.close();
  }

  console.log("--- 11. a question imported after the app opened is there when Essay practice opens");
  {
    // The app reads its question registry, imports included, once per page. The
    // bar names Study's course on the first page, so it must not be what reads it:
    // a teacher importing in another tab would otherwise wait for a reload.
    const t = await open(b, { cloud: false });
    const r = await publishThroughImporter(t.ctx);
    ok(r && r.outcome === "written", "a question was published through the importer: " + (r && r.outcome));
    await toEssay(t.p, "business_studies"); await usePractice(t.p);
    const rows = (await allRows(t.p)).map(x => x.id);
    ok(rows.indexOf("bus-ext-ops-01") >= 0, "the page opened before it offers it: " + rows.length + " rows");
    await t.ctx.close();
  }

  console.log("--- 12. where scrollbars take up room, the bar does not move");
  {
    // Classic scrollbars, as on Windows. A page that scrolls and one that does not,
    // and Essay practice locking the page under it, must not move the brand, and
    // Essay practice's own row lines up with it.
    const sb = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
    const ctx = await sb.newContext({ viewport: { width: 1440, height: 900 } });
    const q = await ctx.newPage(); await serveFonts(q);
    await q.route(/workers\.dev/, r => r.abort());
    await q.goto(T); await q.waitForSelector(".ash-link"); await settled(q);
    const at = () => q.evaluate(() => ({ brand: document.querySelector(".ash-logo").getBoundingClientRect().left,
      row: (document.querySelector(".ash-subrow") || { getBoundingClientRect: () => ({ left: null }) }).getBoundingClientRect().left,
      gutter: window.innerWidth - document.documentElement.clientWidth }));
    const seen = { study: await at() };
    await go(q, "create"); seen.create = await at();
    await toEssay(q, "business_studies"); seen.essay = await at();
    await q.click('.ash-sub [data-esnav="essays"]'); await settled(q); seen.essays = await at();
    ok(seen.create.gutter > 0, "the long Create page has a scrollbar taking room: " + seen.create.gutter + "px");
    ok(new Set(Object.values(seen).map(x => x.brand)).size === 1, "the brand sits at one place on every page: " + JSON.stringify(seen));
    ok(seen.essay.row === seen.essay.brand && seen.essays.row === seen.essays.brand, "and Essay practice's row lines up with it: " + JSON.stringify([seen.essay, seen.essays]));
    await sb.close();
  }

  console.log("");
  console.log(pass + " passed, " + fail + " failed");
  await b.close();
  process.exit(fail ? 1 : 0);
})();
