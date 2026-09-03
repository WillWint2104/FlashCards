// THE VALIDATOR.
//
// Reads a package and a library manifest and says what is wrong with it. It
// writes nothing, imports nothing, and has no path to a registry: the importer
// is later work and this is the part of it that has to be right first.
//
// It is driven by tools/contract/fields.js, the same file the JSON Schema, the
// authoring guide and the templates are generated from. An external author reads
// the guide; a machine reads the schema; this reads the definition both came
// from. Nothing here keeps a second copy of a rule.
//
//   node tools/contract/validate.js docs/contract/example-mkt-01.json
//   node tools/contract/validate.js --json <file> [...]
//
// FAIL BEFORE MUTATION. Every check runs on every package before any of them
// could publish. Nothing short-circuits: a report that says one error when there
// are nine is the same failure as a green aggregate whose checks never executed.
//
// The five things it must never collapse into one number, because the person
// reading it does something different for each:
//
//   MISSING RECORD          a ref names an id that exists nowhere
//   PARTIAL RECORD          the record exists and is half written
//   BAD REF                 a term string where an id belongs, a role that is
//                           not a role
//   UNKNOWN ENUM            a value outside a list the libraries define. Never
//                           a runtime fallback: the runtime may stay defensive,
//                           and imported content may not lean on it
//   UNRESOLVED DEPENDENCY   the package is right and the library is not ready
const fs = require("fs");
const path = require("path");
const { FIELDS, ENUMS, LIBRARIES, CAPABILITIES, CONTAINERS } = require("./fields.js");
const { enumValues, ID_PATTERN, QID_PATTERN } = require("./generate.js");
const caps = require("./capabilities.js");
const { storable, carriedPaths } = require("./resolve.js");
const directives = require("./directives.js");

const SEV = { error: "error", blocked: "blocked", shortfall: "shortfall", warning: "warning" };
const ID_RE = new RegExp(ID_PATTERN);
const QID_RE = new RegExp(QID_PATTERN);
const CODES = {
  vocabulary: { unknown: "VOCAB_REF_UNKNOWN", partial: "VOCAB_RECORD_PARTIAL" },
  concepts: { unknown: "CONCEPT_REF_UNKNOWN", partial: "CONCEPT_RECORD_PARTIAL" },
  lessons: { unknown: "LESSON_REF_UNKNOWN", partial: "LESSON_RECORD_PARTIAL" },
  evidence: { unknown: "EVIDENCE_REF_UNKNOWN", partial: "EVIDENCE_RECORD_PARTIAL" },
  syllabus: { unknown: "SYLLABUS_REF_UNKNOWN", partial: "SYLLABUS_RECORD_PARTIAL" },
  resources: { unknown: "RESOURCE_REF_UNKNOWN", partial: "RESOURCE_RECORD_PARTIAL" },
  criteria: { unknown: "CRITERION_REF_UNKNOWN", partial: "CRITERION_RECORD_PARTIAL" },
  sentenceShapes: { unknown: "SHAPE_REF_UNKNOWN", partial: "SHAPE_RECORD_PARTIAL" },
};
// Sentence shapes are resolved by the engine from the directive family, never
// named by a package, so they are the one library a requires block never lists.
const REQUIRABLE = Object.keys(LIBRARIES).filter(k => k !== "sentenceShapes");
// An unknown value gets a code named after its enum, so a report says which list
// the value fell outside of rather than "invalid value".
const enumCode = name => ({ vocabularyRole: "VOCAB_ROLE_UNKNOWN", evidenceRole: "EVIDENCE_ROLE_UNKNOWN",
  learningStatus: "LEARNING_STATUS_UNKNOWN", mechanismStatus: "MECHANISM_STATUS_UNKNOWN" })[name]
  || (name.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase() + "_UNKNOWN");
const FORMAT = "marginal.question-package";
// The contract this validator implements. Major is the compatibility promise and
// minor is what it has caught up with.
const { CONTRACT_MAJOR, CONTRACT_MINOR, CONTRACT_VERSION } = require("./generate.js");
const VERSION_RE = /^(\d+)\.(\d+)$/;

