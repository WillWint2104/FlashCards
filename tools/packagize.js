// DESIGN-TIME TRANSFORM, NOT THE IMPORTER.
//
// Produces example QuestionPackage v1 documents from the questions currently
// authored in source, so the proposed format can be checked against real
// content rather than against an illustration. It reads; it never writes into
// essay-content.js and nothing in the app calls it.
//
//   node tools/packagize.js hr-01 ops-02
//
// Where a field cannot be mapped without a decision, the transform records it
// under _unmapped rather than guessing, and prints the list. An empty list is
// the claim that the format covers the question; a non-empty one is the
// schema-design work still outstanding.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
global.window = {};
eval(fs.readFileSync(path.join(ROOT, "business-content.js"), "utf8"));
eval(fs.readFileSync(path.join(ROOT, "essay-content.js"), "utf8"));
const B = global.window.BUSCONTENT, E = global.window.ESSAY;

// Ids are minted deterministically here so the examples are concrete. The real
// registry has to be a committed file, because a minted id that changes when the
// prose changes is not an id.
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const TOPIC_SHORT = { operations: "ops", marketing: "mkt", finance: "fin", human_resources: "hr" };
function conceptRefFor(c) {
  if (!c) return null;
  if (c.key) return "bus.concept." + slug(c.key);
  const t = B.topics[c.topic];
  if (!t) return null;
  const sec = (t.sections || []).find(s => s.name === c.section);
  if (!sec) return null;
  const want = String(c.point || "").toLowerCase();
  const pt = (sec.points || []).find(x => String(x.point || "").toLowerCase().indexOf(want) === 0);
  if (!pt) return null;
  return ["bus", TOPIC_SHORT[c.topic] || slug(c.topic), slug(sec.name), slug(pt.point.split(/[–-]/)[0])].join(".");
}
function evidenceRefFor(topicKey, label) {
  const rec = ((B.evidence || {})[topicKey] || []).find(e => e.label === label);
  if (!rec) return null;
  return { ref: ["bus", "ev", TOPIC_SHORT[topicKey] || slug(topicKey), slug(label)].join("."), rec: rec };
}

function packagize(q, subjectKey) {
  const unmapped = [];
  const topicKey = Object.keys(B.topics).find(k => B.topics[k].label.toLowerCase() === String(q.topic).toLowerCase()) || null;
  const judgement = ((q.coreAnswer || {}).mode === "judgement");

  const pkg = {
    schema: "marginal.question-package",
    version: 1,
    question: {
      id: q.id, subject: subjectKey, topic: q.topic, directive: q.command,
      text: q.text, marks: q.marks || 20,
      terms: { first: q.term1 || "", second: q.term2 || "" },
      overallArgument: q.argument || "",
      // Structure out of the sentence: the objectives the engine used to parse
      // out of the prose are named, and the line is kept for display only.
      plan: (q.plan || []).map(line => {
        const bits = String(line).split(/\s+to\s+/i);
        return bits.length < 2 ? { line: line, strategy: line, objectives: [] }
          : { line: line, strategy: bits[0].trim(),
              objectives: bits[1].split(/\s*(?:,|and)\s*/).map(x => x.trim()).filter(Boolean) };
      }),
    },
    decode: Object.assign({}, q.decode || {}, q.connectIntro ? { connectIntro: q.connectIntro } : {}),
    requirements: q.requirements || {},
    coreAnswer: q.coreAnswer || {},
    workingAnswer: q.workingAnswer || {},
    reasoning: q.reasoning || {},
    areas: Object.keys(q.areas || {}).map(k => Object.assign({ id: slug(k), label: k }, q.areas[k])),
    pathways: (q.pathways || []).map(pw => {
      const ref = conceptRefFor(pw.concept);
      if (pw.concept && !ref) unmapped.push(pw.id + ": concept route does not resolve to an id");
      const evs = (pw.evidence || []).map(e => {
        const label = typeof e === "string" ? e : e.label;
        const hit = topicKey ? evidenceRefFor(topicKey, label) : null;
        if (!hit) { unmapped.push(pw.id + ": evidence " + JSON.stringify(label) + " does not resolve in the bank"); return null; }
        return {
          ref: hit.ref,
          // The role is the thing this format requires and the current data does
          // not carry. It cannot be inferred here, so it is left null and the
          // validator would block on it.
          role: null,
          why: (typeof e === "object" && e.why) || null,
          limits: (typeof e === "object" && e.limits) || null,
          published: !!(hit.rec.source && hit.rec.checked),
        };
      }).filter(Boolean);
      if (evs.length) unmapped.push(pw.id + ": " + evs.length + " evidence reference(s) carry no authored role");
      const out = {
        id: pw.id, areaRef: pw.area ? slug(pw.area) : null,
        short: pw.short, adds: pw.adds, relationship: pw.relationship,
        choiceMeaning: pw.choiceMeaning || pw.meaning || null,
        whatToProve: pw.whatToProve, commonMistake: pw.commonMistake,
        conceptRef: ref, learning: pw.learning || { status: "unreviewed" },
        evidenceRefs: evs, guides: pw.guides || {},
      };
      if (judgement && pw.contribution) out.contribution = pw.contribution;
      if (!judgement && pw.contribution) unmapped.push(pw.id + ": carries a judgement role on a causal question");
      if (pw.mechanism) out.mechanism = pw.mechanism;
      if (pw.help) out.help = pw.help;
      if (pw.fromLabel) out.fromLabel = pw.fromLabel;
      return out;
    }),
    marking: {
      source: q.rubric ? "authored" : "generated",
      bands: (q.criteria && q.criteria.bands) || null,
      bandSource: (q.criteria && q.criteria.source) || null,
      text: q.rubric || null,
    },
    provenance: {
      origin: q.note || null, author: null, authoredAt: null,
      reviewState: "in-source", publication: "published", notes: null,
    },
  };
  if (q.areasLabel) pkg.areasLabel = q.areasLabel;
  if (q.objectiveWords) unmapped.push("objectiveWords is dropped: plan objectives are explicit in v1");
  if (q.qtype || q.qtypeLabel) unmapped.push("qtype/qtypeLabel dropped: nothing reads them");
  pkg._unmapped = unmapped;
  return pkg;
}

const want = process.argv.slice(2);
const out = [];
Object.keys(E.subjects).forEach(sk => (E.subjects[sk].questions || []).forEach(q => {
  if (want.length && want.indexOf(q.id) < 0) return;
  if (!q.pathways) return;
  const pkg = packagize(q, sk);
  const file = path.join(ROOT, "docs", "contract", "example-" + q.id + ".json");
  const unmapped = pkg._unmapped; delete pkg._unmapped;
  fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
  out.push({ id: q.id, file: file, bytes: fs.statSync(file).size, paths: pkg.pathways.length, unmapped: unmapped });
}));
out.forEach(r => {
  console.log("\n" + r.id + "  " + r.paths + " pathways  " + r.bytes + " bytes  -> " + path.relative(ROOT, r.file));
  if (!r.unmapped.length) console.log("  everything mapped");
  else r.unmapped.forEach(u => console.log("  UNMAPPED  " + u));
});
