// THE SITTING-SHELL FOOTER IS ONE BLOCK, COPIED. THIS IS WHAT KEEPS IT ONE BLOCK.
//
// Ten mockups and one generator carry the same sticky footer. Nothing shares it
// at build time - they are standalone pages, deliberately, so a mockup can be
// opened from a file:// URL with no toolchain - so the only thing that can keep
// eleven copies honest is a test that reads them.
//
// It had already drifted, and the drift is what this suite was written after.
// The state 12 pages were missing `.flag:hover` and the note explaining that
// "Item" is sequence position, so the newest state was quietly running a
// different footer from the eight that came before it. Nobody saw it, because a
// missing hover state and a missing comment look like nothing on a screenshot.
//
// UX-TEST-06 is the reason it matters. The fix is a media query in this block:
// if one page keeps the old block, that page keeps a 119px footer sitting on top
// of the mark, and the fix is "done" everywhere except where it is not.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const MOCK = path.join(ROOT, "docs", "mockups");

const files = fs.readdirSync(MOCK)
  .filter(f => /\.(html|mjs)$/.test(f))
  .map(f => [f, fs.readFileSync(path.join(MOCK, f), "utf8")])
  .filter(([, s]) => s.includes('class="footer"'));

console.log("--- 1. every page that renders the shell is accounted for");
// Ten rendered pages and the generator that emits two of them. A new state that
// copies the shell without appearing here has not been noticed by anything.
ok(files.length === 11, `eleven sources carry the shell (${files.length}): ` +
   files.map(([f]) => f).join(" "));
ok(files.some(([f]) => f.endsWith(".build.mjs")),
   "and one of them is the generator, not only its output");

console.log("--- 2. the block is byte-identical in all of them");
const START = "  /* THE SHARED SITTING-SHELL FOOTER";
const cut = s => {
  const i = s.indexOf(START);
  if (i < 0) return null;
  const q = s.indexOf("@media(max-width:640px){", i);
  if (q < 0) return null;
  const j = s.indexOf("\n  }\n", q);
  return j < 0 ? null : s.slice(i, j + 5);
};
const blocks = files.map(([f, s]) => [f, cut(s)]);
ok(blocks.every(([, b]) => b), "every source has the block, opening and closing where it should: " +
   blocks.filter(([, b]) => !b).map(([f]) => f).join(" "));
const hashes = new Map();
for (const [f, b] of blocks) {
  if (!b) continue;
  const h = crypto.createHash("sha1").update(b).digest("hex").slice(0, 10);
  if (!hashes.has(h)) hashes.set(h, []);
  hashes.get(h).push(f);
}
ok(hashes.size === 1, `one footer, not ${hashes.size}: ` +
   [...hashes].map(([h, fs2]) => `${h}[${fs2.join(",")}]`).join(" | "));

console.log("--- 3. the narrow-mobile rule says all four things it has to say");
const one = blocks.find(([, b]) => b)[1];
// Each of these is a separate promise the rule makes, and each of them was a
// separate measurement. Losing any one of them silently is the fault this
// catches: a rule that still exists and no longer does its job.
ok(/@media\(max-width:640px\)\{/.test(one),
   "the breakpoint is 640, which is where the footer stopped wrapping");
ok(/\.footin \.where\{display:none\}/.test(one),
   "the item counter comes out of the footer");
ok(/\.foot-lbl\{display:none\}/.test(one),
   "and so does the trailing half of each label");
ok(/min-height:44px/.test(one),
   "and the three actions become 44px targets, which they were not at any width");
ok(/justify-content:space-between/.test(one),
   "with the row spread, because the counter that used to space it is gone");

console.log("--- 4. the labels the rule hides actually exist, in every footer");
for (const [f, s] of files) {
  const foot = s.slice(s.indexOf('<div class="footer">'));
  const end = foot.indexOf("</div>", foot.indexOf("</div>") + 1);
  const markup = foot.slice(0, end);
  const n = (markup.match(/class="foot-lbl"/g) || []).length;
  ok(n === 3, `${f}: three droppable labels in the footer (${n})`);
  // A label that is not INSIDE the control it belongs to would be hidden without
  // shrinking anything.
  ok(!/<span class="foot-lbl">[^<]*<\/span>\s*<\/div>/.test(markup),
     `${f}: no droppable label loose in the row`);
}

console.log("--- 5. no page has pinned a footer height of its own");
// The old block's height was emergent - padding plus the tallest control - and
// the fix depends on it staying that way. A hard-coded height is how a 44px
// target quietly goes back to 37.
for (const [f, s] of files) {
  const b = cut(s) || "";
  ok(!/\.foot(er|in)\{[^}]*\bheight:/.test(b), `${f}: the footer's height is still emergent`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
