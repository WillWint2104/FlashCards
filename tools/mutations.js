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
    // The branch grew a return-to-the-draft case in between, so the mutation is
    // anchored on the line it is actually about and the branch that follows it.
    find: '        f.pickStage = f.pickReturn || "subject";\n      } else if (to === "marginalhome") {',
    replace: '        f.pickStage = "subject"; f.questionId = null;\n      } else if (to === "marginalhome") {',
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

  // ---- the coach's answer reaching the student ----------------------------
  {
    id: "feedback-has-nowhere-to-render",
    file: "app.js",
    find: '          <div class="es-margin">${esCoachMargin(p)}</div>\n',
    replace: "",
    owner: "ui56",
    why: "esGetFeedback writes into .es-margin and nothing created it, so every piece of feedback was fetched, saved and never shown",
  },
  {
    id: "ask-button-keeps-asking",
    file: "app.js",
    // Rewritten when the control gained an icon beside its label: writing
    // textContent on the button would have deleted the icon, so the LABEL is
    // written now and the mutation follows it. The entry had gone STALE and was
    // testing nothing, which the runner used to report as a pass.
    find: '    esSetLabel(ask, ES.pending ? "Checking\\u2026"',
    replace: '    if (false) esSetLabel(ask, ES.pending ? "Checking\\u2026"',
    owner: "ui56",
    why: "the button went on saying it was asking the coach after the answer had arrived, been saved and been rendered",
  },
  {
    id: "worker-request-unbounded",
    file: "app.js",
    find: "        body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined,",
    replace: "        body: JSON.stringify(body),",
    owner: "ui56",
    why: "a worker that accepts the connection and never answers left the student waiting with no message and no bound",
  },

  // ---- subject isolation, at both ends -------------------------------------
  {
    id: "assess-state-always-available",
    file: "app.js",
    find: "  function esAssessmentAvailable(d) { return esAssessmentState(d).available; }",
    replace: "  function esAssessmentAvailable(d) { return true; }",
    owner: "ui64",
    why: "a subject with no marking criteria was selectable and only refused after a whole essay had been written",
  },
  {
    id: "assess-state-never-declared",
    file: "app.js",
    find: "    if (!st || st.available) return \"\";",
    replace: "    return \"\";",
    owner: "ui64",
    why: "the write-only state existed and was never said on the screen the attempt is started from",
  },
  {
    id: "assess-sends-anyway",
    file: "app.js",
    find: "    const assess = esAssessmentState(d);\n    if (!assess.available) {\n      toast(ES_WRITE_ONLY_SUB + \".\");\n      return;\n    }",
    replace: "    const assess = { available: true };",
    owner: "ui64",
    why: "a paragraph in a subject with no criteria was still sent to the coach, which would answer against whatever it could find",
  },
  {
    id: "empty-criteria-counts-as-criteria",
    file: "app.js",
    find: "    const some = c => (Array.isArray(c) && c.length) ? c : null;",
    replace: "    const some = c => c || null;",
    owner: "ui64",
    why: "markingCriteria: [] is truthy, so a package with an empty list walked past the fail-closed and was sent to the marker with nothing to mark against",
  },
  {
    id: "shape-example-unowned",
    file: "app.js",
    find: "    const owned = mine ? all.filter(x => x && x.subject === mine) : [];",
    replace: "    const owned = all;",
    owner: "ui64",
    why: "a Business Studies human resources example was shown to any subject that used the same sentence shape",
  },
  {
    id: "shape-example-loses-its-owner",
    file: "essay-content.js",
    find: '{ id: "gym-timepoor", subject: "business_studies", context:',
    replace: '{ id: "gym-timepoor", context:',
    owner: "ui64",
    why: "an authored example with no subject is academic material nobody owns, and it was reachable from everywhere",
  },
  {
    id: "worked-example-drops-disclosure",
    file: "app.js",
    find: "    return { list: g, placeholder: esAttemptSubject() !== ESSAY_FALLBACK_EXAMPLE_SUBJECT };",
    replace: "    return { list: g, placeholder: false };",
    owner: "ui64",
    why: "the borrowed worked example stopped saying it came from another subject, which is the only thing making it safe",
  },
  {
    id: "picker-offers-legacy",
    file: "app.js",
    find: "  function esSubjectsList() { return esSubjectsRegistered().filter(s => !s.legacy); }",
    replace: "  function esSubjectsList() { return esSubjectsRegistered(); }",
    owner: "ui63",
    why: "a legacy subject was offered to new students again, which is a product decision undone by a refactor",
  },
  {
    id: "validate-allows-cross-wired-refs",
    file: "tools/contract/validate.js",
    find: "    if (declaredSubject && rec.subject && rec.subject !== declaredSubject)",
    replace: "    if (false && declaredSubject && rec.subject && rec.subject !== declaredSubject)",
    owner: "ui63",
    why: "an Economics-declared package carrying topicRef business.operations published cleanly and read Topic: Operations",
  },
  {
    id: "manifest-drops-record-owner",
    file: "tools/contract/libraries.js",
    find: "      if (owner) c.subject = owner;",
    replace: "      if (false) c.subject = owner;",
    owner: "ui63",
    why: "the manifest said whether a record was finished and never whose it was, so no validator could see a cross-wire",
  },
  {
    id: "runtime-drops-question-subject",
    file: "tools/contract/runtime.js",
    find: "    subject: q.subject || undefined,",
    replace: "    subject: undefined,",
    owner: "ui63",
    why: "question.subject was dropped at the runtime adapter, leaving evaluation nothing to read but the picker",
  },

  // ---- the paragraph review -------------------------------------------------
  {
    id: "review-green-from-silence",
    file: "app.js",
    find: "      const status = f ? f.status : \"unassessed\";",
    replace: "      const status = f ? f.status : \"ok\";",
    owner: "ui65",
    why: "a slot the coach never reported went green, so the app invented praise out of an absence",
  },
  {
    id: "review-trusts-unknown-block",
    file: "app.js",
    find: "        if (!b) return false;                       // an id we never sent",
    replace: "        if (!b) return true;",
    owner: "ui65",
    why: "a diagnosis naming a sentence id the app never sent was accepted and attached to nothing",
  },
  {
    id: "review-trusts-mismatched-slot",
    file: "app.js",
    find: "        if (b.slot && b.slot !== f.slot) return false;  // it disagrees with what the sentence was written as",
    replace: "        return true;",
    owner: "ui65",
    why: "a diagnosis was attached to a sentence written for a different structural job",
  },
  {
    // The app strips this on the way in AND never renders it, so neither protection
    // alone is observable on screen. ui65 therefore reads the STORED result: what
    // was written down is what a later render, a reload or a future surface would
    // use, and it must carry none of the model's words about an approved sentence.
    id: "review-keeps-model-prose-on-ok",
    file: "app.js",
    find: '      .map(f => (f.status === "ok" ? { slot: f.slot, status: "ok", blockId: f.blockId, issue: "" } : f))',
    replace: "      .map(f => f)",
    owner: "ui65",
    why: "model prose about a sentence it approved of was stored on the attempt, ready for any surface to print",
  },
  {
    id: "coach-keeps-prose-on-ok",
    file: "proxy/worker.js",
    find: '      if (f.status === "ok") return { slot: f.slot, status: "ok", blockId: f.blockId, issue: "" };',
    replace: "      if (f.status === \"ok\") return f;",
    owner: "t27",
    why: "the worker let the model's own words about a sentence it approved of through to the app",
  },
  {
    id: "coach-trusts-unknown-block",
    file: "proxy/worker.js",
    find: "      if (!b) return false;                                // an id we never sent",
    replace: "      if (!b) return true;",
    owner: "t27",
    why: "a diagnosis naming a sentence id the app never sent was passed on to be rendered",
  },
  {
    id: "coach-answers-missing-twice",
    file: "proxy/worker.js",
    find: '    legacy.missing = slotFeedback.filter(f => f.status === "missing").map(f => ({ slot: f.slot })).slice(0, 6);',
    replace: "    void slotFeedback;",
    owner: "t27",
    why: "missing was parsed from the model separately from slotFeedback, so the two could disagree about the same paragraph",
  },
  {
    id: "review-deletes-feedback-on-edit",
    file: "app.js",
    find: "    // THE FEEDBACK STAYS. It used to be deleted here the moment the text differed",
    replace: "    if (p.feedback && (p.gradedText || \"\") !== p.text) { p.feedback = null; p.gradedText = null; }\n    // THE FEEDBACK STAYS. It used to be deleted here the moment the text differed",
    owner: "ui65",
    why: "the diagnosis vanished the moment the student started acting on it, taking the check with it",
  },
  {
    id: "review-example-borrows-fallback",
    file: "app.js",
    find: "    const list = (sc && Array.isArray(sc.examples)) ? sc.examples : [];",
    replace: "    const list = (sc && Array.isArray(sc.examples) && sc.examples.length) ? sc.examples : esWorkedExampleSet().list;",
    owner: "ui66",
    why: "a complete example was filled from another subject's set rather than withheld honestly",
  },
  {
    id: "review-invents-a-definition",
    file: "app.js",
    find: "    if (!inQuestion && !plain) return null;",
    replace: "    if (!inQuestion && !plain) return null;\n    if (!plain) plain = String(h.anchor || \"\") + \" is a key term in this subject.\";",
    owner: "ui66",
    why: "a definition was written to fill the half of the term card the vocabulary library cannot supply",
  },

  // ---- the harness watching itself ----------------------------------------
  {
    id: "gate-drops-a-suite",
    file: "tests/run.js",
    // Follows the end of the list, which moves every time a suite is added.
    find: '"ui65", "ui66"]',
    replace: '"ui65"]',
    owner: "t23",
    why: "a maintained regression outside the runner is invisible, which is how twenty-eight suites rotted unnoticed",
  },
];
