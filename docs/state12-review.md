# State 12 review — rework, do not freeze

Produced by an eight-dimension adversarial review over the mockup, its rationale,
the audit it rests on, and the runtime both describe. 48 findings raised, 21
survived a refutation pass, merged and re-ranked here.

**Verification standing, stated plainly.** Refutation was **one skeptic per
dimension, not three per finding**. An earlier run at three-per-finding launched
204 agents and hit the session limit with 179 failures, losing its transcript
when the container was recycled. This pass is real but thinner than intended,
and nothing below should be read as three-vote verified.

**What I re-verified myself, by reading the source rather than trusting the
review:** B1, B2, B4, B5, B6, and the contrast and structure measurements. Those
are marked. The rest carry the review's own evidence.

**Four of the six blockers are errors in my own audit or rationale, not in the
design's ambition.** That is the honest summary of this document.

---

# State 12 design review — final

**Verification standing.** Every claim below was re-checked by reading the files in this pass; the runtime claims (findings 1, 2, 4, 6, 7, 8) were re-confirmed by executing `finalize`/`groundProse` against the mockup's own answer text. `proxy/worker.js` and `tests/worker.mjs` are byte-identical except for `tests/worker.mjs`'s trailing `export` block (lines 1704-1707), so line numbers are interchangeable; I cite `proxy/worker.js`. Caveat as instructed: the upstream adversarial pass was **one skeptic per dimension, not three per finding** — an earlier three-per-finding run hit the session limit. Verifier corrections have been folded into the claim text below and the overstatements dropped.

---

## BLOCKERS

### B1. The criterion → evidence / observation-count association does not exist in the payload
*(merges upstream 2, 5, 7, 11, 17, 21)*

**Wrong.** The mockup's central device — a per-criterion remark count, plus a verified quotation filed *under a named criterion*, plus two response-specific paragraphs per criterion — requires a criterion↔issue link the response schema does not carry.

**Evidence.** `proxy/worker.js:366-392`: a rubric item is exactly `{name, score, max, descriptor, bands}`, where `descriptor` is documented at `:376` as "One line on what the criterion rewards." `proxy/worker.js:343-357`: an issue is `{kind, severity, head, why, ladder}`, living under `paragraphs[].sentences[]`, with no criterion field. `proxy/worker.js:1651-1655` derives `criteria[]` as one `comment` per criterion. `grep -n criterion proxy/worker.js` returns only prompt text and `reconcileRubric`'s name-matching — no linkage anywhere. Against that: `docs/mockups/12-extended-response.html:313, 322, 327, 336` render `2 observations / 1 observation / 2 observations / 1 observation`, and `:316-319`, `:330-333` nest `<div class="ev">` inside `.crit`. The counts equal the number of `<p>` the author wrote under each `.crit` (2/1/2/1).

**Why blocker.** Breaks *"Do not fabricate … any control not supported by real data."* The chip reads as a per-criterion strength ordinal — criteria 1 and 3 get "2", and those are exactly the two that also get an evidence box — which reconstructs the criterion mini-verdict the locked rules forbid. It also contradicts the rationale's own containment rule at `12-extended-response-rationale.md:74-76` ("nothing appended to it that the payload cannot support"). Both quotes *are* verbatim in the textarea (checked); the fabrication is the **attribution**, not the transcription.

**Narrowing that survives:** `rubric[].descriptor` genuinely is criterion-level prose, so **one line** of narrative per criterion is derivable. The second paragraph, the count, and the criterion-filed quote are not.

**Smallest fix.** Delete the `.obs` chip and the `.crithead .obs` rule (`:230-232`); hoist the `In your response` blocks out of `.crit` to one response-level evidence section under the overall judgement. Cap the criterion body at one descriptor line until the worker returns more.

---

### B2. Legacy fields are snapshotted **before** `groundProse` runs, so `overall.summary` and `next_steps` keep unverified quotation marks
*(merges upstream 1, 14)*

