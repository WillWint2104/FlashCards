// THE PAPER CONTRACT.
//
// `marginal-exam@1` is how a whole examination reaches this application from
// outside it. Gate 3A settled who marks a paper and Gate 3B settled what kind of
// response each question wants; this file is about everything around the
// questions, and about saying precisely what is wrong when something is.
//
// WHY A SECOND MODULE RATHER THAN MORE OF assessment.js. That file answers
// questions about ONE response. This one answers questions about a document: how
// its sections sit, what its marks add to, whether the thing can be sat at all.
// They are different subjects and the second reads the first.
//
// WHAT WAS THERE. validateExam built an array of strings and the importer showed
// exactly one of them:
//
//     const errs = validateExam(data);
//     if (errs.length) return msg.textContent = errs[0];
//
// So a package with ten problems reported one, and fixing it was ten attempts.
// Worse, every kind of problem read the same. "This paper is not valid JSON",
// "this paper wants a format this version cannot run", "this paper names a
// subject nothing can resolve" and "this paper is fine but has no model answers"
// are four different situations for whoever is holding the file, and exactly one
// of them means the paper is broken.
//
// THE FIVE STATES. A paper is examined and comes back as one of:
//
//   malformed      the shape is wrong. Nothing can be done with it as it stands
//   unsupported    the shape is right and it asks for something this version
//                  cannot execute - a response format, a package version
//   blocked        it declares a dependency that does not resolve. The paper may
//                  be perfect; what it points at is not here
//   thin           it can be sat. Optional support a better package would carry
//                  is absent, and that is worth saying out loud rather than
//                  discovering mid-paper
//   publishable    everything required resolves
//
// These are ordered by severity and the worst one wins, so a paper is never
// described as thin while it is also malformed. `publishable` and `thin` are
// both sittable: the difference is whether anything was worth mentioning.
//
// A FINDING IS NEVER JUST A STRING. It carries the same shape assessment.js
// already uses - severity, code, path, message - plus the state it argues for.
// Every finding is collected; none is thrown away to report the first.
var ASSESS = require("./assessment.js");

var STATE = {
  malformed: "malformed",
  unsupported: "unsupported",
  blocked: "blocked",
  thin: "thin",
  publishable: "publishable",
};
// Worst first. `examine` picks the earliest state any finding argues for.
var ORDER = [STATE.malformed, STATE.unsupported, STATE.blocked, STATE.thin, STATE.publishable];
// Which states mean the paper cannot be sat at all.
var FATAL = { malformed: true, unsupported: true, blocked: true };

var FORMAT = "marginal-exam@1";

function isSittable(state) { return !FATAL[state]; }

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------
function finding(state, code, path, message) {
  return {
    state: state,
    // Kept so the existing importer surfaces, which sort on severity, keep
    // working without learning about states first.
    severity: FATAL[state] ? "error" : "warning",
    code: code, path: path, message: message,
  };
}

