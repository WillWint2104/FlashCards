# Guided mode — evaluation of the design advice, and the build order

Assessment of the three-mockup brief (extended response, short answer, business
report), what to take, what to change, and the order to build it in.

---

## 1. The core diagnosis is right, and it applies to what I shipped

> The guidance is physically separated from the act of writing, it is generic
> rather than responding to the active sentence.

That is an accurate description of the current build. `answerShapeBlock()` renders
a list of jobs **under the whole answer box**. It is an instruction card, not a
coach. It does not know which sentence you are on, it does not change as you
write, and on a long response it scrolls off the screen entirely.

The proposed replacement is correct: **the scaffold travels down the page with
the cursor.** One active input, its guide immediately beneath it, completed
sentences rendered as ordinary prose above. Everything else in the brief follows
from that, and none of it works without it.

So the composer is Phase A, and nothing else should be built first.

---

## 2. Three places the mockups contradict rules already enforced in code

These are not style disagreements. Each one is a rule set earlier in this project,
two of them enforced in code today, and the mockups break them.

### 2a. The five help levels are shown all at once

Mockup 1 renders a "MORE HELP, CHOOSE A LEVEL" panel listing all five rungs
simultaneously, ending in a full worked sentence at level 5.

The agreed rule was the opposite:

> L1 hint → L2 explain what this line needs to do → L3 give a direction →
> L4 sentence starter → L5 show an example. **Default state: nothing extra
> shows.** If the student knows what to write, they type and continue undisturbed.

A student who can see level 5 will read level 5. Levels 1 to 4 become decoration,
and the escalation, which is the entire pedagogical mechanism, stops existing.

**Take instead:** one rung at a time. `Help me` reveals L1. A `still stuck`
control reveals L2, and so on. The rung you have reached is remembered per
sentence, so it is not punitive to come back.

### 2b. The level 5 example is in the student's own context

Mockup 1's example reads:

> "Because this group spends significant time on digital platforms where they
> interact with brands, McDonald's uses these channels to promote its products
> and update customers on offers."

That is the same business, the same marketing element and very nearly the same
sentence as the student's own draft two lines above it. The agreed guard:

> The example must use a DIFFERENT context than the student's current one, so the
> shape transfers and the words do not drop in. Students memorise their own
> paragraphs in mastery mode. They must never end up memorising ours.

As drawn, level 5 is a paste-ready answer for the exact sentence being written.

**Take instead:** every level 5 example carries a `differentContextExample` and
the engine renders only that. If a question is about McDonald's and e-marketing,
the example is a different business and a different element. This invariant was
agreed as load-bearing and is **not yet built**, because it belongs to the line
help that Phase D introduces.

### 2c. The sentence starter carries real content

Mockup 1's level 4:

> "Because this group spends significant time on ______, McDonald's uses these
> channels to ______."

Checked against the shipped guard (`esIsFrame` in `app.js`, `isFrame` in
`proxy/worker.js`), this is **BLOCKED**, and correctly: it hands over the subject,
the causal claim and half the sentence. A frame is structure only.

Two consequences:

