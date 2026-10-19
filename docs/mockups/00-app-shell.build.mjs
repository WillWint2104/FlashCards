// THE SHARED APP SHELL, DRAWN AROUND THE PAGES IT FRAMES (approved, with the owner's
// locked decisions applied: see 00-app-shell-rationale.md).
//
// PINNED TO THE PRE-MIGRATION BUILD. It strips the old chrome from the running
// app, so it runs only against a build that still has it (main at 1d14abd, before
// the shell was implemented). The drawings it made are the approved design and the
// baseline the implementation was checked against; they are not regenerated from a
// build that already has the shell.
//
// One header for every Marginal surface, in the Essay practice bar's own visual
// language (index.html .qp-navin, .qp-brand, .qp-logo, .qp-word, .qp-navlink,
// .qp-subj, .es-util.quiet), drawn around the REAL pages rather than redrawings of
// them. Each page below the bar is captured from the running walkthrough build
// (tests/out/marginal-walkthrough.html, made by tests/mkwalk.py from the committed
// marginal-preview.html).
//
// What the build does to a page, and nothing else (it stops if anything else is
// removed):
//   removes  the static <header> with its hard-coded Economics unit and the pill
//            switcher (div.nav); on Essay practice also the old header.qp-nav, and
//            the old header, pill and Study page (#app) the app leaves underneath
//            that overlay. The walkthrough runs with cloud sign-in off, so there is
//            no signed-in row (.whoami) to remove: the build checks it is absent,
//            and the account in the bar is drawn, from a sample;
//   inserts  the one bar; on Essay practice also the area's own row (.ash-sub) at
//            the top of .qp-main;
//   restyles nothing in a page. One drawing aid: the Essay practice overlay is
//            made static (body.ash-drawing .qp) so the drawing scrolls as a page.
//
// What it proves:
//   1. the page under the bar is unchanged: every content element keeps its left,
//      width and height, and moves by one vertical offset, the change in chrome;
//   2. the static file renders as the page did: every element's box identical, and
//      every pixel identical;
//   3. one bar: the same geometry on every page; at 1024px, one row with every
//      subject it can name shown in full; from 861px to 1023px, one row with the
//      subject left out; it also measures the narrowest window that holds it.
// And that pruning kept every [open] rule a drawn <details> can use once opened.
//
// Subject context is read the way the shell would read it: by key, through the
// subject registry, and resolveAuthority from tools/contract/assessment.js for a
// paper. See 00-app-shell-rationale.md.
//
// usage: node docs/mockups/00-app-shell.build.mjs
//   MOCKUP_OUT=dir    write the drawings somewhere else (default: this folder)
//   MOCKUP_SHOTS=dir  also write a 1440px PNG of each drawing there
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "..", "..");
const OUT = process.env.MOCKUP_OUT || HERE;
const SHOTS = process.env.MOCKUP_SHOTS || null;
const fail = m => { throw new Error(m); };

// ---- subject context, by key, from the registry the app uses --------------------------------
// The app's registry is esAllSubjects().subjects: the shipped packages
// (window.ESSAY.subjects) plus any imported subjects. The walkthrough build imports
// none, so here the two are the same object.
const loadWindow = f => { const w = {}; new Function("window", fs.readFileSync(path.join(ROOT, f), "utf8"))(w); return w; };
const PACKAGES = loadWindow("essay-content.js").ESSAY.subjects;
const CONTENT = loadWindow("content.js").CONTENT;
const ASSESS = require(path.join(ROOT, "tools/contract/assessment.js"));
const PAPER = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/bus-practice-paper.json"), "utf8"));
const contextOf = key => { const p = PACKAGES[key]; return p ? [p.label, p.stage].filter(Boolean).join(" · ") : ""; };
// Test mode, a paper open: the most specific authoritative context the paper
// supplies. Its subject is the label its own key resolves to, and its stage is the
// one the paper declares ("Stage 6"), never the package's "Year 12" (locked
// decision). A paper whose subject does not resolve names nothing.
const CURR = ASSESS.curriculumOf(PAPER);
const auth = ASSESS.resolveAuthority({ curriculum: CURR, packages: PACKAGES });
if (!auth.ok) fail("the practice paper's subject did not resolve: " + auth.code);
// Study: content.js declares no key today. The proposal is one declared key,
// CONTENT.subjectKey = "economics", read through the same registry; never a match on
// the label. The check below only proves the proposal names the subject Study shows.
if (PACKAGES.economics.label !== CONTENT.subject) fail("the proposed Study key does not name the subject Study shows");
const CTX = { study: contextOf("economics"), paper: [auth.label, CURR.stage].filter(Boolean).join(" · ") };
if (CTX.paper !== "Business Studies · Stage 6") fail("the paper's context is not its declared stage: " + CTX.paper);
// The account, as cloudBarHTML() shows it today: class code and student number. A
// sample number, not anyone's.
const WHO = "12Ec126 · #1234";

