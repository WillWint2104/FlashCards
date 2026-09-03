// QUESTION PACKAGE VALIDATOR
//
// Reads a package and a library manifest and says what is wrong with it. It
// writes nothing, imports nothing, and has no path to a registry: the importer
// is a later piece of work and this is the part of it that has to be right
// first. Everything runs; nothing stops at the first fault. A report that says
// "1 error" when there are nine is the same failure as a green aggregate whose
// checks never executed.
//
//   node tools/validate.js packages/bus.mkt-01.guided.json
//   node tools/validate.js --json packages/…json
//
// The five things a report must never collapse into one number, because the
// person fixing them does something different for each:
//
//   MISSING RECORD      a ref names an id that exists nowhere. Author error.
//   PARTIAL RECORD      the record exists and is half written. Content work.
//   BAD REF             the shape of the ref is wrong: a term string where an
//                       id belongs, a role that is not a role.
//   UNKNOWN ENUM        a value outside a list the libraries define. Never a
//                       runtime fallback: the runtime may stay defensive, and
//                       imported content may not lean on it.
//   UNRESOLVED DEPENDENCY   the package is right and the library is not ready.
//                       Nothing to fix in the package at all.
const fs = require("fs");
const path = require("path");

const SEV = { error: "error", blocked: "blocked", shortfall: "shortfall", warning: "warning" };
// Library ids are dotted, question and pathway ids are not. Both are lower
// case: an id that differs from another only by case is two records to a file
// system and one to a person.
const ID_RE = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
const QID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FORMAT = "marginal.question-package";
const VERSION = 1;
const MARKS_MIN = 1, MARKS_MAX = 40;
const FULL_LADDER = 5;

