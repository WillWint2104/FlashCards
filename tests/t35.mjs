// WHAT THE WRITTEN MARKER IS SENT, AND THAT IT IS WHAT THE QUESTION AUTHORED.
//
// Three faults, all found by the state 13 audit and review:
//
//   UX-TEST-12  a question's own marking points reached nothing for an extended
//               response or a business report - not the marker, not scorePoints.
//   UX-TEST-11  a business report was told to use its case study and marked by a
//               model sent `stimulus: true` and nothing else.
//   format      the worker threw `format` away and told both passes a business
//               report was an "extended response".
//
// The rules this suite holds:
//
//   1. authored marking points reach the written marker for EVERY written format;
//      a business report also sends its own instructions, first; nothing is
//      written for a question, and guidance that would be truncated is refused;
//   2. the source material the student saw reaches both passes, built
//      deterministically - text verbatim, a readable bar chart as its values -
//      and what cannot be represented is SAID to the marker and the author;
//   3. both passes are told the response's format, and the directive travels
//      separately, as the author wrote it;
//   4. the validator and the runtime reach the same verdict, by construction.
//
// The browser half - that the request leaving the page carries all of it - is
// tests/ui70.js.
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
const q11 = paper.sections[1].questions[0];
const clone = o => JSON.parse(JSON.stringify(o));

console.log("--- 1. authored marking points reach the marker, for every written format");
const g14 = A.markerGuidance(q14, []), g15 = A.markerGuidance(q15, []);
ok(g14.applies && g14.items.length === 6 && g14.items[0] === q14.instructions.trim() &&
   q14.points.every((pt, i) => g14.items[i + 1] === pt),
   "business report: its instructions first, then its five points, verbatim and in order");
ok(g15.applies && JSON.stringify(g15.items) === JSON.stringify(q15.points.map(p => typeof p === "string" ? p : p.text)),
   "extended response: its four points, which used to reach nothing (UX-TEST-12): " + g15.items.length);
const sa = { format: "short_answer", marks: 3, prompt: "x", points: ["a", { text: "b", marks: 1 }], instructions: "Use a sentence." };
ok(JSON.stringify(A.markerGuidance(sa, []).items) === '["a","b"]',
   "short answer: its points as text, with no mark values and without its instructions");
ok(A.markerGuidance({ format: "extended_response", marks: 20, prompt: "x", instructions: "Refer to Source A." }, []).items.length === 0,
   "only a business report sends its instructions: an extended response's are not report guidance");
for (const [name, q] of [["calculation", { format: "calculation", marks: 2, prompt: "x", expected: 1.5, points: ["p"] }],
                         ["multiple_choice", { format: "multiple_choice", marks: 1, prompt: "x", choices: [{ t: "a", ok: true }] }]])
  ok(A.markerGuidance(q, ["x"]).applies === false && A.markerGuidance(q, ["x"]).items.length === 0,
     `${name}: never reaches the written marker, so nothing applies`);
const legacy = { type: "essay", command: "Report", marks: 20, prompt: "Advise.", instructions: "Write a report.", points: ["Uses headings"] };
ok(JSON.stringify(A.markerGuidance(legacy, []).items) === '["Write a report.","Uses headings"]',
   "the legacy compound report is a business report here too");
const bare = { format: "business_report", marks: 20, prompt: "x" };
ok(A.markerGuidance(bare, []).items.length === 0 && JSON.stringify(A.markerGuidance(bare, ["already"]).items) === '["already"]',
   "nothing is written for a question that authors nothing, and what it sent before still travels");
const m = A.markerGuidance({ format: "business_report", marks: 20, prompt: "x", instructions: "  Write a report.  ", points: ["A", "B"] }, ["B", "", "  ", "C", "A"]);
ok(JSON.stringify(m.items) === '["Write a report.","A","B","C"]' && m.own === 3,
   "own words first, then the rest; exact duplicates once; blanks dropped");
ok(A.markerGuidance(Object.assign(clone(q14), { instructions: { text: "x" } }), []).code === "INSTRUCTIONS_MALFORMED",
   "a report's non-text instructions are refused, not stringified to [object Object]");
ok(A.markerGuidance({ format: "extended_response", marks: 20, prompt: "x", points: ["fine", 7] }, []).code === "POINTS_MALFORMED",
   "a malformed point is refused by the rule markingPoints applies everywhere");

console.log("--- 2. refused whole rather than truncated in silence");
const src = fs.readFileSync(path.join(ROOT, "proxy/worker.js"), "utf8");
const cap = src.match(/accomplish:\s*strs\(rq\.accomplish,\s*(\d+),\s*(\d+)\)/);
ok(cap && Number(cap[1]) === A.GUIDANCE_MAX_CHARS && Number(cap[2]) === A.GUIDANCE_MAX_ITEMS,
   `the guidance budget is the worker's own: ${A.GUIDANCE_MAX_ITEMS} items of ${A.GUIDANCE_MAX_CHARS} characters`);
