// THE MUTATION CATALOGUE.
//
// Every entry is a fault that has actually happened in this repository, or is
// one line from happening, together with the ONE regression that is supposed to
// notice it. The owner is the point of the file: a mutation with no owning test
// is a fault nothing is watching for, and writing the owner down is what makes
// that visible before the runner ever runs.
//
//   id        short, stable, and what the results file is keyed on
//   file      the file the fault goes into
//   find      exact text, and it must appear EXACTLY once or the entry is STALE
//   replace   what it becomes
//   owner     the suite that owns this behaviour. Not a tier: a suite.
//   why       the fault in one sentence, in the past tense where it happened
//
// A mutation whose `find` no longer matches is reported as STALE rather than
// silently skipped, because a catalogue that quietly stops testing things is the
// same failure as a suite that quietly stops running.
module.exports = [
  // ---- the contract: fidelity through packagize ---------------------------
  {
    id: "packagize-fabricates-marks",
    file: "tools/contract/packagize.js",
    find: "      marks: q.marks,",
    replace: "      marks: q.marks || 20,",
    owner: "t22",
    why: "marks: q.marks || 20 told nine questions they were worth twenty marks on nobody's authority",
  },
  {
    id: "packagize-drops-note",
    file: "tools/contract/packagize.js",
    find: "      note: q.note || null,",
    replace: "      note: null,",
    owner: "t22",
    why: "question.note was one of four fields contract 1.0 dropped in silence",
  },
  {
    id: "packagize-drops-areaslabel",
    file: "tools/contract/packagize.js",
    find: "      areasLabel: q.areasLabel || null,",
    replace: "      areasLabel: null,",
    owner: "t22",
    why: "areasLabel is what a question calls its own areas, and it was being lost",
  },
  {
    id: "packagize-drops-mechanism-reason",
    file: "tools/contract/packagize.js",
    find: "reason: pw.mechanism.reason || null }",
    replace: "reason: null }",
    owner: "t22",
    why: "mechanism.reason is why an argument needs no middle step, and it was being lost",
  },
  {
    id: "packagize-drops-requiredareas",
    file: "tools/contract/packagize.js",
    find: "      requiredAreas: (q.requirements.requiredAreas || []).map(a => ({",
    replace: "      requiredAreas: [].map(a => ({",
    owner: "t22",
    why: "requirements.requiredAreas is what the response must cover, and it was being lost",
  },

  // ---- the runtime adapter: imported questions ----------------------------
  {
    id: "runtime-untypes-ladder",
    file: "tools/contract/runtime.js",
    find: 'else if (rung.rung === "direction") h.direction = { type: TYPE.direction, text: rung.text };',
    replace: 'else if (rung.rung === "direction") h.direction = { text: rung.text };',
    owner: "ui53",
    why: "the app discriminates ladder rungs by a type tag, and without it every imported ladder stopped at rung two",
  },
  {
    id: "runtime-invents-guidance",
    file: "tools/contract/runtime.js",
    find: "function guidesOf(guidance) {\n  const out = {};",
    replace: 'function guidesOf(guidance) {\n  const out = { evidence: "Support your point with a specific fact." };',
    owner: "ui53",
    why: "a guidance line nobody authored, offered on an imported question as though somebody had",
  },
  {
    id: "runtime-mutates-source-bank",
    file: "tools/contract/runtime.js",
    find: "function mergeSubjects(subjects, stored, opts) {",
    replace: 'function mergeSubjects(subjects, stored, opts) {\n  try { subjects.business_studies.questions.push({ id: "leaked" }); } catch (e) {}',
    owner: "ui50",
    why: "the merge is a view; writing into window.ESSAY would make the imported question part of the bundled bank",
  },

  // ---- capabilities: what a package is told about itself -------------------
  {
    id: "capabilities-ignores-provides",
    file: "tools/contract/capabilities.js",
    find: "    const own = (provides[kind] || {})[id];\n    return own ? { complete: true, provided: true, missing: [] } : null;",
    replace: "    return null;",
    owner: "ui53",
    why: "a package that authored its own lessons was told it had not, pushing authors towards borrowing another question's",
  },

  // ---- publication: the document is the record ----------------------------
  {
    id: "publish-narrows-document",
    file: "tools/contract/publish.js",
    find: "      const doc = storable(q.document);",
    replace: "      const doc = storable(q.document); delete doc.marking;",
    owner: "ui53",
    why: "rebuilding the stored package from the fields this version understands silently deletes everything the next contract adds",
  },

  // ---- the picker, and the honesty rules on it -----------------------------
  {
    id: "app-topic-guard-returns",
    file: "app.js",
    find: '        f.topic = qq.topic || "";',
    replace: '        if (!f.topic) f.topic = qq.topic || "";',
    owner: "ui52",
    why: "the guard only filled an empty topic, so a Finance question chosen after a Marketing one was filed as Marketing, and the topic reaches marking",
  },
  {
    id: "app-nav-is-dead",
    file: "app.js",
    find: '      if (to === "essays") {\n        if (f.pickStage !== "essays") f.pickReturn = f.pickStage || "subject";\n        f.pickStage = "essays";',
    replace: '      if (to === "essays") {\n        f.pickStage = f.pickStage || "subject";',
    owner: "ui55",
    why: "My essays pointed at the stage behind it, so it did what Back to setup did under a name that promised something else",
  },
  {
    id: "app-nav-resets-picker",
    file: "app.js",
    find: '      } else if (to === "back") {\n        f.pickStage = f.pickReturn || "subject";',
    replace: '      } else if (to === "back") {\n        f.pickStage = "subject"; f.questionId = null;',
    owner: "ui52",
    why: "a nav press is navigation; losing the chosen question and the filters on the way is losing the student's work",
  },
  {
    id: "app-delete-without-asking",
    file: "app.js",
    find: '      if (!window.confirm("Remove this saved essay? This cannot be undone.")) return;\n',
    replace: "",
    owner: "ui52",
    why: "remove sits beside Resume with no undo behind it, so a mis-aimed press lost an afternoon's work",
  },
  {
    id: "app-marks-default-returns",
    file: "app.js",
    find: "Optional settings such as structure and\n            marking guidance can be changed later.",
    replace: "Marks, structure and marking guidance all have\n            sensible defaults and can be changed at any point.",
    owner: "ui52",
    why: "marks are academic metadata and Marginal must never imply it supplies a default one",
  },

  // ---- evidence: two facts, kept apart ------------------------------------
  {
    id: "app-drops-evidence-demand",
    file: "app.js",
    find: "  function esSlotGuide(p, step) {\n    if (!step) return \"\";",
    replace: "  function esSlotGuide(p, step) {\n    if (!step) return \"\";\n    if ([\"evidence\",\"example\"].indexOf(step.key) >= 0 && !esEvidenceBank().usable.length) return \"\";",
    owner: "ui53",
    why: "deleting the sentence job where no evidence is authored removes something the response is marked on",
  },
  {
    id: "app-always-claims-no-evidence",
    file: "app.js",
    find: '    if (bank.usable.length) return "";',
    replace: "    if (false) return \"\";",
    owner: "ui53",
    why: "telling a student Marginal has no evidence for a question that has some is the same lie in the other direction",
  },

  // ---- the store: one write, and it refuses to overwrite -------------------
  {
    id: "store-overwrites-a-package",
    file: "tools/contract/store.js",
    find: "    if (B.get(key) != null)\n      throw new Error(\"QUESTION_ID_ALREADY_EXISTS: \" + unit.question.id + \" is already stored\");",
    replace: "",
    owner: "t24",
    why: "an import adds a question; replacing one already stored is how a student's bank changes under them",
  },
  {
    id: "store-index-is-authoritative",
    file: "tools/contract/store.js",
    find: "    const ids = B.keys().filter(k => k.indexOf(PREFIX) === 0).map(k => k.slice(PREFIX.length)).sort();",
    replace: "    const ids = [];",
    owner: "t24",
    why: "the index is a cache of the package keys; a question that exists and is not indexed must still be found",
  },

  // A mutation that hangs rather than failing. It exists to prove the runner's
  // own timeout and process-tree kill, because a campaign that can be stopped by
  // one hung mutant is the failure this runner was written after: a watcher left
  // looping on a condition that could never be met, for three hours and
  // forty-two minutes, with nothing recorded. Excluded from a normal run by its
  // id; ask for it with --only.
  {
    id: "PROVE-TIMEOUT-hangs",
    file: "tools/contract/store.js",
    find: "function createStore(backend) {",
    replace: "function createStore(backend) {\n  if (process.env.MUT_HANG) { const t = Date.now(); while (Date.now() - t < 600000) {} }",
    owner: "t24",
    why: "not a real fault: a deliberate hang, to prove the runner times out and kills the tree instead of waiting",
    manualOnly: true,
  },

  // ---- the harness watching itself ----------------------------------------
  {
    id: "gate-drops-a-suite",
    file: "tests/run.js",
    find: '"ui52", "ui53", "ui54", "ui55"]',
    replace: '"ui52", "ui53", "ui54"]',
    owner: "t23",
    why: "a maintained regression outside the runner is invisible, which is how twenty-eight suites rotted unnoticed",
  },
];
