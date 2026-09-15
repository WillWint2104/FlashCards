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

// ---------------------------------------------------------------------------
// Parents and parts
// ---------------------------------------------------------------------------
// QUESTION 21 IS A REAL OBJECT.
//
// A paper asks "Question 21" and then asks (a), (b), (c), (d) underneath it, off
// one case study. The contract could not say that, so the parts were flattened
// into four separate questions and the relationship survived only as prose inside
// each prompt - "Question 21 (a) Outline..." - which made question 21 worth
// nothing, because question 21 did not exist.
//
// A parent is an exam object with its own identity, its own number, the
// instructions and the stimulus its parts share, and an ordered list of parts. It
// is NOT answered: it has no response format, because nobody writes an answer to
// "Question 21". Its parts are answered.
//
// EXACTLY TWO LEVELS. A part holding parts of its own is refused rather than
// walked, because this contract has no rule for what 21(a)(i) is worth or how it
// is numbered, and inventing one here would be inventing an academic convention.
function isParent(q) { return !!(q && Array.isArray(q.parts) && q.parts.length); }
function partsOf(q) { return isParent(q) ? q.parts : []; }

// The part's own label, as the paper wrote it: "a", not an index. Position is the
// fallback for a paper that labels nothing, never the source of truth.
function labelOf(part, i) {
  if (part && !blank(part.label)) return String(part.label).trim();
  if (part && !blank(part.part)) return String(part.part).trim();
  return i == null ? null : String.fromCharCode(97 + i);
}

// HOW A QUESTION IS NAMED ON SCREEN, DERIVED AND DETERMINISTIC.
//
// "21(a)" is built from the parent's authored number and the part's authored
// label. It is a display identity and is never the academic source of truth:
// both halves come from what the paper authored, and neither is an array index
// unless the paper authored nothing to use instead.
function displayNumber(parentNumber, label) {
  if (blank(parentNumber)) return blank(label) ? null : String(label);
  return blank(label) ? String(parentNumber) : String(parentNumber) + "(" + String(label) + ")";
}

// WHAT A QUESTION IS WORTH. A parent is worth what its parts are worth; a leaf is
// worth what it says. Nothing here reads a parent's AUTHORED aggregate - that is
// the number this one is checked against, and reading it would make the check
// circular.
function marksOf(q) {
  if (isParent(q)) return partsOf(q).reduce(function (m, p) {
    return m + (p && typeof p.marks === "number" && isFinite(p.marks) ? p.marks : 0);
  }, 0);
  return (q && typeof q.marks === "number" && isFinite(q.marks)) ? q.marks : 0;
}

// EVERY QUESTION A STUDENT ACTUALLY ANSWERS, in the order they meet them, with
// the parent they belong to and the name the paper gives them. This is the one
// walk: sequencing, totals, persistence and results all read it, so none of them
// can disagree about what the paper contains.
//
// An either/or section contributes only what will be attempted. Choosing a parent
// brings all of its parts, which is why the choice is applied to the top level
// and not inside it.
function answerables(paper, choices) {
  var out = [];
  ((paper && paper.sections) || []).forEach(function (sec, si) {
    var list = (sec && sec.questions) || [];
    var pick = Number(sec && sec.choose) || 0;
    list.forEach(function (q, qi) {
      if (pick > 0) {
        var chosen = choices && choices[si] !== undefined ? choices[si] : null;
        if (chosen === null ? qi >= pick : qi !== chosen) return;
      }
      var number = numberOf(q);
      if (!isParent(q)) {
        out.push({ si: si, qi: qi, pi: null, q: q, parent: null, sec: sec,
                   number: number, label: null, display: number });
        return;
      }
      partsOf(q).forEach(function (part, pi) {
        var label = labelOf(part, pi);
        out.push({ si: si, qi: qi, pi: pi, q: part, parent: q, sec: sec,
                   number: number, label: label, display: displayNumber(number, label) });
      });
    });
  });
  return out;
}

// A part inherits what its parent shares. Kept as a READ rather than a copy: the
// contract must not duplicate a case study into four parts so a renderer has an
// easier time, because then four copies can drift and the paper stops saying
// which stimulus the four parts share.
function resourcesFor(entry) {
  var own = resourcesOf(entry && entry.q);
  var shared = entry && entry.parent ? resourcesOf(entry.parent) : [];
  return shared.concat(own);
}

