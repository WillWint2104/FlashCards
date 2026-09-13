// GATE 3B: WHAT KIND OF RESPONSE IS THIS, ANSWERED ONCE.
//
// Everything here is a pure function, so it is tested as one and the run costs
// milliseconds. That matters twice over: the mapping is the sort of thing that
// wants exhaustive cases rather than a walk through a browser, and checkpoint is
// the tight tier now that full has room.
//
// What this replaces, from tests/../app.js before this slice:
//
//     return (card && card.type === "essay") ? "extended" : "short";
//
// One line, and three faults in it. A calculation went to written grading as a
// short answer. A Business Report went as an ordinary extended response, because
// the only thing marking it out was the word "Report" sitting in a field meant
// for directives, which the directive registry does not contain. And a type
// nobody had heard of became a short answer in silence.
//
// The third is the one this suite exists for. An unknown is not a short answer.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const A = require("../tools/contract/assessment.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const fmt = q => A.normaliseFormat(q);

console.log("1. every legacy type this application has ever served");
{
  // Complete and explicit. If a type is added to the product without being added
  // here, it is refused rather than quietly marked as something else - which is
  // the whole point, so the table is asserted rather than iterated blindly.
  const EXPECTED = {
    mc: "multiple_choice",
    calc: "calculation",
    define: "short_answer",
    short: "short_answer",
    essay: "extended_response",
  };
  Object.keys(EXPECTED).forEach(type => {
    const r = fmt({ type });
    ok(r.ok && r.format === EXPECTED[type],
      JSON.stringify(type) + " is " + EXPECTED[type] + ": " + JSON.stringify(r.ok ? r.format : r.code));
  });
  ok(JSON.stringify(A.LEGACY_TYPE) === JSON.stringify(EXPECTED),
    "and the table holds exactly these five, with nothing else smuggled in: " + JSON.stringify(Object.keys(A.LEGACY_TYPE)));

  // Case and whitespace are an authoring slip, not a different type.
  ok(fmt({ type: "  Essay " }).format === "extended_response", "a type is read trimmed and lower cased");
}

console.log("2. the four canonical formats the brief names, plus the one it did not");
{
  ok(fmt({ type: "mc" }).format === "multiple_choice", "multiple choice");
  ok(fmt({ type: "short" }).format === "short_answer", "ordinary written short answer");
  ok(fmt({ type: "essay" }).format === "extended_response", "extended response");
  ok(fmt({ type: "essay", command: "Report" }).format === "business_report", "a legacy business report");

  // CALCULATION IS THE FIFTH, and it is here because the product ships it.
  //
  // calc is graded by gradeCalc against a numeric `expected` with a tolerance.
  // It is objective. Mapping it to short_answer would route a number through
  // written marking, which is exactly the quiet normalisation this slice exists
  // to end; refusing it would refuse cards that work today. So it is a format of
  // its own, and this assertion is the record of that decision.
  const calc = fmt({ type: "calc" });
  ok(calc.ok && calc.format === "calculation", "a calculation is its own format, not a short answer");
  ok(A.isObjective("calculation") && A.isObjective("multiple_choice"),
    "and it is objective, like multiple choice");
  ok(A.writtenModeOf("calculation") === null && A.writtenModeOf("multiple_choice") === null,
    "so neither of them has a written mode at all");
}

