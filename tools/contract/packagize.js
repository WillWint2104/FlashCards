// DESIGN-TIME TRANSFORM, NOT THE IMPORTER.
//
// Converts a question authored in source into a QuestionPackage v1, so the
// format is checked against real content rather than against an illustration.
// It reads the two content files and writes only into docs/contract/. Nothing
// in the application calls it, and there is no path through it that publishes.
//
//   node tools/contract/packagize.js            every question in the bank
//   node tools/contract/packagize.js mkt-01     one
//
// Where a value cannot be carried across without inventing something, it is
// recorded under UNMAPPED and left null. An empty unmapped list is the claim
// that the format covers the question; a non-empty one is work the contract
// creates rather than a question it leaves open.
//
// The four prose joins it resolves on the way out, all of which are live in the
// application and none of which is expressible in the format:
//
//   evidence   a display LABEL matched case-insensitively
//   concept    a {topic, section, point} triple matched by PREFIX
//   learning   a bare key hoping subject.concepts has it
//   topic      a display label a keyword table guesses the key from
const fs = require("fs");
const path = require("path");
const lib = require("./libraries.js");
const { id, ns, slug } = lib;
const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.join(ROOT, "docs", "contract");

const TOPIC_NS = { operations: "operations", marketing: "marketing", finance: "finance", human_resources: "hr" };

// help.<slot> is a five rung escalating ladder, not a bag of strings: each rung
// gives more than the one before it, so order is the meaning.
function ladderFor(h) {
  if (!h) return [];
  const out = [];
  if (h.hint) out.push({ rung: "hint", text: h.hint });
  if (h.needs) out.push({ rung: "needs", text: h.needs });
  if (h.direction && h.direction.text) out.push({ rung: "direction", text: h.direction.text });
  else if (h.frame && h.frame.text) out.push({ rung: "frame", text: h.frame.text });
  if (h.starter && h.starter.text) out.push({ rung: "starter", text: h.starter.text });
  if (h.example && h.example.text) out.push({ rung: "example", context: h.example.context || null,
    text: h.example.text, pattern: h.example.pattern || null });
  return out;
}
// guides.<slot> is one line always shown; help.<slot> is the ladder behind it.
// Two fields for one idea become one field with two depths.
function guidanceFor(source) {
  const slots = new Set(Object.keys(source.guides || {}).concat(Object.keys(source.help || {})));
  const out = {};
  [...slots].forEach(s => {
    const entry = {};
    if (source.guides && source.guides[s]) entry.direct = source.guides[s];
    const ladder = ladderFor(source.help && source.help[s]);
    if (ladder.length) entry.ladder = ladder;
    out[s] = entry;
  });
  return out;
}

