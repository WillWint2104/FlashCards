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

// --- matching, on a closed question that declares phrase matching -----------
// Local scoring needs the question to DECLARE phrase matching on a closed short
// answer (decision 27), a weighting, and for every point phrasings written for
// matching. A point's text is a description of what earns the mark, never a
// search string (UX-TEST-18).
const PM = { format: "short_answer", directive: "identify", prompt: "Identify the three items.", marking: { mode: "phrase_match" } };
const ph = t => ({ text: "the answer names " + t, marks: 1, need: [t] });
const W = Object.assign({}, PM, { marks: 3, points: [ph("alpha one"), ph("beta two"), ph("gamma three")] });
const sc = a => A.scorePoints(W, a);
ok(sc("").local === true, "a closed question that declares phrase matching, weighted, with phrasings on every point, is scored locally");
ok(sc("").hits === 0 && sc("").score === 0, "AN EMPTY ANSWER SCORES ZERO, not full marks");
ok(sc(null).score === 0 && sc(undefined).score === 0, "a missing answer scores zero");
ok(sc("banana bread").hits === 0 && sc("banana bread").score === 0, "an unrelated answer scores zero");
ok(sc("alpha one").hits === 1 && sc("alpha one").score === 1, "one point addressed is one mark");
ok(sc("beta two and alpha one").hits === 2 && sc("beta two and alpha one").score === 2, "two points addressed is two marks");
ok(sc("alpha one beta two gamma three").score === 3, "every point addressed is full marks");
ok(sc("ALPHA ONE").hits === 1, "matching ignores case");
ok(sc("alpha one!").hits === 1, "matching ignores punctuation");
ok(sc("the answer names alpha one").hits === 1 && sc("the answer names").hits === 0,
   "a point is matched on its phrasing, not on its description");

// A point whose accepted phrasings all normalise to nothing matches nothing.
// This is the exact mechanism of the original fault, kept as a named case.
const empties = A.scorePoints({ marks: 1, points: [{ text: "x", marks: 1, need: ["", "   ", "!!!"] }] }, "any answer at all");
ok(empties.hits === 0 && empties.local === false, "a phrasing that normalises to nothing matches nothing");
const mixedNeed = A.scorePoints({ marks: 1, points: [{ text: "x", marks: 1, need: ["", "zzz"] }] }, "any answer at all");
ok(mixedNeed.points[0].hit === false && mixedNeed.hits === 0,
   "an empty phrasing beside a real one still matches nothing on its own");
ok(A.phraseMatch(Object.assign({}, PM, { marks: 1, points: [{ text: "x", marks: 1, need: ["", "zzz"] }] })).code === "PHRASE_MATCH_POINTS_INCOMPLETE",
   "and phrase matching refuses a point with a phrasing that can match nothing");

// --- UX-TEST-18: weighted points with no phrasings go to the marker ----------
const WX = { marks: 2, points: [{ text: "Names speed, or dependability, as the objective", marks: 1 },
                                { text: "Links it to the morning waiting times", marks: 1 }] };
const wx = A.scorePoints(WX, "Speed. Customers wait too long in the morning peak.");
ok(wx.weighted === true && wx.local === false, "weighted points with no phrasings are NOT scored locally");
ok(wx.score === null, "so no local score, rather than the zero a correct answer used to get");
ok(wx.points.every(pt => pt.hit === null) && wx.hits === 0,
   "and no point carries a verdict inferred from its own description");
ok(A.scorePoints(WX, "Names speed, or dependability, as the objective").score === null,
   "typing the description itself earns nothing locally either: it is not a search string");
const part = A.scorePoints({ marks: 2, points: [ph("alpha one"), { text: "b", marks: 1 }] }, "alpha one");
ok(part.local === false && part.score === null && part.points[0].hit === true && part.points[1].hit === null,
   "one unphrased point sends the whole question to the marker; the phrased one still reads as matched");

// --- an unweighted question never produces a score -------------------------
const G = { marks: 5, points: ["alpha one", "beta two", "gamma three", "delta four"] };
const g3 = A.scorePoints(G, "alpha one beta two gamma three");
ok(g3.hits === 0 && g3.points.every(pt => pt.hit === null),
   "an unweighted point with no phrasings carries no verdict, even when its words appear");