function parentFindings(q, path) {
  var out = [];
  var add = function (state, code, message, at) { out.push(finding(state, code, at || path, message)); };

  // A parent is not answered, so a parent claiming a response format is a
  // contradiction rather than a detail: it says both "I am answered" and "my
  // parts are answered", and nothing here can tell which was meant.
  if (!blank(q.format) || !blank(q.type))
    add(STATE.malformed, "PARENT_IS_NOT_ANSWERED",
      "this question has parts, so it is not answered itself, but it also declares a response format. " +
      "One of the two is wrong and nothing here can tell which");

  if (blank(numberOf(q)))
    add(STATE.thin, "PARENT_NUMBER_ABSENT",
      "a question with parts is referred to by number, and this one has none, so its parts are named by position");

  // The authored aggregate, checked and never substituted.
  var calculated = marksOf(q);
  if (!blank(q.marks)) {
    if (typeof q.marks !== "number" || !isFinite(q.marks))
      add(STATE.malformed, "PARENT_TOTAL_NOT_A_NUMBER", JSON.stringify(q.marks) + " is not a number of marks", path + ".marks");
    else if (q.marks !== calculated)
      add(STATE.malformed, "PARENT_TOTAL_DISAGREES",
        "this question says it is worth " + q.marks + " and its parts add to " + calculated +
        ". One of the two is wrong and nothing here can tell which, so neither is used", path + ".marks");
  }

  out = out.concat(resourceFindings(q, path)).concat(referenceFindings(q, path));

  var labels = {};
  partsOf(q).forEach(function (part, pi) {
    var at = path + ".parts[" + pi + "]";
    if (!part || typeof part !== "object") {
      out.push(finding(STATE.malformed, "PART_NOT_AN_OBJECT", at, "a part is an object and this is not one"));
      return;
    }
    // Two levels, and the refusal says why rather than silently walking one.
    if (Array.isArray(part.parts) && part.parts.length)
      out.push(finding(STATE.unsupported, "PART_NESTING_TOO_DEEP", at + ".parts",
        "a part with parts of its own is deeper than this contract describes. It is refused rather than flattened, " +
        "because what 21(a)(i) is worth and how it is numbered is an academic convention this version does not have"));

    var label = labelOf(part, pi);
    if (blank(part.label) && blank(part.part))
      out.push(finding(STATE.thin, "PART_LABEL_ABSENT", at + ".label",
        "this part has no label, so it is called " + JSON.stringify(label) + " by position"));
    else if (labels[label])
      out.push(finding(STATE.malformed, "PART_LABEL_DUPLICATE", at + ".label",
        "two parts of this question are both labelled " + JSON.stringify(label) +
        ", so a student cannot say which one they answered"));
    labels[label] = at;

    out = out.concat(questionFindings(part, at));
  });
  return out;
}

function questionFindings(q, path) {
  var out = [];
  var add = function (state, code, message) { out.push(finding(state, code, path, message)); };

  if (!q || typeof q !== "object") {
    add(STATE.malformed, "QUESTION_NOT_AN_OBJECT", "a question is an object and this is not one");
    return out;
  }
  // A question with parts is a different kind of object and is checked as one.
  if (isParent(q)) return parentFindings(q, path);

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
  out = out.concat(resourceFindings(q, path)).concat(referenceFindings(q, path));

  if (ASSESS.writtenModeOf(fx.format) && blank(q.model) && !(Array.isArray(q.points) && q.points.length))
    add(STATE.thin, "MARKING_SUPPORT_ABSENT",
      "no model answer and no marking points. This question is marked from the subject's criteria alone, which is " +
      "allowed and is less specific than a paper that carries them");

  return out;
}

// ---------------------------------------------------------------------------
// Resources and references
// ---------------------------------------------------------------------------
// A QUESTION CAN HANG MORE THAN ONE THING ABOVE ITSELF.
//
// `stimulus` was one object, so a question built on a table AND a graph had to
// choose, or the author had to paste both into one image. A list is accepted now
// and a single object still is, because every paper written against the old
// shape must keep working.
//
// A RESOURCE KIND IS NOT A RESPONSE FORMAT. `lorenz` and `incomeSource` are
// chart kinds that live inside a stimulus; they describe what the student is
// looking at, never how they answer. t29 holds that they are absent from the
// format table and this file never consults one.
function resourcesOf(holder) {
  var s = holder && holder.stimulus;
  if (s == null) return [];
  return Array.isArray(s) ? s.filter(function (x) { return x != null; }) : [s];
}

function resourceFindings(holder, path) {
  var out = [];
  resourcesOf(holder).forEach(function (r, i) {
    var at = path + ".stimulus" + (Array.isArray(holder.stimulus) ? "[" + i + "]" : "");
    if (typeof r === "string") return;
    if (typeof r !== "object") {
      out.push(finding(STATE.malformed, "RESOURCE_MALFORMED", at,
        "a stimulus is text or an object describing what the student is looking at, and this is neither"));
      return;
    }
    // Something has to be shown. An object with a caption and nothing under it is
    // a label for a resource that was never attached.
    if (blank(r.text) && blank(r.img) && !(Array.isArray(r.charts) && r.charts.length) && !r.table)
      out.push(finding(STATE.malformed, "RESOURCE_EMPTY", at,
        "this stimulus carries no text, image, table or chart, so there is nothing for the student to read"));
    else if (blank(r.caption))
      out.push(finding(STATE.thin, "RESOURCE_UNLABELLED", at,
        "this stimulus has no caption, so a question referring to \"Source 1\" has nothing to point at"));
  });
  return out;
}

