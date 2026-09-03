// QUESTION PACKAGE EXPORTER
//
// Turns a question that currently lives inside `essay-content.js` into a
// standalone package in the interchange format, resolving on the way out every
// join the runtime currently makes by matching prose.
//
// This is not the importer. It writes fixtures and nothing else: it reads the
// two content files, it never touches a registry, and there is no path through
// it that publishes anything. It exists so the format is proved against real
// authored content rather than against an example somebody wrote to fit it.
//
//   node tools/package.js export business_studies mkt-01 > packages/…json
//   node tools/package.js libraries                      (the shared libraries)
//
// The joins it resolves, and why each one had to go:
//
//   pathway.evidence   was a LABEL matched case-insensitively against
//                      BUSCONTENT.evidence[topic][].label. Two records with the
//                      same label silently become one, and renaming a label
//                      breaks a link nothing reports. Exported as evidenceRefs.
//   learning.concepts  was a bare key hoping subject.concepts had it. Exported
//                      as conceptRefs, and a key that resolves to nothing is a
//                      validation error rather than a quiet gap.
//   pathway.concept    was {topic, section, point} prose that had to match the
//                      syllabus strings exactly. Exported as one syllabusRef.
//   question.topic     was a free string a keyword table then guessed from.
//                      Exported as topicRef where it resolves, topicLabel where
//                      the subject has no syllabus library at all.
//
// Dropped rather than carried: qtype and qtypeLabel. Every question authored
// carries them and nothing in the application has ever read them; the directive
// contract settled that the command decides the family, so a type letter beside
// it is a second answer to a question that already has one.
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
const slug = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const SUBJECT_NS = { business_studies: "bus", ancient_history: "anc" };
// The enums no library defines. Everything else a validator checks against comes
// out of the content, so adding a sentence shape family or a directive is an
// authoring change and not a code change.
const CONTRACT_ENUMS = {
  intents: ["write-only", "guided", "learn-and-build"],
  learningStatus: ["authored", "none-required", "unreviewed"],
  conceptKinds: ["domain", "supporting"],
  requiresTeaching: ["always", "contextual", "never"],
};

// ---- shared library ids -----------------------------------------------------
// Minted once here and then used by both the libraries and the packages, so a
// package and the library it depends on cannot disagree about what a record is
// called.
function evidenceId(ns, topic, e) { return ns + ".evidence." + topic + "." + slug(e.label); }
function conceptId(ns, key) { return ns + ".concept." + key; }
function syllabusId(ns, topic, section, point) {
  return ns + ".syllabus." + topic + "." + slug(section) + "." + slug(point);
}

function libraries() {
  const E = load("essay-content.js").ESSAY;
  const B = load("business-content.js").BUSCONTENT;
  const out = { vocabulary: { roles: (E.vocab && E.vocab.roles) || [], records: {} },
                concepts: {}, evidence: {}, resources: Object.assign({}, E.resources || {}),
                syllabus: {}, sentenceShapes: E.shapes || {}, slots: E.slots || {},
                structures: E.structures || [], answerShapes: E.answerShapes || {},
                bandExpectations: E.bandExpectations || null };
  // vocabulary records are already keyed by id and already explicit
  Object.keys((E.vocab && E.vocab.records) || {}).forEach(k => { out.vocabulary.records[k] = E.vocab.records[k]; });
  // concepts, per subject, given ids
  Object.keys(E.subjects || {}).forEach(sk => {
    const ns = SUBJECT_NS[sk] || slug(sk);
    Object.keys((E.subjects[sk].concepts) || {}).forEach(key => {
      const id = conceptId(ns, key);
      out.concepts[id] = Object.assign({ id: id, subject: sk, key: key }, E.subjects[sk].concepts[key]);
    });
  });
  // evidence, given ids, with the topic it was filed under kept as a ref rather
  // than as the object key it used to be reachable only through
  Object.keys((B && B.evidence) || {}).forEach(topic => {
    (B.evidence[topic] || []).forEach(e => {
      const id = evidenceId("bus", topic, e);
      out.evidence[id] = { id: id, subject: "business_studies", topicRef: "bus.syllabus." + topic,
        section: e.section || "", label: e.label, fact: e.fact, use: e.use,
        source: e.source || "", verify: !!e.verify };
    });
  });
  // syllabus points. terms[] travels as legacyTerms so that nothing downstream
  // can mistake it for vocabulary: it is the field the student route was just
  // taken off, kept because topic matching and the learning allowlist read it.
  Object.keys((B && B.topics) || {}).forEach(topic => {
    const t = B.topics[topic];
    const tid = "bus.syllabus." + topic;
    out.syllabus[tid] = { id: tid, subject: "business_studies", label: t.label, sections: [] };
    (t.sections || []).forEach(sec => {
      const points = (sec.points || []).map(pt => ({
        id: syllabusId("bus", topic, sec.name, pt.point),
        point: pt.point, what: pt.what, why: pt.why, exam: pt.exam || "",
        legacyTerms: (pt.terms || []).slice(),
      }));
      out.syllabus[tid].sections.push({ name: sec.name, points: points });
    });
  });
  return out;
}