ok(g3.score === null, "an unweighted question yields NO score, because no weighting was authored");
const GN = { marks: 5, points: ["alpha one", "beta two", "gamma three", "delta four"].map(t => ({ text: "names " + t, need: [t] })) };
ok(A.scorePoints(GN, "alpha one beta two gamma three").hits === 3,
   "an unweighted question's phrasings are still read, which says nothing about its mark");
ok(A.scorePoints(GN, "alpha one beta two gamma three delta four").score === null,
   "not even a complete answer invents a score from unweighted points");

// --- decision 27: phrasings alone decide nothing -------------------------------
const NOMODE = Object.assign({}, W, { marking: undefined });
ok(A.scorePoints(NOMODE, "alpha one beta two gamma three").local === false && A.scorePoints(NOMODE, "alpha one beta two gamma three").score === null,
   "the same weighted question with phrasings on every point but no marking setting is NOT scored locally: it goes to the marker");
ok(A.phraseMatch(NOMODE).declared === false && A.phraseMatchFindings(NOMODE).length === 0,
   "and a question with no marking setting draws no finding: it is marked as it always was");
ok(JSON.stringify(A.CLOSED_DIRECTIVES) === JSON.stringify(["identify", "list", "name", "state"]),
   "the closed directives are identify, list, name and state, exactly: " + JSON.stringify(A.CLOSED_DIRECTIVES));
const refusedAs = (extra, code) => { const q = Object.assign({}, W, extra); const pm = A.phraseMatch(q);
  return pm.declared && !pm.ok && pm.code === code && A.scorePoints(q, "alpha one beta two gamma three").local === false; };
for (const verb of ["explain", "outline", "describe", "analyse", "assess", "evaluate", "discuss", "justify", "recommend", "compare", "examine", "propose", "account for", "to what extent", "define", "calculate"])
  ok(refusedAs({ directive: verb, prompt: verb + " the three items." }, "PHRASE_MATCH_NOT_CLOSED"),
     "phrase matching is refused, and never scores, on the open or unknown directive " + JSON.stringify(verb));
ok(refusedAs({ directive: "Identify and explain" }, "PHRASE_MATCH_NOT_CLOSED"), "a compound directive is not closed");
ok(refusedAs({ prompt: "Identify the three items and explain why they matter." }, "PHRASE_MATCH_NOT_CLOSED"), "a prompt that also asks for an explanation is not closed");
ok(refusedAs({ prompt: "Outline the three items." }, "PHRASE_MATCH_NOT_CLOSED"), "a prompt that leads with a different verb from its directive is not closed");
ok(refusedAs({ prompt: "Give the three items." }, "PHRASE_MATCH_NOT_CLOSED"), "a prompt that does not lead with its directive is not closed, even with no open verb in it");
ok(refusedAs({ command: "Explain" }, "PHRASE_MATCH_NOT_CLOSED"), "a command that contradicts the directive is not closed");
ok(refusedAs({ directive: undefined }, "PHRASE_MATCH_DIRECTIVE_ABSENT"), "phrase matching with no directive is refused");
for (const format of ["extended_response", "business_report", "multiple_choice", "calculation"])
  ok(refusedAs({ format }, "PHRASE_MATCH_NOT_SHORT_ANSWER"), "phrase matching is refused on " + format);
ok(refusedAs({ marking: { mode: "keywords" } }, "MARKING_MODE_UNSUPPORTED"), "an unknown marking mode is refused, never ignored");
ok(refusedAs({ marking: { mode: "" } }, "MARKING_MALFORMED") && refusedAs({ marking: "phrase_match" }, "MARKING_MALFORMED") && refusedAs({ marking: null }, "MARKING_MALFORMED"),
   "a marking setting with no mode, or that is not an object, is refused");
