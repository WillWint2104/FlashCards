// THE DESTINATION COLLISION RULE.
//
// Screen 5 promises that publishing adds exactly what was previewed and never
// replaces anything that already exists. Until this suite existed, that promise
// lived only in a mockup: validate(pkg, man) reads a library manifest, a
// manifest holds no questions, and so nothing in the pipeline could tell that
// an incoming question id was already taken.
//
// The rule now lives in tools/contract/admit.js, and this suite is the reason
// to believe it. Each section is written to fail if the tempting cheap
// implementation were used instead:
//
//   a collision reported as a schema error, which would tell an author their
//   valid file is malformed;
//   a collision reported as a missing dependency or a capability shortfall,
//   which would send them to fix content that is not the problem;
//   a colliding package quietly dropped, so the count on the screen is right
//   and the reason is invisible;
//   a whole batch failed because one file in it collides;
//   the existing question read, merged or touched on the way past;
//   and a publish set obtained by any route that did not run the check.
//
// Static, no browser, well under a second.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const lib = require("../tools/contract/libraries.js");
const { validate } = require("../tools/contract/validate.js");
const admitMod = require("../tools/contract/admit.js");
const { admit, plan, writes, fingerprint } = admitMod;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };
const url = f => new URL("../" + f, import.meta.url);
const read = f => JSON.parse(readFileSync(url(f), "utf8"));
const MAN = lib.manifest();
const REG = lib.questionRegistry();
const clone = o => JSON.parse(JSON.stringify(o));

const MKT = read("docs/contract/example-mkt-01.json");        // id is in the bank
const AHR = read("docs/contract/example-ah-religion.json");   // id is in the bank
const FREE = read("docs/contract/ahead-minor-demo.json");     // id is NOT in the bank
const BAD = read("docs/contract/invalid-demo.json");          // rejected at Validate
const entry = (src, pkg) => ({ source: src, pkg: pkg });

console.log("1. the registry knows the destination, and knows only what it needs to");
{
  ok(REG.ids.length === 19, "19 questions are already in the bank: " + REG.ids.length);
  ok(!!REG.questions["mkt-01"] && !!REG.questions["ah-religion"],
    "both walkthrough ids are among them");
  ok(!REG.questions["ah-religion-ahead"], "and the free fixture id is not");
  // It must not carry question CONTENT. If it did, a later change could merge
  // from it, which is the behaviour this whole rule exists to prevent.
  const fields = [...new Set(Object.values(REG.questions).flatMap(q => Object.keys(q)))].sort();
  ok(JSON.stringify(fields) === JSON.stringify(["id", "subject", "subjectLabel"]),
    "and each record carries id, subject and label only: " + JSON.stringify(fields));
}

console.log("2. an incoming id that is already in the bank is excluded from the publish set");
{
  const p = plan([entry("example-mkt-01.json", MKT)], REG, MAN);
  ok(p.questions.length === 0, "mkt-01 is not in the publish set: " + JSON.stringify(p.questions.map(q => q.id)));
  ok(p.changes.questionsAdded === 0 && p.empty, "and the plan says nothing would be written");
  // Read defensively on purpose. If the check is removed, or the colliding
  // package is dropped instead of held, these must FAIL BY NAME rather than
  // crash on an absent row, so the mutation report says which rule went.
  const held = p.held[0] || null;
  ok(held && held.id === "mkt-01" && held.state === "already-exists",
    "it is HELD and still visible, not dropped: " + JSON.stringify(p.held.map(h => h.id)));
  const r = (held ? held.reasons : []).find(x => x.code === "QUESTION_ID_ALREADY_EXISTS") || null;
  ok(!!r, "with the collision named by its own code: " + JSON.stringify((held ? held.reasons : []).map(x => x.code)));
  ok(r && r.stage === "review", "raised at the review stage, not at validate: " + (r && r.stage));
  ok(r && r.existing && r.existing.subjectLabel === "Business Studies",
    "and reported against the destination that holds it: " + JSON.stringify(r && r.existing));
}

console.log("3. the collision is caused by the registry and by nothing else");
{
  // The mutation. Same package, same manifest, same code path, and the ONLY
  // change is that the destination no longer holds the id. If the package
  // became publishable for any other reason, section 2 proved nothing.
  const emptied = { schema: REG.schema, version: REG.version, questions: {}, ids: [] };
  const p = plan([entry("example-mkt-01.json", MKT)], emptied, MAN);
  ok(p.questions.length === 1 && p.questions[0].id === "mkt-01",
    "against an empty bank the same package IS publishable: " + JSON.stringify(p.questions.map(q => q.id)));
  ok(p.entries[0].reasons.length === 0, "and has no reason against it: " + JSON.stringify(p.entries[0].reasons));
  // And the reverse: an id that is free becomes held once the bank holds it.
  const holds = { schema: REG.schema, version: REG.version,
    questions: { "ah-religion-ahead": { id: "ah-religion-ahead", subject: "ancient_history", subjectLabel: "Ancient History" } },
    ids: ["ah-religion-ahead"] };
  const q = plan([entry("ahead-minor-demo.json", FREE)], holds, MAN);
  ok(q.questions.length === 0 && q.held.length === 1,
    "and a free id becomes held once the bank holds it: " + JSON.stringify(q.questions.map(x => x.id)));
}

