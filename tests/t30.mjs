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

console.log("8. the arithmetic of a paper, with an either/or counted once");
{
  const twoOptions = good({ sections: [
    { name: "I", questions: [{ type: "essay", marks: 10, prompt: "p", model: "m" }] },
    { name: "IV", choose: 1, questions: [
      { type: "essay", marks: 20, prompt: "a", model: "m", label: "Question 26" },
      { type: "essay", marks: 20, prompt: "b", model: "m", label: "Question 27" },
    ] },
  ] });
  const t = E.totals(twoOptions);
  ok(t.marks === 30, "two twenty-mark options a student chooses between are worth twenty, not forty: " + t.marks);
  ok(t.sections.join() === "10,20", "and the section totals say so: " + JSON.stringify(t.sections));
  ok(t.questions === 2, "the question count is what will be attempted: " + t.questions);

  // A declared total that disagrees is REPORTED, not corrected. Either the number
  // is wrong or the questions are, and nothing here can tell which.
  const wrong = E.examine(good({ marks: 40, sections: twoOptions.sections }));
  ok(wrong.state === "malformed" && codes(wrong).includes("PAPER_TOTAL_DISAGREES"),
    "a paper claiming 40 when its sections add to 30 is refused: " + wrong.state);
  const msg = wrong.findings.find(f => f.code === "PAPER_TOTAL_DISAGREES").message;
  ok(/40/.test(msg) && /30/.test(msg), "and the refusal names BOTH numbers rather than picking one: " + JSON.stringify(msg));
  ok(E.examine(good({ marks: 30, sections: twoOptions.sections })).state === "publishable",
    "a declared total that agrees is simply accepted");
  ok(E.examine(good({ sections: twoOptions.sections })).state === "publishable",
    "and declaring no total at all is fine, because the total is optional");

  // The same at section level.
  const secWrong = E.examine(good({ sections: [{ name: "I", marks: 99,
    questions: [{ type: "essay", marks: 10, prompt: "p", model: "m" }] }] }));
  ok(codes(secWrong).includes("SECTION_TOTAL_DISAGREES"), "a section total is checked the same way");
  ok(codes(E.examine(good({ marks: "lots" }))).includes("PAPER_TOTAL_NOT_A_NUMBER"),
    "and a total that is prose is not arithmetic");
}

console.log("9. a question can be numbered, and two cannot share a number");
{
  ok(E.numberOf({ number: "21(a)" }) === "21(a)", "an authored number is read as authored");
  ok(E.numberOf({ number: "  25 " }) === "25", "trimmed");
  ok(E.numberOf({}) === null, "and a question that authors none reports none rather than guessing a position");

  const dupNum = E.examine(good({ sections: [{ name: "I", questions: [
    { type: "essay", marks: 5, prompt: "a", model: "m", number: "21" },
    { type: "essay", marks: 5, prompt: "b", model: "m", number: "21" },
  ] }] }));
  ok(dupNum.state === "malformed" && codes(dupNum).includes("QUESTION_NUMBER_DUPLICATE"),
    "two questions numbered 21 is malformed: a student cannot tell which is meant");

  const dupId = E.examine(good({ sections: [{ name: "I", questions: [
    { type: "essay", marks: 5, prompt: "a", model: "m", id: "q1" },
    { type: "essay", marks: 5, prompt: "b", model: "m", id: "q1" },
  ] }] }));
  ok(dupId.state === "malformed" && codes(dupId).includes("QUESTION_ID_DUPLICATE"),
    "and so is a repeated id, which would make a result ambiguous");

  // Checked across the WHOLE paper, not within a section, because that is the
  // scope a reader assumes when they see "Question 21".
  const across = E.examine(good({ sections: [
    { name: "I", questions: [{ type: "essay", marks: 5, prompt: "a", model: "m", number: "3" }] },
    { name: "II", questions: [{ type: "essay", marks: 5, prompt: "b", model: "m", number: "3" }] },
  ] }));
  ok(codes(across).includes("QUESTION_NUMBER_DUPLICATE"), "across sections too");
  ok(E.examine(good({ sections: [
    { name: "I", questions: [{ type: "essay", marks: 5, prompt: "a", model: "m", number: "1", id: "x" }] },
    { name: "II", questions: [{ type: "essay", marks: 5, prompt: "b", model: "m", number: "2", id: "y" }] },
  ] })).state === "publishable", "while distinct numbers and ids are simply accepted");
}