// ---- the shell ------------------------------------------------------------------------------
const ICO = {
  exit: '<path d="m16 17 5-5-5-5" /> <path d="M21 12H9" /> <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />', // app.js ES_ICON_SRC.exit (lucide log-out)
  user: '<path d="M18 20a6 6 0 0 0-12 0" /> <circle cx="12" cy="10" r="4" /> <circle cx="12" cy="12" r="10" />', // lucide circle-user-round
};
const icon = n => `<svg class="ash-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICO[n]}</svg>`;
const SECTIONS = [["study", "Study"], ["create", "Create"], ["test", "Test mode"], ["essay", "Essay practice"]];
function shellHTML({ on, ctx, states = {}, account = true, demo = false }) {
  const cls = (base, k) => base + (states[k] ? " is-" + states[k] : "");
  const context = ctx ? `<span class="ash-ctx">${ctx}</span>${demo ? '<span class="ash-demo">demo</span>' : ""}` : "";
  const who = account ? `<span class="ash-who">${icon("user")}<span title="${WHO}">${WHO}</span></span><button type="button" class="${cls("ash-out", "out")}">${icon("exit")}<span>Sign out</span></button>` : "";
  return `<header class="ash"><div class="ash-in">
  <a class="${cls("ash-brand", "brand")}" href="#study" aria-label="Marginal, Study home"><span class="ash-logo" aria-hidden="true">M</span><span class="ash-word">Marginal</span></a>
  <nav class="ash-links" aria-label="Marginal">${SECTIONS.map(([k, label]) =>
    `<a class="${cls("ash-link", k)}" href="#${k}" data-label="${label}"${k === on ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>
  <div class="ash-right">${context}${context && who ? '<span class="ash-sep" aria-hidden="true"></span>' : ""}${who}</div>
</div></header>`;
}
function subnavHTML(on, states = {}) {
  return `<nav class="ash-sub" aria-label="Essay practice"><div class="ash-subin"><div class="ash-subrow">${
    [["practice", "Essay practice"], ["essays", "My essays"]].map(([k, label]) =>
      `<a class="ash-sublink${states[k] ? " is-" + states[k] : ""}" href="#${k}" data-label="${label}"${k === on ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</div></div></nav>`;
}
const SHELL_CSS = `/* THE SHARED APP SHELL (proposed). One bar on every page, in the Essay practice
   bar's tokens and geometry: index.html .qp-navin, .qp-brand, .qp-logo, .qp-word,
   .qp-navlink, .qp-subj and .es-util.quiet. Deliberate differences: context and
   account text are --a-ink2 (4.64:1), not .qp-subj's #95A7AD (2.50:1); every
   control gets a focus ring, in --a-green-dk (3.73:1) because --a-green is 2.74:1;
   the area links below the bar are #5D7178 (4.84:1 on the page ground); a link
   keeps its bold width, so the bar does not shift between pages; and the bar is
   sticky, as the app's header and the Essay writing bar are, where the Essay
   picker bar scrolls away. */
.ash{--a-ink:#18272D;--a-ink2:#63787F;--a-green:#12B27A;--a-green-dk:#0E9765;--a-line:#E8EEEF;--a-sunk:#FAFCFC;
  display:block;position:sticky;top:0;z-index:20;max-width:none;gap:0;padding:0;
  background:#FFFFFF;border-bottom:1px solid var(--a-line);font-family:'Nunito',system-ui,sans-serif;line-height:1.6;color:var(--a-ink)}
.ash-in{max-width:1320px;margin:0 auto;padding:13px 28px;display:flex;align-items:center;gap:16px}
.ash-brand{display:inline-flex;align-items:center;gap:10px;padding:4px 6px;margin-left:-6px;border-radius:10px;color:inherit;text-decoration:none}
.ash-brand:hover .ash-word,.ash-brand.is-hover .ash-word{color:var(--a-green-dk)}
.ash-brand:focus-visible,.ash-brand.is-focus{outline:2px solid var(--a-green-dk);outline-offset:2px}
.ash-logo{width:30px;height:30px;border-radius:9px;background:var(--a-green);color:#fff;display:grid;place-items:center;font-family:'Fredoka',system-ui,sans-serif;font-weight:700;font-size:16px;line-height:1}
.ash-word{font-family:'Fredoka',system-ui,sans-serif;font-weight:700;font-size:18px;letter-spacing:-.3px;color:var(--a-ink)}
.ash-links{display:flex;gap:4px;margin-left:14px}
.ash-link{display:inline-flex;flex-direction:column;align-items:center;font:600 14px/1.6 'Nunito',system-ui,sans-serif;color:var(--a-ink2);padding:8px 10px;border-bottom:2.5px solid transparent;text-decoration:none;white-space:nowrap}
/* Each link holds its bold width, so the current section's weight never moves its
   neighbours: the bar is identical, to the pixel, whichever page is open. */
.ash-link::after,.ash-sublink::after{content:attr(data-label);font-weight:700;height:0;overflow:hidden;visibility:hidden;user-select:none;pointer-events:none}
.ash-link:hover,.ash-link.is-hover{color:var(--a-ink)}
.ash-link[aria-current="page"]{color:var(--a-ink);font-weight:700;border-bottom-color:var(--a-green)}
.ash-link:focus-visible,.ash-link.is-focus{outline:2px solid var(--a-green-dk);outline-offset:2px;border-radius:6px}
.ash-right{margin-left:auto;display:flex;align-items:center;gap:14px;min-width:0}
.ash-right > *{flex:none}
/* Nothing on the right may push the bar past one row. The subject is display
   context, so it is what shortens. The account never shortens while a subject is
   there to give way; its student number is free text of any length, so it has a
   ceiling, and below 1024px, where the subject is left out, it may shorten too.
   Shortened or not, its full value is its title. */
.ash-right > .ash-ctx{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
.ash-who > span{min-width:0;max-width:28ch;overflow:hidden;text-overflow:ellipsis}
.ash-ctx{font-size:13px;font-weight:600;color:var(--a-ink2);white-space:nowrap}
.ash-demo{margin-left:-6px;font-family:'Fredoka',system-ui,sans-serif;font-weight:600;font-size:11px;color:#0E7A4E;background:#E7F8F0;border-radius:99px;padding:2px 10px}
.ash-sep{width:1px;height:20px;background:var(--a-line);flex:none}
.ash-who{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:var(--a-ink2);white-space:nowrap}
.ash-ico{width:17px;height:17px;flex:none}
.ash-out{display:inline-flex;align-items:center;gap:8px;margin-right:-14px;background:none;border:1px solid transparent;border-radius:11px;padding:8px 14px;font:600 13.5px/1.6 'Nunito',system-ui,sans-serif;color:var(--a-ink2);cursor:pointer}
.ash-out:hover,.ash-out.is-hover{background:var(--a-sunk);border-color:var(--a-line);color:var(--a-ink)}
.ash-out:hover .ash-ico,.ash-out.is-hover .ash-ico{color:var(--a-green-dk)}
.ash-out:focus-visible,.ash-out.is-focus{outline:2px solid var(--a-green-dk);outline-offset:2px}
/* An area's own navigation, below the bar and inside the page: Essay practice only. */
.ash-sub{font-family:'Nunito',system-ui,sans-serif;line-height:1.6}
.ash-subin{max-width:1320px;margin:0 auto;padding:18px 28px 0}
.ash-subrow{display:flex;gap:24px;border-bottom:1px solid var(--e-line,#E8EEEF)}
.ash-sublink{display:inline-flex;flex-direction:column;align-items:center;font-size:14px;font-weight:600;color:#5D7178;padding:4px 0 10px;margin-bottom:-1px;border-bottom:2.5px solid transparent;text-decoration:none}
.ash-sublink:hover,.ash-sublink.is-hover{color:#18272D}
.ash-sublink[aria-current="page"]{color:#18272D;font-weight:700;border-bottom-color:#12B27A}
.ash-sublink:focus-visible,.ash-sublink.is-focus{outline:2px solid #0E9765;outline-offset:2px;border-radius:6px}
/* From 861px to 1023px the bar keeps the brand, the four sections, the account and
   Sign out, and leaves out the subject, which is display only. */
@media (max-width:1023px){
  .ash-ctx,.ash-ctx + .ash-sep{display:none}
  .ash-right > .ash-who{flex:0 1 auto;min-width:0}
}
/* At 860px and below the shell has no designed treatment yet: that is the mobile
   phase. It only wraps, so nothing is cut off or scrolls the page sideways. */
@media (max-width:860px){
  .ash-in{flex-wrap:wrap;row-gap:4px;padding:10px 16px}
  .ash-links{order:3;flex:1 0 100%;margin-left:0;overflow-x:auto}
}
/* Drawing aid only: the essay surface is a fixed overlay in the app; in a drawing it
   is the page, so it scrolls with the document. */
body.ash-drawing.es-lock{overflow:visible}
body.ash-drawing .qp{position:static;overflow:visible;min-height:100vh}`;
if (/—/.test(SHELL_CSS + shellHTML({ on: "study", ctx: CTX.study }) + subnavHTML("practice"))) fail("an em dash in the shell");

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap" rel="stylesheet">`;

// ---- the pages ------------------------------------------------------------------------------
const DRAFT = (id, question, topic, questionId, mastered, t) => ({ id, subject: "business_studies", code: "12Ec126", questionSubject: "business_studies",
  question, topic, rubric: "", marks: 20, questionId, command: question.split(" ")[0], structure: "six", paraModel: "teeec",
  paras: ["Introduction", "Body 1", "Body 2", "Body 3", "Body 4", "Conclusion"].map((role, i) => ({ role, point: "", text: "", feedback: null, gradedText: null,
    mastered: i < mastered, area: "", argumentId: null, ownArgument: "", evidenceIds: [], setupDone: false, contextVersion: 0, blocks: null, blocksFrom: null, step: 0 })),
  mode: "coached", pos: 0, createdAt: t, updatedAt: t });
const ESSAYS = { "business_studies|12Ec126": { drafts: [
  DRAFT("mock-e1", "Explain how target markets affect e-marketing, people, processes and physical evidence.", "Marketing", "mkt-01", 2, "2026-10-18T09:00:00.000Z"),
  DRAFT("mock-e2", "Evaluate the effectiveness of human resource strategies in improving business performance.", "Human Resources", "hr-01", 0, "2026-10-17T15:30:00.000Z")] } };

const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
// Entrance animations run to the end before anything is captured.
const still = p => p.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
const ESSAY_KEY = "business_studies";
async function openEssay(p) {
  await p.click('.navtab[data-v="essay"]'); await p.waitForSelector("#essubject");
  await p.selectOption("#essubject", ESSAY_KEY);
  await p.waitForFunction(() => /Set up your essay/.test((document.querySelector(".qp-h1") || {}).textContent || ""));
}
const PAGES = [
  { file: "00-app-shell.html", title: "Study", on: "study", ctx: CTX.study, what: "The Study home",
    go: async p => {} },
  { file: "00-app-shell-create.html", title: "Create", on: "create", ctx: "", what: "Create",
    go: async p => { await p.click('.navtab[data-v="create"]'); await p.waitForSelector("#setname"); } },
  { file: "00-app-shell-test.html", title: "Test mode", on: "test", ctx: "", what: "The Test mode library, with the practice paper imported",
    go: async p => { await p.click('.navtab[data-v="test"]'); await p.waitForSelector(".tm-lib .tm-paper"); } },
  { file: "00-app-shell-test-paper.html", title: "Test mode · Business Studies practice paper", on: "test", ctx: CTX.paper, what: "The practice paper's overview in Test mode",
    go: async p => { await p.click('.navtab[data-v="test"]'); await p.waitForSelector(".tm-lib .tm-paper"); await p.click(".tm-paper [data-tmopen]");
      await p.waitForFunction(() => /Business Studies practice paper/.test((document.querySelector("#app h1") || {}).textContent || "")); } },
  { file: "00-app-shell-essay.html", title: "Essay practice", on: "essay", ctx: null, sub: "practice", what: "Essay practice, Business Studies chosen",
    go: openEssay },
  { file: "00-app-shell-essays.html", title: "My essays", on: "essay", ctx: null, sub: "essays", what: "My essays, with two essays saved",
    go: async p => { await openEssay(p); await p.click('.qp-nav [data-esnav="essays"]');
      await p.waitForFunction(() => /My essays/.test((document.querySelector(".qp-h1") || {}).textContent || "")); } },
];

// The old chrome, and nothing else, comes off. Returns what it removed.
function strip({ shell, sub }) {
  const removed = [];
  const rm = n => { removed.push(n.tagName.toLowerCase() + (n.className ? "." + String(n.className).trim().split(/\s+/).join(".") : "")); n.remove(); };
  document.querySelectorAll("body > header").forEach(rm);
  document.querySelectorAll("#app div.nav").forEach(n => { if (n.querySelector(".navtab")) rm(n); });
  const qp = document.querySelector("#eshost .qp");
  if (qp) {
    const old = qp.querySelector(":scope > header.qp-nav");
    old.insertAdjacentHTML("beforebegin", shell); rm(old);
    qp.querySelector(".qp-main").insertAdjacentHTML("afterbegin", sub);
    const app = document.getElementById("app"); if (app) rm(app); // hidden under the overlay in the app
  } else {
    document.body.insertAdjacentHTML("afterbegin", shell);
  }
  document.body.classList.add("ash-drawing");
  return removed;
}
// The rules of the page's own stylesheet that something on the page uses, with
// states and pseudo-elements kept whenever their element is there.
function pageCSS() {
  const dyn = /::?(before|after|placeholder|selection|marker|-webkit-[\w-]+|-moz-[\w-]+)|:(hover|focus-visible|focus-within|focus|active|visited|checked|disabled|enabled|indeterminate|invalid|valid|required|optional|read-only|read-write|placeholder-shown|target|open)\b|\[open\]/g;
  const used = sel => sel.split(",").some(s => { const b = s.replace(dyn, "").trim(); if (!b) return true; try { return !!document.querySelector(b); } catch (e) { return true; } });
  const walk = rules => { const acc = []; for (const r of rules) {
    if (r.type === CSSRule.STYLE_RULE) { if (used(r.selectorText)) acc.push(r.cssText); }
    else if (r.type === CSSRule.MEDIA_RULE || r.type === CSSRule.SUPPORTS_RULE) { const inner = walk(r.cssRules); if (inner.length) acc.push((r.type === CSSRule.MEDIA_RULE ? "@media " : "@supports ") + r.conditionText + " {\n" + inner.join("\n") + "\n}"); }
    else acc.push(r.cssText); } return acc; };
  const out = [];
  for (const sh of document.styleSheets) {
    if (sh.href || (sh.ownerNode && sh.ownerNode.id === "ash-css")) continue;
    let rules; try { rules = sh.cssRules; } catch (e) { continue; }
    out.push(...walk(rules));
  }
  return out.join("\n");
}
// Every style rule of the page's own stylesheet that names an open <details>, read
// from the live page before pruning, so the check below does not share pageCSS's
// selector test.
function openRules() {
  const acc = [];
  const walk = rules => { for (const r of rules) {
    if (r.type === CSSRule.STYLE_RULE) { if (/\[open\]|:open\b/.test(r.selectorText)) acc.push([r.selectorText, r.cssText]); }
    else if (r.cssRules) walk(r.cssRules); } };
  for (const sh of document.styleSheets) {
    if (sh.href || (sh.ownerNode && sh.ownerNode.id === "ash-css")) continue;
    try { walk(sh.cssRules); } catch (e) {}
  }
  return acc;
}
// In the drawing, with every <details> opened: the [open] rules that then match
// something must all be in the drawing's CSS.
function openRulesKept({ rules, css }) {
  const details = [...document.querySelectorAll("details")];
  details.forEach(d => { d.open = true; });
  const user = /::?(before|after|marker|placeholder|selection|-webkit-[\w-]+|-moz-[\w-]+)|:(hover|focus-visible|focus-within|focus|active)\b/g;
  const live = rules.filter(([sel]) => sel.split(",").some(s => { const b = s.replace(user, "").trim(); try { return !!b && !!document.querySelector(b); } catch (e) { return false; } }));
  return { details: details.length, applies: live.length, missing: live.filter(([, text]) => !css.includes(text)).map(([sel]) => sel) };
}
// Whether the bar holds one row at the current width: every link on one line, the
// bar its full height, and nothing in it overflowing or overlapping.
function barFits(height) {
  const h = document.querySelector(".ash"), inn = h.querySelector(".ash-in"), right = h.querySelector(".ash-right");
  const box = e => e.getBoundingClientRect();
  // What is not displayed (the subject below 1024px) has no box to place.
  const shown = [...right.children].filter(e => getComputedStyle(e).display !== "none");
  const links = [...h.querySelectorAll(".ash-link")].map(box), items = shown.map(box), last = shown[shown.length - 1];
  // Sign out's negative right margin puts its text, not its padding, on the content
  // edge. Past that margin, nothing may stick out of the right-hand group.
  const end = last ? box(last).right + parseFloat(getComputedStyle(last).marginRight) : 0;
  return new Set(links.map(l => Math.round(l.top))).size === 1
    && Math.round(box(h).height * 10) / 10 === height
    && inn.scrollWidth <= inn.clientWidth
    && box(h.querySelector(".ash-brand")).right <= links[0].left
    && (!items.length || links[links.length - 1].right <= items[0].left)
    && items.every((r, i) => !i || items[i - 1].right <= r.left)
    && (!last || end <= box(right).right + 0.5);
}
function bodyOf() {
  // innerHTML does not carry form state: what a script chose or typed is written
  // back as markup, so the drawing shows the same choices as the page.
  document.querySelectorAll("select").forEach(s => [...s.options].forEach(o => o.toggleAttribute("selected", o.selected)));
  document.querySelectorAll("input").forEach(i => { if (i.type === "checkbox" || i.type === "radio") i.toggleAttribute("checked", i.checked); else i.setAttribute("value", i.value); });
  document.querySelectorAll("textarea").forEach(t => { t.textContent = t.value; });
  const c = document.body.cloneNode(true);
  c.querySelectorAll("script, noscript, template, .toast").forEach(n => n.remove());
  return { cls: document.body.className, html: c.innerHTML.replace(/\n\s*\n/g, "\n") };
}
function geometry() {
  const r = e => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(v => Math.round(v * 10) / 10); };
  const h = document.querySelector(".ash");
  return { bar: r(h), brand: r(h.querySelector(".ash-brand")), links: [...h.querySelectorAll(".ash-link")].map(r), out: r(h.querySelector(".ash-out")) };
}
// Every element's box [name, left, top, width, height], in document order.
function boxes() {
  const name = e => e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).join(".") : "");
  const r2 = v => Math.round(v * 1000) / 1000;
  return [...document.querySelectorAll("body *")].filter(e => !e.closest("script, noscript, template, .toast"))
    .map(e => { const b = e.getBoundingClientRect(); return [name(e), r2(b.left), r2(b.top), r2(b.width), r2(b.height)]; });
}
// The page's own content, without any chrome, in groups that each move as one:
// #app; or on Essay practice the overlay's main, and its footer, which the overlay's
// full-height column keeps at the bottom of the screen until the page outgrows it.
function contentBoxes() {
  const name = e => e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).join(".") : "");
  const r2 = v => Math.round(v * 1000) / 1000;
  const qp = document.querySelector("#eshost .qp");
  const roots = qp ? [...qp.querySelectorAll(".qp-main, .qp-foot")] : [document.getElementById("app")];
  return roots.map(r => [...r.querySelectorAll("*")].filter(e => !e.closest(".ash-sub, div.nav, script, noscript, template, .toast"))
    .map(e => { const b = e.getBoundingClientRect(); return [name(e), r2(b.left), r2(b.top), r2(b.width), r2(b.height)]; }));
}
// Same element list; same left, width and height; tops moved by one offset.
function sameContent(before, after) {
  if (before.length !== after.length) return { ok: false, why: "elements " + before.length + " vs " + after.length };
  const dy = after.length ? after[0][2] - before[0][2] : 0;
  for (let k = 0; k < before.length; k++) {
    const x = before[k], y = after[k];
    // A hidden element has no box to move: it has to stay hidden, and that is all.
    if (x[3] === 0 && x[4] === 0) { if (x[0] !== y[0] || y[3] !== 0 || y[4] !== 0) return { ok: false, why: "hidden element " + k + " changed: " + JSON.stringify({ before: x, after: y }) }; continue; }
    if (x[0] !== y[0] || Math.abs(x[1] - y[1]) > 0.01 || Math.abs(x[3] - y[3]) > 0.01 || Math.abs(x[4] - y[4]) > 0.01 || Math.abs((y[2] - x[2]) - dy) > 0.01)
      return { ok: false, why: "element " + k + " changed: " + JSON.stringify({ before: x, after: y, dy }) };
  }
  return { ok: true, dy: Math.round(dy * 100) / 100, elements: before.length };
}
function staticPage({ title, what, css, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Marginal · ${title}</title>
<!-- The proposed shared app shell, awaiting approval. Generated by 00-app-shell.build.mjs: do not edit by hand.
     Below the bar: ${what}, captured from the running app (walkthrough build). Only the old chrome was removed. -->
${FONTS}
<style>
/* The page's own rules: the rules of index.html that this page uses. */
${css}
</style>
<style id="ash-css">
${SHELL_CSS}
</style>
</head>
<body class="${body.cls}">
${body.html}
</body>
</html>
`;
}

// Pixels that differ between two PNGs of the same size, counted in the browser.
async function diffPixels(page, a, b) {
  return page.evaluate(async ([a, b]) => {
    const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const [x, y] = await Promise.all([load(a), load(b)]);
    if (x.width !== y.width || x.height !== y.height) return { sizeA: [x.width, x.height], sizeB: [y.width, y.height], diff: -1 };
    const px = img => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
    const p = px(x), q = px(y); let d = 0; const box = [Infinity, Infinity, -1, -1];
    for (let i = 0; i < p.length; i += 4) if (p[i] !== q[i] || p[i + 1] !== q[i + 1] || p[i + 2] !== q[i + 2]) {
      d++; const k = i / 4, cx = k % x.width, cy = Math.floor(k / x.width);
      box[0] = Math.min(box[0], cx); box[1] = Math.min(box[1], cy); box[2] = Math.max(box[2], cx); box[3] = Math.max(box[3], cy); }
    return { size: [x.width, x.height], diff: d, ratio: d / (x.width * x.height), where: d ? box : null };
  }, ["data:image/png;base64," + a.toString("base64"), "data:image/png;base64," + b.toString("base64")]);
}

// ---- run ------------------------------------------------------------------------------------
execFileSync("python3", [path.join(ROOT, "tests/mkwalk.py")], { cwd: ROOT, stdio: "ignore" });
const { chromium, T } = require(path.join(ROOT, "tests/env.js"));
const { serveFonts, fontsLoaded } = require(path.join(ROOT, "tests/fontcache.js"));
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch();
const report = [];
const geos = {};
let openChecked = 0;
try {
  for (const pg of PAGES) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); await serveFonts(p);
    const errs = []; p.on("pageerror", e => errs.push(String(e)));
    if (pg.file === "00-app-shell-essays.html")
      await p.addInitScript(d => { if (!sessionStorage.getItem("ash-seeded")) { localStorage.setItem("marginal.essay.v1", JSON.stringify(d)); sessionStorage.setItem("ash-seeded", "1"); } }, ESSAYS);
    await p.goto(T); await p.waitForSelector(".navtab"); await settled(p);
    await pg.go(p); await settled(p);
    if (!(await fontsLoaded(p))) fail(pg.file + ": Fredoka and Nunito did not load");
    // Essay practice: the subject the page was opened on, by key, and it must be
    // what the page itself shows today.
    let ctxText = pg.ctx;
    if (ctxText === null) {
      ctxText = contextOf(ESSAY_KEY);
      const shown = await p.$eval(".qp-nav .qp-subj", e => e.textContent.trim());
      if (shown !== ctxText) fail(pg.file + ": the shell's context (" + ctxText + ") is not what the page shows (" + shown + ")");
    }
    await p.mouse.move(2, 2); await still(p); await settled(p);
    const contentBefore = await p.evaluate(contentBoxes);
    await p.addStyleTag({ content: SHELL_CSS }).then(h => h.evaluate(e => { e.id = "ash-css"; }));
    if (await p.$("#app .whoami")) fail(pg.file + ": a signed-in row; the walkthrough is expected to run with cloud sign-in off");
    const removed = await p.evaluate(strip, { shell: shellHTML({ on: pg.on, ctx: ctxText }), sub: pg.sub ? subnavHTML(pg.sub) : "" });
    // On Essay practice the old header, the pill and the Study page stay underneath
    // the overlay in the app, so they come off too.
    const want = pg.sub ? ["header", "div.nav", "header.qp-nav", "main"] : ["header", "div.nav"];
    if (removed.join(" ") !== want.join(" ")) fail(pg.file + ": removed " + JSON.stringify(removed) + ", expected only " + JSON.stringify(want));
    await p.mouse.move(2, 2); await p.evaluate(() => document.activeElement && document.activeElement.blur()); await still(p); await settled(p);
    const contentAfter = await p.evaluate(contentBoxes);
    if (contentBefore.length !== contentAfter.length) fail(pg.file + ": the page's content groups changed");
    const groups = contentBefore.map((g, i) => sameContent(g, contentAfter[i]));
    groups.forEach((k, i) => { if (!k.ok) fail(pg.file + ": the page under the bar changed (group " + i + "): " + k.why); });
    const same = { elements: groups.reduce((n, k) => n + k.elements, 0), dy: groups.map(k => k.dy) };
    // Lay the page out afresh, so layers the app composited before the drawing aid
    // (the Essay overlay was fixed) are painted as a static page paints them.
    await p.evaluate(() => { const s = document.createElement("style"); s.textContent = "body{display:none!important}"; document.head.appendChild(s); void document.body.offsetHeight; s.remove(); void document.body.offsetHeight; });
    await settled(p);
    geos[pg.file] = await p.evaluate(geometry);
    const live = await p.screenshot({ fullPage: true });
    const liveBoxes = await p.evaluate(boxes);
    const css = await p.evaluate(pageCSS), body = await p.evaluate(bodyOf), open = await p.evaluate(openRules);
    const html = staticPage({ title: pg.title, what: pg.what, css, body });
    if (/—/.test(html.match(/<title>([^<]*)<\/title>/)[1])) fail(pg.file + ": an em dash in the title");
    fs.writeFileSync(path.join(OUT, pg.file), html);
    // The drawing has to render as the live page did.
    const q = await ctx.newPage(); await serveFonts(q);
    await q.goto("file://" + path.join(OUT, pg.file)); await q.evaluate(() => document.fonts.ready); await settled(q);
    await q.mouse.move(2, 2); await still(q); await settled(q);
    const drawn = await q.screenshot({ fullPage: true });
    const d = await diffPixels(q, live, drawn);
    // Every element's box identical, and every pixel.
    const drawnBoxes = await q.evaluate(boxes);
    const moved = liveBoxes.findIndex((x, k) => !drawnBoxes[k] || x[0] !== drawnBoxes[k][0] || [1, 2, 3, 4].some(i => Math.abs(x[i] - drawnBoxes[k][i]) > 0.01));
    if (liveBoxes.length !== drawnBoxes.length || moved !== -1 || d.diff !== 0) {
      if (SHOTS) { fs.writeFileSync(path.join(SHOTS, pg.file.replace(/\.html$/, "-LIVE.png")), live); fs.writeFileSync(path.join(SHOTS, pg.file.replace(/\.html$/, "-DRAWN.png")), drawn); }
      fail(pg.file + ": the drawing does not render as the live page did: " + JSON.stringify(d) + "; elements " + liveBoxes.length + " vs " + drawnBoxes.length + "; first moved: " + JSON.stringify({ live: liveBoxes[moved], drawn: drawnBoxes[moved] }));
    }
    if (SHOTS) fs.writeFileSync(path.join(SHOTS, pg.file.replace(/\.html$/, ".png")), drawn);
    // Interactive state survives pruning: open every <details> in the drawing, and
    // every [open] rule that then applies has to be there.
    const kept = await q.evaluate(openRulesKept, { rules: open, css });
    if (kept.missing.length) fail(pg.file + ": pruning dropped [open] rules a drawn <details> uses: " + kept.missing.join(" | "));
    openChecked += kept.applies;
    if (errs.length) fail(pg.file + ": page errors: " + errs.join(" | "));
    report.push({ file: pg.file, context: ctxText || "(none)", removed: removed.join(", "), contentElements: same.elements, contentShift: same.dy, elements: liveBoxes.length, diffPixels: d.diff, details: kept.details, openRules: kept.applies, height: d.size[1], bytes: html.length });
    await ctx.close();
  }
  // One bar: the same height, brand, links and Sign out on every page.
  const ref = geos[PAGES[0].file];
  for (const [f, g] of Object.entries(geos)) {
    const same = JSON.stringify([g.bar, g.brand, g.links, g.out]) === JSON.stringify([ref.bar, ref.brand, ref.links, ref.out]);
    if (!same) fail(f + ": the bar is not the same as on the Study page: " + JSON.stringify(g) + " vs " + JSON.stringify(ref));
  }
  // The [open] check above has to have checked something: Essay practice draws a
  // <details> whose open state has its own rule.
  if (!openChecked) fail("no [open] rule was checked on any page");
  // The widths the owner locked: at 1024px the full bar, with every subject it can
  // name shown in full; from 861px to 1023px the same bar without the subject. Both
  // edges are checked, and with a long student number the bar still fits (the
  // subject may shorten at 1024px, nothing else does). The narrowest window that
  // holds each variant is measured too. Measured in the Study drawing, under the
  // page's own CSS.
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); await serveFonts(p);
    await p.goto("file://" + path.join(OUT, "00-app-shell.html")); await p.evaluate(() => document.fonts.ready);
    const H = ref.bar[3];
    const LONG = WHO.replace("#1234", "#123456789");
    const VARIANTS = [
      ...Object.keys(PACKAGES).map(k => [contextOf(k), shellHTML({ on: "essay", ctx: contextOf(k) })]),
      [CTX.paper, shellHTML({ on: "test", ctx: CTX.paper })],
      [contextOf("ancient_history") + ", demo", shellHTML({ on: "essay", ctx: contextOf("ancient_history"), demo: true })],
      ["no subject", shellHTML({ on: "create", ctx: "" })],
    ];
    const shownAs = sel => { const c = document.querySelector(sel); if (!c) return "none";
      if (getComputedStyle(c).display === "none") return "hidden"; return c.scrollWidth <= c.clientWidth ? "full" : "shortened"; };
    const fits = {}, narrowest = {};
    for (const [name, h] of VARIANTS) for (const who of [WHO, LONG]) {
      await p.evaluate(h => { document.querySelector(".ash").outerHTML = h; }, h.split(WHO).join(who));
      const at = async w => { await p.setViewportSize({ width: w, height: 900 }); await settled(p);
        return { fits: await p.evaluate(barFits, H), subject: await p.evaluate(shownAs, ".ash-ctx"), account: await p.evaluate(shownAs, ".ash-who > span") }; };
      const key = name + (who === LONG ? ", long student number" : "");
      const r = { 1024: await at(1024), 1023: await at(1023), 861: await at(861) };
      for (const w of [1024, 1023, 861]) if (!r[w].fits) fail("the bar does not hold one row at " + w + "px with " + key);
      const hasSubject = name !== "no subject";
      if (hasSubject && who === WHO && r[1024].subject !== "full") fail("at 1024px the subject is not shown in full with " + key + ": " + r[1024].subject);
      if (hasSubject && r[1024].subject === "hidden") fail("at 1024px the subject is hidden with " + key);
      for (const w of [1023, 861]) if (hasSubject && r[w].subject !== "hidden") fail("at " + w + "px the subject is not left out with " + key + ": " + r[w].subject);
      for (const w of [1024, 1023, 861]) if (who === WHO && r[w].account !== "full") fail("at " + w + "px the account is not shown in full with " + key + ": " + r[w].account);
      if (r[1024].account !== "full") fail("at 1024px the account shortened while a subject could give way, with " + key);
      fits[key] = Object.fromEntries([1024, 1023, 861].map(w => [w, "subject " + r[w].subject + ", account " + r[w].account]));
      if (who === WHO) {
        let lo = 600, hi = 1440;
        if ((await at(lo)).fits) fail("the bar fits at 600px with " + key + "; the search needs a lower floor");
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if ((await at(m)).fits) hi = m; else lo = m; }
        narrowest[key] = hi;
      }
    }
    report.push({ check: "one row at 1024px, 1023px and 861px; the subject at each", subject: fits, narrowestOneRow: narrowest });
    if (SHOTS) for (const w of [1024, 861]) {
      await p.goto("file://" + path.join(OUT, "00-app-shell-test-paper.html")); await p.evaluate(() => document.fonts.ready);
      await p.setViewportSize({ width: w, height: 900 }); await settled(p); await p.mouse.move(2, 2);
      fs.writeFileSync(path.join(SHOTS, "00-app-shell-" + w + ".png"), await p.screenshot({ clip: { x: 0, y: 0, width: w, height: 260 } }));
    }
    await ctx.close();
  }
  // The states sheet: the bar in each state its CSS defines, and on each kind of page.
  {
    const ESSAY_CTX = contextOf(ESSAY_KEY);
    const ROWS = [
      ["Study open. The current section carries the green underline, and the subject is the open workspace's.", shellHTML({ on: "study", ctx: CTX.study })],
      ["Create open. Create has no subject, so only the account shows on the right.", shellHTML({ on: "create", ctx: "" })],
      ["Test mode library. No paper is open, so no subject is named (decisions 4 and 18).", shellHTML({ on: "test", ctx: "" })],
      ["A paper open in Test mode. The subject is the paper's, resolved from its key, with the stage the paper declares.", shellHTML({ on: "test", ctx: CTX.paper })],
      ["Essay practice, with the area's own two pages in the page below the bar. Essay practice is current there.", shellHTML({ on: "essay", ctx: ESSAY_CTX }) + subnavHTML("practice")],
      ["My essays current below the bar. The bar still shows Essay practice as the section.", shellHTML({ on: "essay", ctx: ESSAY_CTX }) + subnavHTML("essays")],
      ["Pointer over a section link (Create, while Study is open).", shellHTML({ on: "study", ctx: CTX.study, states: { create: "hover" } })],
      ["Keyboard focus on a section link (Test mode).", shellHTML({ on: "study", ctx: CTX.study, states: { test: "focus" } })],
      ["Pointer over the brand, which goes to Study.", shellHTML({ on: "create", ctx: "", states: { brand: "hover" } })],
      ["Keyboard focus on the brand.", shellHTML({ on: "create", ctx: "", states: { brand: "focus" } })],
      ["Pointer over Sign out.", shellHTML({ on: "study", ctx: CTX.study, states: { out: "hover" } })],
      ["Keyboard focus on Sign out.", shellHTML({ on: "study", ctx: CTX.study, states: { out: "focus" } })],
      ["Pointer over My essays, and then keyboard focus on it, below the bar.", shellHTML({ on: "essay", ctx: ESSAY_CTX }) + subnavHTML("practice", { essays: "hover" }) + subnavHTML("practice", { essays: "focus" })],
      ["Cloud sign-in not configured: no account and no Sign out, as the app shows no signed-in row today.", shellHTML({ on: "study", ctx: CTX.study, account: false })],
      ["Essay practice's demo route (?essaydemo=1): the demo badge stays beside the subject, as it is today.", shellHTML({ on: "essay", ctx: contextOf("ancient_history"), demo: true }) + subnavHTML("practice")],
    ];
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Marginal · App shell states</title>
<!-- The proposed shared app shell, awaiting approval. Generated by 00-app-shell.build.mjs: do not edit by hand. -->
${FONTS}
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#F6F9F9;color:#18272D;font-family:'Nunito',system-ui,sans-serif;line-height:1.6;padding:28px 0 48px}
.sheet-h{max-width:1320px;margin:0 auto 18px;padding:0 28px;font-family:'Fredoka',system-ui,sans-serif;font-weight:700;font-size:24px;letter-spacing:-.4px}
.sheet-p{max-width:1320px;margin:-12px auto 22px;padding:0 28px;font-size:14px;color:#5D7178}
.row{margin:0 0 22px}
.row p{max-width:1320px;margin:0 auto 8px;padding:0 28px;font-size:13.5px;font-weight:700;color:#5D7178}
.row .ash{position:static}
.row .ash-sub{background:#F6F9F9;padding-bottom:12px}
</style>
<style id="ash-css">
${SHELL_CSS}
</style>
</head>
<body>
<h1 class="sheet-h">The shared app shell, in each of its states</h1>
<p class="sheet-p">The same bar on every page: 1440px wide here. From 861px to 1023px it leaves out the subject. Pointer and focus states are drawn with classes for the picture; the shell itself uses :hover and :focus-visible.</p>
${ROWS.map(([lab, h]) => `<section class="row"><p>${lab}</p>${h}</section>`).join("\n")}
</body>
</html>
`;
    if (/—/.test(html)) fail("an em dash in the states sheet");
    fs.writeFileSync(path.join(OUT, "00-app-shell-states.html"), html);
    if (SHOTS) {
      const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
      const p = await ctx.newPage(); await serveFonts(p);
      await p.goto("file://" + path.join(OUT, "00-app-shell-states.html")); await p.evaluate(() => document.fonts.ready); await p.mouse.move(2, 2);
      fs.writeFileSync(path.join(SHOTS, "00-app-shell-states.png"), await p.screenshot({ fullPage: true }));
      await ctx.close();
    }
    report.push({ file: "00-app-shell-states.html", rows: ROWS.length, bytes: html.length });
  }
} finally {
  await b.close();
}
{ const ref = geos[PAGES[0].file]; report.push({ bar: { height: ref.bar[3], brand: ref.brand, links: ref.links.map(l => l.slice(0, 3)), signOut: ref.out } }); }
console.log(JSON.stringify(report, null, 1));
