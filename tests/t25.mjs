// EVERY ICON A CONTROL ASKS FOR IS AN ICON THAT EXISTS.
//
// IT FOUND SEVEN BROKEN CONTROLS, AND THEY ARE WHY IT EXISTS.
//
// The icon set was rewritten around what each icon MEANS - understand, ideas,
// evidence, structure, vocabulary - and the call sites that had been asking for
// what each icon LOOKED LIKE - book, bulb, search, blocks, type, cloud - were
// left pointing at names that no longer existed. esIcon returns "" for an
// unknown name, deliberately, so that a bad call site does not paint a blank
// square. The consequence is that a broken call site is invisible: the label
// beside it still reads, the layout still works, and the icon is simply gone.
//
// The whole writing toolbelt lost its icons. So did Learn in the global bar and
// the "Saved" mark in the footer. Twenty-two suites in the checkpoint tier were
// green over all of it; the one line anywhere in the harness that noticed was in
// ui12, which is a full-tier suite, and it noticed only the toolbelt.
//
// This reads the source rather than a rendered page, so it is cheap enough to
// sit in the checkpoint tier and complete enough to cover every call site at
// once, including the ones on screens no walk visits.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(HERE, "..", "app.js"), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };

// ---- 1. the registry itself ------------------------------------------------
console.log("--- 1. the registry is a set of real paths");
const start = src.indexOf("const ES_ICON_SRC");
ok(start > 0, "the icon registry is where the app keeps it");
const end = src.indexOf("function esSetLabel", start);
ok(end > start, "the registry ends before the helpers that read it");
const body = src.slice(start, end);
const entries = [...body.matchAll(/^    ([a-z]+): '(.*)',$/gm)].map(m => ({ name: m[1], d: m[2] }));
ok(entries.length >= 25, "the registry holds a full set: " + entries.length);
const keys = new Set(entries.map(e => e.name));
ok(keys.size === entries.length, "no name is defined twice");
// An icon is path data, not a placeholder. A registry entry that renders nothing
// is the same defect as a missing one, dressed as a fix.
const empty = entries.filter(e => !/^\s*<(path|circle|rect|line|polyline|polygon|ellipse)\b/.test(e.d));
ok(empty.length === 0, "every entry is drawable geometry: " + JSON.stringify(empty.map(e => e.name)));
const short = entries.filter(e => e.d.length < 20);
ok(short.length === 0, "no entry is a stub: " + JSON.stringify(short.map(e => e.name)));

// ---- 2. every call site asks for a name that exists ------------------------
console.log("--- 2. every call site resolves");
// Literal calls: esIcon("name").
const literal = [...src.matchAll(/esIcon\(\s*"([a-z]+)"/g)].map(m => m[1]);
ok(literal.length > 20, "the app draws icons from the registry in many places: " + literal.length);
const badLiteral = [...new Set(literal)].filter(n => !keys.has(n));
ok(badLiteral.length === 0, "every esIcon(\"name\") names a real icon: " + JSON.stringify(badLiteral));

// The toolbelt reaches the registry through data, not through a literal, which
// is exactly why its five broken names survived: no grep for esIcon("blocks")
// would ever have found them.
const tools = [...src.matchAll(/icon:\s*"([a-z]+)"/g)].map(m => m[1]);
ok(tools.length >= 5, "the tool table names an icon for each tool: " + tools.length);
const badTool = [...new Set(tools)].filter(n => !keys.has(n));
ok(badTool.length === 0, "every tool's icon names a real icon: " + JSON.stringify(badTool));

// Ternaries: esIcon(cond ? "a" : "b"). Both arms are call sites.
// The condition itself may contain string literals - esIcon(k === "x" ? "a" : "b")
// - so it is bounded by the closing paren, not by the absence of a quote. The
// first version of this line was bounded by quotes and silently matched nothing
// for exactly that shape, which is the same class of blind spot as the one this
// file exists to close.
const dyn = [...src.matchAll(/esIcon\([^)]*\?\s*"([a-z]+)"\s*:\s*"([a-z]+)"\s*\)/g)]
  .flatMap(m => [m[1], m[2]]);