1. The mockup's starter cannot ship as drawn.
2. The guard's allowlist is too tight in the other direction. `Because ____, ____
   uses ____ to ____.` is also blocked, only because `uses` is not in
   `FRAME_WORDS`. The allowlist needs the common structural verbs added, or the
   rule needs to change from "every word is on the list" to "no word is a subject
   term". Phase D fixes this properly; until then frames stay as authored.

---

## 3. What the advice does not account for

### Writing makes no model call at all

The brief implies sentence help comes from the coach. It does not, and this is a
correction to what I proposed:

> Sentences are guided based on exemplars informed by JSON, not a separate call.
> We are using the final call to evaluate the entire essay, answer or paragraph.
> Sentence guidance is only for if they don't have anything, and is a mode that is
> enabled. It is not supposed to generate an AI call.

So the split is:

| | Source | Cost |
| --- | --- | --- |
| Every rung of sentence guidance, L1 to L5, including worked examples | **authored JSON** | none |
| Evaluating a finished paragraph, answer or whole response | model | one call |

This is stronger than what I suggested and better in every direction. Writing
works offline, guidance is instant, it cannot vary between two students on the
same sentence, and it cannot be unavailable because the worker is down. It also
puts the level 5 examples where the evidence bank already lives: authored and
author-checked, never generated.

Two consequences:

1. **Every L5 example is authored content**, with its `differentContextExample`
   written by hand. That is the only way the invariant can hold, since there is no
   model in the loop to enforce it against.
2. **Sentence guidance is a mode.** It is switched on, not always present. A
   student who knows what to write never sees it.

### Round-tripping to the single draft

The no-fork rule says coached practice and full attempt are the same draft
(`esFullSync`). A sentence-block model adds a third representation, so the
canonical shape becomes:

```
draft.paras[i].blocks[]   ->  join(" ")  ->  paras[i].text  ->  join("\n\n")  ->  full attempt
full attempt  ->  split paragraphs  ->  split sentences  ->  blocks[]
```

Splitting must be lossless enough that a student who writes in Full attempt and
switches to Guided does not lose or mangle anything. This is the riskiest part of
Phase A and gets its own tests.

### Editing a sentence you already accepted

The mockups only ever move forward. Real writing does not. Clicking a completed
sentence must reopen it as the active input with its own guide, without
discarding what came after.

### Generalising past one question

Mockup 1's guide text ("Show why this characteristic of the target market would
cause McDonald's to choose this e-marketing approach") is specific to one
question. Authoring that per sentence per question does not scale past the single
question Task 2 is scoped to.

**Decision:** the guide is composed, not authored:

```
guide = slotJob(step)  applied to  { area, argument, evidenceLabel }
```

All three come from the student's own selections. The engine stays content-free
and the sentence on screen is still specific. This is what makes the whole design
generalise to a subject we have not authored yet.

### Keyboard and accessibility

Enter cannot accept the sentence: it conflicts with pasting and with anyone who
types a line break. Keep the explicit `Next guide` control, add Ctrl/Cmd+Enter as
the shortcut, and move focus to the new input on advance so it works without a
mouse.

### Full attempt does not go away

Guided mode becomes the sentence composer. **Full attempt stays one box**, because
exam stamina is the point of it. The brief does not say otherwise, but it is worth
recording so the composer is never mistaken for a replacement.

---

## 4. Points where the brief supersedes an earlier decision

The earlier spec said one persistent tabbed support column on the right. The new
advice says use drawers and popovers instead, so the writing stays dominant and
support appears on demand.

The new advice is better and I am taking it, but it is a change of mind from what
was agreed, so it is recorded here rather than made silently.

---

## 5. Icons, not emoji

Agreed, and the mockups themselves use emoji chips. Emoji render differently on
every platform, cannot be recoloured, and read as informal next to the rest of the
interface.

Implementation: a small **inline SVG** set defined once and referenced by
`<use>`. No icon font and no CDN, because the app ships as a single self-contained
file. Six icons: Understand, Ideas, Evidence, Structure, Vocabulary, Help.

---

## 6. Build order

Each phase is independently walkable, which is the point.

| Phase | What | Why here |
| --- | --- | --- |
| **A** | Sentence composer: block model, active input, moving guide, completed sentences as prose, Next guide, Another sentence at this stage, click to re-edit, lossless round-trip to the single draft | The defining interaction. Nothing else works without it |
| **B** | Layout and toolbelt: ~90% width capped near 1400px, response map on the left, six SVG icon chips, contextual drawer that returns you to the exact sentence | Makes A usable at desktop width |
| **C** | Paragraph setup: choose or write an argument, choose compatible verified evidence, both kept as compact chips while writing | Feeds the guide the context it composes from |
| **D** | Progressive help, properly escalating: one rung at a time, L4 content-free frame with a widened guard, L5 different-context example only | Depends on C for context, and carries the two load-bearing invariants |
| **E** | Short answer guided mode: same engine, steps generated from marks, directive and stimulus | Reuses `answerShapes.commands`, which already keys 19 directives |
| **F** | Business report guided mode: section model, scenario evidence, recommendation and justification, executive summary written last | Structurally different, and Section III of the 2025 paper needs it |
| **G** | Close the loop: Review step in the response map, and revise from marking returns into the composer at the exact sentence | Connects the composer to the marking rebuild already shipped |

Phases E and F are held: more guidance on both is coming.

---

## 7. Decisions taken

1. **Phase A scope.** The **engine** is general from the start; the **content**
   starts with one question. This flips my earlier reasoning: now that guidance is
   authored JSON rather than composed at runtime, "general" means authoring
   exemplars for every question, which is not cheap. The engine reads whatever
   exemplars a question ships and degrades to the slot job alone when it ships
   none, so adding a question later is content-only. This matches the standing
   instruction to prove the loop on one question before generalising.
2. **Guided mode replaces Coached practice.** Three overlapping writing surfaces
   is one too many. Full attempt stays exactly as it is, because exam stamina is
   the point of it.
3. **Word targets vary by question type, and never gate.** A recommended range per
   type, shown as guidance. A student who wants to write more can. Nothing is
   blocked and nothing is truncated.
4. **Evidence sources arrive with the authored JSON**, on import with the research
   round. Until an item carries a checked source it shows the existing "check a
   current figure yourself" badge rather than a link. Nothing is invented here.

---

## 8. Blocks are durable state, not a view (resolved, and built)

The review was right and this is now the model.

Making `blocks[]` a view of `paras[i].text` was fine while a block was only text.
It stops being fine the moment a block carries a job, a help level, an argument, a
piece of evidence and an id that marking points at, because rebuilding from text
throws all of that away the first time somebody fixes a comma.

**Inverted.** A block is first-class and durable:

```js
{ id, slot, text, status, helpLevel, argumentId, evidenceIds, sourceRefs }
```

`paras[i].text` is derived from the ordered blocks and stays the source of truth
for marking, export and full attempt, so nothing downstream changed.

**The hard case is an edit made somewhere else**, and it is reconciled rather than
rebuilt. When the text moves on without us, the sentences it now contains are
aligned against the blocks we hold by longest common subsequence: a sentence whose
words are unchanged **keeps its id, its slot and its help level**, a sentence that
is new becomes a fresh block marked `derived` with no slot, and a sentence that
disappeared is dropped. An edit in the middle no longer renumbers everything after
it. Reconciling writes straight to storage, because the ids it keeps are what
marking will point at later.

### Marking targets a block id

The payload now carries the assembled response **and** the sentence list, each
line with its id, slot and paragraph. `focus.targetBlockId` comes back with it.

Enforced in code, as everywhere else: an id that was not in the list we sent is
**refused**, and the quote fallback that already exists takes over. A hallucinated
id can never send a student to the wrong sentence. `checks.focusBlock` reports
whether a real target came back.

Revise then opens that exact sentence, which is what makes the loop close:

```
content -> choice -> writing -> marking -> exact revision
```

with no model call anywhere in the writing half.

---

## 9. Corrections and guidance for E and F

### Section III is 20 marks, not 15

Verified against the 2025 paper rather than taken on trust:

```
Section III - Business report | 1 question | 20 marks
```

No title page and no reference list in an exam-writing interface.

### The report's sections come from the task, not a template

The same paper settles this. Question 25 carries its directives in the task:

```
In your report:
  • outline ONE relevant human resource management process the business could use
  • describe the purpose of the above chart and any issues found in the chart
  • recommend appropriate global factors the business can use to achieve cost leadership