// WHAT A QUESTION MAY POINT AT, AND WHAT POINTING MEANS.
//
// A reference names something that lives outside the paper - a syllabus outcome,
// a topic, a marking guidance document. The contract carries the reference; it
// does not carry the thing, and it must not invent one. So these are optional
// and only their SHAPE is checked: a reference that is present must be a string
// somebody could resolve, because an empty one is worse than none.
var REFERENCE_KEYS = ["syllabus", "topic", "criteria", "guidance"];

function referenceFindings(q, path) {
  var out = [], refs = q && q.references;
  if (refs == null) return out;
  if (typeof refs !== "object" || Array.isArray(refs)) {
    out.push(finding(STATE.malformed, "REFERENCES_MALFORMED", path + ".references",
      "references are a block of named pointers and this is not one"));
    return out;
  }
  Object.keys(refs).forEach(function (k) {
    var at = path + ".references." + k;
    if (REFERENCE_KEYS.indexOf(k) < 0)
      out.push(finding(STATE.thin, "REFERENCE_UNKNOWN", at,
        JSON.stringify(k) + " is not a reference this version resolves. It is carried and ignored rather than guessed at"));
    else if (blank(refs[k]))
      out.push(finding(STATE.malformed, "REFERENCE_EMPTY", at,
        "an empty reference points at nothing, which is worse than not pointing"));
  });
  return out;
}

// ---------------------------------------------------------------------------
// Numbering and arithmetic
// ---------------------------------------------------------------------------
// WHAT THE PAPER CALLS THIS QUESTION.
//
// Until now nothing did. Numbering lived inside the prompt string as prose -
// "Question 25. You have been hired..." - and the screen counted the student's
// position in the sequence instead, so the shipped paper already shows
// "Question 34" above a prompt that says 25. A number is a fact about the paper,
// not about how far through it somebody is, so it is authored.
//
// Position remains the fallback, because a paper that numbers nothing is still a
// paper. It is a fallback and not the answer.
function numberOf(q) { return (q && !blank(q.number)) ? String(q.number).trim() : null; }

// What a section is worth. An either/or contributes only the questions a student
// will actually attempt, which is why this is not a plain sum: a `choose: 1`
// section holding two twenty-mark options is worth twenty.
function sectionMarks(sec) {
  var list = (sec && sec.questions) || [];
  var pick = Number(sec && sec.choose) || 0;
  var counted = pick > 0 ? list.slice(0, pick) : list;
  // marksOf, not q.marks: a question with parts is worth what its parts are
  // worth, and reading its authored aggregate here would make that check
  // circular as well as double-counting a paper that authors both.
  return counted.reduce(function (m, q) { return m + marksOf(q); }, 0);
}

// The arithmetic of a whole paper, calculated from its questions. Nothing here
// reads an authored total: this is the number an authored total is checked
// against, and if it read one the check would be circular.
function totals(paper) {
  var sections = (paper && paper.sections) || [];
  var per = sections.map(sectionMarks);
  // Counted from the one walk, so this cannot disagree with what is sequenced.
  // A parent is not one of them: nobody answers "Question 21", they answer its
  // four parts, and a progress count that says otherwise is wrong on screen.
  var answered = answerables(paper);
  return {
    sections: per,
    marks: per.reduce(function (a, b) { return a + b; }, 0),
    questions: answered.length,
    parents: sections.reduce(function (n, sec) {
      return n + ((sec && sec.questions) || []).filter(isParent).length;
    }, 0),
  };
}

