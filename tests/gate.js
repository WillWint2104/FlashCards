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
  // t23 is the inventory check: it reads tests/ and the two registries and fails
  // when a maintained test is outside both. It costs nothing and belongs in the
  // tier that runs most often, because the thing it catches is a test drifting
  // out of the harness, which is invisible by definition.
  fast: { budget: 40, suites: ["t1", "t17", "t18", "t19", "t20", "t21", "t22", "t23", "t24", "t25", "t26", "t27", "t28", "ui39", "ui41", "ui42", "ui44", "ui45", "ui46", "ui47", "ui48", "ui49"] },
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
  // ui52 arrived here on the argument that a header link whose destination does
  // not exist is an architectural fault rather than a journey. That was half
  // true and it put the suite in the wrong tier. Whether the destination EXISTS
  // is a seam and could be asserted in a second; what ui52 actually does is
  // drive a student from setup through the list, into the writing, out to My
  // essays, back in through Resume, and through a delete confirmation twice - a
  // walk across five screens, and 15.8s of a 60s tier, a quarter of it for one
  // suite. Every other walk in the harness is in journeys, and this one was the
  // exception because of how it was argued for rather than what it does. It has
  // gone where the rule always put it.
  //
  // That leaves this tier at 45.8s. It had been over its minute since before the
  // UI consistency pass - 66.2s on main, 61.6s with ui52 still in it - and the
  // overrun was never ui52 alone, but ui52 was the one suite here that did not
  // belong.
  // ui58 is here, not in journeys, and the difference is real rather than
  // convenient. It does not walk a student anywhere: it puts one surface at four
  // widths and asks whether the bar still fits and still reaches everything.
  // That is a layout invariant measured in place, which is what this tier is
  // for, and it is 21s because resizing is cheap next to walking.
  //
  // ui60 sits beside ui59 and for the same reason: it reads what the picker
  // offers after a registry change, in place, on one surface. It also guards a
  // product rule - a legacy subject is content the app depends on, not a subject
  // it offers - and a rule nobody can see on screen is exactly the kind that
  // decays quietly between passes.
  //
  // ui62 is in journeys beside ui61. It changes login twice, starts an attempt,
  // leaves it, comes back through My essays and reads the labels at two widths -
  // a walk through the whole lifecycle, which is the only place the rule it holds
  // can be broken.
  //
  // t26 and t27 are in FAST and only fast, and they are placed by kind rather than
  // by the clock. Both establish one invariant at one seam with no browser at all -
  // t26 the mutation runner's guards against a throwaway checkout it makes and
  // deletes, t27 the coach contract against the shipped normaliser - and between
  // them they cost about a second. fast is the tier of cheap seam checks; putting
  // them in checkpoint as well bought nothing and took the tier over its budget
  // for the sake of running the same second twice.
  //
  // They are in checkpoint as well because t23 holds the rule that checkpoint runs
  // everything fast runs, which is what makes checkpoint a superset rather than a
  // second opinion. The two of them together cost the tier about a second, and
  // ui59 gave back four by no longer sleeping through its own re-renders.
  //
  // ui65 and ui66 are full-only, and for the plainest reason: between them they
  // stub the coach ten times and walk a student through an introduction, a
  // conclusion and two body paragraphs. They are the paragraph review's own
  // regression, and the review is checked by driving it, not by sampling it.
  //
  // ui64 is full-only for the same reason as ui63 and one more: it publishes a
  // package, walks a student from the picker into the workspace, out again and
  // back through My essays, and then asks the shape resolver four questions per
  // subject. It is a journey and a sweep in one file, and the journeys tier has
  // 8s of headroom.
  //
  // ui63 is in NEITHER, which is to say full and only full. It publishes four
  // packages through the real five-step importer and validates four more against
  // the shipped manifest: one authored package re-declared as each subject in
  // turn, plus the cross-wired negatives. That is an exhaustive cross-product of
  // declared subjects, which is the kind of sweep the exhaustive tier exists for
  // - the same reason ui40's walk of every question moved out of checkpoint.
  //
  // ui61 is in JOURNEYS, not here, and the difference is the importer. It
  // publishes a package through the real importer's five steps, walks the
  // paginated bank to the question that produced, starts an attempt from it and
  // reads what the draft recorded - a journey through four surfaces, and 30s of
  // it. The parts that are seams (which package owns which criteria, where the
  // gate sits) it checks in place; the part that is a walk is a walk.
  //
  // ui59 is here for the same reason and a sharper one. It reads the labels on
  // one surface after each change, which is a state invariant measured where the
  // state is, and the fault it guards - two subjects named at once - is the kind
  // that reaches a screenshot sent for approval rather than the kind a walk trips
  // over. It belongs in the tier that runs on the way past.
  checkpoint: {
    budget: 60,
    suites: ["t1", "t2", "t17", "t18", "t19", "t20", "t21", "t22", "t23", "t24", "t25", "t26", "t27", "t28", "ui35", "ui38", "ui39", "ui41", "ui42", "ui44", "ui45", "ui46", "ui47", "ui48", "ui49", "ui58", "ui59"],
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
  //
  // ui55 is here rather than in checkpoint, by the same criterion as the rest of
  // this tier: it walks every stage of the picker and presses every control on
  // each, which is page-walking. It went into checkpoint first and took that
  // tier to 132.8s against its minute, which is the mistake this file keeps
  // making and the one the budget is not allowed to absorb.
  //
  // ui56 came here for the same reason and by the same criterion: it drives the
  // composer to a finished paragraph five times over, once per way the coach can
  // answer, which is a walk rather than a seam. In checkpoint it took that tier
  // to 99s.
  //
  // ui37 came here when checkpoint measured 62s twice against its minute. It was
  // the borderline one when the tier was last split: it guards a seam, the
  // capture and restore of a sentence in progress, but it guards it by leaving
  // the writing screen and coming back through half a dozen controls, which is a
  // walk. ui35 and ui46 stayed because each measures its invariant in place.
  //
  // ui55 LEFT for full, and the reason is a distinction this file had not drawn
  // before. Every other suite here walks ONE route and asks whether it works.
  // ui55 walks every stage and presses EVERY control on each: it is an
  // exhaustive sweep, not a journey. Two things follow from that, and neither is
  // about the clock. Its cost grows with the number of controls in the product
  // rather than with the number of routes worth guarding, so it gets slower
  // every time the picker gains a button and there is no version of this tier in
  // which that stops. And what it finds - a control that leads nowhere - is a
  // completeness failure rather than a broken route: nothing a student is doing
  // mid-session breaks because a control is inert. Exhaustive completeness
  // checks are what the lower-frequency tier is for.
  //
  // Said plainly, because it matters: the clock is what made me look. The tier
  // measured 183.3s once ui57 joined, and ui55 is 46.6s of it. The argument
  // above is the reason it moved, and it would have been the same argument at
  // 120s, but it was the number that prompted the question. What replaces its
  // cover here is narrower and deliberate: ui57 presses every way out of every
  // surface, which is the class of dead control that actually strands a student.
  //
  // ui57 is here because it is a journey in the strict sense: it leaves the
  // writing workspace mid-paragraph, goes to another surface, comes back, and
  // asks whether the attempt survived the trip. That question cannot be asked at
  // a seam - it is the trip.
  journeys: { budget: 180, suites: ["ui13", "ui30", "ui37", "ui40", "ui50", "ui51", "ui52", "ui53", "ui56", "ui57", "ui61", "ui62"] },
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
  // 660, set from measurement rather than from a round number, and recorded so
  // the next person can see whether it was earned:
  //
  //   595.3s  before the UI consistency pass
  //   615.9s  after it, the difference being ui57, the navigation regression
  //           that proves leaving and resuming preserves a student's attempt
  //   574.9s  the same tree plus ui58, the responsive-navigation regression,
  //           measured 41s FASTER than the run before it
  //   660     the highest of those plus headroom
  //
  // That third number is the one that matters when reading the first two. This
  // tier varies by around 40s between runs on the same tree - it is 80 suites
  // each launching a browser on a shared machine - so a single measurement is
  // not a cost and 615.9 was not purely growth. 660 is set above the worst
  // observed run, not above the average, because a budget that the tier crosses
  // on a bad afternoon teaches everyone to ignore it.
  //
  // This is the exhaustive tier growing in scope, not a budget moved to hide a
  // regression: fast, checkpoint and journeys are unchanged at 40, 60 and 180,
  // and each of them is inside its number. The distinction matters and is the
  // reason this comment exists rather than a bare integer.
  //
  // 720, because 660 had stopped being a budget. The tier grew to 90 suites and
  // 3640 assertions with the paragraph review's regressions, and the two runs
  // that followed measured
  //
  //   659.8s  the four corrections, with their three new ui65 sections
  //   659.9s  the same tree after sharing an attempt between two of them
  //
  // against a ceiling of 660. That is 0.1s of headroom on a tier this comment
  // already records as varying by around 40s between runs on the same tree, so
  // the next ordinary run fails the gate for no reason anyone could act on, and
  // a gate that fails at random is a gate people learn to re-run rather than
  // read. The elapsed figure is a real Date.now() delta and is not truncated at
  // the ceiling, so those two numbers are the tier genuinely at 99.98% of it.
  //
  // The extra runtime is accounted for. It is the coverage added in this slice -
  // the withheld scaffold, the Save and Re-check state machine, and the argument
  // change that dates a check - not an unexplained slowdown: the same tree was
  // 644.8s before those sections existed. Shaving it back was tried and returned
  // 0.7s, which is the honest measurement rather than the five seconds first
  // claimed for it.
  //
  // FAST, CHECKPOINT AND JOURNEYS DO NOT MOVE. They stay at 40, 60 and 180, they
  // are the tiers a person waits on, and they are the ones where a rising number
  // is a signal. full is the exhaustive browser-heavy safety net and its budget
  // is a watchdog ceiling, not a target to spend up to: a run that comes in at
  // 660 is still a run worth asking about.
  //
  // 800, profiled from the post-Gate-2 composition exactly as the note above
  // asked. Gate 2 added ui67, the four-profile paragraph-review acceptance, and
  // it is MEASURED at 98s: eight journeys, each entering the app, planning and
  // writing a paragraph before the review cycle even starts. The cycle itself is
  // the cheap part; the journeys around it are not.
  //
  //   736.8s  the first full run carrying ui67, green, 91 suites, 3834 assertions
  //   +~40s   the run-to-run variance this tier's own comment records
  //
  // so 800 sits above the worst observed run plus that variance, which is the
  // rule this file has used for every budget it holds. It is NOT a number chosen
  // to make a red gate go green: every suite in that 736.8s run passed, and the
  // overage is one commissioned suite's real cost, not a regression.
  //
  // The alternative was to take ui67 out of full, and that is the thing this
  // comment has refused twice: full is the tier that is allowed to be slow, and
  // moving core coverage out of it to get under a clock is how a harness stops
  // meaning anything. fast, checkpoint and journeys are untouched at 40, 60 and
  // 180 - journeys in particular measured 169.1s before and after ui67 existed,
  // because the review cycle is opt-in and ui53 does not ask for it.
  //
  // bots is 132.7s of this tier and ui54 is 79.4s. Both still want profiling from
  // this composition; neither was re-measured here.
  //
  // FROZEN. All four numbers below are now settled and none of them moves again
  // without the repository owner agreeing to it first. That includes this one:
  // 800 is a ceiling to stay under, not an allowance to spend, and the next
  // change that pushes the tier past it is a conversation rather than an edit.
  // Profile the two suites named above before adding significant new cost, and
  // take the time out of waiting and repeated browser launches rather than out
  // of coverage.
  full: { budget: 800, suites: [] },
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
  const budget = TIERS[tier].budget;
  const over = secs > budget;
  console.log("  elapsed         " + secs.toFixed(1) + "s (budget " + budget + "s)" +
    (over ? "  OVER BUDGET by " + (secs - budget).toFixed(1) + "s" : ""));

  // Two facts, and the report used to collapse them into one word. A run where
  // every suite is green and the tier took longer than its budget is not a pass
  // against the budget, and printing "PASS" over it is how a budget quietly
  // stops being one. The verdict now names which of the two held.
  const green = code === 0 && failed.length === 0 && missing.length === 0 && ran.length > 0;
  const verdict = !green ? " FAIL" : over ? " GREEN, OVER BUDGET" : " PASS";
  console.log("\n" + label + verdict + " — " + ran.length + " suites — " +
    assertions + " assertions — " + secs.toFixed(1) + "s" +
    (green && over ? " against a " + budget + "s budget" : ""));
  if (green && over) {
    console.log("  Every suite passed. The tier is over its budget, which is a result to act on,");
    console.log("  by re-tiering or by making a suite cheaper, not by moving the number.");
  }
  process.exit(green ? 0 : 1);
});
