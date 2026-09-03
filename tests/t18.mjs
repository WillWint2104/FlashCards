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
  const at = (rep, k) => rep.capability.dimensions[k].status === "reached";
  const bad = reports.filter(x => x.r.counts.error || x.r.counts.blocked);
  ok(!bad.length, "none of the nineteen is rejected or blocked: " +
    JSON.stringify(bad.map(x => x.id + " " + JSON.stringify(codes(x.r)))));
  const guided = reports.filter(x => at(x.r, "pathway-guided")).map(x => x.id).sort();
  console.log("    guided:", JSON.stringify(guided));
  ok(JSON.stringify(guided) === JSON.stringify(["fin-01", "hr-01", "mkt-01"]),
    "the three questions with authored arguments are the three that report guided: " + JSON.stringify(guided));
  const stem = reports.filter(x => !at(x.r, "writing-ready")).map(x => x.id).sort();
  ok(stem.length === 6 && stem.every(x => /^ah-/.test(x)),
    "and the six carrying only a stem say so rather than being dressed up: " + JSON.stringify(stem));
  // The point of six dimensions rather than one score.
  const mkt = reports.find(x => x.id === "mkt-01").r;
  ok(at(mkt, "pathway-guided") && !at(mkt, "evidence-complete"),
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

console.log("1b. every package declares the contract it was authored against");
{
  const gen = require("../tools/contract/generate.js");
  ok(gen.CONTRACT_VERSION === "1.0", "the contract is at " + gen.CONTRACT_VERSION);
  IDS.forEach(id => {
    const p = read("docs/contract/example-" + id + ".json");
    ok(p.contractVersion === gen.CONTRACT_VERSION && p.schema === "marginal.question-package",
      id + " carries the version and the package type: " + JSON.stringify([p.schema, p.contractVersion]));
    ok(!("version" in p), id + " carries no second version field");
  });
  // The exporter writes it. A version somebody maintains by hand is a version
  // that eventually describes a file it is not on.
  const src = readFileSync(url("tools/contract/packagize.js"), "utf8");
  ok(/contractVersion: require\("\.\/generate\.js"\)\.CONTRACT_VERSION/.test(src),
    "and the exporter takes it from one place rather than writing a literal");

  const base = read("docs/contract/example-mkt-01.json");
  const at = v => { const c = JSON.parse(JSON.stringify(base)); c.contractVersion = v; return validate(c, MAN); };
  // A different major is refused, and nothing else in the file is read: that is
  // the whole point of stopping rather than checking what it recognises.
  [["2.0", "a later major"], ["0.9", "an earlier major"]].forEach(([v, why]) => {
    const r = at(v);
    ok(codes(r).join() === "CONTRACT_VERSION_UNSUPPORTED", why + " is refused, and alone: " + JSON.stringify(codes(r)));
    ok(!r.wouldImport, why + " does not import");
    ok(/guessing at that is worse than stopping/.test(r.findings[0].message), "and says why it stopped");
  });
  ["1", 1, "x", null, "1.0.0"].forEach(v => {
    const r = at(v);
    ok(codes(r).join() === "CONTRACT_VERSION_MALFORMED",
      JSON.stringify(v) + " is not a major.minor version: " + JSON.stringify(codes(r)));
  });
  // Same major, later minor: checked against everything this reader knows, and
  // told that it is not everything. No migration framework, and no refusal.
  const ahead = at("1.7");
  ok(ahead.wouldImport, "a later minor still imports: " + ahead.verdict);
  ok(codes(ahead).indexOf("CONTRACT_VERSION_AHEAD") >= 0, "with a warning that says so");
  ok(ahead.findings.find(f => f.code === "CONTRACT_VERSION_AHEAD").severity === "warning",
    "which is a warning rather than an error");
  ok(ahead.capability.headline === validate(base, MAN).capability.headline,
    "and everything else is still checked: " + ahead.capability.headline);
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
  // and the second vocabulary authority, which is the join that would come back
  // through an import rather than through the source
  ok(got.indexOf("SECOND_VOCABULARY_AUTHORITY") >= 0,
    "a concept arriving with its own term definitions is rejected: " + JSON.stringify(got.filter(c => /VOCAB/.test(c))));
}

console.log("3b. the directive registry replaces the causal fallback with three answers");
{
  const REG = require("../tools/contract/directives.js").registry();
  ok(/^none\./.test(REG.fallback), "the registry states that there is no fallback: " + REG.fallback.slice(0, 20));
  ok(REG.counts.known === 22 && REG.counts.unsupported === 8,
    "22 known commands, 8 of them unsupported in guided writing: " + JSON.stringify(REG.counts));
  // unknown: an error
  const bad = validate(read("docs/contract/invalid-demo.json"), MAN);
  ok(codes(bad).indexOf("DIRECTIVE_UNKNOWN") >= 0, "a command the registry does not list does not import");
  // known and unsupported: a VALID question that is offered no scaffolding
  const un = validate(read("docs/contract/unsupported-directive-demo.json"), MAN);
  console.log("    compare:", un.verdict, un.capability.headline);
  ok(un.wouldImport, "a Compare question imports: " + un.verdict + " " + JSON.stringify(codes(un)));
  ok(un.capability.dimensions["writing-ready"].status === "reached", "and is writing ready");
  ok(un.capability.dimensions["pathway-guided"].missing.some(m => m.rule === "directive-supported"),
    "and is not pathway guided, for the stated reason: " +
    JSON.stringify(un.capability.dimensions["pathway-guided"].missing.map(m => m.rule)));
  const gw = un.capability.unavailable.find(u => u.support === "guided writing");
  ok(!!gw, "with guided writing reported as unavailable rather than served as causal");
  ok(gw && /side by side/.test(gw.reason), "and a reason a person can act on: " + (gw && gw.reason));
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

console.log("4b. one weak dimension can never be averaged away by a strong one");
{
  const caps = require("../tools/contract/capabilities.js");
  // Structural, not incidental: every capability is a conjunction of named rules
  // and there is no arithmetic anywhere in the module.
  const src = readFileSync(url("tools/contract/capabilities.js"), "utf8");
  ok(!/score|weight|average|percent|\* 100/i.test(src.replace(/^\s*\/\/.*$/gm, "")),
    "the rules carry no score, weight or average");
  ok(caps.ORDER.every(k => caps.RULES[k].length >= 3), "and each capability is several rules, not one test");
  // Demonstrated: mkt-01 is as strong as a question in this bank gets on the
  // dimensions it reaches, and one unsourced evidence record still denies it.
  const pkg = read("docs/contract/example-mkt-01.json");
  const before = validate(pkg, MAN).capability.dimensions;
  ok(before["pathway-guided"].status === "reached" && before["evidence-complete"].status === "not-reached",
    "twelve complete arguments do not make it evidence complete");
  // and the reverse: satisfying every evidence rule does not lift learning
  const strong = JSON.parse(JSON.stringify(pkg));
  strong.pathways.forEach(p => (p.evidenceRefs || []).forEach(e => { e.role = "outcome-evidence"; }));
  const after = validate(strong, MAN).capability.dimensions;
  ok(after["learning-complete"].status === "not-reached",
    "and giving every evidence reference a role does not move learning-complete");
  ok(after["evidence-complete"].missing.every(m => m.rule !== "every-reference-has-a-role"),
    "though it does answer the rule it was about: " +
    JSON.stringify(after["evidence-complete"].missing.map(m => m.rule)));
}

console.log("4c. the coverage report and the validator answer with the same rules");
{
  // Not "both look right". The same question, through two entry points, with one
  // definition between them.
  const cov = require("../tools/coverage.js").report();
  const rows = cov.filter(r => r.capability);
  ok(rows.length === cov.length, "every coverage row carries a capability result");
  rows.forEach(r => {
    const v = validate(read("docs/contract/example-" + r.id + ".json"), MAN);
    ok(v.capability.headline === r.capability.headline,
      r.id + ": " + JSON.stringify(r.capability.headline) + " vs " + JSON.stringify(v.capability.headline));
  });
}

console.log("5. capability is measured, and never quietly lowered");
{
  const r = validate(read("docs/contract/example-mkt-01.json"), MAN);
  ok(r.capability.dimensions.importable.status === "reached", "mkt-01 is importable");
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
  const REG2 = require("../tools/contract/directives.js").registry();
  ok(JSON.stringify(REG2, null, 2) + "\n" === text("docs/contract/directive-registry.json"),
    "the directive registry is what directives.js generates");
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

console.log("7b. the fixture manifest exposes handles a bot can use without knowing the question");
{
  const fx = read("docs/contract/fixture-manifest.json");
  ok(fx.personas.length === 5, "five personas: " + fx.personas.map(p => p.id).join(", "));
  ok(fx.personas.every(p => p.fails && p.needs.length), "each names what would count as a failure and what it needs");
  const mkt = fx.packages.find(p => p.package === "mkt-01");
  ok(mkt && mkt.handles.pathways.length === 12, "the handles carry every pathway: " + (mkt && mkt.handles.pathways.length));
  ok(mkt && mkt.handles.pathways.some(p => p.deepestLadder >= 5),
    "with ladder depth, so a help-seeking bot can find one to climb");
  ok(mkt && mkt.handles.slots.length > 0 && mkt.handles.areas.length === 4,
    "and the slots and areas: " + JSON.stringify(mkt && mkt.handles.areas));
  // The point of the manifest: no prose, no question text, nothing a bot would
  // have to hard-code.
  const blob = JSON.stringify(fx.packages);
  ok(!/target markets|e-marketing affect|McDonald/i.test(blob), "and no question prose at all");
  // applicability is derived from capability, not asserted
  const zero = fx.packages.find(p => p.package === "mkt-01").personas.find(x => x.persona === "zeroKnowledgeStudent");
  ok(!zero.applicable && /learning-complete/.test(zero.why),
    "a persona that needs teaching is not run against a question without it: " + JSON.stringify(zero));
}

console.log("8. nothing in the validator can write");
{
  const src = readFileSync(url("tools/contract/validate.js"), "utf8");
  const writes = src.match(/writeFileSync|appendFileSync|mkdirSync|rmSync|unlinkSync|createWriteStream/g) || [];
  ok(!writes.length, "no write call exists in it at all: " + JSON.stringify(writes));
  // The word "published" is a field on an evidence record and "commits" is in a
  // message, so a keyword scan proves nothing. What must be true is narrower and
  // checkable: the only thing it does to the file system is read, and it can
  // reach nothing else.
  const fsCalls = [...src.matchAll(/\bfs\.(\w+)/g)].map(m => m[1]);
  ok(fsCalls.every(c => c === "readFileSync"), "its only file system call is readFileSync: " + JSON.stringify([...new Set(fsCalls)]));
  ok(!/require\("(?:http|https|net|child_process|worker_threads)"\)/.test(src),
    "and it opens no network or process");
  const exported = require("../tools/contract/validate.js");
  ok(Object.keys(exported).every(k => typeof exported[k] === "function"),
    "and exports functions only, none of which is a publish step: " + JSON.stringify(Object.keys(exported)));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
