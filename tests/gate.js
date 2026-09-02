// Three gates over the one harness, so a change can be checked at the cost the
// change deserves rather than always paying for the full run.
//
//   node tests/gate.js fast          shell smoke and the entry contracts
//   node tests/gate.js checkpoint    the above plus setup, coverage, bots
//   node tests/gate.js full          every suite
//
// Each gate ends with a single line that names the tier, the suites it actually
// ran, the assertions those suites reported and the elapsed time. That line is
// the only evidence the gate produces: if it is absent, the gate did not run,
// and nothing here should be described as having passed.
const { spawn, execFileSync } = require("child_process");
const path = require("path");
const HERE = __dirname;

// Named, not derived. A gate whose membership is computed from a directory
// listing quietly changes meaning every time a suite is added.
const TIERS = {
  // Does the shell still exist, does every question still enter it, does the
  // custom-question path still resolve a rubric, and does any of it now need
  // the network. Four questions worth asking before every commit.
  fast: { budget: 30, suites: ["t1", "ui39", "ui40", "ui41", "ui42", "ui44", "ui45"] },
  // Adds the interaction surfaces that the shell rewrite touched, the setup
  // and marking paths, and the simulated students. This is the gate to pass
  // before pushing. The budget is 180s rather than 120s because the seven bot
  // journeys are 124s of it on their own and they run one after another through
  // a single page; the cross-journey assertions compare the students to each
  // other, so there is no honest subset of them to run.
  checkpoint: {
    budget: 180,
    suites: ["t1", "t2", "ui13", "ui30", "ui35", "ui37", "ui38", "ui39", "ui40", "ui41", "ui42", "ui44", "ui45", "bots"],
  },
  // Everything run.js knows about. An empty list means "pass no filter".
  full: { budget: 360, suites: [] },
};

const tier = (process.argv[2] || "").toLowerCase();
if (!TIERS[tier]) {
  console.error("usage: node tests/gate.js fast|checkpoint|full");
  process.exit(2);
}
const want = TIERS[tier].suites;
const label = tier.toUpperCase() + " GATE";

const sha = (() => {
  try { return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: HERE, encoding: "utf8" }).trim(); }
  catch (e) { return "unknown"; }
})();
const dirty = (() => {
  try { return execFileSync("git", ["status", "--porcelain"], { cwd: HERE, encoding: "utf8" }).trim().length > 0; }
  catch (e) { return false; }
})();

console.log(label + " on " + sha + (dirty ? " (working tree dirty)" : "") +
  (want.length ? " — " + want.length + " suites requested" : " — every suite"));

const t0 = Date.now();
const child = spawn("node", [path.join(HERE, "run.js")].concat(want), { cwd: HERE, env: Object.assign({}, process.env, { ES_TIMING: "0" }) });

let buf = "";
const seen = new Map();   // suite -> { pass, fail }
const onData = d => {
  process.stdout.write(d);
  buf += d.toString();
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    // run.js prints "<label padded to 9> <the suite's own last line>", and every
    // suite's last line is "<n> passed, <n> failed".
    const m = line.match(/^(\S+)\s+.*?(\d+)\s+passed,\s*(\d+)\s+failed/);
    if (m) seen.set(m[1], { pass: Number(m[2]), fail: Number(m[3]) });
  }
};
child.stdout.on("data", onData);
child.stderr.on("data", d => process.stderr.write(d));

child.on("close", code => {
  const secs = (Date.now() - t0) / 1000;
  const ran = Array.from(seen.keys());
  const assertions = ran.reduce((a, k) => a + seen.get(k).pass + seen.get(k).fail, 0);
  const failed = ran.filter(k => seen.get(k).fail > 0);

  // A requested suite that reported nothing did not pass, it was silent. Fail
  // closed on it, or the gate line starts certifying runs that never happened.
  const missing = want.filter(w => !seen.has(w));

  console.log("\n" + label + " detail");
  console.log("  commit          " + sha + (dirty ? " (working tree dirty)" : ""));
  console.log("  suites run      " + ran.length + (want.length ? " of " + want.length + " requested" : "") +
    (ran.length ? ": " + ran.join(" ") : ""));
  console.log("  assertions      " + assertions);
  console.log("  failures        " + (failed.length
    ? failed.map(k => k + " (" + seen.get(k).fail + ")").join(", ")
    : "none"));
  if (missing.length) console.log("  did not report  " + missing.join(" "));
  console.log("  elapsed         " + secs.toFixed(1) + "s (target under " + TIERS[tier].budget + "s)");

  const green = code === 0 && failed.length === 0 && missing.length === 0 && ran.length > 0;
  console.log("\n" + label + (green ? " PASS" : " FAIL") + " — " + ran.length + " suites — " +
    assertions + " assertions — " + secs.toFixed(1) + "s");
  process.exit(green ? 0 : 1);
});