**Wrong.** `finalize` derives the legacy fields the renderer reads at `proxy/worker.js:1649-1662`, then calls `groundProse` at `:1668`. `groundProse` reassigns `r.summary` (`:1459`) and mutates `iss.head` (`:1463`) — it cannot reach the string copies already taken.

**Evidence (executed).** With `summary: 'You write "an outstanding command of marketing theory" throughout.'` and a matching `issues[0].head`:
```
overall.summary    : "You write \"an outstanding command...\" throughout."   ← quotes kept
r.summary          : "You write an outstanding command... throughout."       ← stripped
next_steps[0]      : "You write \"an outstanding command...\" without support" ← quotes kept
issues[0].head     : "You write an outstanding command... without support"   ← stripped
checks.prose       : {"quoted":0,"unquoted":2}                                ← reports "cleaned"
```
Renderers read only the stale copy: `app.js:1989` and `app.js:2512` both use `fb.overall.summary`; `fb.summary` is never read anywhere in `app.js`.

**Why blocker.** The rationale sources the `.mnote` paragraph from `overall.summary` (`rationale:16`) and the audit asserts at `docs/state12-audit.md:199` that its "Embedded quotes [are] already verified or de-quoted by `groundProse`." That is the opposite of the truth. An invented quoted run keeps its quotation marks on the one paragraph the student reads first — the locked *"MUST NOT show … an unverified quote as the student's words."* `checks.prose` reports the review as cleaned while an uncleaned copy of the same claim ships.

**Smallest fix.** Move `worker.js:1649-1662` to after the `groundProse` call at `:1668`. Then correct `state12-audit.md:199` to say the guarantee holds *only because of that ordering*, and add a test asserting `next_steps[i] === ` the corresponding grounded `issues[].head`.

---

### B3. `groundProse` has no coverage for `rubric[].descriptor` — the largest text block on the screen is ungrounded and nothing says so

**Wrong.** `groundProse`'s entire field list is `proxy/worker.js:1459-1463`: `r.summary`, `r.focus.why`, `p.reasons[].text`, `sn.issues[].why`, `sn.issues[].head`. No rubric, no descriptor, no `bands[].text`. The design puts `descriptor` on screen as the main narrative.

**Evidence (executed).** With `descriptor: 'You say "the business tracked its conversion rate every quarter", which is…'` against the mockup's own answer:
```
rubric[0].descriptor  : quotation marks intact, byte-unchanged
criteria[0].comment   : identical (copy-by-value at worker.js:1653)
checks.prose          : {"quoted":0,"unquoted":2}   ← counts summary + head only
```
`app.js:2512` already renders `c.comment` verbatim on the exam path.

**Why blocker.** On a live payload the four criterion narratives are the one place a fabricated quotation renders with its marks on, and neither `checks.prose` nor `checks.grounded` records it.

**Precision (verifier, upheld — I re-read the audit).** There is **no internal contradiction in the audit**: `state12-audit.md:73` already says a criterion descriptor is "not verifiable — prose about the response as a whole", and `:206` classifies it as "legitimate as narrative, not as measurement". `rationale:53-55` ("machine-checkable") is scoped to the two `In your response` quotations, and the four narratives in the mockup contain zero quotation marks. So the defect is **latent**, not present on this page: `groundProse` has no descriptor coverage, and the rationale's provenance table (`:18`) puts descriptor on screen without ever stating that that narrative is ungrounded.

**Smallest fix.** Add `(r.rubric||[]).forEach(c => { c.descriptor = fix(c.descriptor); (c.bands||[]).forEach(b => b.text = fix(b.text)); })` to `groundProse` — **and run it before `worker.js:1651`**, or patch `criteria[].comment` too, because `:1653` copies the descriptor by value. (The upstream fix citing line 1554 was wrong on mechanics.) Then say in the rationale that the criterion narrative is ungrounded model prose, or claim nothing for it.

---

### B4. The audit's *"The renderer drops it"* is false: the ladder, the rubric score pills, the band descriptors and a rewrite box are one click from this exact screen

**Wrong.** `docs/state12-audit.md:232` asserts of `issues[].ladder`: **"The renderer drops it."** It does not.

