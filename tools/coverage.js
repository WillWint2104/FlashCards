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
// Ordinary English used inside an argument is not a teaching dependency. It is
// listed by an author, not guessed at, because an "explain everything
// unexplained" target would otherwise push the pack towards a dictionary.
function teachable(q, subject) {
  const text = explanatoryText(q, subject);
  const ordinary = ((subject && subject.vocabulary && subject.vocabulary.ordinary) || []);
  const vocab = vocabulary(q).filter(t => ordinary.indexOf(t) < 0);
  return { yes: vocab.filter(t => text.indexOf(t) >= 0), no: vocab.filter(t => text.indexOf(t) < 0),
           ordinary: vocabulary(q).filter(t => ordinary.indexOf(t) >= 0) };
}

// Three different failures that all look like "missing content" from outside.
//   authored     does the concept exist in the pack at all
//   declared     does this pathway say it depends on it
//   reachable    both, so a student on this pathway can be given it
function routing(q, subject) {
  const store = (subject && subject.concepts) || {};
  const rows = [];
  (q.pathways || []).forEach(pw => {
    const L = pw.learning;
    const st = (L || {}).status || "unreviewed";
    if (st !== "authored") { rows.push({ id: pw.id, short: pw.short, declared: null, status: st }); return; }
    const c = (L.concepts) || {};
    const ids = [].concat(c.primary || [], c.supporting || [], c.optional || []);
    rows.push({ id: pw.id, short: pw.short, status: st, declared: ids.length,
                authored: ids.filter(x => store[x]).length,
                reachable: ids.filter(x => store[x] && (store[x].oneLine || store[x].quick)).length });
  });
  const unreachable = Object.keys(store).filter(id => {
    if (store[id].requiresTeaching !== true) return false;
    return !(q.pathways || []).some(pw => {
      const c = (pw.learning && pw.learning.status === "authored" && pw.learning.concepts) || {};
      return [].concat(c.primary || [], c.supporting || [], c.optional || []).indexOf(id) >= 0;
    });
  });
  return { rows: rows, unreachable: unreachable };
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
  // a pathway is only supported for a student who knows nothing if choosing it
  // opens something that teaches it
  const lessons = paths.filter(p => (p.learning || {}).status === "authored").length;
  const reviewed = paths.filter(p => ["authored", "none-required"].indexOf((p.learning || {}).status) >= 0).length;
  // A pathway leaning on five or six primary concepts is an authoring smell:
  // either the argument is too big or some of it belongs in supporting.
  const heavy = paths.filter(p => (((p.learning || {}).concepts || {}).primary || []).length >= 5)
    .map(p => p.id + " (" + ((p.learning.concepts.primary || []).length) + ")");
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
    lessons: lessons,
    reviewed: reviewed,
    heavy: heavy,
    laddersFull: full,
    laddersPartial: some,
    evidenceLinked: linked,
    evidenceSourced: sourced,
    recovery: !!q.reasoning,
    ordinary: t.ordinary,
    routing: routing(q, subject),
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
    && r.lessons === r.pathways
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
    // Legacy subjects are excluded from readiness. A subject nobody is authoring
    // drags every denominator down while representing no work anyone intends to
    // do, which makes the active product look further away than it is. Excluded
    // explicitly rather than incidentally, so adding a pathway to a legacy
    // subject cannot silently pull it back into the launch measure.
    if (subject && subject.activeProduct === false) return;
    (subject.questions || []).forEach(q => {
      if (!(q.pathways || []).length) return;      // nothing to be ready FOR yet
      rows.push(Object.assign({ subject: key }, questionRow(q, subject, evIndex)));
    });
  });
  return rows;
}
// Named so the report can say what it left out. A silent exclusion is how a
// measure starts lying by omission.
function excluded() {
  const E = load("essay-content.js").ESSAY;
  return Object.keys(E.subjects || {})
    .filter(k => E.subjects[k] && E.subjects[k].activeProduct === false)
    .map(k => ({ key: k, label: E.subjects[k].label || k, status: E.subjects[k].status || "legacy",
                 questions: (E.subjects[k].questions || []).length }));
}
const frac = (a, b) => a + "/" + b;
function format(rows) {
  const out = ["# Support coverage", "",
    "Generated by `node tools/coverage.js`. Nothing here is a target to be edited;",
    "it is what the authored content currently supports.", ""];
  const skipped = excluded();
  if (skipped.length) {
    out.push("Excluded from readiness, because no one is authoring them and counting",
      "them makes the active product look further away than it is:", "");
    skipped.forEach(s => out.push("* **" + s.label + "** (`" + s.key + "`), " + s.status +
      ", " + s.questions + " question" + (s.questions === 1 ? "" : "s")));
    out.push("");
  }
  out.push(
    "A concept counts as **explained** only where an explaining field mentions it.",
    "A label that prints the word does not teach it.", "",
    "| question | mode | pathways | concepts explained | guidance | pathway lessons | full ladders | sourced evidence | wrong-turn recovery | readiness |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  rows.forEach(r => out.push("| `" + r.id + "` | " + r.mode + " | " + r.pathways + " | " +
    frac(r.conceptsExplained, r.conceptsNamed) + " | " + frac(r.guidance, r.pathways) + " | " +
    frac(r.lessons, r.pathways) + " | " +
    frac(r.laddersFull, r.pathways) + " | " + frac(r.evidenceSourced, r.pathways) + " | " +
    (r.recovery ? "yes" : "no") + " | " + r.readiness + " |"));
  out.push("");
  out.push("## Can this pathway deliver what it depends on?");
  out.push("");
  out.push("Content existing somewhere in the pack is irrelevant to a student on a");
  out.push("pathway that cannot surface it. The chain runs:");
  out.push("");
  out.push("| stage | question | measured by |");
  out.push("| --- | --- | --- |");
  out.push("| **declared** | do we know what this pathway depends on | this table |");
  out.push("| **authored** | is there material that teaches it | this table |");
  out.push("| **reachable** | can this pathway surface that material | this table |");
  out.push("| **delivered** | did the canonical novice journey actually get it | `tests/bots` |");
  out.push("| **applied** | did the learner then use it | `tests/bots`, the transfer probe |");
  out.push("");
  out.push("`unreviewed` means nobody has yet decided what the pathway depends on.");
  out.push("It is never a claim that it depends on nothing.");
  out.push("");
  rows.forEach(r => {
    const declared = r.routing.rows.filter(x => x.declared != null);
    out.push("### `" + r.id + "`");
    out.push("");
    out.push("| pathway | state | concepts declared | authored | reachable here |");
    out.push("| --- | --- | --- | --- | --- |");
    r.routing.rows.forEach(x => out.push("| `" + x.id + "` | " + x.status + " | " +
      (x.declared == null ? "-" : x.declared) + " | " +
      (x.declared == null ? "-" : x.authored) + " | " +
      (x.declared == null ? "-" : x.reachable) + " |"));
    out.push("");
    if (r.heavy.length) { out.push("High primary dependency count, worth a human look: " + r.heavy.join(", ")); out.push(""); }
    if (r.routing.unreachable.length) {
      out.push("Authored, requires teaching, and no pathway here declares it: " +
        r.routing.unreachable.map(x => "`" + x + "`").join(", "));
      out.push("");
    }
    out.push("Reviewed: " + r.reviewed + " of " + r.routing.rows.length + ". Authored lessons: " + declared.length + ".");
    out.push("");
  });
  out.push("## Named in the interface, explained nowhere");
  out.push("");
  out.push("Words a student can be shown while nothing in the app can tell them what");
  out.push("they mean. Ordinary English is excluded by the authored");
  out.push("`vocabulary.ordinary` list rather than by guesswork, so this is a list of");
  out.push("teaching dependencies and not of unfamiliar tokens.");
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
  const s = rows.reduce((n, r) => n + r.lessons, 0);
  const d = rows.reduce((n, r) => n + r.reviewed, 0);
  return "support: " + frac(d, p) + " pathways reviewed, " + frac(s, p) + " teach themselves, " + frac(l, p) + " carry a full ladder, " + frac(e, p) + " have sourced evidence, " +
    c + " concepts are named but never explained, " + frac(ready, rows.length) + " questions are Learn & Build ready";
}
module.exports = { report, excluded, format, summary, teachable, vocabulary, termsOf, readinessOf, FULL_LADDER };
if (require.main === module) {
  const rows = report();
  console.log(format(rows));
  console.log(summary(rows));
}
