// The driver. It walks the real app as one of the students in profiles.js and
// records what happened to them, not what was clicked. Nothing here decides what
// the student does: the profile's knowledge state does, and the app's response
// to it does.
const { termsOf, vocabulary, teachable, Ledger, Trace } = require("./lib");

const wait = (p, ms) => p.waitForTimeout(ms);
const has = async (p, sel) => !!(await p.$(sel));
const txt = (p, sel) => p.$eval(sel, e => e.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
const allTxt = (p, sel) => p.$$eval(sel, es => es.map(e => e.innerText.replace(/\s+/g, " ").trim())).catch(() => []);

async function openApp(p, T, subject, qre, structure) {
  await p.goto(T); await wait(p, 650);
  await p.evaluate(() => localStorage.removeItem("marginal.essay.v1"));
  await p.goto(T); await wait(p, 650);
  await p.$$eval(".navtab", es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await wait(p, 400);
  await p.selectOption("#essubject", subject); await wait(p, 220);
  await p.$$eval(".es-qchip", (es, r) => { const t = es.find(x => new RegExp(r, "i").test(x.textContent)); t && t.click(); }, qre.source);
  if (structure) { await p.selectOption("#esstruct", structure); await wait(p, 150); }
  await p.click("#esstart"); await wait(p, 700);
}

async function read(p, tr, led, vocab, sel, source) {
  const t = await txt(p, sel);
  if (!t) return [];
  const got = led.acquire(t, source, vocab);
  if (got.length) { tr.m.termsAcquired += got.length; tr.say("learn", "acquired " + got.join(", ") + " from " + source); }
  return got;
}

function compose(kind, terms, n, cs) {
  const a = terms[0] || "this", b = terms[1] || terms[0] || "performance";
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  if (kind === "strong") {
    return [
      cap(a) + " is the strategy " + cs + " leans on hardest.",
      "It changes " + b + " because staff spend less time on work that has to be redone.",
      "At " + cs + " that shows up in " + b + " within a single trading period.",
      "The size of the gain depends on whether it is carried out consistently across the network.",
      "So " + a + " is effective where " + b + " can actually be measured."
    ][n] || "It holds for the same reason at " + cs + ", measured against " + b + ".";
  }
  if (kind === "wrong") {
    return [
      cap(a) + " is used at " + cs + " and it is meant to lift " + b + ".",
      "In practice it does not always reach " + b + ".",
      "At " + cs + " the effect on " + b + " is smaller than expected.",
      "That is a real limit on how far it works.",
      "So " + a + " does less for " + b + " than it looks."
    ][n] || "The same limit shows again at " + cs + ".";
  }
  return [
    cap(a) + " affects " + b + " at " + cs + ".",
    "It does this because staff know what to do.",
    "At " + cs + " this can be seen in " + b + ".",
    "This matters because " + b + " is what the business is measured on.",
    "So " + a + " changes " + b + "."
  ][n] || cap(a) + " still changes " + b + ".";
}

// Write one paragraph. The student writes only what its ledger supports; when it
// cannot, it does what its policy allows to learn more. Two different failures
// are recorded separately: the app running out of help for something it does
// explain, and the app having no explanation of the concept at all.
async function writeParagraph(p, tr, led, vocab, prof, need, unexplained, cs) {
  const wroteFrom = Date.now();
  let n = 0, learnOpened = false, reportedGap = false, reportedStuck = false;
  // an observation, not an interaction: was help available anywhere in this
  // paragraph, whether or not this student happened to need it. Asked at every
  // sentence because the ladder is per SLOT: the first slot of a paragraph can
  // have nothing authored while later ones do.
  let ladderSeen = false, slotsWithLadder = 0, slotsSeen = 0;
  while (n < 6) {
    if (!(await has(p, "#esline"))) break;
    slotsSeen++;
    if (await has(p, "#esmorehelp")) { ladderSeen = true; slotsWithLadder++; }
    let missing = led.missing(need);
    let guard = 0;
    while (missing.length && guard < 6) {
      guard++;
      if (prof.opensLearn && !learnOpened) {
        learnOpened = true; tr.m.surfacesOpened++;
        await p.click('[data-estool="understand"]').catch(() => {}); await wait(p, 420);
        tr.say("open", "Learn");
        await read(p, tr, led, vocab, ".es-drawer", "Learn");
        await p.click('[data-estool="understand"]').catch(() => {}); await wait(p, 300);
      } else if (prof.usesHelp && await has(p, "#esmorehelp")) {
        await p.click("#esmorehelp"); await wait(p, 340);
        tr.m.helpRungs++;
        const rungs = await allTxt(p, ".es-rung");
        tr.say("help", "rung " + rungs.length + ": " + (rungs[rungs.length - 1] || "").slice(0, 72));
        await read(p, tr, led, vocab, ".es-help", "help rung " + rungs.length);
      } else break;
      missing = led.missing(need);
    }
    if (missing.length && !reportedStuck) {
      reportedStuck = true;
      tr.m.blocked++;
      tr.say("stuck", "still does not know " + missing.join(", ") + ", and the app had nothing further to show");
    }
    if (unexplained.length && !reportedGap) {
      reportedGap = true;
      unexplained.forEach(t => { if (tr.m.unexplained.indexOf(t) < 0) tr.m.unexplained.push(t); });
      tr.demand("the interface says " + unexplained.join(", ") + " and nothing explains " + (unexplained.length === 1 ? "it" : "them"));
    }
    const know = need.filter(t => led.knows(t));
    const line = compose(prof.style, know.length ? know : need.concat(unexplained), n, cs);
    await p.fill("#esline", line);
    await p.click("#esaccept").catch(() => {});
    await wait(p, 380);
    tr.m.sentences++;
    const prose = await txt(p, ".es-prose");
    if (prose.indexOf(line.replace(/\s+/g, " ").trim()) >= 0) tr.m.verbatim++;
    else { tr.m.altered++; tr.say("altered", "the app did not keep this sentence as written: " + line); }
    if (tr.m.msToFirstSentence == null) {
      tr.m.msToFirstSentence = tr.at();
      tr.m.surfacesBeforeFirstSentence = tr.m.surfacesOpened + tr.m.helpRungs;
      tr.say("write", "first sentence: " + line);
    }
    n++;
    if (await has(p, ".es-done")) { tr.m.paragraphs++; tr.say("complete", "paragraph complete after " + n + " sentences"); break; }
  }
  tr.m.writeMs += Date.now() - wroteFrom;
  if (ladderSeen) tr.m.ladderHere++;
  else { tr.m.noLadderHere++; if (prof.usesHelp) tr.demand("this paragraph offered no help ladder at any sentence"); }
  tr.say("support", "help was offered at " + slotsWithLadder + " of " + slotsSeen + " sentences in this paragraph");
}

async function runJourney(p, o) {
  const { T, subject, qre, q, subjectContent, prof, bodies } = o;
  const vocab = vocabulary(q);
  const teach = teachable(q, subjectContent);
  const led = new Ledger(prof.knowsAll ? vocab : prof.knowsSome ? vocab.slice(0, Math.ceil(vocab.length / 2)) : []);
  const tr = new Trace(prof.name + " · " + q.id);
  tr.m.teachable = teach.yes.length;
  const cs = o.caseStudy || "McDonald's";

  await openApp(p, T, subject, qre);
  tr.start();
  tr.say("arrive", q.id + " · knows " + led.size() + " of " + vocab.length + " concepts this question uses");

  if (await has(p, ".es-judge")) {
    if (!prof.canJudge) {
      await p.click("#esposdefer").catch(() => {}); await wait(p, 400);
      tr.say("judgement", "cannot evaluate the question yet, chose to decide while writing");
    } else {
      await p.$$eval("[data-espos]", (es, l) => { const t = es.find(x => new RegExp(l, "i").test(x.textContent)); t && t.click(); }, prof.position);
      await wait(p, 400);
      tr.say("judgement", "took a position: " + prof.position);
    }
  }
  tr.say("answer", "working answer: " + (await txt(p, ".es-watext")));

  const used = [];
  for (let k = 0; k < bodies; k++) {
    if (k === 0) { await p.click("#esstartbody").catch(() => {}); }
    else {
      const nx = await p.$("#esdonenext");
      if (nx) await nx.click();
      else await p.$$eval(".es-startrow", (es, i) => { const t = es.filter(x => /Body/.test(x.textContent))[i]; t && t.click(); }, k);
    }
    await wait(p, 600);
    tr.say("arrive", await txt(p, ".es-pararole"));

    let need = [], unexplained = [];
    const learnedHere = tr.m.lessonWords, wroteHere = tr.m.sentences;
    if (await has(p, ".es-setup")) {
      tr.m.stepsAppRequired++;
      const readMeanings = async () => {
        if (!prof.readsMeanings) return;
        const before = led.size();
        for (const s of await allTxt(p, ".es-picksub")) led.acquire(s, "argument meanings", vocab);
        const got = led.size() - before;
        if (got) { tr.m.termsAcquired += got; tr.m.surfacesOpened++; tr.say("learn", "acquired " + got + " concepts from the meanings under each argument"); }
      };
      await readMeanings();
      let areaChosen = "";
      if (await has(p, "[data-essetuparea]")) {
        await p.$$eval("[data-essetuparea]", (es, i) => { const t = es[i % es.length]; t && t.click(); }, prof.areaOrder ? prof.areaOrder[k] : k);
        await wait(p, 350);
        areaChosen = (await allTxt(p, ".es-areachip.on"))[0] || "";
        tr.say("select", "area: " + areaChosen);
        // on a question that does not fix its parts there is nothing to read
        // until the area is chosen, so read again now that there is
        await readMeanings();
      }
      const ownRoute = typeof prof.writesOwnArgument === "function" ? prof.writesOwnArgument(q) : prof.writesOwnArgument;
      if (ownRoute) {
        const offered = await p.$$eval("[data-espath]", es => es.map(e => e.dataset.espath));
        const own = prof.ownArgument(k, cs, q, used, offered);
        await p.click("[data-espathown]").catch(() => {}); await wait(p, 250);
        await p.fill("#esownarg", own.line);
        await p.click("#esownok"); await wait(p, 400);
        tr.m.ownArguments++;
        tr.say("select", "own argument: " + own.line);
        need = own.terms.filter(t => teach.yes.indexOf(t) >= 0);
        unexplained = own.terms.filter(t => teach.no.indexOf(t) >= 0);
      } else {
        const ids = await p.$$eval("[data-espath]", es => es.map(e => e.dataset.espath));
        const want = prof.pick(ids, k, q, used);
        used.push(want);
        await p.$$eval("[data-espath]", (es, id) => { const t = es.find(x => x.dataset.espath === id); t && t.click(); }, want);
        await wait(p, 420);
        tr.m.suppliedArguments++;
        const path = (q.pathways || []).find(x => x.id === want);
        const all = path ? termsOf(path) : [];
        need = all.filter(t => teach.yes.indexOf(t) >= 0);
        unexplained = all.filter(t => teach.no.indexOf(t) >= 0);
        tr.say("select", "argument: " + (path ? path.short : want) + (path && path.contribution ? " [" + path.contribution.role + "]" : ""));
      }
      // the pathway lesson, if this student wants it and this pathway has one
      if (prof.opensLesson && await has(p, "#eslessonopen")) {
        const t0 = Date.now();
        await p.click("#eslessonopen"); await wait(p, 480);
        tr.m.lessonOpens++;
        const body = await txt(p, ".es-lesson");
        const words = body.split(/\s+/).filter(Boolean).length;
        tr.m.lessonWords += words;
        tr.say("open", "the lesson for this argument, " + words + " words");
        await read(p, tr, led, vocab, ".es-lesson", "the pathway lesson");
        const steps = await allTxt(p, ".es-chainstep");
        if (steps.length) tr.say("see", steps.join(" \u2192 "));
        if (prof.opensExplore && await has(p, "#eslessonexplore")) {
          await p.click("#eslessonexplore"); await wait(p, 460);
          const more = await txt(p, ".es-drawer");
          tr.m.lessonWords += more.split(/\s+/).filter(Boolean).length;
          tr.say("open", "explore, the fuller resource, a further " + more.split(/\s+/).filter(Boolean).length + " words");
          await read(p, tr, led, vocab, ".es-drawer", "explore");
          await p.click("#eslessonexplore").catch(() => {}); await wait(p, 320);
        }
        for (const i of (prof.tryOrder || [])) {
          if (!(await has(p, "[data-estry]"))) break;
          await p.$$eval("[data-estry]", (es, k) => { const t = es[k]; t && t.click(); }, i);
          await wait(p, 430);
          tr.m.tryAttempts++;
          if (await has(p, ".es-tryright")) { tr.m.tryRight++; tr.say("try", "right: " + (await txt(p, ".es-tryright")).slice(0, 76)); break; }
          const rep = await txt(p, ".es-tryrepair");
          if (rep) {
            tr.m.tryRepairs++;
            tr.say("try", "repaired: " + rep.slice(0, 76));
            await p.click("#estryagain").catch(() => {}); await wait(p, 380);
          }
        }
        await p.$$eval("[data-eslessonuse]", es => { const t = es[es.length - 1]; t && t.click(); }).catch(() => {});
        await wait(p, 520);
        tr.m.learnMs += Date.now() - t0;
        tr.say("respond", "took it back to the paragraph");
      }
      const evText = await txt(p, ".es-setup");
      if (/no verified evidence|waiting on a checked source|no evidence bank/i.test(evText)) {
        tr.demand("evidence is asked for and none of it has a checked source");
      }
      // an argument the student stated themselves may be questioned here
      const dir = await txt(p, ".es-drift.dir");
      if (dir) {
        tr.m.prompts++; tr.m.writePrompts++;
        tr.say("prompt", dir.slice(0, 140));
        const answer = prof.answerDirection ? prof.answerDirection(tr.m.prompts) : "keep";
        await p.click(answer === "keep" ? "[data-esdirkeep]" : "[data-esdirfix]").catch(() => {});
        await wait(p, 430);
        tr.say("respond", answer === "keep" ? "kept the point as written" : "went back to revise it");
      }
      const sw = await p.$("#esstartwriting");
      if (sw) { tr.m.stepsAppRequired++; await sw.click(); await wait(p, 420); }
    }
    await writeParagraph(p, tr, led, vocab, prof, need, unexplained, cs);
    tr.m.rhythm.push({ learned: tr.m.lessonWords - learnedHere, wrote: tr.m.sentences - wroteHere });
    const wa = await txt(p, ".es-mapwatext");
    if (wa) {
      tr.say("answer", "working answer: " + wa);
      // did the app's own understanding of the response move at all? It is the
      // app that decides this, not the profile.
      if (q.workingAnswer && wa.replace(/\s+/g, " ").trim() !== String(q.workingAnswer.base).trim()) tr.m.answerMoved = true;
    }

    // a student who never looks back at the response map never meets anything
    // that only lives on the planning surface
    if (prof.checksPlanAfter && prof.checksPlanAfter.indexOf(k) >= 0) {
      await p.click(".es-mapwa").catch(() => {}); await wait(p, 520);
      tr.m.mapVisits++;
      tr.say("open", "looked back at the response map");
      if (await has(p, ".es-drift.tension")) {
        tr.m.prompts++; tr.m.planPrompts++;
        tr.say("prompt", (await txt(p, ".es-drift.tension")).slice(0, 150));
        const answer = prof.answerTension(tr.m.prompts);
        await p.click(answer === "keep" ? "#esposkeep" : "#espostension").catch(() => {});
        await wait(p, 420);
        tr.say("respond", answer === "keep" ? "kept the judgement" : "reopened the judgement");
        if (answer !== "keep" && prof.newPosition) {
          await p.$$eval("[data-espos]", (es, l) => { const t = es.find(x => new RegExp(l, "i").test(x.textContent)); t && t.click(); }, prof.newPosition);
          await wait(p, 420);
          tr.say("judgement", "changed it to: " + prof.newPosition);
        }
      }
      if (await has(p, ".es-drift:not(.tension):not(.dir)")) { tr.m.prompts++; tr.m.planPrompts++; tr.say("prompt", "thesis drift shown"); }
      const n = await p.$$eval(".es-startrow", es => es.filter(x => /Body/.test(x.textContent)).length).catch(() => 0);
      if (n) await p.$$eval(".es-startrow", (es, i) => { const t = es.filter(x => /Body/.test(x.textContent))[i]; t && t.click(); }, Math.min(k, n - 1));
      await wait(p, 500);
    }
  }

  if (await has(p, "#esreview")) { await p.click("#esreview"); await wait(p, 550); }
  const cover = await txt(p, ".es-cover.missing");
  tr.m.coverageGaps = await p.$$eval("[data-escover]", es => es.length).catch(() => 0);
  if (cover) tr.say("review", cover.slice(0, 130));
  tr.say("review", (await txt(p, ".es-rvsub")) || "read the whole response");
  return { trace: tr, ledger: led, vocab, teach };
}
module.exports = { runJourney };
