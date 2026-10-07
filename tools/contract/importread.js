// READING A FILE FOR IMPORT (Page 2, decisions 21 and 22).
//
// What the import page says about a file, decided in one place the page and the
// harness both run. It reads the file in order and stops where the file stops
// being usable:
//
//   1. JSON            not JSON: Invalid file, nothing else shown
//   2. family          a flashcard set: it belongs to Create
//   3. version         a paper format this release cannot run: Unsupported
//   4. examine()       with the packages Marginal has, so an unregistered subject
//                      blocks only questions that need its marker (decision 21)
//   5. the library     matched by exam.id, then by version, never by title
//
// The verdict is the worst state present, named in the product owner's five
// groups. Every finding code the contract can emit has a sentence a teacher can
// act on (tests/t39.mjs fails on a code without one), and every place is said in
// the paper's own numbering: Section II is the section's authored name, never a
// numeral computed from its position (decision 22).
"use strict";

var ASSESS = require("./assessment.js");
var PAPER = require("./exam.js");
var ATT = require("./attempts.js");

function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
function list(a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }
function cap(s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }

var GROUP = {
  publishable: { title: "Ready to import", tone: "ok", add: true, list: "",
                 lede: "Every question can be sat, and everything Marginal needs to mark it is in the file." },
  thin:        { title: "Ready with limited support", tone: "note", add: true, list: "Optional, and missing",
                 lede: "Every question can be sat, and everything Marginal needs to mark it is in the file. Some optional details are missing." },
  blocked:     { title: "Needs something resolved", tone: "stop", add: false, list: "What needs resolving",
                 lede: "It cannot be added yet. Whoever made the file needs to make the change below." },
  unsupported: { title: "Unsupported", tone: "stop", add: false, list: "Why this version cannot use it",
                 lede: "This version of Marginal cannot use this file." },
  malformed:   { title: "Invalid file", tone: "stop", add: false, list: "What is wrong in the file",
                 lede: "Part of this file contradicts itself or is missing, so it cannot be used as it is." },
};
var ORDER = ["malformed", "unsupported", "blocked", "thin"];
var STOP = ["malformed", "unsupported", "blocked"];