// Walk a field path against a package, returning every concrete instance with
// the real path so a report can name pathways[3].guidance.explain.ladder[2].rung
// rather than the pattern it came from.
function collect(root, spec) {
  let out = [{ p: "", v: root }];
  spec.split(".").forEach(raw => {
    const isArr = /\[\]$/.test(raw);
    const key = raw.replace(/\[\]$/, "");
    const free = /^<.*>$/.test(key);
    const next = [];
    out.forEach(cur => {
      if (cur.v == null || typeof cur.v !== "object") return;
      if (free) {
        Object.keys(cur.v).forEach(k => next.push({ p: cur.p + "." + k, v: cur.v[k], parent: cur.v, key: k }));
        return;
      }
      const val = cur.v[key];
      const at = (cur.p ? cur.p + "." : "") + key;
      if (isArr) {
        if (!Array.isArray(val)) { if (val != null) next.push({ p: at, v: val, parent: cur.v, key: key, notArray: true }); return; }
        val.forEach((x, i) => next.push({ p: at + "[" + i + "]", v: x, parent: val, key: i }));
        return;
      }
      next.push({ p: at, v: val, parent: cur.v, key: key, absent: !(key in cur.v) });
    });
    out = next;
  });
  return out;
}
const blank = v => v == null || (Array.isArray(v) ? !v.length : (typeof v === "string" ? !v.trim() : false));