```

Three directives, three body requirements. So the report structure is
**generated from the task's own bullets**, never a fixed Issue 1 / Issue 2 /
Issue 3. The report begins with a task-analysis stage, not a sentence input:
what the scenario shows, what each directive asks, which syllabus areas answer
it, which stimulus facts support it. Only then does the composer open.

Executive summary is written **last** and identifies the issues, the strategies
and the intended outcomes. The conclusion reviews without introducing anything
new. Described in our own words, never lifted.

### The toolbelt is adaptive, per mode

| Mode | What structures the writing | Toolbelt |
| --- | --- | --- |
| Short answer | creditworthy jobs from directive, marks and stimulus | Understand, Source **or** Ideas, Structure, Vocabulary |
| Business report | task components, scenario issues, report sections | Understand, Task, Evidence, Structure, Vocabulary |
| Extended response | argument pathway, body paragraphs, TDECC | Understand, Ideas, Evidence, Structure, Vocabulary |

`Evidence` does not appear when the support is a supplied stimulus; `Source` does.
Help stays attached to the active sentence. If a Help icon appears in the toolbelt
it opens the same stack for the active block, never a second help system.

Opening any tool captures the active paragraph, block and slot, and closing it
returns the cursor to that exact sentence. That return is as much the feature as
the drawer.

One engine, one authored-help system, one contextual-resource system, one marker.
Three modes that do not look like skins of each other.

### Phase D, restated

The verb allowlist is the wrong rule. The right distinction:

- **Scaffold frame** — blanks force the student to supply the meaningful content.
  `Because ____, McDonald's uses ____ to ____.` is fine: the reasoning is still
  theirs to write.
