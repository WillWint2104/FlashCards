// Three simulated students, one judgement question and one causal question.
//
// The point is not the click count. It is whether the three produce genuinely
// different journeys, and whether the app carried each of them somewhere useful
// without blocking any of them. If the three journeys look the same, the bots
// are not modelling different students and nothing they report can be trusted.
const { chromium, T, OUT } = require("../env");
const { question, subjectOf } = require("./lib");
const { runJourney } = require("./journey");
const { ZERO, STRONG, WRONG } = require("./profiles");
const fs = require("fs");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FAIL: " + m); } };

const RUNS = [
  { prof: ZERO,   qid: "hr-01",  qre: /Evaluate the effectiveness/, bodies: 2 },
  { prof: STRONG, qid: "hr-01",  qre: /Evaluate the effectiveness/, bodies: 2 },
  { prof: WRONG,  qid: "hr-01",  qre: /Evaluate the effectiveness/, bodies: 3 },
  { prof: WRONG,  qid: "mkt-01", qre: /target markets affect/,      bodies: 3 },
  { prof: ZERO,   qid: "mkt-01", qre: /target markets affect/,      bodies: 3 },
  { prof: STRONG, qid: "mkt-01", qre: /target markets affect/,      bodies: 2 },
];

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1050 } });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0, 200)));
  let calls = 0; await p.route(/workers\.dev/, r => { calls++; r.abort(); });

  const out = [];
  const by = {};
  for (const r of RUNS) {
    const q = question(r.qid);
    const res = await runJourney(p, { T, subject: "business_studies", qre: r.qre, q, subjectContent: subjectOf(r.qid), prof: r.prof, bodies: r.bodies });
    out.push(res.trace.report());
    console.log(res.trace.report() + "\n");
    by[r.prof.name + "|" + r.qid] = res;
  }

  console.log("=== does the harness tell these students apart? ===");
  const hrZero = by["zero knowledge|hr-01"], hrStrong = by["strong independent|hr-01"], hrWrong = by["plausible wrong turn|hr-01"];
  const mkZero = by["zero knowledge|mkt-01"], mkStrong = by["strong independent|mkt-01"], mkWrong = by["plausible wrong turn|mkt-01"];

  // 1. nobody is ever refused. This is the claim "never blocked" actually makes:
  //    every student finished every paragraph they started and wrote real prose.
  RUNS.forEach(r => {
    const t = by[r.prof.name + "|" + r.qid].trace;
    ok(t.m.paragraphs === r.bodies, r.prof.name + " on " + r.qid + " finished every paragraph it started: " + t.m.paragraphs + "/" + r.bodies);
    ok(t.m.sentences >= r.bodies, r.prof.name + " on " + r.qid + " wrote prose in all of them: " + t.m.sentences + " sentences");
  });

  // 2. the zero-knowledge student had to be carried, and was
  ok(hrZero.trace.m.termsAcquired > 0, "zero knowledge acquired concepts from the app before writing: " + hrZero.trace.m.termsAcquired);
  ok(hrZero.trace.m.surfacesBeforeFirstSentence > 0, "having read something first: " + hrZero.trace.m.surfacesBeforeFirstSentence + " surface(s)");
  ok(hrZero.trace.m.msToFirstSentence < 10000, "and reached prose quickly all the same: " + (hrZero.trace.m.msToFirstSentence / 1000).toFixed(1) + "s");
  ok(hrZero.trace.m.ownArguments === 0, "it leaned on the supplied arguments throughout, as a student who knows nothing would");

  // 3. the strong student was left alone.
  //
  //    Asserting that it opened no drawer would test the profile, not the app:
  //    the profile is what decides not to open one. These assert things only the
  //    APP decides, so each of them can fail on a change to the app.
  ok(hrStrong.trace.m.stepsAppRequired <= 2 * hrStrong.trace.m.paragraphs,
    "the app interposed at most two cards per paragraph before writing: " + hrStrong.trace.m.stepsAppRequired + " for " + hrStrong.trace.m.paragraphs);
  ok(hrStrong.trace.m.altered === 0, "not one of its sentences was altered: " + hrStrong.trace.m.altered);
  ok(hrStrong.trace.m.verbatim === hrStrong.trace.m.sentences,
    "every sentence stands exactly as written: " + hrStrong.trace.m.verbatim + "/" + hrStrong.trace.m.sentences);
  ok(hrStrong.trace.m.answerMoved === false,
    "and because it argued in its own words, the app did not put words in its mouth: working answer stayed broad");
  ok(hrZero.trace.m.answerMoved === true,
    "while the student who took the supplied arguments got a working answer that moved");
  ok(hrStrong.trace.m.msToFirstSentence < hrZero.trace.m.msToFirstSentence,
    "it reached prose sooner than the zero knowledge student: " + (hrStrong.trace.m.msToFirstSentence / 1000).toFixed(1) + "s vs " + (hrZero.trace.m.msToFirstSentence / 1000).toFixed(1) + "s");

  // 4. the wrong turn was met, not corrected and not blocked
  ok(hrWrong.trace.m.prompts > 0, "the wrong turn was noticed: " + hrWrong.trace.m.prompts + " prompt(s)");
  const kept = hrWrong.trace.events.some(e => e.kind === "respond" && /kept/.test(e.detail));
  ok(kept, "keeping the judgement was possible");
  const changed = hrWrong.trace.events.some(e => e.kind === "judgement" && /changed it to/.test(e.detail));
  ok(changed, "and changing it later was their decision, not the app's");
  const overruled = hrWrong.trace.events.some(e => e.kind === "prompt" && /(is wrong|should be|downgrad)/i.test(e.detail));
  ok(!overruled, "the app never told them their judgement was wrong");

  // 5. what only lives on the planning surface is only ever seen there. This is
  //    a fact about the app, and it is why the wrong-turn student had to look.
  ok(hrStrong.trace.m.prompts === 0,
    "a student who wrote straight through met none of the planning surface's prompts");
  ok(hrWrong.trace.m.mapVisits > 0 && hrWrong.trace.m.prompts > 0,
    "and the one that was asked had to go and look: " + hrWrong.trace.m.mapVisits + " visit(s)");

  // 6. the three are genuinely different journeys, on both question kinds.
  //    Every term of the signature is something the APP produced in response to
  //    the student, not a flag the profile set.
  const sig = t => [t.m.termsAcquired > 0, t.m.answerMoved, t.m.prompts > 0, t.m.coverageGaps === 0].join("/");
  const a = sig(hrZero.trace), s = sig(hrStrong.trace), w = sig(hrWrong.trace);
  console.log("  hr-01 signatures   zero " + a + "   strong " + s + "   wrong " + w);
  ok(a !== s && s !== w && a !== w, "the three journeys are distinguishable on the judgement question");
  const a2 = sig(mkZero.trace), s2 = sig(mkStrong.trace), w2 = sig(mkWrong.trace);
  console.log("  mkt-01 signatures  zero " + a2 + "   strong " + s2 + "   wrong " + w2);
  ok(a2 !== s2, "and the two extremes are distinguishable on the causal question too");
  // Reported, not asserted away. The only thing in the app that notices a
  // student arguing against themselves is the judgement-versus-arguments check,
  // and a causal question has no judgement for it to read. So on mkt-01 a
  // deliberate wrong turn produces exactly the journey ignorance produces. That
  // is a gap in the app, not a fault in the bots, and forcing this assertion to
  // pass would hide the one thing this run found.
  if (a2 === w2) {
    console.log("  NOTE: on the causal question the wrong turn is indistinguishable from");
    console.log("        the zero-knowledge student. Nothing in a causal question notices a");
    console.log("        student choosing arguments that undercut their own answer.");
  }

  // 7. the harness can tell a well-authored part of the app from a thin one.
  //    mkt-01 body 3 is processes, the only area with a full help ladder.
  console.log("  paragraphs offering a help ladder: mkt-01 " + mkZero.trace.m.ladderHere + "/" +
    (mkZero.trace.m.ladderHere + mkZero.trace.m.noLadderHere) + ", hr-01 " + hrZero.trace.m.ladderHere + "/" +
    (hrZero.trace.m.ladderHere + hrZero.trace.m.noLadderHere));
  ok(mkZero.trace.m.ladderHere > 0, "a ladder was offered where one is authored (mkt-01 processes)");
  ok(mkZero.trace.m.noLadderHere > 0, "and not offered in the same question where none is authored");
  ok(hrZero.trace.m.ladderHere === 0, "the judgement question offers none at all, which the harness reports rather than hides");

  // 8. what the run measured about the content, reported and not asserted away
  console.log("\n=== what the students could not learn ===");
  RUNS.forEach(r => {
    const res = by[r.prof.name + "|" + r.qid];
    if (r.prof !== ZERO) return;
    console.log("  " + r.qid + ": " + res.teach.yes.length + " of " + res.vocab.length +
      " concepts are explained somewhere; never explained: " + res.teach.no.join(", "));
    console.log("  " + r.qid + ": wrote without a concept it needed " + res.trace.m.blocked + " time(s)");
  });

  ok(calls === 0, "no model calls in any journey: " + calls);
  console.log("pageerrors:", errs.join(" | ") || "none");
  ok(errs.length === 0, "no page errors");

  fs.writeFileSync(OUT + "bot-journeys.txt", out.join("\n\n") + "\n");
  console.log("\nwrote " + OUT + "bot-journeys.txt");
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