**Evidence.** `app.js:2517` `const hasReview = g.fb && Array.isArray(g.fb.paragraphs) && g.fb.paragraphs.length > 0;` → `app.js:2523` emits `<button class="btn" id="examreview">Work through the issues (N) →</button>` into the same action row as `Try again` → `app.js:2540` `if (hasReview) examOpenReview(...)` → `app.js:2563` `openReview(fb, …)`. That workspace renders: the three Clear/Better/Band 6 rungs as pickable model sentences (`app.js:3323`), practice reps, a rewrite textarea (`app.js:3332`), an assembling "your paragraph now" panel, `Re-grade this paragraph` (`app.js:3361`), per-criterion `score/max` pills (`app.js:3368`), band descriptors marked `← you` (`app.js:3367`), and `"Tap any one to see the band descriptors and where your response sat."` (`app.js:3370`). Extended responses reach this branch via `app.js:2431`.

**Why blocker.** Every item on the State 12 MUST NOT list is live on the screen the proposal claims to describe. `rationale:123-127` ("No rewrite box … no generated replacement prose") is true of the static mockup and false of the product. The mockup silently omits `reviewBtn` from the action row without recording a removal, so a builder has no instruction to remove it.

**Precisions (verifier, upheld).** `hasReview` is at `app.js:2517`, not 2522. "Every marked extended response" holds only against a live endpoint — `demoEssay` (`app.js:607-629`) returns `fb` with no `paragraphs[]`, so `hasReview` is false on a demo grade. `11-short-answer-rationale.md:145` already flagged `examDeepReview` for short answer. What is unrecorded is the removal of the `hasReview`/`examreview` branch specifically.

**Smallest fix.** Correct `state12-audit.md:232`. State in the rationale that `reviewBtn`/`examOpenReview` is removed (or gated to Essay Practice) for extended response in Test Mode, and draw the resulting action row.

---

### B5. The marker asserts a figure count the response contradicts on the same screen

**Wrong.** `docs/mockups/12-extended-response.html:324` reads "**Figures appear once**, and the rest of the evaluation rests on assertions…". The response rendered 30 lines above it (`:291-297`) contains **zero** figures.

**Evidence.** Extracted the textarea and scanned: `re.findall(r'\d', text)` → `[]`; `%` absent; `$` absent; 190 words. The nearest things to a figure are two unquantified comparatives, "a much lower cost per view" and "Sales to members grew faster than sales overall".

**Why blocker.** The one claim on this screen a student can check in two seconds is false, on a screen whose entire argument is that its claims are checkable. Breaks *"Never claim precision the data does not support."*

**Verifier narrowing, applied.** Drop the upstream charge that `:329` ("never returned to in figures") contradicts `:324` — the two are compatible. The contradiction is between `:324` and the response itself.

**Smallest fix.** Rewrite `:324` to what is true, e.g. "The business is described more often than it is used, and no figure is given anywhere for the share, the cost per view or the sales growth the judgement rests on."

---

### B6. The four criterion names are re-cased, which is the one thing the design calls its strongest grounding *(confirmed item C, promoted)*

**Wrong.** `essay-content.js:200-204` authors all four names in lower case (`"knowledge and understanding of course content"`, etc.). The mockup renders all four in Title Case (`12-extended-response.html:313, 322, 327, 336`). `rationale:17` claims they are "required back verbatim in order" and calls them "the strongest grounding in the payload".

**Why blocker.** The locked MAY-show is "the four **authored** Business Studies criterion names in authored order." A re-cased name is not the authored name; `reconcileRubric` (`worker.js:1426-1444`) exists precisely to force the authored strings back. This is also the standing *"Sentence case"* rule and *"Never silently normalise."* Order is preserved; case is not.

**Smallest fix.** Set the four names lower case in the mockup, or state in the rationale that a `text-transform` is applied to authored strings and why that is not a normalisation.

---

## MAJOR

### M1. `checks.focusQuoted` is a non-empty test, not a verification result, and `focus.area` is never grounded *(merges upstream 3, 13)*