// A curriculum finding is about a dependency that does not resolve, not about
// the shape of the document, so an error from assessment.js is `blocked` and a
// warning is `thin`. The codes and wording are assessment.js's own: this is a
// translation of severity into state, not a second opinion about the paper.
function curriculumFindings(paper) {
  return ASSESS.curriculumFindings(paper).concat(ASSESS.subjectOverrides(paper)).map(function (f) {
    return finding(f.severity === "error" ? STATE.blocked : STATE.thin, f.code, f.path, f.message);
  });
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------
// A refusal from normaliseFormat is not one situation. A question that says
// nothing about its format has a hole in it and is malformed; a question that
// asks clearly for something this version cannot run, or that makes two
// different claims at once, is unsupported. The distinction matters to whoever
// has to fix the file: one is a missing field, the other is a version or a
// contradiction.
var FORMAT_STATE = {
  FORMAT_ABSENT: STATE.malformed,
  FORMAT_UNSUPPORTED: STATE.unsupported,
  FORMAT_CONFLICT: STATE.unsupported,
};

function questionFindings(q, path) {
  var out = [];
  var add = function (state, code, message) { out.push(finding(state, code, path, message)); };

  if (!q || typeof q !== "object") {
    add(STATE.malformed, "QUESTION_NOT_AN_OBJECT", "a question is an object and this is not one");
    return out;
  }
  if (blank(q.prompt))
    add(STATE.malformed, "PROMPT_MISSING", "a question with no prompt asks nothing, so there is nothing to answer");

  // Marks are read before the format, because a question with no marks cannot be
  // added up whatever kind of response it wants.
  if (q.marks === undefined || q.marks === null || q.marks === "")
    add(STATE.malformed, "MARKS_MISSING", "a question declares what it is worth. Without it the paper has no total");
  else if (typeof q.marks !== "number" || !isFinite(q.marks))
    add(STATE.malformed, "MARKS_NOT_A_NUMBER",
      JSON.stringify(q.marks) + " is not a number of marks. A mark total is arithmetic and a string is not");
  else if (q.marks <= 0)
    add(STATE.malformed, "MARKS_NOT_POSITIVE",
      q.marks + " is not a number of marks a question can be worth");

  // THE GATE 3B SUBSTRATE, AT THE DOOR.
  //
  // This used to be a hardcoded list of the five legacy type strings, which meant
  // a package authored the documented modern way -
  //
  //     { "format": "business_report", "directive": "recommend", "marks": 20 }
  //
  // - was refused at import as an unknown type, while the substrate beside it
  // resolved that question perfectly. The paper a teacher is most likely to write
  // against the published contract was the one paper the importer would not take.
  var fx = ASSESS.normaliseFormat(q);
  if (!fx.ok) {
    add(FORMAT_STATE[fx.code] || STATE.unsupported, fx.code, capitalise(fx.why));
    return out;
  }

  // What each format needs in order to be marked at all. A written question is
  // NOT in this list on purpose - see below.
  if (fx.format === "multiple_choice") {
    if (!Array.isArray(q.choices) || q.choices.length < 2)
      add(STATE.malformed, "MC_CHOICES_MISSING", "a multiple choice question offers at least two choices");
    else if (q.choices.filter(function (c) { return c && c.ok; }).length !== 1)
      add(STATE.malformed, "MC_ANSWER_NOT_SINGULAR",
        "a multiple choice question has exactly one correct choice, and this one has " +
        q.choices.filter(function (c) { return c && c.ok; }).length);
  }
  if (fx.format === "calculation" && typeof q.expected !== "number")
    add(STATE.malformed, "CALC_EXPECTED_MISSING",
      "a calculation is marked against a number, and this question does not carry one");

  // A WRITTEN QUESTION WITH NO MODEL ANSWER IS THIN, NOT BROKEN.
  //
  // This was an error, and refusing the paper for it was wrong. Since Gate 3A a
  // written response is marked against the criteria of the subject the paper
  // declares, which a question inherits and does not have to restate. A model
  // answer and a points rubric make the marking better and neither is what makes
  // it possible. So the paper imports, and the fact that it will be marked from
  // course context alone is reported rather than hidden.
  if (ASSESS.writtenModeOf(fx.format) && blank(q.model) && !(Array.isArray(q.points) && q.points.length))
    add(STATE.thin, "MARKING_SUPPORT_ABSENT",
      "no model answer and no marking points. This question is marked from the subject's criteria alone, which is " +
      "allowed and is less specific than a paper that carries them");

  return out;
}

// ---------------------------------------------------------------------------
// The paper
// ---------------------------------------------------------------------------
function examine(paper) {
  var out = [];

  if (!paper || typeof paper !== "object")
    return verdict([finding(STATE.malformed, "NOT_AN_OBJECT", "", "this is not an exam package")], paper);

  // The version this file speaks. A package naming a different one is not
  // malformed - it may be perfectly well formed for a version that does not
  // exist here - so it is unsupported, and says which version it asked for.
  if (!blank(paper.format) && String(paper.format) !== FORMAT)
    out.push(finding(STATE.unsupported, "PACKAGE_VERSION_UNSUPPORTED", "format",
      JSON.stringify(String(paper.format)) + " is not a package version this release can run. It runs " +
      JSON.stringify(FORMAT) + ", and does not guess at the difference"));

  if (!Array.isArray(paper.sections) || !paper.sections.length)
    out.push(finding(STATE.malformed, "SECTIONS_MISSING", "sections",
      "a paper is a list of sections and this one has none"));

  out = out.concat(curriculumFindings(paper));

  var questions = 0;
  (Array.isArray(paper.sections) ? paper.sections : []).forEach(function (sec, si) {
    var at = "sections[" + si + "]";
    if (!sec || typeof sec !== "object") {
      out.push(finding(STATE.malformed, "SECTION_NOT_AN_OBJECT", at, "a section is an object and this is not one"));
      return;
    }
    if (!Array.isArray(sec.questions) || !sec.questions.length) {
      out.push(finding(STATE.malformed, "SECTION_EMPTY", at + ".questions",
        "a section with no questions cannot be sat" + (blank(sec.name) ? "" : " (" + String(sec.name) + ")")));
      return;
    }
    if (blank(sec.name))
      out.push(finding(STATE.thin, "SECTION_NAME_ABSENT", at + ".name",
        "this section has no name, so it is shown to the student as a number"));
    sec.questions.forEach(function (q, qi) {
      questions++;
      out = out.concat(questionFindings(q, at + ".questions[" + qi + "]"));
    });
  });

  if (Array.isArray(paper.sections) && paper.sections.length && !questions)
    out.push(finding(STATE.malformed, "NO_QUESTIONS", "sections", "this paper has sections and no questions in any of them"));

  return verdict(out, paper);
}

function verdict(findings, paper) {
  var state = STATE.publishable;
  for (var i = 0; i < ORDER.length; i++) {
    var s = ORDER[i];
    if (findings.some(function (f) { return f.state === s; })) { state = s; break; }
  }
  return {
    state: state,
    sittable: isSittable(state),
    findings: findings,
    // Counted so a caller can say "3 problems, 12 notes" without re-walking.
    counts: ORDER.reduce(function (acc, s) {
      acc[s] = findings.filter(function (f) { return f.state === s; }).length;
      return acc;
    }, {}),
    paper: paper || null,
  };
}

// ---------------------------------------------------------------------------
function blank(s) { return s == null || String(s).trim() === ""; }
function capitalise(s) {
  s = String(s || "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

module.exports = {
  FORMAT: FORMAT, STATE: STATE, ORDER: ORDER,
  isSittable: isSittable, examine: examine,
  questionFindings: questionFindings, curriculumFindings: curriculumFindings,
};
