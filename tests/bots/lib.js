// A simulated student is a KNOWLEDGE STATE and a policy, not a click script.
//
// The state is a ledger of terms the student can legitimately use in prose. A
// zero-knowledge student starts with an empty one and can only fill it from a
// surface the app actually showed them, so what they end up able to do is an
// audit of what the product taught. A strong student starts with a full one and
// therefore never needs to open anything. The journeys diverge because the
// students differ, not because the test tells them to press different buttons.
const { readFileSync } = require("fs");
const { createContext, runInContext } = require("vm");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
function content() {
  const sandbox = { window: {} };
  createContext(sandbox);
  runInContext(readFileSync(path.join(ROOT, "essay-content.js"), "utf8"), sandbox);
  return sandbox.window.ESSAY;
}
function question(id) {
  const E = content();
  let found = null;
  Object.keys(E.subjects).forEach(k => (E.subjects[k].questions || []).forEach(q => { if (q.id === id) found = q; }));
  if (!found) throw new Error("no question " + id);
  return found;
}

// The vocabulary a question shows, and which of it anything explains, come from
// tools/coverage.js so the harness and the build's support report can never
// disagree about what the content covers.
const { termsOf, vocabulary, teachable } = require("../../tools/coverage.js");

function subjectOf(id) {
  const E = content();
  let found = null;
  Object.keys(E.subjects).forEach(k => (E.subjects[k].questions || []).forEach(q => { if (q.id === id) found = E.subjects[k]; }));
  return found;
}

class Ledger {
  constructor(terms) { this.terms = new Set(terms || []); this.sources = {}; }
  knows(t) { return this.terms.has(t); }
  knowsAll(ts) { return ts.every(t => this.terms.has(t)); }
  missing(ts) { return ts.filter(t => !this.terms.has(t)); }
  // Only ever grows from text the student was actually shown.
  acquire(text, source, vocab) {
    const low = String(text || "").toLowerCase();
    const got = [];
    vocab.forEach(t => { if (!this.terms.has(t) && low.indexOf(t) >= 0) { this.terms.add(t); this.sources[t] = source; got.push(t); } });
    return got;
  }
  size() { return this.terms.size; }
  // A DECLARED instructional dependency, which is a different thing from a word
  // the sentence happened to contain. It is acquired when the student is shown
  // the concept's own reusable definition, not when the word appears.
  acquireConcept(id, oneLine, text, source) {
    if (this.terms.has("concept:" + id)) return false;
    const probe = String(oneLine || "").toLowerCase().slice(0, 40);
    if (!probe || String(text || "").toLowerCase().indexOf(probe) < 0) return false;
    this.terms.add("concept:" + id);
    this.sources["concept:" + id] = source;
    return true;
  }
  knowsConcept(id) { return this.terms.has("concept:" + id); }
}