function validate(pkg, man, opts) {
  const F = [];
  const add = (sev, code, p, message) => F.push({ severity: sev, code: code, path: p || "(root)", message: message });
  const imported = !opts || opts.imported !== false;

  if (!pkg || typeof pkg !== "object") { add(SEV.error, "PACKAGE_NOT_AN_OBJECT", "", "the file did not parse to an object"); return finish(pkg, F, null, null); }
  if (pkg.schema !== FORMAT) { add(SEV.error, "FORMAT_UNKNOWN", "schema", "expected " + FORMAT + ", found " + JSON.stringify(pkg.schema)); return finish(pkg, F, null, null); }
  // Read before anything else, and the only field allowed to stop the read. A
  // reader that does not know a major version refuses the file rather than
  // checking the fields it recognises: a field that kept its name and changed
  // its meaning is what a major version exists to announce, so validating a
  // major 2 package against major 1 rules would report confidently and wrongly.
  const semver = VERSION_RE.exec(String(pkg.contractVersion == null ? "" : pkg.contractVersion));
  if (!semver) {
    add(SEV.error, "CONTRACT_VERSION_MALFORMED", "contractVersion",
      JSON.stringify(pkg.contractVersion) + " is not a major.minor version. This validator implements " + CONTRACT_VERSION);
    return finish(pkg, F, null, null);
  }
  const major = Number(semver[1]), minor = Number(semver[2]);
  if (major !== CONTRACT_MAJOR) {
    add(SEV.error, "CONTRACT_VERSION_UNSUPPORTED", "contractVersion",
      "this package was authored against contract " + pkg.contractVersion + " and this validator implements " +
      CONTRACT_VERSION + ". Nothing else in the file has been read: a different major version means a field may " +
      "have kept its name and changed its meaning, and guessing at that is worse than stopping");
    return finish(pkg, F, null, null);
  }
  const ahead = minor > CONTRACT_MINOR;
  if (ahead) {
    // Same major, so nothing here means something else. The package may carry
    // additions this reader has never heard of, and it is checked against
    // everything the reader does know rather than refused for being newer.
    //
    // Publishing it is only safe because the whole DOCUMENT is what gets stored.
    // If publication wrote a reconstruction from the fields this version knows
    // instead, the rest would be gone and the package would come back from the
    // store smaller than it went in. Checked below rather than assumed.
    add(SEV.warning, "CONTRACT_VERSION_AHEAD", "contractVersion",
      "authored against " + pkg.contractVersion + " and checked against " + CONTRACT_VERSION +
      ". Everything this version of Marginal knows about has been checked; anything added after " +
      CONTRACT_VERSION + " has not, and is stored unchanged rather than dropped");
  }
  // Proved per package, not promised once. If a reader ever cannot hand back the
  // document it was given, it may inspect and must not publish: inspecting and
  // losing is worse than refusing.
  // Semantic, not literal: every property and value survives, and formatting is
  // not a thing Marginal keeps or claims.
  const preserved = JSON.stringify(storable(pkg)) === JSON.stringify(pkg);
  if (!preserved)
    add(SEV.error, "WOULD_NOT_PRESERVE_DOCUMENT", "",
      "this version of Marginal cannot return the document it was given, so publishing it would store less than was authored. It may be inspected and not published");

  const lib = (man && man.records) || {};
  const REG = (opts && opts.registry) || directives.registry();
  const provides = pkg.provides || {};
  const declared = pkg.requires || {};
  const asked = {}, notDisplayable = {};
  REQUIRABLE.forEach(k => { asked[k] = []; });

  // ---- containers ---------------------------------------------------------
  CONTAINERS.required.forEach(k => {
    if (!(k in pkg)) add(SEV.error, "FIELD_MISSING", k, "required");
  });

  // ---- the legacy joins, forbidden by name --------------------------------
  // Not "the new field is absent", which a half-migrated package would also
  // satisfy. The old shapes are named and rejected, because an imported package
  // that reintroduces one would work today and break the moment somebody
  // reworded a heading.
  const legacy = [
    { at: "question.topic", has: o => typeof o.question === "object" && o.question && "topic" in o.question,
      code: "LEGACY_TOPIC_LABEL", why: "a display label a keyword table guesses a topic key from. Use topicRef, or topicLabel where the subject has no syllabus library" },
    { at: "question.qtype", has: o => o.question && ("qtype" in o.question || "qtypeLabel" in o.question),
      code: "LEGACY_QTYPE", why: "nothing reads it, and the command decides the directive family" },
  ];
  legacy.forEach(r => { if (r.has(pkg)) add(SEV.error, r.code, r.at, r.why); });
  (pkg.pathways || []).forEach((pw, i) => {
    const at = "pathways[" + i + "]";
    if (pw && Array.isArray(pw.evidence))
      add(SEV.error, "LEGACY_EVIDENCE_BY_LABEL", at + ".evidence",
        "evidence matched by display label. Two records sharing a label silently become one. Use evidenceRefs with ids");
    if (pw && pw.concept && typeof pw.concept === "object")
      add(SEV.error, "LEGACY_CONCEPT_TRIPLE", at + ".concept",
        "a {topic, section, point} triple matched by prefix. Use syllabusRef and conceptRef");
    if (pw && pw.learning && pw.learning.concepts)
      add(SEV.error, "LEGACY_CONCEPT_KEYS", at + ".learning.concepts",
        "bare concept keys. A pathway references a lesson by learningRef and the lesson names concepts by id");
    if (pw && (pw.guides || pw.help))
      add(SEV.error, "LEGACY_GUIDES_HELP", at + (pw.guides ? ".guides" : ".help"),
        "guides and help are two fields for one idea. Use guidance.<slot>.{direct, ladder}");
    if (pw && "fromLabel" in pw)
      add(SEV.error, "LEGACY_FROM_LABEL", at + ".fromLabel", "the authored cause end is pathways[].left");
    if (pw && "meaning" in pw)
      add(SEV.error, "LEGACY_MEANING", at + ".meaning", "renamed to choiceMeaning, because it is what choosing this argument commits the student to");
  });

  // ---- every field in the definition --------------------------------------
  const capabilityGaps = {};
  const noteGap = (cap, at, why) => {
    capabilityGaps[cap] = capabilityGaps[cap] || [];
    if (capabilityGaps[cap].length < 40) capabilityGaps[cap].push({ path: at, why: why });
  };
  FIELDS.filter(f => !/^shared:/.test(f.owner)).forEach(f => {
    const judgementOnly = f.appliesTo === "judgement questions";
    if (judgementOnly && ((pkg.coreAnswer || {}).mode !== "judgement")) return;
    const hits = collect(pkg, f.path);
    hits.forEach(h => {
      if (blank(h.v)) {
        if (f.omission === "invalid" && f.required) {
          // A container that is legitimately null does not make every leaf
          // inside it a missing field: absent is the capability fact, reported
          // once, and forty derived complaints would bury it.
          const top = f.path.split(".")[0].replace(/\[\]$/, "");
          if (CONTAINERS.nullable.indexOf(top) >= 0 && pkg[top] == null) return;
          add(SEV.error, "FIELD_MISSING", h.p, "required: " + f.means.split(".")[0]);
        } else if (/^capability:/.test(f.omission)) {
          noteGap(f.omission.replace("capability:", ""), h.p, f.means.split(".")[0]);
        }
        return;
      }
      checkValue(f, h);
    });
  });

  function checkValue(f, h) {
    const v = h.v, at = h.p;
    switch (f.type) {
      case "const": if (v !== f.value) add(SEV.error, "FIELD_VALUE", at, "expected " + JSON.stringify(f.value)); break;
      case "integer":
        if (typeof v !== "number" || v % 1) { add(SEV.error, "FIELD_TYPE", at, "expected a whole number"); break; }
        if (f.range && (v < f.range[0] || v > f.range[1]))
          add(SEV.error, "VALUE_OUT_OF_RANGE", at, v + " is outside " + f.range[0] + " to " + f.range[1]);
        break;
      case "boolean": if (typeof v !== "boolean") add(SEV.error, "FIELD_TYPE", at, "expected true or false"); break;
      case "string": case "date": case "url":
        if (typeof v !== "string") add(SEV.error, "FIELD_TYPE", at, "expected a string");
        break;
      case "id":
        if (typeof v !== "string") { add(SEV.error, "FIELD_TYPE", at, "expected a string"); break; }
        if (!(f.pattern ? new RegExp(f.pattern) : QID_RE).test(v))
          add(SEV.error, "ID_MALFORMED", at, JSON.stringify(v) + " is not lower case with hyphens");
        break;
      case "enum": {
        if (f.enumName === "directive") {
          if (!directives.rowFor(REG, v)) enumMiss(f, at, v, []);
          break;
        }
        let vals; try { vals = enumValues(f.enumName, man); } catch (e) { add(SEV.error, "ENUM_UNDEFINED", at, e.message); break; }
        if (vals.indexOf(v) < 0) enumMiss(f, at, v, vals);
        break;
      }
      case "ref": refCheck(f.refTo, v, at); break;
      case "ref[]": (v || []).forEach((x, i) => refCheck(f.refTo, x, at + "[" + i + "]")); break;
      case "vocabRef[]": (v || []).forEach((r, i) => vocabRef(r, at + "[" + i + "]")); break;
      case "string[]":
        if (!Array.isArray(v)) add(SEV.error, "FIELD_TYPE", at, "expected an array of strings");
        break;
      default: break;
    }
    if (f.studentProse && typeof v === "string" && v.indexOf("—") >= 0)
      add(SEV.warning, "EM_DASH_IN_STUDENT_TEXT", at, "an em dash reaches a student here");
  }

  // The directive is answered by the registry, not by a family list, because
  // "unknown" and "known and unsupported" are different facts. Unknown does not
  // import. Known and unsupported is a valid question that guided writing cannot
  // serve yet, and the family-dependent guidance is withheld rather than
  // defaulted to causal, which is what the engine does on its own.
  function enumMiss(f, at, v, vals) {
    if (f.enumName === "directive") {
      add(SEV.error, "DIRECTIVE_UNKNOWN", at,
        JSON.stringify(v) + " is not a command this content recognises. The registry lists " +
        REG.commands.length + ": " + REG.commands.map(r => r.command).join(", "));
      return;
    }
    add(SEV.error, enumCode(f.enumName), at, JSON.stringify(v) + " is not one of " + vals.join(", "));
  }

  function known(kind, rid) {
    if ((lib[kind] || {})[rid]) return lib[kind][rid];
    if ((provides[kind] || {})[rid]) return { complete: true, provided: true, missing: [] };
    return null;
  }
  function refCheck(kind, rid, at) {
    if (kind === "areas in this package") {
      if (!(pkg.areas || []).some(a => a && a.id === rid))
        add(SEV.error, "AREA_REF_UNKNOWN", at, JSON.stringify(rid) + " is not an area this package defines");
      return;
    }
    if (typeof rid !== "string") { add(SEV.error, "FIELD_TYPE", at, "expected an id"); return; }
    if (!ID_RE.test(rid)) { add(SEV.error, "ID_MALFORMED", at, JSON.stringify(rid)); return; }
    asked[kind] = asked[kind] || []; asked[kind].push(rid);
    const rec = known(kind, rid);
    const codes = CODES[kind] || { unknown: "REF_UNKNOWN", partial: "RECORD_PARTIAL" };
    if (!rec) {
      // Declared in requires and absent from the library is a DIFFERENT fact
      // from referenced out of nowhere and absent. The first is a library that
      // is not ready; the second is a ref the author typed and never declared.
      // Reporting both would say it twice and hide which it is.
      if ((declared[kind] || []).indexOf(rid) >= 0) return;
      add(SEV.error, codes.unknown, at, JSON.stringify(rid) + " names no record in the " + kind + " library, and is not declared in requires");
      return;
    }
    if (!rec.complete)
      add(SEV.error, codes.partial, at, JSON.stringify(rid) + " exists and is half written: " + (rec.missing || []).join(", ") + " missing");
    return rec;
  }
  function vocabRef(r, at) {
    if (typeof r === "string") {
      add(SEV.error, "VOCAB_REF_NOT_AN_ID", at,
        JSON.stringify(r) + " looks like a term rather than an id. Vocabulary is named by id and never matched by its own text");
      return;
    }
    if (!r || !r.id) { add(SEV.error, "FIELD_MISSING", at + ".id", "required"); return; }
    const rec = refCheck("vocabulary", r.id, at + ".id");
    // A record can be complete enough to teach with and not complete enough to
    // offer as vocabulary. That is a fact about the LIBRARY, not about this ref,
    // so it is counted once per record and reported once, rather than repeated
    // at each of the twenty-one places a package happens to name it.
    if (rec && rec.complete && rec.displayable === false) notDisplayable[r.id] = rec.missingForDisplay || [];
    if (r.role != null) {
      const vals = enumValues("vocabularyRole", man);
      if (vals.indexOf(r.role) < 0)
        add(SEV.error, "VOCAB_ROLE_UNKNOWN", at + ".role",
          JSON.stringify(r.role) + " is not one of " + vals.join(", ") + ". The runtime re-buckets an unknown role defensively and imported content may not rely on that");
    }
  }

  // ---- ids unique ---------------------------------------------------------
  const seen = {};
  (pkg.pathways || []).forEach((pw, i) => {
    if (!pw || !pw.id) return;
    if (seen[pw.id]) add(SEV.error, "ID_DUPLICATE_IN_PACKAGE", "pathways[" + i + "].id", JSON.stringify(pw.id) + " is used twice");
    seen[pw.id] = 1;
  });
  const areaSeen = {};
  (pkg.areas || []).forEach((a, i) => {
    if (!a || !a.id) return;
    if (areaSeen[a.id]) add(SEV.error, "ID_DUPLICATE_IN_PACKAGE", "areas[" + i + "].id", JSON.stringify(a.id) + " is used twice");
    areaSeen[a.id] = 1;
  });

  // ---- this app's rules ---------------------------------------------------
  const q = pkg.question || {};
  if (q.topicRef && q.topicLabel)
    add(SEV.error, "FIELD_CONFLICT", "question.topicRef", "a question carries a ref or a label, never both");
  if ((pkg.marking || {}).bands && !String((pkg.marking || {}).bandSource || "").trim())
    add(SEV.error, "BANDS_WITHOUT_SOURCE", "marking.bands",
      "band descriptors are present with no source named. Marking language is quoted from somewhere or it is invented");
  (((pkg.decode || {}).highlights) || []).forEach((h, i) => {
    if (h && h.anchor && String(q.text || "").indexOf(h.anchor) < 0)
      add(SEV.error, "HIGHLIGHT_ANCHOR_ABSENT", "decode.highlights[" + i + "].anchor",
        JSON.stringify(h.anchor) + " is not in the question text, so nothing on screen can be highlighted");
  });
  const t = q.terms || {};
  if ((!blank(t.first)) !== (!blank(t.second)))
    add(SEV.error, "FIELD_CONFLICT", "question.terms", "both ends are authored or neither is");
  (pkg.pathways || []).forEach((pw, i) => {
    if (!pw) return;
    if (pw.areaRef && !(pkg.areas || []).some(a => a && a.id === pw.areaRef))
      add(SEV.error, "AREA_REF_UNKNOWN", "pathways[" + i + "].areaRef",
        JSON.stringify(pw.areaRef) + " is not an area this package defines");
    if ((pw.learning || {}).status === "authored" && !pw.learningRef)
      add(SEV.error, "LESSON_REF_MISSING", "pathways[" + i + "].learningRef",
        "learning is authored and no lesson is referenced. A pathway may reference teaching; it may not contain a lesson");
  });
  (((pkg.relationship || {}).claims) || []).forEach((c, i) => {
    (c.pathwayRefs || []).forEach((r, j) => {
      if (!seen[r]) add(SEV.error, "PATHWAY_REF_UNKNOWN", "relationship.claims[" + i + "].pathwayRefs[" + j + "]",
        JSON.stringify(r) + " is not a pathway in this package");
    });
  });

  // ---- provides -----------------------------------------------------------
  Object.keys(provides).forEach(kind => {
    Object.keys(provides[kind] || {}).forEach(rid => {
      const at = "provides." + kind + "[" + JSON.stringify(rid) + "]";
      // Vocabulary has one authority. A concept that carries its own
      // {term, meaning} pairs is a second definition system, which is the thing
      // the migration removed, so it cannot come back through an import.
      if (kind === "concepts" && ((provides[kind][rid] || {}).terms || []).length)
        add(SEV.error, "SECOND_VOCABULARY_AUTHORITY", at + ".terms",
          "a concept record may not carry its own term definitions. Vocabulary records hold meanings and a concept names them with vocabRefs");
      if (!ID_RE.test(rid)) add(SEV.error, "ID_MALFORMED", at, JSON.stringify(rid));
      if ((lib[kind] || {})[rid])
        add(SEV.error, "PROVIDES_CONFLICT", at,
          JSON.stringify(rid) + " already exists in the " + kind + " library. An import adds records; it does not overwrite them");
      const own = FIELDS.filter(f => f.owner === "shared:" + kind && f.required && f.omission === "invalid");
      const miss = own.map(f => f.path.split(".").slice(1).join(".")).filter(k => blank((provides[kind][rid] || {})[k]));
      if (miss.length) add(SEV.error, (CODES[kind] || {}).partial || "RECORD_PARTIAL", at, "half written: " + miss.join(", ") + " missing");
    });
  });

  // One line for the whole package, naming the records rather than the ref
  // sites, because the work is on the records.
  const nd = Object.keys(notDisplayable);
  if (nd.length)
    add(SEV.shortfall, "VOCAB_NOT_YET_DISPLAYABLE", "requires.vocabulary",
      nd.length + (nd.length === 1 ? " term this package asks for teaches" : " terms this package asks for teach") +
      " on the Learn surface and " + (nd.length === 1 ? "is" : "are") + " not offered in the vocabulary panel: " +
      nd.slice(0, 6).join(", ") + (nd.length > 6 ? " and " + (nd.length - 6) + " more" : "") +
      " (each is missing " + [...new Set(Object.values(notDisplayable).map(a => a.join(" and ")))].join("; ") + ")");

  // ---- requires -----------------------------------------------------------
  REQUIRABLE.forEach(kind => {
    const want = [...new Set(asked[kind] || [])].sort();
    const said = [...new Set(declared[kind] || [])].sort();
    want.filter(x => said.indexOf(x) < 0).forEach(rid =>
      add(SEV.error, "REQUIRES_MISMATCH", "requires." + kind, JSON.stringify(rid) + " is referenced and not declared"));
    said.filter(x => want.indexOf(x) < 0).forEach(rid =>
      add(SEV.error, "REQUIRES_MISMATCH", "requires." + kind, JSON.stringify(rid) + " is declared and never referenced"));
    said.forEach(rid => {
      if (!known(kind, rid))
        add(SEV.blocked, "DEPENDENCY_ABSENT", "requires." + kind,
          JSON.stringify(rid) + " is not in this library and the package does not provide it");
    });
  });

  return finish(pkg, F, capability(pkg, man, REG, F), { preservesDocument: preserved, carried: carriedPaths(pkg), aheadOfReader: ahead });
}