console.log("3. format and directive are different questions");
{
  const r = fmt({ format: "business_report", directive: "recommend" });
  ok(r.ok && r.format === "business_report" && r.directive === "recommend",
    "a report that asks the student to recommend carries both: " + JSON.stringify([r.format, r.directive]));

  ok(fmt({ type: "essay", command: "Evaluate" }).directive === "evaluate",
    "a directive survives normalisation of the format beside it");
  ok(fmt({ type: "short", command: "Explain" }).directive === "explain",
    "on a short answer too");
  ok(fmt({ type: "essay", directive: "analyse" }).directive === "analyse",
    "and `directive` is read where a package writes it rather than `command`");

  // "Report" is a format wearing the directive field's name. It is read as the
  // format and is NOT carried on as a directive, because a report is a kind of
  // response and not a kind of thinking. The directive registry never had it.
  const legacy = fmt({ type: "essay", command: "Report" });
  ok(legacy.directive === null,
    "\"Report\" does not become a directive to make the legacy data fit: " + JSON.stringify(legacy.directive));
  const declared = fmt({ format: "extended_response", command: "report" });
  ok(declared.directive === null, "nor anywhere else it appears");

  // Nothing is invented to fill the field.
  ok(fmt({ type: "essay" }).directive === null, "a question with no directive authored reports none");
}

console.log("4. an unknown is an unknown, and never a short answer");
{
  const unknown = [
    ["check", "a lesson task type"],
    ["scenario", "the other lesson task type"],
    ["lorenz", "a chart kind from inside a stimulus"],
    ["incomeSource", "the other chart kind"],
    ["essay_v2", "a plausible future type"],
    ["REPORT", "a format name in the type field"],
  ];
  unknown.forEach(([type, what]) => {
    const r = fmt({ type });
    ok(!r.ok, what + " (" + type + ") is refused: " + JSON.stringify(r.ok ? r.format : r.code));
    ok(r.code === "FORMAT_UNSUPPORTED", "  with a code that names the problem: " + r.code);
    ok(!r.format, "  and no format at all, so nothing downstream can read one off it");
  });

  const declared = fmt({ format: "ai_marked_vibes" });
  ok(!declared.ok && declared.code === "FORMAT_UNSUPPORTED",
    "a declared format this version does not know is refused rather than guessed at: " + declared.code);
  ok(/not marked as something else instead/.test(declared.why || ""),
    "and says so in words a person could act on: " + JSON.stringify(declared.why));

  ok(!fmt({}).ok && fmt({}).code === "FORMAT_ABSENT", "a question saying nothing is refused");
  ok(!fmt(null).ok, "and so is nothing at all");

  // THE ASSERTION THIS SUITE EXISTS FOR. Not one refusal may carry short_answer.
  const refusals = unknown.map(([t]) => fmt({ type: t })).concat([fmt({ format: "ai_marked_vibes" }), fmt({})]);
  ok(refusals.every(r => !r.ok && r.format === undefined),
    "no unknown value becomes a short answer by fallback: " +
    JSON.stringify(refusals.filter(r => r.format).map(r => r.format)));
}

console.log("5. the written boundary is explicit rather than inferred");
{
  ok(A.writtenModeOf("short_answer") === "short", "short_answer marks as short");
  ok(A.writtenModeOf("extended_response") === "extended", "extended_response marks as extended");
  ok(A.writtenModeOf("business_report") === "extended",
    "business_report shares the extended plumbing, which is the point of not building a second engine");
  ok(A.writtenModeOf("nonsense") === null, "and an unknown format has no written mode to fall back on");

  // The distinction the marker genuinely needs is preserved; what has changed is
  // that it is now a lookup rather than a guess about what `essay` implies.
  ok(A.writtenModeOf("short_answer") !== A.writtenModeOf("extended_response"),
    "short and extended remain genuinely different to the marker");
  ok(A.FORMATS.filter(f => A.isObjective(f)).join() === "multiple_choice,calculation",
    "and exactly two formats never reach written marking: " + JSON.stringify(A.FORMATS.filter(A.isObjective)));
}