- **Model sentence** — fully written. Allowed only at the final rung, and only
  from `differentContextExample`.

So the guard stops asking "is every word structural" and starts asking "does this
leave the meaningful content blank". That is both looser where it was wrong and
tighter where it matters.

---

## 10. Five safeguards, assessed and applied

### Weaken the quote fallback: applied

A valid `targetBlockId` always wins. When it is invalid the quotation is used
**only if it resolves to exactly one sentence**; two matches means neither, and
the student is returned to the paragraph rather than sent to a guess. Enforced on
both sides: `groundFocus` in the worker and `esBlockForQuote` in the app.

### A nastier reconciliation suite: applied, and it found a freeze

Eleven splitter cases and twelve reconciliation cases now run against the shipped
functions, extracted from `app.js` rather than reimplemented. They found three
real defects:

1. **An infinite loop.** The tail of the reconciler, `while (j < m) out.push(...)`,
   never advanced `j`. It only triggers when the old blocks run out before the new
   sentences do, which is exactly what merging two sentences into one does. A
   student who joined two sentences in full attempt would have frozen the tab. The
   original single test never left the loop in that state, which is precisely the
   reviewer's point about the easy case.
2. **The splitter broke on ordinary writing.** `3.5`, `$1,200.50`, `Dr. Smith`,
   `e.g.` and `U.S.` each became sentence boundaries, so blocks held fragments and
   marking pointed at half a sentence.
3. **The duplicate rule was checking the wrong side.** It tested the new count
   when the question is which OLD block survived.

The governing rule is now explicit in the code: when reconciliation is ambiguous,
**lose the metadata rather than attach it to the wrong sentence**. A duplicated
sentence whose count changed has its slot, argument and evidence cleared and is
flagged `ambiguous`. A wrong slot is worse than none, because marking would then
send the student to the wrong line.

Where identity cannot be preserved (a word changed mid-sentence, a merge, a
split, a move), the block is rebuilt with no slot rather than inheriting a
neighbour's.

### Argument change invalidation: mechanism built, UI in C

`esSetParagraphContext()` bumps a `contextVersion`, keeps every existing sentence
and its original provenance, and flags each one `needsReview`. Nothing is silently
relabelled. Phase C wires the prompt: "your argument changed, review these three
sentences to make sure they still support it." As the review says, that is
educationally correct rather than merely safe.

### Report structure is many-to-many: recorded for F

`taskRequirements[] -> reportSections[]`, authored, not generated one-to-one. A
requirement may split into subsections and related requirements may combine. The
2025 question's Gantt bullet clearly wants purpose and issues as separate
subsections, so one bullet becoming one giant heading would be its own rigid
formula.

### Short answer is criteria-driven: already true, now stated

Nothing infers `marks = number of slots`. `answerShapes.commands` keys the jobs by
directive; marks only set the depth note. Phase E uses authored `responseJobs[]`
when a question ships them and falls back to the directive shape when it does not.
Marks are a depth signal; the question and its criteria determine the jobs.

### The marking rule, locked in

Now in the pass 2 message, next to the block list:

> This list is NAVIGATION AND CONTEXT ONLY. Award marks solely for the knowledge,
> reasoning, application and communication in the written response above. A slot
> name, a chosen argument, a chosen piece of evidence or a concept the student
> selected while writing is a statement of what they INTENDED, never evidence that
> they did it. If the sentence does not communicate it, it does not earn it.

This is the same rule as "the plan is context, not marks", applied to the block
metadata that Phase C is about to start sending.

---

## 11. Phase B, built against the acceptance criteria

