// A BUSINESS REPORT'S OWN WORDS REACH ITS MARKER, AND NOTHING ELSE MOVES.
//
// The state 13 audit found that nothing saying "report" reached the marker. The
// worker never reads `format` (zero occurrences in proxy/worker.js), a question's
// `instructions` were never sent, and a report's marking points were read by
// nothing at runtime: not the marker, and not scorePoints either, because only a
// short-mode format is graded through it. The one authored report credits "a
// report structure with headings rather than continuous prose" and its marker was
// never told.
//
// The fix routes the report's own words through requirements.accomplish, which
// both marking passes already print as "what a strong response accomplishes".
// This suite holds four things about that:
//
//   1. it applies to a business report and to nothing else;
//   2. what travels is authored - instructions first, then points, then whatever
//      the question sent there before - in order, and nothing is written for it;
//   3. guidance the worker would silently truncate is refused whole, and the
//      budget is read out of the worker rather than restated;
//   4. the paper validator and the runtime reach the same verdict on the same
//      question, because both derive what is sent with ASSESS.accomplishOf, so a
//      paper that validates can always be marked.
//
// The browser half - that the request on the wire carries it and the extended
// response's request does not move - is tests/ui70.js.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const fs = require("node:fs");
const path = require("node:path");
const A = require("../tools/contract/assessment.js");
const P = require("../tools/contract/exam.js");
const W = await import("./worker.mjs");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const paper = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/bus-practice-paper.json"), "utf8"));
const q14 = paper.sections[2].questions[0];
const q15 = paper.sections[3].questions[0];
const clone = o => JSON.parse(JSON.stringify(o));

console.log("--- 1. a business report, and nothing else");
ok(q14.format === "business_report", "the fixture's q14 is the authored business report");
const g14 = A.reportGuidance(q14, []);
ok(g14.ok === true && g14.applies === true, "reportGuidance applies to it");
for (const [name, q] of [
  ["extended_response", q15],
  ["short_answer", { format: "short_answer", marks: 3, prompt: "x", points: ["a"], instructions: "Answer in a sentence." }],
  ["calculation", { format: "calculation", marks: 2, prompt: "x", expected: 1.5 }],
  ["multiple_choice", { format: "multiple_choice", marks: 1, prompt: "x", choices: [{ t: "a", ok: true }] }],
]) {
  const g = A.reportGuidance(q, ["something already there"]);
  ok(g.ok === true && g.applies === false && g.items.length === 0,
     `${name}: does not apply, adds nothing, and does not echo what it was given`);
}
// The legacy compound: an essay whose bare command is "Report" IS a business
// report to the substrate, and has to be one here too.
const legacy = { type: "essay", command: "Report", marks: 20, prompt: "Advise the board.", points: ["Uses headings"] };
ok(A.normaliseFormat(legacy).format === "business_report", "the legacy compound normalises to a business report");
ok(A.reportGuidance(legacy, []).applies === true && A.reportGuidance(legacy, []).items[0] === "Uses headings",
   "and is routed like one");
// "Report on ..." is an ordinary extended response, by the exact-string rule.
ok(A.reportGuidance({ type: "essay", command: "Report on the issues", marks: 20, prompt: "x", points: ["p"] }, []).applies === false,
   "while 'Report on ...' is an extended response and is not routed");

console.log("--- 2. authored words only, in the author's order");
ok(g14.items.length === 6, "q14 sends six items: one instruction and five points (" + g14.items.length + ")");
ok(g14.items[0] === q14.instructions.trim(), "the instruction is first, because it is the sentence that names the genre");
ok(q14.points.every((pt, i) => g14.items[i + 1] === pt), "then every point, verbatim and in authored order");
ok(g14.own === 6, "all six are the report's own words");
ok(g14.items.some(x => /report structure with headings/.test(x)),
   "including the one the audit was about: 'a report structure with headings'");
// Object points read the same as string points - the State 11 shape rule.
const objs = { format: "business_report", marks: 20, prompt: "x",
  points: [{ text: "Uses headings", marks: 2 }, { text: "Recommends two strategies", hint: "h" }] };
ok(JSON.stringify(A.reportGuidance(objs, []).items) === JSON.stringify(["Uses headings", "Recommends two strategies"]),
   "object points travel as their text, the same way string points do");
// Nothing is invented for a report that says nothing.
const bare = { format: "business_report", marks: 20, prompt: "x" };
const gb = A.reportGuidance(bare, []);
ok(gb.ok === true && gb.applies === true && gb.items.length === 0 && gb.own === 0,
   "a report with no instructions and no points sends nothing extra: no sentence is written for it");
ok(JSON.stringify(A.reportGuidance(bare, ["already"]).items) === JSON.stringify(["already"]),
   "and whatever the question sent before still travels, untouched");
