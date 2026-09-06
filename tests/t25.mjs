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
const dyn = [...src.matchAll(/esIcon\([^)"]*\?\s*"([a-z]+)"\s*:\s*"([a-z]+)"/g)]
  .flatMap(m => [m[1], m[2]]);
ok(dyn.length >= 2, "icons chosen by state are covered too: " + dyn.length);
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

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
