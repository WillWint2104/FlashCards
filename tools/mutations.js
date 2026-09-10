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
    // Rewritten TWICE, and the second time is the interesting one. It first
    // targeted esRefreshAskButton, which was the only thing restoring the label
    // after a result arrived, because the result did a partial update. The
    // paragraph review made a result a MODE CHANGE, so that path renders now, and
    // the render draws the button from the same state - which left the old target
    // unreachable and the mutation unable to fail. It follows the protection: take
    // the render away and the label is stranded exactly as it was before.
    find: "      esRender();\n      const host = document.getElementById(\"eshost\");",
    replace: "      const host = document.getElementById(\"eshost\");",
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

  {
    // THE ACADEMIC FAULT the screenshots caught. The pathway authors a frame for
    // exactly the job the coach diagnosed, and it was being passed over.
    id: "review-scaffold-ignores-the-pathway",
    file: "app.js",
    find: '    return authored ? { text: String(authored.text || authored), source: "pathway" } : null;',
    replace: "    return null;",
    owner: "ui65",
    why: "the scaffold under a diagnosis was dropped even where the pathway authors one for that exact job",
  },
  {
    // AND THE OTHER HALF, which the exhibit proved: with no authored frame the
    // review fell back to the subject's generic slot template, so 27 of the 28
    // Explain pathways showed "This works because [what the strategy changes] leads
    // to [the effect on the objective]" under a diagnosis about the characteristic
    // causing the strategy. Two different causal jobs, and the student writes from
    // the one underneath the criticism.
    id: "review-scaffold-falls-back-to-generic",
    file: "app.js",
    find: '    return authored ? { text: String(authored.text || authored), source: "pathway" } : null;',
    replace: '    if (authored) return { text: String(authored.text || authored), source: "pathway" };\n    const t = slotTemplates(key); if (!t) return null;\n    const byFam = t.byFamily && t.byFamily[esDirectiveFamily()];\n    const text = String((byFam && byFam.tier1) || t.tier1 || "");\n    return text ? { text: text, source: "slot" } : null;',
    owner: "ui65",
    why: "a scaffold teaching a different causal job from the one just diagnosed was shown rather than none",
  },
  {
    id: "review-prose-is-a-second-editor",
    file: "app.js",
    find: "    const prose = blocks.map((b, k) => (!reviewing && editing === k)",
    replace: "    const prose = blocks.map((b, k) => (editing === k)",
    owner: "ui65",
    why: "pressing a sentence in the paragraph while the review was open opened the inline editor beside the review's rewrite box, which is the two-editor fault the review exists to remove",
  },
  {
    id: "review-prose-keeps-its-reopen-handles",
    file: "app.js",
    find: '      ? `<span class="es-said ${(b.ambiguous || b.needsReview) ? "flagged" : ""}" data-esblock="${esc(b.id)}">${esc(b.text)}</span>`',
    replace: '      ? `<span class="es-said" data-esreopen="${k}" data-esblock="${esc(b.id)}">${esc(b.text)}</span>`',
    owner: "ui65",
    why: "the paragraph offered a second route into editing while the review was the surface that was supposed to own it",
  },
  {
    id: "review-save-enabled-without-an-edit",
    file: "app.js",
    find: "        sv.disabled = !now.trim() || now.trim() === start.trim();",
    replace: "        sv.disabled = false;",
    owner: "ui65",
    why: "Save wrote the sentence back over itself, dating the check and manufacturing a re-check out of no edit",
  },
  {
    id: "review-recheck-always-live",
    file: "app.js",
    find: "    const canRecheck = stale || !!refused;",
    replace: "    const canRecheck = true;",
    owner: "ui65",
    why: "the primary action on an untouched review was to spend a worker call asking the same question about the same words",
  },
  {
    id: "review-ignores-a-changed-argument",
    file: "app.js",
    find: "    return esContextChanged(p);",
    replace: "    return false;",
    owner: "ui65",
    why: "a check made under one argument was presented as current after the student chose another, so the guidance described prose written for the old one",
  },
  {
    id: "coach-may-call-present-things-absent",
    file: "proxy/worker.js",
    find: "- NEVER CALL SOMETHING ABSENT THAT IS ON THE PAGE.",
    replace: "- (removed) ",
    owner: "t27",
    why: "the coach could tell a student nothing signposts their approach directly underneath the sentence in which they signpost it",
  },
  {
    id: "review-leaves-the-composer-open",
    file: "app.js",
    find: "    const inReview = esInReview(p);",
    replace: "    const inReview = false;",
    owner: "ui65",
    why: "the review was layered under a live composer, so a missing sentence had two places to write it and no authoritative one",
  },
  {
    id: "review-settles-a-paragraph-with-an-open-issue",
    file: "app.js",
    find: "    if (esFeedbackStale(p)) return false;                                                  // checked, but not this version",
    replace: "    return true;",
    owner: "ui65",
    why: "Paragraph complete was shown in success green directly above a coach saying an element was missing",
  },
  {
    id: "review-example-guesses-the-family",
    file: "app.js",
    find: "      if (!exFam || exFam !== fam) return false;",
    replace: "      if (exFam && exFam !== fam) return false;",
    owner: "ui66",
    why: "an example that declares no directive family was offered as the model shape anyway, so a judgement example could model a causal answer",
  },

  {
    // NOT THE FLIP. The first version of this broke the branch that puts the card
    // above the word, and it survived - correctly, because every highlighted term
    // in this app is in the question stem at the top of the page, so that branch
    // cannot be entered. The reachable half of the same protection is the clamp,
    // and it is the half that was reported: the stem scrolled off the top and the
    // card was placed at a negative offset, laid out and off the screen.
    id: "term-card-placed-off-screen",
    file: "app.js",
    find: "    top = Math.min(Math.max(top, pad), Math.max(pad, window.innerHeight - pad - c.height));",
    replace: "    void pad;",
    owner: "ui66",
    why: "a term scrolled above the window opened its card above the window too, where it was present, measurable and invisible",
  },

  // ---- Gate 2: the bots actually complete the review cycle ------------------
  {
    // THE COVERAGE GAP GATE 2 EXISTS TO CLOSE. Before it, no bot had ever pressed
    // Check this paragraph: eight journeys wrote eighteen paragraphs and walked
    // past the review every time. Turning the cycle off again must fail loudly.
    id: "bots-skip-the-review",
    file: "tests/bots/journey.js",
    find: "    if (o.review) await reviewCycle(p, tr, prof);",
    replace: "    void o.review;",
    owner: "ui67",
    why: "the simulated students went back to writing paragraphs and never checking one, which is the gap Gate 2 was built to close",
  },
  {
    // The cycle must not be able to report success having stopped half way. Every
    // step is recorded, and the acceptance suite names the ones it requires.
    id: "bots-review-stops-after-saving",
    file: "tests/bots/journey.js",
    find: "  const rc = await p.$(\"#esrecheck\");",
    replace: "  return;\n  const rc = await p.$(\"#esrecheck\");",
    owner: "ui67",
    why: "a student revised a sentence and never asked again, so a stale judgement was the last thing the run saw and the journey still passed",
  },
  {
    // The stub is what makes the run evidence about the product. One that invents
    // a blockId would let an app that mis-grounds its diagnoses pass.
    // NOT the stub's fail-closed branch. That was the first version of this entry
    // and it survived, correctly: the app always sends an id for every sentence,
    // so the branch is unreachable and the assertion resting on it was vacuous.
    // The reachable claim is the one that crosses components - the app anchored
    // the diagnosis to the very sentence the coach named, and put that sentence
    // in front of the student.
    id: "bots-review-ignores-the-anchor",
    file: "tests/bots/journey.js",
    find: "  R.anchoredTo = anchor.id;",
    replace: "  R.anchoredTo = \"b1\";",
    owner: "ui67",
    why: "the run stopped checking which sentence the diagnosis was tied to, so a diagnosis rendered against the wrong sentence would have passed",
  },
  {
    id: "bots-students-stop-differing",
    file: "tests/bots/journey.js",
    find: "  if (prof.needsHelpFirst) {",
    replace: "  if (false) {",
    owner: "ui67",
    why: "every student behaved identically in the review, so the harness stopped telling a learner who needs support apart from one who does not",
  },

  // ---- the harness watching itself ----------------------------------------
  {
    id: "gate-drops-a-suite",
    file: "tests/run.js",
    // Follows the end of the list, which moves every time a suite is added.
    find: '"ui67", "ui68"]',
    replace: '"ui67"]',
    owner: "t23",
    why: "a maintained regression outside the runner is invisible, which is how twenty-eight suites rotted unnoticed",
  },
  // ---- Gate 3A: curriculum identity and evaluation safety -----------------
  {
    id: "gate3a-refusal-scores-again",
    file: "tools/contract/assessment.js",
    find: "  return !!g && g.outcome === SUCCESS && finite(g.score) && finite(g.max);",
    replace: "  return !!g && g.outcome === SUCCESS;",
    owner: "t28",
    why: "a success is not a success because it says so; dropping the number check is how undefined got back into the totals",
  },
  {
    id: "gate3a-tally-trusts-the-score",
    file: "tools/contract/assessment.js",
    find: "    if (o === SUCCESS) { got += clamp(g.score, 0, finite(g.max) ? g.max : m); done++; }",
    replace: "    got += (g && g.score); if (o === SUCCESS) done++;",
    owner: "t28",
    why: "this is the exact reduce that made a whole paper total NaN when one question was refused",
  },
  {
    id: "gate3a-authority-falls-back-to-a-label",
    file: "tools/contract/assessment.js",
    find: "  var pkg = packages[owner];\n  if (!pkg)",
    replace: "  var pkg = packages[owner] || packages[Object.keys(packages)[0]];\n  if (!pkg)",
    owner: "t28",
    why: "any fallback at all is the fault: an unresolved paper was marked against whichever package happened to be first",
  },
  {
    id: "gate3a-question-overrides-the-paper",
    file: "tools/contract/assessment.js",
    find: "  if (!blank(declared) && declared !== owner)",
    replace: "  if (false && !blank(declared) && declared !== owner)",
    owner: "t28",
    why: "a question silently changing subject inside a paper is how an Economics question would be marked as Business Studies",
  },
  {
    id: "gate3a-prose-is-identity-again",
    file: "tools/contract/validate.js",
    find: "      const owner = recs[rid] && recs[rid].subjectKey;",
    replace: "      const owner = recs[rid] && (recs[rid].subjectKey || recs[rid].subject);",
    owner: "t28",
    why: "reading the prose field as ownership is the defect itself: a course meaning of \"training\" was reported as a cross-wire",
  },
  {
    id: "gate3a-study-records-a-refusal",
    file: "app.js",
    find: "    if (ok) applyResult(card, g.score, g.max);",
    replace: "    applyResult(card, g.score, g.max);",
    owner: "ui68",
    why: "this line recorded an unmarked response as a zero and demoted the card to box 1",
  },
  {
    id: "gate3a-exam-sheet-scores-a-refusal",
    file: "app.js",
    find: "    if (!isMarked(g)) return unmarkedHTML(q, g);",
    replace: "    if (false) return unmarkedHTML(q, g);",
    owner: "ui68",
    why: "without it the sheet rendered undefined/undefined under the heading \"Not yet\"",
  },
  {
    id: "gate3a-stale-paper-marks-a-flashcard",
    file: "app.js",
    find: "    const paper = examOwns(card);",
    replace: '    const paper = (typeof EXAM !== "undefined" && EXAM && EXAM.paper) ? EXAM.paper : null;',
    owner: "ui68",
    why: "EXAM.paper outlives the sitting, so reading it unconditionally marked a flashcard under the curriculum of a paper the student had already left",
  },
  {
    // The third results bag. Two of them were on the shared tally and this one
    // was still doing its own arithmetic - correct, but the same shape as the
    // fault that had just escaped, so it is on the tally too and this holds it
    // there.
    id: "gate3a-section-total-sums-a-refusal",
    file: "app.js",
    find: "      got += t.got; max += t.max;",
    replace: "      got += t.got; max += t.max;\n      t.got = active.reduce((n, x) => n + (EXAM.results[si + \"-\" + x.qi] || {}).score, 0);",
    owner: "ui68",
    why: "a section total that adds up refusals reads NaN beside a paper total that does not",
  },
  {
    // Found in review, not by this catalogue, which is the reason it is in it.
    // examTotals was fixed and session.results was not: finishCard pushes every
    // result into it, refusals included, and the summary added their scores up.
    id: "gate3a-session-summary-sums-a-refusal",
    file: "app.js",
    find: "    const t = ASSESS.tally(results.map(r => ({ marks: r.card && r.card.marks, result: r.g })));\n    const got = t.got, max = t.max;",
    replace: "    const got = results.reduce((n, r) => n + r.g.score, 0);\n    const max = results.reduce((n, r) => n + r.g.max, 0);",
    owner: "ui68",
    why: "one unmarked answer ended a study run on \"NaN/NaN\" as the big score",
  },
  {
    // The completeness half of the rename. Ownership was fixed first and this was
    // still open: "business_studies" sat in the field the contract defines as the
    // course meaning, satisfied a non-empty check, and made seven records with no
    // definition in them read as complete AND displayable.
    id: "gate3a-a-course-name-passes-for-a-definition",
    file: "tools/contract/validate.js",
    find: "  function legacyAmbiguous(rec) {\n    return !!(rec",
    replace: "  function legacyAmbiguous(rec) {\n    if (rec) return false;\n    return !!(rec",
    owner: "t28",
    why: "a student would have been shown \"business_studies\" in the vocabulary panel as what \"performance objective\" means",
  },
  {
    // And the half that keeps the fix from becoming the defect again. Ambiguity is
    // collision with the real register of courses; the moment it is decided by what
    // a value LOOKS like, "training" is a subject key once more.
    id: "gate3a-ambiguity-guesses-from-shape",
    file: "tools/contract/validate.js",
    find: '  (((man || {}).enums || {}).subjectKeys || []).forEach(k => { KNOWN_SUBJECT_KEYS[k] = true; });',
    replace: '  ["training", "marketing", "operations"].forEach(k => { KNOWN_SUBJECT_KEYS[k] = true; });',
    owner: "t28",
    why: "judging a value by its form rather than against the register is the original defect wearing a different name",
  },
  {
    // The exact future this guard exists for: something on the exam path starts
    // handing on a COPY of a question instead of the paper's own object. Nothing
    // does today, which is why examOwns can compare by identity at all - and why
    // the constraint has to be guarded rather than assumed, because an importer
    // that normalised or rehydrated questions would break it in silence and put
    // the cross-subject leak back.
    id: "gate3a-exam-path-clones-a-question",
    file: "app.js",
    find: '      (sec.questions || []).forEach((q, qi) => seq.push({ kind: "q", si, qi, sec, q }));',
    replace: '      (sec.questions || []).forEach((q, qi) => seq.push({ kind: "q", si, qi, sec, q: JSON.parse(JSON.stringify(q)) }));',
    owner: "ui68",
    why: "a cloned question is not the paper's question, so ownership by identity would silently stop resolving and every written answer in the paper would fall through to the flashcard package",
  },
  {
    id: "gate3a-import-stops-asking-who-marks-it",
    file: "app.js",
    find: "    ASSESS.curriculumFindings(d).concat(ASSESS.subjectOverrides(d))",
    replace: "    [].concat(ASSESS.subjectOverrides(d))",
    owner: "ui68",
    why: "a paper that never says which subject marks it was marked against whichever flashcard package the picker was on",
  },
];