var WHO = "Whoever made the file needs to";
var SAY = {
  // invalid file
  NOT_AN_OBJECT: function () { return "The file does not contain a paper."; },
  SECTIONS_MISSING: function () { return "The file has no sections, so there is nothing to sit."; },
  NO_QUESTIONS: function () { return "The paper's sections have no questions in them."; },
  SECTION_NOT_AN_OBJECT: function () { return "One of the paper's sections could not be read."; },
  SECTION_EMPTY: function () { return "This section has no questions in it."; },
  SECTION_TOTAL_NOT_A_NUMBER: function () { return "This section's total is not a number of marks."; },
  SECTION_TOTAL_DISAGREES: function (d) { return "This section says it is worth " + d.said + " marks, but its questions add up to " + d.sum + ". Marginal cannot tell which is right. " + WHO + " correct it."; },
  PAPER_TOTAL_NOT_A_NUMBER: function () { return "The paper's total is not a number of marks."; },
  PAPER_TOTAL_DISAGREES: function (d) { return "The paper says it is worth " + d.said + " marks, but its questions add up to " + d.sum + ". Marginal cannot tell which is right. " + WHO + " correct it."; },
  PARENT_TOTAL_NOT_A_NUMBER: function () { return "This question's total is not a number of marks."; },
  PARENT_TOTAL_DISAGREES: function (d) { return "This question says it is worth " + d.said + " marks, but its parts add up to " + d.sum + ". Marginal cannot tell which is right. " + WHO + " correct it."; },
  PARENT_IS_NOT_ANSWERED: function () { return "This question has parts, and it is also set up to be answered on its own. Only one of those can be right."; },
  QUESTION_NOT_AN_OBJECT: function () { return "This question could not be read."; },
  PART_NOT_AN_OBJECT: function () { return "One part of this question could not be read."; },
  PART_LABEL_DUPLICATE: function () { return "Two parts of this question have the same label."; },
  PROMPT_MISSING: function () { return "This question has no question text, so there is nothing to answer."; },
  MARKS_MISSING: function () { return "This question does not say how many marks it is worth."; },
  MARKS_NOT_A_NUMBER: function () { return "This question's marks are not a number."; },
  MARKS_NOT_POSITIVE: function () { return "This question is worth no marks, or less than none."; },
  MC_CHOICES_MISSING: function () { return "This multiple-choice question has fewer than two options."; },
  MC_ANSWER_NOT_SINGULAR: function () { return "This multiple-choice question does not have exactly one correct option."; },
  CALC_EXPECTED_MISSING: function () { return "This calculation does not give the answer it is marked against."; },
  CALC_TOLERANCE_MISSING: function () { return "This calculation does not say how close an answer has to be to count as correct, so every answer would be marked wrong. " + WHO + " add one (0 for an exact answer)."; },
  FORMAT_ABSENT: function () { return "This question does not say what kind of answer it takes."; },
  POINTS_MALFORMED: function () { return "This question's marking points could not be read."; },
  INSTRUCTIONS_MALFORMED: function () { return "This business report's instructions are not written as text, so they cannot be shown."; },
  RESOURCE_MALFORMED: function () { return "Source material for this question could not be read."; },
  RESOURCE_EMPTY: function () { return "Source material for this question is empty, so there is nothing for students to read."; },
  REFERENCES_MALFORMED: function () { return "This question's references could not be read."; },
  REFERENCE_EMPTY: function () { return "This question has a reference that points at nothing."; },
  QUESTION_ID_DUPLICATE: function () { return "Two questions in the file share the same identifier."; },
  QUESTION_NUMBER_DUPLICATE: function () { return "Two questions in the paper have the same number."; },
  // unsupported
  PACKAGE_VERSION_UNSUPPORTED: function () { return "This file says it uses a paper format this version of Marginal cannot open. Ask whoever made it for a copy made for this version."; },
  FORMAT_UNSUPPORTED: function () { return "This question asks for a kind of answer Marginal cannot take."; },
  FORMAT_CONFLICT: function () { return "This question describes the kind of answer it takes in two ways that disagree."; },
  PART_NESTING_TOO_DEEP: function () { return "This question has parts inside its parts, which Marginal cannot show."; },
  MARKING_GUIDANCE_OVER_BUDGET: function () { return "This question carries more marking guidance than the marker can read at once, so it could not be marked against all of it."; },
  SOURCE_OVER_BUDGET: function () { return "This question's source material is longer than the marker can read, so it could not be marked against all of it."; },
  // needs something resolved
  CURRICULUM_MISSING: function () { return "The paper does not say which subject it belongs to, so its written answers could not be marked. " + WHO + " add it."; },
  SUBJECT_KEY_MISSING: function () { return "The paper does not name the subject that marks it, so its written answers could not be marked. " + WHO + " add it."; },
  SUBJECT_KEY_MALFORMED: function () { return "The paper names its subject in a form Marginal cannot match to a subject. " + WHO + " correct it."; },
  KLA_KEY_MALFORMED: function () { return "The paper's learning area is written in a form Marginal cannot read. " + WHO + " correct it."; },
  QUESTION_SUBJECT_OVERRIDE: function () { return "This question says it belongs to a different subject from the rest of the paper. " + WHO + " correct it."; },
  SUBJECT_UNREGISTERED: function (d) { return "This file names a subject Marginal does not have" + (d.course ? " (it calls it " + d.course + ")" : "") + ", and " + plural(d.needs, "question") + " in it " + (d.needs === 1 ? "needs" : "need") + " that subject's marker, so " + (d.needs === 1 ? "it" : "they") + " could not be marked. Changing the file only helps if it names the wrong subject."; },
  CRITERIA_ABSENT: function (d) { return "Marginal has " + d.label + ", but no marking criteria for it, so written answers in this paper could not be marked."; },
  // optional, and missing
  SUBJECT_MARKING_UNAVAILABLE: function (d) { return "Marginal has no marking for " + (d.course || "this paper's subject") + ". Every question here is marked from its own answer key, so this paper does not need it."; },
  JURISDICTION_ABSENT: function () { return "The paper does not say which state it is written for. This does not affect sitting or marking."; },
  KLA_ABSENT: function () { return "The paper does not say which learning area it belongs to. This does not affect sitting or marking."; },
  SECTION_NAME_ABSENT: function () { return "This section has no name, so students will see it as a number."; },
  PARENT_NUMBER_ABSENT: function () { return "This question has no number, so its parts are named by their position."; },
  PART_LABEL_ABSENT: function () { return "This part has no label, so it is named by its position."; },
  MARKING_SUPPORT_ABSENT: function () { return "No model answer and no marking points. Written answers are marked from the subject's criteria alone, which is allowed and less specific."; },
  REPORT_GUIDANCE_ABSENT: function () { return "This business report does not say what the report must do, so its marker has only the subject's criteria."; },
  SOURCE_NOT_REPRESENTED: function () { return "Part of this question's source, an image or a chart, cannot be sent to the marker as text, so written answers are marked without it."; },
  RESOURCE_UNLABELLED: function () { return "Source material here has no caption, so students see it without a title."; },
  REFERENCE_UNKNOWN: function () { return "This question points at something Marginal does not recognise, and it is ignored."; },
};
// Codes that are refusals at marking or sitting time, never import findings.
var NOT_AT_IMPORT = ["CALC_UNREADABLE", "CURRICULUM_UNOWNED", "SUBJECT_OVERRIDE_REFUSED"];

