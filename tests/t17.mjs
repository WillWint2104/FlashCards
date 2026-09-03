// THE VOCABULARY READINESS REPORT.
//
// The report exists to tell an AUTHOR what to do next. It was answering three
// different questions with one number, and one of its answers was silence:
//
//   fifty records with a blank field printed exactly the same line as fifty
//   records that do not exist, and as no records at all;
//   a ref naming an id that does not exist and a ref naming a half-written record
//   both reported as "1 missing", which are opposite jobs to fix;
//   a ref carrying a role the panel cannot group by reported as fully defined,
//   because the runtime re-buckets it and nothing told the author it happened.
//
// Static, because it is a property of the content and the walker, not of a screen.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };

// The walker reads essay-content.js off disk, so exercising it against shaped
// content means running its body over a doctored copy rather than the real file.
const src = readFileSync(new URL("../tools/coverage.js", import.meta.url), "utf8");
const body = src.slice(src.indexOf("function vocabCoverage() {"), src.indexOf("// One line, and only"));
const inner = body.replace("function vocabCoverage() {", "")
  .replace('const ESSAY = load("essay-content.js").ESSAY;', "")
  .replace(/\}\s*$/, "");
const walk = new Function("ESSAY", inner);

function content() {
  const s = readFileSync(new URL("../essay-content.js", import.meta.url), "utf8");
  const w = {};
  new Function("window", s)(w);
  return w.ESSAY;
}
const mkt = E => E.subjects.business_studies.questions.find(q => q.id === "mkt-01");
const REC = extra => Object.assign({ term: "t", plain: "p", subject: "s", example: "e" }, extra || {});

console.log("1. the store's own state is visible even when nothing references it");
{
  const E = content();
  for (let i = 0; i < 50; i++) E.vocab.records["p" + i] = REC({ id: "p" + i, example: "" });
  const v = walk(E);
  ok(v.records === 50, "fifty records are counted: " + v.records);
  ok(v.recordsPartial === 50, "and all fifty are seen as partial: " + v.recordsPartial);
  ok(v.recordsComplete === 0, "none is complete: " + v.recordsComplete);

  const empty = walk(content());
  ok(empty.records === 0, "an empty store reports no records: " + empty.records);
  // the bug: these two used to be byte-identical
  ok(v.records !== empty.records || v.recordsPartial !== empty.recordsPartial,
    "a half-written store is distinguishable from an empty one");
}

console.log("2. the three ways a ref can fail are three different numbers");
{
  const E = content();
  E.vocab.records.full = REC({ id: "full" });
  E.vocab.records.half = REC({ id: "half", example: "" });
  mkt(E).vocabRefs = [
    { id: "full", role: "topic-context" },     // fine
    { id: "half", role: "topic-context" },     // record exists, a field is blank
    { id: "ghost", role: "topic-context" },    // no such record
    { id: "full", role: "not-a-role" },        // resolves, but the panel cannot group it
  ];
  const v = walk(E);
  ok(v.asked === 3, "distinct ids asked for: " + v.asked);
  ok(v.dangling === 1, "one ref names no record: " + v.dangling);
  ok(v.halfWritten === 1, "one names a half-written record: " + v.halfWritten);
  ok(v.unmet === 2, "and both are unusable: " + v.unmet);
  ok(v.dangling !== v.unmet, "the two failures are not collapsed into one number");
}

console.log("3. an unknown role is reported, because the runtime hides it");
{
  const E = content();
  E.vocab.records.full = REC({ id: "full" });
  mkt(E).vocabRefs = [{ id: "full", role: "relationship_support" }];   // underscore, not hyphen
  const v = walk(E);
  ok(v.badRole === 1, "the typo is counted: " + v.badRole);
  ok(v.unmet === 0, "the term is still usable, because the runtime re-buckets it: " + v.unmet);

  const good = content();
  good.vocab.records.full = REC({ id: "full" });
  mkt(good).vocabRefs = [{ id: "full", role: "relationship-support" }];
  ok(walk(good).badRole === 0, "and a correct role is not reported: " + walk(good).badRole);
}

console.log("4. the walker reads the scopes the resolver reads, and no others");
{
  // esVocabRefs walks pathway -> esAreaDef -> question, and esAreaDef resolves
  // against the QUESTION's areas. A subject-level area is not a place the app looks.
  const E = content();
  E.vocab.records.a = REC({ id: "a" });
  E.subjects.business_studies.areas = { somewhere: { vocabRefs: [{ id: "a", role: "topic-context" }] } };
  ok(walk(E).asked === 0, "a subject-level area is not counted: " + walk(E).asked);

  const q = content();
  q.vocab.records.a = REC({ id: "a" });
  const target = mkt(q);
  target.areas = target.areas || {};
  target.areas["e-marketing"] = Object.assign({}, target.areas["e-marketing"],
    { vocabRefs: [{ id: "a", role: "topic-context" }] });
  ok(walk(q).asked === 1, "a question-level area is: " + walk(q).asked);

  const pa = content();
  pa.vocab.records.a = REC({ id: "a" });
  mkt(pa).pathways[0].vocabRefs = [{ id: "a", role: "topic-context" }];
  ok(walk(pa).asked === 1, "and a pathway is: " + walk(pa).asked);
}

console.log("5. the line only says what is wrong");
{
  const { vocabLine } = require("../tools/coverage.js");
  const line = vocabLine();
  console.log("    shipped:", JSON.stringify(line));
  ok(/^vocabulary 0 refs requested \/ 0 usable$/.test(line),
    "with nothing authored it stays short and claims nothing: " + JSON.stringify(line));
  ok(!/missing|partial|unknown/.test(line), "and reports no problems that do not exist");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
