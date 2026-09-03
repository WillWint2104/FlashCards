// THE RESOLVER.
//
// Takes a package and the shared libraries and produces the semantic state a
// runtime would need to serve the question: every ref replaced by the record it
// names, and every ref that names nothing listed rather than dropped.
//
// This is not the importer and it does not write. It exists so that round-trip
// fidelity can be PROVED rather than assumed: export a question, validate the
// package, resolve it, and compare the result with the source it came from. A
// format that quietly loses a field is a format nobody notices losing it until
// a student meets the gap.
const directives = require("./directives.js");
const { FIELDS } = require("./fields.js");

function resolve(pkg, libraries, REG) {
  const missing = [];
  const get = (kind, id, where) => {
    if (!id) return null;
    const rec = (libraries[kind] || {})[id];
    if (!rec) { missing.push({ kind: kind, id: id, at: where }); return null; }
    return rec;
  };
  const q = pkg.question || {};
  const row = directives.rowFor(REG, q.directive);
  const shapes = ((libraries.sentenceShapes) || {});
  const family = row ? row.family : null;

  const vocab = (refs, where) => (refs || []).map(r => {
    const rec = get("vocabulary", r && r.id, where);
    return rec ? { id: rec.id, term: rec.term, role: r.role || null,
      courseMeaning: rec.subject_meaning, plain: rec.plain, example: rec.example,
      // The two levels, derived here the same way the manifest derives them.
      displayable: !!(rec.term && rec.subject_meaning && rec.plain && rec.example) } : null;
  }).filter(Boolean);

  return {
    question: {
      id: q.id, subject: q.subject, text: q.text, directive: q.directive, marks: q.marks,
      terms: q.terms || null, overallArgument: q.overallArgument || null,
      topic: get("syllabus", q.topicRef, "question.topicRef"), topicLabel: q.topicLabel || null,
      vocabulary: vocab(q.vocabRefs, "question.vocabRefs"),
      resources: (q.studyRefs || []).map(r => get("resources", r, "question.studyRefs")).filter(Boolean),
    },
    relationship: {
      intro: (pkg.relationship || {}).intro || null,
      claims: ((pkg.relationship || {}).claims || []).map(c => ({
        id: c.id, line: c.line, relation: c.relation,
        left: { label: (c.left || {}).label, concept: get("concepts", (c.left || {}).conceptRef, c.id + ".left") },
        right: (c.right || []).map(r => ({ label: r.label,
          criterion: get("syllabus", r.criterionRef, c.id + ".right") })),
        pathwayRefs: c.pathwayRefs || [],
      })),
    },
    areas: (pkg.areas || []).map(a => ({ id: a.id, label: a.label,
      guidance: a.guidance || {},
      syllabus: (a.syllabusRefs || []).map(r => get("syllabus", r, "areas." + a.id)).filter(Boolean),
      vocabulary: vocab(a.vocabRefs, "areas." + a.id) })),
    pathways: (pkg.pathways || []).map(p => ({
      id: p.id, areaRef: p.areaRef || null, short: p.short, adds: p.adds || null,
      relationship: p.relationship, left: p.left || null, choiceMeaning: p.choiceMeaning || null,
      whatToProve: p.whatToProve || null, commonMistake: p.commonMistake || null,
      mechanism: p.mechanism || null, contribution: p.contribution || null,
      guidance: p.guidance || {},
      concept: get("concepts", p.conceptRef, p.id + ".conceptRef"),
      syllabus: get("syllabus", p.syllabusRef, p.id + ".syllabusRef"),
      lesson: p.learningRef ? get("lessons", p.learningRef, p.id + ".learningRef") : null,
      learningStatus: (p.learning || {}).status || null,
      evidence: (p.evidenceRefs || []).map(e => {
        const rec = get("evidence", e.ref, p.id + ".evidenceRefs");
        return rec ? { id: rec.id, label: rec.label, fact: rec.fact, use: rec.use,
          source: rec.source, verify: rec.verify, role: e.role || null,
          why: e.why || null, limits: e.limits || null } : null;
      }).filter(Boolean),
      vocabulary: vocab(p.vocabRefs, p.id + ".vocabRefs"),
    })),
    marking: pkg.marking || null,
    decode: pkg.decode || null,
    requirements: pkg.requirements || null,
    coreAnswer: pkg.coreAnswer || null,
    workingAnswer: pkg.workingAnswer || null,
    reasoning: pkg.reasoning || null,
    // What the engine would be able to offer, resolved rather than assumed.
    // A judgement question resolves to an empty list, which is the honest answer
    // and the reason the shape panel is withheld rather than filled with causal.
    sentenceShapes: { family: family,
      supportedInGuidedWriting: !!(row && row.supportedInGuidedWriting),
      available: Object.values(shapes).filter(s => family && s.family === family)
        .map(s => ({ id: s.id, role: s.role, stage: s.stage })) },
    missing: missing,
  };
}
// ---- what publication writes ------------------------------------------------
//
// THE PACKAGE DOCUMENT IS THE RECORD OF TRUTH. Publication stores the whole
// parsed document; everything else Marginal uses is derived from it and can be
// rebuilt.
//
// The guarantee is SEMANTIC, and the distinction matters. Every property and
// value the package supplied survives, including fields this version of Marginal
// has never heard of. What does not survive is formatting: a package indented
// with four spaces is stored as the same document and would serialise with two.
// Marginal does not keep the uploaded bytes, so it cannot promise to reproduce
// them, and promising it would be a claim about a file it no longer has.
//
// That is the whole answer to forward compatibility, and the failure it prevents
// is precise: a 1.0 reader opening a 1.7 package understands some of it and not
// all of it, and if publication stored the reader's reconstruction, the parts it
// did not understand would be gone. Cloning the document makes that impossible
// by construction. Rebuilding it from a list of known fields would make it
// certain, and would look identical from the reader's own side, because
// everything it knew about would be fine.
//
// If a reader ever cannot return the document it was given, it may inspect and
// must not publish. Inspecting and losing is worse than refusing.
function storable(pkg) {
  return JSON.parse(JSON.stringify(pkg));
}

// Which paths in this document the field definition does not name. Not an error
// and not a rejection: forty of them exist in the questions that ship, because
// the specification names the fields an author must get right and carries some
// blocks whole. It is reported so that a reviewer opening a package authored
// against a later contract can see what this reader is carrying without
// interpreting.
const SPEC = FIELDS.filter(f => !/^shared:/.test(f.owner)).map(f => f.path.split("."));
const bare = s => String(s).replace(/\[\]/g, "");
function specKnows(parts) {
  return SPEC.some(pat => {
    if (pat.length < parts.length) return false;
    return parts.every((p, i) => {
      const a = bare(pat[i]);
      return a === bare(p) || /^<.*>$/.test(a);
    });
  });
}
function carriedPaths(pkg) {
  const out = {};
  (function walk(o, parts) {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(x => walk(x, parts));
    Object.keys(o).forEach(k => {
      const p = parts.concat([k]);
      if (!specKnows(p)) { out[p.join(".")] = true; return; }
      walk(o[k], p);
    });
  })(pkg, []);
  return Object.keys(out).sort();
}

module.exports = { resolve, storable, carriedPaths };
