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
// Response format
// ---------------------------------------------------------------------------
// RULE THREE: WHAT KIND OF RESPONSE IS THIS.
//
// responseTypeOf() answered that question with one line - essay is "extended",
// everything else is "short" - and "everything else" is the fault. A calculation
// went to written grading as a short answer. A Business Report went as an
// ordinary extended response, because the only thing marking it out was the word
// "Report" in a field meant for directives, which the directive registry does not
// know. And a type nobody had heard of became a short answer in silence, which is
// the worst of the three: an unknown is not a short answer, it is an unknown.
//
// So a format is declared or derived, never assumed, and the derivation table is
// complete rather than defaulted. There is no "everything else" arm anywhere
// below. A value this reader does not recognise is refused and says so.
//
// FORMAT AND DIRECTIVE ARE DIFFERENT QUESTIONS.
//
//   format     what kind of response is the student producing
//   directive  what intellectual operation are they being asked to perform
//
// A Business Report can ask a student to recommend, and recommend is a directive
// that already exists. So {format: "business_report", directive: "recommend"} is
// the shape, and "report" never becomes a directive family to make the legacy
// data fit - it was a format all along, wearing the wrong field's name.
var FORMATS = ["multiple_choice", "calculation", "short_answer", "extended_response", "business_report"];

// Which formats the written marker handles, and as what. Multiple choice and
// calculation are objective: they are graded against an answer key and never
// reach it at all, which is why they map to null rather than to "short".
var WRITTEN_MODE = {
  short_answer: "short",
  extended_response: "extended",
  business_report: "extended",
};

// Every legacy card and question type this application has ever served, and the
// canonical format each one is. Complete on purpose: a type absent from this
// table is refused, never defaulted.
//
// These five are the types a STUDY CARD or an imported exam question can carry.
// `check` and `scenario` are lesson tasks, rendered by the lesson player and
// never handed to a grader; `lorenz` and `incomeSource` are chart kinds inside a
// question's stimulus. None of those four is a response format and none belongs
// here, however much a flat search for `.type` makes them look alike.
var LEGACY_TYPE = {
  mc: "multiple_choice",
  calc: "calculation",
  define: "short_answer",
  short: "short_answer",
  essay: "extended_response",
};

function isFormat(v) { return typeof v === "string" && FORMATS.indexOf(v) >= 0; }
function writtenModeOf(format) { return WRITTEN_MODE[format] || null; }
function isObjective(format) { return isFormat(format) && !WRITTEN_MODE[format]; }

// THE ONE PLACE A RESPONSE'S FORMAT IS DECIDED.
//
// Returns { ok: true, format, directive, source } or a refusal carrying the
// reason. `directive` is whatever intellectual operation the question asks for,
// independent of the format, or null where none is authored - never invented to
// fill the field.
// What the legacy fields describe, or null if this version cannot say. The one
// legacy compound lives here: a Business Report was authored as an extended
// response whose command said "Report", and that is the only thing that ever
// distinguished it. Recognised so the format becomes first class without the
// source data being rewritten.
// "an extended response", "a business report". Small, but these words are read
// by a student who is being told why their work was not marked.
function formatWords(format) {
  var words = String(format).replace(/_/g, " ");
  return (/^[aeiou]/.test(words) ? "an " : "a ") + words;
}

function legacyFormat(type, saysReport) {
  var mapped = LEGACY_TYPE[type];
  if (!mapped) return null;
  if (mapped === "extended_response" && saysReport) return "business_report";
  return mapped;
}