ok(refusedAs({ points: W.points.map(p => ({ text: p.text, need: p.need })) }, "PHRASE_MATCH_POINTS_INCOMPLETE"), "points without their own marks are refused");
ok(refusedAs({ marks: 2, points: [ph("a1"), ph("b2"), { text: "c", marks: 0, need: ["c3"] }] }, "PHRASE_MATCH_POINTS_INCOMPLETE"), "a point worth nothing is refused");
ok(refusedAs({ marks: 1.5, points: [Object.assign(ph("a1"), { marks: 0.5 }), Object.assign(ph("b2"), { marks: 0.5 }), Object.assign(ph("c3"), { marks: 0.5 })] }, "PHRASE_MATCH_POINTS_INCOMPLETE"),
   "part marks are refused: phrase matching awards whole marks");
ok(refusedAs({ points: [ph("alpha one"), ph("beta two"), { text: "c", marks: 1 }] }, "PHRASE_MATCH_POINTS_INCOMPLETE"), "a point with no phrasings is refused");
ok(refusedAs({ points: [ph("alpha one"), ph("beta two"), { text: "c", marks: 1, need: [3] }] }, "PHRASE_MATCH_POINTS_INCOMPLETE"), "a phrasing that is not text is refused");
ok(A.phraseMatch(Object.assign({}, W, { prompt: "Question 11 (a) Identify the three items." })).ok === true,
   "a question label before the prompt does not hide its directive");
ok(A.phraseMatch({ type: "short", directive: "state", prompt: "State TWO features.", marks: 2, points: [ph("flexible"), ph("hollow")], marking: { mode: "phrase_match" } }).ok === true,
   "a legacy short answer that states its closed directive qualifies");
ok(A.phraseMatch(Object.assign({}, W, { directive: " IDENTIFY " })).ok === true, "the directive is read without case or spacing");

// --- the weights travel to the marker ---------------------------------------
const guide = A.markerGuidance(Object.assign({ format: "short_answer", prompt: "p" }, WX), []);
ok(guide.ok === true && guide.items[0] === "Names speed, or dependability, as the objective (1 mark)",
   "a weighted point reaches the marker with its authored weight: " + JSON.stringify(guide.items));
const guideU = A.markerGuidance({ format: "short_answer", prompt: "p", marks: 5, points: ["alpha one"] }, []);
ok(guideU.items[0] === "alpha one", "an unweighted point reaches it as written, with no weight invented");

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
ok(authored.every(x => A.scorePoints(x.q, "").score === null),
   "no question in the paper authors phrasings, so none is scored locally: its points go to the marker");
ok(authored.every(x => x.q.marking === undefined && A.phraseMatch(x.q).declared === false),
   "no question in the published paper declares a marking setting: its written answers go to the subject's marker");
const q11a = authored.find(x => x.id === "11(a)");
ok(q11a && A.scorePoints(q11a.q, "Speed. Customers at the vans wait too long in the 7am to 9am morning peak, so the vans are not serving orders quickly enough.").score === null,
   "11(a)'s correct answer is no longer scored 0 against the text of its own points (UX-TEST-18)");
// The two answers the student bots found the phrase matcher misjudging, on the
// bots' own locally marked copy of 11(a): a bare keyword list (2/2 there) and a
// complete answer in unexpected wording (1/2 there). On the paper as published,
// neither is judged by matching: both go to the Business Studies marker.
const C = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/bots/testmode/corpus.v1.json"), "utf8"));
const bot = id => C.items.flatMap(i => i.answers).find(a => a.id === id).text;
ok(["sa11a-keywords", "sa11a-unusual"].every(id => { const r = A.scorePoints(q11a.q, bot(id)); return r.local === false && r.score === null; }),
   "on the published paper, a keyword list and an unusually worded answer to 11(a) both go to the marker, never to phrase matching");
