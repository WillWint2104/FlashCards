// THE CONTRACT.
//
// A validator nobody has watched fail is a green light with nothing behind it,
// and a guide generated once and then edited by hand is a contract with two
// versions. This suite is the proof that neither has happened:
//
//   the nineteen packages generated from the questions that ship all validate,
//   and report the capability they actually reach rather than one they claim;
//   the package authored to be wrong produces one finding of each KIND, and
//   removing any planted fault stops its code being reported;
//   the four prose joins the format replaces are rejected BY NAME, so a
//   half-migrated package cannot pass by having dropped the old field;
//   the schema, the guide and the templates still match the field definition
//   they were generated from.
//
// Static. Nothing here needs a browser and the whole suite is under a second.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { validate, libraryReadiness } = require("../tools/contract/validate.js");
const gen = require("../tools/contract/generate.js");
const lib = require("../tools/contract/libraries.js");
const { FIELDS, CONTAINERS } = require("../tools/contract/fields.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };
const url = f => new URL("../" + f, import.meta.url);
const read = f => JSON.parse(readFileSync(url(f), "utf8"));
const text = f => readFileSync(url(f), "utf8");
const MAN = lib.manifest();
const codes = r => r.findings.map(f => f.code);
const bySev = (r, s) => r.findings.filter(f => f.severity === s).map(f => f.code);
const IDS = ["ops-01", "ops-02", "ops-03", "mkt-01", "mkt-02", "mkt-03", "mkt-04",
  "fin-01", "fin-02", "fin-03", "hr-01", "hr-02", "hr-03",
  "ah-sources", "ah-religion", "ah-geography", "ah-women", "ah-power", "ah-site"];

console.log("1. every question that ships converts and validates");
{
  const reports = IDS.map(id => ({ id: id, r: validate(read("docs/contract/example-" + id + ".json"), MAN) }));
  const bad = reports.filter(x => x.r.counts.error || x.r.counts.blocked);
  ok(!bad.length, "none of the nineteen is rejected or blocked: " +
    JSON.stringify(bad.map(x => x.id + " " + JSON.stringify(codes(x.r)))));
  const guided = reports.filter(x => x.r.capability.dimensions["pathway-guided"]).map(x => x.id).sort();
  console.log("    guided:", JSON.stringify(guided));
  ok(JSON.stringify(guided) === JSON.stringify(["fin-01", "hr-01", "mkt-01"]),
    "the three questions with authored arguments are the three that report guided: " + JSON.stringify(guided));
  const stem = reports.filter(x => !x.r.capability.dimensions["writing-ready"]).map(x => x.id).sort();
  ok(stem.length === 6 && stem.every(x => /^ah-/.test(x)),
    "and the six carrying only a stem say so rather than being dressed up: " + JSON.stringify(stem));
  // The point of six dimensions rather than one score.
  const mkt = reports.find(x => x.id === "mkt-01").r;
  ok(mkt.capability.dimensions["pathway-guided"] && !mkt.capability.dimensions["evidence-complete"],
    "mkt-01 is fully guided and has no sourced evidence at all, and both are visible: " + mkt.capability.headline);
  ok(mkt.capability.measures.evidence.have === 0 && mkt.capability.measures.evidence.of === 12,
    "measured 0 of 12: " + JSON.stringify(mkt.capability.measures.evidence));
  // Cross-checked against tools/coverage.js, which measures the same question
  // from essay-content.js by an entirely separate path. Two independently
  // written tools agreeing is what says the transform lost nothing.
  const cov = require("../tools/coverage.js").report().find(x => x.id === "mkt-01");
  ok(mkt.capability.measures.guidance.of === cov.pathways, "pathway count matches coverage.js: " +
    mkt.capability.measures.guidance.of + " vs " + cov.pathways);
  ok(mkt.capability.measures.teaching.have === cov.lessons, "authored lessons match: " +
    mkt.capability.measures.teaching.have + " vs " + cov.lessons);
  ok(mkt.capability.measures.ladders.have === cov.laddersFull, "full ladders match: " +
    mkt.capability.measures.ladders.have + " vs " + cov.laddersFull);
  ok(mkt.capability.measures.evidence.have === cov.evidenceSourced, "sourced evidence matches: " +
    mkt.capability.measures.evidence.have + " vs " + cov.evidenceSourced);
}

console.log("2. a judgement question with no judgement shapes is VALID, and says what it cannot give");
{
  // The distinction the contract turns on: missing shared support is a capability
  // fact about the engine, not a malformed package.
  const r = validate(read("docs/contract/example-mkt-02.json"), MAN);
  ok(r.wouldImport, "mkt-02 imports: " + r.verdict + " " + JSON.stringify(codes(r)));
  const shapes = r.capability.unavailable.find(u => u.support === "sentence shapes");
  console.log("    unavailable:", JSON.stringify(r.capability.unavailable));
  ok(!!shapes, "and reports that sentence shape support is unavailable");
  ok(shapes && /judgement family/.test(shapes.reason), "naming the family: " + (shapes && shapes.reason));
  ok(MAN.enums.shapeCoverage.every(k => k.split(".")[0] === "causal"),
    "which is true: every authored shape is causal: " + JSON.stringify(MAN.enums.shapeFamilies));
}

console.log("3. the old prose joins are rejected by name");
{
  const base = read("docs/contract/invalid-demo.json");
  const r = validate(base, MAN);
  const want = ["LEGACY_TOPIC_LABEL", "LEGACY_QTYPE", "LEGACY_EVIDENCE_BY_LABEL", "LEGACY_CONCEPT_TRIPLE",
    "LEGACY_CONCEPT_KEYS", "LEGACY_GUIDES_HELP", "LEGACY_FROM_LABEL", "LEGACY_MEANING"];
  const got = codes(r);
  ok(!want.filter(c => got.indexOf(c) < 0).length,
    "each old shape is named: missing " + JSON.stringify(want.filter(c => got.indexOf(c) < 0)));
  // Not "the new field is absent", which a half-migrated package also satisfies.
  // Removing the legacy field must stop the code, or the check is testing
  // something else.
  const drops = {
    LEGACY_TOPIC_LABEL: p => { delete p.question.topic; },
    LEGACY_QTYPE: p => { delete p.question.qtype; },
    LEGACY_EVIDENCE_BY_LABEL: p => { delete p.pathways[0].evidence; },
    LEGACY_CONCEPT_TRIPLE: p => { delete p.pathways[0].concept; },
    LEGACY_CONCEPT_KEYS: p => { delete p.pathways[0].learning.concepts; },
    LEGACY_GUIDES_HELP: p => { delete p.pathways[0].guides; delete p.pathways[0].help; },
    LEGACY_FROM_LABEL: p => { delete p.pathways[0].fromLabel; },
    LEGACY_MEANING: p => { delete p.pathways[0].meaning; },
  };
  Object.keys(drops).forEach(code => {
    const copy = JSON.parse(JSON.stringify(base));
    drops[code](copy);
    ok(codes(validate(copy, MAN)).indexOf(code) < 0, code + " is reported for the old field and not for its absence");
  });
  // and the DIRECTIVE fallback, which is the fifth join: a command in no family
  // resolves to causal at runtime and an imported package may not lean on it
  ok(got.indexOf("DIRECTIVE_NO_FAMILY") >= 0, "a directive in no family is an error, not a silent causal fallback");
  const d = r.findings.find(f => f.code === "DIRECTIVE_NO_FAMILY");
  ok(/fallback/.test(d.message) && /may not depend/.test(d.message), "and says why: " + d.message);
}

console.log("4. every kind of finding, kept apart");
{
  const r = validate(read("docs/contract/invalid-demo.json"), MAN);
  console.log("    counts:", JSON.stringify(r.counts));
  ok(r.verdict === "rejected" && !r.wouldImport, "rejected, and nothing would be written: " + r.verdict);
  const want = ["ID_MALFORMED", "VALUE_OUT_OF_RANGE", "FIELD_CONFLICT", "BANDS_WITHOUT_SOURCE",
    "HIGHLIGHT_ANCHOR_ABSENT", "AREA_REF_UNKNOWN", "PATHWAY_REF_UNKNOWN", "ID_DUPLICATE_IN_PACKAGE",
    "VOCAB_REF_NOT_AN_ID", "VOCAB_ROLE_UNKNOWN", "EVIDENCE_ROLE_UNKNOWN", "LEARNING_STATUS_UNKNOWN",
    "MECHANISM_STATUS_UNKNOWN", "EVIDENCE_REF_UNKNOWN", "VOCAB_RECORD_PARTIAL", "RESOURCE_RECORD_PARTIAL",
    "PROVIDES_CONFLICT", "REQUIRES_MISMATCH"];
  const got = codes(r);
  ok(!want.filter(c => got.indexOf(c) < 0).length,
    "every planted code is reported: missing " + JSON.stringify(want.filter(c => got.indexOf(c) < 0)));

  ok(bySev(r, "blocked").join() === "DEPENDENCY_ABSENT,DEPENDENCY_ABSENT",
    "a declared dependency the library lacks is BLOCKED, and nothing in the package is wrong: " +
    JSON.stringify(bySev(r, "blocked")));
  // the same absence undeclared is a different fact and reads differently
  const dep = r.findings.filter(f => f.code === "DEPENDENCY_ABSENT").map(f => f.message).join(" ");
  ok(!/a-record-nobody-has/.test(dep) && got.indexOf("EVIDENCE_REF_UNKNOWN") >= 0,
    "and a ref to nothing that was never declared is an error instead, never both");
  ok(bySev(r, "shortfall").join() === "VOCAB_NOT_YET_DISPLAYABLE",
    "a record complete enough to teach with and not to display is a shortfall: " + JSON.stringify(bySev(r, "shortfall")));
  ok(bySev(r, "warning").join() === "EM_DASH_IN_STUDENT_TEXT",
    "and a house style fault does not block an import: " + JSON.stringify(bySev(r, "warning")));
  // one line about the records, not twenty-one about the places they are named
  const nd = r.findings.filter(f => f.code === "VOCAB_NOT_YET_DISPLAYABLE");
  ok(nd.length === 1, "reported once, about the records: " + nd.length);
}

console.log("5. capability is measured, and never quietly lowered");
{
  const r = validate(read("docs/contract/example-mkt-01.json"), MAN);
  ok(r.capability.dimensions.importable, "mkt-01 is importable");
  ok(r.capability.missing.join() === "learning-complete,evidence-complete",
    "and the report names what it does not reach: " + JSON.stringify(r.capability.missing));
  // Nothing in the validator writes a capability back into the package, so
  // publishing at a lower one has to be somebody's explicit action.
  const before = JSON.stringify(read("docs/contract/example-mkt-01.json"));
  const pkg = read("docs/contract/example-mkt-01.json");
  validate(pkg, MAN);
  ok(JSON.stringify(pkg) === before, "and validating does not modify the package it was given");
}

console.log("6. partial shared records are visible whether or not anything references them");
{
  const rows = libraryReadiness(MAN);
  const vocab = rows.find(x => x.library === "vocabulary");
  console.log("    vocabulary:", JSON.stringify({ records: vocab.records, complete: vocab.complete, displayable: vocab.displayable }));
  ok(vocab.records === 14, "all fourteen migrated records are counted: " + vocab.records);
  ok(vocab.displayable === 0 && vocab.teachOnly.length === 14,
    "all fourteen teach and none is displayable yet, which no ref walk would show: " +
    vocab.displayable + " displayable");
  const ev = rows.find(x => x.library === "evidence");
  ok(ev.records === 58 && ev.published === 0,
    "and 0 of 58 evidence records carry a source, which is why no question is evidence-complete: " +
    JSON.stringify({ records: ev.records, published: ev.published }));
}

console.log("7. the guide, the schema and the templates still match the definition");
{
  // Four descriptions of one format drift, and the drift is invisible until an
  // external author follows the guide and the validator rejects what they wrote.
  ok(gen.guide(MAN) === text("docs/contract/authoring-guide.md"), "the authoring guide is what fields.js generates");
  ok(JSON.stringify(gen.jsonSchema(MAN), null, 2) + "\n" === text("docs/contract/question-package.schema.json"),
    "the JSON Schema is what fields.js generates");
  ["causal", "judgement", "write-only"].forEach(k =>
    ok(JSON.stringify(gen.template(k, MAN), null, 2) + "\n" === text("docs/contract/template-" + k + ".json"),
      "the " + k + " template is what fields.js generates"));

  // and the two consumers agree about what is required
  const schema = read("docs/contract/question-package.schema.json");
  const specRequired = FIELDS.filter(f => f.required && f.omission === "invalid" && f.path.indexOf(".") < 0)
    .map(f => f.path);
  ok(specRequired.every(k => schema.required.indexOf(k) >= 0),
    "every top-level required field is required in the schema: " + JSON.stringify(specRequired));
  ok(CONTAINERS.required.every(k => schema.required.indexOf(k) >= 0),
    "and so is every required container");
  ok(schema.$defs.VocabRef.properties.role.enum.join() === MAN.enums.vocabularyRoles.join(),
    "the schema's roles come from the library rather than from a copy: " +
    JSON.stringify(schema.$defs.VocabRef.properties.role.enum));

  // every field an author can read about is a field the validator walks
  const walked = FIELDS.filter(f => !/^shared:/.test(f.owner)).length;
  ok(walked >= 70 && text("docs/contract/authoring-guide.md").split("### `").length - 1 >= walked,
    "and the guide documents every one of them: " + walked);
}

console.log("8. nothing in the validator can write");
{
  const src = readFileSync(url("tools/contract/validate.js"), "utf8");
  const writes = src.match(/writeFileSync|appendFileSync|mkdirSync|rmSync|unlinkSync|createWriteStream/g) || [];
  ok(!writes.length, "no write call exists in it at all: " + JSON.stringify(writes));
  const body = src.replace(/^\s*\/\/.*$/gm, "");
  ok(!/registry|publish\(/.test(body), "and nothing in it names a registry or a publish step");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