function normaliseFormat(q) {
  q = q || {};
  var raw = blank(q.directive) ? q.command : q.directive;
  var directive = blank(raw) ? null : String(raw).trim().toLowerCase();
  // "report" in the directive field is a format wearing the wrong name. It is
  // read as a format signal below and never carried on as a directive, because
  // it is not one: a report is a kind of response, not a kind of thinking.
  var saysReport = directive === "report";
  var carried = saysReport ? null : directive;
  // The same directive in the words its author wrote, for the marker, which
  // reads "Explain" and not "explain". It is derived HERE rather than beside
  // the payload because there were two expressions picking a field out of the
  // same pair and they did not agree: this one prefers `directive`, the other
  // preferred `command`, so a card carrying both resolved its format from one
  // and told the marker the other. One source, and the two cannot drift.
  var carriedText = carried === null ? null : String(raw).trim();
  var type = blank(q.type) ? null : String(q.type).trim().toLowerCase();

  if (!blank(q.format)) {
    if (!isFormat(q.format))
      return refuse("FORMAT_UNSUPPORTED",
        "this question declares the response format " + JSON.stringify(String(q.format)) +
        ", which this version does not support. It is not marked as something else instead",
        { declared: String(q.format) });

    // An explicit canonical format is authoritative for new data; the legacy
    // fields exist only so old data can be migrated. A package that supplies
    // both is making two claims, and they have to be the same claim. When they
    // are not, one of them is wrong and nothing here can tell which, so neither
    // is picked. Choosing the declared one would be a guess made in silence,
    // and silence is what this whole slice exists to end.
    if (type) {
      var implied = legacyFormat(type, saysReport);
      if (!implied)
        return refuse("FORMAT_CONFLICT",
          "this question declares the response format " + JSON.stringify(String(q.format)) +
          " and also carries the legacy type " + JSON.stringify(type) +
          ", which this version cannot read, so the two cannot be checked against each other",
          { declared: String(q.format), implied: null, legacyType: type });
      if (implied !== q.format)
        return refuse("FORMAT_CONFLICT",
          "this question declares the response format " + JSON.stringify(String(q.format)) +
          " while its legacy fields describe " + formatWords(implied) +
          ". One of the two is wrong and there is no way to tell which, so it is marked as neither",
          { declared: String(q.format), implied: implied, legacyType: type });
    }
    return { ok: true, format: q.format, directive: carried, directiveText: carriedText, source: "declared" };
  }

  if (!type)
    return refuse("FORMAT_ABSENT",
      "this question says nothing about what kind of response it wants, so there is no way to know how to mark it");
  var mapped = legacyFormat(type, saysReport);
  if (!mapped)
    return refuse("FORMAT_UNSUPPORTED",
      "this question is of type " + JSON.stringify(type) +
      ", which is not a response format this version supports. It is not treated as a short answer instead",
      { declared: type });

  // business_report can only have come from the compound above, and "Report"
  // was spent identifying the format rather than describing the thinking.
  if (mapped === "business_report")
    return { ok: true, format: "business_report", directive: null, directiveText: null, source: "legacy-report" };

  return { ok: true, format: mapped, directive: carried, directiveText: carriedText, source: "legacy" };
}