console.log("10. a question can hang more than one thing above itself");
{
  ok(E.resourcesOf({ stimulus: "a paragraph" }).length === 1, "a plain string is one resource");
  ok(E.resourcesOf({ stimulus: { text: "x" } }).length === 1, "so is a single object, which is the shape every existing paper uses");
  ok(E.resourcesOf({ stimulus: [{ text: "x" }, { img: "data:," }] }).length === 2, "and a list is as many as it holds");
  ok(E.resourcesOf({}).length === 0 && E.resourcesOf(null).length === 0, "nothing is none rather than a crash");

  const two = good({}, { stimulus: [{ caption: "Table 1", text: "rows" }, { caption: "Figure 1", img: "data:image/png;base64,iVBOR" }] });
  ok(E.examine(two).state === "publishable", "a question built on a table AND a figure no longer has to choose: " + E.examine(two).state);

  // A caption with nothing under it is a label for a resource never attached.
  const empty = E.examine(good({}, { stimulus: { caption: "Source 1" } }));
  ok(empty.state === "malformed" && codes(empty).includes("RESOURCE_EMPTY"),
    "a stimulus carrying nothing to read is malformed: " + empty.state);
  const unlabelled = E.examine(good({}, { stimulus: { text: "rows" } }));
  ok(unlabelled.state === "thin" && codes(unlabelled).includes("RESOURCE_UNLABELLED"),
    "and one with no caption is thin, because a question saying \"Source 1\" has nothing to point at");
  ok(codes(E.examine(good({}, { stimulus: 7 }))).includes("RESOURCE_MALFORMED"), "a number is not a stimulus");

  // A resource KIND is not a response format, and this file never consults one.
  ok(!A.LEGACY_TYPE.lorenz && !A.LEGACY_TYPE.incomeSource,
    "chart kinds stay out of the format table");
  const charted = E.examine(good({}, { stimulus: { caption: "Fig", charts: [{ kind: "lorenz" }] } }));
  ok(charted.state === "publishable", "and a question whose stimulus holds one is unremarkable: " + charted.state);
}

console.log("11. a question may point outside the paper, and pointing is checked for shape only");
{
  const refs = good({}, { references: { syllabus: "H3.1", topic: "operations", criteria: "bus/extended", guidance: "doc#4" } });
  ok(E.examine(refs).state === "publishable", "all four reference kinds are accepted: " + E.examine(refs).state);
  ok(E.REFERENCE_KEYS.join() === "syllabus,topic,criteria,guidance",
    "and the set is explicit rather than anything-goes: " + E.REFERENCE_KEYS.join());
  ok(E.examine(good({}, {})).state === "publishable", "a question referencing nothing is complete, because these are optional");

  const emptyRef = E.examine(good({}, { references: { syllabus: "  " } }));
  ok(emptyRef.state === "malformed" && codes(emptyRef).includes("REFERENCE_EMPTY"),
    "an empty reference points at nothing, which is worse than not pointing: " + emptyRef.state);
  const unknownRef = E.examine(good({}, { references: { horoscope: "leo" } }));
  ok(unknownRef.state === "thin" && codes(unknownRef).includes("REFERENCE_UNKNOWN"),
    "a reference kind this version cannot resolve is carried and ignored rather than guessed at: " + unknownRef.state);
  ok(codes(E.examine(good({}, { references: ["a"] }))).includes("REFERENCES_MALFORMED"), "a list is not a reference block");

  // NOTHING IS INVENTED TO FILL THESE. The contract carries a pointer; it does
  // not carry the thing pointed at, and does not fabricate one to look complete.
  const v = E.examine(refs);
  ok(!v.findings.some(f => /GUIDANCE_|CRITERIA_/.test(f.code)),
    "and no finding claims to have resolved a reference this version cannot follow");
}

