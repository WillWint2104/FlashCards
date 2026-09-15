# Gate 3C audit — what `marginal-exam@1` can already carry

> **This is the pre-implementation baseline, not the outcome.** Every claim below
> was measured against commit `0f6e100`, before any of Gate 3C was built, and a
> capability recorded here as absent may well have been added since. What the gate
> actually delivered is in its pull request and in `tests/t30.mjs`. This file is
> kept as the record of what was there and why each decision was taken.

Read-only. Nothing in this pass changed behaviour. Every claim below was run
against the tree at `0f6e100`, not inferred from reading.

The question Gate 3C exists to answer: **can an external `marginal-exam@1` file
describe a whole examination paper, and can the runtime consume that description
without source-code edits?**

Each capability the brief names is classified as one of:

| | meaning |
| --- | --- |
| **✓ consumed** | represented in the contract and correctly read by the runtime |
| **~ partial** | represented, but incompletely or incorrectly consumed |
| **✗ absent** | nothing represents it |
| **○ optional** | deliberately not required |

---

## The measurement that frames everything

`tests/fixtures/hsc-bus-2025.json` is the only whole paper the repository has.
Resolved through the Gate 3B substrate, every one of its 36 questions already
lands on a canonical format:

```
{"multiple_choice":20,"short_answer":13,"business_report":1,"extended_response":2}
```

So the response-semantics half of the contract is genuinely solved. What is not
solved is everything about the paper *around* the questions — and the clearest
evidence is that this paper had to be **deformed to fit**.

**Its subquestions were flattened.** Section II is authored as questions 21 to 24,
each with parts (a) to (d). The contract has no way to say that, so the thirteen
parts are a flat list of thirteen questions, and the authored numbering survives
only as prose inside the prompt string:

```
idx0  marks=2  "Question 21 (a) Outline the corporate social responsibilit..."
idx1  marks=2  "Question 21 (b) Outline the difference between goods and s..."
idx2  marks=3  "Question 21 (c) Explain the influence of ONE legal regulat..."
idx3  marks=4  "Question 21 (d) The owners of the cafe would like to expan..."
```

Question 21 is worth 11 marks in the real paper. Nothing in the package says so,
because question 21 does not exist as an object.

**And the student is shown the wrong number.** `examRenderQuestion` derives the
displayed number from sequence position:

```js
const num = EXAM.seq.slice(0, EXAM.pos + 1).filter(x => x.kind === "q").length;
```

Measured against the numbering the prompts actually carry, one question in this
paper disagrees today:

```
displayed Question 34   but the paper says 25   -> "Question 25. You have been hired as a cons"
```