// ---------------------------------------------------------------------------
// Marking points
// ---------------------------------------------------------------------------
// THE ONE PLACE MARKING POINTS ARE READ, AND THE ONE PLACE THEIR RELATIONSHIP
// TO MARKS IS DECIDED.
//
// Two faults made this necessary, and the second is the important one.
//
// The grader read every entry as an object - `pt.text`, `pt.need` - while the
// contract's own fixture authors plain strings. `pt.text` was undefined, the
// normaliser turned undefined into "", every answer contains "", so every point
// registered as addressed and an EMPTY ANSWER SCORED FULL MARKS. That is a
// shape mismatch and it is fixed by reading both shapes here, once.
//
// The second fault is that nothing anywhere said a point was worth a mark. The
// papers prove it is not generally true: the extended responses author four
// points against twelve and twenty marks. `points[]` is a list of the things a
// marker looks for - key marking points - and it is guidance, not an
// allocation.
//
// So a mark is derived from points ONLY where the paper authors per-point marks
// that sum to the question's own marks. `weighted` is that declaration and
// nothing implies it: a question whose point COUNT happens to equal its mark
// count has still not said that one point is one mark, and inferring it from
// the coincidence is the same substitution Gate 3B removed from formats.
//
// Malformed points are refused rather than skipped. A point this reader cannot
// read is not a point that was addressed, and the alternative is awarding marks
// against something nobody can see.
function markingPoints(q) {
  var raw = q && q.points;
  if (!Array.isArray(raw) || !raw.length)
    return { ok: true, points: [], count: 0, weighted: false, total: 0 };

  var out = [], sum = 0, allWeighted = true;
  for (var i = 0; i < raw.length; i++) {
    var pt = raw[i], where = "marking point " + (i + 1);
    var text, need = null, hint = "", marks = null;

    if (typeof pt === "string") {
      text = pt;
    } else if (pt && typeof pt === "object" && !Array.isArray(pt)) {
      text = pt.text;
      need = some(pt.need);
      hint = blank(pt.hint) ? "" : String(pt.hint);
      if (pt.marks != null) {
        if (!finite(pt.marks) || pt.marks < 0)
          return refuse("POINTS_MALFORMED",
            where + " carries a mark value that is not a number of marks");
        marks = pt.marks;
      }
    } else {
      return refuse("POINTS_MALFORMED",
        where + " is neither text nor a marking point object");
    }

    if (blank(text))
      return refuse("POINTS_MALFORMED", where + " has no text, so nothing can be marked against it");

    if (marks == null) allWeighted = false; else sum += marks;
    out.push({ text: String(text).trim(), need: need, hint: hint, marks: marks });
  }

  // The declaration is per-point marks that add up to the question. Marks that
  // do not add up are not a weighting: they are an authoring error that would
  // otherwise cap or inflate the question silently.
  var qMarks = finite(q && q.marks) ? q.marks : null;
  var weighted = allWeighted && qMarks != null && sum === qMarks;
  return { ok: true, points: out, count: out.length, weighted: weighted, total: allWeighted ? sum : 0 };
}

// WHICH POINTS AN ANSWER REACHED, AND WHETHER THAT IS A MARK.
//
// The matching rule lives here rather than in the app for the same reason the
// reading rule does: it is the thing that was wrong, and a rule that decides
// marks should be testable without a browser. `score` is a number ONLY for a
// question whose paper authored a weighting; otherwise it is null and the
// caller must get the mark from somewhere that can justify it.
function scorePoints(q, answer) {
  var mp = markingPoints(q);
  if (mp.ok !== true) return mp;
  var a = normText(answer);
  var pts = mp.points.map(function (pt) {
    // WHAT A POINT MAY BE MATCHED AGAINST (UX-TEST-18): the phrasings its author
    // wrote for matching, and nothing else. A point's text describes what earns
    // the mark - "Names speed, or dependability, as the objective" - and is not a
    // sentence the student has to type. Searching the answer for it scored full,
    // correct answers zero. A point with no phrasings is a marking requirement,
    // it carries no verdict here (hit: null), and the marker judges it.
    var matchable = !!(pt.need && pt.need.some(function (al) { return normText(al) !== ""; }));
    if (!matchable) return { text: pt.text, hit: null, hint: pt.hint, marks: pt.marks, matchable: false };
    // A phrasing that normalises to nothing matches nothing. Without this the
    // empty string is a substring of every answer, which is precisely how an
    // unanswered question came to score full marks.
    var hit = pt.need.some(function (al) { var n = normText(al); return n !== "" && a.indexOf(n) !== -1; });
    return { text: pt.text, hit: hit, hint: pt.hint, marks: pt.marks, matchable: true };
  });
  var hits = pts.filter(function (p) { return p.hit === true; }).length;
  // Scored here only when the paper authored BOTH the weighting and a way to
  // match every point. Anything less goes to the marker with its weights.
  var local = mp.weighted && pts.length > 0 && pts.every(function (p) { return p.matchable; });
  var score = null;
  if (mp.weighted) {
    var raw = pts.reduce(function (n, p) { return p.hit ? n + p.marks : n; }, 0);
    if (local) score = Math.min(raw, q.marks);
  }
  return { ok: true, points: pts, hits: hits, count: pts.length,
           weighted: mp.weighted, local: local, score: score, max: finite(q && q.marks) ? q.marks : 0 };
}