console.log("6. normalisation is deterministic and idempotent");
{
  const inputs = [{ type: "mc" }, { type: "essay", command: "Report" }, { format: "business_report", directive: "recommend" }];
  inputs.forEach(q => {
    const once = fmt(q);
    ok(JSON.stringify(fmt(q)) === JSON.stringify(once), "the same input gives the same answer: " + JSON.stringify(q));
    // Round trip: feed the canonical form back in and it is unchanged, which is
    // what lets normalised data be stored and re-read without drifting.
    const again = fmt({ format: once.format, directive: once.directive });
    ok(again.ok && again.format === once.format && again.directive === once.directive,
      "and normalising the normalised form changes nothing: " + JSON.stringify([once.format, once.directive]));
  });
  ok(fmt({ type: "essay", command: "Report", format: "extended_response" }).format === "extended_response",
    "a declared format wins over what the legacy fields would have inferred");
}

console.log("7. everything the product actually ships maps");
{
  // Read the shipped content the way the app does and check that not one card a
  // student can be served falls outside the table. This is the assertion that
  // would catch somebody adding a sixth card type without a format for it.
  const ctx = { window: {} };
  vm.createContext(ctx);
  ["content.js", "business-content.js"].forEach(f => {
    try { vm.runInContext(read(f), ctx); } catch (e) { /* a bundle that needs the DOM is not needed here */ }
  });
  const C = ctx.window.CONTENT || {};
  const areas = [];
  (C.topics || []).forEach(t => (t.areas || []).forEach(a => areas.push(a)));
  (C.areas || []).forEach(a => areas.push(a));
  const cards = [];
  areas.forEach(a => (a.cards || []).forEach(c => cards.push(c)));
  ok(cards.length > 100, "there is a real card bank to check: " + cards.length);

  const refused = cards.filter(c => !fmt(c).ok);
  ok(refused.length === 0,
    "every shipped card resolves to a format: " + JSON.stringify([...new Set(refused.map(c => c.type))]));
  const seen = {};
  cards.forEach(c => { const f = fmt(c).format; seen[f] = (seen[f] || 0) + 1; });
  console.log("    shipped:", JSON.stringify(seen));
  ok(Object.keys(seen).every(f => A.isFormat(f)), "and every format it resolves to is canonical");

  // The lesson tasks and chart kinds are NOT cards and must not be treated as
  // response formats. Asserted because a flat search for `.type` finds all three
  // populations and reports nine types where there are five.
  const lessonTypes = {};
  areas.forEach(a => (a.lessons || []).forEach(function walk(o) {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (typeof o.type === "string") lessonTypes[o.type] = true;
    Object.values(o).forEach(walk);
  }));
  ok(Object.keys(lessonTypes).length > 0, "lesson tasks were found: " + JSON.stringify(Object.keys(lessonTypes)));
  ["check", "scenario"].forEach(t => ok(!A.LEGACY_TYPE[t],
    JSON.stringify(t) + " is a lesson task and is not in the format table"));
  ["lorenz", "incomeSource"].forEach(t => ok(!A.LEGACY_TYPE[t],
    JSON.stringify(t) + " is a chart kind inside a stimulus and is not in the format table"));
}

console.log("8. the exam importer and the app agree with the table");
{
  const app = read("app.js");
  // The collapse is gone rather than moved.
  ok(!/\(card && card\.type === "essay"\) \? "extended" : "short"/.test(app),
    "the essay-or-short collapse is no longer in app.js");
  ok(!/item\.q\.type === "essay" \? "extended" : "short"/.test(app),
    "and neither is the copy of it Test mode kept");
  ok(/ASSESS\.normaliseFormat/.test(app), "app.js resolves a format through the substrate");

  // Every type the exam importer admits must be a type the table knows, or a
  // paper could import a question nothing can mark.
  const m = app.match(/if \(!\[([^\]]*)\]\.includes\(q\.type\)\)/);
  ok(!!m, "the exam importer's admitted list was found");
  const admitted = m ? [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]) : [];
  ok(admitted.length > 0 && admitted.every(t => !!A.LEGACY_TYPE[t]),
    "and every type it admits has a canonical format: " +
    JSON.stringify(admitted.filter(t => !A.LEGACY_TYPE[t])));
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