console.log("4. the existing question is not read, not merged and not touched");
{
  const { E } = lib.build();
  const before = clone(E.subjects.business_studies.questions.find(q => q.id === "mkt-01"));
  const beforeAll = JSON.stringify(E.subjects);
  const beforeReg = JSON.stringify(REG);
  plan([entry("a", MKT), entry("b", AHR), entry("c", FREE), entry("d", BAD)], REG, MAN);
  const after = E.subjects.business_studies.questions.find(q => q.id === "mkt-01");
  ok(JSON.stringify(before) === JSON.stringify(after),
    "the existing mkt-01 is property equivalent before and after the attempted import");
  ok(beforeAll === JSON.stringify(E.subjects), "and no question anywhere in the bank changed");
  ok(beforeReg === JSON.stringify(REG), "and the registry itself is unchanged");
  // No update path is offered anywhere. A publish set is additions only.
  const p = plan([entry("a", MKT)], REG, MAN);
  const ops = [...new Set(writes({ ...p, questions: [] }, REG).map(w => w.op))];
  ok(ops.every(o => o === "add"), "and every operation a plan can produce is an add: " + JSON.stringify(ops));
  const src = readFileSync(url("tools/contract/admit.js"), "utf8");
  ok(!/\b(overwrite|replace|merge|update)\s*:/.test(src) && !/op:\s*"(update|replace|overwrite)"/.test(src),
    "there is no update, replace or overwrite operation in the module at all");
}

console.log("5. one collision does not stop the rest of the batch");
{
  const p = plan([entry("example-mkt-01.json", MKT), entry("ahead-minor-demo.json", FREE),
                  entry("invalid-demo.json", BAD)], REG, MAN);
  ok(p.questions.length === 1 && p.questions[0].id === "ah-religion-ahead",
    "the non-colliding package still proceeds: " + JSON.stringify(p.questions.map(q => q.id)));
  ok(p.changes.questionsAdded === 1, "and is counted as the one addition");
  ok(p.held.length === 1 && p.rejected.length === 1,
    "while the collision and the rejection stay visible as themselves: held " +
    p.held.length + ", rejected " + p.rejected.length);
  ok(p.entries.length === 3, "every package chosen is still in the report: " + p.entries.length);
  // Two files claiming one free id is a different fault and says so, because
  // admitting both would let publication ORDER decide which one wins.
  const twice = plan([entry("one.json", FREE), entry("two.json", clone(FREE))], REG, MAN);
  ok(twice.questions.length === 1, "two files claiming one free id yield one addition: " + twice.questions.length);
  const dup = ((twice.entries[1] || {}).reasons || []).find(r => r.code === "QUESTION_ID_TWICE_IN_BATCH");
  ok(!!dup, "and the second says so by its own code, not by the registry code: " +
    JSON.stringify(((twice.entries[1] || {}).reasons || []).map(r => r.code)));
}

console.log("6. a collision is never misreported as something else");
{
  const a = admit([entry("example-mkt-01.json", MKT)], REG, MAN)[0];
  const codes = a.reasons.map(r => r.code);
  ok(JSON.stringify(codes) === JSON.stringify(["QUESTION_ID_ALREADY_EXISTS"]),
    "the only reason against a valid colliding package is the collision: " + JSON.stringify(codes));
  // Each of the four things it must not be confused with, checked by name.
  ok(a.report.counts.error === 0, "it raises no validate error, so the file is not called malformed");
  ok(a.report.verdict !== "rejected", "and its validate verdict is not rejected: " + a.report.verdict);
  ok(a.report.counts.blocked === 0, "it raises no blocked finding, so it is not called a missing dependency");
  ok(!/version/i.test(codes.join(" ")), "and nothing about it mentions the contract version");
  // Readiness is measured and is NOT a reason. mkt-01 is short of two
  // capabilities and that has no bearing on whether it may be published.
  ok(a.capability && a.capability.missing.length === 2,
    "mkt-01 is short of two capabilities: " + JSON.stringify(a.capability && a.capability.missing));
  ok(!a.reasons.some(r => /capab|shortfall|complete/i.test(r.code)),
    "and no shortfall appears among the reasons it cannot be published");
  const free = admit([entry("ahead-minor-demo.json", FREE)], REG, MAN)[0];
  ok(free.capability.missing.length === 5 && free.publishable,
    "and a package short of five capabilities is still publishable: missing " + free.capability.missing.length);

  // The converse. A malformed package that ALSO collides must report both,
  // because hiding one behind the other is how a fault gets fixed and the file
  // still refuses to import for a reason nobody was told about.
  const both = clone(BAD); both.question.id = "mkt-01";
  const r = admit([entry("bad-and-colliding.json", both)], REG, MAN)[0];
  const kinds = r.reasons.map(x => x.stage + "/" + x.code).sort();
  ok(kinds.includes("review/QUESTION_ID_ALREADY_EXISTS") && kinds.includes("validate/PACKAGE_HAS_ERRORS"),
    "a package that is both malformed and colliding says both: " + JSON.stringify(kinds));
  ok(r.state === "rejected", "and its state names the earliest stage that stopped it: " + r.state);
}

