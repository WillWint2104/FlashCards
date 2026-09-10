// GATE 2: FOUR SIMULATED STUDENTS THROUGH THE WHOLE PARAGRAPH REVIEW.
//
// The bots could always reach the writer. They had never pressed Check this
// paragraph: `grep -rn esask tests/bots/` returned nothing, and bots/run.js:240
// asserts `calls === 0`, so zero coach traffic was a PASS CONDITION. Eight
// journeys wrote eighteen paragraphs and walked past the review every time.
//
// This suite drives the cycle end to end for every profile on both questions:
//
//   write -> Check this paragraph -> feedback -> select the flagged part ->
//   revise the student's own sentence -> Save -> the old check goes stale ->
//   Re-check -> a fresh result -> continue
//
// WHAT THIS SUITE OWNS, and what it must not take from its neighbours:
//
//   ui67 (here)  the cross-component learner journey, and whether four different
//                students move through it differently
//   ui65         the revision / staleness / re-check STATE MACHINE: which control
//                is enabled when, what "edited" means, what a stale bar says
//   t27          slotFeedback validity against the shipped worker
//   ui66         More help and the complete example windows
//   ui56         the worker failure states
//
// So nothing below asserts control enablement or staleness mechanics. It asserts
// that the cycle completed, that the diagnosis was grounded in the student's own
// sentence, that the student's words are the ones that survived, and that the
// four trajectories are genuinely different from each other.
//
// THE STUB IS GROUNDED. It never invents a blockId: every diagnosis names a slot
// the app declared and a block the app sent for that slot, and if it cannot find
// one it reports the element missing rather than guessing. A stub that made ids
// up would let a broken app pass.
const { chromium, T } = require("./env");
const { runJourney } = require("./bots/journey");
const { ZERO, STRONG, WRONG, PARTIAL } = require("./bots/profiles");
const { question, subjectOf } = require("./bots/lib");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FAIL:", m); } };

// The full matrix. The old harness ran seven of these eight and omitted PARTIAL
// on hr-01 with no reason recorded; PARTIAL declares canJudge and a position, so
// it can take the judgement question exactly as STRONG does.
const MATRIX = [
  { prof: ZERO,    qid: "mkt-01", qre: /target markets affect/ },
  { prof: ZERO,    qid: "hr-01",  qre: /the effectiveness of human resource/ },
  { prof: PARTIAL, qid: "mkt-01", qre: /target markets affect/ },
  { prof: PARTIAL, qid: "hr-01",  qre: /the effectiveness of human resource/ },
  { prof: WRONG,   qid: "mkt-01", qre: /target markets affect/ },
  { prof: WRONG,   qid: "hr-01",  qre: /the effectiveness of human resource/ },
  { prof: STRONG,  qid: "mkt-01", qre: /target markets affect/ },
  { prof: STRONG,  qid: "hr-01",  qre: /the effectiveness of human resource/ },
];