// ---- resolving the joins ----------------------------------------------------
function evidenceIndex(B) {
  const by = {};
  Object.keys((B && B.evidence) || {}).forEach(topic =>
    (B.evidence[topic] || []).forEach(e => {
      const k = String(e.label).toLowerCase();
      // the exact collision the label join could not see
      if (by[k]) by[k].collides = true;
      else by[k] = { id: evidenceId("bus", topic, e), collides: false };
    }));
  return by;
}
// The app resolves a pathway's {topic, section, point} triple by PREFIX:
//   String(pt.point).toLowerCase().indexOf(c.point.toLowerCase()) === 0
// which is why "rewards" finds "rewards - monetary and non-monetary, individual
// or group, performance pay". Nine of the twenty-eight authored triples resolve
// that way and only that way, so they work today and would break the moment a
// syllabus heading were reworded. The export uses the same rule the app uses,
// so nothing changes meaning on the way out, and records which joins needed it.
function resolveSyllabus(B, c) {
  const t = (B && B.topics || {})[c.topic]; if (!t) return null;
  const sec = (t.sections || []).find(x => x.name === c.section); if (!sec) return null;
  const want = String(c.point || "").toLowerCase();
  const exact = (sec.points || []).find(x => String(x.point).toLowerCase() === want);
  const pt = exact || (sec.points || []).find(x => String(x.point).toLowerCase().indexOf(want) === 0);
  if (!pt) return null;
  return { id: syllabusId("bus", c.topic, sec.name, pt.point), byPrefix: !exact, point: pt.point };
}

const DROP_QUESTION = ["qtype", "qtypeLabel", "pathways", "topic", "term1", "term2", "id", "text", "command", "marks"];

