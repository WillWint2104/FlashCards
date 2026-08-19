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

`tests/run.js` rebuilds three things first and then runs everything:

* `mkshim.js` re-exports the internals of `proxy/worker.js` as `worker.mjs`
* `mkblockshim.js` extracts the real reconciliation functions from `app.js`
* `mkwalk.py` builds `tests/out/marginal-walkthrough.html`

Both shims pull the **shipped** code out of the source files rather than
reimplementing it, so a suite cannot pass against a copy that has drifted.

Playwright is taken from the project if installed there, and otherwise from the
system install. Where a pre-installed Chromium exists at `/opt/pw-browsers/chromium`
it is used; do not run `playwright install` in the hosted environment.

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
