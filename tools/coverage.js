// SUPPORT COVERAGE
//
// The architecture is now able to promise a zero-knowledge student more than the
// authored content can deliver. A pathway label can say "servicescape" while
// nothing in the app explains what a servicescape is, and until this file
// existed nothing said so out loud.
//
// This measures, per question, what a student can actually be given:
//
//   concepts    a term the interface SHOWS, against whether anything EXPLAINS it
//   guidance    pathways carrying their own meaning
//   ladders     pathways carrying a help ladder deep enough to be climbed
//   evidence    pathways with at least one linked item that has a checked source
//   recovery    whether the question can notice an argument running the wrong way
//
// and turns that into a readiness level, so a question is never described as
// more supported than it is.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.resolve(__dirname, "..");

function load(file) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), sandbox);
  return sandbox.window;
}

// ---- the vocabulary a question puts in front of a student -------------------
const STOP = new Set(("the a an and or of to in on for by with its it their this that as at from is are be " +
  "how what which where when why more less than into over under about through can could will would should " +
  "business businesses staff people customers market markets thing things part parts way ways").split(" "));
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
// A term is EXPLAINED only where an explaining field mentions it. A label that
// prints the word does not teach it, and counting it as taught is exactly the
// self-deception this file exists to prevent.
const EXPLAINS = ["meaning", "whatToProve", "commonMistake", "guides", "hint", "needs",
  "direction", "frame", "starter", "example", "explain", "quick", "readMore", "confusions",
  "note", "text", "job", "why", "use", "fact"];
function explanatoryText(q, subject) {
  const out = [];
  const walk = (v, chain) => {
    if (v == null) return;
    if (typeof v === "string") { if (chain.some(k => EXPLAINS.indexOf(k) >= 0)) out.push(v); return; }
    if (Array.isArray(v)) { v.forEach(x => walk(x, chain)); return; }
    if (typeof v === "object") Object.keys(v).forEach(k => walk(v[k], chain.concat(k)));
  };
  walk(q, []);
  walk((subject && subject.concepts) || {}, ["explain"]);
  return out.join(" \n ").toLowerCase();
}
function teachable(q, subject) {
  const text = explanatoryText(q, subject);
  const vocab = vocabulary(q);
  return { yes: vocab.filter(t => text.indexOf(t) >= 0), no: vocab.filter(t => text.indexOf(t) < 0) };
}

// ---- what each pathway carries ----------------------------------------------
// A ladder is "full" at five rungs or more, which is what the help control can
// actually show. Fewer is a ladder a student runs off the end of.
const FULL_LADDER = 5;
function evidenceIndex(bus) {
  const by = {};
  Object.keys((bus && bus.evidence) || {}).forEach(topic => {
    (bus.evidence[topic] || []).forEach(e => { by[String(e.label).toLowerCase()] = e; });
  });
  return by;
}
function questionRow(q, subject, evIndex) {
  const paths = q.pathways || [];
  const t = teachable(q, subject);
  const withMeaning = paths.filter(p => String(p.meaning || "").trim()).length;
  const ladder = paths.map(p => Object.keys(p.help || {}).length);
  const full = ladder.filter(n => n >= FULL_LADDER).length;
  const some = ladder.filter(n => n > 0 && n < FULL_LADDER).length;
  const sourced = paths.filter(p => (p.evidence || []).some(e => {
    const item = evIndex[String(e.label || "").toLowerCase()];
    return item && String(item.source || "").trim();
  })).length;
  const linked = paths.filter(p => (p.evidence || []).length).length;
  const row = {
    id: q.id,
    mode: (q.coreAnswer && q.coreAnswer.mode) || "causal",
    pathways: paths.length,
    conceptsNamed: t.yes.length + t.no.length,
    conceptsExplained: t.yes.length,
    unexplained: t.no,
    guidance: withMeaning,
    laddersFull: full,
    laddersPartial: some,
    evidenceLinked: linked,
    evidenceSourced: sourced,
    recovery: !!q.reasoning,
  };
  row.readiness = readinessOf(row);
  return row;
}
// Thresholds by mode. A question can be perfectly usable for independent
// practice and nowhere near ready to carry a student who knows nothing, and
// saying so is the whole point.
function readinessOf(r) {
  const guided = r.pathways > 0 && r.guidance === r.pathways;
  const learn = guided
    && r.conceptsExplained === r.conceptsNamed
    && r.laddersFull === r.pathways
    && r.evidenceSourced === r.pathways
    && r.recovery;
  if (learn) return "Learn & Build";
  if (guided) return "Guided practice";
  return "Independent practice";
}

function report() {
  const E = load("essay-content.js").ESSAY;
  const bus = load("business-content.js").BUSCONTENT;
  const evIndex = evidenceIndex(bus);
  const rows = [];
  Object.keys(E.subjects || {}).forEach(key => {
    const subject = E.subjects[key];
    (subject.questions || []).forEach(q => {
      if (!(q.pathways || []).length) return;      // nothing to be ready FOR yet
      rows.push(Object.assign({ subject: key }, questionRow(q, subject, evIndex)));
    });
  });
  return rows;
}
const frac = (a, b) => a + "/" + b;
function format(rows) {
  const out = ["# Support coverage", "",
    "Generated by `node tools/coverage.js`. Nothing here is a target to be edited;",
    "it is what the authored content currently supports.", "",
    "A concept counts as **explained** only where an explaining field mentions it.",
    "A label that prints the word does not teach it.", "",
    "| question | mode | pathways | concepts explained | guidance | full ladders | sourced evidence | wrong-turn recovery | readiness |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
  rows.forEach(r => out.push("| `" + r.id + "` | " + r.mode + " | " + r.pathways + " | " +
    frac(r.conceptsExplained, r.conceptsNamed) + " | " + frac(r.guidance, r.pathways) + " | " +
    frac(r.laddersFull, r.pathways) + " | " + frac(r.evidenceSourced, r.pathways) + " | " +
    (r.recovery ? "yes" : "no") + " | " + r.readiness + " |"));
  out.push("");
  out.push("## Named in the interface, explained nowhere");
  out.push("");
  out.push("Each of these is a word a student can be shown while nothing in the app");
  out.push("can tell them what it means. They are the first thing to author.");
  out.push("");
  rows.forEach(r => {
    if (!r.unexplained.length) { out.push("- `" + r.id + "`: none"); return; }
    out.push("- `" + r.id + "` (" + r.unexplained.length + "): " + r.unexplained.map(x => "`" + x + "`").join(", "));
  });
  out.push("");
  return out.join("\n");
}
function summary(rows) {
  const p = rows.reduce((n, r) => n + r.pathways, 0);
  const l = rows.reduce((n, r) => n + r.laddersFull, 0);
  const c = rows.reduce((n, r) => n + (r.conceptsNamed - r.conceptsExplained), 0);
  const e = rows.reduce((n, r) => n + r.evidenceSourced, 0);
  const ready = rows.filter(r => r.readiness === "Learn & Build").length;
  return "support: " + frac(l, p) + " pathways carry a full ladder, " + frac(e, p) + " have sourced evidence, " +
    c + " concepts are named but never explained, " + frac(ready, rows.length) + " questions are Learn & Build ready";
}
module.exports = { report, format, summary, teachable, vocabulary, termsOf, readinessOf, FULL_LADDER };
if (require.main === module) {
  const rows = report();
  console.log(format(rows));
  console.log(summary(rows));
}