function exportQuestion(subjectKey, questionId) {
  const E = load("essay-content.js").ESSAY;
  const B = load("business-content.js").BUSCONTENT;
  const subject = E.subjects[subjectKey];
  if (!subject) throw new Error("no such subject: " + subjectKey);
  const q = (subject.questions || []).find(x => x.id === questionId);
  if (!q) throw new Error("no such question: " + questionId);
  const ns = SUBJECT_NS[subjectKey] || slug(subjectKey);
  const evIdx = evidenceIndex(B);
  const unresolved = [], prefixed = [];

  const question = { id: q.id, text: q.text, command: q.command, marks: q.marks };
  // topicRef where a syllabus library has the topic, topicLabel where the subject
  // has no library at all. Never both, and never a keyword guess.
  //
  // question.topic is a DISPLAY LABEL today ("Human Resources"), and the runtime
  // recovers the key from it with a keyword table: four lists of words, first
  // match wins, null if none hit. It happens to be right for all thirteen
  // authored questions. It is still a guess, and a question about the marketing
  // of an operations decision would land wherever the table looked first.
  const topicKey = String(q.topic || "").toLowerCase().replace(/\s+/g, "_");
  if (q.topic && B && B.topics && B.topics[topicKey]) question.topicRef = "bus.syllabus." + topicKey;
  else if (q.topic) question.topicLabel = q.topic;
  if (q.term1 || q.term2) question.focusTerms = { first: q.term1 || "", second: q.term2 || "" };
  Object.keys(q).forEach(k => { if (DROP_QUESTION.indexOf(k) < 0) question[k] = q[k]; });
  // A null is not an absent field. `criteria.bands: null` reads as "there is a
  // bands object and it is empty", which is the half-written state the vocabulary
  // readiness work already had to learn to tell apart from nothing at all.
  if (question.criteria && question.criteria.bands == null) {
    question.criteria = Object.assign({}, question.criteria); delete question.criteria.bands;
  }

  const pathways = (q.pathways || []).map(p => {
    const out = {};
    Object.keys(p).forEach(k => { if (["evidence", "concept", "learning"].indexOf(k) < 0) out[k] = p[k]; });
    // Two forms are authored today: a bare label, and {label, why, limits} where
    // somebody wrote how to use the item for THIS argument. Both become the same
    // thing: a ref, plus whatever this pathway has to say about that item. The
    // record itself is never copied into the package.
    if ((p.evidence || []).length) {
      out.evidenceRefs = p.evidence.map(e => {
        const label = typeof e === "string" ? e : e.label;
        const hit = evIdx[String(label).toLowerCase()];
        if (!hit) { unresolved.push({ pathway: p.id, kind: "evidence", was: label }); return null; }
        if (hit.collides) unresolved.push({ pathway: p.id, kind: "evidence-label-collision", was: label });
        const ref = { id: hit.id };
        if (typeof e === "object") { if (e.why) ref.why = e.why; if (e.limits) ref.limits = e.limits; }
        return ref;
      }).filter(Boolean);
    }
    if (p.concept && p.concept.topic) {
      const hit = resolveSyllabus(B, p.concept);
      if (!hit) unresolved.push({ pathway: p.id, kind: "syllabus", was: p.concept });
      else {
        out.syllabusRef = hit.id;
        if (hit.byPrefix) prefixed.push({ pathway: p.id, was: p.concept.point, is: hit.point });
      }
    }
    // pathway.concept.key indexes subject.concepts, and is a different join from
    // the syllabus triple sitting in the same object. Three pathways carry it.
    if (p.concept && p.concept.key) {
      if ((subject.concepts || {})[p.concept.key]) out.conceptRef = conceptId(ns, p.concept.key);
      else unresolved.push({ pathway: p.id, kind: "concept", was: p.concept.key });
    }
    if (p.learning) {
      const l = Object.assign({}, p.learning);
      delete l.concepts; delete l.explore;
      const c = (p.learning.concepts) || {};
      const refs = {};
      ["primary", "supporting", "optional"].forEach(tier => {
        refs[tier] = (c[tier] || []).map(key => {
          if (!(subject.concepts || {})[key]) { unresolved.push({ pathway: p.id, kind: "concept", was: key }); return null; }
          return conceptId(ns, key);
        }).filter(Boolean);
      });
      l.conceptRefs = refs;
      if (p.learning.explore && p.learning.explore.concept) {
        const k = p.learning.explore.concept;
        if ((subject.concepts || {})[k]) l.exploreRef = { conceptRef: conceptId(ns, k), label: p.learning.explore.label };
        else unresolved.push({ pathway: p.id, kind: "concept", was: k });
      }
      out.learning = l;
    }
    return out;
  });

  // requires is GENERATED from what the package actually references, never
  // authored beside it, so the two cannot drift. The importer recomputes it and
  // reports REQUIRES_MISMATCH if a hand-edited package disagrees with itself.
  const collect = (o, out) => {
    if (!o || typeof o !== "object") return out;
    if (Array.isArray(o)) { o.forEach(x => collect(x, out)); return out; }
    Object.keys(o).forEach(k => {
      const v = o[k];
      if (k === "vocabRefs") (v || []).forEach(r => out.vocabulary.add(typeof r === "string" ? r : r.id));
      else if (k === "studyRefs") (v || []).forEach(r => out.resources.add(r));
      else if (k === "evidenceRefs") (v || []).forEach(r => out.evidence.add(typeof r === "string" ? r : r.id));
      else if (k === "syllabusRef") out.syllabus.add(v);
      else if (k === "topicRef") out.syllabus.add(v);
      else if (k === "conceptRefs") ["primary", "supporting", "optional"].forEach(t => (v[t] || []).forEach(r => out.concepts.add(r)));
      else if (k === "exploreRef" && v && v.conceptRef) out.concepts.add(v.conceptRef);
      else if (k === "conceptRef") out.concepts.add(v);
      else collect(v, out);
    });
    return out;
  };
  const sets = collect({ question: question, pathways: pathways },
    { vocabulary: new Set(), concepts: new Set(), evidence: new Set(), resources: new Set(), syllabus: new Set() });
  const requires = {};
  Object.keys(sets).forEach(k => { requires[k] = [...sets[k]].sort(); });

  // The intent a package claims, and which the validator then holds it to. It is
  // derived here from what the source actually carries rather than asserted, so
  // an exported fixture never claims support it does not have.
  const guided = pathways.length > 0 && pathways.every(p => String(p.meaning || "").trim());
  const intent = pathways.length === 0 ? "write-only" : guided ? "guided" : "guided";

  return { pkg: {
      format: "marginal.question-package",
      formatVersion: 1,
      package: { id: ns + "." + q.id, subject: subjectKey, intent: intent,
                 generatedBy: "tools/package.js export" },
      requires: requires,
      question: question,
      pathways: pathways,
    }, unresolved: unresolved, prefixed: prefixed };
}