const scap = src.match(/stimulusContext:\s*str\(b\.stimulusContext,\s*(\d+)\)/);
ok(scap && Number(scap[1]) === P.SOURCE_MAX_CHARS, `and so is the source budget: ${P.SOURCE_MAX_CHARS} characters`);
const eleven = Array.from({ length: 11 }, (_, i) => "point " + (i + 1));
ok(W.markingInput({ requirements: { accomplish: eleven } }).requirements.accomplish.length === 10,
   "the shipped intake drops an eleventh item without a word, which is why this is refused");
ok(A.markerGuidance({ format: "extended_response", marks: 20, prompt: "x", points: eleven.slice(0, 10) }, []).ok === true, "ten fit");
ok(A.markerGuidance({ format: "extended_response", marks: 20, prompt: "x", points: eleven }, []).code === "MARKING_GUIDANCE_OVER_BUDGET",
   "eleven are refused, for an extended response as much as a report");
ok(A.markerGuidance({ format: "business_report", marks: 20, prompt: "x", points: ["y".repeat(301)] }, []).code === "MARKING_GUIDANCE_OVER_BUDGET",
   "and so is an item over 300 characters");
const bigSrc = P.sourceContext([{ stimulus: { caption: "C", text: "z".repeat(4100) } }]);
ok(bigSrc.ok !== true && bigSrc.code === "SOURCE_OVER_BUDGET", "a source over its budget is refused, not cut");

console.log("--- 3. the source material, built from what was authored");
const sc14 = P.sourceContext([{ stimulus: paper.sections[2].source }, q14]);
ok(sc14.ok === true && sc14.unrepresented.length === 0, "q14's case study is represented in full");
ok(sc14.text.includes(q14.stimulus.caption) && sc14.text.includes(q14.stimulus.text),
   "its caption and its text travel verbatim");
ok(/2022: 250\n  2023: 390\n  2024: 560\n  2025: 700/.test(sc14.text),
   "and its chart travels as its four values, read from the bar heights: 250, 390, 560, 700");
ok(/Values read from the bar heights against the labelled axis \(0 to 800\)/.test(sc14.text),
   "saying how they were read, so the marker is not handed a table nobody authored");
// Strict: the reader vouches only for a chart it can read exactly.
const svg = Buffer.from(q14.stimulus.img.split(",")[1], "base64").toString("utf8");
ok(P.readBarChart(svg.replace('y="150" width="46" height="50"', 'y="149.5" width="46" height="50.5"')).ok === false,
   "a bar that reads to 252.5 is refused rather than rounded");
ok(P.readBarChart(svg.replace('>800<', '>eight hundred<')).ok === false, "an axis without numeric ends is refused");
ok(P.readBarChart(svg.replace("</svg>", '<path d="M0 0L1 1"/></svg>')).ok === false, "a chart with other shapes is refused");
const png = P.sourceContext([{ stimulus: { caption: "Figure 1", img: "data:image/png;base64,iVBOR" } }]);
ok(png.ok === true && png.unrepresented.length === 1 && /An image was shown to the student here\. It is not included/.test(png.text),
   "an image it cannot read is declared to the marker in words, never silently dropped");
const lz = P.sourceContext([{ stimulus: { caption: "Fig", charts: [{ type: "lorenz" }] } }]);
ok(lz.unrepresented.length === 1 && /A lorenz chart was shown to the student here/.test(lz.text), "so is a chart kind it cannot represent");
// A part's source is its parent's: q11(a) is answered from Kerbside Coffee.
const sc11a = P.sourceContext([{ stimulus: paper.sections[1].source }, q11, q11.parts[0]]);
ok(sc11a.ok && sc11a.text.includes(q11.stimulus.text), "a part is sent its parent's case study");

console.log("--- 4. what both passes are actually told");
const ctx = W.markingInput({ format: "business_report", responseType: "extended", stimulus: true,
  stimulusContext: sc14.text, requirements: { accomplish: g14.items } });
ok(ctx.format === "business_report" && ctx.stimulusContext === sc14.text, "the intake keeps the format and the whole source");
ok(W.markingInput({ format: "report" }).format === "", "and drops a format it does not know rather than passing it on");
const base = { subject: "Business Studies", prompt: q14.prompt, command: "recommend", marks: 20,
  responseType: ctx.responseType, format: ctx.format, stimulusContext: ctx.stimulusContext, requirements: ctx.requirements };
const p1 = W.diagMessage(Object.assign({}, base, { validContent: ctx.validContent, plan: ctx.plan, response: "P1: x", answer: "x" }));
const p2 = W.pass2Message(Object.assign({}, base, { criteria: ["a"], bands: [], stimulus: true, blocks: [],
  reference: "", vocab: [], scaffold: "(none)", faults: "(none)", diagnosis: "(none)", offPathway: 0, response: "P1: x" }));
