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
  for line-by-line feedback, a `points` rubric (below).
- `essay` — extended response: `model`, `vocab`, optional `command`, `scaffold`.
  Graded by the worker when marking is connected (demo grade otherwise), with the
  sentence-by-sentence review overlay offered on the grade screen.

## Line-by-line short answers: the `points` rubric

Each short/interpret question can carry a marking-POINTS rubric. One mark per point
addressed; the student sees which points they hit or missed, with a hint for each
miss. Deterministic, offline, and exam-authentic (1 mark = 1 point).

```json
{ "type": "short", "marks": 3, "prompt": "...",
  "model": "A full-marks answer ...",
  "points": [
    { "text": "Identifies a cash flow strategy", "need": ["factoring", "early payment"], "hint": "Name a specific strategy." },
    { "text": "Explains the mechanism", "need": ["timing", "availability"], "hint": "How does it change the cash?" },
    { "text": "Links to liquidity", "need": ["liquidity", "short-term"], "hint": "Tie it back to short-term obligations." }
  ] }
```

- `need` is the list of accepted phrasings (case-insensitive substring match). If
  omitted, the point's `text` is used. Choose stems deliberately.
- `marks` per point defaults to 1; the question score is capped at the question's
  `marks`.
- Without a `points` rubric, short answers fall back to the standard keyword +
  model-overlap grade.
- When marking is connected, each short answer also offers an optional **Deeper AI
  review** (the worker's sentence-by-sentence pass).

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
- Validation requires: at least one section with questions; every question has a
  `prompt`, `marks >= 1`, a known `type`; MC has 2+ choices with exactly one `ok`;
  calc has a numeric `expected`; short/define/essay has a `model` or a `points`
  rubric.

## Notes

- The paper is invisible until a teacher imports one, so this adds nothing students
  see by default beyond the import hint in the Create tab.
- Guided-only for now (feedback + retry after each question), as requested. An
  exam-conditions run (no feedback until the end) is a possible later option.