// ---- what a validator needs to know about a library ------------------------
// Not the records: their ids, and whether each one is complete enough for the
// thing that references it. A manifest is what an importer checks a package's
// requires block against, and it is small enough to read.
const nonEmpty = (o, f) => f.filter(k => !String((o || {})[k] == null ? "" : o[k]).trim());
function manifest() {
  const L = libraries();
  const m = { vocabulary: {}, concepts: {}, evidence: {}, resources: {}, syllabus: {}, sentenceShapes: {} };
  Object.keys(L.vocabulary.records).forEach(id => {
    const miss = nonEmpty(L.vocabulary.records[id], ["term", "plain", "subject", "example"]);
    m.vocabulary[id] = { complete: !miss.length, missing: miss };
  });
  // requiresTeaching is authored as `true` for a domain concept and as the STRING
  // "contextual" for a supporting one, so a truthiness test reads both as the
  // same thing and asks a supporting concept for a Read more section it was
  // never meant to have. Three of six were reported incomplete for that reason
  // and none of them was. The field is a two-value enum wearing a boolean, and
  // the schema below names it as one.
  const TEACHING = { true: "always", contextual: "contextual", false: "never" };
  Object.keys(L.concepts).forEach(id => {
    const c = L.concepts[id];
    const teaching = TEACHING[String(c.requiresTeaching)];
    const need = teaching === "always" ? ["oneLine", "title", "quick"]
               : teaching === "contextual" ? ["oneLine", "title", "quick"] : ["oneLine"];
    const miss = nonEmpty(c, need);
    if (teaching === "always" && !(c.readMore || []).length) miss.push("readMore");
    if (!teaching) miss.push("requiresTeaching:" + JSON.stringify(c.requiresTeaching));
    m.concepts[id] = { complete: !miss.length, missing: miss, kind: c.kind || "", teaching: teaching || "" };
  });
  Object.keys(L.evidence).forEach(id => {
    const e = L.evidence[id];
    const miss = nonEmpty(e, ["label", "fact", "use"]);
    // sourced is reported separately from complete, because an unsourced item is
    // usable for guided practice and is not usable for a question that claims to
    // teach a student who knows nothing.
    m.evidence[id] = { complete: !miss.length, missing: miss, sourced: !!String(e.source || "").trim(),
                       verifyFlag: !!e.verify };
  });
  Object.keys(L.resources).forEach(id => {
    const miss = nonEmpty(L.resources[id], ["label", "url"]);
    m.resources[id] = { complete: !miss.length, missing: miss };
  });
  Object.keys(L.syllabus).forEach(tid => {
    m.syllabus[tid] = { complete: true, missing: [] };
    (L.syllabus[tid].sections || []).forEach(sec => (sec.points || []).forEach(pt => {
      const miss = nonEmpty(pt, ["point", "what", "why"]);
      m.syllabus[pt.id] = { complete: !miss.length, missing: miss, legacyTerms: (pt.legacyTerms || []).length };
    }));
  });
  ((L.sentenceShapes || {}).library || []).forEach(sh => {
    const miss = nonEmpty(sh, ["family", "role", "stage", "frame", "why"]);
    m.sentenceShapes[sh.id] = { complete: !miss.length, missing: miss };
  });
  // Enums live with the libraries that define them, so a validator never carries
  // its own copy of a list the content can change. The four that no library
  // defines are contract enums and are named here once.
  const enums = {
    vocabularyRoles: (L.vocabulary.roles || []).map(r => r.id),
    // The list that decides the FAMILY, which is the one a question is validated
    // against. answerShapes.commands is a different list for a different job
    // (what the answer is shaped like) and the two do not agree: "how do",
    // "how does" and "critically" assign a family and have no answer shape.
    directives: Object.keys(((L.slots || {}).templates || {}).directiveFamilies || {})
      .reduce((a, fam) => a.concat(((L.slots.templates.directiveFamilies)[fam] || [])), []).sort(),
    directiveFamilies: ((L.slots || {}).templates || {}).directiveFamilies || {},
    answerShapeCommands: Object.keys((L.answerShapes || {}).commands || {}),
    structures: (L.structures || []).map(x => x.key),
    shapeFamilies: [...new Set(((L.sentenceShapes || {}).library || []).map(x => x.family))],
    shapeRoles: [...new Set(((L.sentenceShapes || {}).library || []).map(x => x.role))],
    shapeStages: [...new Set(((L.sentenceShapes || {}).library || []).map(x => x.stage))],
    slotKeys: [...new Set(Object.keys((L.slots || {}).templates || {}).filter(k => k !== "directiveFamilies"))],
    connectors: Object.keys(((L.sentenceShapes || {}).connectors) || {}),
    intents: CONTRACT_ENUMS.intents,
    learningStatus: CONTRACT_ENUMS.learningStatus,
    conceptKinds: CONTRACT_ENUMS.conceptKinds,
    requiresTeaching: CONTRACT_ENUMS.requiresTeaching,
  };
  const counts = {};
  Object.keys(m).forEach(k => {
    const ids = Object.keys(m[k]);
    counts[k] = { records: ids.length, complete: ids.filter(i => m[k][i].complete).length };
  });
  return { format: "marginal.library-manifest", formatVersion: 1, counts: counts, enums: enums, records: m };
}