console.log("12. Question 21 is a real object, and its parts are what get answered");
{
  const parent = (over = {}) => good({ sections: [{ name: "Section II", questions: [Object.assign({
    id: "q21", number: "21", instructions: "Use the case study.",
    stimulus: { caption: "Case study", text: "A cafe." },
    parts: [
      { id: "q21a", label: "a", marks: 2, format: "short_answer", directive: "outline", prompt: "Outline one.", model: "m" },
      { id: "q21b", label: "b", marks: 2, format: "short_answer", directive: "outline", prompt: "Outline two.", model: "m" },
      { id: "q21c", label: "c", marks: 3, format: "short_answer", directive: "explain", prompt: "Explain three.", model: "m" },
      { id: "q21d", label: "d", marks: 4, format: "extended_response", directive: "justify", prompt: "Justify four.", model: "m" },
    ],
  }, over)] }] });

  const v = E.examine(parent());
  ok(v.state === "publishable", "a parent with four parts imports: " + v.state + " " + JSON.stringify(codes(v)));
  ok(E.isParent(parent().sections[0].questions[0]), "and is recognised as a parent");
  ok(E.partsOf(parent().sections[0].questions[0]).length === 4, "holding four parts");

  // NOT FLATTENED. The relationship is in the object, not in the prompt prose.
  const walk = E.answerables(parent());
  ok(walk.length === 4, "four answerables, not one and not five: " + walk.length);
  ok(walk.every(a => a.parent && a.parent.id === "q21"), "each one knows the question it belongs to");
  ok(walk.map(a => a.display).join() === "21(a),21(b),21(c),21(d)",
    "and carries the name the paper gives it: " + walk.map(a => a.display).join());
  ok(walk.map(a => a.label).join() === "a,b,c,d", "built from the authored label, not the array index");

  // Authored labels survive out of order, which an index would silently correct.
  const odd = E.answerables(parent({ parts: [
    { id: "x", label: "b", marks: 1, format: "short_answer", prompt: "p", model: "m" },
    { id: "y", label: "a", marks: 1, format: "short_answer", prompt: "p2", model: "m" },
  ] }));
  ok(odd.map(a => a.display).join() === "21(b),21(a)",
    "an authored label is never replaced by position: " + odd.map(a => a.display).join());

  // MARKS. The parent is worth its parts.
  ok(E.marksOf(parent().sections[0].questions[0]) === 11, "Question 21 is worth 11: " + E.marksOf(parent().sections[0].questions[0]));
  ok(E.examine(parent()).totals.marks === 11, "and the paper total says so: " + E.examine(parent()).totals.marks);
  ok(E.examine(parent()).totals.questions === 4, "while the question count is what a student answers: " + E.examine(parent()).totals.questions);
  ok(E.examine(parent()).totals.parents === 1, "with the parent counted separately");
  ok(E.examine(parent({ marks: 11 })).state === "publishable", "an authored aggregate that agrees is accepted");

  const disagree = E.examine(parent({ marks: 12 }));
  ok(disagree.state === "malformed" && codes(disagree).includes("PARENT_TOTAL_DISAGREES"),
    "one that disagrees is refused: " + disagree.state);
  const dmsg = disagree.findings.find(f => f.code === "PARENT_TOTAL_DISAGREES").message;
  ok(/12/.test(dmsg) && /11/.test(dmsg), "naming both numbers and using neither: " + JSON.stringify(dmsg));

  // A PARENT IS NOT ANSWERED.
  const answered = E.examine(parent({ format: "extended_response" }));
  ok(answered.state === "malformed" && codes(answered).includes("PARENT_IS_NOT_ANSWERED"),
    "a parent claiming a response format is a contradiction: " + answered.state);

  // SHARED STIMULUS IS READ, NOT COPIED.
  const seen = E.answerables(parent()).map(a => E.resourcesFor(a));
  ok(seen.every(r => r.length === 1 && r[0].caption === "Case study"),
    "every part sees the case study its parent holds");
  ok(parent().sections[0].questions[0].parts.every(p => p.stimulus === undefined),
    "and no part carries a copy of it, so four copies cannot drift apart");
  const own = E.answerables(parent({ parts: [{ id: "z", label: "a", marks: 2, format: "short_answer", prompt: "p", model: "m",
    stimulus: { caption: "Table 2", text: "rows" } }] }));
  ok(E.resourcesFor(own[0]).map(r => r.caption).join() === "Case study,Table 2",
    "a part may add its own beneath the shared one: " + E.resourcesFor(own[0]).map(r => r.caption).join());

  // EXACTLY TWO LEVELS, refused rather than walked.
  const deep = E.examine(parent({ parts: [{ id: "d1", label: "a", marks: 1, prompt: "p", model: "m",
    parts: [{ id: "d2", label: "i", marks: 1, format: "short_answer", prompt: "q", model: "m" }] }] }));
  ok(deep.state === "unsupported" && codes(deep).includes("PART_NESTING_TOO_DEEP"),
    "21(a)(i) is unsupported rather than flattened: " + deep.state + " " + JSON.stringify(codes(deep)));
  ok(/academic convention this version does not have/.test(
    deep.findings.find(f => f.code === "PART_NESTING_TOO_DEEP").message),
    "and says why it is refused rather than guessed at");

  // Labels and numbers stay unambiguous.
  const dup = E.examine(parent({ parts: [
    { id: "p1", label: "a", marks: 2, format: "short_answer", prompt: "p", model: "m" },
    { id: "p2", label: "a", marks: 2, format: "short_answer", prompt: "q", model: "m" },
  ] }));
  ok(dup.state === "malformed" && codes(dup).includes("PART_LABEL_DUPLICATE"), "two parts labelled (a) is refused");
  ok(E.displayNumber("21", "a") === "21(a)", "the display identity is deterministic: " + E.displayNumber("21", "a"));
  ok(E.displayNumber("21", null) === "21" && E.displayNumber(null, "a") === "a",
    "and degrades rather than inventing half of itself");

  // (a) under 21 and (a) under 22 is ordinary; two 21(a)s is not.
  const twoParents = good({ sections: [{ name: "II", questions: [
    { id: "p21", number: "21", parts: [{ id: "a1", label: "a", marks: 1, format: "short_answer", prompt: "p", model: "m" }] },
    { id: "p22", number: "22", parts: [{ id: "a2", label: "a", marks: 1, format: "short_answer", prompt: "q", model: "m" }] },
  ] }] });
  ok(E.examine(twoParents).state === "publishable",
    "(a) appearing under two different questions is ordinary: " + E.examine(twoParents).state);

  // A parent inside an either/or brings all of its parts, and neither option is
  // counted twice.
  const choice = good({ sections: [{ name: "IV", choose: 1, questions: [
    { id: "o26", number: "26", parts: [
      { id: "o26a", label: "a", marks: 8, format: "extended_response", prompt: "p", model: "m" },
      { id: "o26b", label: "b", marks: 12, format: "extended_response", prompt: "q", model: "m" }] },
    { id: "o27", number: "27", parts: [
      { id: "o27a", label: "a", marks: 8, format: "extended_response", prompt: "r", model: "m" },
      { id: "o27b", label: "b", marks: 12, format: "extended_response", prompt: "s", model: "m" }] },
  ] }] });
  ok(E.totals(choice).marks === 20, "two twenty-mark options with parts are worth twenty, not forty: " + E.totals(choice).marks);
  ok(E.totals(choice).questions === 2, "and two answerables, not four: " + E.totals(choice).questions);
  ok(E.answerables(choice, { 0: 1 }).map(a => a.q.id).join() === "o27a,o27b",
    "choosing the second option sequences its parts: " + E.answerables(choice, { 0: 1 }).map(a => a.q.id).join());
}

