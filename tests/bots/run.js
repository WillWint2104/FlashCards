// Three simulated students, one judgement question and one causal question.
//
// The point is not the click count. It is whether the three produce genuinely
// different journeys, and whether the app carried each of them somewhere useful
// without blocking any of them. If the three journeys look the same, the bots
// are not modelling different students and nothing they report can be trusted.
const { chromium, T, OUT } = require("../env");
const { question, subjectOf } = require("./lib");
const { runJourney } = require("./journey");
const { ZERO, STRONG, WRONG, PARTIAL } = require("./profiles");
const fs = require("fs");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FAIL: " + m); } };

const RUNS = [
  { prof: ZERO,   qid: "hr-01",  qre: /Evaluate the effectiveness/, bodies: 2 },
  { prof: STRONG, qid: "hr-01",  qre: /Evaluate the effectiveness/, bodies: 2 },
  { prof: WRONG,  qid: "hr-01",  qre: /Evaluate the effectiveness/, bodies: 3 },
  { prof: WRONG,  qid: "mkt-01", qre: /target markets affect/,      bodies: 3 },
  { prof: ZERO,    qid: "mkt-01", qre: /target markets affect/,      bodies: 3 },
  { prof: PARTIAL, qid: "mkt-01", qre: /target markets affect/,      bodies: 3 },
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
  const mkPartial = by["partial knowledge|mkt-01"];

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
  ok(hrStrong.trace.m.planPrompts === 0,
    "a student who wrote straight through met none of the planning surface's prompts: " + hrStrong.trace.m.planPrompts);
  ok(hrStrong.trace.m.writePrompts === 0,
    "and nothing questioned an argument that named both ends and reached a degree: " + hrStrong.trace.m.writePrompts);
  ok(hrWrong.trace.m.mapVisits > 0 && hrWrong.trace.m.planPrompts > 0,
    "and the judgement question had to be gone and looked for: " + hrWrong.trace.m.mapVisits + " visit(s)");
  ok(mkWrong.trace.m.writePrompts > 0,
    "the causal wrong turn was caught where the student was, with no planning visit needed: " + mkWrong.trace.m.writePrompts);

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

  // 8. the pathway lesson. The design fails if all three are put through the same
  //    surface, so this is the assertion that matters most about it.
  console.log("\n=== the pathway lesson ===");
  [["zero", mkZero], ["partial", mkPartial], ["strong", mkStrong]].forEach(([n, r]) => {
    const m = r.trace.m;
    console.log("  " + n.padEnd(8) + " opened " + m.lessonOpens + ", read " + m.lessonWords + " words, try " +
      m.tryAttempts + " attempt(s) " + m.tryRepairs + " repaired, learning:writing " +
      (m.writeMs ? (m.learnMs / m.writeMs).toFixed(2) : "0.00") + " to 1");
  });
  ok(mkStrong.trace.m.lessonOpens === 0, "the student who knew it never opened the lesson");
  ok(mkStrong.trace.m.lessonWords === 0, "and read none of it: " + mkStrong.trace.m.lessonWords + " words");
  ok(mkZero.trace.m.lessonOpens > 0, "the student who knew nothing did open it: " + mkZero.trace.m.lessonOpens);
  ok(mkZero.trace.m.tryAttempts > 0, "and was asked to use what it read: " + mkZero.trace.m.tryAttempts + " attempt(s)");
  ok(mkZero.trace.m.tryRepairs > 0, "got a wrong answer repaired rather than sent back to read");
  ok(mkZero.trace.m.tryRight > 0, "and got there on the retry");
  ok(mkPartial.trace.m.lessonOpens > 0 && mkPartial.trace.m.tryAttempts === 0,
    "the partial learner read it and did not stop to be tested: " + mkPartial.trace.m.lessonOpens + " opens, " + mkPartial.trace.m.tryAttempts + " attempts");
  ok(mkPartial.trace.m.lessonWords < mkZero.trace.m.lessonWords,
    "and stopped short of the fuller resource the zero knowledge student needed: " + mkPartial.trace.m.lessonWords + " vs " + mkZero.trace.m.lessonWords + " words");
  const three = [mkZero, mkPartial, mkStrong].map(r => r.trace.m.lessonWords);
  ok(new Set(three).size === 3, "three students, three different amounts of support consumed: " + three.join(", "));
  // the rhythm: a small amount of support, then a meaningful action, rather than
  // a long read followed by a short write
  const learnAct = mkZero.trace.m.rhythm.filter(r => r.learned > 0 && r.wrote > 0);
  console.log("  zero rhythm    " + mkZero.trace.m.rhythm.map(r => r.learned + "w -> " + r.wrote + "s").join(", "));
  console.log("  partial rhythm " + mkPartial.trace.m.rhythm.map(r => r.learned + "w -> " + r.wrote + "s").join(", "));
  console.log("  strong rhythm  " + mkStrong.trace.m.rhythm.map(r => r.learned + "w -> " + r.wrote + "s").join(", "));
  ok(learnAct.length > 0, "every paragraph the zero knowledge student learned in, it then wrote in");
  ok(mkZero.trace.m.rhythm.some(r => r.learned === 0 && r.wrote > 0),
    "and it wrote paragraphs it did not need to read for, so support is not a toll on every one");
  ok(mkStrong.trace.m.rhythm.every(r => r.learned === 0),
    "the strong student read nothing anywhere: " + JSON.stringify(mkStrong.trace.m.rhythm));
  // reported, not asserted: the rhythm we want is small learn, meaningful action,
  // small learn, meaningful action, and a number is the only way to see it drift
  console.log("  learning-to-writing is reported, not gated. The shape to watch for is");
  console.log("  a long read followed by a short write, repeated.");

  // 8b. the reading before the next action, which is the number that matters
  ok(mkZero.trace.m.wordsBeforeTry > 0 && mkZero.trace.m.wordsBeforeTry <= 150,
    "the student reaches something to do after " + mkZero.trace.m.wordsBeforeTry + " words, not after the whole resource");

  // 8c. where every concept came from. A paragraph written with no lesson is only
  //     good news if the guided environment taught what it used; if a concept has
  //     no provenance, the novice is drawing on knowledge it was never given.
  console.log("\n=== where the zero-knowledge student's concepts came from ===");
  mkZero.trace.m.provenance.forEach(x => {
    console.log("  " + x.role + ": " + (x.used.length
      ? x.used.map(u => u.term + " \u2014 " + (u.from || "NO PROVENANCE")).join(", ") : "none"));
  });
  // An orphan is a concept the paragraph needed and the student was never given.
  // There are two kinds and they call for different work, so they are counted
  // apart rather than summed into one number.
  const orphans = [...new Set(mkZero.trace.m.provenance.flatMap(x => x.used.filter(u => !u.from).map(u => u.term)))];
  const unteachable = orphans.filter(t => mkZero.teach.no.indexOf(t) >= 0);
  const notSurfaced = orphans.filter(t => mkZero.teach.yes.indexOf(t) >= 0);
  console.log("  nothing in the app explains these:      " + (unteachable.join(", ") || "none"));
  console.log("  the app explains these but never here:  " + (notSurfaced.join(", ") || "none"));
  // every orphan must have been REPORTED at the time, not discovered afterwards
  const flagged = mkZero.trace.events.filter(e => e.kind === "stuck" || e.kind === "UNSUPPORTED_DEMAND")
    .map(e => e.detail).join(" ");
  const silent = orphans.filter(t => flagged.indexOf(t) < 0);
  ok(silent.length === 0, "nothing was used unaccounted for and unreported: " + JSON.stringify(silent));
  ok(notSurfaced.length === 0 || mkZero.trace.m.blocked > 0,
    "a concept the app can teach but did not surface here is reported as a gap, not passed over: " + JSON.stringify(notSurfaced));
  const taught = mkZero.trace.m.provenance.flatMap(x => x.used.filter(u => u.from));
  ok(taught.length > 0, "and the concepts it did use, it was given: " + taught.length);
  const beforeLesson = mkZero.trace.m.provenance.slice(0, 2).flatMap(x => x.used.filter(u => u.from).map(u => u.from));
  ok(beforeLesson.length > 0,
    "including in the paragraphs it wrote before opening any lesson, from " + [...new Set(beforeLesson)].join(" and "));

  // 8d. transfer. The same relationship, stated somewhere the app never mentioned,
  //     using only what the lesson showed, judged by the app's own checker.
  const tp = mkZero.trace.m.transfer;
  console.log("\n=== transfer ===");
  console.log("  " + (tp ? tp.text : "(not run)"));
  ok(!!tp, "the transfer probe ran");
  ok(tp && tp.ok, "the relationship holds in a context the app never taught: " + (tp && tp.verdict));
  ok(tp && !tp.reopened, "and the student did not have to reopen the lesson to state it");

  // 9. what the run measured about the content, reported and not asserted away
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
