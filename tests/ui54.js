// THE FOUR STUDENTS, ON THE IMPORTED QUESTION.
//
// tests/ui53.js proves the seam: an externally authored package reaches a
// student through the real importer, the store, the picker, the preview and the
// workspace, and one representative student writes a finished response on it.
// This suite is the other half of that work, and it is a different question.
// Not "does the chain hold" but "does an imported question behave the way a
// question has to behave for four different students".
//
// It lives in the full tier for the reason it is separate at all: four walks
// through one question is a study of the pedagogy, and paying for it on every
// journeys run turned the routine gate into a small full suite. The seam is
// checked far more often than this is, which is the right way round.
//
// The profiles are the ones in tests/bots/profiles.js, unchanged, and they
// differ only in what they know and what they will do about not knowing it:
//
//   zero knowledge      knows nothing and will read anything
//   partial knowledge   knows half, reads the lesson, skips the check
//   plausible wrong turn takes a confident position its own arguments undercut
//   strong independent  writes its own arguments and opens nothing
//
// If the four journeys come out the same, the harness is not telling students
// apart and nothing it reports about this question means anything, so the
// comparisons between them are the assertions that matter most here.
const { chromium, T, OUT } = require("./env");
const { runJourney } = require("./bots/journey");
const { ZERO, STRONG, WRONG, PARTIAL } = require("./bots/profiles");
const { PKG, PKG_PATH, ID, TOPICS, publishThroughImporter, clearStore, stale } = require("./fixtures/lib");
const fs = require("fs");
const path = require("path");
const lib = require("../tools/contract/libraries.js");
const rt = require("../tools/contract/runtime.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  FAIL:", m); } };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
  const errs = [];
  ctx.on("page", pg => pg.on("pageerror", e => errs.push(String(e).slice(0, 220))));

  console.log("0. the fixture under test is not stale");
  {
    const old = stale(OUT);
    ok(!old.length, "the walkthrough fixture is newer than every source it is built from" +
      (old.length ? ", but these are newer: " + JSON.stringify(old) : ""));
  }

  console.log("1. the question they are given arrived through the importer");
  {
    await clearStore(ctx);
    const r = await publishThroughImporter(ctx, PKG_PATH);
    ok(r.outcome === "written" && r.added.length === 1 && r.added[0].id === ID,
      "the external package published: " + r.outcome + " " + JSON.stringify(r.added.map(a => a.id)));
    ok(lib.questionRegistry().ids.indexOf(ID) < 0,
      "and it is in no source subject, so these students are on imported content");
  }

  console.log("2. four students write it, on its own support");
  const q = rt.toRuntimeQuestion(PKG, { topics: TOPICS });
  const subjectContent = (() => {
    const { E } = lib.build();
    return E.subjects.business_studies;
  })();
  const RUNS = [
    { prof: ZERO, bodies: 3 },
    { prof: PARTIAL, bodies: 3 },
    { prof: WRONG, bodies: 3 },
    { prof: STRONG, bodies: 2 },
  ];
  const by = {};
  const page = await ctx.newPage();
  const traces = [];
  for (const r of RUNS) {
    const res = await runJourney(page, {
      T, subject: "business_studies", qre: new RegExp("operations strategies affect the quality", "i"),
      q: q, subjectContent: subjectContent, prof: r.prof, bodies: r.bodies,
    });
    by[r.prof.name] = res;
    traces.push(res.trace.report());
    console.log(res.trace.report() + "\n");
  }
  fs.writeFileSync(path.join(OUT, "external-journeys.txt"), traces.join("\n\n") + "\n");

  console.log("3. every one of them finished, and the four journeys differ");
  // Never refused means every paragraph started was finished, in prose. It is
  // NOT trace.m.blocked, which counts something else: a student writing without
  // a concept it needed and the app could have explained. That number is above
  // zero on the questions that shipped too, so asserting zero here would be
  // asserting that an imported question is better resourced than a bundled one.
  RUNS.forEach(r => {
    const t = by[r.prof.name].trace;
    ok(t.m.paragraphs === r.bodies,
      r.prof.name + " finished every paragraph it started: " + t.m.paragraphs + " of " + r.bodies);
    ok(t.m.sentences >= r.bodies,
      r.prof.name + " wrote prose in all of them: " + t.m.sentences + " sentences");
    console.log("    " + r.prof.name + ": wrote without a concept it needed " + t.m.blocked + " time(s)" +
      (t.m.unexplained.length ? "; never explained: " + t.m.unexplained.join(", ") : ""));
  });
  const zero = by["zero knowledge"].trace.m, strong = by["strong independent"].trace.m;
  const wrong = by["plausible wrong turn"].trace.m, part = by["partial knowledge"].trace.m;
  // The four profiles differ only in what they know and what they will do about
  // it, so if their journeys look the same the harness is not modelling students
  // and nothing above this line means anything.
  ok(zero.surfacesOpened > strong.surfacesOpened,
    "the student who knew nothing opened more support than the one who knew it: " +
    zero.surfacesOpened + " against " + strong.surfacesOpened);
  ok(zero.lessonOpens > 0, "and read a lesson: " + zero.lessonOpens + " (" + zero.lessonWords + " words)");
  ok(strong.lessonOpens === 0, "while the strong student read none: " + strong.lessonOpens);
  ok(zero.termsAcquired > 0,
    "the zero-knowledge student learned something from this question's own words: " +
    zero.termsAcquired + " of " + zero.teachable);
  ok(wrong.helpRungs > 0 || wrong.prompts > 0,
    "the wrong turn was answered rather than blocked: " + wrong.helpRungs + " rungs, " + wrong.prompts + " prompts");
  ok(part.lessonOpens > 0 && part.surfacesOpened <= zero.surfacesOpened,
    "and the partial student took the middle road: " + part.lessonOpens + " lessons, " +
    part.surfacesOpened + " surfaces");


  console.log("\npageerrors:", errs.length ? errs.join(" | ") : "none");
  ok(errs.length === 0, "no page errors across four journeys");
  await browser.close();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
