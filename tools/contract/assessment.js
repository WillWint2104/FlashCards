// THE ASSESSMENT SUBSTRATE.
//
// Two rules lived inside app.js, could not be run without a browser, and were
// both wrong in ways a browser test never caught. They are here so they can be
// stated once, tested in milliseconds, and used by the same code the student
// runs: build.js inlines this file into the page, and tests/t28.mjs requires it
// directly. Nothing in here touches fs, the DOM, or a library manifest.
//
// RULE ONE: WHAT COUNTS AS A RESULT.
//
// gradeWritten could return three different things and they were all read as
// one. A mark, and a refusal to mark, and a system failure, all arrived as an
// object, and every caller reached for .score. A refusal has no score, so
// Test mode summed undefined into NaN and the study path handed undefined to
// applyResult, which recorded a zero and demoted the card. The application had
// decided not to judge the response and then judged it as worthless.
//
// So an outcome is discriminated, and only one of the three is arithmetic:
//
//   success   a mark was made. score and max are finite numbers
//   refused   the application declined to mark, and can say why
//   failed    something broke that may work next time
//
// isMarked() is the only gate. It checks the discriminant AND the numbers,
// because a success carrying a non-numeric score is not a success, whoever
// built it.
//
// RULE TWO: WHICH SUBJECT'S AUTHORITY MARKS A RESPONSE.
//
// A paper's subject was a free-text display label, matched by lowercasing and
// comparing against package labels, with a fallback to whichever flashcard
// package the picker happened to be on. Measured: a paper declaring
// subjectKey "business_studies" was marked with Economics criteria, because
// nothing read paper.subjectKey; and so was a paper declaring nothing at all.
//
// So identity is a key, the key is on the paper, and there is no fallback. A
// KLA (hsie) says where a course sits in the curriculum and is never consulted
// about how to mark: resolveAuthority() does not read klaKey, and t28 holds
// that it cannot start to.

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------
var SUCCESS = "success", REFUSED = "refused", FAILED = "failed";

function marked(result) {
  return assign({ outcome: SUCCESS }, result || {});
}
// A refusal is a decision, and a decision the student is owed an explanation
// for. `why` is that explanation in plain words; `code` is for the harness.
function refuse(code, why, extra) {
  return assign({ outcome: REFUSED, code: code, why: why }, extra || {});
}
function fail(code, why, extra) {
  return assign({ outcome: FAILED, code: code, why: why }, extra || {});
}

// The one gate. Everything that adds up, schedules, counts an attempt or moves
// a box asks this first.
function isMarked(g) {
  return !!g && g.outcome === SUCCESS && finite(g.score) && finite(g.max);
}

// The defensive boundary, for results built before this module existed or by
// code that forgot. It reads a shape rather than trusting a label, so an old
// {error: "..."} object can never be mistaken for a mark.
function outcomeOf(g) {
  if (!g || typeof g !== "object") return FAILED;
  if (g.outcome === SUCCESS) return finite(g.score) && finite(g.max) ? SUCCESS : FAILED;
  if (g.outcome === REFUSED || g.outcome === FAILED) return g.outcome;
  if (g.error) return REFUSED;
  return finite(g.score) && finite(g.max) ? SUCCESS : FAILED;
}

// Totals that cannot become NaN, whatever is in the bag. `maxOf` reads the
// paper's mark value for a question, because an unmarked question still costs
// its marks: a student who was refused a mark on a 20-mark question has not
// been set a 0-mark paper.
function tally(entries) {
  var got = 0, max = 0, done = 0, refused = 0, failed = 0;
  (entries || []).forEach(function (e) {
    var g = e && e.result, m = num(e && e.marks);
    max += m;
    var o = outcomeOf(g);
    if (o === SUCCESS) { got += clamp(g.score, 0, finite(g.max) ? g.max : m); done++; }
    else if (o === REFUSED) refused++;
    else if (g) failed++;
  });
  return { got: got, max: max, done: done, refused: refused, failed: failed };
}

// ---------------------------------------------------------------------------
// Curriculum identity
// ---------------------------------------------------------------------------
// The same shape question.subject has carried since the contract was written.
// It is a KEY. Nothing in this module ever tests a piece of prose against it.
var SUBJECT_KEY = /^[a-z0-9]+(_[a-z0-9]+)*$/;
function isSubjectKey(v) { return typeof v === "string" && SUBJECT_KEY.test(v); }

var SEV = { error: "error", warning: "warning" };

// What an exam declares about where it sits. `subject` is NOT read here: on a
// paper that field is a display label and has never been anything else.
function curriculumOf(paper) {
  var c = paper && paper.curriculum;
  return (c && typeof c === "object") ? c : null;
}

