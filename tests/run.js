// Run the whole harness. Rebuilds the shims and the walkthrough file first, so a
// fresh clone needs one command.
//
//   node build.js && node tests/run.js            everything
//   node tests/run.js ui16 ui17                   just these
const { execFileSync } = require("child_process");
const path = require("path"), fs = require("fs");
const HERE = __dirname, ROOT = path.resolve(HERE, "..");
const only = process.argv.slice(2);

// Where the time goes, measured rather than guessed at. A 46 minute run that
// cannot say which suite spent the time is a run nobody can make faster.
const timings = [];
const run = (cmd, args, label) => {
  process.stdout.write((label || args[0]).padEnd(9));
  const t0 = Date.now();
  try {
    const out = execFileSync(cmd, args, { cwd: HERE, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const last = out.trim().split("\n").filter(Boolean).pop() || "(no output)";
    console.log(last);
    // Read the count, do not pattern-match it: /0 failed/ is also true of
    // "10 failed", and a suite with 65 assertions can reach two digits.
    timings.push({ name: label || args[0], ms: Date.now() - t0 });
    const m = last.match(/(\d+)\s+failed/);
    if (m) return Number(m[1]) === 0;
    // A suite that exits 0 having printed nothing has not passed, it has said
    // nothing. The sentinel must not fall through to the no-failure-text branch.
    return last !== "(no output)" && !/fail/i.test(last);
  } catch (e) {
    timings.push({ name: label || args[0], ms: Date.now() - t0 });
    const out = String((e.stdout || "") + (e.stderr || "")).trim().split("\n").filter(Boolean);
    console.log(out.filter(l => /FAIL|failed|Error/.test(l)).slice(0, 3).join(" | ") || "FAILED");
    return false;
  }
};

if (!fs.existsSync(path.join(ROOT, "marginal-preview.html"))) {
  console.error("Run `node build.js` in the repo root first."); process.exit(1);
}
console.log("--- building fixtures");
// Run all six before deciding, so the output names every broken one. A stale
// fixture is the worst failure mode this harness has: the suites would pass
// against the PREVIOUS build and the run would print "all suites green".
const built = [
  run("node", ["mkshim.js"], "shim"),
  run("node", ["mkblockshim.js"], "blocks"),
  run("node", ["mkwashim.js"], "wa"),
  run("node", ["mklearnshim.js"], "learn"),
  run("node", ["mkevidenceshim.js"], "evid"),
  run("python3", ["mkwalk.py"], "walk"),
];
if (built.some(x => !x)) {
  console.error("\nfixture build failed; refusing to run the suites against stale fixtures");
  process.exit(1);
}

const WORKER = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "t10", "t11", "t12", "t13", "t14", "t15", "t16", "t17", "t18", "t19", "t20", "t21"];
const UI = ["ui", "ui2", "ui3", "ui5", "ui6", "ui7", "ui8", "ui9", "ui10", "ui12", "ui13", "ui14", "ui15", "ui16", "ui17", "ui18", "ui19", "ui20", "ui21", "ui22", "ui23", "ui24", "ui25", "ui26", "ui27", "ui28", "ui29", "ui30", "ui31", "ui32", "ui33", "ui34", "ui35", "ui36", "ui37", "ui38", "ui39", "ui40", "ui41", "ui42", "ui44", "ui45", "ui46", "ui47", "ui48", "ui49", "ui50"];
// The simulated students. Slower than a ui suite and reporting a trajectory
// rather than a pass count, so it runs last and only when asked for, or as part
// of a full run.
const BOTS = ["bots"];
const pick = list => only.length ? list.filter(x => only.includes(x)) : list;

let bad = 0;
const worker = pick(WORKER), ui = pick(UI);
if (worker.length) { console.log("\n--- worker, block and content suites"); worker.forEach(f => { if (!run("node", [f + ".mjs"], f)) bad++; }); }
if (ui.length) { console.log("\n--- ui suites"); ui.forEach(f => { if (!run("node", [f + ".js"], f)) bad++; }); }
const bots = pick(BOTS);
if (bots.length) { console.log("\n--- simulated students"); if (!run("node", ["bots/run.js"], "bots")) bad++; }
if (process.env.ES_TIMING !== "0" && timings.length) {
  const total = timings.reduce((a, b) => a + b.ms, 0);
  const slow = timings.slice().sort((a, b) => b.ms - a.ms);
  console.log("\n--- where the time went (" + (total / 60000).toFixed(1) + " min across " + timings.length + " suites)");
  slow.slice(0, 12).forEach(t => {
    console.log("  " + t.name.padEnd(9) + (t.ms / 1000).toFixed(1).padStart(7) + "s  " +
      (t.ms / total * 100).toFixed(1).padStart(5) + "%");
  });
  const rest = slow.slice(12).reduce((a, b) => a + b.ms, 0);
  if (rest) console.log("  " + "the rest".padEnd(9) + (rest / 1000).toFixed(1).padStart(7) + "s  " + (rest / total * 100).toFixed(1).padStart(5) + "%");
}
console.log(bad ? "\n" + bad + " suite(s) failed" : "\nall suites green");
process.exit(bad ? 1 : 0);
