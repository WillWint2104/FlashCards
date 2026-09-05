// SOURCE -> PACKAGE -> RUNTIME, AND BACK TO THE SAME QUESTION.
//
// A bundled question exported through the contract and read back by the runtime
// adapter must be the question that went in. Not "structurally valid", not
// "close enough": for every field a student can see, equal.
//
// This is the test that found the fabrication. tools/contract/packagize.js wrote
// `marks: q.marks || 20`, so nine of the thirteen Business Studies questions
// came back claiming to be worth twenty marks. Twenty is the SETUP FORM's
// editable default in app.js, not anything anybody said about those questions,
// and it reached the question header and the band table. There is no default
// now, and the packages for those questions are invalid until somebody authors
// what they are worth, which is the truthful outcome.
//
// It also holds the line on four fields 1.0 dropped in silence: question.note,
// question.areasLabel, pathways[].mechanism.reason and
// requirements.requiredAreas.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const lib = require("../tools/contract/libraries.js");
const rt = require("../tools/contract/runtime.js");
const { validate } = require("../tools/contract/validate.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };
const url = f => new URL("../" + f, import.meta.url);
const read = f => JSON.parse(readFileSync(url(f), "utf8"));
const MAN = lib.manifest();
const { packagize } = require("../tools/contract/packagize.js");
const { E } = lib.build();
const BUS = E.subjects.business_studies.questions || [];
// GENERATED HERE, not read off disk. This suite spent its whole life comparing
// docs/contract/example-*.json against source, which is a check on those files
// rather than on the code that writes them: every one of the five fidelity
// findings could be reintroduced into packagize.js and this suite stayed green
// until somebody happened to regenerate the artefacts. It calls packagize now,
// so the round trip under test is the live one. Section 6 holds the committed
// artefacts to the same output, which is the check that was here before.
const pkgOf = id => packagize(id).pkg;
const filedOf = id => read("docs/contract/example-" + id + ".json");
// The topic index the student build ships: topic ids to the labels the syllabus
// library authors. A question carries a ref, and the label belongs to the record
// the ref names.
const TOPICS = read("docs/contract/topic-index.json").topics;
const backOf = id => rt.toRuntimeQuestion(pkgOf(id), { topics: TOPICS });

// What the round trip is REQUIRED to preserve exactly. Everything a student can
// read, plus the structures the screens are built from. Fields left out are
// listed below with the reason, so the exclusions are a stated decision rather
// than whatever happened to pass.
const EXACT = ["id", "text", "marks", "argument", "topic", "note", "areasLabel",
               "plan", "connectIntro", "decode", "coreAnswer", "workingAnswer",
               "reasoning", "rubric", "criteria", "term1", "term2", "studyRefs"];

console.log("1. every bundled Business Studies question survives the round trip");
{
  ok(BUS.length === 13, "there are thirteen of them: " + BUS.length);
  const broken = [];
  BUS.forEach(src => {
    const back = backOf(src.id);
    EXACT.forEach(k => {
      // topic is compared by IDENTITY, not by spelling. The label belongs to the
      // syllabus record the ref names, and where the question and the syllabus
      // disagree on capitalisation the library wins: hr-01 authors "Human
      // Resources" and business.hr is labelled "Human resources". What a student
      // READS is question.text, which is compared exactly.
      const a = k === "topic" ? rt.topicId(src[k]) : src[k];
      const b = k === "topic" ? rt.topicId(back[k]) : back[k];
      // JSON.stringify(undefined) is undefined, not a string, so a field that
      // ARRIVED where the source had none crashed the report instead of being
      // reported. Which is exactly the case an invented value takes.
      const show = v => (v === undefined ? "(absent)" : JSON.stringify(v).slice(0, 60));
      if (JSON.stringify(a) !== JSON.stringify(b))
        broken.push(src.id + "." + k + ": " + show(a) + " -> " + show(b));
    });
  });
  ok(!broken.length, "every field in EXACT comes back identical: " + JSON.stringify(broken, null, 1).slice(0, 900));
}

console.log("2. no question gains a mark value nobody authored");
{
  const noMarks = BUS.filter(q => q.marks == null);
  ok(noMarks.length === 9, "nine of the thirteen author no marks: " + JSON.stringify(noMarks.map(q => q.id)));
  const invented = noMarks.filter(q => ((pkgOf(q.id).question) || {}).marks != null);
  ok(!invented.length, "and not one of their packages carries a mark value: " +
    JSON.stringify(invented.map(q => q.id + "=" + pkgOf(q.id).question.marks)));
  const back = noMarks.map(q => backOf(q.id));
  ok(back.every(q => q.marks === undefined), "nor does the question the runtime builds from it");
  // The consequence, stated rather than hidden: those packages are invalid.
  const reports = noMarks.map(q => validate(pkgOf(q.id), MAN));
  ok(reports.every(r => r.findings.some(f => f.code === "FIELD_MISSING" && f.path === "question.marks")),
    "each says which field is missing, by name");
  ok(reports.every(r => !r.wouldImport), "and each refuses to import until it is authored");
  // The four that DO author marks are unaffected and still import.
  const withMarks = BUS.filter(q => q.marks != null);
  ok(withMarks.length === 4, "four author marks: " + JSON.stringify(withMarks.map(q => q.id + "=" + q.marks)));
  ok(withMarks.every(q => pkgOf(q.id).question.marks === q.marks),
    "their packages carry exactly what was authored");
  ok(withMarks.every(q => validate(pkgOf(q.id), MAN).wouldImport), "and they import");
}

console.log("3. the four fields 1.0 dropped now travel");
{
  const notes = BUS.filter(q => q.note);
  ok(notes.length === 2, "two questions carry a note: " + JSON.stringify(notes.map(q => q.id)));
  ok(notes.every(q => pkgOf(q.id).question.note === q.note), "and it is in the package");
  ok(notes.every(q => backOf(q.id).note === q.note), "and comes back verbatim");

  const labels = BUS.filter(q => q.areasLabel);
  ok(labels.length === 2, "two carry an areasLabel: " + JSON.stringify(labels.map(q => q.id)));
  ok(labels.every(q => backOf(q.id).areasLabel === q.areasLabel), "and it comes back verbatim");

  const req = BUS.filter(q => (q.requirements || {}).requiredAreas);
  ok(req.length === 1 && req[0].id === "mkt-01", "one declares requiredAreas: " + JSON.stringify(req.map(q => q.id)));
  const ra = (backOf("mkt-01").requirements || {}).requiredAreas;
  ok(ra && ra.length === 4, "all four come back: " + JSON.stringify((ra || []).map(a => a.id)));
  ok(ra && ra.every(a => a.label), "each with its label");
  // The ids are slugged by the format, consistently with the area ids they name,
  // so every requiredArea still names an area this question defines.
  const areas = Object.keys(backOf("mkt-01").areas || {});
  ok(ra && ra.every(a => areas.indexOf(a.id) >= 0),
    "and each still names one of this question's areas: " + JSON.stringify({ req: ra.map(a => a.id), areas: areas }));

  const withReason = [];
  BUS.forEach(q => (q.pathways || []).forEach(p => { if (p.mechanism && p.mechanism.reason) withReason.push({ q: q.id, p: p.id, reason: p.mechanism.reason }); }));
  ok(withReason.length === 1, "one pathway argues that no mechanism is needed: " + JSON.stringify(withReason.map(x => x.p)));
  withReason.forEach(x => {
    const p = (backOf(x.q).pathways || []).find(y => y.id === x.p);
    ok(p && p.mechanism && p.mechanism.reason === x.reason,
      "and the argument comes back verbatim rather than the status alone: " +
      JSON.stringify((p && p.mechanism) || null).slice(0, 90));
  });
}

console.log("3b. a ref that resolves to nothing yields no topic, not a piece of the id");
{
  // The index resolves every ref this bank uses, so the miss path is never taken
  // by real content and would go untested. It is the path that matters: a topic
  // id is namespaced, business.hr is human resources, and its last segment is
  // "hr". Showing that to a student is showing them a namespace.
  const doc = JSON.parse(JSON.stringify(pkgOf("hr-01")));
  doc.question.topicRef = "business.not-a-topic";
  const q = rt.toRuntimeQuestion(doc, { topics: TOPICS });
  ok(q.topic === undefined, "an unresolvable ref gives no display topic at all: " + JSON.stringify(q.topic));
  ok(q.topicRef === "business.not-a-topic", "while the ref itself is still carried: " + q.topicRef);
  // And with no index at all, which is what a page that failed to load one has.
  const bare = rt.toRuntimeQuestion(JSON.parse(JSON.stringify(pkgOf("hr-01"))), {});
  ok(bare.topic === undefined, "and with no index, no topic is invented from the id: " + JSON.stringify(bare.topic));
  ok(rt.toRuntimeQuestion(pkgOf("hr-01"), { topics: TOPICS }).topic === "Human resources",
    "while the same ref with the index gives the label the syllabus authors");
}

console.log("4. directive and topic identity is canonical, and only identity is");
{
  // "Explain" in source and "explain" in a package are one directive. The test
  // that matters is that they collapse, and that nothing else does.
  ok(rt.directiveId("Explain") === rt.directiveId("explain"), "case does not make two directives");
  ok(rt.directiveId("  Explain  ") === "explain", "and neither does whitespace");
  ok(rt.directiveId("Explain") !== rt.directiveId("Assess"), "while two directives stay two");
  ok(rt.directiveLabel("to what extent") === "To what extent", "the label is derived from the id");
  const authored = [...new Set(BUS.map(q => String(q.command || "").trim()))].sort();
  const derived = authored.map(a => rt.directiveLabel(rt.directiveId(a)));
  ok(JSON.stringify(authored) === JSON.stringify(derived.sort()),
    "and for every directive this bank authors, the derived label IS the authored one: " +
    JSON.stringify(authored.filter((a, i) => a !== derived.sort()[i])));
  ok(rt.topicId("Human Resources") === rt.topicId("human resources"), "topics collapse by case too");
  ok(rt.topicId("Marketing") !== rt.topicId("Finance"), "and two topics stay two");
}

console.log("5. the exclusions are a decision, not an accident");
{
  // Everything a source question can carry, minus what EXACT covers. Each
  // remaining key is named here with why it is not compared, so a new field
  // cannot join the list by nobody noticing.
  const KNOWN_ONE_WAY = {
    command: "stored as a lowercase id by the contract; what a student reads is text",
    qtype: "dropped by decision: nothing in the app, the build or the tests reads it",
    qtypeLabel: "dropped by decision, with qtype",
    objectiveWords: "dropped by decision: claim right hand ends are explicit in v1",
    areas: "keys are slugged by the format, consistently with every ref to them",
    pathways: "refs replace prose joins by design; compared field by field in t19",
    requirements: "compared field by field in section 3",
    vocab: "replaced by vocabRefs into the vocabulary library",
    scaffold: "a subject level structure, not a property of the question",
    subject: "the package carries it as question.subject",
    id: "in EXACT", text: "in EXACT", marks: "in EXACT",
  };
  const seen = new Set();
  BUS.forEach(q => Object.keys(q).forEach(k => seen.add(k)));
  const unexplained = [...seen].filter(k => EXACT.indexOf(k) < 0 && !(k in KNOWN_ONE_WAY));
  ok(!unexplained.length,
    "every field a bundled question carries is either round tripped or named as one way: " +
    JSON.stringify(unexplained));
}

console.log("6. the committed packages are what packagize writes today");
{
  // The check that used to BE this suite, now stated as what it actually is: the
  // artefacts in docs/contract are a snapshot, and a snapshot that has drifted
  // from the generator is a document that lies about the format. It is not the
  // fidelity test, because it compares two things that both come from the same
  // side of the round trip.
  const stale = [];
  BUS.forEach(q => {
    let filed = null;
    try { filed = filedOf(q.id); } catch (e) { stale.push(q.id + ": no committed package"); return; }
    if (JSON.stringify(filed) !== JSON.stringify(pkgOf(q.id))) stale.push(q.id + ": differs from packagize output");
  });
  ok(!stale.length, "every committed Business Studies package is current: " + JSON.stringify(stale.slice(0, 4)));
  // And the fabrication is gone from the artefacts too, not only from the code.
  const noMarks = BUS.filter(q => q.marks == null).map(q => q.id);
  ok(noMarks.length === 9, "nine bundled questions author no marks: " + noMarks.length);
  const invented = noMarks.filter(id => { try { return filedOf(id).question.marks != null; } catch (e) { return false; } });
  ok(!invented.length, "and no committed package gives one of them a mark value: " + JSON.stringify(invented));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
