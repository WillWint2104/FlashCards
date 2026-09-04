// THE APPLY MODEL. Workflow step 6, "Publish".
//
// Enough of publication to answer honestly what the screen must show, and no
// more. It holds the destination IN MEMORY and touches no file: there is no
// store yet, and a model that pretended otherwise would be the second write
// path admit.js exists to prevent.
//
// Its whole job in one line: perform exactly the additions that were reviewed,
// or perform none of them.
//
// THE ATOMIC UNIT IS THE PACKAGE, together with the shared records it provides.
// A package writes completely or not at all. A batch is NOT atomic: a package
// that has already been added stays added when a later one fails, because
// undoing a completed addition is itself a write, and unwriting on a failure
// path is how a half-understood rollback loses something. The result says which
// unit is atomic in those words, so nobody has to infer it.
//
// The shape of the write follows build.js: everything that can fail happens
// while STAGING, and promotion is the assignment that cannot. If any check for
// a package fails, nothing of that package was ever assigned.
const admit = require("./admit.js");
const { storable } = require("./resolve.js");

const OUTCOME = {
  written: "written",                       // every publishable package was added
  partial: "partially written",             // some added, some failed, none half added
  nothing: "nothing to write",              // the plan had no additions
  failed: "nothing was written",            // every package in the plan failed
  destinationChanged: "destination changed", // the bank moved under the plan, zero writes
};

// The teacher-facing sentence for a plan that no longer matches the bank. It is
// not an error report. The preview was correct when it was made and something
// else has been added since, so the answer is to look again, not to retry.
const STALE =
  "The question bank changed since this preview was created. Review changes again before publishing.";

// The destination. questions carries the ids that exist and the subject holding
// each, and never question content: nothing in publication may read an existing
// question, so nothing in publication is given one to read.
function destination(reg) {
  const questions = {};
  Object.keys(reg.questions).forEach(id => {
    questions[id] = { id: id, subject: reg.questions[id].subject,
      subjectLabel: reg.questions[id].subjectLabel, document: null };
  });
  return { schema: "marginal.destination", questions: questions, shared: {}, log: [] };
}

function registryOf(dest) {
  const questions = {};
  Object.keys(dest.questions).forEach(id => {
    const q = dest.questions[id];
    questions[id] = { id: id, subject: q.subject, subjectLabel: q.subjectLabel };
  });
  return { schema: "marginal.question-registry", version: 1,
           questions: questions, ids: Object.keys(questions).sort() };
}

// opts.failWriting: a package id the caller wants to fail, to see what a failure
// does. It fails at PROMOTION, after every check has passed, because a failure
// before the checks would prove nothing about atomicity.
function apply(plan, dest, opts) {
  const o = opts || {};
  if (!plan || plan.schema !== "marginal.publish-plan")
    throw new Error("publish takes a plan from admit.plan(). There is no other way to reach a write");
  const reg = registryOf(dest);

  // The destination is re-checked here, against the bank as it is NOW. The plan
  // is evidence the check ran at Review; it is never permission to skip it.
  if (plan.checkedAgainst.registry !== admit.fingerprint(reg))
    return result(OUTCOME.destinationChanged, [], [], plan, {
      staleMessage: STALE,
      reviewedAgainst: plan.checkedAgainst.questions,
      destinationNow: reg.ids.length,
      // Named, not just counted. "Something changed" sends a teacher back with
      // nothing to look for; "ops-04 was added" tells them what to expect.
      arrived: reg.ids.filter(id => (plan.checkedAgainst.ids || []).indexOf(id) < 0),
      departed: (plan.checkedAgainst.ids || []).filter(id => reg.ids.indexOf(id) < 0),
    });

  if (!plan.questions.length && !plan.shared.additions.length)
    return result(OUTCOME.nothing, [], [], plan, {});

  const added = [], failed = [];
  plan.questions.forEach(q => {
    const provides = plan.shared.additions.filter(a => a.suppliedBy === q.id);
    // ---- staging. Everything that can fail is above the promotion line. -----
    let staged = null, why = null;
    try {
      // One check, not two. An id present in the destination is taken whether it
      // arrived with the bank or was added a moment ago by this same batch, and
      // a second narrower check above it was dead code that made a mutation of
      // this line look harmless.
      if (dest.questions[q.id])
        throw new Error("QUESTION_ID_ALREADY_EXISTS: " + q.id + " is in the bank");
      provides.forEach(a => {
        if (((dest.shared[a.kind] || {})[a.id]))
          throw new Error("RECORD_ALREADY_EXISTS: " + a.kind + "/" + a.id);
      });
      // Exact write fidelity, checked against the witness the plan carries from
      // the RAW parsed file. Comparing the document with the plan's own copy
      // would be a copy agreeing with itself; this compares it with what the
      // file actually had, so a reader that narrowed documents to the fields it
      // understands is caught here and refused rather than allowed to narrow.
      const doc = storable(q.document);
      const missing = (q.fidelity || admit.paths(q.document).sort())
        .filter(x => admit.paths(doc).indexOf(x) < 0);
      if (missing.length)
        throw new Error("WOULD_NOT_STORE_THE_DOCUMENT_AS_AUTHORED: " + q.id + " would lose " +
          missing.length + (missing.length === 1 ? " field: " : " fields: ") + missing.slice(0, 4).join(", "));
      staged = { question: { id: q.id, subject: q.subject,
        subjectLabel: (plan.labels || {})[q.subject] || q.subject, document: doc },
        shared: provides.map(a => ({ kind: a.kind, id: a.id })) };
      if (o.failWriting === q.id) throw new Error(o.failMessage || "the destination refused the write");
    } catch (e) { why = e.message; }

    if (why) {
      // Nothing of this package was assigned. The check above is not a claim,
      // it is the reason the failure list can say "nothing of it was written".
      failed.push({ id: q.id, source: q.source, reason: why,
        wrote: [], atomicUnit: "package",
        note: "nothing of this package was written, and the packages already added are unaffected" });
      return;
    }
    // ---- promotion. Nothing below this line may fail. -----------------------
    dest.questions[staged.question.id] = staged.question;
    staged.shared.forEach(r => {
      dest.shared[r.kind] = dest.shared[r.kind] || {};
      dest.shared[r.kind][r.id] = { id: r.id, suppliedBy: staged.question.id };
    });
    dest.log.push({ op: "add", kind: "question", id: staged.question.id });
    staged.shared.forEach(r => dest.log.push({ op: "add", kind: r.kind, id: r.id }));
    added.push({ id: staged.question.id, source: q.source, subject: q.subject,
      shared: staged.shared.map(r => r.kind + "/" + r.id) });
  });

  // Four outcomes, and "some failed" is not the same sentence as "all failed".
  const outcome = added.length && failed.length ? OUTCOME.partial
    : added.length ? OUTCOME.written : OUTCOME.failed;
  return result(outcome, added, failed, plan, {});
}

