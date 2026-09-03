// THE SHARED LIBRARIES, built from the content that ships.
//
// A question package references shared content by id and never copies it, so
// these are the things it references: vocabulary, concepts, lessons, evidence,
// syllabus nodes, resources and sentence shapes. Everything here is derived from
// `essay-content.js` and `business-content.js`; nothing is invented, and where a
// record cannot be completed from the source it is emitted incomplete and
// reported rather than filled in.
//
// Two migrations happen here, and both are decisions rather than conveniences.
//
// VOCABULARY HAS ONE AUTHORITY. Concept records own fourteen distinct
// {term, meaning} pairs with real definitions in them, while the vocabulary
// library holds nothing. Two definition systems is one too many, so the pairs
// become vocabulary records and the concept points at them by id. They arrive
// carrying a subject meaning and no plain meaning or example, which makes them
// usable by the Learn surface and not yet offerable in the vocabulary panel.
// That is the truth about them and it is reported that way.
//
// LESSONS LEAVE THE PATHWAY. A pathway may reference teaching; it may not
// contain a lesson. The four authored `learning` blocks become lesson records.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.resolve(__dirname, "..", "..");

function load(file) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), sandbox);
  return sandbox.window;
}
// Ids are minted deterministically and are then the record's name for good. An
// id that changes when the prose changes is not an id.
const slug = s => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const SUBJECT_NS = { business_studies: "business", ancient_history: "ancient" };
// The parts a syllabus point names in its own title, after the dash. Authored
// punctuation only: everything before the dash is the point, everything after is
// a comma or "and" separated list of its parts. A title with no dash names no
// parts, which is a fact about the syllabus wording and not a gap to fill in.
function subNodes(title) {
  const m = String(title || "").split(/\s+[-\u2013\u2014]\s+/);
  if (m.length < 2) return [];
  return m.slice(1).join(" - ")
    .split(/,|\s+and\s+|\s+or\s+/)
    .map(x => x.replace(/\([^)]*\)/g, "").trim())
    .filter(x => x && x.length > 2 && x.split(/\s+/).length <= 5);
}
const TOPIC_NS = { operations: "operations", marketing: "marketing", finance: "finance", human_resources: "hr" };
const ns = k => SUBJECT_NS[k] || slug(k);

const id = {
  vocab: (n, term) => n + ".vocab." + slug(term),
  concept: (n, key) => n + ".concept." + slug(key),
  lesson: (n, pathwayId) => n + ".lesson." + slug(pathwayId),
  evidence: (topic, label) => "mcdonalds." + (TOPIC_NS[topic] || slug(topic)) + "." + slug(label),
  topic: (n, topic) => n + "." + (TOPIC_NS[topic] || slug(topic)),
  point: (n, topic, section, point) =>
    [n, TOPIC_NS[topic] || slug(topic), slug(section), slug(String(point).split(/\s+[-–]\s+|,/)[0])].join("."),
  shape: shapeId => "shape." + shapeId,
};

