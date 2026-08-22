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
    tryAttempts: 0, tryRepairs: 0, tryRight: 0, learnMs: 0, writeMs: 0 };
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
      "  try: " + this.m.tryAttempts + " attempt(s), " + this.m.tryRepairs + " repaired, " + this.m.tryRight + " right",
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
    ].join("\n");
  }
}
module.exports = { content, question, subjectOf, termsOf, vocabulary, teachable, Ledger, Trace };