| Criterion | How it is met |
| --- | --- |
| Never crush the composer | Grid is `230px / minmax(650px,1fr) / 340px`. Below 1320px the drawer **overlays** rather than squeezing the centre. Below 1000px the response map collapses first. Tested: composer width is unchanged when a drawer opens. |
| Exact context capture | `esCaptureContext` records paragraph, block, slot, argument, evidence, the half-written text, the **selection range** and the scroll position. Close or Escape restores all of it. Tested: cursor mid-word, open a tool, Escape, type a character, it lands at exactly the same offset. |
| Tools change with context | Understand and Vocabulary resolve to the **syllabus dot point** the student is writing about, not the section it lives in. Ideas reads the authored plan options. Evidence separates the student's selected items from other compatible ones. Structure names the current job and the sequence. |
| Help stays out of the drawer | Five tools. Help is not one of them and stays under the active sentence. |
| Progressive reading | Quick explanation first, `Read more` opens the fuller text. Terms sit with the quick explanation so the two tools agree. |
| No AI anywhere | Every tool reads authored content. Tested: open all five, count worker calls, zero. |
| Missing resources fail cleanly | A tool with nothing behind it is **disabled**, never filled. Tested on Ancient History, which has no content layer: Understand, Evidence and Vocabulary are disabled while Structure still works, because Structure is derived rather than authored. No filler text anywhere. |
| Compact, ignorable | A strip of icon chips, measured under 60px tall. Inline SVG, no emoji. The guide is still immediately under the active line, so a student who needs nothing can write straight past it. |

**One content bug this found.** The first build resolved Understand to a *section*
and showed its first dot point, so an e-marketing sentence opened on situational
analysis, SWOT and the product life cycle. That is precisely the generic-chapter
failure the criteria warn about. Resolution is now point-level and scores against
what the student actually wrote, and a section with no matching point disables the
tool rather than showing something adjacent.

### `ambiguous` has a student-safe treatment now

It no longer stays internal. A sentence the reconciler could not place, or one
written before the paragraph's argument changed, is highlighted with a plain line:

- "this sentence changed a lot. Does it still fit here?"
- "your argument changed. Does this still support it?"

with **Looks right** to clear it. No mention of reconciliation.

---

## 12. Phase D, and the evidence rule corrected

### The invalidation rule is now precise

The earlier "only an argument change flags" was too broad in the other direction.
The rule the durable provenance actually supports:

| Change | Flagged |
| --- | --- |
| No evidence, then the first selection | nothing |
| Evidence changed before any sentence used it | nothing |
| Evidence A removed after sentences rested on it | **only those sentences** |
| A different argument chosen | every written sentence |

A sentence "rests on" evidence when it was written at the evidence step while that
item was selected, or when it names the item. Both are recorded on the block, so
the flag lands on the sentence that used it and nowhere else. Adding evidence
still flags nothing: it does not make what is already written wrong, and flagging
it would train the student to ignore the flag.

### The ladder

One question only: *I know what I want to say but cannot construct this line.*
Not knowing the content is Understand, not knowing what to argue is Ideas, not
knowing what to use is Evidence.

```
L0  guide       what this sentence must accomplish
L1  hint        prompt the thinking            -> Still stuck
L2  needs       the relationship to establish  -> Show a structure
L3  frame       grammar given, meaning blank   -> Give me a start
L4  starter     an opening they finish         -> Show another example
L5  example     fully written, somewhere else, with its pattern named
```

Revealed one rung at a time, nothing by default, each rung's button naming what
comes next. All authored, zero model calls, verified by counting worker requests
across the whole pathway.

### Safety is declared, not inferred

Rungs are **typed**, so the validator checks a contract rather than guessing from
wording:

- `scaffoldFrame` must keep at least two placeholders, and the words it does
  supply must not already carry the question's own concepts, the selected evidence
  or the case study. This is what replaces the verb allowlist that wrongly rejected
  `uses`. The question is "has the meaningful content been left for the student",
  not "is every word structural".
- `differentContextExample` must declare a `context` and must not mention the case
  study the student is writing about. It is rendered with its pattern named and
  **no insert or apply control anywhere on it**, asserted in the test.

A rung that is not authored does not appear. Nothing is filled in.

### Help belongs to the sentence

