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

### Cost and latency

Sentence-level help on a 20 sentence response could mean 20 or more model calls.
At present one coaching call covers a whole paragraph.

**Decision:** L1 to L4 are generated **in code** from the slot job, the student's
chosen argument and the chosen evidence label. They are deterministic, instant and
free. Only `More help` beyond L4, and marking, hit the model. This also removes
the failure mode where the guide is unavailable because the worker is down.

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

## 7. What I need decided

1. **Scope of Phase A.** Build the composer for the one question the guided
   composition work is scoped to, or for any question from the start? Building it
   general costs little more, because the guide is composed rather than authored.
2. **Where guided mode lives.** A third mode beside Coached practice and Full
   attempt, or does it replace Coached practice? Replacing it is cleaner and
   avoids three overlapping writing surfaces, but it retires something already
   walked and approved.
3. **The 800 word target** in mockup 1. Displaying a word target is a claim about
   what the question expects. Confirm the number, or it says "aim for a sustained
   response" instead of asserting a figure.
4. **Evidence provenance.** Mockup 1 shows `View source` on each evidence item.
   The bank has verify flags but not source URLs for every item. Items without a
   checked source will show the existing "check a current figure yourself" badge
   rather than a link.