// Merging: own words first, then the rest, exact duplicates once, blanks dropped.
const m = A.reportGuidance({ format: "business_report", marks: 20, prompt: "x", instructions: "  Write a report.  ", points: ["A", "B"] },
  ["B", "", "  ", "C", "A"]);
ok(JSON.stringify(m.items) === JSON.stringify(["Write a report.", "A", "B", "C"]),
   "own words first, then the rest; exact duplicates once; blanks dropped; whitespace trimmed: " + JSON.stringify(m.items));
ok(m.own === 3, "own counts the report's words, not what was merged in");

console.log("--- 3. refused whole rather than truncated in silence");
// The budget is the worker's, read from the worker. If someone changes the cap
// there, this refusal has to move with it or it stops meaning anything.
const src = fs.readFileSync(path.join(ROOT, "proxy/worker.js"), "utf8");
const cap = src.match(/accomplish:\s*strs\(rq\.accomplish,\s*(\d+),\s*(\d+)\)/);
ok(!!cap, "the worker's accomplish cap is where this suite expects to read it");
ok(cap && Number(cap[1]) === A.GUIDANCE_MAX_CHARS && Number(cap[2]) === A.GUIDANCE_MAX_ITEMS,
   `the contract's budget is the worker's: ${A.GUIDANCE_MAX_ITEMS} items of ${A.GUIDANCE_MAX_CHARS} characters`);
// And the truncation it guards against is real: the shipped intake drops the
// eleventh item and cuts the long one, and says nothing.
const eleven = Array.from({ length: 11 }, (_, i) => "point " + (i + 1));
ok(W.markingInput({ requirements: { accomplish: eleven } }).requirements.accomplish.length === 10,
   "the shipped worker keeps ten of eleven items and reports nothing, which is why this is refused");
ok(W.markingInput({ requirements: { accomplish: ["x".repeat(301)] } }).requirements.accomplish[0].length === 300,
   "and cuts a 301-character item to 300, also in silence");

const ten = { format: "business_report", marks: 20, prompt: "x", points: eleven.slice(0, 10) };
ok(A.reportGuidance(ten, []).ok === true, "ten items fit");
const over = A.reportGuidance(Object.assign(clone(ten), { instructions: "Write a report." }), []);
ok(over.ok !== true && over.code === "REPORT_GUIDANCE_OVER_BUDGET" && over.items === 11,
   "eleven are refused, whole, with the count");
ok(A.reportGuidance(ten, ["one more"]).code === "REPORT_GUIDANCE_OVER_BUDGET",
   "and the budget is on what would actually be sent, not on the report's own words alone");
ok(A.reportGuidance(ten, ["point 1"]).ok === true,
   "while an exact duplicate costs nothing, because it is sent once");
ok(A.reportGuidance({ format: "business_report", marks: 20, prompt: "x", points: ["y".repeat(300)] }, []).ok === true,
   "a 300-character item fits");
const long = A.reportGuidance({ format: "business_report", marks: 20, prompt: "x", points: ["ok", "y".repeat(301)] }, []);
ok(long.code === "REPORT_GUIDANCE_OVER_BUDGET" && long.item === 2 && long.chars === 301,
   "a 301-character item is refused, naming which piece and how long");
ok(!/—/.test(over.why + long.why), "the refusal is read by a student, so it carries no em dash");
const mal = A.reportGuidance({ format: "business_report", marks: 20, prompt: "x", points: ["fine", 7] }, []);
ok(mal.ok !== true && mal.code === "POINTS_MALFORMED",
   "a malformed point is refused by the same rule markingPoints applies everywhere");

console.log("--- 4. what the marker is actually told");
// Through the shipped intake and both shipped prompt builders.
const ctx = W.markingInput({ responseType: "extended", requirements: { accomplish: g14.items } });
ok(ctx.requirements.accomplish.length === 6, "the worker's intake keeps all six");
const base = { subject: "Business Studies", prompt: q14.prompt, command: "recommend", marks: 20,
  responseType: ctx.responseType, requirements: ctx.requirements };
const p1 = W.diagMessage(Object.assign({}, base, { validContent: ctx.validContent, plan: ctx.plan, response: "P1: x", answer: "x" }));
const p2 = W.pass2Message(Object.assign({}, base, { criteria: ["a"], bands: [], stimulus: true, blocks: [],
  reference: "", vocab: [], scaffold: "(none)", faults: "(none)", diagnosis: "(none)", offPathway: 0, response: "P1: x" }));
ok(g14.items.every(x => p1.includes(x)), "pass 1 (the diagnosis) is told all six");
ok(g14.items.every(x => p2.includes(x)), "pass 2 (the judgement) is told all six");
ok(/what a strong response accomplishes: 1\. Use the case study below/.test(p2),
   "under 'what a strong response accomplishes', instruction first");
