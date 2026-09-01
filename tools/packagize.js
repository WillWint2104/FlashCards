// DESIGN-TIME TRANSFORM, NOT THE IMPORTER.
//
// Converts the questions currently authored in source into the proposed
// QuestionPackage v1 shape, so the format can be checked against real content
// rather than against an illustration. It reads; it writes only into
// docs/contract/; nothing in the app calls it.
//
//   node tools/packagize.js            every question in the bank
//   node tools/packagize.js ops-02     one
//
// It applies the ten settled decisions. Where a decision cannot be applied
// without inventing something, the transform records the gap under UNMAPPED and
// leaves the value null. An empty list is the claim that the format covers the
// question; a non-empty one is schema work still outstanding.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
global.window = {};
eval(fs.readFileSync(path.join(ROOT, "business-content.js"), "utf8"));
eval(fs.readFileSync(path.join(ROOT, "essay-content.js"), "utf8"));
const B = global.window.BUSCONTENT, E = global.window.ESSAY;
const OUT = path.join(ROOT, "docs", "contract");

// Ids are minted deterministically so the examples are concrete. Decision 4
// requires canonical ids; the real registry has to be a committed file, because
// an id that changes when the prose changes is not an id.
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 44);
const SHORT = { operations: "operations", marketing: "marketing", finance: "finance", human_resources: "hr" };
function syllabusRef(topicKey, sectionName, pointText) {
  return ["business", SHORT[topicKey] || slug(topicKey), slug(sectionName), slug(String(pointText).split(/[–-]/)[0])].join(".");
}
function conceptRefFor(c) {
  if (!c) return null;
  if (c.key) return "business.concept." + slug(c.key);
  const t = B.topics[c.topic]; if (!t) return null;
  const sec = (t.sections || []).find(s => s.name === c.section); if (!sec) return null;
  // The prefix join is the legacy alias, used here only to migrate. It is not
  // part of the authoring contract.
  const want = String(c.point || "").toLowerCase();
  const pt = (sec.points || []).find(x => String(x.point || "").toLowerCase().indexOf(want) === 0);
  if (!pt) return null;
  return syllabusRef(c.topic, sec.name, pt.point);
}
function evidenceRecord(topicKey, label) {
  return ((B.evidence || {})[topicKey] || []).find(e => e.label === label) || null;
}

// help.<slot> is a five rung ladder, not a bag of strings: each rung gives more
// than the one before it. Order is the meaning, so it is emitted in the order
// the engine escalates through.
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
function guidanceFor(pw) {
  const slots = new Set(Object.keys(pw.guides || {}).concat(Object.keys(pw.help || {})));
  const out = {};
  [...slots].forEach(s => {
    const entry = {};
    if (pw.guides && pw.guides[s]) entry.direct = pw.guides[s];
    const ladder = ladderFor(pw.help && pw.help[s]);
    if (ladder.length) entry.ladder = ladder;
    out[s] = entry;
  });
  return out;
}

const sharedLearning = {};   // extracted pathway-local lessons, keyed by minted id