`proxy/worker.js:1687` `focusQuoted: !!(r.focus && r.focus.quote)`. The verified path is `:1483-1484` (`quoteSpan` → `spanText`), but when `paragraph`/`area`/`why` are missing or out of range, `:1495` runs `if (!quote && typeof best.text === "string") quote = best.text;` **with no `quoteSpan` call**. `snapSentences` has already run (`:1666`) and leaves an unlocatable sentence's model-written text in place, tagging only `sn.unplaced = true` (`:1353`).

**Executed:** `focus.quote = "The candidate demonstrates an outstanding command of marketing theory throughout."`, `checks.focusQuoted = true`, `answer.includes(focus.quote) === false`, source sentence `unplaced = true`, `checks.grounded = 0`. Separately `focus.area` came back with quotation marks intact while the identical string in `issues[0].head` was stripped — `f.area` is not in `groundProse`'s list.

`state12-audit.md:248` states the gate "`focusQuoted` false → no focus anchor at all", which only means anything if true implies verified. **Narrowing (verifier):** State 12 as drawn renders no focus anchor, so today this is confined to the audit's class-C row (`:215`) rather than to the mockup.

**Fix.** `focusQuoted: !!qAt`; verify the fallback (`quoteSpan(words, best.text)`) and skip `unplaced` sentences; add `f.area` to `groundProse`. Amend `state12-audit.md:215` to "class C **only on the verified path**."

### M2. `snapSentences` verifies against the whole response, so a "sentence" can be welded across a paragraph break or snapped to the wrong occurrence

`proxy/worker.js:1351` `const at = quoteSpan(idx, sn.text, 250);` — `idx` is the whole-response index (`:1665`); `scopeFor` (`:1017-1021`) is never called, though `normalizeDiagnosis` uses it at `:1103` with the comment at `:1005-1007` ("a quote lifted from anywhere verifies, and the marker is pointed at the wrong place").

**Executed** against the mockup's own answer, the model "sentence" `"Sales to members grew faster than sales overall in the year after launch. However, the business also cut its prices across the range."` verifies, and `spanText` returns a run containing a literal `\n\n` — one `<q>` spanning two of the student's paragraphs. `worker.js:1355` increments `snapped` on both branches, so this counts as verified in `checks.grounded`.

**Verifier corrections applied:** `normalizeDiagnosis` does *not* scope every quote (`scoped` is a per-call flag; terminology at `:1136` and planVsResponse at `:1145` run unscoped), and `MARKING.md:88-90` is scoped to diagnosis observations, which carry a paragraph number — it is not asserting this of `snapSentences`. The honesty claim also survives literally, since `spanText` always returns the student's own characters; what breaks is the **unit**, the **occurrence**, and `checks.grounded`.

**Fix.** `snapSentences` already iterates `r.paragraphs`, so the paragraph index is in hand at `:1345` — no schema change needed: `quoteSpan(scopeFor(idx, pi + 1), sn.text, 250)`. Reject a span whose `spanText` contains a blank line.

### M3. `groundProse` fails **open** on any quoted run longer than 240 characters

`proxy/worker.js:1454`: `t.replace(/["“]([^"“”]{3,240})["”]/g, …)`.

**Executed:** a 263-character fabricated inner run — `verifyQuote` returns `false` for it — produced `checks.prose = {quoted:0, unquoted:0}` with the quotation marks **still on**. The same string truncated to 239 characters produced `{quoted:0, unquoted:1}` and lost its marks. `quoteSpan` is willing to check up to 60 words (`worker.js:1032`), so there is a band of lengths the verifier would accept that the extractor never hands it. Directly contradicts *"Fail closed. Never silently normalise"* and `state12-audit.md:70`.

**Verifier correction applied:** `worker.js:1351`'s 250-word cap is `snapSentences`' sentence-locating limit, not a quotation cap — drop it from the comparison.

**Fix.** Raise the bound to `quoteSpan`'s ceiling and strip the marks **unconditionally** above it, counting the strip in `unquoted`.

### M4. The audit's "Every returned field, classified" table is incomplete, and `checks.grounded`'s denominator is misstated