ok(dyn.length >= 6, "icons chosen by state are covered too: " + dyn.length);
const badDyn = [...new Set(dyn)].filter(n => !keys.has(n));
ok(badDyn.length === 0, "both arms of every state-chosen icon exist: " + JSON.stringify(badDyn));

// ---- 3. nothing sits in the registry unasked for ---------------------------
console.log("--- 3. the registry carries no dead weight");
const asked = new Set([...literal, ...tools, ...dyn]);
const unused = [...keys].filter(n => !asked.has(n));
ok(unused.length === 0, "every icon in the registry is drawn somewhere: " + JSON.stringify(unused));

// ---- 4. the contract for an unknown name -----------------------------------
console.log("--- 4. an unknown name still fails quietly, on purpose");
// Sections 2 and 3 are only worth having because of this: the app prefers a
// missing icon to a broken one, so nothing on screen ever complains. Assert the
// behaviour so a later change cannot make it noisy and leave this file guarding
// a rule the app no longer follows.
const fn = src.slice(src.indexOf("function esIcon(name, cls)"));
ok(/const d = ES_ICON_SRC\[name\];\s*\n\s*if \(!d\) return "";/.test(fn),
  "esIcon returns nothing for a name it does not know");
ok(/aria-hidden="true"/.test(fn.slice(0, 800)), "an icon is decoration: it is hidden from a screen reader");
ok(/stroke="currentColor"/.test(fn.slice(0, 800)), "an icon takes its colour from the control it sits in");

// ---- 5. an icon with no words beside it still has to say what it does ------
console.log("--- 5. every icon-only control has an accessible name");
// The notebook toolbar, the paging controls and the panel dismissals are icons
// alone: their labels are not on screen. A control like that is unusable to a
// screen reader, and unguessable to anyone else, without an accessible name. The
// rule is checked here rather than per-surface because these controls are spread
// across the notebook, the drawers and the writing screens, and a rule enforced
// on one of them is a rule that decays on the other two.
const buttons = [...src.matchAll(/<button\b([^>]*)>((?:(?!<\/button>|<button\b)[\s\S])*)<\/button>/g)]
  .map(m => ({ attrs: m[1], inner: m[2] }));
ok(buttons.length > 40, "the app builds many buttons: " + buttons.length);
const iconOnly = buttons.filter(bt => /esIcon\(/.test(bt.inner) &&
  // no <span> label, and no bare words outside the icon call
  !/<span/.test(bt.inner) &&
  !/[A-Za-z]{3,}/.test(bt.inner.replace(/\$\{[\s\S]*?\}/g, "").replace(/<[^>]*>/g, "")));
ok(iconOnly.length >= 8, "some controls are an icon and nothing else: " + iconOnly.length);
const unnamed = iconOnly.filter(bt => !/aria-label\s*=/.test(bt.attrs));
ok(unnamed.length === 0, "every one of them carries an aria-label: " +
  JSON.stringify(unnamed.map(bt => (bt.attrs.match(/(?:id|data-[a-z]+)="?([\w-]+)/) || [])[1] || bt.attrs.trim().slice(0, 40))));
// A tooltip is not an accessible name, but a sighted student hovering an icon
// deserves one too, and these are the controls with no visible words at all.
const untitled = iconOnly.filter(bt => !/\btitle\s*=/.test(bt.attrs) && !/aria-label="Close"/.test(bt.attrs));
ok(untitled.length <= 2, "and a tooltip, bar the plain dismissals: " +
  JSON.stringify(untitled.map(bt => (bt.attrs.match(/(?:id|data-[a-z]+)="?([\w-]+)/) || [])[1] || bt.attrs.trim().slice(0, 30))));
// Keyboard focus has to be visible on them, since there is no text to underline.
const css = readFileSync(path.join(HERE, "..", "index.html"), "utf8");
ok(/\.es-nbico:focus-visible\{[^}]*outline:/.test(css), "the notebook's icon buttons show keyboard focus");
ok(/\.es-util\.quiet:focus-visible\{[^}]*outline:/.test(css), "the global bar's controls show keyboard focus");
ok(/\.qp-brand:focus-visible\{[^}]*outline:/.test(css), "the wordmark shows keyboard focus");

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