function packagize(q, subjectKey) {
  const unmapped = [];
  const topicKey = Object.keys(B.topics).find(k => B.topics[k].label.toLowerCase() === String(q.topic).toLowerCase()) || null;
  const judgement = ((q.coreAnswer || {}).mode === "judgement");
  const areaIds = {};
  Object.keys(q.areas || {}).forEach(k => { areaIds[k] = slug(k); });

  // Decision 5: the relationship a plan line claims becomes explicit structure.
  // The left end is authored; the right end needs a criterion registry that does
  // not exist yet, so it is left null and counted rather than invented.
  const claims = (q.plan || []).map((line, i) => {
    const bits = String(line).split(/\s+to\s+/i);
    const left = bits[0].trim();
    const rights = bits.length < 2 ? [] : bits[1].split(/\s*(?:,|and)\s*/).map(x => x.trim()).filter(Boolean);
    if (!rights.length) unmapped.push("plan line " + (i + 1) + " states no right-hand end: " + JSON.stringify(String(line)));
    rights.forEach(r => unmapped.push("criterion " + JSON.stringify(r) + " has no id: no objective/criterion registry exists"));
    return {
      id: q.id + "-claim-" + (i + 1),
      line: String(line),
      left: { label: left, conceptRef: null },
      relation: judgement ? "affects" : "shapes",
      right: rights.map(r => ({ label: r, criterionRef: null })),
      pathwayRefs: [],
    };
  });

  const pkg = {
    schema: "marginal.question-package",
    version: 1,
    question: {
      id: q.id, subject: subjectKey, topic: q.topic, directive: q.command || null,
      text: q.text, marks: q.marks || 20,
      terms: { first: q.term1 || "", second: q.term2 || "" },
      overallArgument: q.argument || "",
    },
    // Decision 2: one namespace. Where the question came from is metadata beside
    // the id, never part of it.
    origin: { type: "bundled", packageId: null, author: null, authoredAt: null },
    relationship: { intro: q.connectIntro || null, claims: claims },
    decode: q.decode || null,
    requirements: q.requirements || null,
    coreAnswer: q.coreAnswer || null,
    workingAnswer: q.workingAnswer || null,
    reasoning: q.reasoning || null,
    // Decision 3: an area is a question-local grouping with its own id. A
    // syllabus relationship, if claimed, is an explicit ref and must resolve.
    // Nothing is validated by matching the label against syllabus prose.
    areas: Object.keys(q.areas || {}).map(k => ({
      id: areaIds[k], label: (q.areas[k] && q.areas[k].label) || k,
      kind: "question-area", syllabusRefs: [],
      guidance: Object.keys((q.areas[k] || {}).guides || {}).reduce((a, s) => {
        a[s] = { direct: q.areas[k].guides[s] }; return a;
      }, {}),
    })),
    areasLabel: q.areasLabel || null,
    pathways: (q.pathways || []).map(pw => {
      const ref = conceptRefFor(pw.concept);
      if (pw.concept && !ref) unmapped.push(pw.id + ": concept route does not resolve to an id");

      // Decision 1: a complete lesson leaves the package and is referenced.
      let learningRef = null, learning = { status: (pw.learning && pw.learning.status) || "unreviewed" };
      if (pw.learning && pw.learning.status === "authored") {
        learningRef = "business.lesson." + slug(pw.id);
        sharedLearning[learningRef] = Object.assign({ id: learningRef, extractedFrom: pw.id }, pw.learning);
        delete sharedLearning[learningRef].status;
        learning = { status: "authored" };
      }

      const evs = (pw.evidence || []).map(e => {
        const label = typeof e === "string" ? e : e.label;
        const rec = topicKey ? evidenceRecord(topicKey, label) : null;
        if (!rec) { unmapped.push(pw.id + ": evidence " + JSON.stringify(label) + " does not resolve in the bank"); return null; }
        return {
          ref: ["mcdonalds", SHORT[topicKey] || slug(topicKey), slug(label)].join("."),
          // Decision 2 of the settled set: never inferred. A record in the same
          // topic is topic-context and nothing stronger, and even that is a
          // claim the author has to make.
          role: null,
          why: (typeof e === "object" && e.why) || null,
          limits: (typeof e === "object" && e.limits) || null,
          published: !!(rec.source && rec.checked),
        };
      }).filter(Boolean);
      if (evs.length) unmapped.push(pw.id + ": " + evs.length + " evidence reference(s) carry no authored role");

      const out = {
        id: pw.id, areaRef: pw.area ? (areaIds[pw.area] || slug(pw.area)) : null,
        short: pw.short, adds: pw.adds, relationship: pw.relationship,
        // fromLabel was never presentational: it is the authored cause end of
        // the relationship, explicitly never derived from short or relationship.
        left: pw.fromLabel ? { label: pw.fromLabel, conceptRef: null } : null,
        choiceMeaning: pw.choiceMeaning || pw.meaning || null,
        whatToProve: pw.whatToProve, commonMistake: pw.commonMistake,
        mechanism: pw.mechanism
          ? { status: pw.mechanism.state || pw.mechanism.status || "unreviewed",
              text: pw.mechanism.text || null, note: pw.mechanism.note || null }
          : { status: "unreviewed", text: null, note: null },
        conceptRef: ref, learningRef: learningRef, learning: learning,
        evidenceRefs: evs,
        guidance: guidanceFor(pw),
      };
      if (judgement && pw.contribution) out.contribution = pw.contribution;
      if (!judgement && pw.contribution) unmapped.push(pw.id + ": carries a judgement role on a causal question");
      return out;
    }),
    marking: {
      source: q.rubric ? "authored" : "generated",
      bands: (q.criteria && q.criteria.bands) || null,
      bandSource: (q.criteria && q.criteria.source) || null,
      text: q.rubric || null,
    },
    provenance: { origin: q.note || null, reviewState: "in-source", publication: "published", notes: null },
  };
  if (q.objectiveWords) unmapped.push("objectiveWords dropped: claim right-hand ends are explicit in v1");
  if (q.qtype || q.qtypeLabel) unmapped.push("qtype/qtypeLabel dropped: nothing reads them");
  return { pkg: pkg, unmapped: unmapped };
}

