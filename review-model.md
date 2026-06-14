# Long-Response Review Mode — Data Model & Worker Contract (Step 1)

This is the contract between the Cloudflare worker (`proxy/worker.js`) and the
review-mode UI (built in later steps). It is the shape the worker's
`submit_review` tool returns and the app consumes. The design source of truth is
`marginal-review-prototype-v2.html`; this document and `CONTENT.reviewSample` in
`content.js` encode that design's data shape so the UI steps build against a
fixed contract.

**Scope of step 1:** the data shape + the worker grading prompt only. No UI is
built yet. The full implementation spec is `marginal-review-mode-implementation-spec.md`.

---

## 1. The review object

The worker returns one object. Field names match `CONTENT.reviewSample` exactly.

```json
{
  "summary": "One or two sentence overall comment, writable register, no em-dashes.",
  "total": 13,
  "max": 20,
  "paragraphs": [ /* Paragraph */ ],
  "rubric": [ /* Criterion x4 */ ],

  "score": 13,
  "overall": { "summary": "..." },
  "criteria": [ { "name": "...", "status": "met|partial|missing", "comment": "..." } ],
  "next_steps": ["..."],
  "missing_vocabulary": []
}
```

- `summary`, `total`, `max`, `paragraphs`, `rubric` are the **review fields** the
  new UI reads.
- `score`, `overall`, `criteria`, `next_steps`, `missing_vocabulary` are
  **legacy fields**, derived in code by `finalize()` in `proxy/worker.js`, so the
  current essay result sheet keeps rendering until the review UI ships. The model
  is not asked for them. See §5.

### Paragraph

```json
{
  "name": "Income redistribution",
  "score": 3,
  "max": 6,
  "reasons": [ { "kind": "good|weak", "text": "..." } ],
  "sentences": [ /* Sentence */ ]
}
```

`reasons` is the score-open status list shown by default on the paragraph. A
strong paragraph may have an empty `sentences` array.

### Sentence

```json
{
  "text": "The tax-transfer system reduces income inequality, ...",
  "issues": [ /* Issue */ ]
}
```

A **missing key sentence** (an absent thesis or link the student should have
written) is encoded with `text: null`:

```json
{ "text": null, "link": true, "missing_label": "a sentence linking to the next paragraph", "issues": [ /* Issue */ ] }
```

- A sentence with `issues: []` is kept verbatim (it was fine).
- `link: true` marks a connective bridge between paragraphs.
- `missing_label` is the short chip label shown where the sentence belongs.

### Issue

```json
{
  "kind": "fix|term",
  "severity": "critical|should|optional",
  "head": "Say which Ginis these are",
  "why": "... mark key terms inline with {{term|definition|page}} ...",
  "ladder": [ /* exactly 3 Rungs */ ]
}
```

- `severity`: `critical` (coral, loses marks), `should` (gold, lifts the band),
  `optional` (blue, e.g. add a term). Issue order is critical-first, stable
  document order within a tier.
- `kind`: `fix` (rewrite a line) or `term` (optional add-a-term).
- `why`: one to three sentences. Key terms are wrapped `{{term|definition|page}}`
  so the UI can render a tappable popover; `page` is `0` when unknown.

### Rung (the rewrite ladder)

```json
{
  "level": "Clear|Better|Band 6",
  "text": "The disposable-income Gini falls from 0.436 to 0.324 once tax and transfers apply.",
  "starters": [ "... <b>____________</b> ...", "... <b>____________</b> ...", "____________" ]
}
```

- Exactly three rungs per issue: `Clear`, `Better`, `Band 6`. **Every rung must
  be creditworthy** (see §4).
- `starters` are the three fading practice scaffolds for **this rung**, derived
  from this rung's own `text`: rep 1 most scaffolded, rep 3 nearly blank. The
  blank is the literal string `____________`; the word the student must recall is
  wrapped `<b>____________</b>`.
- **Key invariant:** starters live *inside* each rung, not in a parallel array.
  This makes the prototype's "shared starter set drills the wrong target" bug
  impossible by construction.

### Criterion (rubric)

```json
{
  "name": "Use of evidence & data",
  "score": 3,
  "max": 6,
  "descriptor": "Accurate, relevant statistics that support the argument.",
  "bands": [ { "range": "3-4", "text": "...", "here": true } ]
}
```

Exactly four criteria: thesis & sustained judgement, use of evidence & data,
economic terminology, cohesion. `here: true` marks the band the response sits in
(the UI renders the "you are here" marker; it is not baked into the text).

---

## 2. Question context (input, on the essay card)

The question the worker grades and the review re-displays. General enough for the
real HSC types (stem only, stem + scenario text, stem + rendered graphs). In step
1 only `stem` / `command` / `marks` are used; `scenario` and `graphs` are defined
here and rendered in the charting step (step 8).

```json
{ "stem": "Evaluate the effectiveness of the tax-transfer system", "command": "Evaluate", "marks": 20 }
```

---

## 3. Severity ranking

```js
const SEVRANK = { critical: 0, should: 1, optional: 2 };
```

Used to sort issues (critical first) and to pick the worst outstanding severity
for a sentence span, the paragraph rail dot, and the score colour.

---

## 4. Honest marking (enforced)

- The score must be consistent with what is flagged. `finalize()` sets
  `total = sum(paragraph.score)`, clamped to the question's marks, so the total
  can never assert more than the paragraph marks justify. Paragraph and rubric
  marks are clamped to their maxima.
- The grading prompt instructs the model to flag every real fault, keep marks
  consistent with the flags, and scale depth to the band (fewer, more
  foundational issues for a weaker response).
- Every ladder rung must be creditworthy: `Clear` is the simplest sentence that
  still earns the mark, never a sub-pass strawman.
- Register: every model sentence, starter, reason, descriptor and explanation is
  writable Year 12 English with no em-dashes.

`CONTENT.reviewSample` is internally consistent: paragraphs `3+3+2+5 = 13/20` and
rubric `5+3+2+3 = 13/20`.

---

## 5. Backward compatibility (why a worker redeploy is safe now)

The new prompt changes the worker's output shape. To avoid breaking the live
essay result sheet before the review UI exists, `finalize()` derives the legacy
fields (`score`, `overall.summary`, `criteria`, `next_steps`,
`missing_vocabulary`) from the review object in code. So redeploying the step-1
worker keeps the current flow working and adds the rich fields the later UI will
consume.

Changing the prompt in the repo does **not** update the live worker: re-paste and
redeploy `proxy/worker.js` in Cloudflare for it to take effect.

---

## 6. Deferred to later build steps

- Review shell, paragraph view, issue walkthrough, ladder/practice UI (steps 2-5).
- Clickable key-term popover and the deferred source link (step 6).
- Layered rubric UI (step 7).
- Charting module + stimulus overlays, and the `graphs` shape on the question
  context (step 8).
