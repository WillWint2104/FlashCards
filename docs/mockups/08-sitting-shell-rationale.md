# State 8 — Sitting shell: reading key

Companion to `08-sitting-shell.html`, which is the canonical reference and
contains the clean screen only. Nothing in this file appears on the student's
screen.

Shown: desktop, **Practice** policy, question 11(b) of the synthetic Business
Studies paper — a part of a parent question with a shared case study.

## Where each decision lands

| decision | on the screen |
| --- | --- |
| **1 · attempts persist** | *"Saved. You can leave and come back to this paper."* under the answer box. Resume lives on the library row, not here. |
| **2 · free navigation** | Previous and Next always present; a **Questions** button opening the navigator; the `a b c d` rail; **Flag for revisit**. Nothing requires an answer before moving. |
| **3 · sitting policy** | The *"Practice · marked as you go"* pill is the switch. See the policy table below. |
| **4 · chrome from the active exam** | Header reads **Business Studies / Test mode**. No Economics, no Study topic. |
| **5 · format-aware help** | One collapsed row keyed to *explain* and 3 marks. Not rendered at all on multiple choice, and withheld wherever nothing appropriate is authored. |
| **6 · shared stimulus beside, once** | Sticky panel headed *"Shared source · Question 11"*, persisting across 11(a)–(d) instead of being re-rendered above each part. |
| **7 · parent identity** | *"Question 11 · Kerbside Coffee · 14 marks"* above *"Question 11(b) · 3 marks"*. The parent total the contract has known since Gate 3C, finally on screen. |

## What changes between the two policies

The shell is one layout. These are the only differences, and each is a slot
rather than a rebuild:

| | Practice | Exam conditions |
| --- | --- | --- |
| policy pill | "Practice · marked as you go" | "Exam conditions" |
| primary action | **Submit for marking** (green) | **Save answer**, or nothing — Next becomes primary |
| Next | secondary, outlined | **primary** |
| hint under the action | "Marked against Business Studies criteria." | its own wording, decided when that variant is designed |
| progress | `11 of 20 answered · 19/90 marks` | `11 of 20 answered` — the `.score` span is dropped |
| after submitting | feedback sheet opens in place (state 16) | nothing opens; marking follows whole-paper submission |

The live score is marked in the CSS as a policy slot (`.prog .score`) precisely
so the canonical shell does not harden it. Everything else — header, paper bar,
parent rail, source panel, help, navigation, autosave — is identical.

## The revision pass

Six corrections were made to the first draft. Recording what changed and why, so
the reasoning is not lost:

1. **The footer said "Question 12 of 20" while the student was on 11(b).** That
   is answerable position presented as academic identity, which is the exact
   substitution Gate 3C removed from the contract. It reads **`12 of 20 ·
   Section II`** now. Authored identity stays `Question 11(b)`, in the question
   head where it belongs.
2. **The part rail depended on colour.** Every state now carries a second cue:
   `✓ a` answered, `b` filled dark with a ring for current, `⚑ c` flagged, and a
   **dashed** outline for not-yet-answered.
3. **Two lines were design notes wearing an interface.** *"Stays here for 11(a)
   to 11(d)"* became the panel's own subtitle, *"Shared source · Question 11"*;
   *"In exam conditions this would read Save answer"* is gone, and the hint says
   only what is true here — *"Marked against Business Studies criteria."* A
   screen should demonstrate its policy, not describe a different one.
4. **Two competing primary actions.** Submit and Next were both solid green,
   though one evaluates work and the other skips past it. Submit stays primary;
   Next is outlined. Under exam conditions, where there is no marking action,
   Next takes the primary slot — which makes the policy change coherent rather
   than a relabelled button.
5. **The "Uses the Kerbside Coffee case study" pill was removed.** The source is
   already beside the question; the pill added a control-shaped object carrying
   nothing new. An explicit *View source* affordance is reserved for the mobile
   treatment, where the panel cannot stay visible.
6. **The live score became a policy slot** rather than a fixed part of the bar.

## Still open, deliberately

- **How a parent with several parts is presented** — one part at a time, all
  four together, or responsive. That is state 14, and it is the next mockup.
- **The mobile treatment of the source panel** — a sticky control opening a
  bottom sheet is the direction, not yet a design.
- **Exam-conditions wording** throughout, which belongs to that variant.

## Shell changes made after this state was frozen

State 8 remains the canonical sitting shell, but three later states exposed
faults in it that were fixed here rather than forked. Each is recorded where it
was settled:

| change | settled in |
| --- | --- |
| footer reads `Item 12 of 20`, not `12 of 20` | `15-navigator-rationale.md` |
| sticky footer pinned when the page does not overflow | `15-navigator-rationale.md` |
| content reserves the footer's height so nothing is overlaid | `14-calculation-rationale.md` |
| workspace rebalanced to 62/38, source given a reading measure | `14-calculation-rationale.md` |
| source header offers `⤢ Expand` instead of collapse | `14-calculation-rationale.md` |

Nothing in the list changes a token, a component's shape or the policy table
above. The layout of this screen is otherwise as approved.
