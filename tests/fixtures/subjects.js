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
function providing(pkg, subject) {
  const v = clone(pkg);
  OWNED.forEach(kind => {
    const recs = (v.provides || {})[kind] || {};
    Object.keys(recs).forEach(rid => { if (recs[rid] && recs[rid].subject) recs[rid].subject = subject; });
  });
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
    noSubject: mk("xw-no-subject", declaring(BUS, null)),
  };
}

module.exports = { build, BUS_SRC, AH_SRC, OUT, named, declaring, providing, load, write };