// Memoised. packagize calls it once per question and it walks both content files
// every time; nineteen packages is nineteen parses of 380KB otherwise.
let CACHE = null;
function build() {
  if (CACHE) return CACHE;
  return (CACHE = build_());
}
function build_() {
  const E = load("essay-content.js").ESSAY;
  const B = load("business-content.js").BUSCONTENT;
  const notes = [];
  const L = { vocabulary: {}, concepts: {}, lessons: {}, evidence: {}, syllabus: {},
              resources: {}, sentenceShapes: {} };

  // ---- syllabus -----------------------------------------------------------
  // Points, and their SUB-NODES. A syllabus point often names its own parts in
  // its title: "performance objectives - quality, speed, dependability,
  // flexibility, customisation, cost". Those parts are what a plan line's
  // right-hand end points at, so they get ids from the same graph rather than a
  // separate criterion registry. Split on the authored dash and the authored
  // commas, and on nothing else: no part is ever recovered from the `what` prose,
  // because that is the inference this contract removes.
  Object.keys((B && B.topics) || {}).forEach(topic => {
    const t = B.topics[topic], tid = id.topic("business", topic);
    L.syllabus[tid] = { id: tid, subject: "business_studies", label: t.label, kind: "topic", sections: [] };
    (t.sections || []).forEach(sec => {
      const points = (sec.points || []).map(pt => {
        const pid = id.point("business", topic, sec.name, pt.point);
        const parts = subNodes(pt.point);
        L.syllabus[pid] = { id: pid, subject: "business_studies", kind: "point", topicRef: tid,
          section: sec.name, point: pt.point, what: pt.what, why: pt.why, exam: pt.exam || "",
          partRefs: parts.map(x => pid + "." + slug(x)),
          // Named to say what it is. These strings have no meanings anywhere,
          // nothing displays them, and they can never satisfy a vocabRef.
          legacyTerms: (pt.terms || []).slice() };
        parts.forEach(label => {
          const sid = pid + "." + slug(label);
          if (L.syllabus[sid]) return;
          L.syllabus[sid] = { id: sid, subject: "business_studies", kind: "part", topicRef: tid,
            pointRef: pid, section: sec.name, point: pt.point, label: label };
        });
        return pid;
      });
      L.syllabus[tid].sections.push({ name: sec.name, pointRefs: points });
    });
  });

  // ---- evidence -----------------------------------------------------------
  const evAlias = {};
  Object.keys((B && B.evidence) || {}).forEach(topic => {
    (B.evidence[topic] || []).forEach(e => {
      const eid = id.evidence(topic, e.label);
      if (L.evidence[eid]) notes.push("evidence id collision on " + eid);
      L.evidence[eid] = { id: eid, subject: "business_studies", topicRef: id.topic("business", topic),
        section: e.section || "", label: e.label, fact: e.fact, use: e.use,
        source: e.source || null, verify: !!e.verify };
      // The label join, kept only so the transform can migrate. It is not part
      // of the authoring contract and is not in the guide.
      const k = String(e.label).toLowerCase();
      if (evAlias[k]) evAlias[k].ambiguous = true; else evAlias[k] = { id: eid, ambiguous: false };
    });
  });

  // ---- vocabulary and concepts -------------------------------------------
  Object.keys(E.subjects || {}).forEach(sk => {
    const n = ns(sk), subject = E.subjects[sk];
    Object.keys(subject.concepts || {}).forEach(key => {
      const c = subject.concepts[key], cid = id.concept(n, key);
      const vocabRefs = [];
      (c.terms || []).forEach(t => {
        if (!t || !t.term || !t.meaning) return;
        const vid = id.vocab(n, t.term);
        if (!L.vocabulary[vid]) {
          L.vocabulary[vid] = { id: vid, subject: sk, term: t.term,
            // The concept meaning is the COURSE meaning. plain and example were
            // never authored, so they are absent rather than duplicated from it.
            subject_meaning: t.meaning, plain: null, example: null,
            migratedFrom: "concept.terms:" + key };
        }
        // topic-context is the weakest of the four roles and is the only one a
        // migration is entitled to assert. A stronger role is a claim an author
        // makes, not one a transform makes for them.
        if (!vocabRefs.some(r => r.id === vid)) vocabRefs.push({ id: vid, role: "topic-context" });
      });
      const teaching = { true: "always", contextual: "contextual", false: "never" }[String(c.requiresTeaching)];
      if (!teaching) notes.push(cid + ": requiresTeaching is " + JSON.stringify(c.requiresTeaching) + ", which is not one of the three");
      L.concepts[cid] = { id: cid, subject: sk, kind: c.kind || null, requiresTeaching: teaching || null,
        oneLine: c.oneLine || null, title: c.title || null, quick: c.quick || null,
        readMore: c.readMore || [], confusions: c.confusions || [], example: c.example || null,
        // related was always display prose. Three of its eight values happen to
        // be concept keys and five are not, so a field that looks like a ref and
        // is not is renamed to say so.
        relatedLabels: c.related || [], vocabRefs: vocabRefs,
        syllabusLabel: c.syllabus || null };
    });
  });

  // ---- lessons ------------------------------------------------------------
  Object.keys(E.subjects || {}).forEach(sk => {
    const n = ns(sk);
    (E.subjects[sk].questions || []).forEach(q => (q.pathways || []).forEach(pw => {
      if (!pw.learning || pw.learning.status !== "authored") return;
      const lid = id.lesson(n, pw.id);
      const l = Object.assign({}, pw.learning);
      delete l.status;
      const concepts = l.concepts || {}; delete l.concepts;
      const conceptRefs = {};
      ["primary", "supporting", "optional"].forEach(tier => {
        conceptRefs[tier] = (concepts[tier] || []).map(key => {
          const cid = id.concept(n, key);
          if (!L.concepts[cid]) { notes.push(lid + ": concept " + JSON.stringify(key) + " resolves to nothing"); return null; }
          return cid;
        }).filter(Boolean);
      });
      if (l.explore && l.explore.concept) {
        const cid = id.concept(n, l.explore.concept);
        l.exploreRef = L.concepts[cid] ? { conceptRef: cid, label: l.explore.label } : null;
        if (!L.concepts[cid]) notes.push(lid + ": explore concept " + JSON.stringify(l.explore.concept) + " resolves to nothing");
        delete l.explore;
      }
      L.lessons[lid] = Object.assign({ id: lid, subject: sk, extractedFrom: pw.id, conceptRefs: conceptRefs }, l);
    }));
  });

  // ---- resources and sentence shapes --------------------------------------
  Object.keys(E.resources || {}).forEach(k => { L.resources[k] = E.resources[k]; });
  ((E.shapes || {}).library || []).forEach(sh => { L.sentenceShapes[id.shape(sh.id)] = Object.assign({ id: id.shape(sh.id) }, sh); });

  return { libraries: L, notes: notes, evAlias: evAlias, E: E, B: B };
}

