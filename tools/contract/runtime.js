// A STORED PACKAGE, AS THE STUDENT RUNTIME SEES IT.
//
// packagize.js turns a question in source into a package. This is the inverse,
// and it is written by reading that file rather than by remembering the format:
// every line below has a counterpart there, and when the two disagree the tests
// that round trip a real question catch it.
//
// THREE RULES IT IS BUILT AROUND.
//
// It DERIVES and never mutates. The stored document is the source of truth and
// stays exactly as authored; what comes back here is a view of it. Nothing in
// this file writes to its argument.
//
// It never fills a gap. A package with no pathways becomes a question with no
// pathways, and the runtime shows what it actually has. Borrowing support from
// another question, or inventing a plan line because the shape looks empty, is
// how a student is offered help nobody wrote for the question in front of them.
//
// It fails closed on a collision. An imported id that is also a source id means
// something is wrong upstream, because admission refuses that at import. The
// runtime cannot repair it and must not choose a winner, so it drops the
// imported one and says so.
const SOURCE = { bundled: "bundled", imported: "imported" };

// package.question.terms is { first, second }; the runtime reads term1/term2.
function topicFromRef(ref) {
  if (!ref || typeof ref !== "string") return null;
  const bits = ref.split(".");
  return bits.length >= 2 ? bits[bits.length - 1] : null;
}

function termsOf(q) {
  const t = q.terms || {};
  return { term1: t.first == null ? null : t.first, term2: t.second == null ? null : t.second };
}

// relationship.claims[].line is the authored plan line, and the runtime's plan
// is those lines. The structure around them, the resolved left and right ends,
// is what the format ADDED and the runtime has no use for yet, so it travels on
// the question rather than being flattened away.
function planOf(doc) {
  return ((doc.relationship || {}).claims || []).map(c => c.line).filter(x => x != null);
}

function areasOf(doc) {
  const out = {};
  (doc.areas || []).forEach(a => {
    if (!a || !a.id) return;
    out[a.id] = { label: a.label || a.id, guides: guidesOf(a.guidance) };
  });
  return out;
}

// guidance.<slot> = { direct, ladder[] } is one field with two depths. The
// runtime reads guides.<slot> (the one line always shown) and help.<slot> (the
// ladder behind it), so the pair is unpacked back into the two it came from.
function guidesOf(guidance) {
  const out = {};
  Object.keys(guidance || {}).forEach(slot => { if (guidance[slot] && guidance[slot].direct) out[slot] = guidance[slot].direct; });
  return out;
}
function helpOf(guidance) {
  const out = {};
  Object.keys(guidance || {}).forEach(slot => {
    const ladder = (guidance[slot] || {}).ladder || [];
    if (!ladder.length) return;
    const h = {};
    ladder.forEach(rung => {
      if (rung.rung === "hint") h.hint = rung.text;
      else if (rung.rung === "needs") h.needs = rung.text;
      else if (rung.rung === "direction") h.direction = { text: rung.text };
      else if (rung.rung === "frame") h.frame = { text: rung.text };
      else if (rung.rung === "starter") h.starter = { text: rung.text };
      else if (rung.rung === "example") h.example = { text: rung.text, context: rung.context || undefined, pattern: rung.pattern || undefined };
    });
    out[slot] = h;
  });
  return out;
}

function pathwaysOf(doc) {
  return (doc.pathways || []).map(p => {
    const out = {
      id: p.id, area: p.areaRef || undefined, short: p.short,
      adds: p.adds || undefined, relationship: p.relationship,
      // Never derived from short or relationship, in either direction. The
      // format made that explicit and the inverse has to keep it explicit.
      fromLabel: (p.left && p.left.label) || undefined,
      meaning: p.choiceMeaning || undefined,
      whatToProve: p.whatToProve || undefined,
      commonMistake: p.commonMistake || undefined,
      guides: guidesOf(p.guidance), help: helpOf(p.guidance),
    };
    if (p.mechanism && (p.mechanism.text || p.mechanism.note || p.mechanism.status !== "unreviewed"))
      out.mechanism = { state: p.mechanism.status, text: p.mechanism.text || undefined, note: p.mechanism.note || undefined };
    if (p.learning && p.learning.status) out.learning = { status: p.learning.status };
    if (p.contribution) out.contribution = p.contribution;
    // Refs are ids into the shared libraries. They travel unresolved: resolving
    // them needs the libraries, and a runtime that half resolved them would be
    // a second resolver disagreeing with tools/contract/resolve.js.
    if ((p.evidenceRefs || []).length) out.evidenceRefs = p.evidenceRefs.slice();
    if ((p.vocabRefs || []).length) out.vocabRefs = p.vocabRefs.slice();
    if (p.syllabusRef) out.syllabusRef = p.syllabusRef;
    if (p.conceptRef) out.conceptRef = p.conceptRef;
    return out;
  });
}

