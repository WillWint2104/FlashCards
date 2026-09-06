// THE STORE'S OWN TWO RULES.
//
// tools/contract/store.js is the only place in the system that writes a package
// somewhere it will still be after a reload, and it makes two promises that
// nothing was testing:
//
//   ONE WRITE, AND IT REFUSES TO REPLACE. A package is a single set of a single
//   key, so it lands or it does not, and an id already stored is refused rather
//   than overwritten. An import ADDS a question. A student's bank changing under
//   them because somebody published twice is the fault this prevents.
//
//   THE INDEX IS A CACHE, NEVER THE AUTHORITY. load() reads the package keys and
//   never the index, so a question that exists is found whether or not the index
//   knows about it, and a failure to update the index cannot turn a write that
//   SUCCEEDED into one reported as failed.
//
// This suite exists because a mutation run found both of them unguarded. t20 and
// t21 model the destination in memory and never touch this file; ui50 drives it
// through a browser and asserts what a student sees, not what the store refuses.
// Deleting the collision check and emptying the reindex list both left every
// suite in the repository green.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const store = require("../tools/contract/store.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };

const unit = (id, extra) => ({
  question: { id: id, subject: "business_studies", subjectLabel: "Business Studies",
    document: Object.assign({ schema: "marginal.question-package", question: { id: id } }, extra || {}) },
  shared: [{ kind: "vocabulary", id: "v." + id }],
});

console.log("1. a package is one key, and it is the whole package");
{
  const backend = store.memoryBackend();
  const s = store.createStore(backend);
  s.writeUnit(unit("q1"));
  const keys = backend.keys().filter(k => k.indexOf(store.PREFIX) === 0);
  ok(keys.length === 1, "one package is one key: " + JSON.stringify(keys));
  const loaded = s.load();
  ok(!!loaded.questions.q1, "and it reads back");
  ok(loaded.questions.q1.document.question.id === "q1", "as the document that went in");
  ok((loaded.shared.vocabulary || {})["v.q1"].suppliedBy === "q1",
    "with the records it provided, attributed to it");
  ok(!loaded.broken.length, "and nothing is unreadable: " + JSON.stringify(loaded.broken));
}

console.log("2. an id already stored is refused, not replaced");
{
  const s = store.createStore(store.memoryBackend());
  s.writeUnit(unit("q1", { marker: "first" }));
  let threw = null;
  try { s.writeUnit(unit("q1", { marker: "second" })); } catch (e) { threw = e.message; }
  ok(threw && /QUESTION_ID_ALREADY_EXISTS/.test(threw),
    "the second write is refused by name: " + JSON.stringify(threw));
  const back = s.load().questions.q1.document.marker;
  ok(back === "first", "and the first one is still there, untouched: " + JSON.stringify(back));
  ok(Object.keys(s.load().questions).length === 1, "with nothing else added");
}

console.log("3. the index is a cache, and load() does not consult it");
{
  const backend = store.memoryBackend();
  const s = store.createStore(backend);
  s.writeUnit(unit("q1"));
  s.writeUnit(unit("q2"));
  ok(s.index().ids.join(",") === "q1,q2", "the index lists what was written: " + JSON.stringify(s.index().ids));

  // The index is corrupted on purpose. Every question must still be found,
  // because the packages are the record and this is a convenience beside them.
  backend.set(store.INDEX, JSON.stringify({ schema: "marginal.import.index", version: 1, ids: [] }));
  const afterEmpty = Object.keys(s.load().questions).sort();
  ok(afterEmpty.join(",") === "q1,q2",
    "an empty index hides nothing: " + JSON.stringify(afterEmpty));

  backend.set(store.INDEX, "{ not json at all");
  const afterBroken = Object.keys(s.load().questions).sort();
  ok(afterBroken.join(",") === "q1,q2",
    "and neither does an unreadable one: " + JSON.stringify(afterBroken));
  ok(s.index() === null, "which reads back as nothing rather than throwing");

  // An index naming a question that was never stored must not conjure one.
  backend.set(store.INDEX, JSON.stringify({ schema: "marginal.import.index", version: 1, ids: ["q1", "q2", "ghost"] }));
  const withGhost = Object.keys(s.load().questions).sort();
  ok(withGhost.join(",") === "q1,q2",
    "and an index naming a question that is not stored does not invent it: " + JSON.stringify(withGhost));
}

console.log("4. a write that lands is reported as landed, even if indexing fails");
{
  // The one that matters most. A store that reports a successful write as a
  // failure leaves a stored question the caller believes is absent, and the
  // caller's next move is to write it again, which is then refused. The index is
  // a cache: failing to update it may not turn a success into a failure.
  const backend = store.memoryBackend();
  const inner = backend.set;
  backend.set = (k, v) => { if (k === store.INDEX) throw new Error("the index cannot be written"); return inner(k, v); };
  const s = store.createStore(backend);
  let r = null, threw = null;
  try { r = s.writeUnit(unit("q1")); } catch (e) { threw = e.message; }
  ok(!threw, "the write does not throw because the index could not be updated: " + JSON.stringify(threw));
  ok(r && r.indexed === false, "it says the index was not updated: " + JSON.stringify(r && r.indexed));
  ok(!!s.load().questions.q1, "and the question is stored and found");
}

console.log("5. a package that will not serialise fails before anything is written");
{
  const backend = store.memoryBackend();
  const s = store.createStore(backend);
  const circular = unit("q1");
  circular.question.document.self = circular.question.document;
  let threw = null;
  try { s.writeUnit(circular); } catch (e) { threw = e.message; }
  ok(!!threw, "it refuses: " + JSON.stringify(String(threw).slice(0, 60)));
  ok(!backend.keys().some(k => k.indexOf(store.PREFIX) === 0),
    "and wrote no key at all: " + JSON.stringify(backend.keys()));
}

console.log("6. clearing removes the packages and the index, and nothing else");
{
  const backend = store.memoryBackend();
  backend.set("someone.elses.key", "keep me");
  const s = store.createStore(backend);
  s.writeUnit(unit("q1"));
  s.clear();
  ok(!Object.keys(s.load().questions).length, "the packages are gone");
  ok(s.index() === null, "and so is the index");
  ok(backend.get("someone.elses.key") === "keep me",
    "and a key belonging to something else is untouched: " + JSON.stringify(backend.get("someone.elses.key")));
}

console.log("7. a key that will not parse is reported, never silently skipped");
{
  const backend = store.memoryBackend();
  const s = store.createStore(backend);
  s.writeUnit(unit("q1"));
  backend.set(store.PREFIX + "q2", "{ truncated");
  const loaded = s.load();
  ok(Object.keys(loaded.questions).join(",") === "q1", "the readable one is still read");
  ok(loaded.broken.length === 1 && /q2/.test(loaded.broken[0].key),
    "and the unreadable one is named: " + JSON.stringify(loaded.broken));
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
