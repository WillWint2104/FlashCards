// THE PACKAGE VALIDATOR.
//
// A validator nobody has watched fail is a green light with nothing behind it.
// This suite is the proof that its checks execute: the two packages generated
// from shipped content pass, the package authored to be wrong produces one
// finding of each KIND, and the four kinds stay apart.
//
// The distinction it defends is the one an author acts on:
//
//   a ref naming nothing that exists    is not
//   a record that exists half written   is not
//   a value outside a list              is not
//   a library that has not caught up yet.
//
// Static. The validator reads files and writes nothing, so nothing here needs a
// browser, and the whole suite is under a second.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { validate } = require("../tools/validate.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };
const read = f => JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
const MAN = read("packages/library-manifest.json");
const rep = f => validate(read(f), MAN);
const codes = r => r.findings.map(f => f.code);
const bySev = (r, s) => r.findings.filter(f => f.severity === s).map(f => f.code);

console.log("1. content that ships today survives its own export");
{
  const g = rep("packages/bus.mkt-01.guided.json");
  console.log("    guided:", g.verdict, JSON.stringify(g.counts));
  ok(g.verdict === "accepted", "the generated guided package is accepted: " + g.verdict + " " + JSON.stringify(codes(g)));
  ok(g.wouldImport, "and would import");
  // The readiness numbers are computed here from the PACKAGE. tools/coverage.js
  // computes the same question from essay-content.js by a separate path, and the
  // two agreeing is what says the export did not quietly lose anything.
  const cov = require("../tools/coverage.js").report().find(r => r.id === "mkt-01");
  ok(g.readiness.guidance.have === cov.guidance && g.readiness.guidance.of === cov.pathways,
    "guidance matches the coverage tool: " + JSON.stringify(g.readiness.guidance) + " vs " + cov.guidance + "/" + cov.pathways);
  ok(g.readiness.teaching.have === cov.lessons, "teaching matches: " + g.readiness.teaching.have + " vs " + cov.lessons);
  ok(g.readiness.ladders.have === cov.laddersFull, "full ladders match: " + g.readiness.ladders.have + " vs " + cov.laddersFull);
  ok(g.readiness.evidence.have === cov.evidenceSourced, "sourced evidence matches: " + g.readiness.evidence.have + " vs " + cov.evidenceSourced);
  ok(g.readiness.evidence.have === 0, "and it is zero, because no evidence record carries a source yet");

  const w = rep("packages/anc.ah-religion.write-only.json");
  console.log("    write-only:", w.verdict, JSON.stringify(w.counts));
  ok(w.verdict === "accepted", "a write-only package with no scaffolding at all is accepted: " + w.verdict);
  ok(w.declaredIntent === "write-only" && !w.findings.length,
    "and is not told off for lacking what it never claimed: " + JSON.stringify(codes(w)));
}

console.log("2. the invalid package produces every kind of finding, separately");
{
  const r = rep("packages/invalid-demo.json");
  console.log("    counts:", JSON.stringify(r.counts));
  ok(r.verdict === "rejected", "verdict is rejected: " + r.verdict);
  ok(!r.wouldImport, "and nothing would be written");
  // Not "there are errors". The specific ones, because a validator that reports
  // twenty of the wrong thing also reports twenty.
  const want = ["FIELD_MISSING", "ID_MALFORMED", "MARKS_OUT_OF_RANGE", "DIRECTIVE_UNKNOWN",
    "FIELD_CONFLICT", "BANDS_WITHOUT_SOURCE", "HIGHLIGHT_ANCHOR_ABSENT", "AREA_REF_UNKNOWN",
    "LEARNING_STATUS_UNKNOWN", "ID_DUPLICATE_IN_PACKAGE", "PATHWAY_AREA_UNKNOWN",
    "VOCAB_REF_NOT_AN_ID", "VOCAB_RECORD_PARTIAL", "VOCAB_ROLE_UNKNOWN", "RESOURCE_RECORD_PARTIAL",
    "EVIDENCE_REF_UNKNOWN", "CONCEPT_REF_UNKNOWN", "PROVIDES_CONFLICT", "REQUIRES_MISMATCH"];
  const got = codes(r);
  const absent = want.filter(c => got.indexOf(c) < 0);
  ok(!absent.length, "every planted error is reported: missing " + JSON.stringify(absent));

  console.log("3. and the four severities are not one another");
  ok(bySev(r, "blocked").join() === "DEPENDENCY_ABSENT,DEPENDENCY_ABSENT",
    "a declared dependency the library lacks is BLOCKED, not an error against the package: " +
    JSON.stringify(bySev(r, "blocked")));
  // the same absence, undeclared, is the author's mistake and reads differently
  ok(got.indexOf("EVIDENCE_REF_UNKNOWN") >= 0 && bySev(r, "error").indexOf("EVIDENCE_REF_UNKNOWN") >= 0,
    "a ref to nothing that was never declared is an ERROR");
  const dep = r.findings.filter(f => f.code === "DEPENDENCY_ABSENT").map(f => f.message).join(" ");
  ok(!/bus\.evidence\.marketing\.a-record-nobody-has/.test(dep),
    "and the two are never reported as the same fault");
  ok(bySev(r, "shortfall").length === 6 && bySev(r, "shortfall").every(c => /^SHORTFALL_/.test(c)),
    "falling short of a declared intent is its own category: " + JSON.stringify(bySev(r, "shortfall")));
  ok(bySev(r, "warning").join() === "EM_DASH_IN_STUDENT_TEXT",
    "and a house style fault does not block an import: " + JSON.stringify(bySev(r, "warning")));

  console.log("4. partial and missing are answered differently for the same library");
  const vocab = r.findings.filter(f => /^VOCAB_/.test(f.code));
  console.log("    vocabulary findings:", JSON.stringify(vocab.map(f => f.code)));
  ok(vocab.some(f => f.code === "VOCAB_RECORD_PARTIAL" && /subject, example missing/.test(f.message)),
    "a half-written record names the fields it is missing");
  ok(vocab.some(f => f.code === "VOCAB_REF_NOT_AN_ID" && /market segmentation/.test(f.message)),
    "and a term string in a ref position is caught, which is the old pattern's one way back in");
  ok(r.readiness.vocabulary.of === 4 && r.readiness.vocabulary.have === 1,
    "readiness counts what was asked against what is usable: " + JSON.stringify(r.readiness.vocabulary));
}

console.log("5. nothing in the validator can write");
{
  const src = readFileSync(new URL("../tools/validate.js", import.meta.url), "utf8");
  const writes = src.match(/writeFileSync|appendFileSync|mkdirSync|rmSync|unlinkSync|createWriteStream/g) || [];
  ok(!writes.length, "no write call exists in it at all: " + JSON.stringify(writes));
  ok(!/registry|publish|import\(/.test(src.replace(/^\/\/.*$/gm, "")),
    "and nothing in it names a registry or a publish step: the importer is a later piece of work");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