// ---- completeness -----------------------------------------------------------
// What "complete" means depends on what consumes the record, which is why
// vocabulary reports two levels rather than one. A record complete enough to
// teach with is not automatically complete enough to offer as vocabulary.
const nonEmpty = (o, fields) => fields.filter(k => {
  const v = (o || {})[k];
  return v == null || (Array.isArray(v) ? !v.length : !String(v).trim());
});
function completeness(kind, rec) {
  if (kind === "vocabulary") {
    const missing = nonEmpty(rec, ["term", "subject_meaning"]);
    const forDisplay = nonEmpty(rec, ["term", "subject_meaning", "plain", "example"]);
    return { complete: !missing.length, missing: missing,
             displayable: !forDisplay.length, missingForDisplay: forDisplay };
  }
  if (kind === "concepts") {
    const need = rec.requiresTeaching === "always" ? ["oneLine", "title", "quick", "readMore"]
      : rec.requiresTeaching === "contextual" ? ["oneLine", "title", "quick"] : ["oneLine"];
    const missing = nonEmpty(rec, need).concat(rec.requiresTeaching ? [] : ["requiresTeaching"]);
    return { complete: !missing.length, missing: missing };
  }
  if (kind === "evidence") {
    const missing = nonEmpty(rec, ["label", "fact", "use"]);
    // published is source AND verification, and is reported apart from complete:
    // an unsourced item is usable for guided practice and is not usable by a
    // question claiming to be evidence-complete.
    return { complete: !missing.length, missing: missing, published: !!(rec.source && String(rec.source).trim()) };
  }
  if (kind === "lessons") return { complete: !nonEmpty(rec, ["know", "chain"]).length, missing: nonEmpty(rec, ["know", "chain"]) };
  if (kind === "resources") { const m = nonEmpty(rec, ["label", "url"]); return { complete: !m.length, missing: m }; }
  if (kind === "syllabus") {
    const need = rec.kind === "topic" ? ["label"] : rec.kind === "part" ? ["label", "pointRef"] : ["point", "what", "why"];
    const m = nonEmpty(rec, need);
    return { complete: !m.length, missing: m, kind: rec.kind };
  }
  if (kind === "sentenceShapes") { const m = nonEmpty(rec, ["family", "role", "stage", "frame", "why"]); return { complete: !m.length, missing: m }; }
  return { complete: true, missing: [] };
}

// ---- the manifest -----------------------------------------------------------
// What a validator checks a package's requires block against: ids and states,
// never bodies. Small enough to read, and it carries the enums so no validator
// keeps its own copy of a list the content defines.
const CONTRACT_ENUMS = require("./fields.js").ENUMS;
function manifest() {
  const { libraries: L, notes } = build();
  const records = {}, counts = {};
  Object.keys(L).forEach(kind => {
    records[kind] = {};
    Object.keys(L[kind]).forEach(rid => { records[kind][rid] = completeness(kind, L[kind][rid]); });
    const ids = Object.keys(records[kind]);
    counts[kind] = { records: ids.length, complete: ids.filter(i => records[kind][i].complete).length };
  });
  counts.vocabulary.displayable = Object.keys(records.vocabulary).filter(i => records.vocabulary[i].displayable).length;
  counts.evidence.published = Object.keys(records.evidence).filter(i => records.evidence[i].published).length;

  const E = load("essay-content.js").ESSAY;
  const fams = ((E.slots || {}).templates || {}).directiveFamilies || {};
  const shapes = (E.shapes || {}).library || [];
  const enums = {
    vocabularyRoles: ((E.vocab || {}).roles || []).map(r => r.id),
    // The list that decides the FAMILY, which is what a question is validated
    // against. answerShapes.commands is a different list for a different job and
    // the two do not agree.
    directives: Object.keys(fams).reduce((a, f) => a.concat(fams[f] || []), []).sort(),
    directiveFamilies: fams,
    answerShapeCommands: Object.keys((E.answerShapes || {}).commands || {}),
    connectors: Object.keys(((E.shapes || {}).connectors) || {}),
    slotKeys: Object.keys((E.slots || {}).templates || {}).filter(k => k !== "directiveFamilies"),
    // Which family, role and stage combinations a sentence shape actually
    // exists for. A question whose family is not here is structurally valid and
    // reports that sentence shape support is unavailable.
    shapeCoverage: [...new Set(shapes.map(s => [s.family, s.role, s.stage].join(".")))].sort(),
    shapeFamilies: [...new Set(shapes.map(s => s.family))].sort(),
  };
  Object.keys(CONTRACT_ENUMS).forEach(k => { if (CONTRACT_ENUMS[k].values) enums[k] = CONTRACT_ENUMS[k].values.slice(); });
  return { schema: "marginal.library-manifest", version: 1, counts: counts, enums: enums,
           notes: notes, records: records };
}

module.exports = { build, manifest, completeness, id, ns, slug, load, subNodes };