// The runtime question. Only what the package actually carries: a field the
// package leaves out is left out here, so the runtime's own "is this authored"
// checks see the truth rather than an empty shape pretending to be authored.
function toRuntimeQuestion(doc) {
  if (!doc || !doc.question || !doc.question.id) return null;
  const q = doc.question;
  const t = termsOf(q);
  const out = {
    id: q.id,
    text: q.text,
    command: q.directive || undefined,
    marks: q.marks,
    // topicRef is an id into the syllabus library; topicLabel is prose. The
    // runtime reads `topic`, so a package carrying only a ref needs one.
    //
    // Taking the last segment of the ref is the EXACT INVERSE of how the ref
    // was built - libraries.js id.topic(n, topic) is n + "." + slug(topic) -
    // and not a resemblance match. What it cannot recover is the authored
    // capitalisation, because slugging threw it away: a ref that was built from
    // "Marketing" comes back as "marketing". That is a real loss and it is left
    // visible rather than repaired by title casing, which would invent a label
    // for every ref whose original had none.
    topic: q.topicLabel || topicFromRef(q.topicRef) || undefined,
    topicRef: q.topicRef || undefined,
  };
  if (t.term1 != null) out.term1 = t.term1;
  if (t.term2 != null) out.term2 = t.term2;
  if (q.overallArgument) out.argument = q.overallArgument;
  if ((q.studyRefs || []).length) out.studyRefs = q.studyRefs.slice();
  if ((q.vocabRefs || []).length) out.vocabRefs = q.vocabRefs.slice();

  const plan = planOf(doc);
  if (plan.length) out.plan = plan;
  if ((doc.relationship || {}).intro) out.connectIntro = doc.relationship.intro;

  const areas = areasOf(doc);
  if (Object.keys(areas).length) out.areas = areas;
  const pathways = pathwaysOf(doc);
  if (pathways.length) out.pathways = pathways;

  if (doc.decode) out.decode = doc.decode;
  if (doc.requirements) {
    const r = doc.requirements;
    const req = {};
    if ((r.concepts || []).length) req.concepts = r.concepts.slice();
    if ((r.relationships || []).length) req.relationships = r.relationships.slice();
    if ((r.accomplish || []).length) req.accomplish = r.accomplish.slice();
    if (r.syllabusSummary) req.syllabus = r.syllabusSummary;
    if (Object.keys(req).length) out.requirements = req;
  }
  if (doc.coreAnswer) out.coreAnswer = doc.coreAnswer;
  if (doc.workingAnswer) out.workingAnswer = doc.workingAnswer;
  if (doc.reasoning) out.reasoning = doc.reasoning;
  if (doc.marking) {
    if (doc.marking.text) out.rubric = doc.marking.text;
    // Bands OR a band source. A question can name where its band language comes
    // from and carry no bands of its own, and testing only for bands dropped
    // that source on four of the nineteen questions in the bank.
    if (doc.marking.bands || doc.marking.bandSource)
      out.criteria = { bands: doc.marking.bands || null, source: doc.marking.bandSource || undefined };
  }
  // Where it came from, so a surface that genuinely needs to know can ask,
  // and so nothing has to guess by looking for a missing field.
  out.origin = SOURCE.imported;
  return out;
}

// The one question interface. Source subjects, with each subject's imported
// questions appended, as a NEW object: window.ESSAY is not touched, so the
// questions that shipped stay exactly what they were.
//
// A stored question whose id is already a source id is DROPPED and reported.
// Admission refuses that at import, so reaching here means storage is wrong,
// and the runtime's job in that case is to be obviously missing a question
// rather than quietly serving a different one under a familiar id.
function mergeSubjects(subjects, stored) {
  const sourceIds = {};
  Object.keys(subjects || {}).forEach(sk =>
    ((subjects[sk] || {}).questions || []).forEach(q => { if (q && q.id) sourceIds[q.id] = sk; }));

  const bySubject = {}, collisions = [], unusable = [], added = [];
  Object.keys((stored || {}).questions || {}).forEach(id => {
    const rec = stored.questions[id];
    const doc = rec && rec.document;
    const rq = doc ? toRuntimeQuestion(doc) : null;
    if (!rq) { unusable.push({ id: id, why: "the stored package carries no readable question" }); return; }
    if (rq.id !== id) { unusable.push({ id: id, why: "stored under " + id + " and the document says " + rq.id }); return; }
    if (sourceIds[id]) { collisions.push({ id: id, subject: sourceIds[id] }); return; }
    const sk = (doc.question && doc.question.subject) || rec.subject;
    if (!sk) { unusable.push({ id: id, why: "the package names no subject" }); return; }
    (bySubject[sk] = bySubject[sk] || []).push(rq);
    added.push({ id: id, subject: sk });
  });

  const out = {};
  Object.keys(subjects || {}).forEach(sk => { out[sk] = subjects[sk]; });
  Object.keys(bySubject).forEach(sk => {
    // A subject that ships no content at all still gets one, so an imported
    // question cannot be invisible for want of a container. It carries the
    // questions and nothing else, which is the honest amount.
    const base = out[sk] || { key: sk, label: sk.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), questions: [] };
    const merged = {};
    Object.keys(base).forEach(k => { merged[k] = base[k]; });
    merged.questions = (base.questions || []).concat(bySubject[sk].slice().sort((a, b) => String(a.id).localeCompare(String(b.id))));
    out[sk] = merged;
  });
  return { subjects: out, added: added, collisions: collisions, unusable: unusable };
}

module.exports = { toRuntimeQuestion, mergeSubjects, SOURCE, guidesOf, helpOf };
