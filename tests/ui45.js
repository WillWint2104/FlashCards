// THE DIRECTIVE CONTRACT.
//
// A question's command decides what the student is being asked to do, and every
// piece of scaffolding the app offers has to stay inside that. Three ways it was
// not, all of them shipped:
//
//   1. The thesis frames offered in an INTRODUCTION opened "Overall,". An
//      introduction has shown nothing yet, and a shape that hands a student
//      backward-looking language teaches them to write the wrong paragraph.
//   2. The conclusion's second slot was headed JUDGEMENT and told every student to
//      "land a clear, weighed judgement" — including on Explain, which never asked
//      for a verdict.
//   3. The shared link frames offered "This mattered more than [the alternative]",
//      which is a second claim with its own burden of proof, on every question,
//      because only `thesis` carried a family gate.
//
// This suite is the contract, not the fix: it asserts what a student may be shown
// under each directive family, so a later edit cannot quietly reintroduce any of
// the three.
const { chromium, T, usePractice } = require('./env');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const rf = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

// Language that looks backwards over a response that has not been written yet.
const BACKWARD = /\boverall\b|\bin conclusion\b|this essay has shown|\btaken together\b|\bto conclude\b|\bin summary\b/i;
// A second claim, about something other than the thing the question asked about.
const COMPARATIVE = /\bmore than\b|\bbetter than\b|\bthe alternative\b|\bon balance\b|\bweigh(s|ed|ing)?\b|\bmost important|\bless important/i;