// ---- capabilities -----------------------------------------------------------
// Evaluated by tools/contract/capabilities.js, which is the only place the rules
// live. This function measures and reports; it does not decide.
function capability(pkg, man, REG, F) {
  const p = pkg.pathways || [], q = pkg.question || {};
  const lib = (man && man.records) || {};
  const rec = (kind, id) => (lib[kind] || {})[id] || null;
  const row = directives.rowFor(REG, q.directive);
  const dims = caps.evaluate(pkg, man, row, F.some(x => x.severity === "error"));

  // Support the ENGINE cannot give. Never a fault in the package, and kept apart
  // from capability for that reason: capability answers what the CONTENT reaches,
  // this answers what Marginal cannot yet provide for a valid question.
  const unavailable = [];
  if (row && !row.supportedInGuidedWriting)
    unavailable.push({ support: "guided writing", directive: row.command, reason: row.notes ||
      ("\"" + row.command + "\" assigns no directive family, so every slot label, sentence shape and piece of guidance chosen by family is withheld"),
      consequence: "the question is valid and can be written against; the argument scaffolding is not offered" });
  if (row && row.supportedInGuidedWriting && !row.sentenceShapeCoverage.length)
    unavailable.push({ support: "sentence shapes", directive: row.command, family: row.family,
      reason: "no sentence shape is authored for the " + row.family + " family",
      consequence: "the shape panel is withheld while a student writes this question" });

  const vocab = vocabIds(pkg);
  const measures = {
    guidance: { have: p.filter(caps.pathwayComplete).length, of: p.length,
      note: "arguments a student can choose between and be guided through" },
    teaching: { have: p.filter(x => (x.learning || {}).status === "authored").length, of: p.length,
      note: "arguments carrying a lesson for a student who does not know the content" },
    ladders: { have: p.filter(x => Object.values(x.guidance || {}).some(g => (g.ladder || []).length >= 5)).length,
      of: p.length, note: "arguments whose help ladder is deep enough to climb" },
    evidence: { have: p.filter(x => (x.evidenceRefs || []).some(e => (rec("evidence", e.ref) || {}).published)).length,
      of: p.length, note: "arguments with evidence carrying a source" },
    evidenceRoles: { have: p.reduce((n, x) => n + (x.evidenceRefs || []).filter(e => e.role).length, 0),
      of: p.reduce((n, x) => n + (x.evidenceRefs || []).length, 0),
      note: "evidence references carrying an authored role" },
    vocabulary: { have: vocab.filter(i => (rec("vocabulary", i) || {}).displayable).length, of: vocab.length,
      note: "terms asked for by name that the vocabulary panel can display" },
    recovery: { have: pkg.reasoning ? 1 : 0, of: 1,
      note: "the question can notice an argument running backwards" },
  };
  const missing = caps.ORDER.filter(k => dims[k].status !== "reached");
  return { dimensions: dims, headline: caps.headline(dims), missing: missing,
           directive: row, measures: measures, unavailable: unavailable };
}
// Only the scopes the runtime can actually resolve from. A readiness report that
// walks a scope the engine never reaches is measuring something no student can
// be given, which is the bug the vocabulary report had.
function vocabIds(pkg) {
  const out = [];
  const take = o => ((o && o.vocabRefs) || []).forEach(r => r && r.id && out.push(r.id));
  take(pkg.question);
  (pkg.areas || []).forEach(take);
  (pkg.pathways || []).forEach(take);
  return [...new Set(out)];
}