`helpLevel` and `helpContextVersion` live on the block. Reopen a sentence and the
help it was written with is there. Change the paragraph's argument and that help
is withheld, because a level 4 starter written for the previous argument must not
sit under a sentence that now belongs to a different one. The student's writing is
never touched by any of this.

This found a real gap: the guide and ladder only rendered for the active line, so a
reopened sentence had no help at all. Both now follow whichever line is being
written, and a reopened sentence shows the job **it** was written to do.

### The sixteen-step acceptance test passes

Select argument A and evidence A, reach Explain, confirm L0 only, reveal L1 to L5
one at a time, assert zero model calls, assert L3 keeps meaningful blanks, assert
L5 comes only from `differentContextExample` and carries no insert control, write
and accept a sentence, reopen it and confirm the help persists, change the
argument, confirm the writing survives and the sentence is flagged, confirm the
stale help is withheld, then change evidence after writing an evidence-linked
sentence and confirm exactly that sentence is flagged and nothing else.

---

## 13. Next: walk it, do not extend it

The architecture is good enough that the remaining risks are pedagogy and UX. The
next step is to write a full response, Introduction through four body paragraphs to
Conclusion, and look for friction: too many clicks per sentence, prompts that
repeat, help that is too wordy, and any point where the student loses sight of the
essay as a whole. Features come after that, not before.

---

## 14. The friction pass, and what it changed (P0)

The full-response pass was run three times (independent, moderate and high support)
across a 24-sentence, six-section answer to `mkt-01`. It confirmed the sentence loop
is cheap (1.04 to 2.42 clicks per sentence) and that the real problem is everything
around it: the essay was being planned paragraph by paragraph, the student could
never see what they had already argued, finishing a paragraph produced no state, and
guided mode could not show or submit the response it had just helped build.

P0 answers those, and only those. Guidance coverage (P1), multi-sentence components
(P2) and density (P3) are deliberately not touched here.

### The response plan comes first

A question that ships authored pathways now opens on **Build your response**. One
card per body paragraph, each locked to its own part of the question, three options
plus "Write my own argument", and evidence optional at this point. The plan writes
straight into the paragraphs, so it is not a separate object that can drift.

Consequences, all measured:

* Planning costs **6 clicks once**, replacing **20 clicks spread over six sections**.
* Entering a planned paragraph costs **1 click** and lands on the writing line.
* Each card offers **3 options, in its own area**, not the same 12 everywhere.
* The introduction is written with the four body arguments in the rail beside it,
  instead of signposting arguments that do not exist yet.
* A four-part question whose structure has three body paragraphs is offered the
  matching structure rather than silently losing a part.

The plan is a recommendation, never a gate: "Start writing anyway" leaves any row
open, and an unplanned paragraph still asks in place exactly as before.

### The introduction and the conclusion stop pretending to be body paragraphs

Neither is ever asked to choose a body relationship. The introduction's rail shows
**Your plan**; the conclusion's shows **Arguments you established**, with the words
written for each and a jump back into any of them. Nothing new is introduced in a
conclusion, so no evidence picker appears there.

### The response map carries the argument, not only the name

Every section in the left rail now shows what it argues, and any written section can
be opened and read in place. At the start of Body 3 the student can see **four
section arguments with no click at all** and read **any earlier section in one**,
where before there was nothing.

### A finished paragraph is a state

When every part of the structure has something in it, the composer becomes a
completion card: the word count, "Continue to <next section>", "Add another
sentence", and "Check this paragraph". It never leaves an empty box under the last
label, and it never accepts a sixth sentence still labelled as the fifth. Writing
more is one click away, so the structure recommends and does not gate.

### Guided mode ends where a real answer ends

**Read the whole response** opens the entire draft on one page, section by section,
with each paragraph's argument, its word count and a way back into it, and a Submit
that runs the same marking path as a full attempt. Guided work is no longer
described as written cold, here or in the full-attempt screen.

### The word count knows which number is which

`This paragraph N words` and `Whole response M words`, with the mark-derived target
attached to the whole response and labelled as a guide, not a limit.

### Acceptance

