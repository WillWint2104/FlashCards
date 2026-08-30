// THE EVIDENCE PUBLICATION CONTRACT, at the logic level.
//
// Publication needs BOTH halves of verification recorded:
//
//   source   WHERE the claim can be checked, in words a teacher could follow
//   checked  the date someone actually did check it
//
// Finding a source is not verification. Recording that it was checked is what
// completes publication. So:
//
//   nothing recorded                  -> withheld
//   a located URL and nothing else    -> withheld
//   a source nobody opened            -> withheld   <- the dangerous one
//   a date with no source             -> withheld
//   either field blank                -> withheld
//   source AND checked                -> usable
//
// THIS TEST IS HALF OF THE CONTRACT. It reads the real esEvidenceUsable out of
// app.js and trips if the rule stops reading either field or stops trimming both,
// which makes it a tripwire for implementation drift and a poor sole definition:
// a test shaped like the code cannot notice that the code is wrong. ui33.js is
// the other half and asks only what the student can see.
import { esEvidenceUsable } from "./out/evidence-shim.mjs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { EVIDENCE_FIXTURE } = require("./fixtures/evidence-publication.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FAIL:", m); } };
const rec = l => EVIDENCE_FIXTURE.records.find(r => r.label.indexOf(l) === 0);

console.log("--- the fixture holds six distinguishable states ---");
ok(EVIDENCE_FIXTURE.records.length === 6, "six records: " + EVIDENCE_FIXTURE.records.length);
ok(["A","B","C","D","E","F"].every(k => rec(k)), "one of each state is present");

console.log("--- a claim is not evidence ---");
ok(esEvidenceUsable(rec("A")) === false, "A: nothing recorded is withheld");

console.log("--- a located URL is not a source ---");
// Protects the real bank today. Every McDonald's candidate carries a URL and
// nothing else, so the day this flips they all publish at once.
const b = rec("B");
ok(b.sourceUrl.length > 0, "B does carry a URL, so this tests the right thing: " + b.sourceUrl);
ok(esEvidenceUsable(b) === false, "B: a URL without a recorded source is withheld");

console.log("--- and a source is not a check ---");
// The state that reads as authoritative and nobody opened. Under a source-only
// rule this published, which is why the rule is no longer source-only.
const d = rec("D");
ok(d.source.trim().length > 0 && String(d.checked || "").trim() === "",
  "D really is a recorded source with no check: " + JSON.stringify(d.source) + " / " + JSON.stringify(d.checked));
ok(esEvidenceUsable(d) === false, "D: a source nobody checked is withheld");

console.log("--- a check with nothing behind it is worth nothing either ---");
ok(esEvidenceUsable(rec("E")) === false, "E: a date with no source is withheld");

console.log("--- and blank is blank in both fields ---");
const f = rec("F");
ok(f.source.length > 0 && f.source.trim().length === 0, "F's source is whitespace, not absent");
ok(f.checked.length > 0 && f.checked.trim().length === 0, "F's checked is whitespace, not absent");
ok(esEvidenceUsable(f) === false, "F: whitespace in both fields is withheld");

console.log("--- both halves together publish ---");
ok(esEvidenceUsable(rec("C")) === true, "C: a source that was checked is usable");

console.log("--- each half is necessary, neither is sufficient ---");
// Stated as a pair, so a future change that drops one half fails here loudly
// rather than quietly widening what students can cite.
ok(esEvidenceUsable({ source: "recorded", checked: "2026-08-24" }) === true, "both together: usable");
ok(esEvidenceUsable({ source: "recorded", checked: "" }) === false, "source alone: withheld");
ok(esEvidenceUsable({ source: "", checked: "2026-08-24" }) === false, "checked alone: withheld");
ok(esEvidenceUsable({ source: "recorded", checked: "   " }) === false, "a blank check does not complete it");
ok(esEvidenceUsable({ source: "   ", checked: "2026-08-24" }) === false, "nor does a blank source");
ok(esEvidenceUsable({ source: "recorded", verify: true }) === false, "and a verify flag is not a check");

console.log("--- nothing at all offers nothing ---");
ok(esEvidenceUsable(null) === false, "null is withheld");
ok(esEvidenceUsable(undefined) === false, "undefined is withheld");
ok(esEvidenceUsable({}) === false, "an item with neither field is withheld");

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