// AN AUTHORED TOTAL THAT DISAGREES IS NOT QUIETLY CORRECTED.
//
// Either the declared number is wrong or the questions are, and nothing here can
// tell which - the same shape as the Gate 3B format conflict, and the same
// answer. Rewriting the declared total would hide an authoring mistake behind a
// paper that looks right; rewriting the questions is not on the table. So the
// disagreement is reported and the package is fixed by the person who wrote it.
function totalFindings(paper) {
  var out = [], t = totals(paper);
  var sections = (paper && paper.sections) || [];
  sections.forEach(function (sec, si) {
    if (!sec || blank(sec.marks)) return;
    if (typeof sec.marks !== "number" || !isFinite(sec.marks)) {
      out.push(finding(STATE.malformed, "SECTION_TOTAL_NOT_A_NUMBER", "sections[" + si + "].marks",
        JSON.stringify(sec.marks) + " is not a number of marks"));
      return;
    }
    if (sec.marks !== t.sections[si])
      out.push(finding(STATE.malformed, "SECTION_TOTAL_DISAGREES", "sections[" + si + "].marks",
        "this section says it is worth " + sec.marks + " and its questions add to " + t.sections[si] +
        ". One of the two is wrong and nothing here can tell which, so neither is used"));
  });
  var declared = paper && paper.marks;
  if (!blank(declared)) {
    if (typeof declared !== "number" || !isFinite(declared))
      out.push(finding(STATE.malformed, "PAPER_TOTAL_NOT_A_NUMBER", "marks",
        JSON.stringify(declared) + " is not a number of marks"));
    else if (declared !== t.marks)
      out.push(finding(STATE.malformed, "PAPER_TOTAL_DISAGREES", "marks",
        "this paper says it is worth " + declared + " and its sections add to " + t.marks +
        ". One of the two is wrong and nothing here can tell which, so neither is used"));
  }
  return out;
}

// Two questions cannot share an id, and two cannot share an authored number: the
// first makes a result ambiguous, the second makes the paper ambiguous to the
// student reading it. Both are checked across the WHOLE paper rather than within
// a section, because that is the scope a reader assumes.
function duplicateFindings(paper) {
  var out = [], ids = {}, numbers = {};
  var claim = function (bag, key, at, code, message) {
    if (blank(key)) return;
    var k = String(key).trim();
    if (bag[k]) out.push(finding(STATE.malformed, code, at, message(k, bag[k])));
    else bag[k] = at;
  };
  ((paper && paper.sections) || []).forEach(function (sec, si) {
    ((sec && sec.questions) || []).forEach(function (q, qi) {
      var at = "sections[" + si + "].questions[" + qi + "]";
      claim(ids, q && q.id, at + ".id", "QUESTION_ID_DUPLICATE", function (k, prev) {
        return JSON.stringify(k) + " is already the id of " + prev + ". An id names one question";
      });
      // A parent's number and a leaf's number occupy the same space: both are
      // what a student is told to answer.
      claim(numbers, numberOf(q), at + ".number", "QUESTION_NUMBER_DUPLICATE", function (k, prev) {
        return "two questions are both numbered " + JSON.stringify(k) + " (also " + prev +
          "), so a student cannot tell which one is meant";
      });
      partsOf(q).forEach(function (part, pi) {
        var pat = at + ".parts[" + pi + "]";
        claim(ids, part && part.id, pat + ".id", "QUESTION_ID_DUPLICATE", function (k, prev) {
          return JSON.stringify(k) + " is already the id of " + prev + ". An id names one question";
        });
        // Parts are compared by the name a student reads - "21(a)" - rather than
        // by the bare label, because (a) appearing under 21 and under 22 is
        // ordinary and two 21(a)s are not.
        //
        // ONLY AN AUTHORED NAME CAN BE A DUPLICATE. A duplicate is a paper
        // CLAIMING two questions are called the same thing, and a claim has to be
        // made to be wrong. Where the parent authored no number and the part
        // authored no label, this function was inventing both halves from array
        // position and then refusing the paper for the collision it had just
        // created: two unnumbered parent questions each derived "a" and "b", and a
        // legitimate practice paper was rejected as malformed. Nothing is lost by
        // skipping it - PARENT_NUMBER_ABSENT and PART_LABEL_ABSENT already report
        // that nothing was authored, as thin, which is what it is.
        var authored = !blank(numberOf(q)) && (!blank(part && part.label) || !blank(part && part.part));
        claim(numbers, authored ? displayNumber(numberOf(q), labelOf(part, pi)) : null, pat + ".label",
          "QUESTION_NUMBER_DUPLICATE", function (k, prev) {
            return "two questions are both numbered " + JSON.stringify(k) + " (also " + prev +
              "), so a student cannot tell which one is meant";
          });
      });
    });
  });
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
  out = out.concat(totalFindings(paper));
  out = out.concat(duplicateFindings(paper));

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
    if (sec.source) out = out.concat(resourceFindings({ stimulus: sec.source }, at).map(function (f) {
      return finding(f.state, f.code, f.path.replace(".stimulus", ".source"), f.message);
    }));
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
    totals: totals(paper),
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
  numberOf: numberOf, sectionMarks: sectionMarks, totals: totals,
  resourcesOf: resourcesOf, resourcesFor: resourcesFor, REFERENCE_KEYS: REFERENCE_KEYS,
  isParent: isParent, partsOf: partsOf, labelOf: labelOf, displayNumber: displayNumber,
  marksOf: marksOf, answerables: answerables,
  totalFindings: totalFindings, duplicateFindings: duplicateFindings,
  questionFindings: questionFindings, curriculumFindings: curriculumFindings,
};
