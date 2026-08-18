# Essay practice mode (Ancient History) — reviewer guide

Essay practice is a new mode for coached essay writing plus a full timed attempt.
It is built behind a flag and is invisible to live students until you switch it
on. Economics is untouched.

## What is gated, and how to switch it on

Same convention as review mode:

- `MARGINAL_CONFIG.essayMode` in `index.html` (default `false`) is the promotion
  switch. `true` shows the "Essay practice" entry point (a third tab next to
  Study and Create) to EVERY login, regardless of subject.
- `?essay=1` (or `localStorage["marginal.essay"]="1"`) turns it on for one person.
- `?essaydemo=1` opens the flow on an Ancient History (`11Anc1`) context with the
  labelled demo coaching fallback, so you can walk it before the worker is updated.

Nothing about live students changes until you set `essayMode: true`.

## Why it is safe for every subject (custom-question core)

Essay practice is a CUSTOM-QUESTION feature: the student supplies their own essay
question (the one required setup field). The whole engine, the slot model, missing
element detection, coaching, the quiz and the full attempt, runs on that question,
so it is subject-agnostic and works for any login. There is no "subject not set"
dead end any more.

Only two add-ons are subject-specific, and both degrade gracefully:

- **Suggested questions** (pre-written quick-pick chips): shown ONLY when the
  student's subject ships its own set. Today that is Ancient History. An Economics
  or unmatched login simply does not see the chips and types its own question. We
  never show Ancient History suggested questions to an Economics student.
- **Worked examples** (fixed, pre-written, deliberately DIFFERENT-topic models):
  a subject with no examples of its own borrows the existing set as a clearly
  labelled placeholder ("a model from another subject, until your subject's own
  worked examples are added"). Because they are different-topic by design, the
  analytical shape still transfers. Examples are ALWAYS fixed and pre-written,
  never generated, so no invented history can leak in.

## Subjects and class codes

- Class codes are still free-form; `11Anc1` works as a login with no backend change.
- Routing is a client-side map used ONLY to choose the optional add-ons:
  - `11Anc...` -> Ancient History (its own suggested questions + worked examples)
  - `12Ec...` -> Economics (no own content yet: no suggested questions, placeholder
    worked examples, brand reads "Economics")
  - anything else -> no subject add-ons; the custom-question core still works.
- Adding a subject's suggested questions or worked examples later is a content-only
  change: add a namespace keyed to the subject in `essay-content.js`
  (`subjects.<key>.questions` and `subjects.<key>.examples`). No engine change, and
  the matching login serves them automatically with the placeholder note gone.

## Walkthrough checklist (run on `?essaydemo=1`)

Sign in first if Supabase auth is configured (any account), then add
`?essaydemo=1` to the URL. Tick each:

**Entry point and subject add-ons (with `essayMode: true` or `?essay=1`)**
- [ ] An "Essay practice" tab sits next to Study and Create for any login. With the
      flag off and no `?essay=1`, it is absent.
- [ ] An Ancient History login (`11Anc...`) sees the six suggested-question chips
      and worked examples with NO placeholder note.
- [ ] An Economics login (`12Ec...`) sees NO suggested-question chips (it types its
      own question) and worked examples carry the "model from another subject"
      placeholder note. The header reads "Economics", never Ancient History content.

**Setup (intake)**
- [ ] Only the essay question is marked "needed". Topic, rubric and structure are
      marked "optional".
- [ ] A quick-pick question chip fills the question box (and tags the topic).
- [ ] "Start practising" with an empty question nudges you to add one; with a
      question it starts. Skipping topic and rubric works and costs nothing.
- [ ] The structure selector defaults to "5 paragraphs (intro, 3 body,
      conclusion)".
- [ ] "Show the general band expectations" reveals the fallback bands used when
      no rubric is pasted.

**Coached practice (one element at a time)**
- [ ] Only the current paragraph renders: its planned point pinned (muted) above,
      one editable box, and feedback in the right margin. No other paragraphs show.
- [ ] The stepper (Intro, Body 1..3, Conclusion) is a position indicator only.
      Back / Next move one paragraph at a time and the ring tracks (1/5, 2/5, ...).