console.log("7. there is no route to a write that skipped the check");
{
  // Nothing produces a publish set without the registry. Not a default, not an
  // empty object, not an optional argument: it throws.
  let threw = 0;
  try { plan([entry("a", MKT)]); } catch (e) { threw++; }
  try { plan([entry("a", MKT)], {}); } catch (e) { threw++; }
  try { admit([entry("a", MKT)], null); } catch (e) { threw++; }
  ok(threw === 3, "plan and admit refuse to run without a destination registry: " + threw + " of 3");

  // A hand built plan does not get past the write gate.
  const forged = { schema: "marginal.publish-plan", version: 1,
    checkedAgainst: { registry: fingerprint(REG), questions: 19 },
    questions: [{ id: "mkt-01", document: MKT }], shared: { additions: [], referenced: [] } };
  let msg = "";
  try { writes(forged, REG); } catch (e) { msg = e.message; }
  ok(/QUESTION_ID_ALREADY_EXISTS/.test(msg),
    "a forged plan carrying a taken id is refused at the write: " + JSON.stringify(msg));

  // A plan checked against a different bank is refused rather than applied.
  const good = plan([entry("ahead-minor-demo.json", FREE)], REG, MAN);
  ok(writes(good, REG).length === 1, "a real plan against the bank it was checked on writes its one addition");
  const moved = { schema: REG.schema, version: REG.version,
    questions: { ...REG.questions, "ah-religion-ahead": { id: "ah-religion-ahead", subject: "ancient_history", subjectLabel: "Ancient History" } },
    ids: REG.ids.concat("ah-religion-ahead").sort() };
  let stale = "";
  try { writes(good, moved); } catch (e) { stale = e.message; }
  ok(/different question bank/.test(stale),
    "and the same plan is refused once the bank has changed underneath it: " + JSON.stringify(stale));
  ok(fingerprint(REG) !== fingerprint(moved), "because the two banks fingerprint differently");

  // The structural claim: admit.js is the only module that yields a publish set.
  const files = ["validate.js", "resolve.js", "libraries.js", "capabilities.js", "packagize.js", "directives.js"];
  const leaks = files.filter(f => {
    const mod = require("../tools/contract/" + f);
    return Object.keys(mod).some(k => /^(plan|publish|writes|import|apply|commit)$/i.test(k));
  });
  ok(!leaks.length, "no other contract module exports a publish, plan or apply step: " + JSON.stringify(leaks));
  const admitSrc = readFileSync(url("tools/contract/admit.js"), "utf8");
  const fsCalls = [...admitSrc.matchAll(/\bfs\.(\w+)/g)].map(m => m[1]);
  ok(fsCalls.every(c => c === "readFileSync"),
    "and admit itself only ever reads: " + JSON.stringify([...new Set(fsCalls)]));
}

console.log("8. the plan is what Screen 5 shows, so the screen cannot drift from it");
{
  const p = plan([entry("example-mkt-01.json", MKT), entry("example-ah-religion.json", AHR),
                  entry("invalid-demo.json", BAD)], REG, MAN);
  ok(p.empty, "the real walkthrough set would write nothing");
  ok(p.changes.questionsAdded === 0 && p.changes.sharedAdded === 0,
    "0 questions and 0 shared records added");
  ok(p.changes.questionsHeld === 2, "2 questions held because their ids are taken: " + p.changes.questionsHeld);
  ok(p.changes.packagesRejected === 1, "1 package not included: " + p.changes.packagesRejected);
  // The 23 records mkt-01 names are referenced by a package that CANNOT be
  // published, so the publish set references none of them. The screen has to
  // say which of those two things it means.
  ok(p.changes.sharedReferenced === 0,
    "and the publish set references no shared record, because nothing in it is publishable: " + p.changes.sharedReferenced);
  const mkt = p.held.find(h => h.id === "mkt-01");
  const declared = Object.values(MKT.requires).reduce((n, a) => n + a.length, 0);
  ok(declared === 23, "mkt-01 declares 23 shared records: " + declared);
  ok(!!mkt, "and remains visible as a held package rather than being counted as an import");
  // Readiness travels with the package and is not part of the change list.
  ok(p.questions.every(q => !("capability" in q)), "no capability information rides in the publish set");

  const html = readFileSync(url("docs/inspiration/mockups/importer/05-review-changes.html"), "utf8");
  ok(/QUESTION_ID_ALREADY_EXISTS|already in the bank/i.test(html), "and the mockup describes the same rule");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