async function enter(p, qre) {
  await p.goto(T); await p.waitForSelector('.navtab', { timeout: 8000 });
  await p.evaluate(() => localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await p.waitForSelector('.navtab', { timeout: 8000 });
  await p.$$eval('.navtab', es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await p.waitForSelector('#essubject', { timeout: 8000 });
  await p.selectOption('#essubject', 'business_studies');
  await usePractice(p);
  const picked = await p.evaluate(r => {
    const t = [...document.querySelectorAll('.qp-row')].find(x => new RegExp(r, 'i').test(x.textContent));
    if (t) { t.click(); return t.innerText.replace(/\s+/g, ' ').trim().slice(0, 80); } return null;
  }, qre);
  if (!picked) return null;
  await p.click('#esstart');
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow'), null, { timeout: 8000 });
  return picked;
}
// Open a section by name from the start surface, and reach its composer.
async function section(p, re) {
  const went = await p.evaluate(r => {
    const t = [...document.querySelectorAll('.es-startrow')].find(x => new RegExp(r, 'i').test(x.textContent));
    if (t) { t.click(); return true; } return false;
  }, re);
  if (!went) return false;
  await rf(p);
  const path = await p.$('[data-espath]'); if (path) { await path.click(); await rf(p); }
  const go = await p.$('#esstartwriting'); if (go) { await go.click(); await rf(p); }
  return !!(await p.$('#esline'));
}
// Every frame the shapes panel offers at the stage on screen, as PROSE: the words
// the shape puts in the student's mouth, with the slots taken out.
//
// The distinction matters and is the contract itself. "Overall," offered as
// sentence furniture in an introduction is the defect. A slot LABEL reading "the
// overall principle your response will establish" is an instruction about what the
// student must supply, and they would never copy it into their essay. Testing the
// raw text would fail on the second while catching the first, so the slots come
// out first.
//
// Both surfaces are read: the authored frames, and the Sentence Shapes v2 panel
// that replaces them where a shape resolves.
async function shapes(p) {
  const b = await p.$('#esshape'); if (!b) return [];
  const open = await b.evaluate(e => e.getAttribute('aria-expanded') === 'true');
  if (!open) { await b.click(); await rf(p); }
  return p.evaluate(() => {
    const out = [];
    document.querySelectorAll('.es-shape, .es-shape2frame, .es-altframe').forEach(e => {
      const c = e.cloneNode(true);
      c.querySelectorAll('.es-hole, .es-blank, .es-sl').forEach(x => x.remove());
      const t = c.textContent.replace(/\s+/g, ' ').trim();
      if (t) out.push(t);
    });
    return out;
  });
}
const stage = p => p.evaluate(() => ({
  head: (document.querySelector('.es-guideh') || {}).textContent ? document.querySelector('.es-guideh').textContent.replace(/\s+/g, ' ').trim() : '',
  job: (document.querySelector('.es-guidejob') || {}).textContent ? document.querySelector('.es-guidejob').textContent.replace(/\s+/g, ' ').trim() : '',
}));
async function nextStage(p) {
  const n = await p.$('#esnextguide');
  if (!n || await n.evaluate(e => e.disabled)) return false;
  await n.click(); await rf(p); return true;
}

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1050 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));

  // =========================================================================
  console.log('1. an introduction is never handed conclusion language');
  // =========================================================================
  for (const q of [{ re: 'target markets', fam: 'causal' }, { re: 'effectiveness of human resource', fam: 'judgement' }]) {
    const got = await enter(p, q.re);
    ok(!!got, q.fam + ': the question is reachable (' + q.re + ')');
    if (!got) continue;
    const inIntro = await section(p, 'Introduction');
    ok(inIntro, q.fam + ': the introduction opens');
    if (!inIntro) continue;
    const frames = await shapes(p);
    ok(frames.length > 0, q.fam + ': the introduction offers at least one shape: ' + frames.length);
    const bad = frames.filter(f => BACKWARD.test(f));
    ok(bad.length === 0, q.fam + ': no introduction shape looks backwards: ' + JSON.stringify(bad));
    console.log('   ', q.fam, 'intro frames:', JSON.stringify(frames.map(f => f.slice(0, 62))));
  }

  // =========================================================================
  console.log('2. the conclusion slot follows the directive');
  // =========================================================================
  const concl = {};
  for (const q of [{ re: 'target markets', fam: 'causal' }, { re: 'effectiveness of human resource', fam: 'judgement' }]) {
    const got = await enter(p, q.re); if (!got) continue;
    const inConcl = await section(p, 'Conclusion');
    ok(inConcl, q.fam + ': the conclusion opens');
    if (!inConcl) continue;
    const seen = [];
    for (let i = 0; i < 4; i++) {
      seen.push(await stage(p));
      if (!(await nextStage(p))) break;
    }
    concl[q.fam] = seen;
    console.log('   ', q.fam, 'conclusion stages:', JSON.stringify(seen.map(s => s.head.split('·')[0].trim())));
  }
  const c = concl.causal || [], j = concl.judgement || [];
  ok(c.length >= 2, 'the causal conclusion has both of its stages: ' + c.length);
  ok(j.length >= 2, 'the judgement conclusion has both of its stages: ' + j.length);
  if (c.length >= 2 && j.length >= 2) {
    const cLast = c[c.length - 1], jLast = j[j.length - 1];
    ok(!/judgement/i.test(cLast.head), 'the causal conclusion is not headed JUDGEMENT: ' + JSON.stringify(cLast.head));
    ok(!COMPARATIVE.test(cLast.job), 'and is not told to weigh anything: ' + JSON.stringify(cLast.job));
    ok(/judgement/i.test(jLast.head), 'the judgement conclusion still IS headed judgement: ' + JSON.stringify(jLast.head));
    ok(/judgement|weigh/i.test(jLast.job), 'and still asks for one: ' + JSON.stringify(jLast.job));
    // the two families must not have been collapsed into one wording
    ok(cLast.job !== jLast.job, 'the two families say different things: ' + JSON.stringify([cLast.job, jLast.job]));
  }

  // =========================================================================
  console.log('3. a causal question is never offered a comparative frame');
  // =========================================================================
  {
    const got = await enter(p, 'target markets'); ok(!!got, 'causal: the question is reachable');
    const inBody = await section(p, 'Body 1');
    ok(inBody, 'causal: a body paragraph opens');
    if (inBody) {
      const all = [];
      for (let i = 0; i < 8; i++) {
        const f = await shapes(p);
        const st = await stage(p);
        f.forEach(x => all.push({ stage: st.head.split('·')[0].trim(), frame: x }));
        if (!(await nextStage(p))) break;
      }
      ok(all.length > 0, 'causal: frames are offered across the paragraph: ' + all.length);
      const bad = all.filter(x => COMPARATIVE.test(x.frame));
      ok(bad.length === 0, 'causal: none of them asks the student to weigh or compare: ' +
        JSON.stringify(bad.map(x => x.stage + ' :: ' + x.frame.slice(0, 60))));
      const backward = all.filter(x => BACKWARD.test(x.frame));
      ok(backward.length === 0, 'causal: and none of them looks backwards: ' +
        JSON.stringify(backward.map(x => x.frame.slice(0, 60))));
      console.log('    causal body frames checked:', all.length);
    }
  }

  // =========================================================================
  console.log('4. the judgement family keeps what the causal family lost');
  // =========================================================================
  // Removing a frame from every question would satisfy every assertion above and
  // be a different, worse bug: an Evaluate question SHOULD offer weighing.
  {
    const kept = await p.evaluate(() => {
      const t = (window.ESSAY.slots.templates.link || {});
      const j = (t.byFamily && t.byFamily.judgement) || {};
      const cz = (t.byFamily && t.byFamily.causal) || {};
      const frames = x => [x.tier1].concat((x.tier2 || []).map(y => y.frame)).filter(Boolean);
      return { judgement: frames(j), causal: frames(cz) };
    });
    ok(kept.judgement.some(f => /more than|the alternative/i.test(f)),
      'the weighing link frame still exists for judgement questions: ' + JSON.stringify(kept.judgement.map(f => f.slice(0, 50))));
    ok(!kept.causal.some(f => /more than|the alternative/i.test(f)),
      'and does not exist for causal ones: ' + JSON.stringify(kept.causal.map(f => f.slice(0, 50))));
  }

  // =========================================================================
  console.log('5. the whole authored template set, swept by family');
  // =========================================================================
  // The screens above exercise two questions. This sweeps every frame the data can
  // produce, so a family that no suite happens to walk is still covered.
  {
    const sweep = await p.evaluate(sources => {
      const BACK = new RegExp(sources.back, 'i'), COMP = new RegExp(sources.comp, 'i');
      const out = { introBackward: [], causalComparative: [], judgementLostWeighing: true };
      const tpl = window.ESSAY.slots.templates || {};
      const frames = x => x ? [x.tier1].concat((x.tier2 || []).map(y => y.frame)).filter(Boolean) : [];
      const forFamily = (t, fam) => (t && t.byFamily && t.byFamily[fam]) ? frames(t.byFamily[fam]) : frames(t);
      // introduction slots, both families
      ['thesis', 'methods'].forEach(k => ['causal', 'judgement'].forEach(fam => {
        forFamily(tpl[k], fam).forEach(f => { if (BACK.test(f)) out.introBackward.push(fam + '/' + k + ': ' + f); });
      }));
      // every slot, causal family, must carry no comparative burden
      Object.keys(tpl).forEach(k => {
        if (k === 'directiveFamilies') return;
        forFamily(tpl[k], 'causal').forEach(f => { if (COMP.test(f)) out.causalComparative.push('causal/' + k + ': ' + f); });
      });
      // the scaffolds' own body templates too
      const subj = window.ESSAY.subjects.business_studies || {};
      Object.keys(subj.scaffolds || {}).forEach(name => {
        const st = (subj.scaffolds[name] || {}).templates || {};
        Object.keys(st).forEach(k => forFamily(st[k], 'causal').forEach(f => {
          if (COMP.test(f)) out.causalComparative.push(name + '/' + k + ': ' + f);
        }));
      });
      return out;
    }, { back: BACKWARD.source, comp: COMPARATIVE.source });
    ok(sweep.introBackward.length === 0,
      'no introduction template in any family looks backwards: ' + JSON.stringify(sweep.introBackward));
    ok(sweep.causalComparative.length === 0,
      'no causal template in any slot or scaffold asks for a comparison: ' + JSON.stringify(sweep.causalComparative));
  }

  // =========================================================================
  console.log('6. authored pathway guidance stays inside its directive');
  // =========================================================================
  {
    const found = await p.evaluate(() => {
      const fams = window.ESSAY.slots.templates.directiveFamilies || {};
      const causal = fams.causal || [];
      const hits = [];
      Object.keys(window.ESSAY.subjects).forEach(sk => {
        (window.ESSAY.subjects[sk].questions || []).forEach(q => {
          const cmd = String(q.command || '').toLowerCase();
          const isCausal = causal.some(x => cmd === x || cmd.indexOf(x) === 0);
          if (!isCausal) return;
          (q.pathways || []).forEach(pa => {
            // Both fields carry the same kind of claim and both reach the student,
            // so both are swept: whatToProve drives the guidance, and the learning
            // chain is read out in the lesson.
            const lines = [String(pa.whatToProve || '')]
              .concat(((pa.learning || {}).chain) || []);
            lines.filter(Boolean).forEach(w => {
              // "more than one segment is served" is a quantity, not a claim that
              // one thing beats another, so the pattern names the claim rather than
              // matching the words loosely. "better" IS in it: under a causal
              // directive it asserts superiority over an alternative even when no
              // alternative is named.
              if (/\bbetter\b|\bstronger\b|mattered more than|\bmore (?:important|effective|significant|valuable)\b|\bthe alternative\b|\boutweigh/i.test(w))
                hits.push(q.id + '/' + pa.id + ': ' + w);
            });
          });
        });
      });
      return { hits: hits };
    });
    ok(found.hits.length === 0,
      'no causal pathway asks the student to establish superiority: ' + JSON.stringify(found.hits));
  }

  console.log('pageerrors:', errs.length ? errs : 'none');
  ok(errs.length === 0, 'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