// The findings an importer reports. Only the authority is load-bearing, so only
// the authority is an error: a paper that knows which subject marks it is
// importable without knowing its stage or its syllabus version.
function curriculumFindings(paper) {
  var out = [], c = curriculumOf(paper);
  var add = function (sev, code, path, message) {
    out.push({ severity: sev, code: code, path: path, message: message });
  };
  if (!c) {
    add(SEV.error, "CURRICULUM_MISSING", "curriculum",
      "an exam declares the curriculum it belongs to. Without it nothing can say which subject's criteria mark its written responses, and marking one subject's paper against another's criteria is the fault this block exists to prevent");
    return out;
  }
  if (blank(c.subjectKey))
    add(SEV.error, "SUBJECT_KEY_MISSING", "curriculum.subjectKey",
      "required. This is the academic authority: it names the package whose marking criteria, paragraph models and libraries apply");
  else if (!isSubjectKey(c.subjectKey))
    add(SEV.error, "SUBJECT_KEY_MALFORMED", "curriculum.subjectKey",
      JSON.stringify(c.subjectKey) + " is not a subject key. A key is lower case words joined by underscores, such as \"business_studies\". A display label such as \"Business Studies\" is not a key and is never resolved as one");
  if (!blank(c.klaKey) && !isSubjectKey(c.klaKey))
    add(SEV.error, "KLA_KEY_MALFORMED", "curriculum.klaKey",
      JSON.stringify(c.klaKey) + " is not a key. A KLA classifies the course; it never decides how an answer is marked");
  if (blank(c.jurisdiction))
    add(SEV.warning, "JURISDICTION_ABSENT", "curriculum.jurisdiction",
      "not declared. Nothing depends on it yet, and a paper whose authority is unnamed is harder to review");
  if (blank(c.klaKey))
    add(SEV.warning, "KLA_ABSENT", "curriculum.klaKey",
      "not declared. The paper still marks correctly; it is only harder to file");
  return out;
}

// Every question in the paper that tries to change subject. Ordinarily a paper
// owns its subject outright and a question inherits it. A question that names
// the SAME key is redundant and allowed; one that names a different key is a
// cross-subject override, and those are refused rather than honoured, because
// honouring one silently is how an Economics question ends up inside a Business
// Studies paper carrying Business Studies criteria.
function subjectOverrides(paper) {
  var c = curriculumOf(paper), owner = c && c.subjectKey, out = [];
  (paper && paper.sections || []).forEach(function (sec, si) {
    (sec && sec.questions || []).forEach(function (q, qi) {
      var declared = q && (q.subjectKey || (q.curriculum && q.curriculum.subjectKey));
      if (blank(declared)) return;
      if (owner && declared === owner) return;
      out.push({
        severity: SEV.error, code: "QUESTION_SUBJECT_OVERRIDE",
        path: "sections[" + si + "].questions[" + qi + "].subjectKey",
        message: JSON.stringify(declared) + " is not the subject this exam declares (" +
          (owner ? owner : "none") + "). A question inherits its paper's subject or repeats it; changing it needs a rule this contract does not have yet",
      });
    });
  });
  return out;
}

// THE RESOLUTION. Key first, and key only.
//
//   opts.curriculum  the paper's curriculum block
//   opts.question    the question being marked, for its optional subjectKey
//   opts.packages    subjectKey -> { label, markingCriteria }
//
// Returns { ok: true, subjectKey, label, criteria, source } or a refusal
// carrying the reason a student can be shown. There is no branch that reaches
// for a display label, a picker selection or a global content object, which is
// the whole point of the function.
function resolveAuthority(opts) {
  opts = opts || {};
  var c = opts.curriculum || null;
  var q = opts.question || null;
  var packages = opts.packages || {};

  if (!c || blank(c.subjectKey))
    return refuse("CURRICULUM_UNOWNED",
      "this paper does not say which subject marks it, so there is no way to know which criteria to use");
  if (!isSubjectKey(c.subjectKey))
    return refuse("SUBJECT_KEY_MALFORMED",
      "this paper names its subject as " + JSON.stringify(c.subjectKey) + ", which is a label rather than a subject key");

  var owner = c.subjectKey;
  var declared = q && (q.subjectKey || (q.curriculum && q.curriculum.subjectKey));
  if (!blank(declared) && declared !== owner)
    return refuse("SUBJECT_OVERRIDE_REFUSED",
      "this question names " + JSON.stringify(declared) + " inside a " + owner +
      " paper. A question does not change the subject that marks it",
      { subjectKey: owner, declared: declared });

  var pkg = packages[owner];
  if (!pkg)
    return refuse("SUBJECT_UNREGISTERED",
      "no subject package named " + JSON.stringify(owner) + " is available, so there are no criteria of its own to mark against",
      { subjectKey: owner });

  var criteria = some(q && q.markingCriteria) || some(pkg.markingCriteria);
  if (!criteria)
    return refuse("CRITERIA_ABSENT",
      "the " + (pkg.label || owner) + " package carries no marking criteria",
      { subjectKey: owner });

  return {
    ok: true, subjectKey: owner,
    // The package's own label, never the paper's cover text. The two disagreeing
    // is how a request went out naming one subject and carrying another's
    // criteria.
    label: pkg.label || owner,
    criteria: criteria,
    source: (q && some(q.markingCriteria)) ? "question" : "subject",
  };
}

// ---------------------------------------------------------------------------
function assign(a, b) { Object.keys(b).forEach(function (k) { a[k] = b[k]; }); return a; }
function finite(n) { return typeof n === "number" && isFinite(n); }
function num(n) { return finite(n) ? n : 0; }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(finite(hi) ? hi : n, num(n))); }
function blank(s) { return s == null || String(s).trim() === ""; }
function some(c) { return (Array.isArray(c) && c.length) ? c : null; }

module.exports = {
  SUCCESS: SUCCESS, REFUSED: REFUSED, FAILED: FAILED,
  marked: marked, refuse: refuse, fail: fail,
  isMarked: isMarked, outcomeOf: outcomeOf, tally: tally,
  isSubjectKey: isSubjectKey, curriculumOf: curriculumOf,
  curriculumFindings: curriculumFindings, subjectOverrides: subjectOverrides,
  resolveAuthority: resolveAuthority,
};
