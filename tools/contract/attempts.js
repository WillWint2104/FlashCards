// THE ATTEMPT CONTRACT (docs/testmode-attempt-state.md, decisions 19 to 22).
//
// What a student has done in Test Mode, kept as data and nothing else, and every
// rule about it in one file the page and the harness both run. app.js holds no
// second copy: it calls these, renders what they return, and saves the store.
//
// THE STORE is two things that already travel together in the student's state
// and in the backup file:
//
//   exams     the papers, each a stored object with its own runtime `id`. Every
//             VERSION is its own object, so pinning an attempt to the object it
//             started on pins it to that version (decision 21).
//   attempts  { "paper:" + exam.id: {current, last},
//               "type:"  + format:  {current, last} }
//
// TWO SCOPES, NEVER ONE ATTEMPT (decision 19). A paper attempt and a
// question-type session are separate records. They share question content and
// the marking engine and no state: answering 11(a) in Short answer practice
// does not answer it in the paper, and the reverse.
//
// AN ATTEMPT holds only what the student did:
//
//   scope       "paper" or "type"
//   paper       the runtime id of the exact paper version (paper scope)
//   exam        the paper's stable identity, exam.id (paper scope)
//   version     that version, never changed after the start
//   sections    the section indexes chosen, fixed once started (decision 22)
//   format      the canonical format (type scope)
//   items       [{paper, exam, version, key}], fixed once started (type scope)
//   choice      {si: qi} for an either/or, made in the sitting
//   answers     {key: what was submitted}, the answer a result belongs to
//   drafts      {key: what is in the box}, kept while moving about
//   results     {key: a marked / refused / failed result}, as ASSESS makes them
//   flags       [key]
//   at          the key Resume goes to
//   startedAt, updatedAt, completedAt
//
// A key is the paper's own answerable key (si-qi[-pi]) in a paper attempt. In a
// type session it is that key prefixed with the paper's runtime id, so two
// papers' 11(a) never collide.
//
// Everything a page shows about an attempt (status, answered, not marked,
// flagged, marks) is DERIVED here from those fields by ASSESS.tally, never
// stored, so a stored count can never disagree with the answers it counts.
"use strict";

var ASSESS = require("./assessment.js");
var PAPER = require("./exam.js");

var SCOPE = { paper: "paper", type: "type" };
var STATUS = { notStarted: "not_started", inProgress: "in_progress", completed: "completed" };
// The five canonical formats a student can practise on their own, in the order
// Page 1 shows them.
var TYPES = ["multiple_choice", "short_answer", "calculation", "business_report", "extended_response"];

function blank(v) { return v == null || String(v).trim() === ""; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }

// ---- identity ------------------------------------------------------------------
// A paper is the same paper across versions when its exam.id is the same. Papers
// stored before the contract carried exam.id have only their runtime id, which
// is then their identity: they cannot be confused with anything else.
function identityOf(paper) {
  var e = paper && paper.exam && paper.exam.id;
  return blank(e) ? String(paper && paper.id) : String(e);
}
function versionOf(paper) {
  var v = paper && paper.exam && paper.exam.version;
  return blank(v) ? "" : String(v);
}
function paperKey(paperOrIdentity) {
  return "paper:" + (typeof paperOrIdentity === "string" ? paperOrIdentity : identityOf(paperOrIdentity));
}
function typeKey(format) { return "type:" + format; }
function keyOf(a) { return a.si + "-" + a.qi + (a.pi == null ? "" : "-" + a.pi); }
function itemKey(item) { return item.paper + "#" + item.key; }

// ---- the library ------------------------------------------------------------------
// What the library shows: one paper per identity, the version that has not been
// superseded. A superseded version is kept only while an attempt is pinned to it.
function library(exams) {
  return (exams || []).filter(function (p) { return p && !p.superseded; });
}
function byId(exams, id) {
  return (exams || []).filter(function (p) { return p && p.id === id; })[0] || null;
}
// Every attempt that is still worth keeping, in or out of progress.
function eachAttempt(attempts, fn) {
  Object.keys(attempts || {}).forEach(function (k) {
    var rec = attempts[k] || {};
    ["current", "last"].forEach(function (slot) { if (rec[slot]) fn(rec[slot], k, slot); });
  });
}
// The runtime ids of every paper version some attempt still points at.
function pinned(attempts) {
  var ids = {};
  eachAttempt(attempts, function (a) {
    if (a.scope === SCOPE.paper) ids[a.paper] = true;
    else (a.items || []).forEach(function (it) { ids[it.paper] = true; });
  });
  return ids;
}
// Drop superseded versions nothing points at any more.
function collect(store) {
  var keep = pinned(store.attempts);
  store.exams = (store.exams || []).filter(function (p) { return !p.superseded || keep[p.id]; });
  return store;
}