- [ ] "Get feedback" fills the margin with a note, question-nudges, and word-level
      chips. There is no rewritten or paste-ready paragraph anywhere.
- [ ] Picking a chip swaps that one word in YOUR text (you apply it, the coach
      never substitutes).
- [ ] After feedback, "Get feedback" is disabled with "Revise, then ask again".
      Editing the paragraph re-enables it. (Cooldown.)

**Full attempt (write cold)**
- [ ] One continuous surface, no feedback margin.
- [ ] Standing line offers "switch to practice".
- [ ] A per-paragraph "Coach ..." link carries THAT paragraph into the coached
      view. Edits flow back to the same draft (no second draft, no fork).
- [ ] A gentle, declinable completion check sits above Submit ("you wrote this
      without feedback... you can decline").

**No fork**
- [ ] Apply a chip in coached view, switch to full attempt: the change is in the
      single essay text. Switch back: still one draft.

## The one manual step to turn on REAL coaching: re-paste the worker

Coaching uses the Cloudflare Worker, the same as marking. The repo copy of
`proxy/worker.js` does NOT update the live worker. Until you re-paste it, all
three screens still work using the labelled demo coaching fallback.

To switch on real Haiku coaching:

1. Open Cloudflare -> Workers -> your `marginal-grader` worker -> Edit code.
2. Replace the whole script with the current `proxy/worker.js` from this repo and
   Deploy. (No new secrets are needed; coaching reuses `ANTHROPIC_API_KEY` and the
   same `CLASS_CODE` gate as marking.)
3. That is it. The app already sends `{ action: "coach", ... }`; once the new
   worker is live, the demo banner disappears and feedback comes from Haiku.

Notes:
- Coaching runs on `claude-haiku-4-5-20251001` (the dated pin; the bare
  `claude-haiku-4-5` alias is rejected on this account) with a short output cap.
  Marking is left on its current model on purpose.
- The coaching system prompt is prompt-cached (it repeats every call).
- The rubric is sent only when the student pasted one; otherwise the worker falls
  back to generic HSC band expectations (no empty rubric field is sent).

## Where drafts live (for now)

Essay drafts persist in the browser via the existing safe-storage wrapper, so the
demo is fully walkable immediately. The go-live step is an `essay_drafts` table
with `owner = auth.uid()` Row Level Security, mirroring the `sets` table pattern.
That SQL is not run yet and is the next step when you decide to go live.

---

# Batch 2: mastery mode, missing-element feedback, and flow sequencing

All still behind `essayMode` / `?essaydemo=1`, demo-walkable before the worker is
re-pasted.

## The shared slot model (one definition)

`window.ESSAY.slots` in `essay-content.js` is the single source. A body paragraph
has four slots (point, analysis, evidence, link); the intro and conclusion get
light sets (thesis + approach; restatement + judgement). Both the missing-element
feedback and the quiz read it. The Cloudflare worker only DETECTS and names which
slot is absent (by key); it never sends a frame or any content. All frames and the
quiz logic are client-side.

## Walkthrough checklist (run on `?essaydemo=1`)

Open a Body paragraph (press Next from the intro), type a sentence or two, and
press Get feedback. Then tick:

**Missing-element feedback (Task 2)**
- [ ] One or more "a/an X sentence is missing" cards appear in the margin, each
      naming the element, its job, and where it goes. By default there are NO frames
      in the writing area yet.
- [ ] ONE "Show scaffold" toggle (under the cards) reveals the whole paragraph as an
      ordered skeleton beneath your text: every slot in order (point, analysis,
      evidence, link), with the sentences you already have shown as solid "your
      sentence sits here" rows and the missing pieces shown as dashed, tinted gap
      frames in their correct position. All gaps appear at once, never one at a time.
- [ ] The dashed gap frames are labelled "type over the blanks" and are clearly not
      your text. Each gap offers a small row of frame TYPES (e.g. significance,
      appearance and reality, cause and effect); picking one swaps THAT gap's frame
      wording in place, without revealing or hiding any gap.
- [ ] Every frame is blank connective tissue. No real history, names, dates or
      model analysis anywhere.
- [ ] "Hide scaffold" clears the whole skeleton in one move (all gaps together, no
      orphans) and your paragraph text is exactly as you left it. Nothing was ever
      written into the draft.

**Categorised feedback (Task 4)**
- [ ] On-target (substance) questions and the missing-element cards show by default.
- [ ] Word choices and expression/signposting polish are tucked behind a quiet
      "polish the wording (N)" reveal, hidden until you open it.

**Mastery / quiz (Task 3)**
- [ ] "memorise this paragraph" opens the quiz. The cue is your point/topic sentence.
- [ ] Reveal shows your own saved paragraph as a crutch.
- [ ] Checking after revealing does NOT count as mastery (it says so).
- [ ] A weak recall says "close"; a clean recall with no reveal marks the paragraph
      mastered (stepper shows a tick).
- [ ] Edit the paragraph later and the quiz targets the new text (one draft, no fork).

**Soft sequencing (Task 4)**
- [ ] After a paragraph is complete with no missing elements: a quiet "ready to
      memorise?" nudge.
- [ ] After it is mastered: a "polish the wording?" nudge.
- [ ] After every paragraph is mastered: a "try a full attempt?" nudge.
- [ ] All three modes stay openable at any time; the nudges never lock anything.

## Worker re-paste (your step) — REQUIRED this batch

The coach system prompt and tool schema CHANGED (it now reports absent slots and
categorises nudges). Until you re-paste, coaching shows the labelled demo fallback,
which already carries the new categorised shape so every screen above is walkable.

To switch on real categorised + missing-element coaching:
1. Cloudflare -> Workers -> `marginal-grader` -> Edit code.
2. Replace the whole script with the current `proxy/worker.js` and Deploy.
3. No new secrets. Quiz mode adds zero API cost; it never calls the worker.

Keep `window.ESSAY.slots` keys in `essay-content.js` in sync with `COACH_SLOT_KEYS`
in `proxy/worker.js` if you ever change the slot set.

## Batch 2 fixes + worked examples

- Toggles (show/hide scaffold, more guidance, polish, worked example, get feedback)
  update only the affected panel in place and preserve scroll, so the page no
  longer jumps to the top. No essay button is a form submit.
- Setup has a "your saved essays" picker reading localStorage drafts: Resume
  reopens a draft as-is; Use as template copies its question, structure and rubric
  into a new essay.
- Each missing element is its own stacked card in the margin (name, job, where it
  goes). The blank frames no longer live in the cards: ONE "Show scaffold" toggle
  reveals an ordered skeleton beneath the paragraph instead, with present slots as
  solid markers and missing slots as dashed gap frames in their true slot position,
  so the placement and order are the lesson. All gaps reveal and clear together; per
  gap, frame TYPE chips swap that gap's wording in place. Frames are never written
  into the draft and the toggle flips visibility on existing DOM (no rebuild, no
  flash).
- Each missing element offers an optional "see a worked example". These are the
  ONE place a content example is allowed, because they are deliberately on a
  DIFFERENT topic from the student's (Spartan society or Old Kingdom Egypt, picked
  to avoid the student's own topic). They are FIXED and pre-written in
  `window.ESSAY.slots.examples` (never generated, so no invented history), shown in
  a separate panel labelled "model to study, not to copy", never beside the
  student's own paragraph. No worker or API change; quiz mode is still free.

---

# Batch 3: Business Studies subject + selectable TEEEC/TDECC paragraph model

Stage 1 of the Business Studies build. Adds a Business Studies subject to essay
practice with its own question bank and a student-selectable paragraph structure.
Still behind `essayMode`; demo-walkable before the worker is re-pasted.

## What is new

- **Business Studies subject** (`essay-content.js` -> `subjects.business_studies`):
  twelve HSC extended-response questions, three per topic (Operations, Marketing,
  Finance, Human Resources). Each carries a `qtype` (A relationship, B judgement,
  C multi-element), a topic tag, an exemplar paragraph `plan` (four syllabus
  relationships) and the core `argument`. FIN-01 and FIN-02 mirror the 2024/2025
  HSC finance questions and are flagged with a `note`. No case-study content is
  asserted; the student supplies the business evidence.
- **Selectable paragraph model (TEEEC / TDECC).** The paragraph scaffold is now
  PER SUBJECT. Business Studies ships two body slot sets and the student picks one
  in setup:
  - TEEEC = topic, explain, example, effect, concluding link.
  - TDECC = topic, define, example, comment, concluding link.
  Ancient History keeps its own body slots (point, analysis, evidence, link);
  intro and conclusion reuse the shared light sets for every subject. Confirm the
  exact letter expansions suit your school: they are just slot labels/jobs in
  `subjects.business_studies.scaffolds` and are trivial to change.
- **Subject picker in setup.** Any login can choose the subject to load its
  question bank and scaffold; it defaults to the subject routed from the class
  code. This surfaces Business Studies without needing a BS class-code rule.
- **Business worked examples** (`subjects.business_studies.examples`): fixed,
  pre-written model paragraphs (cash flow to liquidity; quality management), on a
  generic firm ("a business"), different from most questions so the shape
  transfers without being liftable.

## Walkthrough checklist

- [ ] Setup shows a Subject selector; choosing Business Studies loads twelve
      questions, a Paragraph structure selector (TEEEC / TDECC), and defaults the
      structure to six paragraphs (intro, four body, conclusion). Header reads
      "Business Studies · Year 12".
- [ ] Pick a question, pick TEEEC, start: a body paragraph's ordered skeleton reads
      topic, explanation, example, effect, concluding link.
- [ ] A new essay with TDECC reads topic, definition, example, comment, concluding
      link.
- [ ] Ancient History is unchanged: point, analysis, evidence, link.

## Worker re-paste (your step) for real Business Studies coaching

The coach now adapts to ANY paragraph model because the CLIENT sends the expected
slots for each paragraph (key, label, job) in the request. The worker was made
slot-spec-aware and backward compatible (an old worker ignores the field and uses
its built-in keys). Until you re-paste `proxy/worker.js`, Business Studies coaching
shows the labelled demo fallback, which now derives its missing-element demo from
the student's actual TEEEC/TDECC slots, so every screen still walks.

To switch on real TEEEC/TDECC missing-element detection: Cloudflare -> Workers ->
`marginal-grader` -> Edit code -> paste the current `proxy/worker.js` -> Deploy. No
new secrets. This is a one-time contract change; no future per-subject worker edit
is needed.

## Still to come (later stages, agreed)

- Stage 2: the syllabus relationship-map planner (command -> Term 1 + subterms ->
  Term 2 + subterms -> build the connections -> lock the paragraph plan -> thesis
  -> case-study evidence) that gates the writing interface.
- Stage 3: the structured paragraph builder + evaluator (Concept -> Explanation ->
  Relationship -> Evidence -> Judgement), Type-C mandatory paragraph targets, and
  exemplar model paragraphs.

---

# Patch: the marker is subject-aware

## The defect

Marking was hardcoded to Economics. The system prompt opened "You are an
experienced HSC Economics marker" and demanded four fixed criteria including
"economic terminology". Every extended response, in every subject, was therefore
judged by an Economics marker against Economics criteria. Ancient History and
Business Studies responses were affected in production.

## The fix

- The marker identity is now the SUBJECT named in the request, and the prompt
  tells it to mark as a specialist in that subject rather than another.
- Marking criteria are SUBJECT-DRIVEN. Each subject namespace carries its own
  four dimensions and the client sends them with the request:
  - `window.CONTENT.markingCriteria` for Economics (unchanged from what it was
    already marked against)
  - `window.ESSAY.subjects.<key>.markingCriteria` for Ancient History and
    Business Studies
  - an imported exam paper may carry `subject` and `markingCriteria` of its own
- A subject that ships none falls back to neutral HSC dimensions in the worker,
  so no subject is ever marked against another subject's criteria.
- The criteria names are original wording describing the assessed dimensions.

Adding marking criteria for a new subject stays content-only.

## Worker re-paste (your step) REQUIRED for this patch

The worker now reads `subject` and `criteria` from the request. Until it is
re-pasted, marking still runs the old Economics prompt.

Cloudflare -> Workers -> `marginal-grader` -> Edit code -> paste the current
`proxy/worker.js` -> Deploy. No new secrets.
