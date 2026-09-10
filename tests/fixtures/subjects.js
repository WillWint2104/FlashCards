// PACKAGES THAT DIFFER ONLY IN WHICH SUBJECT THEY DECLARE.
//
// question.subject is required by the contract and its stated meaning is "which
// subject's marking criteria, paragraph models and libraries apply". Everything
// here exists to test that one field: the same authored package, republished
// under a different declaration, must land in a different place - and must be
// refused outright when the declaration contradicts the records it uses.
//
// TWO REAL PACKAGES ARE THE SOURCE, and neither is invented for the test:
//
//   external-ops-package.json      Business Studies, authored against
//                                  docs/contract/template-causal.json, and the
//                                  package that already drives ui61. It
//                                  REFERENCES the shared Business libraries -
//                                  syllabus points, its own provided vocabulary
//                                  - which is what makes it useful as the
//                                  cross-wiring source.
//   docs/contract/example-ah-religion.json
//                                  Ancient History, authored, and the one AH
//                                  example that validates with no errors. It is
//                                  SELF-CONTAINED: topicLabel rather than
//                                  topicRef, no library requires at all, which
//                                  is how a subject with no syllabus library is
//                                  meant to be written.
//
// The Economics case is built by re-declaring the Ancient History package, and
// the prose is deliberately left as it was written. No Economics package has
// been authored, and inventing HSC Economics content to make a test read nicely
// would be fabricating exactly the kind of material this project does not
// fabricate. What is under test is the DECLARATION, not the words: a package
// whose sentences are obviously about one subject and whose declaration says
// another must file where it declares, because prose is not a claim a validator
// can check and a declaration is.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.join(ROOT, "tests", "out", "variants");

const BUS_SRC = path.join(ROOT, "tests/fixtures/external-ops-package.json");
const AH_SRC = path.join(ROOT, "docs/contract/example-ah-religion.json");

const load = f => JSON.parse(fs.readFileSync(f, "utf8"));
const clone = o => JSON.parse(JSON.stringify(o));

// Every shared kind that carries an owning subject. sentenceShapes and resources
// carry none: a shape belongs to no course on purpose.
const OWNED = ["vocabulary", "concepts", "lessons", "evidence", "syllabus", "resources"];

// A package's identity is its packageId and its question id, and nothing else in
// the file repeats them. Renaming both is what makes two variants two packages
// rather than one published twice.
function named(pkg, id) {
  const v = clone(pkg);
  v.origin.packageId = id;
  v.question.id = id;
  return v;
}
// The declaration under test. `null` removes it, which is a package that names
// no subject at all - required: true in the contract, so it must be refused
// before it can reach a student.
function declaring(pkg, subject) {
  const v = clone(pkg);
  if (subject === null) delete v.question.subject; else v.question.subject = subject;
  return v;
}
// The records the package brings with it, re-stamped as another subject's. This
// is the second half of cross-wiring: not reaching into another subject's
// library, but declaring one subject and shipping the other's records inside.
//
// IT USED TO WRITE THE PROSE FIELD. `subject` on a provided vocabulary record is
// the course meaning, and this helper overwrote it with "economics" - so the
// validator caught the fixture only because that word happens to look like a
// key, which is the same accident that had it reject a record whose meaning was
// the word "training". Ownership is `subjectKey` now, so the fixture claims
// ownership the way a package actually would, and the meaning it already had is
// left alone.
function providing(pkg, subjectKey) {
  const v = clone(pkg);
  OWNED.forEach(kind => {
    const recs = (v.provides || {})[kind] || {};
    Object.keys(recs).forEach(rid => { if (recs[rid]) recs[rid].subjectKey = subjectKey; });
  });
  return v;
}
// The other side of the same rule, and the one the old shape-guessing check got
// wrong: a record whose COURSE MEANING is a single word that looks exactly like a
// subject key. It is prose, it is correct, and it must import.
function meaning(pkg, word) {
  const v = clone(pkg);
  const recs = (v.provides || {}).vocabulary || {};
  Object.keys(recs).forEach(rid => {
    if (!recs[rid]) return;
    delete recs[rid].subject;
    recs[rid].subjectMeaning = word;
  });
  return v;
}

// A package whose ONLY cross-subject signal is a library reference: the
// self-contained Ancient History package, re-declared as Economics, with its
// prose topicLabel swapped for a ref into the Business syllabus. It provides no
// records of its own to be caught by the other half of the rule, so it is the
// case that can only be found by comparing a REFERENCE against the declaration -
// and it is the exact shape that reproduced Topic: Operations on an Economics
// question. Without it a mutation that deletes the reference check passes,
// because every other cross-wired fixture is also caught by the provides check.
function referencing(pkg, topicRef) {
  const v = clone(pkg);
  delete v.question.topicLabel;
  v.question.topicRef = topicRef;
  v.requires = v.requires || {};
  v.requires.syllabus = (v.requires.syllabus || []).concat([topicRef]);
  return v;
}

function write(id, pkg) {
  fs.mkdirSync(OUT, { recursive: true });
  const f = path.join(OUT, id + ".json");
  fs.writeFileSync(f, JSON.stringify(pkg, null, 1));
  return f;
}

// The cases, built once and written to tests/out so a failing run leaves the
// exact file on disk to open.
function build() {
  const BUS = load(BUS_SRC), AH = load(AH_SRC);
  const mk = (id, pkg) => ({ id: id, file: write(id, named(pkg, id)) });
  return {
    // Positives: the declaration is consistent with what the package uses.
    bus:  mk("sub-bus-01", BUS),                          // Business, as authored
    anc:  mk("sub-anc-01", AH),                           // Ancient History, as authored
    eco:  mk("sub-eco-01", declaring(AH, "economics")),   // re-declared, self-contained
    unk:  mk("sub-unk-01", declaring(AH, "geography")),   // a subject nothing registers
    // Negatives: the declaration contradicts the records.
    busInEco: mk("xw-bus-in-eco", declaring(BUS, "economics")),
    busInAnc: mk("xw-bus-in-anc", declaring(BUS, "ancient_history")),
    ecoInBus: mk("xw-eco-in-bus", providing(BUS, "economics")),
    // Not a negative. A one-word course meaning is prose and imports.
    terseMeaning: mk("sub-terse-meaning", meaning(BUS, "training")),
    libRefOnly: mk("xw-libref-only", referencing(declaring(AH, "economics"), "business.operations")),
    noSubject: mk("xw-no-subject", declaring(BUS, null)),
  };
}

module.exports = { build, BUS_SRC, AH_SRC, OUT, named, declaring, providing, meaning, referencing, load, write };
