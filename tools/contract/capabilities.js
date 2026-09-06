// THE CAPABILITY RULES. One authoritative definition, and the only one.
//
// The validator, the coverage report and any review interface all evaluate
// THESE rules. Three implementations of "what counts as guided" would disagree
// the first time one of them was edited, and the disagreement would show up as
// two tools reporting different states for the same question.
//
// Each capability is a CONJUNCTION of named rules. That is the property that
// matters: there is no score anywhere, so a strong dimension cannot average
// away a weak one. Twelve authored arguments and no sourced evidence is
// pathway-guided and not evidence-complete, and it can never be four fifths of
// anything.
//
// Each rule carries the sentence it would say when it fails, so a report can
// explain a result rather than print a state:
//
//   { status: "not-reached",
//     satisfied: ["pathways-exist", "every-pathway-reviewed"],
//     missing: [{ rule: "concepts-explained", says: "…" }] }
const nonBlank = v => v != null && (Array.isArray(v) ? v.length > 0 : String(v).trim() !== "");

// A pathway is complete when a student choosing it is given what choosing needs:
// what it argues, what it commits them to, what it has to establish, what goes
// wrong, and guidance while they write it.
const PATHWAY_FIELDS = ["short", "relationship", "choiceMeaning", "whatToProve", "commonMistake"];
const pathwayComplete = pw => PATHWAY_FIELDS.every(k => nonBlank(pw[k])) && Object.keys(pw.guidance || {}).length > 0;
const pathwayGaps = pw => PATHWAY_FIELDS.filter(k => !nonBlank(pw[k]))
  .concat(Object.keys(pw.guidance || {}).length ? [] : ["guidance"]);

const RULES = {
  importable: [
    { id: "has-id", says: "question.id is missing", test: c => nonBlank(c.q.id) },
    { id: "has-subject", says: "question.subject is missing", test: c => nonBlank(c.q.subject) },
    { id: "has-text", says: "question.text is missing", test: c => nonBlank(c.q.text) },
    { id: "has-directive", says: "question.directive is missing", test: c => nonBlank(c.q.directive) },
    { id: "directive-known", says: "the directive is not in the registry, so nothing knows what kind of answer this asks for",
      test: c => !!c.directive },
    { id: "resolves", says: "something in the package is malformed or does not resolve",
      test: c => !c.errors },
  ],
  "writing-ready": [
    { id: "importable", says: "the package is not importable yet", test: c => c.reached.importable },
    { id: "has-marks", says: "question.marks is missing, so the expected length and band table are unknown",
      test: c => typeof c.q.marks === "number" && c.q.marks > 0 },
    { id: "states-what-it-argues",
      says: "neither an overall argument nor a single relationship claim, so there is nothing to hold a paragraph against",
      test: c => nonBlank(c.q.overallArgument) || ((c.pkg.relationship || {}).claims || []).length > 0 },
  ],
  "pathway-guided": [
    { id: "writing-ready", says: "the question is not writing ready yet", test: c => c.reached["writing-ready"] },
    { id: "directive-supported",
      says: "guided writing is not supported for this directive, so every slot label and guidance line chosen by family is withheld",
      test: c => !!(c.directive && c.directive.supportedInGuidedWriting) },
    { id: "arguments-to-choose-between", says: "fewer than two authored arguments, which is not a choice",
      test: c => c.paths.length >= 2 },
    { id: "every-argument-complete", says: "an argument is missing what a student needs to choose it and write it",
      test: c => c.paths.every(pathwayComplete),
      detail: c => c.paths.filter(p => !pathwayComplete(p)).map(p => p.id + ": " + pathwayGaps(p).join(", ")) },
    { id: "judgement-offers-a-limitation",
      says: "a judgement question whose arguments all support it is offering a case, not a judgement",
      test: c => !c.judgement || c.paths.some(p => (p.contribution || {}).role === "limitation") },
  ],
  "learning-complete": [
    { id: "arguments-exist", says: "there is nothing to teach, because there are no arguments",
      test: c => c.paths.length > 0 },
    { id: "every-argument-reviewed",
      says: "an argument has not been through learning review, which is not the same as needing no lesson",
      test: c => c.paths.every(p => (p.learning || {}).status !== "unreviewed"),
      detail: c => c.paths.filter(p => (p.learning || {}).status === "unreviewed").map(p => p.id) },
    { id: "concepts-explained", says: "an argument names a concept whose record is not complete",
      test: c => c.paths.every(p => !p.conceptRef || (c.rec("concepts", p.conceptRef) || {}).complete),
      detail: c => c.paths.filter(p => p.conceptRef && !(c.rec("concepts", p.conceptRef) || {}).complete)
        .map(p => p.id + " -> " + p.conceptRef) },
    { id: "lessons-resolve", says: "an argument says its lesson is authored and the lesson does not resolve",
      test: c => c.paths.every(p => (p.learning || {}).status !== "authored"
        || (c.rec("lessons", p.learningRef) || {}).complete),
      detail: c => c.paths.filter(p => (p.learning || {}).status === "authored"
        && !(c.rec("lessons", p.learningRef) || {}).complete).map(p => p.id) },
  ],
  "assessment-complete": [
    { id: "decoded", says: "no decode block, so the student cannot be shown what the stem is asking",
      test: c => !!c.pkg.decode },
    { id: "requirements-stated", says: "no requirements, so nothing says what a full answer must contain",
      test: c => !!c.pkg.requirements },
    { id: "thesis-described", says: "no acceptableThesis, so a student's own wording can only be matched, not accepted",
      test: c => nonBlank((c.pkg.coreAnswer || {}).acceptableThesis) },
    { id: "checklist-present", says: "no checklist, so the completion card has nothing to check against",
      test: c => (((c.pkg.coreAnswer || {}).checklist) || []).length > 0 },
    { id: "marking-language-sourced", says: "no bandSource, so any band descriptor shown would be unattributed",
      test: c => nonBlank((c.pkg.marking || {}).bandSource) },
  ],
  "evidence-complete": [
    { id: "arguments-exist", says: "there is nothing to evidence, because there are no arguments",
      test: c => c.paths.length > 0 },
    { id: "every-argument-has-evidence", says: "an argument references no evidence at all",
      test: c => c.paths.every(p => (p.evidenceRefs || []).length > 0),
      detail: c => c.paths.filter(p => !(p.evidenceRefs || []).length).map(p => p.id) },
    { id: "every-reference-has-a-role",
      says: "an evidence reference does not say what the item is doing in this response, and a role is never inferred",
      test: c => c.paths.every(p => (p.evidenceRefs || []).every(e => nonBlank(e.role))),
      detail: c => { const n = c.paths.reduce((a, p) => a + (p.evidenceRefs || []).filter(e => !nonBlank(e.role)).length, 0);
        return n ? [n + " references carry no role"] : []; } },
    { id: "every-record-sourced", says: "an evidence record carries no source, so the fact is unattributed",
      test: c => c.paths.every(p => (p.evidenceRefs || []).every(e => (c.rec("evidence", e.ref) || {}).published)),
      detail: c => { const n = c.paths.reduce((a, p) => a + (p.evidenceRefs || [])
        .filter(e => !(c.rec("evidence", e.ref) || {}).published).length, 0);
        return n ? [n + " references name a record with no source"] : []; } },
  ],
};
const ORDER = Object.keys(RULES);

