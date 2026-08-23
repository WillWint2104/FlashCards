// THE WITHHOLDING CONTRACT, at the logic level.
//
//   unreviewed  -> esLearning() returns null, so nothing downstream can offer a lesson
//   authored    -> esLearning() returns the learning object
//
// Tested against a fixture the test owns, so finishing a real question cannot
// break it and cannot silently empty it. The UI half of the same contract is
// ui32.js; this half proves the rule, that one proves the student sees it.
import { setPathways, esLearning } from "./out/learn-shim.mjs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { WITHHOLDING_FIXTURE } = require("./fixtures/withholding.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FAIL:", m); } };

const paths = WITHHOLDING_FIXTURE.questions[0].pathways;
setPathways(paths);

const unreviewed = paths.find(p => p.id === "ct-unreviewed");
const authored = paths.find(p => p.id === "ct-authored");

console.log("--- the fixture is the two states, and nothing else ---");
ok(paths.length === 2, "two pathways: " + paths.length);
ok(unreviewed && unreviewed.learning.status === "unreviewed", "one is unreviewed");
ok(authored && authored.learning.status === "authored", "one is authored");

console.log("--- unreviewed offers nothing ---");
ok(esLearning({ argumentId: "ct-unreviewed" }) === null,
  "esLearning returns null for an unreviewed pathway");

console.log("--- authored offers the lesson ---");
const L = esLearning({ argumentId: "ct-authored" });
ok(L !== null, "esLearning returns an object for an authored pathway");
ok(L && L.know === authored.learning.know, "and it is that pathway's own learning, not another's");
ok(L && Array.isArray(L.chain) && L.chain.length === 4, "carrying the chain it was authored with");

console.log("--- the rule reads status, not the presence of content ---");
// An unreviewed pathway carrying a full learning body must STILL be withheld.
// Otherwise the state means nothing and half-finished content reaches a student
// the moment someone drafts it.
const drafted = JSON.parse(JSON.stringify(authored));
drafted.id = "ct-drafted";
drafted.learning.status = "unreviewed";
setPathways(paths.concat([drafted]));
ok(esLearning({ argumentId: "ct-drafted" }) === null,
  "a fully drafted lesson marked unreviewed is still withheld");

console.log("--- an unknown or absent pathway offers nothing ---");
ok(esLearning({ argumentId: "no-such-pathway" }) === null, "an unknown id offers nothing");
ok(esLearning({}) === null, "a paragraph with no argument offers nothing");
ok(esLearning(null) === null, "and neither does nothing at all");

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
