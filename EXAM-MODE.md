# Practice Exam (past paper) mode — reviewer + import guide

Import a whole past paper and sit it end to end in GUIDED mode: every question is
graded on submit, with feedback and a "try again" before continuing, and a marks
summary by section at the end. It reuses the existing question types, graders,
source/stimulus rendering, and the essay sentence-by-sentence review overlay.

## How a student reaches it

**Test mode** is a tab on the front page, next to Study, Create and Essay
practice. It is the single home for practice exams.

1. Create tab -> "Import a set or a practice exam" -> paste a `marginal-exam@1`
   JSON -> Import. (Test mode's empty state links straight here.)
2. Open **Test mode**: every imported paper is listed with its subject, question
   count, total marks and time, plus **Sit this paper** and **Delete**.
3. Sitting the paper walks the sections in order (a short section intro, then each
   question), grades each answer immediately, allows a retry, and ends on a
   per-section marks summary. Leaving a paper or finishing it returns to Test mode.
   Papers are stored locally (and travel in Backup/restore); cloud sync can come
   later.

The Study map is unchanged except for a one-line pointer ("open Test mode to sit
one") when papers exist, so there is only ever one place to manage them.

## Question types (all reuse existing graders)

- `mc` — multiple choice: `choices: [{ t, ok, why }]`, exactly one `ok`.
- `calc` — numeric: `expected` (number), `tolerance`, `working`, `model`.
- `short` / `define` — short answer / interpret the source. Give a `model` and,
  for what the marker marks for, `points` (below). Points give the mark only on a
  closed question that declares phrase matching.
- `essay` — extended response: `model`, `vocab`, optional `command`, `scaffold`.
  Graded by the worker when marking is connected (demo grade otherwise), with the
  sentence-by-sentence review overlay offered on the grade screen.

## Marking points, and the one switch for phrase matching

A written question can carry `points`: what earns its marks, with the marks each
is worth where the paper gives them. By default the points go to the subject's
marker as what it is marking for, with their weights, and the marker gives the
mark. Accepted phrasings (`need`) on their own change nothing.

A question is marked here, by matching the paper's own phrasings, only when it
declares it, and only when it is a genuinely closed short answer (decision 27):

```json
{ "format": "short_answer", "directive": "identify", "marks": 2,
  "prompt": "Identify the operations performance objective Kerbside Coffee is failing to meet at its vans, and the period when demand at the vans peaks.",
  "marking": { "mode": "phrase_match" },
  "points": [
    { "text": "Identifies speed as the objective", "marks": 1, "need": ["speed", "quick service", "too slow"] },
    { "text": "Identifies the 7am to 9am morning peak", "marks": 1, "need": ["7am", "morning peak", "breakfast"] }
  ] }
```

- `marking.mode` has one value, `phrase_match`. Any other value, or a `marking`
  that is not `{ "mode": ... }`, is refused at import rather than ignored.
- It is set on the question that is answered. On a question with parts, a
  section or the whole paper it is refused, because nothing passes it down.
- It is accepted only on a `short_answer` whose directive is `identify`,
  `list`, `name` or `state`, whose prompt begins by asking exactly that, and
  whose prompt asks for nothing open as well (explain, outline, describe,
  analyse, assess, evaluate, discuss, justify, recommend, compare and the rest).
  An open question needs judging, which phrase matching cannot do, so it goes to
  the marker.
- Every point needs whole marks of its own that add up to the question's
  `marks`, and phrasings of its own. A phrasing is matched as a case-insensitive
  substring after punctuation is set aside; one that is blank or only
  punctuation matches nothing and is refused.
- Even on a closed question, matching cannot tell a choice from a list of every
  candidate, and does not read negation. Choose phrasings deliberately.
- A short answer with no `points` is marked by the marker against the subject's
  criteria alone. There is no keyword estimate in Test Mode.

## The import format (`marginal-exam@1`)

```json
{
  "format": "marginal-exam@1",
  "name": "2024 Trial — Business Studies",
  "subject": "Business Studies",
  "time": "3 hours",
  "instructions": "Attempt all questions.",
  "sections": [
    { "name": "Section I - Multiple choice", "instructions": "...",
      "questions": [ { "type": "mc", "marks": 1, "prompt": "...", "choices": [ ... ] } ] },
    { "name": "Section III - Source analysis",
      "source": { "caption": "Source 1", "text": "...", "img": "data:image/png;base64,..." },
      "questions": [ { "type": "short", "marks": 4, "prompt": "...", "points": [ ... ] } ] },
    { "name": "Section IV - Extended response",
      "questions": [ { "type": "essay", "marks": 20, "command": "Evaluate", "prompt": "...", "model": "...", "vocab": [ ... ] } ] }
  ]
}
```

- A `source` on a **section** shows above every question in it (Section III style);
  a `stimulus` on a **question** shows above just that question. Both accept a plain
  string or an object with `caption` / `text` / `img` (data URI) / `charts`.
- **Image slots.** Where a graph, table or chart cannot be rendered as text, put it
  in `img` as a data URI. It scales to the column and can be **tapped to enlarge**
  full screen, so small print in a data display stays readable. This is how the
  HSC paper's graphs, cash-flow tables and Gantt chart are carried.
- **Either/or sections.** A section with `"choose": 1` lets the student pick which
  question to attempt (HSC Section IV style: attempt Question 26 OR 27). The intro
  lists the options; only the chosen question is sequenced, counted in the running
  total, and shown in the results. Give each option a `label` (e.g. "Question 26").
- Validation requires: at least one section with questions; every question has a
  `prompt`, `marks >= 1`, a known `type`; MC has 2+ choices with exactly one `ok`;
  calc has a numeric `expected`; short/define/essay has a `model` or a `points`
  rubric.
- A `marking` setting is valid only as described above: `phrase_match` on a closed
  short answer, on the question that is answered.

## Notes

- The paper is invisible until a teacher imports one, so this adds nothing students
  see by default beyond the import hint in the Create tab.
- Guided-only for now (feedback + retry after each question), as requested. An
  exam-conditions run (no feedback until the end) is a possible later option.