// Where a finding is, in the paper's own numbering. An unnumbered question is
// named by its position within its section, and said to be.
function placeOf(paper, p) {
  if (!p) return "The whole file";
  if (/^curriculum/.test(p)) return "Subject details";
  if (p === "format") return "File format";
  if (p === "marks") return "The paper's total";
  var s = String(p).match(/^sections\[(\d+)\](?:\.questions\[(\d+)\](?:\.parts\[(\d+)\])?)?/);
  if (!s) return "The whole file";
  var sec = paper && Array.isArray(paper.sections) ? paper.sections[+s[1]] : null;
  var at = sec && typeof sec === "object" ? ATT.sectionShort(sec, +s[1]) : "Section " + (+s[1] + 1);
  if (s[2] == null || !sec || !Array.isArray(sec.questions)) return at;
  var q = sec.questions[+s[2]];
  var n = q && typeof q === "object" ? PAPER.numberOf(q) : null;
  var numbered = n != null && String(n) !== "";
  var qn = numbered ? "Question " + n : "question " + (+s[2] + 1) + " of the section";
  if (s[3] == null) return at + ", " + qn;
  var part = q.parts[+s[3]];
  var lab = part && typeof part === "object" ? PAPER.labelOf(part, +s[3]) : String.fromCharCode(97 + +s[3]);
  return numbered ? at + ", Question " + PAPER.displayNumber(n, lab) : at + ", part (" + lab + ") of " + qn;
}
// Several places for one sentence: "Questions 11(d), 12(c), 13, 15 and 16".
function places(ps) {
  var qs = ps.map(function (x) { return (x.match(/, Question (.+)$/) || [])[1]; });
  if (ps.length > 1 && qs.every(Boolean)) return "Questions " + list(qs);
  return list(ps);
}
function dataFor(paper, f, auth) {
  var cur = (paper && ASSESS.curriculumOf(paper)) || {};
  var d = { course: cur.course || "", label: auth && auth.label, needs: paper ? PAPER.markerDependent(paper).length : 0 };
  var t = paper && Array.isArray(paper.sections) ? PAPER.totals(paper) : null;
  var m;
  if (f.code === "SECTION_TOTAL_DISAGREES" && (m = f.path.match(/^sections\[(\d+)\]/))) { d.said = paper.sections[+m[1]].marks; d.sum = t.sections[+m[1]]; }
  if (f.code === "PAPER_TOTAL_DISAGREES") { d.said = paper.marks; d.sum = t ? t.marks : 0; }
  if (f.code === "PARENT_TOTAL_DISAGREES" && (m = f.path.match(/^sections\[(\d+)\]\.questions\[(\d+)\]/))) {
    var q = paper.sections[+m[1]].questions[+m[2]];
    d.said = q.marks; d.sum = PAPER.partsOf(q).reduce(function (a, x) { return a + (Number(x.marks) || 0); }, 0);
  }
  return d;
}
function sentence(code, d) {
  var f = SAY[code];
  // A code with no sentence is a test failure (t39), never a diagnostic shown to
  // a teacher. If one slips through anyway, it says what is true and no more.
  return f ? f(d) : "Marginal found something in this file it cannot describe yet.";
}

