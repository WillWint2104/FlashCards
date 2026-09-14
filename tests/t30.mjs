// GATE 3C: A PAPER SAYS WHAT IS WRONG WITH IT, AND WHICH KIND OF WRONG.
//
// The paper contract is pure functions over a JSON document, so it is tested as
// pure functions and the run costs milliseconds. That matters: checkpoint is the
// tight tier, and nothing here needs a browser to be true.
//
// What this replaces, from app.js before this slice:
//
//     const errs = validateExam(data);
//     if (errs.length) return msg.textContent = errs[0];
//
// Two faults. A package with ten problems reported one, so fixing it was ten
// attempts. And every kind of problem read the same, when a broken document, a
// version this release cannot run, an unresolvable subject and a perfectly
// sittable paper with no model answers are four different situations — and only
// three of them stop a student.
//
// The third thing it replaces is quieter and worse: the old checks gated on a
// hardcoded list of legacy type strings, so a package authored the way the Gate
// 3B contract documents was refused at the door.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const fs = require("node:fs");
const path = require("node:path");
const E = require("../tools/contract/exam.js");
const A = require("../tools/contract/assessment.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

// The smallest paper that is genuinely publishable. Every case below is this
// with one thing changed, so a failure names the change rather than the paper.
const OK_CURRIC = { subjectKey: "business_studies", klaKey: "hsie", jurisdiction: "NSW" };
const good = (over = {}, q = {}) => ({
  format: "marginal-exam@1",
  curriculum: OK_CURRIC,
  sections: [{ name: "Section I", questions: [Object.assign({ type: "essay", marks: 5, prompt: "Explain.", model: "A model." }, q)] }],
  ...over,
});
const codes = v => v.findings.map(f => f.code);

console.log("1. the five states are distinct and each one is reachable");
{
  const cases = [
    ["publishable", good()],
    ["thin", good({}, { model: undefined })],
    ["blocked", good({ curriculum: undefined })],
    ["unsupported", good({ format: "marginal-exam@2" })],
    ["malformed", good({}, { marks: undefined })],
  ];
  cases.forEach(([want, paper]) => {
    const v = E.examine(paper);
    ok(v.state === want, want + " is reached: " + JSON.stringify(v.state) + " " + JSON.stringify(codes(v)));
  });
  ok(E.ORDER.join() === "malformed,unsupported,blocked,thin,publishable",
    "and they are ordered worst first, which is how the verdict is picked: " + E.ORDER.join());

  // THE DISTINCTION THIS SUITE EXISTS FOR. Three of the five stop a student and
  // two do not, and collapsing them into one red "invalid" is what loses that.
  ok(!E.isSittable("malformed") && !E.isSittable("unsupported") && !E.isSittable("blocked"),
    "a broken, unrunnable or unresolvable paper cannot be sat");
  ok(E.isSittable("thin") && E.isSittable("publishable"),
    "a thin paper CAN be sat: thin is a note about what it carries, not a refusal");
}

console.log("2. a package authored the modern way imports");
{
  // The regression. This exact shape was refused before this slice, because the
  // importer gated on q.type against a list of five legacy strings and this
  // question does not have one.
  const modern = good({}, { type: undefined, format: "business_report", directive: "recommend", marks: 20 });
  const v = E.examine(modern);
  ok(v.state === "publishable", "a declared business_report with a directive is accepted: " +
    v.state + " " + JSON.stringify(codes(v)));

  A.FORMATS.forEach(f => {
    const q = { type: undefined, format: f, marks: 4, prompt: "Do the thing.", model: "m" };
    if (f === "multiple_choice") { q.choices = [{ t: "a", ok: true }, { t: "b" }]; }
    if (f === "calculation") { q.expected = 12; }
    const r = E.examine(good({}, q));
    ok(r.state === "publishable", "every canonical format is admitted at the door — " + f + ": " +
      r.state + " " + JSON.stringify(codes(r)));
  });

  // And the legacy spellings still import, because old packages must not break.
  ["mc", "calc", "short", "define", "essay"].forEach(t => {
    const q = { type: t, marks: 3, prompt: "p", model: "m" };
    if (t === "mc") q.choices = [{ t: "a", ok: true }, { t: "b" }];
    if (t === "calc") q.expected = 7;
    ok(E.examine(good({}, q)).state === "publishable", "the legacy type " + JSON.stringify(t) + " still imports");
  });
}

console.log("3. an unknown format is unsupported, and a missing one is malformed");
{
  // These are different problems for whoever holds the file: one is a version or
  // a typo, the other is a hole. The old code could express neither.
  const unknown = E.examine(good({}, { type: undefined, format: "ai_marked_vibes" }));
  ok(unknown.state === "unsupported" && codes(unknown).includes("FORMAT_UNSUPPORTED"),
    "a format this version cannot run is unsupported: " + unknown.state);
  const absent = E.examine(good({}, { type: undefined }));
  ok(absent.state === "malformed" && codes(absent).includes("FORMAT_ABSENT"),
    "a question that says nothing about its format is malformed: " + absent.state);
  const conflict = E.examine(good({}, { type: "essay", format: "short_answer" }));
  ok(conflict.state === "unsupported" && codes(conflict).includes("FORMAT_CONFLICT"),
    "and the Gate 3B conflict protection reaches the door intact: " + JSON.stringify(codes(conflict)));

  // Not one of them may be admitted as something else.
  [unknown, absent, conflict].forEach(v =>
    ok(!v.sittable, "  and none of the three is sittable: " + v.state));

  const version = E.examine(good({ format: "marginal-exam@2" }));
  ok(codes(version).includes("PACKAGE_VERSION_UNSUPPORTED"),
    "a package version this release does not speak is named rather than guessed at");
  ok(/marginal-exam@1/.test(version.findings.find(f => f.code === "PACKAGE_VERSION_UNSUPPORTED").message),
    "and the message says which version this release does run");
}

console.log("4. a written question with no model answer is thin, not broken");
{
  // This WAS an error and refusing the paper for it was wrong. Since Gate 3A a
  // written response is marked against the criteria of the subject the paper
  // declares, which a question inherits. A model answer makes marking better; it
  // is not what makes it possible.
  const v = E.examine(good({}, { model: undefined }));
  ok(v.state === "thin" && v.sittable, "it imports: " + v.state + " sittable=" + v.sittable);
  ok(codes(v).includes("MARKING_SUPPORT_ABSENT"), "and says so rather than staying quiet: " + JSON.stringify(codes(v)));
  ok(E.examine(good({}, { model: undefined, points: ["a point"] })).state === "publishable",
    "a points rubric alone is enough to be complete");

  // But an objective question with nothing to mark against IS broken, because
  // there is no subject criterion that can supply a missing answer key.
  ok(E.examine(good({}, { type: "calc", expected: undefined })).state === "malformed",
    "a calculation with no expected number is malformed, because nothing can supply it");
  ok(E.examine(good({}, { type: "mc", choices: [{ t: "a", ok: true }, { t: "b", ok: true }] })).state === "malformed",
    "and multiple choice with two correct answers is malformed");
}

console.log("5. every problem is reported, not just the first");
{
  const broken = {
    format: "marginal-exam@1", curriculum: OK_CURRIC,
    sections: [{ name: "S", questions: [
      { type: "essay", prompt: "no marks", model: "m" },
      { type: "essay", marks: "five", prompt: "marks are prose", model: "m" },
      { type: "essay", marks: -2, prompt: "negative", model: "m" },
      { type: "essay", marks: 4, model: "m" },
    ] }],
  };
  const v = E.examine(broken);
  ok(v.state === "malformed", "the paper is malformed: " + v.state);
  ["MARKS_MISSING", "MARKS_NOT_A_NUMBER", "MARKS_NOT_POSITIVE", "PROMPT_MISSING"].forEach(c =>
    ok(codes(v).includes(c), "  " + c + " is reported: " + JSON.stringify(codes(v))));
  ok(v.counts.malformed >= 4, "all four are counted rather than one surviving: " + JSON.stringify(v.counts));

  // Each finding says WHERE, so a package with forty questions is fixable.
  const paths = v.findings.filter(f => f.state === "malformed").map(f => f.path);
  ok(paths.every(p => /^sections\[\d+\]\.questions\[\d+\]$/.test(p)),
    "and each one carries the path to the question it is about: " + JSON.stringify(paths));
  ok(new Set(paths).size === paths.length, "with a different path per question");
}

console.log("6. structure is checked before anything inside it");
{
  ok(E.examine(null).state === "malformed", "nothing at all is malformed");
  ok(E.examine("a string").state === "malformed", "and so is a string");
  ok(codes(E.examine({})).includes("SECTIONS_MISSING"), "a paper with no sections says so");
  ok(codes(E.examine({ curriculum: OK_CURRIC, sections: [] })).includes("SECTIONS_MISSING"), "an empty list too");
  ok(codes(E.examine({ curriculum: OK_CURRIC, sections: [{ name: "S", questions: [] }] })).includes("SECTION_EMPTY"),
    "a section with no questions cannot be sat");
  ok(codes(E.examine({ curriculum: OK_CURRIC, sections: [{ name: "S" }] })).includes("SECTION_EMPTY"),
    "nor one with no questions array at all");
  const unnamed = E.examine(good({ sections: [{ questions: [{ type: "essay", marks: 5, prompt: "p", model: "m" }] }] }));
  ok(unnamed.state === "thin" && codes(unnamed).includes("SECTION_NAME_ABSENT"),
    "a section with no name is thin rather than broken: " + unnamed.state);
}

console.log("7. curriculum stays Gate 3A's answer, translated rather than re-decided");
{
  const noCurric = E.examine(good({ curriculum: undefined }));
  ok(noCurric.state === "blocked", "a paper with no curriculum is BLOCKED, not malformed: " + noCurric.state);
  ok(codes(noCurric).includes("CURRICULUM_MISSING"), "  carrying assessment.js's own code: " + JSON.stringify(codes(noCurric)));
  ok(E.examine(good({ curriculum: { subjectKey: "Business Studies" } })).state === "blocked",
    "a display label where a key belongs is blocked");
  ok(E.examine(good({ curriculum: { subjectKey: "business_studies" } })).state === "thin",
    "and a key with no jurisdiction or KLA is thin, because only the authority is load bearing");

  // A question trying to change subject is Gate 3A's refusal, reaching here.
  const override = E.examine(good({}, { subjectKey: "economics" }));
  ok(override.state === "blocked" && codes(override).includes("QUESTION_SUBJECT_OVERRIDE"),
    "a cross-subject override is still refused: " + override.state);

  // The severities assessment.js assigns are not second-guessed here.
  const raw = A.curriculumFindings(good({ curriculum: { subjectKey: "business_studies" } }));
  const mine = E.curriculumFindings(good({ curriculum: { subjectKey: "business_studies" } }));
  ok(raw.length === mine.length, "every curriculum finding survives translation: " + raw.length + " -> " + mine.length);
  ok(mine.every(f => (f.severity === "error") === !E.isSittable(f.state)),
    "and an error is exactly a state that stops the paper being sat");
}

console.log("8. the paper the product actually ships still imports");
{
  const paper = JSON.parse(read("tests/fixtures/hsc-bus-2025.json"));
  const v = E.examine(paper);
  ok(v.state === "publishable", "the shipped fixture is publishable: " + v.state + " " + JSON.stringify(codes(v).slice(0, 4)));
  ok(v.sittable, "and can be sat");

  // Every question in it resolves to a canonical format. This is the assertion
  // that says the paper contract and the response contract agree on a real paper.
  const all = paper.sections.flatMap(s => s.questions || []);
  const seen = {};
  all.forEach(q => { const r = A.normaliseFormat(q); seen[r.ok ? r.format : r.code] = (seen[r.ok ? r.format : r.code] || 0) + 1; });
  console.log("    resolved:", JSON.stringify(seen));
  ok(Object.keys(seen).every(k => A.isFormat(k)), "every question resolves to a format, none to a refusal");
  ok(seen.business_report === 1, "including the one business report, via the legacy compound: " + seen.business_report);
}

console.log("9. the app asks the contract rather than keeping its own copy");
{
  const app = read("app.js");
  ok(!/function validateExam\(/.test(app), "validateExam is gone from app.js rather than wrapped");
  ok(!/\["mc", "calc", "short", "define", "essay"\]\.includes\(q\.type\)/.test(app),
    "and so is the hardcoded legacy type list it gated on");
  ok(/PAPER\.examine/.test(app), "the importer asks the paper contract");
  ok(/window\.MarginalExam/.test(app), "which reaches the page through the student bundle");

  const bundle = read("tools/contract/bundle.js");
  ok(/STUDENT_MODULES = \[[^\]]*"exam\.js"/.test(bundle), "exam.js is in the student bundle");
  const built = read("marginal-preview.html");
  ok(/window\.MarginalExam =/.test(built), "and the built page carries it: the student runs this file, not a copy");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