// Adding a paper that has passed PAPER.examine. The caller has given it a fresh
// runtime id. Returns what happened, in libraryMatch's words:
//   new        added
//   same       not added: this version is already there
//   older      not added: the library has a newer version (decision 21)
//   newer, different
//              added, and the version it replaces is marked superseded. It stays
//              stored while an attempt is pinned to it, and goes when none is.
function addPaper(store, paper) {
  store.exams = store.exams || [];
  store.attempts = store.attempts || {};
  var shown = library(store.exams);
  var m = PAPER.libraryMatch(shown, paper);
  // A paper with no exam.id cannot be matched to anything, so it is always new.
  if (m.kind === "same" || m.kind === "older") return { kind: m.kind, existing: m.existing };
  if (m.kind === "newer" || m.kind === "different") m.existing.superseded = true;
  store.exams.push(paper);
  collect(store);
  return { kind: m.kind, replaced: m.existing || null };
}
// Papers from a backup go through the same version rule as an import, so a
// restore never puts two versions of one paper in the library. A paper whose
// version the library already has (or has newer) is kept hidden, as a
// superseded version is, in case a restored attempt is pinned to it; the caller
// merges attempts and then runs collect(), which drops it if none is.
function restorePapers(store, papers) {
  store.exams = store.exams || [];
  store.attempts = store.attempts || {};
  var ids = {};
  store.exams.forEach(function (p) { ids[p.id] = true; });
  (papers || []).forEach(function (p) {
    if (!p || typeof p !== "object" || ids[p.id]) return;
    ids[p.id] = true;
    if (p.superseded) { store.exams.push(p); return; }
    var m = PAPER.libraryMatch(library(store.exams), p);
    if (m.kind === "same" || m.kind === "older") { p.superseded = true; store.exams.push(p); return; }
    if (m.kind === "newer" || m.kind === "different") m.existing.superseded = true;
    store.exams.push(p);
  });
  return store;
}
// Deleting a paper deletes every version of it and every attempt on it,
// including the questions it lent to type sessions. A type session that loses
// questions this way is discarded rather than left pointing at nothing.
function deletePaper(store, identity) {
  var gone = {};
  (store.exams || []).forEach(function (p) { if (identityOf(p) === identity) gone[p.id] = true; });
  store.exams = (store.exams || []).filter(function (p) { return !gone[p.id]; });
  delete store.attempts[paperKey(identity)];
  Object.keys(store.attempts || {}).forEach(function (k) {
    var rec = store.attempts[k];
    ["current", "last"].forEach(function (slot) {
      var a = rec[slot];
      if (a && a.scope === SCOPE.type && (a.items || []).some(function (it) { return gone[it.paper]; })) rec[slot] = null;
    });
    if (!rec.current && !rec.last) delete store.attempts[k];
  });
  return store;
}

// ---- what a paper offers ------------------------------------------------------------
// A section's short name is its authored name up to " - " ("Section II"). A
// section with no name is numbered as the app numbers it. Nothing is numbered
// from position where the paper names it (decision 22).
function sectionName(sec, si) {
  var n = sec && !blank(sec.name) ? String(sec.name).trim() : "";
  return n || "Section " + (si + 1);
}
function sectionShort(sec, si) {
  var n = sectionName(sec, si);
  return n.split(" - ")[0].trim() || n;
}

// Which questions can be safely assessed (decision 22). A paper must be sittable
// with the packages Marginal has. Where its subject resolves, every question has
// a marking path. Where it does not (a paper Page 2 let in with limited support),
// only questions that mark from their own key do: a written question needing an
// unavailable subject marker is not offered and is not counted.
function assessable(paper, packages) {
  var v = PAPER.examine(paper, { packages: packages || {} });
  if (!v.sittable) return function () { return false; };
  var auth = ASSESS.resolveAuthority({ curriculum: ASSESS.curriculumOf(paper), packages: packages || {} });
  if (auth.ok) return function () { return true; };
  var needs = {};
  PAPER.markerDependent(paper).forEach(function (p) { needs[p] = true; });
  return function (si, qi, pi) {
    return !needs["sections[" + si + "].questions[" + qi + "]" + (pi == null ? "" : ".parts[" + pi + "]")];
  };
}

