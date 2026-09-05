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
const DEFAULT_TIMEOUT_MS = 180000;

const argv = process.argv.slice(2);
const flag = n => argv.indexOf(n) >= 0;
const val = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };

if (flag("--list")) {
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
function record(r) {
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
const NEEDS_BUILD = /^(app\.js|index\.html|tools\/contract\/.*\.js|build\.js)$/;
function rebuild(ms) {
  const b = runBounded("node", ["build.js"], ms);
  if (b.code !== 0 || b.timedOut) return { ok: false, out: b.out, ms: b.ms };
  const w = runBounded("python3", ["tests/mkwalk.py"], ms);
  return { ok: w.code === 0 && !w.timedOut, out: w.out, ms: b.ms + w.ms };
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

(async () => {
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
  summarise(list, priorResults());
})();

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
  const survived = by("SURVIVED").concat(by("TIMEOUT"));
  if (survived.length) {
    console.log("\n  NOT KILLED — each of these is a fault no regression noticed:");
    survived.forEach(r => console.log("    " + r.verdict + "  " + r.id + " — " + r.why +
      "\n           owner " + r.owner + ", which reported " + JSON.stringify(r.detail)));
  }
  console.log("\n" + (survived.length ? "MUTATION RUN FAIL — " + survived.length + " not killed"
    : "MUTATION RUN PASS — every mutation was killed by its owning regression"));
  process.exit(survived.length ? 1 : 0);
}