// The trajectory. Every entry is something that happened TO or BY the student,
// timestamped from the start of the run, so the report can be read as a story
// rather than as a click count.
class Trace {
  constructor(name) { this.name = name; this.t0 = Date.now(); this.events = []; this.m = {
    surfacesOpened: 0, termsAcquired: 0, helpRungs: 0, prompts: 0, blocked: 0,
    sentences: 0, paragraphs: 0, msToFirstSentence: null, surfacesBeforeFirstSentence: null,
    stepsAppRequired: 0, ownArguments: 0, suppliedArguments: 0, mapVisits: 0,
    teachable: 0, unexplained: [], ladderHere: 0, noLadderHere: 0,
    // things only the APP decides, so an assertion about them can fail
    verbatim: 0, altered: 0, answerMoved: false, coverageGaps: null, acknowledged: null,
    // every time the app asked the student to understand something it cannot
    // teach. For a question that is genuinely Learn & Build ready this is 0.
    unsupported: 0, demands: [],
    // where the app spoke matters: one of these only exists on the planning
    // surface, the other reaches a student who never opens it
    planPrompts: 0, writePrompts: 0,
    // the pathway lesson, and the rhythm between learning and using it
    lessonOpens: 0, lessonWords: 0, rhythm: [],
    tryAttempts: 0, tryRepairs: 0, tryRight: 0, learnMs: 0, writeMs: 0, wordsBeforeTry: null,
    // where every concept the student used actually came from, so a paragraph
    // written with no lesson can be read as "the guided environment taught it"
    // rather than "the bot knew it already"
    provenance: [], transfer: null, dependencies: [],
    // THE PARAGRAPH REVIEW, as a learning cycle rather than a panel. What matters
    // for acceptance is not that the controls exist - ui65 owns that - but that
    // four different students move through the cycle differently: how many parts
    // came back needing work, whether the student acted on the diagnosis at all,
    // whether the sentence they saved was their own, and whether the check they
    // ended on was current.
    review: {
      opened: 0,            // times a result rendered a review panel
      slots: [],            // the authored slot keys the panel showed, in order
      diagnosed: [],        // {slot, issue} for every part reported needs_work or missing
      inspected: 0,         // tabs the student actually opened to read a diagnosis
      helpOpened: 0,        // More help, which a strong student should not need
      revised: 0,           // revisions the student saved
      revisedText: [],      // exactly what they saved, so it can be proved to be theirs
      staleSeen: 0,         // times the panel said the check predated the paragraph
      rechecked: 0,         // times they asked for a fresh judgement
      freshAfterRecheck: 0, // times the stale state was gone afterwards
      settledSlots: null,   // slots still needing work when the cycle ended
      demands: [],          // what the CYCLE found missing, apart from the journey's own
      closed: 0,            // returns to writing
      steps: [],            // the twelve-step ledger, so a skipped step is visible
    } };
  }
  // the clock starts when the student reaches the question, not when a 1.6MB
  // test file finishes loading twice
  start() { this.t0 = Date.now(); return this; }
  at() { return Date.now() - this.t0; }
  push(kind, detail) { this.events.push({ t: this.at(), kind, detail: String(detail || "") }); return this; }
  say(kind, detail) { return this.push(kind, detail); }
  // the app asked for something it cannot supply
  demand(what) {
    this.m.unsupported++;
    if (this.m.demands.indexOf(what) < 0) this.m.demands.push(what);
    this.push("UNSUPPORTED_DEMAND", what);
    return this;
  }
  report() {
    const s = this.m.msToFirstSentence;
    const lines = this.events.map(e => "  " + String((e.t / 1000).toFixed(1) + "s").padStart(7) + "  " + e.kind.padEnd(14) + e.detail);
    return [
      "=== " + this.name + " ===",
      ...lines,
      "  ---",
      "  time to first sentence:      " + (s == null ? "never wrote one" : (s / 1000).toFixed(1) + "s"),
      "  surfaces read before it:     " + (this.m.surfacesBeforeFirstSentence == null ? "-" : this.m.surfacesBeforeFirstSentence),
      "  concepts acquired:           " + this.m.termsAcquired + " of " + this.m.teachable + " the app explains",
      "  help rungs used:             " + this.m.helpRungs,
      "  paragraphs offering a ladder: " + this.m.ladderHere + " of " + (this.m.ladderHere + this.m.noLadderHere),
      "  sentences kept word for word: " + this.m.verbatim + (this.m.altered ? ", ALTERED " + this.m.altered : ""),
      "  the app's answer moved:      " + (this.m.answerMoved ? "yes" : "no"),
      "  learning surfaces opened:    " + this.m.surfacesOpened,
      "  looked at the response map:  " + this.m.mapVisits,
      "  opened the pathway lesson:   " + this.m.lessonOpens +
        (this.m.lessonOpens ? " (" + this.m.lessonWords + " words of support read)" : ""),
      // NAMED FOR WHAT IT MEASURES. This counts words before the LESSON's try
      // section, not before Check this paragraph, and read as the latter it is a
      // straight misreading of the review metrics printed below it.
      "  words before the lesson try: " + (this.m.wordsBeforeTry == null ? "-" : this.m.wordsBeforeTry),
      "  try: " + this.m.tryAttempts + " attempt(s), " + this.m.tryRepairs + " repaired, " + this.m.tryRight + " right",
      ...this.m.dependencies.map(x => "  " + x.role + " depends on " +
        (x.declared == null ? "(nothing declared)"
          : x.declared + " concept(s): " + x.given.map(g => g.id + " from " + g.from).join(", ") +
            (x.missing.length ? "  MISSING " + x.missing.join(", ") : ""))),
      ...this.m.provenance.map(x => "  knowledge used in " + x.role + ": " +
        (x.used.length ? x.used.map(u => u.term + " (" + (u.from || "NO PROVENANCE") + ")").join(", ") : "none")),
      ...(this.m.transfer ? ["  transfer probe: " + this.m.transfer.verdict + " \u2014 " + this.m.transfer.text] : []),
      "  learn then act, per paragraph: " + (this.m.rhythm.length
        ? this.m.rhythm.map(r => r.learned + "w \u2192 " + r.wrote + " sentence" + (r.wrote === 1 ? "" : "s")).join(", ")
        : "-"),
      "  learning to writing:         " + (this.m.writeMs ? (this.m.learnMs / this.m.writeMs).toFixed(2) + " to 1" : "-") +
        "  (" + Math.round(this.m.learnMs / 100) / 10 + "s learning, " + Math.round(this.m.writeMs / 100) / 10 + "s writing)",
      "  steps the app required:      " + this.m.stepsAppRequired,
      "  arguments: supplied " + this.m.suppliedArguments + ", own " + this.m.ownArguments,
      "  sentences written:           " + this.m.sentences,
      "  paragraphs completed:        " + this.m.paragraphs,
      "  prompts the app raised:      " + this.m.prompts +
        " (" + this.m.writePrompts + " while writing, " + this.m.planPrompts + " on the planning surface)",
      "  unsupported demands:         " + this.m.unsupported +
        (this.m.demands.length ? " (" + this.m.demands.join("; ") + ")" : ""),
      "  wrote without a concept it",
      "  needed and could have been",
      "  taught:                      " + this.m.blocked,
      "  concepts it needed that the",
      "  app never explains anywhere: " + (this.m.unexplained.length ? this.m.unexplained.join(", ") : "none"),
      ...this.reviewLines(),
    ].join("\n");
  }
  // Printed only when the student went through a review, so the seven bundled-bank
  // journeys keep the report they have always had.
  reviewLines() {
    const r = this.m.review;
    if (!r || !r.opened) return [];
    const need = r.settledSlots;
    return [
      "  --- paragraph review ---",
      "  reviews opened:              " + r.opened,
      "  parts the model reported:    " + (r.slots.length ? r.slots.join(", ") : "-"),
      "  parts needing work:          " + (r.diagnosed.length
        ? r.diagnosed.map(d => d.slot).join(", ") : "none"),
      "  diagnoses read:              " + r.inspected,
      "  More help opened:            " + r.helpOpened,
      "  revisions saved:             " + r.revised +
        (r.revisedText.length ? " (" + r.revisedText.map(t => JSON.stringify(t.slice(0, 40))).join(", ") + ")" : ""),
      "  saw its check go stale:      " + (r.staleSeen ? "yes" : "no"),
      "  asked for a fresh check:     " + (r.rechecked ? "yes, " + r.rechecked : "no"),
      "  fresh result afterwards:     " + (r.freshAfterRecheck ? "yes" : "no"),
      "  parts still needing work:    " + (need == null ? "-" : need.length ? need.join(", ") : "none"),
      "  cycle steps completed:       " + r.steps.join(" > "),
      "  the cycle found missing:     " + (r.demands.length ? r.demands.join("; ") : "nothing"),
    ];
  }
}
module.exports = { content, question, subjectOf, termsOf, vocabulary, teachable, Ledger, Trace };