// Decision 6 of the settled set: readiness is six independent dimensions, not
// one scalar, so the two guided tiers already in the bank cannot report alike.
function readiness(pkg) {
  const p = pkg.pathways || [];
  const judgement = (pkg.coreAnswer || {}).mode === "judgement";
  const complete = pw => !!(pw.short && pw.adds && pw.relationship && pw.choiceMeaning
    && pw.whatToProve && pw.commonMistake && Object.keys(pw.guidance || {}).length);
  const d = {
    // The engine owns directive to family, so a package does not have to author
    // a mode to be importable. Requiring one here made every write-only question
    // "not importable", which contradicts the decision that a valid package may
    // honestly sit at a write-only capability.
    importable: !!(pkg.question.id && pkg.question.subject && pkg.question.topic
      && pkg.question.directive && pkg.question.text),
    "writing-ready": !!(pkg.question.marks && (pkg.question.overallArgument || (pkg.relationship.claims || []).length)),
    "pathway-guided": p.length >= 2 && p.every(complete) && p.every(x => x.conceptRef)
      && (!judgement || (p.some(x => (x.contribution || {}).role === "limitation")
        && ((pkg.coreAnswer || {}).positions || []).some(x => x.lean === "qualified"))),
    "learning-complete": p.length > 0 && p.every(x => x.learning.status !== "unreviewed" && x.conceptRef),
    // What a student needs to know what the answer must accomplish, and against
    // what it will be marked. Areas are organisation, not assessment, so they
    // are not required here.
    "assessment-complete": !!(pkg.decode && pkg.requirements && (pkg.coreAnswer || {}).acceptableThesis
      && ((pkg.coreAnswer || {}).checklist || []).length && pkg.marking.bandSource),
    "evidence-complete": p.length > 0 && p.every(x => (x.evidenceRefs || []).length
      && x.evidenceRefs.every(e => e.role && e.published)),
  };
  const head = !d.importable ? "Not importable"
    : d["pathway-guided"] ? (Object.keys(d).every(k => d[k]) ? "Fully authored" : "Guided")
    : d["writing-ready"] ? "Writing ready" : "Importable";
  const missing = Object.keys(d).filter(k => !d[k]);
  return { dimensions: d, headline: head + (missing.length ? " — missing " + missing.join(", ") : ""), missing: missing };
}

const want = process.argv.slice(2);
const rows = [];
Object.keys(E.subjects).forEach(sk => (E.subjects[sk].questions || []).forEach(q => {
  if (want.length && want.indexOf(q.id) < 0) return;
  const r = packagize(q, sk);
  const file = path.join(OUT, "example-" + q.id + ".json");
  fs.writeFileSync(file, JSON.stringify(r.pkg, null, 2) + "\n");
  rows.push({ id: q.id, paths: r.pkg.pathways.length, bytes: fs.statSync(file).size,
    unmapped: r.unmapped, readiness: readiness(r.pkg) });
}));
fs.writeFileSync(path.join(OUT, "shared-learning.json"),
  JSON.stringify({ schema: "marginal.shared-learning", version: 1, lessons: sharedLearning }, null, 2) + "\n");

console.log("\nreadiness");
rows.forEach(r => console.log("  " + r.id.padEnd(8) + r.paths + " pathways   " + r.readiness.headline));
console.log("\nextracted lessons: " + Object.keys(sharedLearning).length + " -> docs/contract/shared-learning.json");
const tally = {};
rows.forEach(r => r.unmapped.forEach(u => {
  const key = u.replace(/^[a-z0-9-]+: /, "").replace(/"[^"]*"/g, "…").replace(/\d+ evidence/, "N evidence");
  tally[key] = (tally[key] || 0) + 1;
}));
console.log("\nunmapped, by kind");
Object.keys(tally).sort((a, b) => tally[b] - tally[a]).forEach(k => console.log("  " + String(tally[k]).padStart(4) + "  " + k));