for (const [n, msg] of [["pass 1", p1], ["pass 2", p2]]) {
  ok(/RESPONSE TYPE: business report, worth 20 marks/.test(msg), `${n} is told it is marking a business report`);
  ok(!/extended response/.test(msg), `${n} never calls it an extended response`);
  ok(/QUESTION \(recommend\) \(20 marks\)/.test(msg), `${n} carries the directive separately, as authored: recommend`);
  ok(msg.includes(q14.stimulus.text) && /2025: 700/.test(msg), `${n} is given the case study and the chart's values`);
  ok(g14.items.every(x => msg.includes(x)), `${n} is given all six pieces of the report's guidance`);
}
// The system prompts are shared by every written format. Where they still say
// "extended response" it is a rule about the extended behaviour, and every such
// rule now names the business report beside it.
const bare_ext = t => (t.match(/extended response(?! or a business report)/g) || []).length;
ok(bare_ext(W.SYSTEM) === 0 && bare_ext(W.DIAG_SYSTEM) === 0,
   "neither system prompt speaks of an extended response without also naming the business report");
// The facts a claim would be judged against are in front of the marker: rising
// online orders support "online demand is growing" and contradict "online orders
// have fallen"; the owners' stated wish is there to judge "close three stores"
// against. This proves the marker is GIVEN them. Whether a model then judges well
// cannot be proven without calling one, and no suite here does.
ok(p2.includes("The owners want to keep all six stores.") && /2022: 250[\s\S]*2025: 700/.test(p2),
   "the source facts a supported or contradicted claim turns on are in pass 2, verbatim");
const ext = W.pass2Message(Object.assign({}, base, { format: "extended_response", stimulusContext: "",
  criteria: ["a"], bands: [], stimulus: false, blocks: [], reference: "", vocab: [], scaffold: "", faults: "", diagnosis: "", offPathway: 0, response: "P1: x" }));
ok(/RESPONSE TYPE: extended response/.test(ext) && !/SOURCE MATERIAL/.test(ext),
   "an extended response is still called one, and with no source there is no source block");

console.log("--- 5. the validator and the runtime agree, by construction");
{
  const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  const exam = fs.readFileSync(path.join(ROOT, "tools/contract/exam.js"), "utf8");
  ok(/accomplish: ASSESS\.accomplishOf\(card\),/.test(app), "markingRequirements derives accomplish with ASSESS.accomplishOf");
  ok(/ASSESS\.markerGuidance\(card, ASSESS\.accomplishOf\(card\)\)/.test(app), "the marking request routes guidance with it");
  ok(/PAPER\.sourceContext\(examHoldersOf\(card\)\)/.test(app), "and builds the source with the contract's sourceContext");
  ok(/ASSESS\.markerGuidance\(q, ASSESS\.accomplishOf\(q\)\)/.test(exam), "the validator uses the same guidance functions");
  ok(!/card\.scaffold\) \|\| \[\]/.test(app) && !/q\.scaffold \|\| \[\]/.test(exam), "and neither keeps a private copy of the derivation");
}
const examOf = (q, si = 2) => { const d = clone(paper); d.sections[si].questions[0] = q; return P.examine(d); };
const codes = r => r.findings.map(f => f.code);
ok(examOf(clone(q14)).state === "publishable" && codes(examOf(clone(q14))).length === 0,
   "the real paper is publishable with no finding: its report has words to route and its chart can be sent");
const noWords = clone(q14); delete noWords.instructions; delete noWords.points;
ok(JSON.stringify(codes(examOf(noWords))) === '["MARKING_SUPPORT_ABSENT","REPORT_GUIDANCE_ABSENT"]',
   "a report with nothing to route is thin, and says why (q14 also authors no model answer, which is its own note)");
const pngQ = Object.assign(clone(q14), { stimulus: { caption: "Case study", text: "t", img: "data:image/png;base64,iVBOR" } });
ok(codes(examOf(pngQ)).includes("SOURCE_NOT_REPRESENTED") && P.isSittable(examOf(pngQ).state),
   "a figure the marker cannot be sent is reported to the author, and the paper can still be sat");
const cases = [
  ["the real report", clone(q14), 2, "publishable"],
  ["an extended response with eleven points", Object.assign(clone(q15), { points: eleven }), 3, "unsupported"],
  ["a report with ten points and its instruction", Object.assign(clone(q14), { points: eleven.slice(0, 10) }), 2, "unsupported"],
  ["a report with eight points, its instruction and a two-row scaffold", Object.assign(clone(q14), { points: eleven.slice(0, 8), scaffold: ["s1", "s2"] }), 2, "unsupported"],
  ["a malformed point", Object.assign(clone(q15), { points: ["fine", 7] }), 3, "malformed"],
  ["report instructions that are an object", Object.assign(clone(q14), { instructions: { text: "x" } }), 2, "malformed"],
  ["a source over its budget", Object.assign(clone(q14), { stimulus: { caption: "C", text: "z".repeat(4100) } }), 2, "unsupported"],
];
for (const [name, q, si, want] of cases) {
  const holders = [{ stimulus: paper.sections[si].source }, q];
  const runtimeOk = A.markerGuidance(q, A.accomplishOf(q)).ok === true && P.sourceContext(holders).ok === true;
  const v = examOf(q, si);
  ok(runtimeOk === P.isSittable(v.state), `${name}: runtime ${runtimeOk ? "marks it" : "refuses"}, validator ${P.isSittable(v.state) ? "lets it be sat" : "stops it"}`);
  ok(v.state === want, `${name}: filed as ${want} (${v.state})`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