function evaluate(pkg, man, directiveRow, hasErrors) {
  const lib = (man && man.records) || {};
  const provides = (pkg && pkg.provides) || {};
  // A record the package PROVIDES resolves, exactly as it does in validate.js.
  // Without this the two halves of the contract disagreed: validate accepted a
  // provided lesson as resolving, and the capability rules looked only in the
  // shared library and reported the argument as having no lesson. An external
  // package that wrote its own lessons was told it had not written them, and the
  // only way to reach learning-complete was to point at a lesson authored for a
  // different question. The rules were pushing authors towards borrowing, which
  // is the one thing the runtime exists to refuse.
  //
  // A provided record is treated as complete because a half written one is
  // already a RECORD_PARTIAL error, which fails `resolves` and therefore
  // importable, so it can never reach a rule below this line.
  const rec = (kind, id) => {
    if (id == null) return null;
    const shared = (lib[kind] || {})[id];
    if (shared) return shared;
    const own = (provides[kind] || {})[id];
    return own ? { complete: true, provided: true, missing: [] } : null;
  };
  const c = {
    pkg: pkg, q: pkg.question || {}, paths: pkg.pathways || [],
    judgement: (pkg.coreAnswer || {}).mode === "judgement",
    directive: directiveRow, errors: !!hasErrors,
    rec: rec,
    reached: {},
  };
  const out = {};
  ORDER.forEach(cap => {
    const satisfied = [], missing = [];
    RULES[cap].forEach(r => {
      let held = false;
      try { held = !!r.test(c); } catch (e) { held = false; }
      if (held) satisfied.push(r.id);
      else missing.push({ rule: r.id, says: r.says, detail: r.detail ? r.detail(c) : [] });
    });
    c.reached[cap] = !missing.length;
    out[cap] = { status: missing.length ? "not-reached" : "reached", satisfied: satisfied, missing: missing };
  });
  return out;
}
// A one-line headline derived from the states, never from a count of them.
function headline(caps) {
  const reached = k => caps[k] && caps[k].status === "reached";
  const missing = ORDER.filter(k => !reached(k));
  const head = !reached("importable") ? "Not importable"
    : reached("pathway-guided") ? (missing.length ? "Guided" : "Fully authored")
    : reached("writing-ready") ? "Writing ready" : "Importable";
  return head + (missing.length ? " - missing " + missing.join(", ") : "");
}
module.exports = { RULES, ORDER, evaluate, headline, pathwayComplete, pathwayGaps };
