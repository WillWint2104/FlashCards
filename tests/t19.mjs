// ROUND TRIP.
//
// Export a question that ships, validate the package, resolve every reference,
// and compare the result with the source it came from. Not byte for byte: the
// package deliberately renames fields, splits two into one and moves lessons out
// of the pathway. What must survive is the MEANING, and this suite is the list
// of things that count as meaning:
//
//   the question's wording, directive and marks;
//   the areas and their guidance;
//   every pathway's identity;
//   the left end of each relationship, which the engine may never derive;
//   the contribution role on a judgement question;
//   every guidance line and every ladder rung, in order;
//   the lesson, reached through a ref instead of held inline;
//   every vocabulary meaning, now in one library instead of six concepts;
//   every evidence item, and what the pathway said it was for;
//   the marking bands and their source;
//   which sentence shapes the engine would be able to offer.
//
// A format that quietly loses one of those is a format nobody notices losing it
// until a student meets the gap.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const lib = require("../tools/contract/libraries.js");
const { resolve } = require("../tools/contract/resolve.js");
const { validate } = require("../tools/contract/validate.js");
const directives = require("../tools/contract/directives.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };
const read = f => JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));
const { libraries, E } = lib.build();
const MAN = lib.manifest();
const REG = directives.registry();
const slug = lib.slug;
const source = id => {
  let q = null;
  Object.keys(E.subjects).forEach(k => (E.subjects[k].questions || []).forEach(x => { if (x.id === id) q = x; }));
  return q;
};
const RUNGS = ["hint", "needs", "direction", "frame", "starter", "example"];
const rungTexts = h => RUNGS.map(k => {
  const v = h && h[k];
  if (!v) return null;
  return typeof v === "string" ? v : (v.text || null);
}).filter(Boolean);

function roundTrip(id) {
  const pkg = read("docs/contract/example-" + id + ".json");
  const rep = validate(pkg, MAN, { registry: REG });
  const r = resolve(pkg, libraries, REG);
  return { pkg: pkg, rep: rep, r: r, src: source(id) };
}

