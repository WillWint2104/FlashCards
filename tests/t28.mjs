// GATE 3A: CURRICULUM IDENTITY AND EVALUATION SAFETY, WITHOUT A BROWSER.
//
// The two rules this slice establishes are pure functions, so they are tested as
// pure functions and the run costs milliseconds. What still needs a browser -
// that the totals on screen never say NaN, that a refusal restores the submit
// control and shows its reason - is tests/ui68.js, and it is deliberately the
// smaller of the two files.
//
// The acceptance matrix in section 3 is the one named in the Gate 3A brief. It
// exists because the audit MEASURED the old behaviour rather than assuming it: a
// paper declaring subjectKey "business_studies" was marked with Economics
// criteria, and so was a paper declaring nothing. Every row here would have
// failed before this slice, and none of them may pass by falling through to
// Economics.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const fs = require("node:fs");
const path = require("node:path");
const A = require("../tools/contract/assessment.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

// The two packages the acceptance matrix needs. Deliberately not the shipped
// content: this asserts the RULE, and a rule that only works on today's three
// subjects is not a rule.
const PACKAGES = {
  business_studies: { label: "Business Studies", markingCriteria: [{ name: "Business criterion" }] },
  economics: { label: "Economics", markingCriteria: [{ name: "Economics criterion" }] },
  no_criteria_yet: { label: "Legal Studies", markingCriteria: [] },
};
const paper = curriculum => ({ name: "p", curriculum: curriculum, sections: [] });

console.log("1. a result is one of three things, and only one of them is arithmetic");
{
  const good = A.marked({ score: 12, max: 20, kind: "llm" });
  const no = A.refuse("SUBJECT_UNREGISTERED", "no package named that is available");
  const broke = A.fail("TRANSPORT", "the marker could not be reached");

  ok(A.outcomeOf(good) === "success", "a mark is a success");
  ok(A.outcomeOf(no) === "refused", "a refusal is a refusal");
  ok(A.outcomeOf(broke) === "failed", "a failure is a failure");
  ok(A.isMarked(good) && !A.isMarked(no) && !A.isMarked(broke),
    "and only the mark passes the gate");

  // The shape the audit found in the wild, built before this module existed.
  const legacy = { error: "subject-unresolved", subject: "Underwater Basket Weaving", note: "..." };
  ok(A.outcomeOf(legacy) === "refused",
    "an old {error} object is read as a refusal by its shape, not by a label it does not carry");
  ok(!A.isMarked(legacy), "and it never reaches scoring");

  // A success is not a success because it says so. This is the guard that stops
  // the exact defect coming back through a different door.
  ok(!A.isMarked({ outcome: "success", score: undefined, max: 20 }),
    "a success carrying an undefined score is not a mark");
  ok(!A.isMarked({ outcome: "success", score: NaN, max: 20 }), "nor one carrying NaN");
  ok(!A.isMarked({ outcome: "success", score: 5, max: undefined }), "nor one with no maximum");
  ok(A.outcomeOf(null) === "failed" && A.outcomeOf(undefined) === "failed",
    "and nothing at all is a failure rather than a zero");
}

console.log("2. totals cannot become NaN, whatever is in the bag");
{
  const t = A.tally([
    { marks: 2, result: A.marked({ score: 2, max: 2 }) },
    { marks: 20, result: A.refuse("CURRICULUM_UNOWNED", "no subject") },
    { marks: 4, result: A.fail("TRANSPORT", "unreachable") },
    { marks: 3, result: { error: "subject-unresolved" } },
    { marks: 5, result: null },
  ]);
  ok(t.got === 2, "only the marked question contributes to the score: " + t.got);
  ok(t.max === 34, "and every question still costs its marks, marked or not: " + t.max);
  ok(Number.isFinite(t.got) && Number.isFinite(t.max), "both totals are numbers");
  ok(t.done === 1 && t.refused === 2 && t.failed === 1,
    "the three outcomes are counted apart: " + JSON.stringify(t));

  // The precise arithmetic the audit watched turn into NaN.
  const audit = A.tally([
    { marks: 2, result: A.marked({ score: 2, max: 2 }) },
    { marks: 20, result: { error: "subject-unresolved", note: "..." } },
  ]);
  ok(audit.got === 2 && audit.max === 22 && !Number.isNaN(audit.got),
    "the reproduced paper totals 2/22 rather than NaN/22: " + audit.got + "/" + audit.max);

  ok(A.tally([{ marks: 20, result: A.marked({ score: 999, max: 20 }) }]).got === 20,
    "a score above the maximum is clamped rather than trusted");
  ok(A.tally([]).got === 0 && A.tally(null).max === 0, "an empty paper is 0/0, not NaN");
}

console.log("3. the curriculum acceptance matrix");
{
  const res = (curric, q) => A.resolveAuthority({ curriculum: curric, question: q, packages: PACKAGES });

  const bus = res({ jurisdiction: "NSW", klaKey: "hsie", subjectKey: "business_studies" });
  ok(bus.ok && bus.subjectKey === "business_studies", "a Business exam resolves to Business");
  ok(bus.criteria[0].name === "Business criterion", "and carries Business criteria");
  ok(bus.label === "Business Studies", "and the label is the package's own");

  const eco = res({ jurisdiction: "NSW", klaKey: "hsie", subjectKey: "economics" });
  ok(eco.ok && eco.criteria[0].name === "Economics criterion",
    "an Economics exam resolves to Economics criteria");

  // The display label is not consulted, so changing it changes nothing.
  const relabelled = res({ subjectKey: "business_studies", course: "Something Else Entirely" });
  ok(relabelled.ok && relabelled.criteria[0].name === "Business criterion",
    "altering the Business exam's display text still yields Business criteria");

  const crossed = res({ subjectKey: "business_studies" }, { subjectKey: "economics" });
  ok(!crossed.ok && crossed.code === "SUBJECT_OVERRIDE_REFUSED",
    "a question cross-wired to Economics inside a Business paper is refused: " + crossed.code);
  ok(/does not change the subject/.test(crossed.why || ""),
    "and says why in words a student could read: " + JSON.stringify(crossed.why));

  const same = res({ subjectKey: "business_studies" }, { subjectKey: "business_studies" });
  ok(same.ok, "a question repeating its paper's own key is redundant, not a conflict");

  const unknown = res({ subjectKey: "underwater_basket_weaving" });
  ok(!unknown.ok && unknown.code === "SUBJECT_UNREGISTERED",
    "an unknown subjectKey is refused: " + unknown.code);

  ok(!res(null).ok && res(null).code === "CURRICULUM_UNOWNED",
    "a paper with no curriculum block is refused");
  ok(!res({ jurisdiction: "NSW", klaKey: "hsie" }).ok,
    "and so is one that classifies itself but names no subject");

  const labelish = res({ subjectKey: "Business Studies" });
  ok(!labelish.ok && labelish.code === "SUBJECT_KEY_MALFORMED",
    "a display label in the key field is refused rather than matched: " + labelish.code);

  const empty = res({ subjectKey: "no_criteria_yet" });
  ok(!empty.ok && empty.code === "CRITERIA_ABSENT",
    "a registered package with an empty criteria list is refused, because [] is not a list of criteria");

  // Question-level criteria are allowed WITHIN a resolved subject. They are
  // criteria for this question, never a substitute for saying whose question it is.
  const own = res({ subjectKey: "business_studies" }, { markingCriteria: [{ name: "this question only" }] });
  ok(own.ok && own.source === "question" && own.criteria[0].name === "this question only",
    "a question may carry its own criteria once its subject is settled");
  const ownNoSubject = res(null, { markingCriteria: [{ name: "this question only" }] });
  ok(!ownNoSubject.ok,
    "but carrying criteria does not let a paper skip declaring who owns it");

  // No row above passed by falling through.
  const refusals = [crossed, unknown, res(null), labelish, empty];
  ok(refusals.every(r => !r.ok && !r.criteria),
    "no refusal carries criteria it could be talked into using");
  ok(!refusals.some(r => JSON.stringify(r).indexOf("Economics criterion") >= 0),
    "and not one of them fell through to Economics");
}

console.log("4. a KLA classifies a course and never marks one");
{
  const src = read("tools/contract/assessment.js");
  const fn = src.slice(src.indexOf("function resolveAuthority"), src.indexOf("// ------", src.indexOf("function resolveAuthority")));
  ok(fn.length > 200, "resolveAuthority was found in the source: " + fn.length + " chars");
  ok(fn.indexOf("klaKey") < 0,
    "resolveAuthority does not read klaKey at all, so hsie cannot start deciding how an answer is marked");

  // And demonstrably: the KLA can be anything, or absent, without moving the mark.
  const a = A.resolveAuthority({ curriculum: { klaKey: "hsie", subjectKey: "business_studies" }, packages: PACKAGES });
  const b = A.resolveAuthority({ curriculum: { klaKey: "science", subjectKey: "business_studies" }, packages: PACKAGES });
  const c = A.resolveAuthority({ curriculum: { subjectKey: "business_studies" }, packages: PACKAGES });
  ok(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(b) === JSON.stringify(c),
    "three different KLAs, one identical resolution");
}

console.log("5. what an importer is told about a paper's curriculum");
{
  const f = p => A.curriculumFindings(p);
  const codes = p => f(p).map(x => x.code);

  ok(codes(paper(null)).indexOf("CURRICULUM_MISSING") >= 0, "no curriculum block is an error");
  ok(f(paper(null))[0].severity === "error", "and it is an error rather than a note");
  ok(codes(paper({ jurisdiction: "NSW" })).indexOf("SUBJECT_KEY_MISSING") >= 0,
    "a curriculum with no subjectKey is an error");
  ok(codes(paper({ subjectKey: "Business Studies" })).indexOf("SUBJECT_KEY_MALFORMED") >= 0,
    "a label in the key field is an error");

  // Only the authority is load-bearing. A paper that knows who marks it is
  // importable without knowing its stage or its syllabus version.
  const minimal = f(paper({ subjectKey: "business_studies" }));
  ok(!minimal.some(x => x.severity === "error"),
    "a paper naming only its subjectKey imports: " + JSON.stringify(minimal.map(x => x.code)));
  ok(minimal.some(x => x.code === "KLA_ABSENT" && x.severity === "warning"),
    "with the missing classification reported as a warning, not a gate");

  const full = f(paper({ jurisdiction: "NSW", klaKey: "hsie", subjectKey: "business_studies",
    course: "Business Studies", stage: "Stage 6", syllabusRef: "bos-2010" }));
  ok(full.length === 0, "a fully declared paper reports nothing at all: " + JSON.stringify(full));

  ok(codes(paper({ subjectKey: "business_studies", klaKey: "HSIE" })).indexOf("KLA_KEY_MALFORMED") >= 0,
    "a KLA is a key too, and a display label there is caught");
}

console.log("6. a question does not change the subject that marks it");
{
  const p = {
    curriculum: { subjectKey: "business_studies" },
    sections: [{ questions: [
      { prompt: "inherits" },
      { prompt: "repeats", subjectKey: "business_studies" },
      { prompt: "overrides", subjectKey: "economics" },
    ] }],
  };
  const o = A.subjectOverrides(p);
  ok(o.length === 1, "one of the three questions is an override: " + o.length);
  ok(o[0].path === "sections[0].questions[2].subjectKey",
    "and it is named by path so an author can find it: " + o[0].path);
  ok(o[0].severity === "error", "an override is refused, not warned about");
  ok(A.subjectOverrides({ curriculum: { subjectKey: "business_studies" }, sections: [] }).length === 0,
    "a paper with no questions has no overrides");
}

console.log("7. identity is a typed field, never a shape a piece of prose happens to have");
{
  // The audit's defect B, at the level of the rule. "training" is a perfectly
  // good one-word course meaning and it matches the key pattern, so the pattern
  // must never be the thing that decides whether a value is an identity.
  ["training", "marketing", "operations", "induction", "recruitment"].forEach(word => {
    ok(A.isSubjectKey(word),
      "\"" + word + "\" does match the key pattern, which is exactly why the pattern cannot be the test");
  });

  const { validate } = require("../tools/contract/validate.js");
  const man = require("../tools/contract/libraries.js").manifest();
  const base = JSON.parse(read("docs/contract/example-hr-01.json"));
  const withVocab = (rec) => {
    const pkg = JSON.parse(JSON.stringify(base));
    pkg.provides = { vocabulary: { "business.vocab.gate3a": Object.assign(
      { id: "business.vocab.gate3a", term: "on the job training",
        plain: "learning the work by doing it beside someone who already can",
        example: "A new starter spends the first fortnight beside a supervisor." }, rec) } };
    return validate(pkg, man);
  };
  const crossWired = out => (out.findings || []).filter(x => x.code === "SUBJECT_CROSS_WIRED");

  // NEGATIVE: prose that happens to be one word is prose.
  ["training", "marketing", "operations"].forEach(word => {
    const out = withVocab({ subjectMeaning: word });
    ok(crossWired(out).length === 0,
      "the course meaning \"" + word + "\" is not read as an ownership claim: " +
      JSON.stringify(crossWired(out).map(x => x.message)));
    ok(out.wouldImport,
      "and the package carrying it imports: verdict " + out.verdict);
  });

  // POSITIVE: a typed ownership field that disagrees is still caught.
  ["economics", "ancient_history"].forEach(key => {
    const out = withVocab({ subjectMeaning: "learning the job by doing it", subjectKey: key });
    ok(crossWired(out).length === 1,
      "a record explicitly owned by " + key + " inside a business_studies package is refused: " +
      JSON.stringify((out.findings || []).map(x => x.code)));
  });
  const rightOwner = withVocab({ subjectMeaning: "learning the job by doing it", subjectKey: "business_studies" });
  ok(crossWired(rightOwner).length === 0 && rightOwner.wouldImport,
    "and a record owned by the package's own subject is fine: " + rightOwner.verdict);

  // THE LEGACY FIELD, AND WHY IT IS NOT A BACK DOOR.
  //
  // A package written before the rename carries `subject` on its vocabulary
  // records, and the value may be anything: tests/fixtures/external-ops-package
  // .json puts an ownership key there, and the contract says it is prose. The
  // validator cannot tell which the author meant, and the whole defect was that
  // it used to decide by looking at the shape of the value. So it does not
  // decide. It reads the meaning, never the ownership, and says so out loud -
  // which is what makes preserving the old field deliberate rather than silent.
  // It does not decide, and it does not let the value through either. Read as
  // ownership it would be the guess that was removed; read as a meaning it says
  // this term is defined as the name of a course. Both readings are refused, and
  // the record is called half written, because it is.
  const legacyOwner = withVocab({ subject: "economics" });
  ok(crossWired(legacyOwner).length === 0,
    "the old field is not read as ownership even when it holds another subject's key: " +
    JSON.stringify(crossWired(legacyOwner).map(x => x.message)));
  ok(!legacyOwner.wouldImport, "and the package does not import on the strength of it: " + legacyOwner.verdict);
  const ambiguousOwner = (legacyOwner.findings || []).filter(x => x.code === "VOCAB_SUBJECT_AMBIGUOUS");
  ok(ambiguousOwner.length === 1, "it is reported as ambiguous rather than accepted: " +
    JSON.stringify((legacyOwner.findings || []).map(x => x.code)));
  ok(ambiguousOwner[0].severity === "error", "as an error, because a course name is not a definition");
  ok(/subjectMeaning/.test(ambiguousOwner[0].message) && /subjectKey/.test(ambiguousOwner[0].message),
    "naming both fields, so an author can say which they meant: " + JSON.stringify(ambiguousOwner[0].message));
  // A real meaning under the old name is the case that must keep working.
  const legacyProse = withVocab({ subject: "learning the job by doing it under supervision" });
  const renamed = (legacyProse.findings || []).filter(x => x.code === "VOCAB_SUBJECT_RENAMED");
  ok(legacyProse.wouldImport && renamed.length === 1 && renamed[0].severity === "warning",
    "a legacy record holding an actual meaning still imports, with a warning: " + legacyProse.verdict);
  // And the typed field still wins where both are present.
  const both = withVocab({ subject: "economics", subjectMeaning: "learning the job by doing it",
    subjectKey: "business_studies" });
  ok(crossWired(both).length === 0 && both.wouldImport,
    "a record that says plainly who owns it is judged on that: " + both.verdict);

  // ---- the legacy field, and the three things it must never do ------------
  //
  // The old `subject` on a vocabulary record meant the course meaning. The same
  // name on a library record means the owning course. Packages exist that put an
  // ownership key in the meaning slot, so migrating the field has to be right in
  // both directions at once: never read as ownership, and never allowed to pass
  // for a meaning when it plainly is not one.
  const legacy = rec => {
    const pkg = JSON.parse(JSON.stringify(base));
    pkg.provides = { vocabulary: { "business.vocab.legacy": Object.assign(
      { id: "business.vocab.legacy", term: "on the job training",
        plain: "learning the work by doing it beside someone who already can",
        example: "A new starter spends the first fortnight beside a supervisor." }, rec) } };
    return validate(pkg, man);
  };
  const has = (out, code) => (out.findings || []).some(f => f.code === code);

  // 1. a real meaning under the old name still works, and is told to move.
  const prose = legacy({ subject: "learning the job by doing it under supervision in the workplace" });
  ok(prose.wouldImport, "a legacy record whose subject is a real meaning still imports: " + prose.verdict);
  ok(has(prose, "VOCAB_SUBJECT_RENAMED"), "and is told about the rename");
  ok(!has(prose, "VOCAB_RECORD_PARTIAL"), "and is not called half written for using the old name");
  ok((prose.findings.find(f => f.code === "VOCAB_SUBJECT_RENAMED") || {}).severity === "warning",
    "the rename is a warning, because nothing about that record is wrong");

  // 2. a value that IS a subject key cannot pass for a meaning. This is the
  //    fixture package's exact shape: seven records whose meaning slot holds
  //    "business_studies". They counted as complete AND displayable, so the
  //    vocabulary panel would have shown a course name as a definition.
  const ambiguous = legacy({ subject: "business_studies" });
  ok(has(ambiguous, "VOCAB_SUBJECT_AMBIGUOUS"),
    "a subject key in the meaning slot is ambiguous: " + JSON.stringify(ambiguous.findings.map(f => f.code)));
  ok(has(ambiguous, "VOCAB_RECORD_PARTIAL"),
    "and the record is half written, because a course name is not a definition");
  ok(!ambiguous.wouldImport, "so the package does not import: " + ambiguous.verdict);
  ok(!has(ambiguous, "SUBJECT_CROSS_WIRED"),
    "and it is still not read as an ownership claim, which is the other half of the fix");
  const other = legacy({ subject: "economics" });
  ok(has(other, "VOCAB_SUBJECT_AMBIGUOUS") && !has(other, "SUBJECT_CROSS_WIRED"),
    "another course's key in the meaning slot is ambiguous too, not a cross-wire: " +
    JSON.stringify(other.findings.map(f => f.code)));

  // 3. AMBIGUITY IS COLLISION WITH A REGISTERED KEY, NOT A SHAPE. This is the
  //    line that separates the fix from the defect it replaces: "training" has
  //    the exact form of a subject key and is a perfectly good terse meaning, so
  //    it must pass. Only a value that actually names a course this reader knows
  //    is refused.
  ["training", "marketing", "operations", "induction"].forEach(word => {
    const out = legacy({ subject: word });
    ok(A.isSubjectKey(word) && !has(out, "VOCAB_SUBJECT_AMBIGUOUS") && out.wouldImport,
      "\"" + word + "\" has the shape of a key, names no course, and imports: " +
      JSON.stringify(out.findings.map(f => f.code)));
  });

  // 4. the explicit fields always win, so the migration has somewhere to go.
  const named = legacy({ subject: "business_studies", subjectMeaning: "learning the job by doing it" });
  ok(named.wouldImport && !has(named, "VOCAB_SUBJECT_AMBIGUOUS"),
    "a record that says both is unambiguous: " + JSON.stringify(named.findings.map(f => f.code)));
  ok(has(named, "VOCAB_SUBJECT_RENAMED"), "and is still told the old field is going away");

  // And the whole fixture, which is where this was found.
  const ext = validate(JSON.parse(read("tests/fixtures/external-ops-package.json")), man);
  const amb = (ext.findings || []).filter(f => f.code === "VOCAB_SUBJECT_AMBIGUOUS");
  ok(amb.length === 7, "all seven records in the external fixture are refused: " + amb.length);
  ok(!ext.wouldImport, "and the package fails closed rather than importing seven definitions that are not definitions: " + ext.verdict);

  // The regex-driven check is gone rather than tightened.
  const v = read("tools/contract/validate.js");
  ok(v.indexOf("const SUBJECT_KEY = /^[a-z0-9]+(_[a-z0-9]+)*$/") < 0,
    "the shape-guessing check has been removed from the validator rather than made stricter");
}

console.log("8. no academic resolution reaches for a label, a picker or the global package");
{
  const app = read("app.js");

  // The exam path resolves through the substrate. If this line goes, the fault
  // comes back, so it is named rather than described.
  ok(/window\.MarginalAssessment/.test(app),
    "app.js uses the assessment substrate rather than keeping a second copy of the rules");
  ok(/ASSESS\.resolveAuthority/.test(app), "and calls resolveAuthority by name");

  const ctx = app.slice(app.indexOf("function markingContext"), app.indexOf("function markingContext") + 4600);
  ok(ctx.length > 1000, "markingContext was found: " + ctx.length + " chars");
  const atResolve = ctx.indexOf("ASSESS.resolveAuthority");
  const atLabel = ctx.indexOf("essaySubjectByLabel");
  ok(atResolve > 0, "it resolves a sat paper through the substrate");
  ok(atLabel < 0 || atResolve < atLabel,
    "and does so BEFORE any label lookup can run, so a paper never reaches one: " +
    JSON.stringify({ resolveAuthority: atResolve, essaySubjectByLabel: atLabel }));
  // The label route survives for flashcard content, which is what it was written
  // for. What it may not do is stand between a paper and its criteria.
  const paperBranch = ctx.slice(atResolve - 900, atResolve + 900);
  ok(/if \(paper\)/.test(paperBranch),
    "the substrate is reached from the branch a sat paper takes");
  ok(!/C\.markingCriteria/.test(paperBranch),
    "and the global flashcard package is not reachable from inside it");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