var DISPUTED = ["SECTION_TOTAL_DISAGREES", "SECTION_TOTAL_NOT_A_NUMBER", "PAPER_TOTAL_DISAGREES", "PAPER_TOTAL_NOT_A_NUMBER",
                "PARENT_TOTAL_DISAGREES", "PARENT_TOTAL_NOT_A_NUMBER"];
var UNREADABLE = ["NOT_AN_OBJECT", "SECTIONS_MISSING", "SECTION_NOT_AN_OBJECT", "NO_QUESTIONS", "SECTION_EMPTY"];

// One file, read in order. `library` is the papers the library shows; `packages`
// the subject packages Marginal has.
function read(text, library, packages) {
  var data;
  try { data = JSON.parse(text); } catch (e) { return { kind: "unreadable", error: String(e && e.message || e) }; }
  // JSON that is not an object at all (null, a number, a string) is no paper.
  if (!data || typeof data !== "object") return { kind: "unreadable", error: "The file holds " + (data === null ? "null" : typeof data) + ", not a paper." };
  if (/^marginal-backup@/.test(String(data.format || ""))) return { kind: "backup" };
  // A flashcard set, in either of its two shapes: a set object, or a bare list of cards.
  var cardLike = function (c) { return c && typeof c === "object" && ("front" in c || "prompt" in c || "q" in c || "question" in c); };
  if (Array.isArray(data) && data.length && data.every(cardLike)) return { kind: "flashcards", name: "", cards: data.length };
  if (Array.isArray(data.cards) || /^marginal-set@/.test(String(data.format || "")))
    return { kind: "flashcards", name: data.name || "", cards: Array.isArray(data.cards) ? data.cards.length : 0 };
  var v = PAPER.examine(data, { packages: packages || {} });
  var version = v.findings.filter(function (f) { return f.code === "PACKAGE_VERSION_UNSUPPORTED"; })[0];
  if (version) return { kind: "version", finding: version, paper: data, say: SAY.PACKAGE_VERSION_UNSUPPORTED() };
  var cur = ASSESS.curriculumOf(data) || {};
  var auth = ASSESS.resolveAuthority({ curriculum: cur, packages: packages || {} });
  var findings = v.findings.map(function (f) {
    return { state: f.state, code: f.code, path: f.path, message: f.message, say: sentence(f.code, dataFor(data, f, auth)),
             place: placeOf(data, f.path) };
  });
  var worst = ORDER.filter(function (s) { return findings.some(function (f) { return f.state === s; }); })[0] || "publishable";
  var match = PAPER.libraryMatch(library || [], data);
  var g = GROUP[worst];
  var older = g.add && match.kind === "older";
  var replacing = g.add && (match.kind === "newer" || match.kind === "different");
  var lede = g.lede;
  if (worst === "blocked" && findings.some(function (f) { return f.code === "SUBJECT_UNREGISTERED" || f.code === "CRITERIA_ABSENT"; }))
    lede = "Some questions in this paper need marking for a subject Marginal does not have, so the paper cannot be added.";
  if (worst === "thin" && findings.some(function (f) { return f.code === "SUBJECT_MARKING_UNAVAILABLE"; }))
    lede = "Every question can be sat and marked, because each one has its own answer key. Marginal does not have written-response marking for this subject.";
  var readable = !findings.some(function (f) { return UNREADABLE.indexOf(f.code) >= 0; });
  return { kind: "paper", paper: data, auth: auth, cur: cur, findings: findings, worst: worst, group: g, lede: lede,
           match: match, dup: match.kind === "same", older: older, replacing: replacing, readable: readable,
           disputed: findings.some(function (f) { return DISPUTED.indexOf(f.code) >= 0; }) };
}