`ui15` covers all of it in 47 assertions: the plan screen opens first and the
composer does not, the structure offer appears and disappears correctly, the four
parts map to the four bodies, entering a planned paragraph costs one click, the
completion state appears and steps aside, both word scales are shown, the map
carries arguments and previews, the review page shows the writing itself and can be
submitted, evidence chosen while planning still invalidates precisely and by name,
and the conclusion is handed the four arguments it has to draw together. Zero model
calls throughout: planning, the map, completion and review are all authored data and
local state.

---

## 15. P1: the reference area, built as a vertical slice

Processes is authored end to end as the standard the rest of P1 will be written
against. Nothing else was scaled. The point of this phase is that the voice, the
depth and the amount of help can be judged on something real before sixty
combinations exist.

### The content model

The schema is general. There is no `processesHelp` special case, and every layer
below already works for any subject, question and area:

```
question
  requirements
  pathways[]                      one per defensible argument, tagged with its AREA
    relationship                  the one-line label the student picks
    meaning                       what the argument actually claims, in student words
    concept.key ------------------> subject.concepts[key]     the Learn resource
    evidence[] { label, why, limits }  ---> the fixed evidence bank
    guides   { component: text }  what this component has to do FOR THIS argument
    help     { component: ladder } hint, needs, direction, starter, example
subject.concepts[key]
    title, syllabus, quick, readMore[], terms[{term,meaning}], confusions[], example, related[]
```

A student-authored argument runs the same path with the pathway link missing: the
component guidance still appears, the concept resource resolves through the
paragraph's content match, and the evidence tool widens to the topic instead of
narrowing to a pathway. Authoring your own argument removes constraints, not
support.

### Guidance is written per argument, per component

Every component of the Processes paragraph carries its own guide and its own five
rung ladder for all three pathways. Components are keyed so that the SAME authored
content serves both paragraph models: TEEEC reads topic, explain, example, effect,
link, and TDECC reads topic, demonstrate knowledge, explain, case study, connect.
Six component keys cover both, so choosing a different scaffold never drops the
student onto generic prose.

TDECC was also corrected to the five components it is actually taught as:
Topic, Demonstrate knowledge, Explain, Case study, Connect.

### The ladder, with a new third rung

L1 hint, a question. L2 what this part has to do. **L3 the direction to take**, which
names the reasoning without wording it. L4 a start you finish. L5 the same reasoning
somewhere else. L3 used to be a blank frame; a frame is still accepted where one is
authored, but a direction is preferred because it leaves more of the thinking with
the student.

Three rung types are validated in code, so safety is a property of the data:

* `reasoningDirection` must address the writer, must be under 320 characters, and
  must not name the subject's case study.
* `scaffoldFrame` must leave at least two meaningful blanks and must not hand over
  the question's own concepts or the selected evidence.
* `differentContextExample` must declare its context and must not mention the case
  study the student is writing about.

Nothing on the ladder has an insert or apply control, at any level.

### Four help needs, four separate answers

| the student's problem | where it is answered |
|---|---|
| I do not know what I could argue | **Arguments**, with what each pathway means |
| I do not understand the content | **Learn**, quick explanation then read more |
| I do not know what evidence to use | **Evidence**, filtered to the chosen argument |
| I know what I mean but cannot write this part | **Help me**, under the line |

Help is deliberately still not a tool in the belt, and the belt is still not an
assistant.

### Evidence says what it is for, and what it cannot prove

Each item now carries the verified fact from the fixed bank, why it suits THIS
argument, a limit on how far it can be pushed, and its source. Sources are not
invented: an item with none says so rather than being filled in. The picker shows
the best few for the argument, with the rest of the bank behind one link.

Removing evidence is its own labelled action. Clicking a chosen item no longer
silently unselects it, because removal can invalidate writing.

### Measured

One Processes paragraph, five components, three profiles:

| | clicks | rungs reached | drawers |
|---|---|---|---|
| independent | 5 | 0 | none |
| moderate | 25 | 2 per component | Learn |
| high support | 60 | 5 per component | Learn, Arguments, Evidence |

186 words of interface on screen before any help is requested, 27 permanent
controls. Zero model calls at every level of support. After the paragraph is
written the student's own words are 119 against 172 of interface.

`ui16` (39 assertions) covers the reference area on TEEEC; `ui17` (9) repeats it on
TDECC; `ui15` (48) still covers P0.
