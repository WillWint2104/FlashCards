// THE MUTATION RUNNER.
//
// A suite that passes proves nothing until it has been made to fail on purpose.
// Every mutation in tools/mutations.js is a real fault that has either happened
// in this repository or is one line away from happening, and each one NAMES the
// regression that owns it. The runner applies the fault, runs that regression,
// and records whether it noticed.
//
// WHAT THIS FILE IS SHAPED BY. Mutation testing was being done by hand here, in
// throwaway bash blocks, and it went wrong in every way a hand-rolled loop does.
// A killed run left a watcher looping on a condition that could never be met,
// for three hours and forty-two minutes. Results lived in a scratch file that
// the next block overwrote. There was no timeout, so one hung mutant would have
// stopped everything with nothing to show. And the obvious lazy choice, running
// the whole gate against every mutant, is 474 seconds each.
//
// So:
//
//   TARGETED     each mutation names its owning regression and only that runs
//   BOUNDED      a per mutant timeout, recorded as TIMEOUT rather than hanging
//   CLEAN        the whole process tree dies on timeout, not just the shell
//   DURABLE      results are appended as they happen and survive a Ctrl+C
//   RESUMABLE    a restart skips what is already recorded
//   HONEST       node and browser process counts are checked between mutants,
//                and the run stops rather than accumulating zombies
//
//   node tools/mutate.js                 every mutation, resuming
//   node tools/mutate.js --only a,b,c    named mutations
//   node tools/mutate.js --sample 8      the first eight, for proving the runner
//   node tools/mutate.js --repeat        ignore previous results
//   node tools/mutate.js --list          print the catalogue and exit
const fs = require("fs");
const path = require("path");
const { spawnSync, execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const MUTATIONS = require("./mutations.js");
const OUT = path.join(ROOT, "tests/out/mutation-results.jsonl");
const LOCK = path.join(ROOT, "tests/out/.mutation-in-flight");
const DEFAULT_TIMEOUT_MS = 180000;

// WHILE THIS RUNS, THE WORKING TREE CONTAINS A DELIBERATE FAULT.
//
// That is not a detail. A commit taken during a run captures whatever mutant was
// applied at that moment, and it happened: b9c2d59 shipped runtime.js with the
// ladder type tag removed, because `git add -A` ran while runtime-untypes-ladder
// was in the tree. The suites had all passed; the commit was simply of the wrong
// bytes.
//
// So the run announces itself in a file. It says which mutation is applied and
// to which file, it is removed on every exit path including a signal, and it is
// what anything committing should look at first.
function lock(m) {
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  fs.writeFileSync(LOCK, JSON.stringify({
    pid: process.pid, mutation: m ? m.id : null, file: m ? m.file : null,
    since: new Date().toISOString(),
    warning: "A deliberate fault is in the working tree. Do not commit until this file is gone.",
  }, null, 2) + "\n");
}
function unlock() { try { fs.unlinkSync(LOCK); } catch (e) { /* already gone */ } }
// Only when this file IS the run. tests/t26.mjs requires it to test the guards,
// and a required copy registering an exit handler would delete a lock belonging
// to a real run happening in another process.
const IS_RUN = require.main === module;
if (IS_RUN) {
  ["exit", "SIGINT", "SIGTERM", "SIGHUP"].forEach(sig =>
    process.on(sig, () => { unlock(); if (sig !== "exit") process.exit(130); }));
}

// ---- THE TREE THIS RUN IS ALLOWED TO START FROM ---------------------------
//
// A mutation is applied by writing a file and undone by writing back what was
// read. That is only an undo if what was read was committed: run it over
// uncommitted work and the "restore" writes back the uncommitted version, which
// is right until anything goes wrong, and then there is nothing to compare
// against and no way to tell the fault from the work.
//
// It went wrong here in the worst available way. Mutation testing was done by
// hand, in shell blocks, and `git checkout <file>` was used to undo a mutation on
// three files that had uncommitted changes in them. The changes were gone. They
// were reconstructed from diffs printed earlier in the same session, which worked
// and is not a recovery procedure - it depends on having printed the right thing
// before needing it.
//
// So: tracked files must be clean before a single mutation is applied, and the
// tree is checked again after every one. Not the files this run intends to touch -
// ALL of them - because the value of the check is that "clean" is a fact about
// the tree a person can act on, and a partial clean is not one.
//
// Returns null when this is not a git checkout at all, which is a different
// answer from "clean" and is refused for its own reason: nothing there can undo a
// mutation if the process dies between applying and restoring.
function trackedDirty(cwd) {
  try {
    // stderr ignored on purpose: "not a git repository" is an ANSWER here, not a
    // problem to print. It is returned as null and refused with its own words.
    return execFileSync("git", ["status", "--porcelain", "--untracked-files=no"],
      { cwd: cwd || ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n").filter(Boolean).map(l => l.slice(3).trim()).filter(Boolean);
  } catch (e) { return null; }
}
// The words, apart from the check, so a test can assert what a person is told and
// not merely that something was refused.
function dirtyRefusal(paths) {
  if (paths === null) {
    return "REFUSING TO START: this is not a git checkout.\n" +
      "A mutation is undone by writing a file back, and nothing here can recover if that does not happen.";
  }
  if (!paths.length) return null;
  return "REFUSING TO START: " + paths.length + " tracked file" + (paths.length === 1 ? " has" : "s have") +
    " uncommitted changes:\n  " + paths.join("\n  ") +
    "\nCommit or stash them first. A mutation run writes files and writes them back," +
    "\nand over uncommitted work that is not an undo. There is no flag for this.";
}

const argv = process.argv.slice(2);
const flag = n => argv.indexOf(n) >= 0;
const val = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };

if (IS_RUN && flag("--list")) {
  MUTATIONS.forEach((m, i) => console.log(
    String(i + 1).padStart(3) + "  " + m.id.padEnd(28) + m.owner.padEnd(10) + m.why));
  console.log("\n" + MUTATIONS.length + " mutations");
  process.exit(0);
}

// ---- what has already been done ------------------------------------------
// One JSON object per line, appended the moment a mutant finishes. A crash or a
// Ctrl+C loses the mutant in flight and nothing else.
function priorResults() {
  if (flag("--repeat") || !fs.existsSync(OUT)) return {};
  const by = {};
  fs.readFileSync(OUT, "utf8").split("\n").filter(Boolean).forEach(line => {
    try { const r = JSON.parse(line); by[r.id] = r; } catch (e) { /* a torn last line */ }
  });
  return by;
}
// Appended to the file AND kept here. summarise() used to re-read the file
// through priorResults(), which honours --repeat by returning nothing: a --repeat
// run therefore matched none of its own results and printed
//
//   MUTATION RESULTS - 0 of 10 recorded ... MUTATION RUN PASS
//
// over three mutations that had just survived. A summary that cannot see the run
// it is summarising is worse than no summary, because it is green.
const THIS_RUN = {};
function record(r) {
  THIS_RUN[r.id] = r;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.appendFileSync(OUT, JSON.stringify(r) + "\n");
}

// ---- the process census ---------------------------------------------------
// A browser left behind by one mutant makes the next one slower and eventually
// makes the machine lie. Counted before and after every mutant.
// By process NAME, not by command line. The first version of this used
// `pgrep -f chromium`, which matched the shell running the census, because that
// shell's command line contains the word. It reported a browser leak on the
// first mutant and stopped the run: a detector that counts itself.
const BROWSERS = ["chrome", "chromium", "headless_shell", "chrome_crashpad"];
function census() {
  let comms = [];
  try { comms = execFileSync("ps", ["-eo", "comm="], { encoding: "utf8" }).split("\n").map(x => x.trim()); }
  catch (e) { return { node: 0, browser: 0 }; }
  return {
    node: comms.filter(c => c === "node").length,
    browser: comms.filter(c => BROWSERS.indexOf(c) >= 0).length,
  };
}

// Wait for the process count to come back to where it started, for a few
// seconds, and report what it actually settled at.
function settle(base, ms) {
  const deadline = Date.now() + (ms || 6000);
  let last = census();
  while (Date.now() < deadline) {
    if (last.browser <= base.browser && last.node <= base.node + 1) return last;
    try { execFileSync("sleep", ["0.4"]); } catch (e) { /* nothing to wait with */ }
    last = census();
  }
  return last;
}

// ---- running one command, bounded, with its whole tree ---------------------
// detached:true puts the child in its own process group, so killing -pid takes
// the browser it spawned with it. Without that, a timeout kills the shell and
// leaves Chromium running, which is the leak this runner refuses to create.
function runBounded(cmd, args, ms) {
  const started = Date.now();
  const r = spawnSync(cmd, args, {
    cwd: ROOT, timeout: ms, encoding: "utf8", killSignal: "SIGKILL",
    detached: true, maxBuffer: 32 * 1024 * 1024,
  });
  const elapsed = Date.now() - started;
  const timedOut = !!(r.error && r.error.code === "ETIMEDOUT") || r.signal === "SIGKILL";
  if (timedOut && r.pid) { try { process.kill(-r.pid, "SIGKILL"); } catch (e) { /* already gone */ } }
  return { code: r.status, out: (r.stdout || "") + (r.stderr || ""), ms: elapsed, timedOut: timedOut };
}

// ---- applying and undoing one mutation ------------------------------------
function apply(m) {
  const file = path.join(ROOT, m.file);
  const before = fs.readFileSync(file, "utf8");
  const hits = before.split(m.find).length - 1;
  if (hits !== 1) return { ok: false, why: "the text to mutate appears " + hits + " times, expected once" };
  fs.writeFileSync(file, before.replace(m.find, m.replace));
  return { ok: true, restore: () => fs.writeFileSync(file, before) };
}

// The browser suites read a built fixture, so a mutation in app.js or index.html
// has to be built before it can be tested. A contract mutation does not, and
// paying 6 seconds for a build it does not need on every mutant is most of the
// runtime of a contract-only campaign.
// EVERY FILE build.js READS, and this list being short by four is how a mutation
// came back SURVIVED with nothing having been tested. essay-content.js is inlined
// into the page like app.js is; removing a field from an authored example there
// and not rebuilding meant the browser suite read the PREVIOUS fixture, passed,
// and reported the fault as one no regression notices. A missing entry here does
// not fail, it lies, so it is written from build.js's own reads:
//
//   index.html content.js essay-content.js business-content.js student-imports.js
//   app.js, plus the contract modules the bundle carries and build.js itself.
// ...and every file a FIXTURE BUILDER reads, which is not the same list. This was
// short by proxy/worker.js: tests/mkshim.js pulls the shipped worker into
// tests/worker.mjs so the suites exercise the real code, and a worker mutation
// with no re-shim tested the previous copy. Three mutations came back SURVIVED
// from a suite that never saw them.
const NEEDS_BUILD = /^(app\.js|index\.html|content\.js|essay-content\.js|business-content\.js|student-imports\.js|importer\.html|importer\.js|tools\/contract\/.*\.js|build\.js|proxy\/worker\.js)$/;
// The same fixtures tests/run.js builds, for the same reason it builds them: a
// suite must never run against a fixture that predates the change under test.
const FIXTURES = [
  ["node", ["build.js"]],
  ["node", ["tests/mkshim.js"]],
  ["node", ["tests/mkblockshim.js"]],
  ["node", ["tests/mkwashim.js"]],
  ["node", ["tests/mklearnshim.js"]],
  ["node", ["tests/mkevidenceshim.js"]],
  ["python3", ["tests/mkwalk.py"]],
];
function rebuild(ms) {
  let total = 0;
  for (const [cmd, args] of FIXTURES) {
    const r = runBounded(cmd, args, ms);
    total += r.ms;
    if (r.code !== 0 || r.timedOut) return { ok: false, out: r.out, ms: total };
  }
  return { ok: true, out: "", ms: total };
}

// ---- the owning regression ------------------------------------------------
// A mutation names the suite that is supposed to catch it, and only that runs.
// The full gate is 474 seconds and is confirmation of the whole repository, not
// an inner loop: running it per mutant would be a nine hour campaign for
// information a single suite already has.
function commandFor(owner) {
  if (owner === "bots") return ["node", ["tests/bots/run.js"]];
  if (/^t\d+$/.test(owner)) return ["node", ["tests/" + owner + ".mjs"]];
  return ["node", ["tests/" + owner + ".js"]];
}

const secs = ms => (ms / 1000).toFixed(1) + "s";

module.exports = { trackedDirty, dirtyRefusal, MUTATIONS };

if (IS_RUN) main();

async function main() {
  const done = priorResults();
  let list = MUTATIONS;
  const only = val("--only");
  if (only) { const want = only.split(","); list = list.filter(m => want.indexOf(m.id) >= 0); }
  // Mutations marked manualOnly are the runner's own proofs rather than faults in
  // the product, so a normal run does not include them and --only names them.
  if (!only) list = list.filter(m => !m.manualOnly);
  const sample = val("--sample");
  if (sample) list = list.slice(0, Number(sample));
  const todo = list.filter(m => !done[m.id]);
  const timeout = Number(val("--timeout") || DEFAULT_TIMEOUT_MS);

  console.log("MUTATION RUN — " + list.length + " selected, " +
    (list.length - todo.length) + " already recorded, " + todo.length + " to run");
  console.log("  per-mutant timeout " + secs(timeout) + " | results " + path.relative(ROOT, OUT));
  // Both refusals come BEFORE the "nothing to do" return. A resumed run that turns
  // out to have no work is refused on a dirty tree too, because the answer to "is
  // it safe to run mutations here" must not depend on what happens to be recorded.
  if (fs.existsSync(LOCK)) {
    console.error("REFUSING TO START: " + path.relative(ROOT, LOCK) + " exists.\n" +
      fs.readFileSync(LOCK, "utf8") +
      "\nA previous run may still be going, or one died with a fault in the tree.\n" +
      "Check `git status` before deleting it.");
    process.exit(2);
  }
  // Every tracked file, not only the ones this run means to touch. See
  // trackedDirty above for why, and for the afternoon that made it a rule.
  const refusal = dirtyRefusal(trackedDirty());
  if (refusal) { console.error(refusal); process.exit(2); }

  if (!todo.length) { console.log("\nnothing to do."); summarise(list, done); return; }

  const base = census();
  console.log("  processes at start: node " + base.node + ", browser " + base.browser + "\n");

  const times = [];
  for (let i = 0; i < todo.length; i++) {
    const m = todo[i];
    const n = i + 1;
    const eta = times.length
      ? "  eta " + secs(times.reduce((a, b) => a + b, 0) / times.length * (todo.length - i))
      : "";
    process.stdout.write(String(n) + "/" + todo.length + " — " + m.id + " — " + m.owner + " …" + eta + "\r");

    const t0 = Date.now();
    lock(m);
    const a = apply(m);
    if (!a.ok) {
      const r = { id: m.id, owner: m.owner, verdict: "STALE", ms: Date.now() - t0, why: a.why, at: new Date().toISOString() };
      record(r); times.push(r.ms);
      console.log(String(n) + "/" + todo.length + " — " + m.id + " — " + secs(r.ms) + " — STALE (" + a.why + ")");
      continue;
    }

    let verdict, detail = "", ms;
    try {
      let ok = true, buildMs = 0;
      if (NEEDS_BUILD.test(m.file)) {
        const b = rebuild(timeout);
        buildMs = b.ms;
        if (!b.ok) { ok = false; verdict = "BUILD_FAILED"; detail = b.out.slice(-300); }
      }
      if (ok) {
        const [cmd, args] = commandFor(m.owner);
        const run = runBounded(cmd, args, timeout);
        ms = buildMs + run.ms;
        // A mutation is KILLED when its owning regression fails. A non-zero exit
        // from a suite that reports "n passed, m failed" is that failure; a
        // timeout is its own verdict and is never counted as a kill, because a
        // suite that hung did not notice anything.
        if (run.timedOut) { verdict = "TIMEOUT"; detail = "no result in " + secs(timeout); }
        else if (run.code !== 0) {
          verdict = "KILLED";
          const f = run.out.match(/^\s*FAIL: (.+)$/m);
          detail = f ? f[1].slice(0, 90) : "exit " + run.code;
        } else { verdict = "SURVIVED"; detail = (run.out.match(/(\d+) passed, 0 failed/) || [])[0] || "passed"; }
      }
    } finally {
      a.restore();
      // A mutation in a source file also lives in what the build wrote from it, and
      // the built files are tracked. Restoring the source and leaving the artefacts
      // mutated is the state that put the wrong bytes in b9c2d59: the lock says a
      // fault is in the tree, and after this line it no longer is.
      if (NEEDS_BUILD.test(m.file)) rebuild(timeout);
      unlock();
    }
    // THE TREE WENT BACK. Checked rather than assumed: restore() writes back what
    // it read, which is correct until a suite writes into a tracked file, a build
    // half finishes, or a timeout kills something mid-write. Anything left over is
    // a deliberate fault loose in a clean tree, so the run stops on the spot and
    // says which file rather than carrying it into the next mutant.
    const drift = trackedDirty();
    if (drift === null || drift.length) {
      console.log("\n\nSTOPPING: the tree did not go back after " + m.id + ".");
      console.log(drift === null ? "  the checkout is no longer readable"
        : "  still changed:\n    " + drift.join("\n    "));
      console.log("  Compare against HEAD before doing anything else; the fault may still be in these files.");
      process.exit(2);
    }
    ms = ms || (Date.now() - t0);

    // Chromium's teardown is asynchronous: browser.close() returns and the OS
    // reaps its children a moment later, so a census taken the instant a suite
    // exits sees four browsers that are already dying. The first version of this
    // called that a leak and stopped the run on the first browser mutant. So the
    // count has to SETTLE: a leak is an increase that is still there after the
    // processes that were going to go have gone.
    const after = settle(base);
    const leaked = after.browser > base.browser || after.node > base.node + 1;
    const r = { id: m.id, owner: m.owner, file: m.file, verdict: verdict, ms: ms,
                detail: detail, why: m.why, at: new Date().toISOString(),
                processes: after, leaked: leaked };
    record(r); times.push(ms);
    console.log(String(n) + "/" + todo.length + " — " + m.id + " — " + secs(ms) + " — " + verdict +
      (detail ? "  " + JSON.stringify(detail.slice(0, 70)) : ""));

    if (leaked) {
      console.log("\nSTOPPING: processes are accumulating between mutants." +
        "\n  at start: node " + base.node + ", browser " + base.browser +
        "\n  now:      node " + after.node + ", browser " + after.browser +
        "\n  Results so far are in " + path.relative(ROOT, OUT) + " and a rerun resumes from them.");
      process.exit(2);
    }
  }

  // The tree is left as it was found, whatever happened above.
  const built = rebuild(timeout);
  if (!built.ok) console.log("\nWARNING: the final rebuild failed; run node build.js by hand");
  summarise(list, Object.assign({}, priorResults(), THIS_RUN));
}

function summarise(list, byId) {
  const rows = list.map(m => byId[m.id]).filter(Boolean);
  const by = v => rows.filter(r => r.verdict === v);
  const total = rows.reduce((a, r) => a + (r.ms || 0), 0);
  console.log("\n" + "-".repeat(60));
  console.log("MUTATION RESULTS — " + rows.length + " of " + list.length + " recorded");
  ["KILLED", "SURVIVED", "TIMEOUT", "BUILD_FAILED", "STALE"].forEach(v => {
    const n = by(v).length; if (n) console.log("  " + v.padEnd(14) + n);
  });
  console.log("  elapsed       " + secs(total) + " for " + rows.length +
    " mutants, " + (rows.length ? secs(total / rows.length) : "-") + " each");
  const slow = rows.slice().sort((a, b) => b.ms - a.ms).slice(0, 5);
  if (slow.length) {
    console.log("\n  slowest:");
    slow.forEach(r => console.log("    " + secs(r.ms).padStart(8) + "  " + r.id + " (" + r.owner + ")"));
  }
  // STALE IS NOT A PASS. Its `find` no longer matches, which means the fault was
  // never applied and the owning suite was never asked about it - the catalogue
  // quietly stopped testing something, which the header of mutations.js calls the
  // same failure as a suite that quietly stopped running. It was being counted
  // separately and left out of the verdict, so a run with three stale entries
  // printed "every mutation was killed by its owning regression".
  const survived = by("SURVIVED").concat(by("TIMEOUT")).concat(by("STALE")).concat(by("BUILD_FAILED"));
  if (survived.length) {
    console.log("\n  NOT KILLED — each of these is a fault nothing was asked about:");
    survived.forEach(r => console.log("    " + r.verdict + "  " + r.id + " — " + r.why +
      "\n           owner " + r.owner + ", which reported " + JSON.stringify(r.detail)));
  }
  console.log("\n" + (survived.length ? "MUTATION RUN FAIL — " + survived.length + " not killed"
    : "MUTATION RUN PASS — every mutation was killed by its owning regression"));
  process.exit(survived.length ? 1 : 0);
}