// The question bank for one canonical format: every safely assessable question of
// that format in every paper in the library, in paper order. Parts are questions
// and parents are not; both options of an either/or are there, because each can
// be practised on its own. Format is the contract's reading of the question,
// never the section's title.
function bank(format, exams, packages) {
  var out = [];
  library(exams).forEach(function (paper) {
    var ok = assessable(paper, packages);
    (paper.sections || []).forEach(function (sec, si) {
      (sec.questions || []).forEach(function (q, qi) {
        var parent = PAPER.isParent(q);
        (parent ? PAPER.partsOf(q) : [q]).forEach(function (leaf, pi0) {
          var pi = parent ? pi0 : null;
          if (ASSESS.normaliseFormat(leaf).format !== format) return;
          if (!ok(si, qi, pi)) return;
          var number = PAPER.numberOf(q);
          out.push({ paper: paper.id, exam: identityOf(paper), version: versionOf(paper),
                     key: keyOf({ si: si, qi: qi, pi: pi }), si: si, qi: qi, pi: pi,
                     display: parent ? PAPER.displayNumber(number, PAPER.labelOf(leaf, pi0)) : number,
                     marks: Number(leaf.marks) || 0, prompt: leaf.prompt || "" });
        });
      });
    });
  });
  return out;
}
function bankCounts(exams, packages) {
  var c = {};
  TYPES.forEach(function (f) { c[f] = bank(f, exams, packages).length; });
  return c;
}

// ---- starting ----------------------------------------------------------------------------
function now(t) { return t || new Date().toISOString(); }
function emptyBags(a) {
  a.choice = {}; a.answers = {}; a.drafts = {}; a.results = {}; a.flags = [];
  return a;
}
// A paper attempt over the chosen sections. Nothing else is ever added to it.
function startPaper(paper, sections, t) {
  var all = (paper.sections || []).map(function (_, i) { return i; });
  var chosen = Array.isArray(sections) && sections.length
    ? all.filter(function (i) { return sections.indexOf(i) >= 0; }) : all;
  if (!chosen.length) throw new Error("an attempt needs at least one section");
  var a = emptyBags({ scope: SCOPE.paper, paper: paper.id, exam: identityOf(paper), version: versionOf(paper),
                      sections: chosen, startedAt: now(t), updatedAt: now(t) });
  var first = sequence(a, [paper])[0];
  a.at = first ? first.key : null;
  return a;
}
// A question-type session over the chosen questions of the bank.
function startType(format, items, t) {
  if (!items || !items.length) throw new Error("a practice session needs at least one question");
  var a = emptyBags({ scope: SCOPE.type, format: format,
                      items: items.map(function (b) { return { paper: b.paper, exam: b.exam, version: b.version, key: b.key }; }),
                      startedAt: now(t), updatedAt: now(t) });
  a.at = itemKey(a.items[0]);
  return a;
}
function recordFor(store, key) {
  store.attempts = store.attempts || {};
  return store.attempts[key] || (store.attempts[key] = { current: null, last: null });
}
// Begin an attempt where none is in progress. An in-progress attempt is never
// overwritten silently: Start again discards it first, by name.
function begin(store, key, attempt) {
  var rec = recordFor(store, key);
  if (rec.current) throw new Error("an attempt is already in progress for " + key);
  rec.current = attempt;
  return attempt;
}
// Start again (decision 22): the in-progress attempt is discarded. The last
// completed attempt, if any, is kept.
function discard(store, key) {
  var rec = recordFor(store, key);
  rec.current = null;
  if (!rec.last) delete store.attempts[key];
  collect(store);
  return store;
}
// Completing moves current to last. Submit is Slice B; the existing finish
// path calls this so a completed state exists to show.
// Closing an attempt (decision 24). One that nothing was ever submitted from is
// not closed: it would replace a real completed result with an empty one. A
// student who wants to abandon it uses Start again (discard).
function submittedAny(a) { return Object.keys((a && a.results) || {}).length > 0; }
function complete(store, key, t) {
  var rec = recordFor(store, key);
  if (!rec.current || !submittedAny(rec.current)) return null;
  rec.current.completedAt = now(t);
  rec.current.updatedAt = rec.current.completedAt;
  rec.last = rec.current;
  rec.current = null;
  collect(store);
  return rec.last;
}

