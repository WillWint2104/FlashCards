# tests

The harness for essay mode, the marking worker and the guided composer. Nothing
here is shipped: `build.js` inlines only `content.js`, `essay-content.js`,
`business-content.js` and `app.js`.

## Running it

```
npm i -D playwright        # once, if you do not already have it
node build.js              # from the repo root: rebuilds marginal-preview.html
node tests/run.js          # shims, walkthrough file, then every suite
node tests/run.js ui16 t8  # just these
```

`tests/run.js` rebuilds six things first and then runs everything:

* `mkshim.js` re-exports the internals of `proxy/worker.js` as `worker.mjs`
* `mkblockshim.js` extracts the real reconciliation functions from `app.js`
* `mkwashim.js` extracts the working-answer assembly
* `mklearnshim.js` extracts the learning-state resolution
* `mkevidenceshim.js` extracts the evidence publication gate
* `mkwalk.py` builds `tests/out/marginal-walkthrough.html`

Every shim pulls the **shipped** code out of the source files rather than
reimplementing it, so a suite cannot pass against a copy that has drifted.

Running a browser suite on its own reads `tests/out/marginal-walkthrough.html`,
which only `run.js` regenerates. After editing `app.js` or `index.html`, run
`node build.js` and `python3 tests/mkwalk.py` before running a single suite, or
it tests the previous build's bytes.

Playwright is taken from the project if installed there, and otherwise from the
system install. Where a pre-installed Chromium exists at `/opt/pw-browsers/chromium`
it is used; do not run `playwright install` in the hosted environment.

## Three gates, and which one to trust

A full run takes about 46 minutes, which is too long to be the feedback loop for
a narrow change and exactly right as the thing that decides whether a branch is
finished. So there are three:

```
npm run gate:fast         build + the shell contract        1.2 min measured
npm run gate:checkpoint   shell, entry, setup, stability    not yet measured
npm run gate:full         every suite, at a commit          46 min measured
```

`gate:full` runs `tests/snapshot.js`, which resolves a SHA, adds a detached git
worktree at it, builds there and runs the harness inside it. The run cannot see
your working tree, so you can keep editing while it goes. Its result is
authoritative **for that commit and for nothing else**, and it says so.

```
node tests/snapshot.js               HEAD
node tests/snapshot.js --sha abc123  a specific commit
node tests/snapshot.js ui39 ui40     just these
node tests/snapshot.js --keep        leave the worktree to inspect
```

This exists because the harness and development shared one working tree, and
editing during a run changed the thing being tested halfway through. Three runs
in one session were invalidated that way before the cause was addressed rather
than worked around.

**A narrow gate can only tell you about what it ran.** Changing the way the app
is entered has broken this harness in four successive waves, each hidden behind
the last, and every time the suites checked individually were green while the
full run was not. If you touched setup, navigation, or anything a suite uses to
reach the app, the fast gate is not evidence.

### Where the time goes

`tests/run.js` prints a per-suite breakdown at the end of every run. The cost is
almost entirely browser suites waiting: some 632 fixed `waitForTimeout` calls,
over 268 seconds single-pass before loops. The content suites are close to free.
Replacing a fixed sleep with a wait for the condition it was guessing at is the
cheapest speedup available and costs no coverage.

## Writing a suite

**A journey test must prove it reached its prerequisite state before asserting
the outcome. A missing prerequisite is a failure, never a reason to skip.**

This harness has produced two false greens, and both were this rule being
broken rather than a product bug:

* assertions skipped because a control the scenario needed was not found, so
  the suite recorded nothing and reported green;
* a scenario that navigated into the wrong state before asserting, so it was
  measuring an empty composer rather than the stage it named. It had never
  once run, and the guard around it hid that for as long as it existed.

So, in any suite:

* no `if (control) { ...assertions... }` around a control the scenario
  requires. Assert the control is there, then use it. Where the shape is
  genuinely convenient, write `if (!control) { ok(false, "...") } else { ... }`
  so a missing prerequisite fails loudly;
* no `.catch(() => {})` around an interaction the scenario depends on. Swallow
  a failure only for genuinely optional setup, and say why in a comment;
* assert the state you navigated into, not just the outcome you expect from
  it. `ok(atFinalStage, ...)` before the thing that is only true at the final
  stage;