`proxy/worker.js:1346` `if (typeof sn.text !== "string" || !sn.text.trim()) return;` runs **before** `total++` at `:1347`, so missing-sentence slots never enter `checks.sentences` or `checks.grounded`.

**Executed:** a paragraph with one located sentence plus one `{text:null, link:true, missing_label:"…"}` slot returns `{sentences:1, sentencesVerified:1, grounded:1}` — a perfect score while an unverifiable absence claim rides along untouched in the payload.

Genuinely unclassified in `state12-audit.md:194-236`: `sentences[].text === null` + `.missing_label` + `.link` (schema `worker.js:344-346`), `paragraphs[].name`, `issues[].kind`, `focus.area/.index/.sentence` (`:1523`), and `r.max` (`:1420`). **Verifier correction applied:** the upstream list was overstated — `criteria[].name/.comment`, `focus.targetBlockId`, `credited[]` and `paragraphs[].reasons[]` *are* covered (audit lines 47-55 and class E), and `paragraphs[].score/.max`, `rubric[].score/.max` are in class D.

**Fix.** Add a class-E row for the missing-sentence triple stating it is an unchecked absence claim excluded from `checks.grounded`; add the remaining five fields; restate the denominator as "non-empty, located sentence slots."

### M5. "State 16 does not need to exist" is argued from a floor measurement and never examines the refused or failed branches *(merges upstream 19, 20)*

`rationale:105` concludes state 16 is unnecessary, on evidence drawn from one ~250-word, 6-observation specimen of a 20-mark question.

*(a) Height is unbounded in the one dimension the argument rests on.* `worker.js` caps `reasons` at 3 (`:324`), `rubric` at 4 (`:368`) and `issues` at 2 (`:345`, enforced `:1605`), and **explicitly refuses** to cap sentences or paragraphs — the comment at `:1596-1598` says so ("Sentences are NEVER capped"). So observation count, and therefore document height, has no ceiling. The extra-height figures in the upstream finding are estimates, not measurements; the structural point is confirmed.

*(b) Two thirds of state 16 were never looked at.* `docs/testmode-ux-audit.md:382` assigns state 16 "Feedback sheet — marked, **refused**, **failed**". `gradeWritten` can refuse before any request for at least nine codes — `app.js:541` (FORMAT_UNSUPPORTED / FORMAT_CONFLICT / FORMAT_ABSENT), `app.js:545` (FORMAT_NOT_WRITTEN), `app.js:551` (SUBJECT_UNRESOLVED, CURRICULUM_UNOWNED, SUBJECT_KEY_MALFORMED, SUBJECT_OVERRIDE_REFUSED, SUBJECT_UNREGISTERED, CRITERIA_ABSENT) — and `app.js:2504` routes all of them to `unmarkedHTML`. The string "refus" appears **zero** times in the rationale.

**Fix.** Narrow to "state 16's *marked* branch is unnecessary for extended response; refused and failed still need it", **or** draw the refused and failed variants and re-measure at a realistic 700+ word, 6-8 paragraph response.

### M6. Layout: the 780px justification is arithmetically backwards, the response is the only uncapped block, and the three "62ch" caps resolve at two font sizes

`12-extended-response.html:80` `.work.solo .qcard{max-width:780px}`, justified at `rationale:83-86` as keeping the response "as readable as it is beside a source panel". At 1280px: `main` is 1100px (`:42`), grid free space 1082px, so the sourced column is `1082 × 1.6/2.6 = 665.8px`; minus `.qcard{padding:20px 22px}` and 1.5px borders (`:82`) its text column is **618.8px**, against **733px** solo — 18.5% *wider*, not equal.

`.answerbox{width:100%…}` (`:124`) carries **no** `max-width`, while `.mnote` (`:212`), `.crit p` (`:233`) and `.ev` (`:241`) are all capped at 62ch — so the student's own response is the widest measure on a page whose argument is readability.

`body` (`:27`) sets `font-family` and `line-height` but **no** `font-size`. `.mnote` and `.crit p` set 14.5px; `.ev` sets none, so its `62ch` resolves against the 16px default — the evidence box overhangs the paragraph above it by ~10%.

