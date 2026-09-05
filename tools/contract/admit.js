// THE ADMISSION STAGE. Workflow step 5, "Review changes".
//
// It answers a question validate cannot ask: does the DESTINATION have room?
//
// validate(pkg, man) reads a library manifest, and a manifest holds shared
// records rather than questions. Nothing in it can say whether a question id is
// already taken, because that is not a fact about the package. The package is
// well formed either way. It is a fact about where the package is going, and it
// belongs at the stage that knows the destination.
//
// This is why QUESTION_ID_ALREADY_EXISTS is raised here and never in validate.
// Reporting it as a schema error would say the author wrote the file wrongly.
// They did not. The id is simply not free.
//
// WHAT THIS FILE GUARANTEES, and the reason it exists at all: the publish set
// is computed in exactly one place, from the destination registry, and there is
// no other way to obtain one. Screen 5 promises that publishing adds what was
// previewed and never replaces anything. A promise the pipeline cannot enforce
// is decoration, so the enforcement is here and the screen reads it.
//
//   node tools/contract/admit.js docs/contract/example-mkt-01.json ...
const fs = require("fs");
const lib = require("./libraries.js");
const { validate } = require("./validate.js");
const { storable } = require("./resolve.js");

// A package can be unpublishable for more than one reason at a time, and the
// reasons come from different stages and mean different things. They are kept
// as a list so that none of them is collapsed into another: a malformed package
// whose id also collides reports both, and neither is described as the other.
const STAGE = { validate: "validate", resolve: "resolve", review: "review" };

// The screen state, derived from the reasons rather than stored beside them, so
// the two can never disagree. Precedence runs earliest stage first, because the
// earliest stage is the one that stopped it.
function stateOf(reasons) {
  if (!reasons.length) return "new";
  if (reasons.some(r => r.stage === STAGE.validate)) return "rejected";
  if (reasons.some(r => r.stage === STAGE.resolve)) return "deferred";
  return "already-exists";
}

// Every key path in a document, taken from the RAW parsed package. It travels
// with the plan as a witness, so publication can prove the document it is about
// to store still has everything the file had. Comparing the stored document
// with the plan's own copy would prove nothing: both came through storable(),
// so a storable() that narrowed to known fields would narrow them equally and
// agree with itself. This is the only comparison that catches that.
function paths(v, at, out) {
  out = out || [];
  if (v === null || typeof v !== "object") { if (at) out.push(at); return out; }
  if (Array.isArray(v)) { v.forEach((x, i) => paths(x, at + "[" + i + "]", out)); if (!v.length && at) out.push(at); return out; }
  const keys = Object.keys(v);
  if (!keys.length && at) out.push(at);
  keys.forEach(k => paths(v[k], at ? at + "." + k : k, out));
  return out;
}

// A fingerprint of the registry the plan was computed against. Publish compares
// it with the registry it is about to write into, so a plan cannot be carried
// across a change in the destination and applied to a bank it never saw.
function fingerprint(reg) {
  const ids = (reg && reg.ids) || Object.keys((reg && reg.questions) || {}).sort();
  let h = 5381;
  const s = "marginal.question-registry:" + ids.length + ":" + ids.join(",");
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return ids.length + "-" + h.toString(16);
}