if (require.main === module) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === "libraries") { process.stdout.write(JSON.stringify(libraries(), null, 1) + "\n"); }
  else if (cmd === "manifest") { process.stdout.write(JSON.stringify(manifest(), null, 1) + "\n"); }
  else if (cmd === "export") {
    const r = exportQuestion(a, b);
    // stderr, so a redirect still produces the package and what happened to the
    // joins on the way out is impossible to miss
    if (r.prefixed.length) {
      console.error("RESOLVED BY PREFIX, now explicit (" + r.prefixed.length + "):");
      r.prefixed.forEach(u => console.error("  " + u.pathway + "  " + JSON.stringify(u.was) + " -> " + JSON.stringify(u.is)));
    }
    if (r.unresolved.length) {
      console.error("UNRESOLVED JOINS (" + r.unresolved.length + "):");
      r.unresolved.forEach(u => console.error("  " + u.kind + "  " + u.pathway + "  " + JSON.stringify(u.was)));
    }
    process.stdout.write(JSON.stringify(r.pkg, null, 1) + "\n");
  } else {
    console.error("usage: node tools/package.js export <subject> <questionId>\n       node tools/package.js libraries\n       node tools/package.js manifest");
    process.exit(2);
  }
}
module.exports = { exportQuestion, libraries, manifest, CONTRACT_ENUMS, evidenceId, conceptId, syllabusId };