function finish(pkg, F, cap, doc) {
  const counts = { error: 0, blocked: 0, shortfall: 0, warning: 0 };
  F.forEach(f => counts[f.severity]++);
  const verdict = counts.error ? "rejected"
    : counts.blocked ? "blocked on the library"
    : counts.shortfall ? "accepted with a shortfall"
    : counts.warning ? "accepted with warnings" : "accepted";
  return {
    package: ((pkg || {}).question || {}).id || "(unnamed)",
    verdict: verdict, wouldImport: !counts.error && !counts.blocked,
    counts: counts, findings: F, capability: cap,
    // What publication would write, and what this reader is carrying without
    // interpreting. Both are facts about the DOCUMENT rather than about the
    // content, which is why they sit outside capability.
    document: doc || { preservesDocument: true, carried: [], aheadOfReader: false },
  };
}

// ---- library readiness ------------------------------------------------------
// Partial shared records are reported whether or not anything references them.
// A half-written definition nothing points at yet is content work already begun
// and not finished, and it is invisible to any report that only walks refs.
function libraryReadiness(man) {
  const out = [];
  Object.keys(man.records || {}).forEach(kind => {
    const ids = Object.keys(man.records[kind]);
    const partial = ids.filter(i => !man.records[kind][i].complete);
    const row = { library: kind, records: ids.length, complete: ids.length - partial.length, partial: partial };
    if (kind === "vocabulary") {
      row.displayable = ids.filter(i => man.records[kind][i].displayable).length;
      row.teachOnly = ids.filter(i => man.records[kind][i].complete && !man.records[kind][i].displayable);
    }
    if (kind === "evidence") {
      row.published = ids.filter(i => man.records[kind][i].published).length;
      row.unpublished = ids.length - row.published;
    }
    out.push(row);
  });
  return out;
}

