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

const STOP = new Set(("the a an and or of to in on for by with its it their this that as at from is are be " +
  "how what which where when why more less than into over under about through can could will would should " +
  "business businesses staff people customers market markets thing things part parts way ways").split(" "));
// The words a sentence has to contain to count as saying what the pathway says.
// Taken from the pathway's own short form, so nothing is invented for the test.
function termsOf(pathway) {
  return String(pathway.short || pathway.relationship || "")
    .replace(/[→>-]+/g, " ")
    .toLowerCase().split(/[^a-z']+/)
    .filter(w => w.length > 3 && !STOP.has(w));
}
function vocabulary(q) {
  const all = new Set();
  (q.pathways || []).forEach(p => termsOf(p).forEach(t => all.add(t)));
  return [...all];
}

// A term is TEACHABLE if the app has somewhere that explains it, not merely
// somewhere that prints it. A pathway's label prints "engagement"; nothing in the
// app says what engagement is. The distinction matters: a student who cannot
// acquire a term because no surface explains it has hit a content gap, and
// counting that as the app refusing to help would blame the wrong thing.
const EXPLAINS = ["meaning", "whatToProve", "commonMistake", "guides", "hint", "needs",
  "direction", "frame", "starter", "example", "explain", "quick", "readMore", "confusions",
  "note", "text", "job", "why", "use", "fact"];
function explanatoryText(q, subjectContent) {
  const out = [];
  const walk = (v, keyChain) => {
    if (v == null) return;
    if (typeof v === "string") {
      if (keyChain.some(k => EXPLAINS.indexOf(k) >= 0)) out.push(v);
      return;
    }
    if (Array.isArray(v)) { v.forEach(x => walk(x, keyChain)); return; }
    if (typeof v === "object") { Object.keys(v).forEach(k => walk(v[k], keyChain.concat(k))); }
  };
  walk(q, []);
  // the concept resources behind the Learn tool belong to the subject, not the question
  walk((subjectContent && subjectContent.concepts) || {}, ["explain"]);
  return out.join(" \n ").toLowerCase();
}
function teachable(q, subjectContent) {
  const text = explanatoryText(q, subjectContent);
  const vocab = vocabulary(q);
  return { yes: vocab.filter(t => text.indexOf(t) >= 0), no: vocab.filter(t => text.indexOf(t) < 0) };
}
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
    verbatim: 0, altered: 0, answerMoved: false, coverageGaps: null, acknowledged: null };
  }
  // the clock starts when the student reaches the question, not when a 1.6MB
  // test file finishes loading twice
  start() { this.t0 = Date.now(); return this; }
  at() { return Date.now() - this.t0; }
  push(kind, detail) { this.events.push({ t: this.at(), kind, detail: String(detail || "") }); return this; }
  say(kind, detail) { return this.push(kind, detail); }
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
      "  steps the app required:      " + this.m.stepsAppRequired,
      "  arguments: supplied " + this.m.suppliedArguments + ", own " + this.m.ownArguments,
      "  sentences written:           " + this.m.sentences,
      "  paragraphs completed:        " + this.m.paragraphs,
      "  prompts the app raised:      " + this.m.prompts,
      "  wrote without a concept it",
      "  needed and could have been",
      "  taught:                      " + this.m.blocked,
      "  concepts it needed that the",
      "  app never explains anywhere: " + (this.m.unexplained.length ? this.m.unexplained.join(", ") : "none"),
    ].join("\n");
  }
}
module.exports = { content, question, subjectOf, termsOf, vocabulary, teachable, Ledger, Trace };
