// THE MARKED STATE SHOWS A SUBMITTED RESPONSE. IT DOES NOT OFFER TO EDIT ONE.
//
// State 12 has two presentation states for the same question, and the difference
// between them is the whole of this suite.
//
//   ANSWERING   the response is the editable field, and there is no mark yet
//   MARKED      the response is a compact line the student can open, read-only,
//               and the mark and the marker's judgement are above the fold
//
// Rendering the whole 176-word response in the marked state pushed "14 of 20"
// below the fold at every size except a tall desktop, which is what this
// disclosure exists to fix. What it must not do is quietly become a field again:
// a student editing a submitted answer with nowhere to save it is worse than
// either state on its own.
//
// Both pages are GENERATED from one fixture by docs/mockups/12-extended-response.build.mjs,
// so the marker's words, the student's response and the evidence on screen come
// out of one run of the shipped finalize(). Draft 1 was hand-authored and its
// marker copy asserted "Figures appear once" about a response containing no
// digit. These assertions are what keeps the generated pages honest to the
// fixture they came from.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const fs = require("node:fs");
const path = require("node:path");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

const fx = JSON.parse(read("docs/mockups/12-extended-response.fixture.json"));
const marked = read("docs/mockups/12-extended-response.html");
const answering = read("docs/mockups/12-extended-response-answering.html");
const body = h => h.slice(h.indexOf("<body>"));
const unesc = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const paras = h => [...body(h).matchAll(/<div class="response">([\s\S]*?)<\/div>/g)]
  .flatMap(m => [...m[1].matchAll(/<p>([\s\S]*?)<\/p>/g)].map(x => unesc(x[1])));

// --- the marked state -------------------------------------------------------
ok(/<details class="submitted">/.test(marked), "the marked state wraps the response in a disclosure");
ok(!/<details class="submitted"[^>]*\bopen\b/.test(marked), "and it is CLOSED by default");
ok(/<summary>/.test(marked) && /class="act"/.test(marked), "with a summary carrying the open/close affordance");
ok((body(marked).match(/<textarea|<input/g) || []).length === 0,
   "THE MARKED STATE HAS NO EDITABLE FIELD AT ALL");
ok(!/contenteditable/.test(marked), "and nothing is contenteditable");

// the exact submitted prose survives the collapse
ok(paras(marked).join("\n\n") === fx.answer,
   "the collapsed response holds the submitted prose BYTE-EXACTLY");

// the word count is counted, not asserted
const words = fx.answer.trim().split(/\s+/).length;
ok(new RegExp("\\u00b7 " + words + " words").test(marked),
   "the summary carries the real word count (" + words + "), computed from the answer");
ok(!/176 words/.test(marked) || words === 176, "and the number on the page is that count, not a written-in one");

// the action a marked response offers
ok(/>Try again</.test(marked), "the marked state offers Try again");
ok(!/>Submit for marking</.test(marked), "and does not offer Submit, which belongs to the answering state");

// --- the answering state ----------------------------------------------------
ok((body(answering).match(/<textarea/g) || []).length === 1, "the answering state has exactly one editable field");
ok(!/<details class="submitted">/.test(answering), "and no disclosure, because there is nothing submitted yet");
const ta = answering.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/);
ok(ta && unesc(ta[1]) === fx.answer, "the field holds the same prose, byte-exactly");
ok(!/class="result"/.test(answering), "there is no mark before marking");
ok(!/class="obs"/.test(answering) && !/What the marker noticed/.test(answering), "and no review");
ok(/>Submit for marking</.test(answering), "the answering state offers Submit for marking");
ok(!/>Try again</.test(answering), "and not Try again");

// --- THE AUTHORED CRITERION NAMES ARE NOT RE-CASED --------------------------
//
// Draft 1 title-cased all four. They are the strongest grounding in the payload:
// the subject package's own strings, sent to the marker and required back
// verbatim. A typography helper that capitalises headings would silently rewrite
// an academic label, so the names on the page are compared against the package.
{
  const es = read("essay-content.js");
  const seg = es.slice(es.indexOf("business_studies"));
  const mc = seg.match(/markingCriteria:\s*\[([\s\S]*?)\]/);
  const authored = mc ? [...mc[1].matchAll(/"([^"]+)"/g)].map(m => m[1]) : [];
  const shown = [...body(marked).matchAll(/<h3 class="critn">([^<]+)<\/h3>/g)].map(m => unesc(m[1]));
  ok(authored.length === 4, "the Business Studies package still authors four criteria");
  ok(JSON.stringify(shown) === JSON.stringify(authored),
     "the four names on the page are the authored strings, in order, with their authored casing");
  ok(shown.every(n => n === n.toLowerCase() || /[A-Z]/.test(authored.join(""))),
     "no criterion name has been capitalised on its way to the screen");
}

// --- NO CRITERION OWNS EVIDENCE, A COUNT OR A VERDICT ----------------------
{
  const crits = [...body(marked).matchAll(/<li class="crit">([\s\S]*?)<\/li>/g)].map(m => m[1]);
  ok(crits.length === 4, "four criterion rows");
  ok(crits.every(c => !/class="ev"/.test(c)), "no criterion contains an evidence block");
  ok(crits.every(c => !/<q>/.test(c)), "no criterion quotes the student");
  ok(crits.every(c => !/observation/i.test(c)), "no criterion carries an observation count");
  ok(crits.every(c => !/\b\d+\s*\/\s*\d+\b/.test(c) && !/\bof \d+ marks?\b/.test(c)), "no criterion carries a mark");
  ok(crits.every(c => !/\b(met|partial|missing)\b/i.test(c)), "no criterion carries a derived status");
}

// --- and the exclusions hold across the whole page ---------------------------
{
  const t = body(marked).replace(/<[^>]+>/g, " ");
  [["band", /\bbands?\b/i], ["ladder", /\bladder\b/i], ["Clear/Better/Band 6", /\bClear\b.*\bBetter\b/i],
   ["a grounding percentage", /\b\d{1,3}\s*%/], ["missing vocabulary chips", /missing[_ ]vocabulary/i]]
    .forEach(([name, re]) => ok(!re.test(t), "the page shows no " + name));
  ok(/In your response/.test(t) && /Across your response/.test(t),
     "both anchoring labels are present, so the distinction is on screen");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