**Fix.** Cap `.answerbox.long` at the prose measure and drop the false comparison from `rationale:83-86` (or set the solo card near 666px so the claim becomes true). Move the cap to `.ev q`, or set an explicit `font-size` on `.ev`.

### M7. `q.model` — "What a top answer covers" — renders on **this exact question**, and State 12 neither shows it nor rules on it

`app.js:2512`'s extended branch ends with `${q.model ? '<details><summary>What a top answer covers</summary>…' : ""}`. Walking `tests/fixtures/bus-practice-paper.json`: exactly three questions author a `model` — `q11c` (calculation), `q15` and `q16` (the only two extended responses). **Q15 is the question the mockup depicts.**

**Verifier corrections applied.** It is not "one of only two in the whole fixture" (three), and it is not wholly undecided — `11-short-answer-rationale.md:162` already fixes the Test Mode treatment for an authored model ("plus a collapsed *Model answer* below the surface"), and `:169-171` records that none was drawn because none was authored there. The real defect is narrower: State 12 draws the one question in the paper that *does* author one, shows nothing, and says nothing about whether the frozen collapsed-disclosure treatment carries over.

Same branch also prints `${esc(c.comment || c.status)}` — the literal word "met"/"partial"/"missing" whenever `reconcileRubric` produced an empty descriptor (`worker.js:1443`). That is a **build note**, not a new exclusion: `state12-audit.md:207` and the rationale's exclusion table already cover it in principle.

**Fix.** Add `q.model` (a question-authored field, distinct from worker response fields) to the audit's table, and say in the rationale whether "What a top answer covers" survives. Record `c.comment || c.status` as the concrete removal target.

### M8. Below-fold and collision behaviour contradicts the rationale's own measurement *(confirmed items A, B)*

`rationale:98-101` claims "nothing important is below the fold". Measured: it holds at 1512×982 and 1280×900 only. At 1280×800 the overall judgement is cut; at 1280×700 **the mark itself** is below the fold; at 390×844 the page is 3.8 screens / 3208px. `Try again` sits at document y=840 regardless of viewport — colliding with the ~832px footer top at 1280×900, and below the fold entirely at 800 and 700 — and its position depends on response length, so the rationale's "finding" understates it as a fixed y-offset. This is the same measurement M5 rests on, so the two must be resolved together.

### M9. Contrast: seven text styles at or near 2.00:1 *(confirmed item D)*

Measured: `.saved` 2.00, `.where` 2.00, `.markhead .who` 2.00, `.mnote .who` 2.00, `.crithead .obs` 2.00, `.ev .lbl` 3.39, `.across` 3.61. `--ink-3` on white is 2.00:1 — below WCAG AA (4.5:1) and below the large-text floor (3:1). **Repo-wide, not State 12's alone**: `.saved` and `.where` are inherited from the frozen State 8 shell, so a fix touches a frozen file. State 12's own additions are `.crithead .obs` (dies with B1), `.ev .lbl` and `.across`.

### M10. Zero headings; the criteria are sibling divs *(confirmed item E)*

No `h1`-`h6` anywhere in the page. Criterion names are `<span class="n">` (`:212, 313, 322, 327, 336`), section headings are divs, and the four criteria are sibling `<div class="crit">` rather than a list. A screen-reader user gets no document outline and no "4 items" count on the one structure the rationale calls the strongest grounding in the payload.

### M11. The textarea is live in a read-only review, and shows half the answer *(confirmed item F)*

`12-extended-response.html:291` `<textarea class="answerbox part long" rows="9">` — neither `readonly` nor `disabled`, with `.answerbox.long{min-height:210px}` (`:200`) showing ~50% of the 190-word response. Standing rule: *"Test Mode is read-only assessment review."* A student can type into their submitted answer with no save path and no indication the edit is discarded.

---

## MINOR

### m1. The "appears zero times" verification is stated in a form that fails on its own page

`rationale:37-39` lists *met* among strings appearing "**zero** times". A substring scan of the tag-stripped body returns `met` once, inside "pricing **met**hod" (`:315`).