// The groups a page lists, in order, each with one sentence per code and every
// place it applies. Under a stop verdict only what stops the file is listed;
// optional notes are counted, not hidden.
function groups(r) {
  var stop = STOP.indexOf(r.worst) >= 0;
  var broken = !r.readable;
  var listed = function (f) { return !(broken && DISPUTED.indexOf(f.code) >= 0); };
  var shown = ORDER.filter(function (s) { return !stop || s !== "thin"; }).map(function (s) {
    var fs = r.findings.filter(function (f) { return f.state === s && listed(f); });
    var byCode = [];
    fs.forEach(function (f) {
      var e = byCode.filter(function (x) { return x.code === f.code && x.say === f.say; })[0];
      if (!e) byCode.push(e = { code: f.code, say: f.say, places: [] });
      e.places.push(f.place);
    });
    return { state: s, title: GROUP[s].list, tone: GROUP[s].tone, count: fs.length,
             items: byCode.map(function (e) { return { where: places(e.places), what: e.say }; }) };
  }).filter(function (g) { return g.count; });
  var held = stop ? r.findings.filter(function (f) { return f.state === "thin"; }).length : 0;
  return { shown: shown, held: held, tech: r.findings.map(function (f) { return { code: f.code, path: f.path || "(file)", message: cap(f.message) }; }) };
}
// Each section's line in the contents, from its authored name.
function contents(r) {
  if (!r.readable) return null;
  var disputed = {};
  r.findings.filter(function (f) { return DISPUTED.indexOf(f.code) >= 0; }).forEach(function (f) {
    var m = (f.path || "").match(/^sections\[(\d+)\]/); if (m) disputed[+m[1]] = true;
  });
  return r.paper.sections.map(function (sec, i) {
    var t = PAPER.totals({ sections: [sec] });
    var pick = Number(sec.choose) || 0;
    return { name: ATT.sectionName(sec, i),
             meta: (pick ? "choose " + pick + " of " + sec.questions.length : plural(t.questions, "question")) +
                   " · " + (disputed[i] ? "marks disputed" : plural(t.marks, "mark")) };
  });
}
// What adding it puts under "Practise a question type": the safely assessable
// questions of each format (decision 22), as Page 1 will count them.
var TYPE_WORDS = { multiple_choice: "multiple choice", short_answer: "short answer", calculation: "calculation",
                   business_report: "business report", extended_response: "extended response" };
function adds(paper, packages) {
  var probe = Object.assign({}, paper, { id: "__probe__" });
  var counts = ATT.TYPES.map(function (f) { return [f, ATT.bank(f, [probe], packages).length]; }).filter(function (x) { return x[1]; });
  var all = counts.reduce(function (a, x) { return a + x[1]; }, 0);
  var either = (paper.sections || []).map(function (s, i) { return Number(s.choose) ? ATT.sectionShort(s, i) : null; }).filter(Boolean);
  return { total: all, parts: counts.map(function (x) { return x[1] + " " + TYPE_WORDS[x[0]]; }), either: either };
}

module.exports = {
  GROUP: GROUP, ORDER: ORDER, STOP: STOP, SAY: SAY, NOT_AT_IMPORT: NOT_AT_IMPORT,
  read: read, groups: groups, contents: contents, adds: adds, placeOf: placeOf, places: places,
  plural: plural, list: list,
};
