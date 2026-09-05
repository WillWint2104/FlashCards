// THE FIXTURE MANIFEST.
//
// What a simulated student needs to know about a package in order to be run
// against it WITHOUT knowing the question id or any of its prose. The bots
// currently reach into the hard-coded bank by name; the point of the package
// contract is that they should not have to, so this publishes the stable
// semantic handles instead: area ids, pathway ids, ladder depths, which
// pathways carry a lesson, which carry evidence, and what the question's
// directive supports.
//
// It describes the personas and does not run them. Running them belongs after
// the importer, against externally authored packs rather than against this
// bank, and a manifest written now is the thing that makes that possible.
const caps = require("./capabilities.js");
const directives = require("./directives.js");

// Five students. Each one exists to break a different promise the app makes, and
// each names what would count as a failure rather than what would look fine.
const PERSONAS = [
  { id: "zeroKnowledgeStudent",
    means: "knows nothing about the content and will not leave the app to learn it",
    exercises: ["pathways[].learningRef", "pathways[].conceptRef", "vocabRefs"],
    fails: "choosing an argument opens something that does not teach it, or names a term with no meaning",
    needs: ["learning-complete"] },
  { id: "strongIndependentStudent",
    means: "writes well and opens no help at all",
    exercises: ["question.text", "question.marks", "marking.bandSource"],
    fails: "the app blocks, nags or requires a scaffold to reach submission",
    needs: ["writing-ready"] },
  { id: "misconceptionStudent",
    means: "writes exactly the mistake the pathway names, and the argument backwards",
    exercises: ["pathways[].commonMistake", "reasoning.forward", "reasoning.backward"],
    fails: "the app accepts the wrong-direction argument without noticing, or names the mistake before it is made",
    needs: ["pathway-guided"] },
  { id: "helpSeekingStudent",
    means: "presses every help control and climbs every rung",
    exercises: ["pathways[].guidance.<slot>.ladder"],
    fails: "a rung offers a sentence about this question that could be pasted, or the ladder ends before it has said anything useful",
    needs: ["pathway-guided"] },
  { id: "bypassEverythingStudent",
    means: "skips planning, goes straight to the full attempt and submits",
    exercises: ["the full attempt surface", "legacyTerms", "vocabRefs"],
    fails: "an undefined term reaches the screen, or a surface renders empty rather than being withheld",
    needs: ["importable"] },
];

const RUNGS = ["hint", "needs", "direction", "frame", "starter", "example"];

// Everything a bot may key on. No question id, no prose: ids, counts and states,
// so a simulation written against this manifest runs against any package.
function handles(pkg, man, REG) {
  const row = directives.rowFor(REG, (pkg.question || {}).directive);
  const rec = (kind, id) => (((man || {}).records || {})[kind] || {})[id] || null;
  return {
    directive: row ? { command: row.command, family: row.family,
      supportedInGuidedWriting: row.supportedInGuidedWriting,
      sentenceShapes: row.sentenceShapeCoverage.length } : null,
    marks: (pkg.question || {}).marks || null,
    areas: (pkg.areas || []).map(a => a.id),
    slots: [...new Set((pkg.pathways || []).reduce((a, p) => a.concat(Object.keys(p.guidance || {})), []))].sort(),
    claims: ((pkg.relationship || {}).claims || []).length,
    hasReasoning: !!pkg.reasoning,
    hasDecode: !!pkg.decode,
    bandSource: !!((pkg.marking || {}).bandSource),
    pathways: (pkg.pathways || []).map(p => ({
      id: p.id, areaRef: p.areaRef || null,
      contribution: (p.contribution || {}).role || null,
      namesAMistake: !!p.commonMistake,
      hasMechanism: (p.mechanism || {}).status === "authored",
      lesson: (p.learning || {}).status === "authored" ? p.learningRef : null,
      learningStatus: (p.learning || {}).status || null,
      deepestLadder: Math.max(0, ...Object.values(p.guidance || {}).map(g => (g.ladder || []).length)),
      ladderRungs: [...new Set(Object.values(p.guidance || {})
        .reduce((a, g) => a.concat((g.ladder || []).map(r => r.rung)), []))].sort((a, b) => RUNGS.indexOf(a) - RUNGS.indexOf(b)),
      evidence: (p.evidenceRefs || []).length,
      evidenceSourced: (p.evidenceRefs || []).filter(e => (rec("evidence", e.ref) || {}).published).length,
      evidenceRoled: (p.evidenceRefs || []).filter(e => e.role).length,
      vocab: (p.vocabRefs || []).length,
      vocabDisplayable: (p.vocabRefs || []).filter(v => (rec("vocabulary", v.id) || {}).displayable).length,
    })),
  };
}

function manifest(packages, man, REG) {
  const rows = packages.map(pkg => {
    const dims = caps.evaluate(pkg, man, directives.rowFor(REG, (pkg.question || {}).directive), false);
    const reached = k => dims[k] && dims[k].status === "reached";
    return {
      package: (pkg.question || {}).id,
      capabilities: caps.ORDER.reduce((a, k) => (a[k] = dims[k].status, a), {}),
      headline: caps.headline(dims),
      handles: handles(pkg, man, REG),
      // Applicable is derived from capability, never asserted. A persona that
      // needs teaching cannot be run against a question that has none, and
      // saying so beats running it and reporting a failure that is really a
      // content gap.
      personas: PERSONAS.map(p => ({
        persona: p.id,
        applicable: p.needs.every(reached),
        why: p.needs.every(reached) ? null
          : "needs " + p.needs.filter(n => !reached(n)).join(", ") + ", which this package does not reach",
      })),
    };
  });
  const runnable = {};
  PERSONAS.forEach(p => { runnable[p.id] = rows.filter(r => r.personas.find(x => x.persona === p.id).applicable).map(r => r.package); });
  return { schema: "marginal.fixture-manifest", version: 1,
    note: "Describes the simulations. tests/ui53.js runs them against an externally authored package rather than against this bank, which is what this manifest was written for.",
    personas: PERSONAS, runnable: runnable, packages: rows };
}
module.exports = { manifest, PERSONAS, handles };