**Verifier narrowing, applied — and I agree.** Under word-boundary matching, which the italicised word list invites, the check **passes**, and nothing on the MUST NOT list leaks through it. So the upstream charge that the check "was either not run" is **unsupported and is withdrawn**. This is a wording defect: restate as word-boundary matching. The separate observation that string-absence is a weak test stands as commentary — every real leak above (B1, B4) passes it trivially — but that is B1 and B4's problem, not this one's.

### m2. 32 dead CSS selectors carried over *(confirmed item G)*

The whole `.parent`/`.pt` part rail, `.help`, and `.srcpanel` including its 62/38 rule and the Expand control — none used by this page. Confusing for a builder reading the mockup as spec, especially since M6's justification argues *about* the 62/38 rule the page never applies.

### m3. One em dash, inherited *(confirmed item I)*

"Section IV - Extended response" in the paper bar, verbatim from the frozen State 8 shell. Not State 12's to fix unilaterally; note it against the shell.

---

## SOUND — do not touch

- **The mood threshold.** `14/20 = 0.7` really is "Most of it" by `app.js:2506`'s own thresholds (`ratio >= 0.6`). Confirmed item H holds.
- **Both `In your response` quotations are genuinely verbatim** in the textarea — checked by exact substring match. The transcription is honest; only the criterion attribution (B1) is not.
- **The band-exclusion argument** (`rationale:29-31`, `state12-audit.md:159-187`) is correct and well evidenced: no subject package authors bands, and `rubric[].bands[]` is model-written against a generic set.
- **The criterion-mark exclusion** is correct: `shareOut` + `fitScores` (`worker.js:1305-1330`) do force apportionment onto a total decided at paragraph level.
- **The `In your response` / `Across your response` device itself** is the right shape — it degrades specificity instead of showing a confidence number, exactly as `state12-audit.md:240-252` argues. The device is sound; its *placement under criteria* (B1) is not.
- **`missing_vocabulary` unconditionally `[]`** (`worker.js:1662`) — confirmed, and correctly excluded.
- **The one-inset-surface containment rule and the no-criterion-cards decision** are consistent with the frozen 11 and 14 mockups.
- **The `Finish paper →` footer label at item 20 of 20** is correct and matches `app.js:2516`'s `last` computation.

---

## RECOMMENDATION

**Rework — do not freeze.**

Not because of polish. Three of the six blockers are load-bearing in a way a fix list cannot absorb:

1. **B1 removes the screen's organising device.** Two of the three per-criterion surfaces — the count and the criterion-filed evidence — cannot be computed from the payload. Deleting them leaves four criterion names each carrying one descriptor line, which is a *different hierarchy* from the one drawn, not a corrected version of it. The rationale's containment section, its provenance table and its 2.28-screen measurement all rest on the drawn version.

2. **B4 means the mockup is not describing the product.** The ladder, the rewrite box, the criterion score pills and the band descriptors are one button from this screen in the shipped build, and the proposal both asserts their absence (`rationale:123-127`) and asserts the runtime drops them (`state12-audit.md:232`). Freezing a design whose exclusion list is contradicted by the code it claims to describe locks in a false record.

3. **B2 and B3 mean the state's central promise — "a quotation mark here is a promise, and the promise is machine-checkable" — is unbacked for the two fields carrying the most text.** B2 is present today on any live payload; B3 is latent but on the same path. These are ~4-line worker fixes, but they must land *before* the design is frozen, because the audit is the artefact that would authorise building on the false guarantee.

B5 and B6 are cheap copy fixes. M5 is the one that compounds: the "state 16 does not need to exist" conclusion is drawn from a floor-case measurement of a screen that is about to change shape under B1 and B4, and it never looked at the refused or failed branches at all — so it should be withdrawn and re-argued after the rework, not narrowed in place.

The right next move is a second draft of `12-extended-response.html` with the criterion body reduced to what the payload supports, the evidence hoisted to response level, the action row showing what Test Mode actually renders, and the worker ordering fixed — then re-measure height and fold, then freeze.