function validate(pkg, man) {
  const F = [];
  const add = (sev, code, p, message) => F.push({ severity: sev, code: code, path: p, message: message });
  const enums = (man && man.enums) || {};
  const lib = (man && man.records) || {};
  const provides = (pkg && pkg.provides) || {};

  // ---- envelope ------------------------------------------------------------
  if (!pkg || typeof pkg !== "object") {
    add(SEV.error, "PACKAGE_NOT_AN_OBJECT", "", "the file did not parse to an object");
    return finish(pkg, F, null);
  }
  if (pkg.format !== FORMAT) {
    add(SEV.error, "FORMAT_UNKNOWN", "format", "expected " + FORMAT + ", found " + JSON.stringify(pkg.format));
    return finish(pkg, F, null);
  }
  if (pkg.formatVersion !== VERSION) {
    add(SEV.error, "FORMAT_VERSION_UNSUPPORTED", "formatVersion",
      "this validator understands version " + VERSION + ", the package declares " + JSON.stringify(pkg.formatVersion));
    return finish(pkg, F, null);
  }
  const head = pkg.package || {};
  ["id", "subject", "intent"].forEach(k => {
    if (!String(head[k] || "").trim()) add(SEV.error, "FIELD_MISSING", "package." + k, "required");
  });
  if (head.id && !ID_RE.test(head.id)) add(SEV.error, "ID_MALFORMED", "package.id", JSON.stringify(head.id));
  const intentKnown = (enums.intents || []).indexOf(head.intent) >= 0;
  if (head.intent && !intentKnown) {
    add(SEV.error, "INTENT_UNKNOWN", "package.intent",
      JSON.stringify(head.intent) + " is not one of " + (enums.intents || []).join(", "));
  }

  // ---- question ------------------------------------------------------------
  const q = pkg.question || {};
  if (!pkg.question) add(SEV.error, "FIELD_MISSING", "question", "required");
  ["id", "text", "command"].forEach(k => {
    if (!String(q[k] || "").trim()) add(SEV.error, "FIELD_MISSING", "question." + k, "required");
  });
  if (q.id && !QID_RE.test(q.id)) add(SEV.error, "ID_MALFORMED", "question.id", JSON.stringify(q.id) + " is not lower case with hyphens");
  if (q.marks == null) add(SEV.error, "FIELD_MISSING", "question.marks", "required");
  else if (typeof q.marks !== "number" || q.marks % 1) add(SEV.error, "FIELD_TYPE", "question.marks", "expected a whole number");
  else if (q.marks < MARKS_MIN || q.marks > MARKS_MAX)
    add(SEV.error, "MARKS_OUT_OF_RANGE", "question.marks", q.marks + " is outside " + MARKS_MIN + " to " + MARKS_MAX);

  const cmd = String(q.command || "").toLowerCase().trim();
  if (cmd) {
    if ((enums.directives || []).indexOf(cmd) < 0) {
      // A command outside the family lists does not fail loudly at runtime: it
      // falls through to causal, and a judgement question is then scaffolded as
      // a causal one all the way to submission. Eight commands that have an
      // answer shape are in exactly that position today.
      const hasShape = (enums.answerShapeCommands || []).indexOf(cmd) >= 0;
      add(hasShape ? SEV.warning : SEV.error, hasShape ? "DIRECTIVE_NO_FAMILY" : "DIRECTIVE_UNKNOWN",
        "question.command", JSON.stringify(q.command) +
        (hasShape ? " has an answer shape but is in neither directive family, so it resolves to causal by fallback"
                  : " is not a directive this content knows"));
    }
  }
  if (q.topicRef && q.topicLabel)
    add(SEV.error, "FIELD_CONFLICT", "question.topicRef", "a question carries a ref or a label, never both");
  if (q.criteria && q.criteria.bands && !String(q.criteria.source || "").trim())
    add(SEV.error, "BANDS_WITHOUT_SOURCE", "question.criteria",
      "band descriptors are present with no source named. Marking language is quoted from somewhere or it is invented");
  (((q.decode || {}).highlights) || []).forEach((h, i) => {
    if (h && h.anchor && String(q.text || "").indexOf(h.anchor) < 0)
      add(SEV.error, "HIGHLIGHT_ANCHOR_ABSENT", "question.decode.highlights[" + i + "].anchor",
        JSON.stringify(h.anchor) + " is not in the question text, so nothing on screen can be highlighted");
  });
  const areas = q.areas || {};
  (((q.requirements || {}).requiredAreas) || []).forEach((a, i) => {
    const id = typeof a === "string" ? a : (a || {}).id;
    if (!id || !areas[id])
      add(SEV.error, "AREA_REF_UNKNOWN", "question.requirements.requiredAreas[" + i + "]",
        JSON.stringify(id) + " is not a key of question.areas");
  });

  // ---- pathways ------------------------------------------------------------
  const paths = pkg.pathways || [];
  const seen = {};
  paths.forEach((p, i) => {
    const at = "pathways[" + i + "]";
    if (!String(p.id || "").trim()) add(SEV.error, "FIELD_MISSING", at + ".id", "required");
    else if (seen[p.id]) add(SEV.error, "ID_DUPLICATE_IN_PACKAGE", at + ".id", JSON.stringify(p.id) + " is used twice");
    else seen[p.id] = 1;
    if (p.area && !areas[p.area])
      add(SEV.error, "PATHWAY_AREA_UNKNOWN", at + ".area", JSON.stringify(p.area) + " is not a key of question.areas");
    const st = ((p.learning || {}).status);
    if (st && (enums.learningStatus || []).indexOf(st) < 0)
      add(SEV.error, "LEARNING_STATUS_UNKNOWN", at + ".learning.status",
        JSON.stringify(st) + " is not one of " + (enums.learningStatus || []).join(", "));
  });

  // ---- refs ----------------------------------------------------------------
  // One resolver for every library, so a new ref kind cannot be added with a
  // weaker check than the ones beside it.
  const known = kind => Object.assign({}, lib[kind] || {},
    // a record the package brings is resolvable, and is checked as strictly
    Object.keys(provides[kind] || {}).reduce((a, id) => (a[id] = completeness(kind, provides[kind][id]), a), {}));
  const asked = { vocabulary: [], concepts: [], evidence: [], resources: [], syllabus: [] };
  function ref(kind, id, at, codes) {
    asked[kind].push(id);
    const rec = known(kind)[id];
    if (!rec) {
      // Declared in requires and absent from the library is a DIFFERENT fact from
      // referenced out of nowhere and absent. The first is a library that is not
      // ready and has nothing wrong with the package; the second is a ref the
      // author typed and never declared. Reporting both here would say the same
      // thing twice under two headings and hide which one it actually is.
      if (((pkg.requires || {})[kind] || []).indexOf(id) >= 0) return;
      add(SEV.error, codes.unknown, at, JSON.stringify(id) + " names no record in the " + kind + " library, and is not declared in requires");
      return;
    }
    if (!rec.complete)
      add(SEV.error, codes.partial, at,
        JSON.stringify(id) + " exists and is half written: " + (rec.missing || []).join(", ") + " missing");
  }
  function walkVocab(list, at) {
    (list || []).forEach((r, i) => {
      const p = at + "[" + i + "]";
      if (typeof r === "string" && !ID_RE.test(r)) {
        // the old pattern, in the one shape an author would reintroduce it
        add(SEV.error, "VOCAB_REF_NOT_AN_ID", p,
          JSON.stringify(r) + " looks like a term rather than an id. Vocabulary is named by id and never matched by its own text");
        return;
      }
      const id = typeof r === "string" ? r : (r || {}).id;
      if (!id) { add(SEV.error, "FIELD_MISSING", p + ".id", "required"); return; }
      ref("vocabulary", id, p, { unknown: "VOCAB_REF_UNKNOWN", partial: "VOCAB_RECORD_PARTIAL" });
      const role = typeof r === "object" && r.role;
      if (role && (enums.vocabularyRoles || []).indexOf(role) < 0)
        add(SEV.error, "VOCAB_ROLE_UNKNOWN", p + ".role",
          JSON.stringify(role) + " is not one of " + (enums.vocabularyRoles || []).join(", "));
    });
  }
  function walkRefs(o, at) {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach((x, i) => walkRefs(x, at + "[" + i + "]"));
    Object.keys(o).forEach(k => {
      const v = o[k], p = at + "." + k;
      if (k === "vocabRefs") walkVocab(v, p);
      else if (k === "studyRefs") (v || []).forEach((id, i) =>
        ref("resources", id, p + "[" + i + "]", { unknown: "RESOURCE_REF_UNKNOWN", partial: "RESOURCE_RECORD_PARTIAL" }));
      else if (k === "evidenceRefs") (v || []).forEach((e, i) =>
        ref("evidence", typeof e === "string" ? e : (e || {}).id, p + "[" + i + "]",
          { unknown: "EVIDENCE_REF_UNKNOWN", partial: "EVIDENCE_RECORD_PARTIAL" }));
      else if (k === "syllabusRef" || k === "topicRef")
        ref("syllabus", v, p, { unknown: "SYLLABUS_REF_UNKNOWN", partial: "SYLLABUS_RECORD_PARTIAL" });
      else if (k === "conceptRef")
        ref("concepts", v, p, { unknown: "CONCEPT_REF_UNKNOWN", partial: "CONCEPT_RECORD_PARTIAL" });
      else if (k === "conceptRefs")
        ["primary", "supporting", "optional"].forEach(tier => ((v || {})[tier] || []).forEach((id, i) =>
          ref("concepts", id, p + "." + tier + "[" + i + "]",
            { unknown: "CONCEPT_REF_UNKNOWN", partial: "CONCEPT_RECORD_PARTIAL" })));
      else if (k === "exploreRef" && v && v.conceptRef)
        ref("concepts", v.conceptRef, p + ".conceptRef", { unknown: "CONCEPT_REF_UNKNOWN", partial: "CONCEPT_RECORD_PARTIAL" });
      else walkRefs(v, p);
    });
  }
  walkRefs(q, "question");
  walkRefs(paths, "pathways");

  // ---- provides ------------------------------------------------------------
  // A package may bring shared records. It may not quietly replace one: a
  // definition two other questions already point at is not this package's to
  // rewrite during an import.
  Object.keys(provides).forEach(kind => {
    Object.keys(provides[kind] || {}).forEach(id => {
      const at = "provides." + kind + "[" + JSON.stringify(id) + "]";
      if (!ID_RE.test(id)) add(SEV.error, "ID_MALFORMED", at, JSON.stringify(id));
      if ((lib[kind] || {})[id])
        add(SEV.error, "PROVIDES_CONFLICT", at,
          JSON.stringify(id) + " already exists in the " + kind + " library. An import adds records; it does not overwrite them");
      const c = completeness(kind, provides[kind][id]);
      if (!c.complete)
        add(SEV.error, kindPartialCode(kind), at, "half written: " + c.missing.join(", ") + " missing");
    });
  });

  // ---- requires ------------------------------------------------------------
  const declared = pkg.requires || {};
  Object.keys(asked).forEach(kind => {
    const want = [...new Set(asked[kind])].sort();
    const said = [...new Set(declared[kind] || [])].sort();
    const missingFromRequires = want.filter(x => said.indexOf(x) < 0);
    const extraInRequires = said.filter(x => want.indexOf(x) < 0);
    missingFromRequires.forEach(id => add(SEV.error, "REQUIRES_MISMATCH", "requires." + kind,
      JSON.stringify(id) + " is referenced and not declared"));
    extraInRequires.forEach(id => add(SEV.error, "REQUIRES_MISMATCH", "requires." + kind,
      JSON.stringify(id) + " is declared and never referenced"));
    // Declared, well formed, and the library does not have it. Nothing here is
    // the author's to fix, so it is not an error against the package.
    said.forEach(id => {
      if (!(lib[kind] || {})[id] && !((provides[kind] || {})[id]))
        add(SEV.blocked, "DEPENDENCY_ABSENT", "requires." + kind,
          JSON.stringify(id) + " is not in this library and the package does not provide it");
    });
  });

  // ---- em dashes in what a student reads -----------------------------------
  studentText(q, paths).forEach(hit => {
    if (hit.text.indexOf("—") >= 0)
      add(SEV.warning, "EM_DASH_IN_STUDENT_TEXT", hit.path, "an em dash reaches a student here");
  });

  // ---- intent --------------------------------------------------------------
  const r = readiness(q, paths, known);
  if (intentKnown) intentChecks(head.intent, q, paths, r, add);
  return finish(pkg, F, r);
}