for (const id of ["mkt-01", "ah-religion"]) {
  console.log("=== " + id);
  const { pkg, rep, r, src } = roundTrip(id);

  console.log("1. it validates and every reference resolves");
  ok(!rep.counts.error && !rep.counts.blocked, "no errors and nothing blocked: " +
    JSON.stringify(rep.findings.map(f => f.code)));
  ok(r.missing.length === 0, "every ref resolves to a record: " + JSON.stringify(r.missing));

  console.log("2. the question survives");
  ok(r.question.text === src.text, "wording is unchanged");
  ok(r.question.directive === String(src.command).toLowerCase(),
    "the directive is the same command: " + r.question.directive + " vs " + src.command);
  ok(!!directives.rowFor(REG, r.question.directive), "and it is in the registry");
  ok(r.question.marks === (src.marks || 20), "marks: " + r.question.marks);
  ok((r.question.terms || {}).first === (src.term1 || null) &&
     (r.question.terms || {}).second === (src.term2 || null),
    "both ends of the question's own relationship: " + JSON.stringify(r.question.terms));
  ok((r.question.overallArgument || null) === (src.argument || null), "the overall argument");

  console.log("3. the areas survive");
  const srcAreas = Object.keys(src.areas || {});
  ok(r.areas.length === srcAreas.length, "same number of areas: " + r.areas.length + " vs " + srcAreas.length);
  ok(srcAreas.every(k => r.areas.some(a => a.id === slug(k))),
    "and the same ids: " + JSON.stringify(r.areas.map(a => a.id)));
  srcAreas.forEach(k => {
    const a = r.areas.find(x => x.id === slug(k));
    const guides = Object.keys((src.areas[k] || {}).guides || {});
    ok(a && guides.every(g => (a.guidance[g] || {}).direct === src.areas[k].guides[g]),
      "every area guidance line is carried for " + k);
  });

  console.log("4. every pathway survives, with the parts the engine may never derive");
  const srcPaths = src.pathways || [];
  ok(r.pathways.length === srcPaths.length, "same number of pathways: " + r.pathways.length);
  ok(srcPaths.every(p => r.pathways.some(x => x.id === p.id)), "and the same ids");
  srcPaths.forEach(p => {
    const x = r.pathways.find(y => y.id === p.id);
    if (!x) return;
    // fromLabel carries an explicit rule in the engine that it is never derived
    // from short or relationship, which is what makes it semantic.
    ok((x.left || {}).label === (p.fromLabel || undefined) || (!p.fromLabel && !x.left),
      p.id + ": the authored cause end is carried: " + JSON.stringify((x.left || {}).label));
    ok(x.short === p.short && x.relationship === p.relationship, p.id + ": short and relationship");
    ok(x.choiceMeaning === (p.meaning || null), p.id + ": what choosing it commits the student to");
    ok(x.whatToProve === (p.whatToProve || null) && x.commonMistake === (p.commonMistake || null),
      p.id + ": what it must prove and what goes wrong");
    ok((x.contribution || {}).role === ((p.contribution || {}).role || undefined) || !p.contribution,
      p.id + ": the contribution role: " + JSON.stringify((x.contribution || {}).role));
    // guides and help were two fields for one idea; the merge must lose neither
    Object.keys(p.guides || {}).forEach(s =>
      ok((x.guidance[s] || {}).direct === p.guides[s], p.id + "." + s + ": the guidance line"));
    Object.keys(p.help || {}).forEach(s => {
      const want = rungTexts(p.help[s]);
      const got = ((x.guidance[s] || {}).ladder || []).map(rr => rr.text);
      ok(JSON.stringify(got) === JSON.stringify(want),
        p.id + "." + s + ": every rung, in order: " + got.length + " vs " + want.length);
    });
    // the lesson left the pathway and must still be reachable
    if ((p.learning || {}).status === "authored") {
      ok(!!x.lesson, p.id + ": the lesson resolves through its ref");
      ok(x.lesson && x.lesson.know === p.learning.know, p.id + ": and it is the same lesson");
      ok(x.lesson && JSON.stringify(x.lesson.chain) === JSON.stringify(p.learning.chain),
        p.id + ": with its reasoning chain intact");
      const prim = ((p.learning.concepts || {}).primary || []);
      ok(x.lesson && JSON.stringify((x.lesson.conceptRefs || {}).primary || []) ===
        JSON.stringify(prim.map(k => "business.concept." + slug(k))),
        p.id + ": and its concepts named by id");
    }
    // evidence was matched by display label and is now named by id
    const srcEv = (p.evidence || []).map(e => (typeof e === "string" ? e : e.label));
    ok(x.evidence.length === srcEv.length, p.id + ": same number of evidence items");
    srcEv.forEach(l => ok(x.evidence.some(e => e.label === l), p.id + ": evidence " + JSON.stringify(l) + " still reachable"));
    (p.evidence || []).forEach(e => {
      if (typeof e === "string") return;
      const got = x.evidence.find(y => y.label === e.label);
      ok(got && got.why === (e.why || null) && got.limits === (e.limits || null),
        p.id + ": what this pathway said the item was for");
    });
  });

  console.log("5. the vocabulary a concept used to own is still reachable through it");
  srcPaths.forEach(p => {
    const key = (p.concept || {}).key;
    if (!key) return;
    const x = r.pathways.find(y => y.id === p.id);
    const srcTerms = ((E.subjects.business_studies.concepts[key] || {}).terms || []).filter(t => t.meaning);
    ok(x && x.vocabulary.length === srcTerms.length,
      p.id + ": " + srcTerms.length + " definitions, now in the vocabulary library: " + (x && x.vocabulary.length));
    srcTerms.forEach(t => {
      const got = x && x.vocabulary.find(v => v.term === t.term);
      ok(got && got.courseMeaning === t.meaning, p.id + ": " + JSON.stringify(t.term) + " keeps its meaning");
    });
  });

  console.log("6. marking, and what the engine could offer");
  ok((r.marking || {}).bandSource === ((src.criteria || {}).source || null),
    "the band source: " + JSON.stringify((r.marking || {}).bandSource));
  ok(JSON.stringify((r.marking || {}).bands || null) === JSON.stringify((src.criteria || {}).bands || null),
    "and the bands themselves");
  const fams = ((E.slots || {}).templates || {}).directiveFamilies || {};
  const cmd = String(src.command || "").toLowerCase();
  const wantFam = Object.keys(fams).find(f => (fams[f] || []).some(w => cmd === w || cmd.indexOf(w) === 0)) || null;
  ok(r.sentenceShapes.family === wantFam,
    "the family the engine would pick: " + r.sentenceShapes.family + " vs " + wantFam);
  const wantShapes = ((E.shapes || {}).library || []).filter(s => s.family === wantFam).length;
  ok(r.sentenceShapes.available.length === wantShapes,
    "and the shapes it could offer: " + r.sentenceShapes.available.length + " vs " + wantShapes);
  console.log("");
}

console.log("7. the resolver reads only, and reports what it cannot resolve");
{
  const src = readFileSync(new URL("../tools/contract/resolve.js", import.meta.url), "utf8");
  ok(!/writeFileSync|appendFileSync|mkdirSync|rmSync|unlinkSync/.test(src), "no write call in it");
  const pkg = read("docs/contract/example-mkt-01.json");
  pkg.pathways[0].conceptRef = "business.concept.not-a-thing";
  const r = resolve(pkg, libraries, REG);
  ok(r.missing.length === 1 && r.missing[0].kind === "concepts",
    "a ref to nothing is listed rather than dropped: " + JSON.stringify(r.missing));
  ok(r.pathways[0].concept === null, "and the field is null rather than a guess");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