console.log("13. the paper the product actually ships still imports");
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

console.log("14. the app asks the contract rather than keeping its own copy");
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

  // The display number is the paper's, where the paper says.
  ok(/PAPER\.numberOf\(q\)/.test(app), "the question header asks the paper what this question is called");
  ok(!/const num = EXAM\.seq\.slice\(0, EXAM\.pos \+ 1\)\.filter\(x => x\.kind === "q"\)\.length;/.test(app),
    "and no longer calls the student's position a question number");

  // The round trip stops discarding what it does not recognise.
  ok(/Object\.assign\(\{\}, data, \{/.test(app),
    "the importer carries the package whole rather than rebuilding it from a whitelist");
  ok(!/const paper = \{ id: "exam-" \+ Date\.now\(\), name: data\.name/.test(app),
    "the eight-field whitelist is gone");

  // Every stimulus is drawn through the contract's own reader, so a list and a
  // single object cannot diverge between the page and this suite.
  ok(/PAPER\.resourcesOf/.test(app), "the page reads resources through the contract");
  ok(!/q\.stimulus \? examSourceHTML/.test(app), "and no call site still assumes exactly one");

  // Two levels reach the runtime, not just the contract.
  ok(/PAPER\.partsOf\(q\)\.forEach\(\(part, pi\)/.test(app), "sequencing expands a parent into its parts");
  ok(/function examKey\(it\)/.test(app) && !/si \+ "-" \+ qi/.test(app),
    "one key names one answerable, and no caller builds its own");
  ok(/PAPER\.answerables\(EXAM\.paper, EXAM\.choice\)/.test(app),
    "and the totals, the results and the picker read the same walk");
  ok(/PAPER\.partsOf\(q\)\.indexOf\(card\) >= 0/.test(app),
    "a part belongs to its paper for marking, which is Gate 3A one level down");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