// A record is complete when everything the thing referencing it will render is
// present. Partial is its own answer, never folded into missing.
const NEED = {
  vocabulary: ["term", "plain", "subject", "example"],
  concepts: ["oneLine", "title", "quick"],
  evidence: ["label", "fact", "use"],
  resources: ["label", "url"],
  syllabus: ["point", "what", "why"],
};
function completeness(kind, rec) {
  const missing = (NEED[kind] || []).filter(f => !String((rec || {})[f] == null ? "" : rec[f]).trim());
  return { complete: !missing.length, missing: missing, sourced: !!String((rec || {}).source || "").trim() };
}
const kindPartialCode = kind => ({ vocabulary: "VOCAB_RECORD_PARTIAL", concepts: "CONCEPT_RECORD_PARTIAL",
  evidence: "EVIDENCE_RECORD_PARTIAL", resources: "RESOURCE_RECORD_PARTIAL",
  syllabus: "SYLLABUS_RECORD_PARTIAL" })[kind] || "RECORD_PARTIAL";

// Every string a student can read, with where it came from, so a rule about
// student-facing writing is checked against student-facing writing and not
// against authoring notes.
function studentText(q, paths) {
  const out = [];
  const take = (v, p) => {
    if (typeof v === "string") out.push({ path: p, text: v });
    else if (Array.isArray(v)) v.forEach((x, i) => take(x, p + "[" + i + "]"));
    else if (v && typeof v === "object") Object.keys(v).forEach(k => take(v[k], p + "." + k));
  };
  ["text", "connectIntro", "decode", "workingAnswer", "coreAnswer", "areas", "plan", "argument"].forEach(k => take(q[k], "question." + k));
  paths.forEach((p, i) => ["meaning", "whatToProve", "commonMistake", "guides", "help", "learning"]
    .forEach(k => take(p[k], "pathways[" + i + "]." + k)));
  return out;
}

