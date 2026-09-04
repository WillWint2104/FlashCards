// PUBLICATION. One job: perform exactly the additions that were reviewed, or
// perform none of them.
//
// tools/contract/publish.js holds the destination in memory and touches no
// file. There is no store yet, and a model that wrote to disk would be the
// second write path admit.js exists to prevent. What it models is the part the
// screen has to be honest about: what publication does when it works, what it
// does when a write fails, and what it does when the bank moved underneath it.
//
// Each section is written to fail against the convenient implementation:
//
//   a plan rebuilt from the files at publish time, so the teacher approves one
//   thing and another is written;
//   a destination check trusted from Review rather than repeated;
//   a package assigned field by field, so a failure leaves half of it;
//   a failure that unwinds packages already added, which is itself a write;
//   a document narrowed to the fields this reader understands on the way in;
//   a stale plan reported as a generic error rather than as "review again".
//
// Static, no browser, well under a second.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const lib = require("../tools/contract/libraries.js");
const admit = require("../tools/contract/admit.js");
const pub = require("../tools/contract/publish.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };
const url = f => new URL("../" + f, import.meta.url);
const read = f => JSON.parse(readFileSync(url(f), "utf8"));
const MAN = lib.manifest();
const REG = lib.questionRegistry();
const EMPTY = { schema: "marginal.question-registry", version: 1, questions: {}, ids: [] };
const clone = o => JSON.parse(JSON.stringify(o));

const MKT = read("docs/contract/example-mkt-01.json");
const AHR = read("docs/contract/example-ah-religion.json");
const FREE = read("docs/contract/ahead-minor-demo.json");
const BAD = read("docs/contract/invalid-demo.json");
const entry = (src, pkg) => ({ source: src, pkg: pkg });
const planFor = (es, reg) => admit.plan(es, reg || REG, MAN);

console.log("1. the real plan writes exactly one question, and it is the reviewed one");
{
  const plan = planFor([entry("example-mkt-01.json", MKT), entry("example-ah-religion.json", AHR),
                        entry("invalid-demo.json", BAD), entry("ahead-minor-demo.json", FREE)]);
  const dest = pub.destination(REG);
  const before = Object.keys(dest.questions).length;
  const r = pub.apply(plan, dest, {});
  ok(r.outcome === "written", "the outcome is written: " + r.outcome);
  ok(r.questionsAdded === 1 && r.added[0].id === "ah-religion-ahead",
    "one question added, and it is the one the plan named: " + JSON.stringify(r.added.map(a => a.id)));
  ok(Object.keys(dest.questions).length === before + 1,
    "the bank grew by exactly one: " + before + " to " + Object.keys(dest.questions).length);
  ok(r.held.length === 2 && r.rejected.length === 1,
    "the held and the rejected are carried into the result: held " + r.held.length + ", rejected " + r.rejected.length);
  ok(r.existingUnchanged === true, "and the result states that existing records are unchanged");
  // What was written is the plan's list and nothing else. A plan rebuilt at
  // publish time would be the same list today and is a different mechanism, so
  // the check is that apply reads the plan and never the files.
  const src = readFileSync(url("tools/contract/publish.js"), "utf8");
  ok(!/require\("\.\/validate\.js"\)|readFileSync/.test(src.split("if (require.main")[0]),
    "apply neither validates nor reads a file: the plan is its only input");
  const ids = dest.log.filter(w => w.kind === "question").map(w => w.id);
  ok(JSON.stringify(ids) === JSON.stringify(plan.questions.map(q => q.id)),
    "the write log is the plan's question list in order: " + JSON.stringify(ids));
}

console.log("2. the destination is re-checked, and a stale plan writes nothing");
{
  const plan = planFor([entry("ahead-minor-demo.json", FREE)]);
  const dest = pub.destination(REG);
  // Something else arrives between Review and Publish.
  dest.questions["ops-04"] = { id: "ops-04", subject: "business_studies", subjectLabel: "Business Studies", document: null };
  const r = pub.apply(plan, dest, {});
  ok(r.outcome === "destination changed", "the outcome names the destination: " + r.outcome);
  ok(r.added.length === 0 && r.failed.length === 0 && dest.log.length === 0,
    "nothing was written and nothing was attempted: log " + dest.log.length);
  ok(!dest.questions["ah-religion-ahead"], "the question in the plan did not reach the bank");
  // The teacher-facing sentence, not an internal safety error.
  ok(r.staleMessage === pub.STALE, "it carries the review-again sentence");
  ok(/Review changes again/.test(r.staleMessage) && !/fingerprint|checksum|hash|error/i.test(r.staleMessage),
    "which says what to do and names no internal machinery: " + JSON.stringify(r.staleMessage));
  ok(r.reviewedAgainst === 19 && r.destinationNow === 20,
    "it says what was reviewed and what is there now: " + r.reviewedAgainst + " then, " + r.destinationNow + " now");
  ok(JSON.stringify(r.arrived) === JSON.stringify(["ops-04"]),
    "and NAMES what arrived, so there is something to look for: " + JSON.stringify(r.arrived));
  // The same plan applied to the bank it was reviewed against still works, so
  // section 2 proves a stale check rather than a broken plan.
  const fresh = pub.destination(REG);
  ok(pub.apply(plan, fresh, {}).questionsAdded === 1, "and the same plan against the reviewed bank still writes its one addition");
}

console.log("3. a package writes completely or not at all");
{
  const plan = planFor([entry("ahead-minor-demo.json", FREE)]);
  const dest = pub.destination(REG);
  const r = pub.apply(plan, dest, { failWriting: "ah-religion-ahead" });
  ok(r.outcome === "nothing was written", "every package failed, and the outcome says so rather than 'partial': " + r.outcome);
  ok(r.added.length === 0 && r.failed.length === 1, "one failure, no additions");
  ok(!dest.questions["ah-religion-ahead"], "the question is not in the bank");
  ok(dest.log.length === 0, "and nothing at all was assigned: log " + dest.log.length);
  ok(r.failed[0].wrote.length === 0 && /nothing of this package was written/.test(r.failed[0].note),
    "the failure says nothing of it was written: " + JSON.stringify(r.failed[0].note));
  ok(r.atomicUnit === "package", "the result states the atomic unit: " + r.atomicUnit);
  ok(/A batch is not atomic/.test(r.atomicUnitSays),
    "and states that the batch is not: " + JSON.stringify(r.atomicUnitSays));

  // A package that provides shared records, constructed here rather than taken
  // from a fixture because no fixture provides one. It is the only case where
  // "half written" is even possible, so it is the case that has to be proved.
  const withRecords = clone(FREE);
  withRecords.question.id = "constructed-provider";
  const plan2 = planFor([entry("constructed.json", withRecords)]);
  plan2.shared.additions = [{ kind: "vocabulary", id: "test.vocab.one", suppliedBy: "constructed-provider" },
                            { kind: "vocabulary", id: "test.vocab.two", suppliedBy: "constructed-provider" }];
  const d2 = pub.destination(REG);
  const r2 = pub.apply(plan2, d2, { failWriting: "constructed-provider" });
  ok(r2.added.length === 0, "a failing package that provides two records adds neither");
  ok(!d2.shared.vocabulary, "no shared record was assigned: " + JSON.stringify(Object.keys(d2.shared)));
  ok(!d2.questions["constructed-provider"] && d2.log.length === 0,
    "and the question was not assigned either, so there is no half written package");
  // And the same package succeeding writes the question AND both records.
  const d3 = pub.destination(REG);
  const r3 = pub.apply(plan2, d3, {});
  ok(r3.added.length === 1 && r3.sharedAdded === 2,
    "succeeding, it writes the question and both records together: " + r3.questionsAdded + " and " + r3.sharedAdded);
  ok(!!d3.shared.vocabulary["test.vocab.one"] && !!d3.shared.vocabulary["test.vocab.two"],
    "both records are in the destination");
}

console.log("4. one package failing does not unwind another that already published");
{
  // Three real fixture documents against a STATED empty destination, which is
  // the only way to get more than one publishable package: the repository holds
  // exactly one fixture whose id is free against the real bank.
  const es = [entry("example-mkt-01.json", MKT), entry("example-ah-religion.json", AHR),
              entry("ahead-minor-demo.json", FREE)];
  const plan = planFor(es, EMPTY);
  ok(plan.questions.length === 3, "against an empty bank all three are publishable: " + plan.questions.length);
  const dest = pub.destination(EMPTY);
  const r = pub.apply(plan, dest, { failWriting: "ah-religion" });
  ok(r.outcome === "partially written", "the outcome is partial: " + r.outcome);
  ok(r.added.length === 2 && r.failed.length === 1,
    "two added, one failed: " + JSON.stringify(r.added.map(a => a.id)) + " / " + JSON.stringify(r.failed.map(f => f.id)));
  // Read defensively: an implementation that unwound would remove the entry,
  // and this must FAIL BY NAME rather than crash reading it.
  ok(!!dest.questions["mkt-01"] && !!(dest.questions["mkt-01"] || {}).document,
    "the package published BEFORE the failure is still in the bank, with its document: " +
    JSON.stringify(Object.keys(dest.questions)));
  ok(!!dest.questions["ah-religion-ahead"],
    "and the package published AFTER the failure was still attempted and added");
  ok(!dest.questions["ah-religion"] || !(dest.questions["ah-religion"] || {}).document,
    "only the failing package is absent");
  // Nothing anywhere undoes a write. An unwind on a failure path is itself a
  // write, and this is the line that says the code contains none.
  // Comments in the module explain WHY there is no unwind, so the scan has to
  // read the code and not the prose that describes it.
  const code = readFileSync(url("tools/contract/publish.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  ok(!/\bdelete\s+dest\b|\brollback\b|\bunwind\b|\brevert\b/i.test(code),
    "there is no delete, rollback or unwind in the code");
}

console.log("5. what is stored is what was authored, whole");
{
  const plan = planFor([entry("ahead-minor-demo.json", FREE)]);
  const dest = pub.destination(REG);
  pub.apply(plan, dest, {});
  const stored = dest.questions["ah-religion-ahead"].document;
  ok(JSON.stringify(stored) === JSON.stringify(FREE),
    "the stored document is deep equal to the file as authored");
  // The point of the check. This fixture is contract 1.7 against a 1.x reader,
  // and carries five paths the reader does not interpret. A publication that
  // stored only what it understood would pass every other test in this file.
  const carried = ["accessibility", "marking.rubricRef", "marking.text",
                   "question.readingAge", "requirements.sourceSkills"];
  const at = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
  ok(carried.every(p => at(stored, p) !== undefined),
    "and all five forward compatible paths survived: " +
    JSON.stringify(carried.filter(p => at(stored, p) === undefined)));
  ok(stored.contractVersion === "1.7", "including the later contract version: " + stored.contractVersion);
  // The witness is what makes that check real. The plan carries every key path
  // taken from the RAW parsed file, so a reader that narrowed documents to the
  // fields it understands is caught. Simulated here by narrowing the document
  // while leaving the witness alone, which is exactly what such a reader would
  // produce, and the write must be REFUSED rather than accepted at reduced size.
  const narrowed = clone(plan);
  narrowed.questions[0].id = "narrowed-demo";
  narrowed.questions[0].document = { schema: FREE.schema, contractVersion: FREE.contractVersion,
    question: { id: "narrowed-demo" } };
  const d2 = pub.destination(REG);
  const r2 = pub.apply(narrowed, d2, {});
  ok(r2.added.length === 0 && /WOULD_NOT_STORE_THE_DOCUMENT_AS_AUTHORED/.test((r2.failed[0] || {}).reason || ""),
    "a document narrowed on the way in is refused by name: " + JSON.stringify((r2.failed[0] || {}).reason));
  ok(/would lose \d+ fields/.test((r2.failed[0] || {}).reason || ""),
    "saying how much would be lost: " + JSON.stringify((r2.failed[0] || {}).reason));
  ok(!d2.questions["narrowed-demo"] && d2.log.length === 0, "and nothing of it was stored");
  // The witness comes from the raw file, not from the copy being stored.
  ok(plan.questions[0].fidelity.length === admit.paths(FREE).length,
    "the witness has a path for every value in the authored file: " +
    plan.questions[0].fidelity.length + " of " + admit.paths(FREE).length);
}

console.log("6. there is no overwrite, update or merge anywhere in publication");
{
  const src = readFileSync(url("tools/contract/publish.js"), "utf8");
  ok(!/op:\s*"(update|replace|overwrite|merge)"/.test(src), "no update, replace, overwrite or merge operation exists");
  const ops = [...new Set(readFileSync(url("tools/contract/publish.js"), "utf8")
    .matchAll(/op:\s*"(\w+)"/g))].map(m => m[1]);
  ok(ops.every(o => o === "add"), "every operation it can log is an add: " + JSON.stringify(ops));
  ok(Object.keys(pub).every(k => !/update|replace|overwrite|merge|delete/i.test(k)),
    "and it exports no such function: " + JSON.stringify(Object.keys(pub)));
  // Publishing the same plan twice. The destination check catches it first,
  // because adding the question changed the bank the plan was reviewed against.
  const plan = planFor([entry("ahead-minor-demo.json", FREE)]);
  const dest = pub.destination(REG);
  pub.apply(plan, dest, {});
  const first = JSON.stringify(dest.questions["ah-religion-ahead"].document);
  const twice = pub.apply(clone(plan), dest, {});
  ok(twice.outcome === "destination changed" && twice.added.length === 0,
    "applying the same plan a second time is stopped by the destination check: " + twice.outcome);

  // And a plan forged to carry the CURRENT fingerprint, so it gets past that
  // check, still cannot write over the document that is there. Two independent
  // reasons, because one of them is the one a future refactor removes.
  const now = pub.registryOf(dest);
  const forged = clone(plan);
  forged.checkedAgainst = { registry: admit.fingerprint(now), questions: now.ids.length, ids: now.ids };
  forged.questions[0].document = { schema: "marginal.question-package", contractVersion: "1.0", tampered: true };
  const r = pub.apply(forged, dest, {});
  ok(r.added.length === 0 && /QUESTION_ID_ALREADY_EXISTS/.test((r.failed[0] || {}).reason || ""),
    "a forged plan is refused at staging: " + JSON.stringify((r.failed[0] || {}).reason));
  ok(JSON.stringify((dest.questions["ah-religion-ahead"] || {}).document) === first,
    "and the document already there is untouched, and is still there: " +
    JSON.stringify(Object.keys(dest.questions).length));
}

console.log("7. readiness and warnings are reported apart from the writes");
{
  const plan = planFor([entry("ahead-minor-demo.json", FREE)]);
  const r = pub.apply(plan, pub.destination(REG), {});
  ok(r.added.every(a => !("capability" in a) && !("missing" in a)),
    "no readiness information rides on an addition");
  const rd = r.readiness[0];
  ok(rd && rd.id === "ah-religion-ahead", "readiness is reported separately, by question");
  ok(rd.missing.length === 5, "naming the five capabilities it does not reach: " + rd.missing.length);
  ok(JSON.stringify(rd.warnings) === JSON.stringify(["CONTRACT_VERSION_AHEAD"]),
    "and the warning it carries: " + JSON.stringify(rd.warnings));
  ok(rd.carried.length === 5, "and the five fields stored without being interpreted: " + rd.carried.length);
  ok(r.questionsAdded === 1, "none of which changed whether it was published: " + r.questionsAdded);
}

console.log("8. Screen 6 is drawn from these results and cannot drift from them");
{
  const html = readFileSync(url("docs/inspiration/mockups/importer/06-publish.html"), "utf8");
  const plan = planFor([entry("example-mkt-01.json", MKT), entry("example-ah-religion.json", AHR),
                        entry("invalid-demo.json", BAD), entry("ahead-minor-demo.json", FREE)]);
  const r = pub.apply(plan, pub.destination(REG), {});
  ok(new RegExp("Publish " + r.questionsAdded + " question\\b").test(html),
    "the primary action names the real count: expected Publish " + r.questionsAdded + " question");
  ok(/ah-religion-ahead/.test(html), "the addition is named");
  ok(html.includes(pub.STALE), "the destination changed state uses the review-again sentence verbatim");
  ok(/a package writes completely or not at all/i.test(html) && /batch is not atomic/i.test(html),
    "the atomic unit is stated on the page, and so is what it excludes");
  // Controls, not prose. The page says at length that no overwrite exists, so a
  // whole text scan would fail on its own explanation. What must be true is that
  // no BUTTON offers one.
  const buttons = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map(m => m[1].replace(/\s+/g, " ").trim());
  ok(buttons.length >= 8, "the page draws its actions as buttons: " + buttons.length);
  ok(!buttons.some(b => /overwrite|replace|merge|update|force|anyway/i.test(b)),
    "and none of them offers an overwrite, replace, merge or force: " + JSON.stringify(buttons));
  ok(buttons.some(b => /^Publish 1 question$/.test(b)) && buttons.some(b => /Review changes/.test(b)),
    "the actions offered are publish and review: " + JSON.stringify(buttons));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
