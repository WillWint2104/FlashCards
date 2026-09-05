// Three gates over the one harness, so a change can be checked at the cost the
// change deserves rather than always paying for the full run.
//
//   node tests/gate.js fast          shell smoke and the entry contracts
//   node tests/gate.js checkpoint    the above plus the interaction surfaces
//   node tests/gate.js journeys      the simulated students, on their own
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
  // The fast tier is the sharpest signal per second, not a small copy of the full
  // run. Four contract suites joined it as their milestones landed and it drifted to
  // 37s, so ui40 goes back to checkpoint, where it already runs: it walks EVERY
  // question through the shell, which is an exhaustive sweep rather than a fast
  // signal, and it was the single most expensive suite here at 7.2s.
  // ui51 is not here either: it renders the picker in four browser pages, which
  // is a surface check rather than a sharp signal, and the tier was at 40.2s of
  // its 40s. Its static half, t22, is here, and that is the half that catches a
  // field going missing on the way through the contract.
  // ui50 is NOT here. It publishes through the importer and then drives the
  // student app, so it is an integration test across two surfaces rather than a
  // sharp signal about one, and it took the tier to 42.1s. Same reasoning that
  // moved the simulated students out of checkpoint: this tier is worth having
  // because it is cheap enough to run out of habit.
  // 40s rather than 30s. The tier gained four contract suites and the importer
  // suite as those milestones landed, and at 30.6s it was quietly over a budget
  // that only prints. Six browser suites are 25s of it and each covers a surface
  // a change here can break. Raised deliberately, with the headroom stated, which
  // is the opposite of what happened to checkpoint: that one was left at 174/180
  // until variance would have started failing it.
  fast: { budget: 40, suites: ["t1", "t17", "t18", "t19", "t20", "t21", "t22", "ui39", "ui41", "ui42", "ui44", "ui45", "ui46", "ui47", "ui48", "ui49"] },
  // Adds the interaction surfaces that the shell rewrite touched, and the setup
  // and marking paths. This is the gate to pass before pushing, and its whole
  // value is that it is cheap enough to run out of habit.
  //
  // The simulated students used to be here and are not any more. They were 124s
  // of a 174s run against a 180s budget, which is not a budget: ordinary machine
  // variance would have started failing it, and a gate people stop running is
  // worse than one that covers less. They are integration tests of product
  // behaviour rather than of the architecture a change is touching, so they moved
  // to their own tier and to full. Checkpoint answers one question: did this
  // change break the thing I am working on.
  //
  // The tier reached 73.4s once the picker rewrite landed, which is not a budget
  // either. Three suites left rather than the budget moving, and they left on one
  // criterion: does this suite establish an invariant at one seam, or does it
  // drive a student across screens end to end? ui13 and ui30 walk the whole
  // writing flow - picker, plan, paragraph, learning, repair, retry - and ui51
  // renders the picker in four browser pages as a whole-surface sweep. Its static
  // half, t22, stays here, and that is the half that catches a field going
  // missing on the way through the contract. ui35, ui37 and ui46 stayed: each
  // measures one seam, and one of them being red is the signal this tier exists
  // to give.
  //
  // ui52 arrived here for the same reason. A header link whose destination does
  // not exist is an architectural fault, not a journey, and it is the fault this
  // flow already shipped once.
  checkpoint: {
    budget: 60,
    suites: ["t1", "t2", "t17", "t18", "t19", "t20", "t21", "t22", "ui35", "ui37", "ui38", "ui39", "ui41", "ui42", "ui44", "ui45", "ui46", "ui47", "ui48", "ui49", "ui52"],
  },
  // ui40 joined this tier when ui51 arrived. It walks EVERY question through the
  // shell, which is an exhaustive sweep and 6.2s of it, and the picker it swept
  // for is now covered precisely by ui51 at a third of the cost. An exhaustive
  // walk belongs where the exhaustive things are.
  // End to end. The seven simulated students, run one after another through a
  // single page, and the suite that publishes a package through the importer and
  // then finds it in the student app. Both cross a whole surface rather than
  // testing one, and both are expensive for that reason: ui50 alone was 8.4s of
  // a checkpoint run that has to stay under a minute to be worth having.
  //
  // The cross-journey assertions compare the students to each other, so there is
  // no honest subset of the bots: that part is all of them or none.
  // ui13, ui30 and ui51 joined when checkpoint went over its minute. All three
  // are end-to-end walks rather than seam checks, which is what this tier is for.
  //
  // ui53 publishes an externally authored package through the real importer and
  // carries ONE representative student through to a finished response, so it
  // crosses every surface the project has and does it once. That is the seam,
  // and it belongs here.
  //
  // The four-profile matrix on the same question is tests/ui54.js and is in full
  // only. Both halves were one suite and the tier went to 248.1s against a
  // budget of 180, which is not a budget; the first fix was raising the number
  // to 300, and a budget raised to fit whatever the tier grew into stops meaning
  // anything. The split is the real fix: the routine gate keeps cross-surface
  // imported-package coverage, and the study of how four different students fare
  // on one question is paid for where the expensive things live.
  //
  // The bundled bots went with it, for the same reason and not to make a number.
  // Splitting ui53 alone left the tier at 207.2s, because the bots are 125s of
  // it: seven simulated students walking questions that SHIPPED. That is the
  // same kind of work as ui54 and belongs in the same place, and leaving it here
  // meant this tier paid for two student matrices while calling itself the
  // routine gate. What stays is what the tier is for: the seams. Six suites that
  // each cross a boundary once, including one imported package walked end to end
  // by one student, in 71.7s against 180.
  journeys: { budget: 180, suites: ["ui13", "ui30", "ui40", "ui50", "ui51", "ui53"] },
  // Everything run.js knows about, the journeys included, plus the suites in no
  // tier: both student matrices are here and only here, ui54's four profiles on
  // the imported question and the bots' seven on the bundled bank.
  //
  // 600, from the measured run: 74 suites, 2944 assertions, 474.4s. The previous
  // 480 was an estimate written before the tier had ever been run to completion,
  // and 474 of 480 is 1.2% of headroom, which ordinary machine variance eats.
  // There is nothing to move out of the tier that runs everything, so the only
  // honest choice here is a number with room in it and the run that set it
  // written down beside it.
  full: { budget: 600, suites: [] },
};

const tier = (process.argv[2] || "").toLowerCase();
if (!TIERS[tier]) {
  console.error("usage: node tests/gate.js fast|checkpoint|journeys|full");
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