// ---- readiness --------------------------------------------------------------
// Measured, never declared. Each dimension answers one question about what a
// student can actually be given, and each is reported on its own: a question can
// be fully guided and carry no sourced evidence at all, and one number would
// hide exactly that.
function readiness(q, paths, known) {
  const n = paths.length;
  const conceptIds = new Set();
  paths.forEach(p => {
    const c = ((p.learning || {}).conceptRefs) || {};
    ["primary", "supporting", "optional"].forEach(t => (c[t] || []).forEach(id => conceptIds.add(id)));
    if (p.conceptRef) conceptIds.add(p.conceptRef);
  });
  const conceptsComplete = [...conceptIds].filter(id => (known("concepts")[id] || {}).complete).length;
  const evAll = [], evSourcedPaths = paths.filter(p => (p.evidenceRefs || []).some(e => {
    const id = typeof e === "string" ? e : e.id; evAll.push(id);
    return (known("evidence")[id] || {}).sourced;
  })).length;
  const vocabAsked = [], vocabOk = [];
  const collectVocab = o => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(collectVocab);
    Object.keys(o).forEach(k => {
      if (k === "vocabRefs") (o[k] || []).forEach(r => {
        const id = typeof r === "string" ? r : (r || {}).id; if (!id) return;
        vocabAsked.push(id); if ((known("vocabulary")[id] || {}).complete) vocabOk.push(id);
      });
      else collectVocab(o[k]);
    });
  };
  collectVocab({ q: q, paths: paths });
  return {
    guidance: { have: paths.filter(p => String(p.meaning || "").trim()).length, of: n,
      note: "pathways that say what the argument means" },
    teaching: { have: paths.filter(p => (p.learning || {}).status === "authored").length, of: n,
      note: "pathways carrying a lesson for a student who does not know the content" },
    concepts: { have: conceptsComplete, of: conceptIds.size,
      note: "concepts this question names, against concepts something explains" },
    ladders: { have: paths.filter(p => Object.keys(p.help || {}).length >= FULL_LADDER).length, of: n,
      note: "pathways whose help ladder is deep enough to climb (" + FULL_LADDER + " rungs)" },
    evidence: { have: evSourcedPaths, of: n,
      note: "pathways with at least one evidence item carrying a source" },
    vocabulary: { have: [...new Set(vocabOk)].length, of: [...new Set(vocabAsked)].length,
      note: "vocabulary asked for by name, against complete records" },
    recovery: { have: q.reasoning ? 1 : 0, of: 1,
      note: "the question can notice an argument running the wrong way" },
  };
}
const met = d => d.of > 0 && d.have === d.of;
function intentChecks(intent, q, paths, r, add) {
  if (intent === "write-only") {
    if (paths.length)
      add(SEV.warning, "INTENT_UNDERSTATED", "package.intent",
        "declared write-only and carries " + paths.length + " pathways, which a student will never be offered");
    return;
  }
  if (!paths.length) {
    add(SEV.shortfall, "SHORTFALL_NO_PATHWAYS", "pathways", "declared " + intent + " with no pathways to guide");
    return;
  }
  if (!met(r.guidance))
    add(SEV.shortfall, "SHORTFALL_PATHWAY_NO_MEANING", "pathways",
      (r.guidance.of - r.guidance.have) + " of " + r.guidance.of + " pathways have no meaning written");
  if (intent !== "learn-and-build") return;
  if (!met(r.teaching))
    add(SEV.shortfall, "SHORTFALL_NO_TEACHING", "pathways[].learning",
      r.teaching.have + " of " + r.teaching.of + " pathways carry a lesson");
  if (!met(r.concepts))
    add(SEV.shortfall, "SHORTFALL_CONCEPT_UNEXPLAINED", "pathways[].learning.conceptRefs",
      r.concepts.have + " of " + r.concepts.of + " named concepts have a complete record");
  if (!met(r.ladders))
    add(SEV.shortfall, "SHORTFALL_NO_LADDER", "pathways[].help",
      r.ladders.have + " of " + r.ladders.of + " pathways carry a full help ladder");
  if (!met(r.evidence))
    add(SEV.shortfall, "SHORTFALL_EVIDENCE_UNSOURCED", "pathways[].evidenceRefs",
      r.evidence.have + " of " + r.evidence.of + " pathways have evidence carrying a source");
  if (!met(r.recovery))
    add(SEV.shortfall, "SHORTFALL_NO_RECOVERY", "question.reasoning",
      "nothing tells the app which way this argument runs, so it cannot notice one running backwards");
}