// GROUNDED IN WHAT THE APP SENT. slots and blocks both come from the request; the
// diagnosed element is the one the app itself labelled `explain`, which is the
// only body slot both TEEEC and TDECC declare (TEEEC has `effect` where TDECC has
// `define`), so this stub does not assume a scaffold.
const DIAGNOSIS = "You name the strategy, but you do not explain why the characteristic in the question causes the business to choose it.";
let ungrounded = 0;
async function stubCoach(p, seen) {
  await p.unroute(/workers\.dev/).catch(() => {});
  await p.route(/workers\.dev/, async route => {
    let body = {};
    try { body = JSON.parse(route.request().postData() || "{}"); } catch (e) { /* not json */ }
    const slots = body.slots || [];
    const blocks = body.blocks || [];
    seen.push({ slots: slots.map(s => s.key), blocks: blocks.map(b => ({ id: b.id, slot: b.slot })) });
    // FAIL CLOSED: a request that carries no slots is not something to answer.
    if (!slots.length) { ungrounded++; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ note: "", nudges: [], slotFeedback: [] }) }); }
    const first = seen.filter(x => x.slots.join() === slots.map(s => s.key).join()).length === 1;
    const feedback = slots.map(s => {
      const own = blocks.find(b => b.slot === s.key);
      if (!own) return { slot: s.key, status: "missing", blockId: "", issue: "Nothing is doing this job yet." };
      if (!own.id) { ungrounded++; return { slot: s.key, status: "missing", blockId: "", issue: "Nothing is doing this job yet." }; }
      // On the FIRST look at a paragraph the explanation needs work. On the second
      // - after the student has revised - it is doing its job, so a fresh result
      // is visibly a different judgement rather than the same one served twice.
      const weak = first && s.key === "explain";
      return { slot: s.key, status: weak ? "needs_work" : "ok", blockId: own.id, issue: weak ? DIAGNOSIS : "" };
    });
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ note: "", nudges: [], slotFeedback: feedback }) });
  });
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
  const results = [];

  for (const row of MATRIX) {
    const label = row.prof.name + " x " + row.qid;
    console.log("\n--- " + label);
    const page = await ctx.newPage();
    const seen = [];
    await stubCoach(page, seen);
    let res = null, threw = null;
    try {
      res = await runJourney(page, {
        T, subject: "business_studies", qre: row.qre,
        q: question(row.qid), subjectContent: subjectOf(row.qid),
        prof: row.prof, bodies: 1, review: true,
      });
    } catch (e) { threw = e; }
    await page.close();
    // FAIL CLOSED: a journey that threw is a failure, never a skipped run.
    ok(!threw, label + ": the journey ran to completion" + (threw ? " - " + String(threw.message).slice(0, 120) : ""));
    if (!res) { results.push({ row, label, r: null }); continue; }
    const R = res.trace.m.review;
    results.push({ row, label, r: R, trace: res.trace, seen });

    // THE CYCLE, step by step. Each of these is a step the student must actually
    // have taken; a missing one is a failure, not a skip.
    ok(R.opened > 0, label + ": a check produced a review");
    ok(R.slots.length > 0, label + ": the review reported the paragraph's authored parts: " + R.slots.join(", "));
    ok(R.steps.indexOf("check") >= 0, label + ": pressed a check control");
    ok(R.steps.indexOf("feedback") >= 0, label + ": received feedback");
    ok(R.steps.indexOf("inspect") >= 0, label + ": opened the flagged part and read its diagnosis");
    ok(R.steps.indexOf("revise") >= 0, label + ": rewrote the sentence the coach named");
    ok(R.steps.indexOf("save") >= 0, label + ": saved the revision");
    ok(R.steps.indexOf("stale") >= 0, label + ": the previous check became visibly out of date");
    ok(R.steps.indexOf("recheck") >= 0, label + ": asked for a fresh check");
    ok(R.steps.indexOf("fresh") >= 0, label + ": the new result replaced the old one");
    ok(R.steps.indexOf("continue") >= 0, label + ": returned to writing afterwards");
    // THE CYCLE'S OWN DEMANDS, not the journey's. The writing phase legitimately
    // reports content limitations - unsourced evidence, a paragraph with no help
    // ladder - and those are findings about the content, not about whether the
    // review worked. They are collected and reported separately below.
    ok(R.demands.length === 0, label + ": nothing the cycle itself needed was missing" +
      (R.demands.length ? " - " + R.demands.join("; ") : ""));

    // GROUNDING: every diagnosis named a slot the app declared and a block the app
    // sent. This is what makes the run evidence about the product rather than
    // about the stub.
    const req = seen[0];
    ok(!!req && req.slots.length > 0, label + ": the app sent its authored slot list to the coach");
    ok(!!req && req.blocks.length > 0 && req.blocks.every(b => b.id), label + ": and sent a real id for every sentence");
    ok(R.diagnosed.every(d => R.slots.indexOf(d.slot) >= 0), label + ": every diagnosis named one of those slots");

    // THE STUDENT'S OWN WORDS. Nothing the app offered may be written back into
    // the essay: the saved text must be what the profile composed.
    const saved = R.revisedText[R.revisedText.length - 1] || "";
    ok(saved.length > 0, label + ": the student wrote a sentence of their own");
    ok(saved.indexOf("[") < 0 && saved.indexOf("]") < 0,
      label + ": and it carries none of the scaffold's blanks: " + JSON.stringify(saved.slice(0, 48)));
  }

  // THE REQUIRED STEPS, named. The cycle records nine for a student who gets it
  // right first time and ten for one that repairs; counting to a fixed number
  // would either fail the honest runs or pass a truncated one.
  const REQUIRED = ["check", "feedback", "inspect", "revise", "save", "stale", "recheck", "fresh", "continue"];
  const completed = r => !!r && REQUIRED.every(k => r.steps.indexOf(k) >= 0);
  console.log("\n--- the matrix");
  results.forEach(x => console.log("    " + (completed(x.r) ? "COMPLETE  " : "incomplete") +
    "  " + x.label.padEnd(34) + (x.r ? x.r.steps.join(" > ") : "no result")));
  ok(results.length === 8, "all eight combinations ran: " + results.length);
  ok(results.every(x => x.r), "every one produced a trace");
  ok(ungrounded === 0, "the stub never had to invent a reference: " + ungrounded);

  // THE FOUR STUDENTS MUST DIFFER. If they come out the same, the harness is not
  // telling them apart and nothing above means anything.
  console.log("\n--- do the four students actually differ?");
  const by = n => results.filter(x => x.row.prof.name === n && x.r);
  const helpOf = n => by(n).reduce((a, x) => a + x.r.helpOpened, 0);
  const revOf = n => by(n).reduce((a, x) => a + x.r.revised, 0);
  ["zero knowledge", "partial knowledge", "plausible wrong turn", "strong independent"].forEach(n => {
    const b = by(n);
    console.log("    " + n.padEnd(22) + "help " + helpOf(n) + "  revisions " + revOf(n) +
      "  steps " + b.map(x => x.r.steps.length).join("/"));
  });
  ok(helpOf("zero knowledge") > 0, "the zero-knowledge student needed the deeper guidance before it could act");
  ok(helpOf("strong independent") === 0, "the strong student fixed its sentence without opening anything optional");
  ok(revOf("plausible wrong turn") > revOf("strong independent"),
    "the wrong-turn student wrote more revisions than the strong one, because its first attempt did not hold");
  ok(by("plausible wrong turn").every(x => x.r.steps.indexOf("repair") >= 0),
    "and it recovered rather than being handed a correct answer");
  ok(helpOf("partial knowledge") === 0 && revOf("partial knowledge") > 0,
    "the partial student acted on the diagnosis using limited support");
  const distinct = new Set(["zero knowledge", "partial knowledge", "plausible wrong turn", "strong independent"]
    .map(n => helpOf(n) + ":" + revOf(n)));
  ok(distinct.size >= 3, "at least three distinct trajectories through the same cycle: " + distinct.size);

  // THE TWO QUESTIONS. mkt-01 is causal and hr-01 is judgement; the cycle must
  // work on both, and any difference between them is a finding worth printing.
  console.log("\n--- causal vs judgement");
  ["mkt-01", "hr-01"].forEach(q => {
    const rs = results.filter(x => x.row.qid === q && x.r);
    console.log("    " + q + ": " + rs.length + " runs, all steps: " +
      rs.every(x => completed(x.r)) + ", parts reported: " +
      (rs[0] ? rs[0].r.slots.join(",") : "-"));
  });
  ok(results.filter(x => x.row.qid === "mkt-01" && completed(x.r)).length === 4,
    "all four students completed the cycle on the causal question");
  ok(results.filter(x => x.row.qid === "hr-01" && completed(x.r)).length === 4,
    "and all four on the judgement question");
  ok(results.every(x => completed(x.r)), "all eight runs completed every required step");

  // CONTENT FINDINGS. Raised by the writing phase, not the review, and reported
  // rather than asserted away: they are facts about the subject content that Gate
  // 2 was meant to surface.
  console.log("\n--- content limitations the students ran into");
  const found = {};
  results.forEach(x => (x.trace ? x.trace.m.demands : []).forEach(d => {
    if ((x.r.demands || []).indexOf(d) >= 0) return;          // a cycle demand, already asserted
    (found[d] = found[d] || []).push(x.label);
  }));
  const keys = Object.keys(found);
  if (!keys.length) console.log("    none");
  keys.forEach(d => console.log("    " + d + "\n        in: " + found[d].join(", ")));

  console.log("");
  console.log(pass + " passed, " + fail + " failed");
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