// WHAT A WRITTEN QUESTION TELLS ITS MARKER ABOUT WHAT IT IS ASSESSING.
//
// The rule: authored assessment requirements that bear on the marking reach the
// written marker, whatever the written format. For every written format that is
// the question's marking points. A business report additionally sends its own
// instructions first, because they are the sentence that names the genre.
// Nothing is written for a question: one that authors neither sends what it
// sent before.
//
// This started as business-report-only (state 13), scoped so that state 12's
// request stayed byte-identical. That kept an extended response's authored
// points reaching nothing at all (UX-TEST-12), which is a correctness fault, not
// a design to protect, so the scope is now every written format.
//
// The door is `requirements.accomplish`, which both marking passes print as "what
// a strong response accomplishes". Points travel as their text only: whether they
// carry marks is the app's business (scorePoints), and a marker told "2 marks"
// against a point would read it as an allocation the paper may not have made.
//
// The worker keeps at most ten items of at most 300 characters and drops the rest
// without a word (proxy/worker.js, markingInput). Marking against the first half of
// a question's own guidance is the silent normalisation this contract refuses, so
// guidance that does not fit is refused here, whole.
var GUIDANCE_MAX_ITEMS = 10;
var GUIDANCE_MAX_CHARS = 300;

// WHAT A QUESTION ALREADY SENT AS requirements.accomplish, decided in one place.
// markingRequirements in app.js and the paper validator both call this, so they
// cannot derive different lists.
function accomplishOf(q) {
  return (q && q.requirements && q.requirements.accomplish) || (q && q.scaffold) || [];
}

function markerGuidance(q, accomplish) {
  var fx = normaliseFormat(q);
  if (!fx.ok || !writtenModeOf(fx.format))
    return { ok: true, applies: false, items: [], own: 0 };
  var report = fx.format === "business_report";

  // A report's instructions are text or absent. An object or a list used to be
  // stringified into "[object Object]" and shown to the student and the marker.
  if (report && q.instructions != null && typeof q.instructions !== "string")
    return refuse("INSTRUCTIONS_MALFORMED",
      "this business report's instructions are not text, so they could not be shown or sent as they were written");
  var own = [];
  if (report && !blank(q.instructions)) own.push(q.instructions.trim());
  var mp = markingPoints(q);
  if (mp.ok !== true) return mp;
  // A weighted point travels with its weight, so a marker judging it knows the
  // author's allocation rather than guessing one (UX-TEST-18).
  mp.points.forEach(function (p) {
    own.push(mp.weighted ? p.text + " (" + p.marks + " mark" + (p.marks === 1 ? "" : "s") + ")" : p.text);
  });

  var rest = Array.isArray(accomplish)
    ? accomplish.filter(function (x) { return !blank(x); }).map(function (x) { return String(x).trim(); })
    : [];
  // Exact duplicates only. Two authored sentences that say nearly the same thing
  // are the author's to merge, and guessing which one they meant is not ours.
  var items = [];
  own.concat(rest).forEach(function (x) { if (items.indexOf(x) < 0) items.push(x); });

  if (items.length > GUIDANCE_MAX_ITEMS)
    return refuse("MARKING_GUIDANCE_OVER_BUDGET",
      "this question carries " + items.length + " pieces of marking guidance and the marker can read " +
      GUIDANCE_MAX_ITEMS + ", so it would be marked against some of them without anyone being told which were left out",
      { items: items.length, limit: GUIDANCE_MAX_ITEMS });
  for (var i = 0; i < items.length; i++) {
    if (items[i].length > GUIDANCE_MAX_CHARS)
      return refuse("MARKING_GUIDANCE_OVER_BUDGET",
        "piece " + (i + 1) + " of this question's marking guidance is " + items[i].length +
        " characters and the marker can read " + GUIDANCE_MAX_CHARS + ", so the end of it would be cut off without anyone seeing",
        { item: i + 1, chars: items[i].length, limit: GUIDANCE_MAX_CHARS });
  }
  return { ok: true, applies: true, items: items, own: own.length, report: report };
}