function packagize(qid) {
  const { libraries: L, evAlias, E, B } = lib.build();
  let subjectKey = null, q = null;
  Object.keys(E.subjects).forEach(sk => (E.subjects[sk].questions || []).forEach(x => {
    if (x.id === qid) { subjectKey = sk; q = x; }
  }));
  if (!q) throw new Error("no such question: " + qid);
  const n = ns(subjectKey);
  const unmapped = [], migrated = [];

  // The keyword table the engine uses is not carried across. The label is
  // normalised to a key and the key must exist, or the question carries a label
  // and no ref and nothing guesses.
  const topicKey = String(q.topic || "").toLowerCase().replace(/\s+/g, "_");
  const hasTopic = !!(B && B.topics && B.topics[topicKey]);
  if (q.topic && hasTopic) migrated.push("topic: display label " + JSON.stringify(q.topic) + " -> " + id.topic("business", topicKey));

  const judgement = ((q.coreAnswer || {}).mode === "judgement");
  const areaIds = {};
  Object.keys(q.areas || {}).forEach(k => { areaIds[k] = slug(k); });

  // A plan line's relationship becomes explicit structure. The left end is
  // authored. The right end needs a criterion registry that does not exist, so
  // it is left null and counted rather than invented.
  const claims = (q.plan || []).map((line, i) => {
    const bits = String(line).split(/\s+to\s+/i);
    const left = bits[0].trim();
    const rights = bits.length < 2 ? [] : bits[1].split(/\s*(?:,|and)\s*/).map(x => x.trim()).filter(Boolean);
    if (!rights.length) unmapped.push("plan line " + (i + 1) + " states no right-hand end: " + JSON.stringify(String(line)));
    rights.forEach(r => unmapped.push("criterion " + JSON.stringify(r) + " has no id: no criterion registry exists"));
    return { id: q.id + "-claim-" + (i + 1), line: String(line),
      left: { label: left, conceptRef: null },
      relation: judgement ? "affects" : "shapes",
      right: rights.map(r => ({ label: r, criterionRef: null })), pathwayRefs: [] };
  });

  function syllabusRefFor(c, where) {
    if (!c || !c.topic) return null;
    const t = (B.topics || {})[c.topic]; if (!t) { unmapped.push(where + ": topic " + JSON.stringify(c.topic) + " resolves to nothing"); return null; }
    const sec = (t.sections || []).find(s => s.name === c.section);
    if (!sec) { unmapped.push(where + ": section " + JSON.stringify(c.section) + " resolves to nothing"); return null; }
    const want = String(c.point || "").toLowerCase();
    const exact = (sec.points || []).find(x => String(x.point).toLowerCase() === want);
    const pt = exact || (sec.points || []).find(x => String(x.point).toLowerCase().indexOf(want) === 0);
    if (!pt) { unmapped.push(where + ": point " + JSON.stringify(c.point) + " resolves to nothing"); return null; }
    if (!exact) migrated.push(where + ": prefix join " + JSON.stringify(c.point) + " -> " + JSON.stringify(pt.point));
    return id.point("business", c.topic, sec.name, pt.point);
  }

  const pathways = (q.pathways || []).map(pw => {
    const out = { id: pw.id, areaRef: pw.area ? (areaIds[pw.area] || slug(pw.area)) : null,
      short: pw.short, adds: pw.adds || null, relationship: pw.relationship,
      // fromLabel was never presentational: the engine carries an explicit rule
      // that it is never derived from short or relationship.
      left: pw.fromLabel ? { label: pw.fromLabel, conceptRef: null } : null,
      choiceMeaning: pw.meaning || null,
      whatToProve: pw.whatToProve || null, commonMistake: pw.commonMistake || null,
      mechanism: pw.mechanism
        ? { status: pw.mechanism.state || pw.mechanism.status || "unreviewed",
            text: pw.mechanism.text || null, note: pw.mechanism.note || null }
        : { status: "unreviewed", text: null, note: null },
      conceptRef: null, syllabusRef: syllabusRefFor(pw.concept, pw.id),
      learningRef: null, learning: { status: (pw.learning || {}).status || "unreviewed" },
      evidenceRefs: [], vocabRefs: [], guidance: guidanceFor(pw) };

    if (pw.concept && pw.concept.key) {
      const cid = id.concept(n, pw.concept.key);
      if (L.concepts[cid]) { out.conceptRef = cid; migrated.push(pw.id + ": concept key " + JSON.stringify(pw.concept.key) + " -> " + cid); }
      else unmapped.push(pw.id + ": concept key " + JSON.stringify(pw.concept.key) + " resolves to nothing");
    }
    if ((pw.learning || {}).status === "authored") out.learningRef = id.lesson(n, pw.id);

    out.evidenceRefs = (pw.evidence || []).map(e => {
      const label = typeof e === "string" ? e : e.label;
      const hit = evAlias[String(label).toLowerCase()];
      if (!hit) { unmapped.push(pw.id + ": evidence " + JSON.stringify(label) + " resolves to nothing"); return null; }
      if (hit.ambiguous) unmapped.push(pw.id + ": evidence label " + JSON.stringify(label) + " matches more than one record");
      migrated.push(pw.id + ": evidence label " + JSON.stringify(label) + " -> " + hit.id);
      return { ref: hit.id,
        // Never inferred. A record filed under the same topic is topic-context
        // and nothing stronger, and even that is a claim an author makes.
        role: null,
        why: (typeof e === "object" && e.why) || null,
        limits: (typeof e === "object" && e.limits) || null };
    }).filter(Boolean);
    if (out.evidenceRefs.length) unmapped.push(pw.id + ": " + out.evidenceRefs.length + " evidence reference(s) carry no authored role");

    // The concept a pathway sits on defines terms. Those are now vocabulary
    // records, so the pathway inherits refs to them rather than the concept
    // owning a second definition system.
    if (out.conceptRef && L.concepts[out.conceptRef]) out.vocabRefs = (L.concepts[out.conceptRef].vocabRefs || []).slice();
    if (judgement && pw.contribution) out.contribution = pw.contribution;
    if (!judgement && pw.contribution) unmapped.push(pw.id + ": carries a judgement role on a causal question");
    return out;
  });

  const areas = Object.keys(q.areas || {}).map(k => ({
    id: areaIds[k], label: (q.areas[k] && q.areas[k].label) || k, kind: "question-area",
    // Claimed means resolved. Nothing is validated by matching a label against
    // syllabus prose, and claiming nothing is valid.
    syllabusRefs: [], vocabRefs: [],
    guidance: guidanceFor({ guides: (q.areas[k] || {}).guides || {} }),
  }));

  const pkg = {
    schema: "marginal.question-package",
    version: 1,
    origin: { type: "bundled", packageId: null, author: null, authoredAt: null },
    provenance: { reviewState: "in-source", publication: "published", notes: null },
    requires: {}, provides: {},
    question: {
      id: q.id, subject: subjectKey,
      topicRef: hasTopic ? id.topic("business", topicKey) : null,
      topicLabel: hasTopic ? null : (q.topic || null),
      directive: String(q.command || "").toLowerCase() || null,
      text: q.text, marks: q.marks || 20,
      terms: { first: q.term1 || null, second: q.term2 || null },
      overallArgument: q.argument || null,
      vocabRefs: [], studyRefs: (q.studyRefs || []).slice(),
    },
    relationship: { intro: q.connectIntro || null, claims: claims },
    decode: q.decode || null,
    requirements: q.requirements ? {
      concepts: q.requirements.concepts || [],
      relationships: q.requirements.relationships || [],
      accomplish: q.requirements.accomplish || [],
      syllabusSummary: q.requirements.syllabus || null,
    } : null,
    coreAnswer: q.coreAnswer || null,
    workingAnswer: q.workingAnswer || null,
    reasoning: q.reasoning || null,
    areas: areas,
    pathways: pathways,
    marking: { source: q.rubric ? "authored" : "generated",
      bands: (q.criteria && q.criteria.bands) || null,
      bandSource: (q.criteria && q.criteria.source) || null, text: q.rubric || null },
  };
  if (q.objectiveWords) unmapped.push("objectiveWords dropped: claim right-hand ends are explicit in v1");
  if (q.qtype || q.qtypeLabel) migrated.push("qtype/qtypeLabel dropped: nothing in the app, the build or the tests reads them");
  if (q.requirements && (q.requirements.requiredAreas || []).length) {
    const bad = q.requirements.requiredAreas.filter(a => !areaIds[(a || {}).id || a]);
    bad.forEach(a => unmapped.push("requiredArea " + JSON.stringify((a || {}).id || a) + " is not one of this question's areas"));
  }

  pkg.requires = requiresOf(pkg);
  return { pkg: pkg, unmapped: unmapped, migrated: migrated };
}