// ---- the sequence ---------------------------------------------------------------------------
// Every answerable the attempt covers, in order, each with the paper object it
// belongs to. In a paper attempt that is the chosen sections' answerables, with
// the either/or as one slot until a choice is made. In a type session it is the
// chosen items, looked up in the exact versions they were started on.
function sequence(attempt, exams) {
  if (!attempt) return [];
  if (attempt.scope === SCOPE.type) {
    return (attempt.items || []).map(function (it) {
      var paper = byId(exams, it.paper);
      var hit = paper ? entryAt(paper, it.key) : null;
      return hit ? decorate(hit, paper, itemKey(it)) : null;
    }).filter(Boolean);
  }
  var paper = byId(exams, attempt.paper);
  if (!paper) return [];
  return slots(paper, attempt.choice || {}).filter(function (x) { return attempt.sections.indexOf(x.si) >= 0; })
    .map(function (x) { return decorate(x, paper, keyOf(x)); });
}
// One answerable by its key, wherever it is: a type session can hold either
// option of an either/or, so it is looked up directly rather than through the
// paper's chosen walk.
function entryAt(paper, key) {
  var m = /^(\d+)-(\d+)(?:-(\d+))?$/.exec(String(key));
  if (!m) return null;
  var si = +m[1], qi = +m[2], pi = m[3] === undefined ? null : +m[3];
  var sec = (paper.sections || [])[si], q = sec && (sec.questions || [])[qi];
  if (!q) return null;
  var number = PAPER.numberOf(q);
  if (pi === null) return PAPER.isParent(q) ? null : { si: si, qi: qi, pi: null, q: q, parent: null, sec: sec, display: number };
  var part = PAPER.isParent(q) ? PAPER.partsOf(q)[pi] : null;
  return part ? { si: si, qi: qi, pi: pi, q: part, parent: q, sec: sec,
                  display: PAPER.displayNumber(number, PAPER.labelOf(part, pi)) } : null;
}
function decorate(x, paper, key) {
  var sec = paper.sections[x.si];
  var pick = Number(sec && sec.choose) || 0;
  return { key: key, paper: paper, si: x.si, qi: x.qi, pi: x.pi, q: x.q, parent: x.parent, sec: sec,
           display: x.display, either: x.either || null, eitherSlot: !!x.eitherSlot,
           options: pick > 0 ? (sec.questions || []).map(function (q, qi) { return { qi: qi, number: PAPER.numberOf(q), q: q }; }) : null };
}
// The paper's answerables with an unchosen either/or as ONE slot. The slot is
// keyed by its first option so a choice made in it stays where the student is.
function slots(paper, choice) {
  var out = [];
  (paper.sections || []).forEach(function (sec, si) {
    var pick = Number(sec && sec.choose) || 0;
    if (pick > 0 && (choice[si] === undefined || choice[si] === null)) {
      // One slot per option to be chosen; HSC papers choose one.
      for (var n = 0; n < pick; n++) {
        var q = (sec.questions || [])[n];
        if (!q) break;
        out.push({ si: si, qi: n, pi: null, q: q, parent: null, sec: sec, display: null, eitherSlot: true });
      }
      return;
    }
    PAPER.answerables({ sections: [sec] }, pick > 0 ? { 0: choice[si] } : {}).forEach(function (x) {
      out.push({ si: si, qi: x.qi, pi: x.pi, q: x.q, parent: x.parent, sec: sec, display: x.display });
    });
  });
  return out;
}