// ---- report -----------------------------------------------------------------
function format(rep) {
  const out = [];
  out.push("package    " + rep.package);
  out.push("verdict    " + rep.verdict);
  if (rep.capability) out.push("capability " + rep.capability.headline);
  out.push("");
  const HEAD = { error: "ERRORS - the package is wrong and does not import",
    blocked: "BLOCKED - the package is right and the library is not ready",
    shortfall: "SHORTFALLS - well formed, and something it asks for cannot be given in full",
    warning: "WARNINGS - imports, and is recorded" };
  ["error", "blocked", "shortfall", "warning"].forEach(sev => {
    const hits = rep.findings.filter(f => f.severity === sev);
    if (!hits.length) return;
    out.push(HEAD[sev] + " (" + hits.length + ")");
    hits.forEach(f => { out.push("  " + f.code); out.push("      at " + f.path); out.push("      " + f.message); });
    out.push("");
  });
  if (rep.capability) {
    out.push("CAPABILITIES - each one a conjunction of named rules, so no strong dimension covers a weak one");
    Object.keys(rep.capability.dimensions).forEach(k => {
      const d = rep.capability.dimensions[k];
      out.push("  " + (d.status === "reached" ? "reached    " : "not reached") + "  " + k);
      d.missing.forEach(m => {
        out.push("        " + m.rule + ": " + m.says);
        (m.detail || []).forEach(x => out.push("            " + x));
      });
    });
    out.push("");
    out.push("MEASURED");
    Object.keys(rep.capability.measures).forEach(k => {
      const m = rep.capability.measures[k];
      out.push("  " + (k + "               ").slice(0, 15) + (m.have + "/" + m.of + "        ").slice(0, 8) + m.note);
    });
    out.push("");
    if (rep.capability.unavailable.length) {
      out.push("SUPPORT UNAVAILABLE - not a fault in the package");
      rep.capability.unavailable.forEach(u => {
        out.push("  " + u.support + ": " + u.reason);
        out.push("      " + u.consequence);
      });
      out.push("");
    }
  }
  if (rep.document && rep.document.aheadOfReader) {
    out.push("CARRIED UNREAD - authored against a later minor than this version of Marginal implements");
    out.push("  the whole document is stored, so every field below survives unchanged");
    rep.document.carried.slice(0, 12).forEach(p => out.push("      " + p));
    if (rep.document.carried.length > 12) out.push("      and " + (rep.document.carried.length - 12) + " more");
    out.push("");
  }
  out.push(rep.wouldImport ? "would import" : "would NOT import");
  return out.join("\n");
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const asJson = args.indexOf("--json") >= 0;
  const files = args.filter(a => a !== "--json");
  if (!files.length) { console.error("usage: node tools/contract/validate.js [--json] <package.json> [...]"); process.exit(2); }
  const man = require("./libraries.js").manifest();
  let bad = 0;
  files.forEach((f, i) => {
    let pkg = null, err = null;
    try { pkg = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { err = e.message; }
    const rep = err ? { package: f, verdict: "rejected", wouldImport: false,
      counts: { error: 1, blocked: 0, shortfall: 0, warning: 0 },
      findings: [{ severity: "error", code: "PACKAGE_NOT_JSON", path: f, message: err }], capability: null }
      : validate(pkg, man);
    if (asJson) console.log(JSON.stringify(rep, null, 1));
    else { if (i) console.log("\n" + "-".repeat(70) + "\n"); console.log(format(rep)); }
    if (!rep.wouldImport) bad = 1;
  });
  process.exit(bad);
}
module.exports = { validate, format, libraryReadiness, collect };
