// THE HARNESS KNOWS ABOUT EVERY TEST, OR THIS FAILS.
//
// The picker redesign broke twenty-eight suites and three gates reported green
// over the whole of it, because not one of those suites was in fast, checkpoint
// or journeys, and full had not been run. The suites were maintained, they were
// in tests/, they looked exactly like the ones that were being run, and nothing
// anywhere said they were not. That is the failure this file exists to prevent,
// and it is not a testing failure: it is a bookkeeping one.
//
// So every executable file in tests/ is accounted for, by name, in one of three
// ways:
//
//   REGISTERED   run.js knows how to run it, and gate.js puts it in a tier
//   SUPPORT      it is not a test: a fixture builder, the runner, shared helpers
//   EXEMPT       it is a test and is deliberately not gated, WITH a reason here
//
// A new file that is none of these fails this suite. That is the whole point: a
// maintained regression cannot sit silently outside the harness, and the cost of
// adding one is one line here saying which of the three it is.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(path.join(HERE, f), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };

// Not tests. Each one is named rather than matched by a pattern, because a
// pattern is how a test file starts being treated as machinery.
const SUPPORT = {
  "env.js": "shared helpers: the fixture urls, the picker walks, the ladder climb",
  "run.js": "the runner itself",
  "gate.js": "the tiers",
  "snapshot.js": "writes the timing snapshot a gate prints",
  "mkshim.js": "builds the walkthrough fixture's shim",
  "mkblockshim.js": "fixture builder",
  "mkevidenceshim.js": "fixture builder",
  "mklearnshim.js": "fixture builder",
  "mkwashim.js": "fixture builder",
  "shots_pages.js": "renders the eight approved setup-flow pages for review",
  // Code under test, and the shared modules the worker suites import. They live
  // beside the suites because that is what they are tested through.
  "worker.mjs": "the Cloudflare marking worker itself, imported by t1 to t10",
  "wa.mjs": "the working-answer module, imported by t12 and t13",
  "blocks.mjs": "the sentence splitter, imported by t11",
};

// Tests that are deliberately not in a tier. Each carries the reason, and the
// reason has to be about the test rather than about it being inconvenient.
const EXEMPT = {
  "shots_p1.js": "a screenshot script for one help ladder, kept for review rather than assertion: it asserts nothing",
};
// WHAT WAS HERE AND IS NOT. friction, friction2, friction3, friction4,
// friction_p0, learning_p1 and smoke were seven scripts in tests/ that asserted
// nothing at all: they drove the app and printed counts. Every one of them had
// stopped running some time before anybody noticed, because nothing ran them.
//
// The friction and learning passes measured clicks, keystrokes and what each
// kind of student was shown. tests/bots/ does that now and ASSERTS on the
// differences between the students, which is the thing those scripts could only
// describe. smoke walked every access point looking for anything dead, which was
// worth keeping and is now tests/ui55.js, as assertions. The rest of what smoke
// covered - the essay flow end to end, the toolbelt - is ui40, ui53 and the
// support suites. So six were represented and one was converted; none was
// revived to make an old script run.

// The suites the runner knows how to invoke, read out of run.js rather than
// restated here. Two lists that have to agree is how they stop agreeing.
const runJs = read("run.js");
const listOf = name => {
  const m = runJs.match(new RegExp("const " + name + " = \\[([^\\]]*)\\]"));
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]) : [];
};
const WORKER = listOf("WORKER"), UI = listOf("UI"), BOTS = listOf("BOTS");
const REGISTERED = new Set(WORKER.concat(UI).concat(BOTS));

console.log("1. the runner's lists are not empty and do not overlap");
{
  ok(WORKER.length > 15, "the worker and contract suites are registered: " + WORKER.length);
  ok(UI.length > 40, "and the ui suites: " + UI.length);
  ok(BOTS.length === 1, "and the simulated students: " + JSON.stringify(BOTS));
  const seen = {}, twice = [];
  WORKER.concat(UI).concat(BOTS).forEach(n => { if (seen[n]) twice.push(n); seen[n] = 1; });
  ok(!twice.length, "no suite is registered twice: " + JSON.stringify(twice));
}

console.log("2. every file in tests/ is accounted for");
{
  const files = readdirSync(HERE)
    .filter(f => /\.(js|mjs)$/.test(f))
    .filter(f => f !== "t23.mjs");
  const stem = f => f.replace(/\.(js|mjs)$/, "");
  const unaccounted = files.filter(f =>
    !REGISTERED.has(stem(f)) && !(f in SUPPORT) && !(f in EXEMPT));
  ok(!unaccounted.length,
    "no file in tests/ is outside the harness without saying so: " + JSON.stringify(unaccounted) +
    (unaccounted.length ? "\n         Register it in tests/run.js and put it in a tier in tests/gate.js," +
      "\n         or name it in SUPPORT or EXEMPT here with the reason." : ""));
  console.log("    " + files.length + " files: " +
    files.filter(f => REGISTERED.has(stem(f))).length + " registered, " +
    files.filter(f => f in SUPPORT).length + " support, " +
    files.filter(f => f in EXEMPT).length + " exempt");
}

console.log("3. everything registered actually exists, and runs somewhere");
{
  const files = new Set(readdirSync(HERE));
  const missing = WORKER.filter(n => !files.has(n + ".mjs"))
    .concat(UI.filter(n => !files.has(n + ".js")));
  ok(!missing.length, "every registered suite has a file: " + JSON.stringify(missing));
  ok(files.has("bots"), "and the bots directory is there");

  // A registered suite that no tier names would be run only by a bare `full`,
  // which is exactly the blind spot. full passes an empty filter, so it runs
  // everything the runner knows: that is what makes registration sufficient.
  const gateJs = read("gate.js");
  const full = gateJs.match(/full:\s*\{[^}]*suites:\s*\[([^\]]*)\]/);
  ok(full && !full[1].trim(),
    "the full tier passes no filter, so registration alone puts a suite in a gate: " +
    JSON.stringify(full && full[1]));
}

console.log("4. the tiers name only suites the runner knows");
{
  const gateJs = read("gate.js");
  const tiers = {};
  ["fast", "checkpoint", "journeys"].forEach(t => {
    const m = gateJs.match(new RegExp(t + ":\\s*\\{[^}]*suites:\\s*\\[([^\\]]*)\\]"));
    tiers[t] = m ? [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]) : [];
  });
  Object.keys(tiers).forEach(t => {
    const unknown = tiers[t].filter(n => !REGISTERED.has(n));
    ok(!unknown.length, t + " names only registered suites: " + JSON.stringify(unknown));
    ok(tiers[t].length > 0, t + " is not empty: " + tiers[t].length);
  });
  // Nesting, so a suite in a cheaper tier is never skipped by a dearer one.
  const missingFromCheckpoint = tiers.fast.filter(n => tiers.checkpoint.indexOf(n) < 0);
  ok(!missingFromCheckpoint.length,
    "checkpoint runs everything fast runs: " + JSON.stringify(missingFromCheckpoint));
}

console.log("5. no test file is a script that asserts nothing");
{
  // A file in tests/ that never calls its own ok() is not a regression, whatever
  // it looks like. Two of them were being counted as coverage.
  const files = readdirSync(HERE).filter(f => /\.(js|mjs)$/.test(f) && f !== "t23.mjs");
  const silent = files.filter(f => {
    if (f in SUPPORT || f in EXEMPT) return false;
    const src = read(f);
    return !/\bok\(|\bassert\b|passed, /.test(src);
  });
  ok(!silent.length,
    "every registered file asserts something: " + JSON.stringify(silent));
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