// ---- recording what the student does -------------------------------------------------------
function touch(a, t) { a.updatedAt = now(t); return a; }
function setDraft(a, key, text, t) {
  if (text == null || text === "") delete a.drafts[key]; else a.drafts[key] = String(text);
  return touch(a, t);
}
// A submitted answer and what marking made of it. `result` may be refused or
// failed; it is stored as such and counts as not marked (UX-TEST-22).
function record(a, key, answer, result, t) {
  a.answers[key] = answer;
  a.results[key] = result;
  delete a.drafts[key];
  return touch(a, t);
}
// "Leave it unmarked" (decision 24), for an answer whose marking reply has not
// come back. It never removes a mark, and it never stores the sent text over
// the version a stored result was given for:
//   first submission   recorded as submitted, not marked, with `result`
//   a mark already     the mark and its graded answer stay; the sent text stays a draft
//   a not-marked one   stays not marked; the sent text stays a draft
// The caller stops waiting for the reply, so a late one is ignored.
function leaveUnmarked(a, key, sent, result, t) {
  if (a.results[key]) return touch(a, t);
  return record(a, key, sent, result, t);
}
function toggleFlag(a, key, t) {
  var i = a.flags.indexOf(key);
  if (i >= 0) a.flags.splice(i, 1); else a.flags.push(key);
  return touch(a, t);
}
function moveTo(a, key, t) { a.at = key; return touch(a, t); }
// An either/or chosen in the sitting. It can be changed only while nothing has
// been submitted or drafted for the option chosen, because the choice decides
// which question the answer belongs to.
function choose(a, si, qi, t, paper) {
  var cur = a.choice[si];
  if (cur !== undefined && cur !== null && cur !== qi && hasWork(a, function (k) { return k.split("-")[0] === String(si); }))
    throw new Error("an either/or with an answer in it cannot be changed");
  a.choice[si] = qi;
  // A flag set on the unchosen slot, or on the option not taken, follows the
  // student to the question they chose, rather than vanishing from every count.
  // The chosen question's first key is its own, or its first part's when it has
  // parts (which needs the paper; without it, a question without parts is assumed).
  var q = paper && paper.sections && paper.sections[si] ? (paper.sections[si].questions || [])[qi] : null;
  var first = si + "-" + qi + (q && PAPER.isParent(q) ? "-0" : "");
  var mine = function (k) { return k === first || (k.indexOf(si + "-" + qi + "-") === 0 && first !== si + "-" + qi); };
  var stray = a.flags.filter(function (k) { return k.split("-")[0] === String(si) && !mine(k); });
  if (stray.length) {
    a.flags = a.flags.filter(function (k) { return stray.indexOf(k) < 0; });
    if (!a.flags.some(mine)) a.flags.push(first);
  }
  return touch(a, t);
}
function hasWork(a, pick) {
  return Object.keys(a.answers).concat(Object.keys(a.drafts)).some(pick);
}

// What an entry is worth. An unchosen either/or slot is worth what its option
// is, read through the contract, because the option may be a parent.
function marksOf(e) { return e.eitherSlot ? PAPER.marksOf(e.q) : Number(e.q.marks) || 0; }

// ---- what a page shows --------------------------------------------------------------------
// Answered means marked. A result that is refused or failed is NOT answered and
// is counted as not marked; its marks stay in what the attempt is out of.
// How many answerables an entry stands for. An either/or not yet chosen is one
// slot in the sitting, but the paper counts the option it stands in for, parts
// and all (PAPER.totals), so "N of M answered" agrees with the overview's count.
function weightOf(e) {
  return e && e.eitherSlot && PAPER.isParent(e.q) ? Math.max(1, PAPER.partsOf(e.q).length) : 1;
}
function summary(a, exams) {
  if (!a) return { status: STATUS.notStarted, total: 0, answered: 0, notMarked: 0, flagged: 0, got: 0, max: 0 };
  var seq = sequence(a, exams);
  var t = ASSESS.tally(seq.map(function (e) { return { marks: marksOf(e), result: a.results[e.key] }; }));
  var keys = {};
  seq.forEach(function (e) { keys[e.key] = true; });
  var here = seq.filter(function (e) { return e.key === a.at; })[0] || null;
  return {
    status: a.completedAt ? STATUS.completed : STATUS.inProgress,
    total: seq.reduce(function (n, e) { return n + weightOf(e); }, 0), answered: t.done, notMarked: t.refused + t.failed,
    flagged: (a.flags || []).filter(function (k) { return keys[k]; }).length,
    got: t.got, max: t.max, at: here,
    whole: a.scope === SCOPE.paper && byId(exams, a.paper) ? a.sections.length === byId(exams, a.paper).sections.length : null,
  };
}
// One answerable's state, for chips and the rail: answered (marked), not marked
// (submitted, no valid mark), drafted, flagged, current. Independent facts.
function itemState(a, key) {
  var r = a.results[key];
  return { answered: !!r && ASSESS.isMarked(r), notMarked: !!r && !ASSESS.isMarked(r),
           drafted: !r && !blank(a.drafts[key]), flagged: a.flags.indexOf(key) >= 0, current: a.at === key };
}