// ---- admission --------------------------------------------------------------
// entries: [{ source, pkg, report }]. report is optional and is produced here
// when absent, so a caller cannot skip validation by simply not supplying one.
function admit(entries, reg, man, opts) {
  if (!reg || !reg.questions) throw new Error(
    "admit requires the destination question registry. Whether an id is free is not " +
    "a property of the package, and cannot be decided without knowing what is already there");
  const M = man || lib.manifest();
  // The directive registry is passed THROUGH rather than fetched. When an entry
  // arrives without a report this is where validation happens, and validate()
  // falls back to building a registry from the content files when it is not
  // given one. That fallback is design time work: it reads the file system, so
  // it cannot run in the importer, and a caller that has a registry must be able
  // to hand it over.
  const O = opts || {};
  const seenInBatch = {};

  return (entries || []).map(e => {
    const pkg = e.pkg;
    const report = e.report || validate(pkg, M, O.registry ? { registry: O.registry } : undefined);
    const id = ((pkg || {}).question || {}).id || null;
    const reasons = [];

    if (report.counts.error)
      reasons.push({ stage: STAGE.validate, code: "PACKAGE_HAS_ERRORS",
        message: report.counts.error + (report.counts.error === 1 ? " error" : " errors") +
          " at Validate. Nothing from it is written.",
        // Named so a reader can tell a rejection apart from a collision without
        // reading prose, and so a test can prove they are never swapped.
        codes: [...new Set(report.findings.filter(f => f.severity === "error").map(f => f.code))] });

    if (report.counts.blocked)
      reasons.push({ stage: STAGE.resolve, code: "DEPENDENCY_ABSENT",
        message: report.counts.blocked + " declared " +
          (report.counts.blocked === 1 ? "dependency is" : "dependencies are") +
          " not in the library yet. The package is right and the library is not ready.",
        ids: report.findings.filter(f => f.severity === "blocked").map(f => f.message) });

    // The collision check. Evaluated for every package, including one already
    // stopped above, so that a rejected package that ALSO collides says both
    // rather than hiding one behind the other.
    const existing = id ? (reg.questions[id] || null) : null;
    if (existing)
      reasons.push({ stage: STAGE.review, code: "QUESTION_ID_ALREADY_EXISTS",
        message: JSON.stringify(id) + " is already in " + (existing.subjectLabel || existing.subject) +
          ". The existing question is unchanged, and this importer does not replace it.",
        existing: { id: existing.id, subject: existing.subject, subjectLabel: existing.subjectLabel } });

    // Two files in one batch claiming the same id. The destination is free, so
    // this is not the registry collision above, and admitting both would make
    // publication order decide which one wins.
    if (id && seenInBatch[id])
      reasons.push({ stage: STAGE.review, code: "QUESTION_ID_TWICE_IN_BATCH",
        message: JSON.stringify(id) + " is also claimed by " + seenInBatch[id] +
          ". Two files cannot add the same question." });
    if (id && !seenInBatch[id]) seenInBatch[id] = e.source || id;

    return {
      source: e.source || null, id: id, report: report,
      // Readiness is measured and carried, and is NEVER a reason. A question
      // short of a capability is publishable; it is content work afterwards.
      capability: report.capability || null,
      reasons: reasons, state: stateOf(reasons), publishable: reasons.length === 0,
    };
  });
}