// THE RESIDUAL, asserted as what it is. No worker change was made, so the one line
// that names the response type still calls a report an extended response. When
// that changes, this flips and brings someone back to docs/state13-audit.md.
ok(/RESPONSE TYPE: extended response/.test(p2),
   "KNOWN: the response-type line still says 'extended response' - the genre travels as guidance, not as a type");

console.log("--- 5. the validator and the runtime agree, by construction");
// The accomplish list is derived ONCE, by ASSESS.accomplishOf. This section used to
// hand-copy the validator's own expression as its "runtime" side, which tested a
// string against itself. Now the source is pinned: markingRequirements, the
// marking request and the validator each call the shared function and nothing else.
{
  const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  const exam = fs.readFileSync(path.join(ROOT, "tools/contract/exam.js"), "utf8");
  ok(/accomplish: ASSESS\.accomplishOf\(card\),/.test(app), "markingRequirements derives accomplish with ASSESS.accomplishOf");
  ok(/ASSESS\.reportGuidance\(card, ASSESS\.accomplishOf\(card\)\)/.test(app), "the marking request routes with it");
  ok(/ASSESS\.reportGuidance\(q, ASSESS\.accomplishOf\(q\)\)/.test(exam), "and so does the validator");
  ok(!/card\.scaffold\) \|\| \[\]/.test(app) && !/q\.scaffold \|\| \[\]/.test(exam),
     "and neither keeps a private copy of the derivation");
  ok(JSON.stringify(A.accomplishOf({ requirements: { accomplish: ["a"] }, scaffold: ["s"] })) === '["a"]' &&
     JSON.stringify(A.accomplishOf({ scaffold: ["s"] })) === '["s"]' &&
     JSON.stringify(A.accomplishOf({ requirements: {} })) === "[]" && JSON.stringify(A.accomplishOf(null)) === "[]",
     "accomplishOf: authored requirements win, then the scaffold, then nothing");
}
const examOf = q => { const d = clone(paper); d.sections[2].questions[0] = q; return P.examine(d); };
const codes = r => r.findings.map(f => f.code);
const real = examOf(clone(q14));
ok(real.state === "publishable" && !codes(real).some(c => /^REPORT_/.test(c)),
   "the real paper is publishable, with no report finding, because its report has words to route");
const noWords = clone(q14); delete noWords.instructions; delete noWords.points;
ok(codes(examOf(noWords)).includes("REPORT_GUIDANCE_ABSENT") && examOf(noWords).state === "thin",
   "a report with nothing to route is thin, with a note that says so");
// The note is about what is SENT, not about which field it came from: a report
// whose only guidance is an authored requirements.accomplish does tell its marker.
const onlyReq = Object.assign(clone(noWords), { requirements: { accomplish: ["Uses report headings"] } });
ok(!codes(examOf(onlyReq)).includes("REPORT_GUIDANCE_ABSENT"),
   "no note when authored requirements carry the guidance instead, because they are sent");
const cases = [
  ["the real report", clone(q14), "publishable"],
  ["eleven points", Object.assign(clone(q14), { points: eleven }), "unsupported"],
  ["a long point", Object.assign(clone(q14), { points: ["z".repeat(301)] }), "unsupported"],
  ["ten points plus the instruction", Object.assign(clone(q14), { points: eleven.slice(0, 10) }), "unsupported"],
  ["eight points, the instruction and two authored accomplish items", Object.assign(clone(q14), { points: eleven.slice(0, 8), requirements: { accomplish: ["extra one", "extra two"] } }), "unsupported"],
  ["eight points, the instruction and a two-row scaffold", Object.assign(clone(q14), { points: eleven.slice(0, 8), scaffold: ["s1", "s2"] }), "unsupported"],
  ["a malformed point", Object.assign(clone(q14), { points: ["fine", 7] }), "malformed"],
  ["instructions that are an object", Object.assign(clone(q14), { instructions: { text: "Use the case study." } }), "malformed"],
  ["instructions that are a list", Object.assign(clone(q14), { instructions: ["Use the case study.", "Write a report."] }), "malformed"],
];
for (const [name, q, want] of cases) {
  const runtime = A.reportGuidance(q, A.accomplishOf(q));
  const v = examOf(q);
  ok((runtime.ok !== true) === !P.isSittable(v.state),
     `${name}: runtime ${runtime.ok === true ? "marks it" : "refuses (" + runtime.code + ")"}, validator ${P.isSittable(v.state) ? "lets it be sat" : "stops it"}`);
  ok(v.state === want, `${name}: filed as ${want}, by exam.js's own taxonomy (${v.state})`);
}
// Not `blocked`: that state means a dependency that does not resolve.
ok(cases.every(([, q]) => examOf(q).state !== "blocked"), "no report refusal is filed as blocked");
// And the non-string instructions never reach anyone as "[object Object]".
const objI = Object.assign(clone(q14), { instructions: { text: "x" } });
ok(A.reportGuidance(objI, []).code === "INSTRUCTIONS_MALFORMED", "object instructions are refused, not stringified");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