// THE SUBMIT REPORT (Slice B, state 1). Everything a page says about an attempt
// it is about to close, from one walk of the sequence and one predicate (the
// outcome tally uses), so the totals, the lists, the sentence beside the button
// and the table by section cannot disagree with each other or with summary().
//
// `pending` is the keys being marked right now. It is the app's in-memory
// TM_PENDING and is never stored: after a reload it is empty, and nothing is
// "being marked". An item's status is what is stored, whatever is pending on it:
//   marked        a valid mark                       counts as answered
//   not_marked    a submitted answer with no mark     its marks stay in max, never in got
//   not_answered  nothing submitted                   a draft beside it is not marked
// and `help` says what could change a not-marked answer: "retry" (the marker
// failed and may not next time), "change" (the answer as written cannot be
// read), "settings" (a marker setting the class's teacher controls), or "none"
// (nothing in the sitting changes it).
var SETTINGS_FIXES = ["MARKER_NOT_CONNECTED", "MARKER_ACCESS_DENIED"];
// Why an answer was not marked, as a cause (decision 25). A recorded reason says
// what happened and, while the attempt was open, what to do next ("Wait a
// minute, then try marking it again"). On a closed attempt only the cause is
// still true, so only its first sentence is kept: "The marker is busy."
function causeOf(why) {
  if (!why) return "";
  var s = String(why).trim().replace(/^This (response|answer) was not marked:\s*/i, "");
  var first = (s.match(/^[\s\S]*?[.!?](?=\s|$)/) || [s])[0].trim();
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1) + (/[.!?]$/.test(first) ? "" : ".");
}
function report(a, exams, pending) {
  var seq = sequence(a, exams), busy = {};
  (pending || []).forEach(function (k) { busy[k] = true; });
  var items = seq.map(function (e) {
    var r = a.results[e.key], o = r ? ASSESS.outcomeOf(r) : null;
    var status = o === "success" ? "marked" : r ? "not_marked" : "not_answered";
    var d = a.drafts[e.key], drafted = !blank(d);
    var fmt = e.eitherSlot ? null : ASSESS.normaliseFormat(e.q).format;
    return {
      key: e.key, paper: e.paper.id, si: e.si, qi: e.qi, pi: e.pi, display: e.display, format: fmt, outcome: o,
      parent: e.parent ? { number: PAPER.numberOf(e.parent), marks: PAPER.marksOf(e.parent) } : null,
      eitherSlot: e.eitherSlot, options: e.eitherSlot ? e.options.map(function (x) { return x.number; }) : null,
      marks: marksOf(e), weight: weightOf(e), status: status,
      score: status === "marked" ? r.score : null, max: status === "marked" ? r.max : null,
      code: status === "not_marked" ? (r.code || null) : null, why: status === "not_marked" ? (r.why || null) : null,
      cause: status === "not_marked" ? causeOf(r.why || r.note || "") : null,
      help: status !== "not_marked" ? null
        : o === "failed" && r.retry !== false ? "retry" : r.code === "CALC_UNREADABLE" ? "change"
        : SETTINGS_FIXES.indexOf(r.code) >= 0 ? "settings" : "none",
      draft: status === "not_answered" && drafted ? (fmt === "multiple_choice" ? "selected" : "written") : null,
      // A change still being marked was submitted; a multiple-choice re-pick is
      // not shown beside its mark by the sitting, so it is not reported either.
      changed: status !== "not_answered" && drafted && !busy[e.key] && fmt !== "multiple_choice" && String(d) !== String(a.answers[e.key]),
      pending: !!busy[e.key], flagged: a.flags.indexOf(e.key) >= 0,
      // The version a stored result was given for, kept apart from newer text.
      graded: r ? (a.answers[e.key] == null ? null : String(a.answers[e.key])) : null,
    };
  });
  var row = function (st) {
    var xs = items.filter(function (x) { return x.status === st; });
    return { count: xs.reduce(function (n, x) { return n + x.weight; }, 0),
             worth: xs.reduce(function (n, x) { return n + x.marks; }, 0),
             pending: xs.filter(function (x) { return x.pending; }).length };
  };
  var t = ASSESS.tally(items.map(function (x) { return { marks: x.marks, result: a.results[x.key] }; }));
  var out = {
    scope: a.scope, items: items,
    rows: { marked: Object.assign(row("marked"), { earned: t.got }), notMarked: row("not_marked"), notAnswered: row("not_answered") },
    total: items.reduce(function (n, x) { return n + x.weight; }, 0), max: t.max, got: t.got,
    flagged: items.filter(function (x) { return x.flagged; }).map(function (x) { return x.key; }),
    pending: items.filter(function (x) { return x.pending; }).map(function (x) { return x.key; }),
    changed: items.filter(function (x) { return x.changed; }).map(function (x) { return x.key; }),
    at: (seq.filter(function (e) { return e.key === a.at; })[0] || seq[seq.length - 1] || {}).key || null,
    sections: null, either: [],
  };
  out.submitted = items.filter(function (x) { return x.status !== "not_answered"; }).length;
  out.canFinish = submittedAny(a);
  var paper = a.scope === SCOPE.paper ? byId(exams, a.paper) : null;
  if (paper) {
    out.sections = a.sections.map(function (si) {
      var xs = items.filter(function (x) { return x.si === si; });
      var st = ASSESS.tally(xs.map(function (x) { return { marks: x.marks, result: a.results[x.key] }; }));
      return { si: si, total: xs.reduce(function (n, x) { return n + x.weight; }, 0), done: st.done,
               notMarked: st.refused + st.failed, flagged: xs.filter(function (x) { return x.flagged; }).length,
               got: st.got, max: st.max, touched: xs.some(function (x) { return !!a.results[x.key]; }) };
    });
    out.either = a.sections.filter(function (si) { return Number(paper.sections[si].choose) > 0; }).map(function (si) {
      var sec = paper.sections[si], c = a.choice[si];
      var chosen = c === undefined || c === null ? null : c;
      return { si: si, choose: Number(sec.choose), chosen: chosen,
               options: (sec.questions || []).map(function (q, qi) { return { qi: qi, number: PAPER.numberOf(q), marks: PAPER.marksOf(q) }; }),
               locked: chosen !== null && hasWork(a, function (k) { return k.split("-")[0] === String(si); }) };
    });
  }
  return out;
}