* count exactly. `=== 1` rather than `<= 1`, because losing the thing
  altogether is as much a defect as duplicating it.

A regression test earns its place by failing when the defect returns. Reverting
the fix and watching the suite go red is worth the two minutes: `ui37` was
written for a defect it could not actually detect until that check was run
against it.

## What each suite covers

| suite | covers |
|---|---|
| `t1`–`t8` | the two-pass marker: the plan firewall, quote verification and snapping, dash handling, rubric and paragraph reconciliation, response-type adaptation |
| `t9` | short answer marked on criteria, never on `marks = slots` |
| `t10`, `t11` | sentence splitting and LCS block reconciliation, including the nasty cases |
| `ui`, `ui2`, `ui3` | essay mode setup, the coached screen, drafts |
| `ui5`, `ui6` | reachability from the hub, subject routing |
| `ui7`, `ui8` | revise-from-marking, answer shapes on every written question |
| `ui9`, `ui10` | the single draft across modes, revise targeting the named block |
| `ui12` | the toolbelt: five tools, help is not one of them, absent content fails cleanly |
| `ui13` | argument first, evidence filtered by argument, precise invalidation |
| `ui14` | the help ladder, help state on the block, the evidence rule |
| `ui15` | P0: plan first, no repeated setup, the response map, completion state, review and submit |
| `ui16` | P1 reference area on TEEEC: every component, every rung, all four help needs |
| `ui17` | the same reference area on TDECC |
| `ui18` | the verification gate: unsourced evidence is withheld, and everything else keeps working |
| `ui19` | Question Decode: anchors, kinds, and the panel while writing |
| `ui20` | the guidance chain: pathway guide, then area guide, then the slot's own job |
| `ui21` | the planning surface |
| `ui22` | `fin-01`: a question that does not fix its parts |
| `ui23` | `hr-01`: judgement mode, contribution roles, the conclusion |
| `ui24` | progressive construction: the start surface, the working answer, thesis drift |
| `ui25` | the working answer states intent; deciding as you go; coverage warns and routes |
| `ui26` | coverage recovery at its edges: nothing student-made is ever taken over |
| `ui27` | the writing route reaches parity with the planning surface |
| `ui28` | causal wrong-turn recovery: backwards, valid alternative, and knowing nothing |
| `ui29` | decision histories: A to B to A, own to authored to own, and growing the structure over existing prose |
| `ui30` | the pathway lesson: one surface, optional, visual, applied, and always a way back to the paragraph |
| `ui31` | the routing contract: concepts authored once, declared per pathway, and shown only where declared |

`t12` is not a browser suite. It lifts the shipped working-answer assembler out of
`app.js` and renders **3001 combinations** of chosen arguments through it, reading
each result for mechanical faults that only appear when authored fragments are
joined. Subsets and repeats both, because a student can argue the same
relationship twice.

`t13` covers the reasoning-direction check on its own, because its precision is
the whole point: an argument nobody authored that runs the right way must produce
exactly as much silence as one that was authored.

`bots/` is the simulated-student harness: three students defined as knowledge
states rather than click scripts, walked through a causal and a judgement
question. See `bots/README.md`. Run with `node tests/run.js bots`.

`friction*.js` and `learning_p1.js` are measurement passes rather than assertions.
They drive a realistic journey and print interaction counts; `shots_p1.js` captures
the support layers. Output lands in `tests/out/`.

## Fixtures

`fixtures/hsc-bus-2025.json` is the paper preloaded into the walkthrough build so
Test mode is not an empty list. Point `WALK_PAPER` at another file to use a
different one; with no fixture the build still works and Test mode starts empty.

Suites that select evidence set a source on every bank item first, as an explicit
test fixture. Unsourced evidence is withheld from students by design (see
`EVIDENCE-SOURCES.md`), and the suites supply sources rather than weakening the
rule they are testing.

## Support coverage

`node build.js --strict-learning` refuses a build while any pathway is still
`unreviewed`. Ordinary builds print one summary line instead.

`node tools/coverage.js` prints what the authored content can actually support,
per question, and `node build.js` writes the same thing to
`docs/support-coverage.md` on every build. It exists because the architecture can
promise a student more than the content can deliver, and did.