// Decision 27: 11(a) is "outline", an open directive. Phrasings grafted onto it
// change nothing, and declaring phrase matching on it is refused.
const grafted = Object.assign({}, q11a.q, { points: q11a.q.points.map((p, i) => Object.assign({}, p, { need: [["speed"], ["wait"]][i] })) });
ok(A.scorePoints(grafted, "speed and the wait").local === false, "phrasings grafted onto the published 11(a) do not make it locally marked");
const declared = Object.assign({}, grafted, { marking: { mode: "phrase_match" } });
ok(A.phraseMatch(declared).code === "PHRASE_MATCH_NOT_CLOSED" && A.scorePoints(declared, "speed and the wait").local === false,
   "declaring phrase matching on the published 11(a), an outline question, is refused and never scores");
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
ok(/if \(sp\.local\)/.test(app) && !/points: sp\.points, weighted: false/.test(app),
   "the app scores locally only where the contract says it may, and puts no phrasings checklist beside a marker's mark (decision 27)");
ok(/const pm = ASSESS\.phraseMatch\(e\.q\);/.test(app) && /if \(pm\.declared && !pm\.ok\) g = ASSESS\.refuse\(pm\.code/.test(app),
   "a stored question whose declared marking cannot be honoured is refused at submit, with the contract's reason, never marked another way");
ok(/gradeWritten\(q, answer, \{ noDemo: true \}\)/.test(app) && /MARKER_UNREACHABLE/.test(app) && /MARKER_NOT_CONNECTED/.test(app),
   "points sent to the marker are never demo-graded: an unreachable or absent marker leaves them unmarked");
ok(/These are the key points considered in marking/.test(app),
   "an unweighted question's checklist says what the points are instead of stating an arithmetic");
ok(/One mark for each point addressed/.test(app),
   "a weighted question's checklist may state its weighting");
ok(/key points addressed/.test(app), "the checklist counts POINTS, separately from the mark");

// --- UX-TEST-19: a calculation answer is read as one value, or not at all ------
// The grader ran every digit in the answer together: working became one huge
// wrong number, "3:2" became 32, and "1.5 : 1" scored only because it collapsed
// to 1.51 inside the tolerance. The frozen calculation state's own examples must
// read as themselves.
const rc = A.readCalcAnswer;
const val = x => { const r = rc(x); return r.ok === true ? r.value : "refused"; };
ok(val("1.5") === 1.5, "1.5 reads as 1.5");
ok(val("1.5 : 1") === 1.5 && val("1.5:1") === 1.5, "1.5 : 1 reads as 1.5, not as 1.51");
ok(val("3 : 2") === 1.5 && val("3:2") === 1.5, "3 : 2 reads as 1.5, not as 32");
ok(val("60,000 / 40,000 = 1.5") === 1.5 && val("60 000 / 40 000 = 1.5") === 1.5,
   "working with an equals sign is read at its final value, never concatenated");
ok(val("Current ratio = 1.5 : 1") === 1.5, "a ratio after the last equals sign is read as a ratio");
ok(val("$42 000") === 42000 && val("23.4%") === 23.4 && val("125 units") === 125,
   "the frozen state's other example forms read as the value they state");
ok(val("-3.5") === -3.5 && val("\u22122") === -2 && val(".5") === 0.5, "signs and a leading point read correctly");
["60000/40000", "1.5 or 2", "1,5", "1.5 in 2025", "", "abc", "3 : 0", "   "].forEach(x =>
  ok(rc(x).ok !== true && rc(x).code === "CALC_UNREADABLE",
     "ambiguous or empty input is refused rather than read as a number: " + JSON.stringify(x)));
// The app, and every place in it that read a calculation, asks the contract.
ok(/function gradeCalc\(card, answer\) \{\n    const rd = ASSESS\.readCalcAnswer\(answer\);/.test(app),
   "gradeCalc reads the answer through the contract");
ok(/const rd = ASSESS\.readCalcAnswer\(inp\.value\);/.test(app), "the guided lessons read it through the contract too");
ok(!/replace\(\/\[\^0-9\.\\-\]\/g, ""\)/.test(app) && !/replace\(\/\[\$,%\\s\]\/g, ""\)/.test(app),
   "no private digit-stripping parser is left in app.js");
const q11c = paper.sections[1].questions[0].parts[2];
ok(q11c.expected === 1.5 && Math.abs(val("1.5 : 1") - q11c.expected) <= q11c.tolerance && Math.abs(val("3 : 2") - q11c.expected) <= q11c.tolerance,
   "on the paper's own 11(c), both of the frozen state's ratio forms are correct");

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