// THE RESULTS MAP (Slice B, state 2). A closed attempt as bands, one per paper
// and section in paper order, each holding its parent questions (with the parts
// in this attempt, never flattened) and its single questions. Every tally is the
// report's own items through ASSESS.tally, so Results cannot disagree with Submit.
// A group's state is the page's three words for it:
//   marked          something in it was marked: got / max (a real 0 included)
//   nothing_marked  something was submitted and none of it was marked
//   not_answered    nothing in it was submitted
function results(a, exams) {
  var r = report(a, exams, []);
  var seq = sequence(a, exams), byKey = {};
  seq.forEach(function (e) { byKey[e.key] = e; });
  var tallyOf = function (xs) {
    var t = ASSESS.tally(xs.map(function (x) { return { marks: x.marks, result: a.results[x.key] }; }));
    var w = function (st) { return xs.filter(function (x) { return x.status === st; }).reduce(function (n, x) { return n + x.weight; }, 0); };
    var notMarked = w("not_marked"), notAnswered = w("not_answered");
    return { total: xs.reduce(function (n, x) { return n + x.weight; }, 0), done: t.done, notMarked: notMarked, notAnswered: notAnswered,
             got: t.got, max: t.max, flagged: xs.filter(function (x) { return x.flagged; }).length,
             state: t.done ? "marked" : notMarked ? "nothing_marked" : "not_answered" };
  };
  var bands = [];
  r.items.forEach(function (x) {
    var e = byKey[x.key], bk = x.paper + "|" + x.si;
    var band = bands.filter(function (b) { return b.key === bk; })[0];
    if (!band) bands.push(band = { key: bk, paper: x.paper, paperName: e.paper.name || "", si: x.si,
                                   name: sectionName(e.sec, x.si), short: sectionShort(e.sec, x.si), entries: [], items: [] });
    band.items.push(x);
    if (e.parent) {
      var gk = bk + "|" + x.qi;
      var g = band.entries.filter(function (y) { return y.key === gk; })[0];
      if (!g) {
        var cap = PAPER.resourcesOf(e.parent).filter(function (res) { return res && typeof res === "object" && typeof res.caption === "string" && res.caption.trim(); })[0];
        band.entries.push(g = { kind: "parent", key: gk, qi: x.qi, number: PAPER.numberOf(e.parent), caption: cap ? cap.caption.trim() : "",
                                parts: PAPER.partsOf(e.parent).length, items: [] });
      }
      g.items.push(x);
    } else band.entries.push({ kind: "leaf", key: x.key, item: x });
  });
  bands.forEach(function (b) {
    Object.assign(b, tallyOf(b.items));
    b.entries.forEach(function (g) { if (g.kind === "parent") Object.assign(g, tallyOf(g.items)); });
  });
  r.bands = bands;
  r.whole = tallyOf(r.items);
  r.startedAt = a.startedAt || null; r.completedAt = a.completedAt || null;
  if (a.scope === SCOPE.paper) {
    var pinnedTo = byId(exams, a.paper);
    var lib = library(exams).filter(function (p) { return identityOf(p) === a.exam; })[0] || null;
    r.version = pinnedTo ? versionOf(pinnedTo) : (a.version || "");
    r.libraryVersion = lib ? versionOf(lib) : null;
    r.superseded = !!(pinnedTo && pinnedTo.superseded);
  } else { r.version = null; r.libraryVersion = null; r.superseded = false; }
  return r;
}