function result(outcome, added, failed, plan, extra) {
  return Object.assign({
    schema: "marginal.publish-result", version: 1,
    outcome: outcome,
    // Stated, not implied. Requirement 5 of the brief: the screen has to say
    // exactly which unit is atomic, and this is where that sentence comes from.
    atomicUnit: "package",
    atomicUnitSays: "a package writes completely or not at all, together with the shared records it " +
      "provides. A batch is not atomic: a package already added stays added when a later one fails.",
    added: added, failed: failed,
    questionsAdded: added.length,
    sharedAdded: added.reduce((n, a) => n + a.shared.length, 0),
    // Carried through from Review so the result screen can show what did not
    // change without recomputing it, which is how the two would drift.
    held: (plan.held || []).map(h => ({ id: h.id, source: h.source,
      reason: (h.reasons.find(r => r.code === "QUESTION_ID_ALREADY_EXISTS") || {}).message || null })),
    rejected: (plan.rejected || []).map(r => ({ id: r.id, source: r.source,
      reason: (r.reasons.find(x => x.stage === "validate") || {}).message || null })),
    deferred: (plan.deferred || []).map(d => ({ id: d.id, source: d.source })),
    // Readiness and warnings, reported apart from the writes and after them,
    // because neither is a change and neither stopped anything.
    readiness: (plan.entries || []).filter(e => e.publishable).map(e => ({
      id: e.id, headline: e.capability ? e.capability.headline : null,
      missing: e.capability ? e.capability.missing : [],
      warnings: (e.report.findings || []).filter(f => f.severity === "warning").map(f => f.code),
      shortfalls: (e.report.findings || []).filter(f => f.severity === "shortfall").map(f => f.code),
      carried: (e.report.document || {}).carried || [],
    })),
    existingUnchanged: true,
  }, extra || {});
}

module.exports = { apply, destination, registryOf, OUTCOME, STALE };

if (require.main === module) {
  const fs = require("fs");
  const lib = require("./libraries.js");
  const args = process.argv.slice(2);
  const failAt = (args.find(a => a.startsWith("--fail=")) || "").slice(7) || null;
  const emptyBank = args.indexOf("--empty-bank") >= 0;
  const files = args.filter(a => !a.startsWith("--"));
  if (!files.length) {
    console.error("usage: node tools/contract/publish.js [--fail=<id>] [--empty-bank] <package.json> [...]");
    process.exit(2);
  }
  const reg = emptyBank
    ? { schema: "marginal.question-registry", version: 1, questions: {}, ids: [] }
    : lib.questionRegistry();
  const man = lib.manifest();
  const entries = files.map(f => ({ source: f.split("/").pop(), pkg: JSON.parse(fs.readFileSync(f, "utf8")) }));
  const plan = admit.plan(entries, reg, man);
  const dest = destination(reg);
  const res = apply(plan, dest, { failWriting: failAt });
  console.log("destination: " + reg.ids.length + " questions" + (emptyBank ? " (an empty bank, stated)" : ""));
  console.log("outcome:     " + res.outcome);
  if (res.staleMessage) console.log("             " + res.staleMessage);
  console.log("atomic unit: " + res.atomicUnit + " - " + res.atomicUnitSays);
  res.added.forEach(a => console.log("  added   " + a.id + (a.shared.length ? "  + " + a.shared.join(", ") : "")));
  res.failed.forEach(f => console.log("  failed  " + f.id + ": " + f.reason + "\n          " + f.note));
  res.held.forEach(h => console.log("  held    " + h.id));
  res.rejected.forEach(r => console.log("  not included " + r.id));
  const n = res.questionsAdded;
  console.log("wrote " + n + (n === 1 ? " question and " : " questions and ") +
    res.sharedAdded + " shared records");
  res.readiness.forEach(r => console.log("  readiness " + r.id + ": " + r.headline +
    (r.warnings.length ? "; warnings " + r.warnings.join(", ") : "") +
    (r.carried.length ? "; carrying " + r.carried.length + " fields this reader does not interpret" : "")));
}
