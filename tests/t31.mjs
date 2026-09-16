// MARKING POINTS ARE NOT MARKS, AND AN UNANSWERED QUESTION IS NOT FULL MARKS.
//
// Two faults met in the short-answer grader, and this suite exists so neither
// can come back quietly.
//
// THE SHAPE. `gradePoints` read every entry as an object - `pt.text`, `pt.need`
// - while the contract's own fixture authors plain strings. `pt.text` was
// undefined, the normaliser turned undefined into "", and every answer contains
// "". So every point registered as addressed:
//
//     answer ""       -> 3/3 on a three-mark question
//     answer "banana" -> 3/3
//     rendered text   -> "undefined"
//
// THE SEMANTICS, which is the one that matters. Nothing anywhere said a point
// was worth a mark, and the papers prove it generally is not: the extended
// responses author four points against twelve and twenty marks. A mark is
// derived from points ONLY where a paper authors per-point marks that sum to
// the question's marks. A question whose point COUNT happens to equal its mark
// count has still not said one point is one mark, and inferring it from the
// coincidence is the substitution Gate 3B removed from formats.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const fs = require("node:fs");
const path = require("node:path");
const A = require("../tools/contract/assessment.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const refused = r => A.outcomeOf(r) === "refused";

// --- reading: both authored shapes, and nothing else -----------------------
const strings = A.markingPoints({ marks: 3, points: ["one", "two", "three"] });
ok(strings.ok === true && strings.count === 3, "a list of strings reads as three points");
ok(strings.points[0].text === "one", "a string point's text is the string itself");
ok(strings.points.every(p => p.marks === null), "a string point carries no mark of its own");

const objs = A.markingPoints({ marks: 2, points: [{ text: "a", marks: 1, hint: "h", need: ["alt"] }, { text: "b", marks: 1 }] });
ok(objs.ok === true && objs.points[0].hint === "h" && objs.points[0].need[0] === "alt",
   "an object point keeps its hint and accepted phrasings");

// --- the coincidence is not a declaration ----------------------------------
ok(strings.weighted === false,
   "three unweighted points on a three-mark question is NOT a one-mark-per-point declaration");
ok(objs.weighted === true, "per-point marks that sum to the question's marks ARE the declaration");
ok(A.markingPoints({ marks: 5, points: [1, 2, 3, 4].map(() => ({ text: "x", marks: 1 })) }).weighted === false,
   "per-point marks that do not sum to the question's marks are not a weighting");
ok(A.markingPoints({ marks: 2, points: [{ text: "a", marks: 1 }, "b"] }).weighted === false,
   "a partly weighted list is not a weighting");

// --- malformed fails closed ------------------------------------------------
ok(refused(A.markingPoints({ marks: 2, points: [7, "b"] })), "a point that is neither text nor an object is refused");
ok(refused(A.markingPoints({ marks: 2, points: [{ text: "   " }] })), "a point with blank text is refused");
ok(refused(A.markingPoints({ marks: 2, points: [""] })), "an empty string point is refused");
ok(refused(A.markingPoints({ marks: 2, points: [{ text: "a", marks: "one" }] })), "a non-numeric mark is refused");
ok(refused(A.markingPoints({ marks: 2, points: [{ text: "a", marks: -1 }] })), "a negative mark is refused");
ok(A.markingPoints({ marks: 2, points: [7] }).code === "POINTS_MALFORMED", "the refusal carries POINTS_MALFORMED");

// --- matching, on a weighted question --------------------------------------
const W = { marks: 3, points: [{ text: "alpha one", marks: 1 }, { text: "beta two", marks: 1 }, { text: "gamma three", marks: 1 }] };
const sc = a => A.scorePoints(W, a);
ok(sc("").hits === 0 && sc("").score === 0, "AN EMPTY ANSWER SCORES ZERO, not full marks");
ok(sc(null).score === 0 && sc(undefined).score === 0, "a missing answer scores zero");
ok(sc("banana bread").hits === 0 && sc("banana bread").score === 0, "an unrelated answer scores zero");
ok(sc("alpha one").hits === 1 && sc("alpha one").score === 1, "one point addressed is one mark");
ok(sc("beta two and alpha one").hits === 2 && sc("beta two and alpha one").score === 2, "two points addressed is two marks");
ok(sc("alpha one beta two gamma three").score === 3, "every point addressed is full marks");
ok(sc("ALPHA ONE").hits === 1, "matching ignores case");
ok(sc("alpha one!").hits === 1, "matching ignores punctuation");

// A point whose accepted phrasings all normalise to nothing matches nothing.
// This is the exact mechanism of the original fault, kept as a named case.
const empties = A.scorePoints({ marks: 1, points: [{ text: "x", marks: 1, need: ["", "   ", "!!!"] }] }, "any answer at all");
ok(empties.hits === 0, "a phrasing that normalises to nothing matches nothing");

// --- an unweighted question never produces a score -------------------------
const G = { marks: 5, points: ["alpha one", "beta two", "gamma three", "delta four"] };
const g3 = A.scorePoints(G, "alpha one beta two gamma three");
ok(g3.hits === 3 && g3.count === 4, "an unweighted question still reports which key points were reached");
ok(g3.score === null, "an unweighted question yields NO score, because no weighting was authored");
ok(A.scorePoints(G, "alpha one beta two gamma three delta four").score === null,
   "not even a complete answer invents a score from unweighted points");

// --- the real paper --------------------------------------------------------
const paper = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/bus-practice-paper.json"), "utf8"));
const authored = [];
for (const sec of paper.sections) for (const q of (sec.questions || [])) for (const it of (q.parts || [q])) {
  if (Array.isArray(it.points) && it.points.length)
    authored.push({ id: String(q.number) + (it.label ? "(" + it.label + ")" : ""), q: it });
}
ok(authored.length >= 10, "the fixture still carries marking points to test against");
ok(authored.every(x => A.markingPoints(x.q).ok === true), "every authored point list in the paper reads cleanly");
ok(authored.every(x => A.scorePoints(x.q, "").hits === 0),
   "NO question in the paper awards a point to an empty answer");
ok(authored.every(x => { const r = A.scorePoints(x.q, ""); return r.weighted ? r.score === 0 : r.score === null; }),
   "no question in the paper scores an empty answer above zero");
ok(authored.every(x => A.markingPoints(x.q).points.every(p => p.text && p.text !== "undefined")),
   "every rendered point is the authored text, never the word undefined");

const weighted = authored.filter(x => A.markingPoints(x.q).weighted).map(x => x.id);
const guidance = authored.filter(x => !A.markingPoints(x.q).weighted).map(x => x.id);
ok(weighted.length > 0 && guidance.length > 0,
   "the paper exercises both cases: weighted " + weighted.join(",") + " / guidance " + guidance.join(","));
ok(guidance.includes("12(b)"),
   "12(b) — five marks, four points — stays the unweighted case rather than being made to fit");
ok(authored.every(x => { const mp = A.markingPoints(x.q); return !mp.weighted || mp.total === x.q.marks; }),
   "every weighted question's points sum to its marks");

// --- the app reads the contract rather than re-deciding --------------------
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
ok(/ASSESS\.scorePoints\(q, answer\)/.test(app), "the short-answer grader asks the contract");
ok(!/const need = \(Array\.isArray\(pt\.need\)/.test(app), "the old object-only reader is gone from app.js");
ok(!/pt\.marks \|\| 1/.test(app), "app.js no longer defaults a point to one mark");
ok(/sp\.weighted/.test(app) && /weighted: false/.test(app),
   "the app carries the weighted flag onto the result so a screen cannot imply an unauthored rule");
ok(/These are the key points considered in marking/.test(app),
   "an unweighted question's checklist says what the points are instead of stating an arithmetic");
ok(/One mark for each point addressed/.test(app),
   "a weighted question's checklist may state its weighting");
ok(/key points addressed/.test(app), "the checklist counts POINTS, separately from the mark");

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