// ---- reading a store from anywhere ----------------------------------------------------------
// A stored or restored store is not trusted to be well formed. Anything that is
// not a recognisable attempt is dropped, not repaired into one.
function sane(attempts, exams) {
  var out = {};
  Object.keys(attempts || {}).forEach(function (k) {
    var rec = attempts[k];
    if (!rec || typeof rec !== "object") return;
    var keep = {};
    ["current", "last"].forEach(function (slot) {
      var a = rec[slot];
      if (!a || typeof a !== "object") return;
      var ok = a.scope === SCOPE.paper ? !!byId(exams, a.paper) && Array.isArray(a.sections)
        : a.scope === SCOPE.type ? Array.isArray(a.items) && a.items.length && a.items.every(function (it) { return byId(exams, it.paper); })
        : false;
      if (!ok) return;
      ["choice", "answers", "drafts", "results"].forEach(function (b) { if (!a[b] || typeof a[b] !== "object") a[b] = {}; });
      // A stored result says what it is, so every reader agrees on it: the tally
      // and isMarked() read an outcome-less {score, max} differently, and an old
      // {error} carries no outcome at all.
      Object.keys(a.results).forEach(function (k) {
        var r = a.results[k];
        if (!r || typeof r !== "object") { delete a.results[k]; return; }
        var o = ASSESS.outcomeOf(r);
        if (r.outcome !== o) r.outcome = o;
      });
      if (!Array.isArray(a.flags)) a.flags = [];
      keep[slot] = a;
    });
    if (keep.current || keep.last) out[k] = { current: keep.current || null, last: keep.last || null };
  });
  return out;
}

module.exports = {
  SCOPE: SCOPE, STATUS: STATUS, TYPES: TYPES,
  identityOf: identityOf, versionOf: versionOf, paperKey: paperKey, typeKey: typeKey, keyOf: keyOf, itemKey: itemKey,
  library: library, byId: byId, pinned: pinned, collect: collect, addPaper: addPaper, deletePaper: deletePaper,
  sectionName: sectionName, sectionShort: sectionShort, assessable: assessable, bank: bank, bankCounts: bankCounts,
  startPaper: startPaper, startType: startType, begin: begin, discard: discard, complete: complete,
  sequence: sequence, entryAt: entryAt, marksOf: marksOf, setDraft: setDraft, record: record, toggleFlag: toggleFlag, moveTo: moveTo, choose: choose,
  summary: summary, report: report, results: results, causeOf: causeOf, leaveUnmarked: leaveUnmarked, submittedAny: submittedAny, weightOf: weightOf, restorePapers: restorePapers, itemState: itemState, sane: sane, clone: clone,
};