// requires is COMPUTED, never authored beside the package. A dependency list
// that can disagree with the package it describes is a second source of truth,
// so the validator recomputes it the same way and reports any difference.
function requiresOf(pkg) {
  const sets = { vocabulary: new Set(), concepts: new Set(), lessons: new Set(), evidence: new Set(),
                 syllabus: new Set(), resources: new Set(), criteria: new Set() };
  const walk = o => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    Object.keys(o).forEach(k => {
      const v = o[k];
      if (v == null) return;
      if (k === "vocabRefs") (v || []).forEach(r => r && r.id && sets.vocabulary.add(r.id));
      else if (k === "studyRefs") (v || []).forEach(r => r && sets.resources.add(r));
      else if (k === "evidenceRefs") (v || []).forEach(r => r && r.ref && sets.evidence.add(r.ref));
      else if (k === "conceptRef") sets.concepts.add(v);
      else if (k === "learningRef") sets.lessons.add(v);
      else if (k === "criterionRef") sets.criteria.add(v);
      else if (k === "syllabusRef" || k === "topicRef") sets.syllabus.add(v);
      else if (k === "syllabusRefs") (v || []).forEach(r => r && sets.syllabus.add(r));
      else walk(v);
    });
  };
  walk({ question: pkg.question, relationship: pkg.relationship, areas: pkg.areas, pathways: pkg.pathways });
  const out = {};
  Object.keys(sets).forEach(k => { out[k] = [...sets[k]].sort(); });
  return out;
}

if (require.main === module) {
  const want = process.argv.slice(2);
  const { E } = lib.build();
  const ids = [];
  Object.keys(E.subjects).forEach(sk => (E.subjects[sk].questions || []).forEach(q => ids.push(q.id)));
  const todo = want.length ? want : ids;
  const rows = [];
  todo.forEach(qid => {
    const r = packagize(qid);
    const file = path.join(OUT, "example-" + qid + ".json");
    fs.writeFileSync(file, JSON.stringify(r.pkg, null, 2) + "\n");
    rows.push({ id: qid, unmapped: r.unmapped, migrated: r.migrated, bytes: fs.statSync(file).size });
  });
  const tally = {};
  rows.forEach(r => r.unmapped.forEach(u => {
    const key = u.replace(/^[a-z0-9-]+: /, "").replace(/"[^"]*"/g, "…").replace(/\d+ evidence/, "N evidence");
    tally[key] = (tally[key] || 0) + 1;
  }));
  console.log("wrote " + rows.length + " packages into docs/contract/");
  const mig = {};
  rows.forEach(r => r.migrated.forEach(m => {
    const key = m.replace(/^[a-z0-9-]+: /, "").replace(/"[^"]*"/g, "…").replace(/-> \S+/, "-> …");
    mig[key] = (mig[key] || 0) + 1;
  }));
  console.log("\nprose joins resolved on the way out");
  Object.keys(mig).sort((a, b) => mig[b] - mig[a]).forEach(k => console.log("  " + String(mig[k]).padStart(4) + "  " + k));
  console.log("\nunmapped, by kind");
  const keys = Object.keys(tally).sort((a, b) => tally[b] - tally[a]);
  if (!keys.length) console.log("  none");
  keys.forEach(k => console.log("  " + String(tally[k]).padStart(4) + "  " + k));
}
module.exports = { packagize, requiresOf };