// The app's own normaliser, here so the matching rule does not depend on the
// caller passing an equivalent one.
function normText(s) {
  return String(s == null ? "" : s).toLowerCase()
    .replace(/[^a-z0-9.\-% ]/g, " ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
function assign(a, b) { Object.keys(b).forEach(function (k) { a[k] = b[k]; }); return a; }
function finite(n) { return typeof n === "number" && isFinite(n); }
function num(n) { return finite(n) ? n : 0; }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(finite(hi) ? hi : n, num(n))); }
function blank(s) { return s == null || String(s).trim() === ""; }
// WHAT NUMBER A CALCULATION ANSWER STATES, OR THAT IT STATES NONE (UX-TEST-19).
//
// The grader stripped every character but digits, "." and "-" and parsed what
// was left, so "60 000 / 40 000 = 1.5" became 60000400001.5 and "3:2" became
// 32. "1.5 : 1" scored only because it collapsed to 1.51, inside a 0.05
// tolerance. The rule now, in order:
//
//   working ends in "=": the value is what follows the LAST "=";
//   a ratio "a : b" and nothing else numeric: the value is a / b;
//   exactly one number: that number ("$42 000", "23.4%", "125 units");
//   anything else - no number, or several with no rule to choose - is refused.
//
// A refusal leaves the answer unmarked. Guessing which of two numbers a student
// meant would manufacture the mark this function exists to stop manufacturing.
var CALC_NUM = /-?(?:\d{1,3}(?:[ ,]\d{3})+|\d+)(?:\.\d+)?|-?\.\d+/g;
function readCalcAnswer(answer) {
  var s = String(answer == null ? "" : answer).replace(/\u2212/g, "-").trim();
  if (s.indexOf("=") !== -1) s = s.slice(s.lastIndexOf("=") + 1).trim();
  if (!s) return refuse("CALC_UNREADABLE", "there is no value to mark. Write the final value, for example 1.5");
  var toNum = function (t) { return Number(t.replace(/[ ,]/g, "")); };
  var nums = s.match(CALC_NUM) || [];
  var ratio = s.match(new RegExp("^\\D*?(" + CALC_NUM.source + ")\\s*:\\s*(" + CALC_NUM.source + ")\\D*$"));
  if (ratio && nums.length === 2) {
    var den = toNum(ratio[2]);
    if (den === 0) return refuse("CALC_UNREADABLE", "a ratio whose second number is zero has no value");
    return { ok: true, value: toNum(ratio[1]) / den, read: "ratio" };
  }
  if (nums.length === 1) return { ok: true, value: toNum(nums[0]), read: "number" };
  return refuse("CALC_UNREADABLE", nums.length
    ? "it contains " + nums.length + " numbers and no rule says which is the answer. Write the final value on its own, or after an equals sign"
    : "it contains no number. Write the final value, for example 1.5");
}

function some(c) { return (Array.isArray(c) && c.length) ? c : null; }

module.exports = {
  SUCCESS: SUCCESS, REFUSED: REFUSED, FAILED: FAILED,
  marked: marked, refuse: refuse, fail: fail,
  readCalcAnswer: readCalcAnswer,
  isMarked: isMarked, outcomeOf: outcomeOf, tally: tally,
  FORMATS: FORMATS, isFormat: isFormat, writtenModeOf: writtenModeOf, isObjective: isObjective,
  formatWords: formatWords,
  LEGACY_TYPE: LEGACY_TYPE, normaliseFormat: normaliseFormat,
  isSubjectKey: isSubjectKey, curriculumOf: curriculumOf,
  curriculumFindings: curriculumFindings, subjectOverrides: subjectOverrides,
  resolveAuthority: resolveAuthority,
  markingPoints: markingPoints, scorePoints: scorePoints, normText: normText,
  markerGuidance: markerGuidance, accomplishOf: accomplishOf,
  GUIDANCE_MAX_ITEMS: GUIDANCE_MAX_ITEMS, GUIDANCE_MAX_CHARS: GUIDANCE_MAX_CHARS,
};