// ---- the publish set --------------------------------------------------------
// The ONLY producer of what Publish would write. It takes the registry because
// it cannot be correct without it, and it throws rather than defaulting,
// because a default here would be a silent answer to "is this id free".
function plan(entries, reg, man, opts) {
  if (!reg || !reg.questions) throw new Error(
    "plan requires the destination question registry: a publish set cannot be computed " +
    "without knowing what is already there");
  const admitted = admit(entries, reg, man, opts);
  const questions = [], shared = { additions: [], referenced: [] };

  admitted.filter(a => a.publishable).forEach(a => {
    const q = a.report;
    const pkg = (entries.find(e => (e.source || null) === a.source) || {}).pkg;
    questions.push({ source: a.source, id: a.id,
      subject: (pkg.question || {}).subject || null,
      // The unit stored is the package document, whole and as authored.
      document: storable(pkg),
      // Taken from pkg, not from the copy above, on purpose. See paths().
      fidelity: paths(pkg).sort() });
    const provides = pkg.provides || {};
    Object.keys(provides).forEach(kind => Object.keys(provides[kind] || {}).forEach(rid =>
      shared.additions.push({ kind: kind, id: rid, suppliedBy: a.id })));
    const requires = pkg.requires || {};
    Object.keys(requires).forEach(kind => (requires[kind] || []).forEach(rid =>
      shared.referenced.push({ kind: kind, id: rid, referencedBy: a.id })));
  });

  return {
    schema: "marginal.publish-plan", version: 1,
    // The seal. Publish refuses a plan whose registry has changed underneath it.
    // The ids as well as the count, so that a plan which has gone stale can name
    // WHAT arrived rather than only that something did.
    checkedAgainst: { registry: fingerprint(reg),
      questions: (reg.ids || Object.keys(reg.questions)).length,
      ids: (reg.ids || Object.keys(reg.questions).sort()).slice() },
    questions: questions, shared: shared,
    held: admitted.filter(a => a.state === "already-exists"),
    deferred: admitted.filter(a => a.state === "deferred"),
    rejected: admitted.filter(a => a.state === "rejected"),
    entries: admitted,
    // What the screen counts. Derived, so the summary and the rows cannot drift.
    changes: {
      questionsAdded: questions.length,
      sharedAdded: shared.additions.length,
      sharedReferenced: [...new Set(shared.referenced.map(r => r.kind + "/" + r.id))].length,
      questionsHeld: admitted.filter(a => a.state === "already-exists").length,
      packagesDeferred: admitted.filter(a => a.state === "deferred").length,
      packagesRejected: admitted.filter(a => a.state === "rejected").length,
    },
    // The sentence Screen 5 ends on, computed rather than written on the page.
    empty: questions.length === 0 && shared.additions.length === 0,
  };
}

// ---- the write ---------------------------------------------------------------
// Not a store, and it writes nothing anywhere. It is the gate every write has to
// pass, kept here so there is no second path to a write that skipped admission.
// A caller holding a plan and a registry cannot get past it with a colliding id
// however the plan was obtained.
function writes(plan_, reg) {
  if (!plan_ || plan_.schema !== "marginal.publish-plan") throw new Error(
    "publish takes a plan from admit.plan(). There is no other way to reach a write");
  if (!reg || !reg.questions) throw new Error("publish requires the destination question registry");
  if (plan_.checkedAgainst.registry !== fingerprint(reg)) throw new Error(
    "this plan was checked against a different question bank. Review the import again");
  // Checked a second time, against the registry as it is now. The plan is
  // evidence that the check ran; it is not permission to skip it.
  plan_.questions.forEach(q => {
    if (reg.questions[q.id]) throw new Error(
      "QUESTION_ID_ALREADY_EXISTS: " + q.id + " is in the bank. A publish set may not contain it");
  });
  return plan_.questions.map(q => ({ op: "add", kind: "question", id: q.id, document: q.document }))
    .concat(plan_.shared.additions.map(a => ({ op: "add", kind: a.kind, id: a.id })));
}

module.exports = { admit, plan, writes, fingerprint, paths, STAGE, stateOf };

if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error("usage: node tools/contract/admit.js <package.json> [...]"); process.exit(2); }
  const reg = lib.questionRegistry(), man = lib.manifest();
  const entries = files.map(f => ({ source: f.split("/").pop(), pkg: JSON.parse(fs.readFileSync(f, "utf8")) }));
  const p = plan(entries, reg, man, { registry: require("./directives.js").registry() });
  console.log("destination: " + p.checkedAgainst.questions + " questions, registry " + p.checkedAgainst.registry);
  p.entries.forEach(a => {
    console.log("\n" + (a.source || a.id) + "  [" + a.state + "]" + (a.publishable ? "  WOULD BE ADDED" : ""));
    a.reasons.forEach(r => console.log("   " + r.stage + "/" + r.code + ": " + r.message));
  });
  const n = p.changes.questionsAdded;
  console.log("\nwould write: " + n + (n === 1 ? " question, " : " questions, ") +
    p.changes.sharedAdded + " shared records; " + p.changes.sharedReferenced + " referenced and unchanged");
  if (p.empty) console.log("nothing would be written");
}