function finish(pkg, F, r) {
  const counts = { error: 0, blocked: 0, shortfall: 0, warning: 0 };
  F.forEach(f => counts[f.severity]++);
  const verdict = counts.error ? "rejected"
    : counts.blocked ? "blocked on the library"
    : counts.shortfall ? "accepted below its declared intent"
    : counts.warning ? "accepted with warnings" : "accepted";
  return {
    package: ((pkg || {}).package || {}).id || "(unnamed)",
    declaredIntent: ((pkg || {}).package || {}).intent || "",
    verdict: verdict,
    wouldImport: !counts.error && !counts.blocked,
    counts: counts,
    findings: F,
    readiness: r,
  };
}

// ---- report -----------------------------------------------------------------
function format(rep) {
  const out = [];
  out.push("package    " + rep.package + "   declared: " + rep.declaredIntent);
  out.push("verdict    " + rep.verdict);
  out.push("");
  const order = ["error", "blocked", "shortfall", "warning"];
  const HEAD = { error: "ERRORS — the package is wrong and does not import",
                 blocked: "BLOCKED — the package is right and the library is not ready",
                 shortfall: "SHORTFALLS — well formed, and does not reach the intent it declares",
                 warning: "WARNINGS — imports, and is recorded" };
  order.forEach(sev => {
    const hits = rep.findings.filter(f => f.severity === sev);
    if (!hits.length) return;
    out.push(HEAD[sev] + " (" + hits.length + ")");
    hits.forEach(f => {
      out.push("  " + f.code);
      out.push("      at " + (f.path || "(root)"));
      out.push("      " + f.message);
    });
    out.push("");
  });
  if (rep.readiness) {
    out.push("READINESS — measured, not declared");
    Object.keys(rep.readiness).forEach(k => {
      const d = rep.readiness[k];
      out.push("  " + (k + "            ").slice(0, 12) + (d.have + "/" + d.of + "        ").slice(0, 8) + d.note);
    });
    out.push("");
  }
  out.push(rep.wouldImport ? "would import" : "would NOT import");
  return out.join("\n");
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const asJson = args.indexOf("--json") >= 0;
  const files = args.filter(a => a !== "--json");
  if (!files.length) { console.error("usage: node tools/validate.js [--json] <package.json> [...]"); process.exit(2); }
  const manPath = path.join(__dirname, "..", "packages", "library-manifest.json");
  const man = JSON.parse(fs.readFileSync(manPath, "utf8"));
  let worst = 0;
  files.forEach((f, i) => {
    let pkg = null, parseError = null;
    try { pkg = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { parseError = e.message; }
    const rep = parseError
      ? { package: f, declaredIntent: "", verdict: "rejected", wouldImport: false,
          counts: { error: 1, blocked: 0, shortfall: 0, warning: 0 },
          findings: [{ severity: "error", code: "PACKAGE_NOT_JSON", path: f, message: parseError }], readiness: null }
      : validate(pkg, man);
    if (asJson) console.log(JSON.stringify(rep, null, 1));
    else { if (i) console.log("\n" + "-".repeat(70) + "\n"); console.log(format(rep)); }
    if (!rep.wouldImport) worst = 1;
  });
  process.exit(worst);
}
module.exports = { validate, format, completeness, readiness };