Sections I and II agree only by coincidence — their prose numbering happens to
run 1 to 33 in the same order as the array. The moment a paper has subquestions,
an unattempted option, or a section sat on its own, the header and the prompt
disagree. This is the §3 prohibition ("do not derive display numbering from array
position if authored numbering exists") failing in the one paper we have.

---

## 1. Exam identity

| capability | | evidence |
| --- | --- | --- |
| stable exam id | ~ partial | `exam.id` authored and copied at import, **never read** |
| title | ~ partial | `exam.title` likewise; the list row shows `p.name`, a different field |
| year | ~ partial | `exam.year` likewise |
| source / publisher | ✗ absent | no field |
| assessment kind / type | ✗ absent | no field |
| version | ✗ absent | no field |

`importExamFromBox` copies `data.exam` wholesale at `app.js:2122`. Grepping every
other read of `.exam` in `app.js` finds the import site, unrelated CSS class
selectors, and the `pt.exam` study-hint field — a different thing entirely. So
the identity block is carried and then ignored: the paper knows what it is, and
nothing asks.

Authority is **not** inferred from any of these, which is correct and should stay
that way.

## 2. Curriculum identity

| capability | | evidence |
| --- | --- | --- |
| `subjectKey` as authority | ✓ consumed | Gate 3A; gated at import, no fallback |
| `klaKey` as classification only | ✓ consumed | `resolveAuthority()` does not read it; `t28` holds that |
| jurisdiction | ✓ consumed | warning-level finding when absent |
| course / stage | ✓ consumed | `examCourse()` reads `curriculum.course` |
| syllabus reference / version | ✗ absent | no field in the substrate |
| unresolved ownership stays distinct | ~ partial | it *is* distinct in `curriculumFindings`, then flattened — see §8 |

Gate 3A did this properly and Gate 3C should extend rather than revisit it. The
one real gap is the syllabus reference/version pair.

## 3. Paper structure

| capability | | evidence |
| --- | --- | --- |
| ordered sections | ✓ consumed | `sections[]`, sequenced in order |
| section titles | ✓ consumed | `sec.name` |
| section instructions | ✓ consumed | `sec.instructions` |
| section marks | ✗ absent | computed, never authored or checked |
| ordered questions | ✓ consumed | `sec.questions[]` |
| **authored question numbering** | ✗ absent | numbering is prose inside `prompt`; display is positional |
| **subquestions (21(a), 21(b))** | ✗ absent | flattened, as shown above |
| marks per question | ✓ consumed | `q.marks`, validated `>= 1` |
| either/or choices | ✓ consumed | `sec.choose` + `q.label`; not double-counted |
| instructions local to a question | ✗ absent | no field |

Either/or is the part that was built carefully. `examCounts` and `examTotals`
both count only active questions, so the 2-question `choose: 1` section
contributes 20 marks and not 40. That is worth preserving exactly as it is.

## 4. Stimulus and resources

| capability | | evidence |
| --- | --- | --- |
| text stimulus | ✓ consumed | string, or `{text}` |
| images | ✓ consumed | `img` data URI, scaled to column |
| lightbox / enlargement | ✓ consumed | `examWireLightbox()` |
| captions / labels | ✓ consumed | `caption`, used on all 15 stimulus objects |
| charts / figures | ~ partial | `charts[]` → `rvChartHTML`; **authored zero times** in the only paper |
| tables | ✗ absent | carried as images instead |
| **multiple resources on one question** | ✗ absent | `stimulus` is one object, not a list |
| stimulus kind ≠ response format | ✓ consumed | `t29` §8 asserts `lorenz`/`incomeSource` are absent from the format table |

Measured across the paper: 15 stimulus objects, fields `caption`/`img`/`text`
only, 8 with images, 0 with charts, 0 with tables. The chart path exists and is
untested by any real content.

## 5. Response semantics

| capability | | evidence |
| --- | --- | --- |
| five canonical formats | ✓ consumed | proven above on the whole paper |
| directive independent | ✓ consumed | Gate 3B `directive` / `directiveText` |
| unknown refused | ✓ consumed | `FORMAT_UNSUPPORTED`, never short answer |
| legacy admitted through the normaliser | ✓ consumed | incl. `FORMAT_CONFLICT` protection |
| **importer admits a modern `format`** | ~ **wrong** | see below |

This is the one place where Gate 3B is present in the substrate and **not wired
into the exam door**. `validateExam` still gates on a hardcoded legacy list:

```js
if (!["mc", "calc", "short", "define", "essay"].includes(q.type))
  e.push(at + "unknown type '" + q.type + "'.");
```

So a package authored the modern way —

```json
{ "format": "business_report", "directive": "recommend", "marks": 20 }
```

— is **rejected at import** as `unknown type 'undefined'`, despite the substrate
resolving it perfectly. The paper a teacher is most likely to write against the
documented Gate 3B contract is the one the importer refuses. This is the single
highest-value fix in Gate 3C and it is small.

## 6. Marking and guidance references

| capability | | evidence |
| --- | --- | --- |
| model answer | ✓ consumed | `q.model` |
| marking points | ✓ consumed | `q.points`, drives line-by-line feedback |
| vocabulary | ✓ consumed | `q.vocab` |
| scaffold | ✓ consumed | `q.scaffold` |
| criteria reference | ○ optional | resolved from `subjectKey`, not per question — correct |
| syllabus / topic / content reference | ✗ absent | no field |
| subject-specific guidance reference | ✗ absent | no field |
| **"thin" distinguished from "unsafe"** | ✗ absent | see §8 |

Worth stating plainly: the repository's own support-coverage report currently
says `0/28 pathways have sourced evidence` and `vocabulary 0 refs usable`. So the
guidance these fields would point at largely does not exist yet. Gate 3C should
represent the reference shape and prove the distinction is expressible — and must
not author guidance to make the contract look exercised.

## 7. Totals and consistency

| capability | | evidence |
| --- | --- | --- |
| question marks present | ✓ consumed | `!q.marks \|\| q.marks < 1` |
| negative / non-numeric marks | ~ partial | caught incidentally by the same test; no explicit finding |
| either/or not double-counted | ✓ consumed | `examCounts`, `examTotals` |
| section totals | ✗ absent | not authored, not checked |
| paper total | ✗ absent | not authored, not checked |
| declared vs calculated disagreement | ✗ absent | nothing to disagree with |
| duplicate question ids | ✗ absent | questions have no ids at all |
| duplicate authored numbering | ✗ absent | no authored numbering |
| references to missing stimulus / assets | ✗ absent | stimulus is inline, never referenced by id |
| unsupported formats | ~ partial | refused, but by the legacy list — see §5 |
| curriculum ownership mismatch | ✓ consumed | Gate 3A `subjectOverrides` |

The paper's raw marks sum to 120; its real total is 100, because section IV's two
20-mark options are an either/or. The runtime gets this right. Nothing checks it.

## 8. Validation taxonomy

**✗ absent, completely.** `validateExam` returns `string[]`, and the importer
shows exactly one of them:

```js
const errs = validateExam(data);
if (errs.length) return msg.textContent = errs[0];
```

Every distinction the brief asks for is collapsed: malformed, unsupported,
blocked dependency, valid-but-thin and publishable are one red string, and four
of the five cannot be reached at all. Worse, a paper with ten problems reports
one, so fixing a package is ten import attempts.

`ASSESS.curriculumFindings` already has the right shape — `{severity, code, path,
message}` — and `validateExam` flattens it to text on the way out. The taxonomy
should extend that model rather than invent a second one.

## 9. Import and persistence round trip

| capability | | evidence |
| --- | --- | --- |
| sections/questions survive | ✓ consumed | `sections` passed by reference, whole |
| curriculum survives | ✓ consumed | Gate 3A |
| canonical format survives | ~ partial | re-derived on each read, never stored |
| **unknown top-level fields survive** | ✗ **dropped** | import whitelists 8 keys |
| question ids / numbering survive | ✗ absent | nothing to survive |
| a test proves semantic preservation | ✗ absent | `ui68` covers import and reload, not semantics |

`importExamFromBox` rebuilds the paper from a fixed whitelist — `id`, `name`,
`subject`, `curriculum`, `exam`, `time`, `instructions`, `sections`. Every one of
`version`, `source`, `publisher`, `total`, `assessmentKind`, `assets` would be
**silently discarded** at the door. Today nothing authors them, so nothing is
lost; the moment Gate 3C adds any of them, the whitelist is the thing that
throws them away.

## 10. Fixtures

The only whole paper is `tests/fixtures/hsc-bus-2025.json`, which carries what
reads as verbatim 2025 HSC question wording in a public repository — recorded at
`docs/gate3-audit.md` §3.1 and not fixed there. `ui5`, `ui7` and `ui8` depend on
it. No synthetic structural fixture exists.

## 11. Authoring / runtime separation

**✓ largely clean.** The exam contract owns structure and identity; the subject
package owns criteria and terminology; `resolveAuthority()` joins them by key.
No Business Studies behaviour is hardcoded into the exam path. Gate 3C must keep
it that way — in particular, the Business Report format must stay a generic
format, not a Business Studies feature.

## 12. Tests

The only suite that touches the exam package is `tests/ui68.js`, a browser suite.
**There is no Node contract suite for `marginal-exam@1` at all.** Everything in
§1, §3, §7, §8 and §9 is pure-function work that belongs below the browser, which
is what `t30` is for. Browser coverage should stay confined to the
import → persist → reload → start boundary that genuinely needs a page.

## 13. Budgets

Frozen: fast 40 / checkpoint 60 / journeys 180 / full 800. Gate 3B left
substantial full headroom (511.8s of 800); checkpoint is the tight tier at 55.7s
of 60, which is the argument for `t30` being cheap Node work.

---

## What Gate 3C has to build

Ordered by value, not by brief order:

1. **Admit the modern format at the door** (§5). Replace the hardcoded legacy
   list in `validateExam` with `ASSESS.normaliseFormat`. Small, and it is the
   difference between the documented contract working and not.
2. **A findings taxonomy** (§8), extending `curriculumFindings`' shape: every
   problem reported, each with a severity and a category, and the five states
   kept distinct.
3. **Authored numbering and subquestions** (§3). The largest piece, and the one
   with a product-shape decision in it.
4. **Totals** (§7): authored section/paper totals, declared-vs-calculated
   reported rather than rewritten, duplicate ids, malformed marks.
5. **Identity read, not just carried** (§1) and the round-trip whitelist (§9).
6. **A synthetic whole-paper fixture** (§10) and `t30` (§12), with mutations for
   the silent failures.
