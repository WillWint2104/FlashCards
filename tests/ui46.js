// SENTENCE SHAPES v2 — THE CONTRACT.
//
// A shape is a STRUCTURE for one sentence, resolved by directive family, then
// paragraph role, then stage. The reason it is safe to show a student a
// half-completed sentence is a set of rules that have to hold every time:
//
//   a mint slot is an AUTHORED string the student already has, never a derived one;
//   a shape whose mint slot cannot resolve is withheld entirely;
//   nothing in the panel writes, inserts or rewrites a sentence;
//   an example is always another context and can never answer the live question;
//   the mechanism is optional metadata and is never a slot.
//
// This suite is those rules.
const { chromium, T, usePractice } = require('./env');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const rf = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

async function enterBus(p, qre) {
  await p.goto(T); await p.waitForSelector('.navtab', { timeout: 8000 });
  await p.evaluate(() => localStorage.removeItem('marginal.essay.v1'));
  await p.goto(T); await p.waitForSelector('.navtab', { timeout: 8000 });
  await p.$$eval('.navtab', es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
  await p.waitForSelector('#essubject', { timeout: 8000 });
  await p.selectOption('#essubject', 'business_studies');
  await usePractice(p);
  const got = await p.evaluate(r => {
    const t = [...document.querySelectorAll('.qp-row')].find(x => new RegExp(r, 'i').test(x.textContent));
    if (t) { t.click(); return true; } return false; }, qre);
  if (!got) return false;
  await p.click('#esstart');
  await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow'), null, { timeout: 8000 });
  return true;
}
async function section(p, re) {
  const went = await p.evaluate(r => {
    const t = [...document.querySelectorAll('.es-startrow')].find(x => new RegExp(r, 'i').test(x.textContent));
    if (t) { t.click(); return true; } return false; }, re);
  if (!went) return false;
  await rf(p);
  const path = await p.$('[data-espath]'); if (path) { await path.click(); await rf(p); }
  const go = await p.$('#esstartwriting'); if (go) { await go.click(); await rf(p); }
  return !!(await p.$('#esline'));
}
async function openShape(p) {
  const b = await p.$('#esshape'); if (!b) return false;
  if (await b.evaluate(e => e.getAttribute('aria-expanded') !== 'true')) { await b.click(); await rf(p); }
  return true;
}
const slots = p => p.$$eval('.es-shape2frame .es-sl', es => es.map(e => ({
  text: e.textContent.trim(), kind: /\bres\b/.test(e.className) ? 'resolved' : 'student' })));

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1100 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));

  // ==========================================================================
  console.log('1. a mint slot is an authored string, and only ever that');
  // ==========================================================================
  ok(await enterBus(p, 'target markets'), 'the causal question is reachable');
  ok(await section(p, 'Body 1'), 'a body paragraph opens');
  ok(await openShape(p), 'the shape control is on the prompt');
  ok(!!(await p.$('.es-shape2')), 'a v2 shape resolved for causal / body / topic');
  const body = await slots(p);
  console.log('    body slots:', JSON.stringify(body));
  const authored = await p.evaluate(() => {
    const q = window.ESSAY.subjects.business_studies.questions.find(x => x.id === 'mkt-01');
    return { froms: (q.pathways || []).map(x => x.fromLabel).filter(Boolean),
             areas: ((q.requirements || {}).requiredAreas || []).map(a => a.label) };
  });
  const resolved = body.filter(x => x.kind === 'resolved').map(x => x.text);
  ok(resolved.length === 2, 'the body shape has two resolved slots: ' + resolved.length);
  ok(resolved.every(v => authored.froms.indexOf(v) >= 0 || authored.areas.indexOf(v) >= 0),
    'each is an authored string verbatim, not a derived one: ' + JSON.stringify(resolved));
  const student = body.filter(x => x.kind === 'student');
  ok(student.length === 1, 'and exactly one slot is the student\'s: ' + JSON.stringify(student.map(x => x.text)));
  ok(/^\[.*\]$/.test(student[0].text), 'which is shown as a hole, not as a value: ' + student[0].text);
  // The two colours mint and amber mean, kept to compare the legacy fallback against
  const REF = await p.evaluate(() => {
    const g = s => { const e = document.querySelector(s); return e ? getComputedStyle(e).backgroundColor : ''; };
    return { resolved: g('.es-sl.res'), student: g('.es-sl.you') };
  });
  console.log('    treatments:', JSON.stringify(REF));
  ok(!!REF.resolved && !!REF.student && REF.resolved !== REF.student,
    'the two treatments are visually distinct: ' + JSON.stringify(REF));
  {
    const frame = await p.$eval('.es-shape2frame', e => e.textContent);
    ok(!/\{@?[a-zA-Z0-9_-]+\}/.test(frame), 'no unresolved token is left in the frame: ' + JSON.stringify(frame));
    ok(!/shape its/i.test(frame), 'the connector reads as English rather than one universal construction: ' + JSON.stringify(frame));
  }

  // ==========================================================================
  console.log('2. a verb is prose, never a slot');
  // ==========================================================================
  {
    const frame = await p.$eval('.es-shape2frame', e => e.textContent.replace(/\s+/g, ' ').trim());
    const chips = body.map(x => x.text);
    const between = chips.reduce((t, c) => t.split(c).join(' | '), frame);
    ok(/lead|shape|affect|because/i.test(between), 'the connecting words sit outside the slots: ' + JSON.stringify(between));
    ok(!chips.some(c => /^(affect|affects|lead|leads|shape|shapes|can improve)$/i.test(c.trim())),
      'no slot is a bare verb: ' + JSON.stringify(chips));
  }

  // ==========================================================================
  console.log('3. the mechanism is never a slot, and is never assumed to exist');
  // ==========================================================================
  {
    const lib = await p.evaluate(() => window.ESSAY.shapes.library);
    const mech = [];
    lib.forEach(sh => (sh.slots || []).forEach(sl => {
      if (/mechanism/i.test(String(sl.id) + String(sl.label) + String(sl.note || ''))) mech.push(sh.id + '/' + sl.id);
    }));
    ok(mech.length === 0, 'no slot in the library is a mechanism: ' + JSON.stringify(mech));
    // the pathway on screen declares mechanism.state "none-required", and a shape
    // still resolved for it: the engine did not require a record that is absent
    const state = await p.evaluate(() => {
      const q = window.ESSAY.subjects.business_studies.questions.find(x => x.id === 'mkt-01');
      const pa = (q.pathways || []).find(x => x.id === 'mkt01-em-digital');
      return (pa.mechanism || {}).state || 'absent';
    });
    ok(state === 'none-required', 'the pathway under test declares no mechanism is required: ' + state);
    ok(!!(await p.$('.es-shape2')), 'and a shape resolved for it anyway');
  }

  // ==========================================================================
  console.log('4. pressing a slot explains it, and writes nothing');
  // ==========================================================================
  {
    const before = await p.$eval('#esline', e => e.value);
    await p.$$eval('.es-shape2frame [data-esslot]', es => { const t = es.find(x => /^\[/.test(x.textContent)); t && t.click(); });
    await rf(p);
    const note = await p.$eval('.es-slotnote', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
    ok(note.length > 20, 'the slot says what it wants: ' + JSON.stringify(note.slice(0, 70)));
    ok((await p.$eval('#esline', e => e.value)) === before, 'and the composer is untouched');
  }

  // ==========================================================================
  console.log('5. the example is another context and cannot answer this question');
  // ==========================================================================
  {
    const has = await p.$('#esshapeex');
    ok(!!has, 'an example is offered for this shape');
    await p.click('#esshapeex'); await rf(p);
    const ex = await p.$eval('.es-shapeextext', e => e.textContent.replace(/\s+/g, ' ').trim());
    console.log('    example:', JSON.stringify(ex));
    const banned = authored.areas.concat(['target market']);
    const hit = banned.filter(t => ex.toLowerCase().indexOf(String(t).toLowerCase()) >= 0);
    ok(hit.length === 0, 'it names nothing the question fixes: ' + JSON.stringify(hit));
    ok(!/\[/.test(ex), 'and it is a finished sentence, not another set of holes');
    ok((await p.$$eval('.es-shapeextext .es-sl.plain', es => es.length)) > 0,
      'its parts are mapped back onto the shape');
    ok((await p.$eval('#esline', e => e.value)) === '', 'the composer is still untouched');
    await p.click('#esshapeex'); await rf(p);
  }

  // ==========================================================================
  console.log('6. the alternatives carry the same burden, and one is Conditional form');
  // ==========================================================================
  {
    await p.click('#esshapealts'); await rf(p);
    const alts = await p.$$eval('.es-alt', es => es.map(e => ({
      name: (e.querySelector('.es-altlbl') || {}).textContent.replace(/\s+/g, ' ').trim(),
      frame: (e.querySelector('.es-altframe') || {}).textContent.replace(/\s+/g, ' ').trim(),
      why: (e.querySelector('.es-altwhy') || {}).textContent.replace(/\s+/g, ' ').trim(),
      holes: e.querySelectorAll('.es-sl.you').length })));
    console.log('    alternatives:', JSON.stringify(alts.map(a => a.name)));
    ok(alts.length === 3, 'three structures are offered: ' + alts.length);
    ok(alts.some(a => /conditional form/i.test(a.name)), 'one of them is Conditional form');
    ok(!alts.some(a => /against the alternative|general rule/i.test(a.name)),
      'and the comparative one is gone: ' + JSON.stringify(alts.map(a => a.name)));
    ok(alts.every(a => a.holes === 1), 'each asks the student for exactly one thing: ' + JSON.stringify(alts.map(a => a.holes)));
    const cmp = alts.filter(a => /more than|better than|the alternative|on balance|\bweigh/i.test(a.frame + ' ' + a.why));
    ok(cmp.length === 0, 'none of them asks for a comparison: ' + JSON.stringify(cmp.map(a => a.name)));
    ok(!alts.some(a => /marker|credits?\b/i.test(a.why)), 'and none of them speculates about marking: ' +
      JSON.stringify(alts.map(a => a.why).filter(w => /marker|credit/i.test(w))));
    // picking one changes the structure and writes nothing
    await p.$$eval('[data-esalt]', es => { const t = es.find(x => x.dataset.esalt); t && t.click(); });
    await rf(p);
    ok((await p.$eval('#esline', e => e.value)) === '', 'picking a structure writes nothing');
    ok(!!(await p.$('.es-shape2frame')), 'and the panel returns to the shape it chose');
  }

  // ==========================================================================
  console.log('7. the roles get different shapes, and the conclusion is two stages');
  // ==========================================================================
  {
    ok(await enterBus(p, 'target markets'), 'reopened');
    ok(await section(p, 'Introduction'), 'the introduction opens');
    await openShape(p);
    const intro = await p.$eval('.es-shape2frame', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
    console.log('    introduction:', JSON.stringify(intro));
    ok(/because/.test(intro), 'the thesis carries a reason: ' + JSON.stringify(intro.slice(0, 60)));
    ok(/the overall principle your response will establish/i.test(intro),
      'and its student slot is an overall principle, not one mechanism');
    ok(!/\boverall\b|\bin conclusion\b|this essay has shown/i.test(intro.replace(/the overall principle[^\]]*/i, '')),
      'no backward-looking language in an introduction: ' + JSON.stringify(intro));

    ok(await enterBus(p, 'target markets'), 'reopened again');
    ok(await section(p, 'Conclusion'), 'the conclusion opens');
    await openShape(p);
    const c1 = await p.$eval('.es-shape2frame', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
    const k1 = await p.$eval('.es-shape2key', e => e.textContent.trim()).catch(() => '');
    const n = await p.$('#esnextguide');
    let c2 = '', k2 = '';
    if (n && !(await n.evaluate(e => e.disabled))) {
      await n.click(); await rf(p); await openShape(p);
      c2 = await p.$eval('.es-shape2frame', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
      k2 = await p.$eval('.es-shape2key', e => e.textContent.trim()).catch(() => '');
    }
    console.log('    conclusion 1:', JSON.stringify(c1), '\n    conclusion 2:', JSON.stringify(c2));
    ok(!!c1 && !!c2, 'the conclusion is two shapes, one per stage');
    ok(c1 !== c2 && k1 !== k2, 'and they are different stages, not one block: ' + JSON.stringify([k1, k2]));
    ok(/^Across/i.test(c1), 'the first synthesises: ' + JSON.stringify(c1.slice(0, 40)));
    ok(/^Therefore/i.test(c2), 'the second answers: ' + JSON.stringify(c2.slice(0, 40)));
    const both = (c1 + ' ' + c2).toLowerCase();
    ok(!/judgement|weigh|on balance|most effective/.test(both),
      'and neither asks a causal student for a verdict: ' + JSON.stringify(both.slice(0, 90)));
  }

  // ==========================================================================
  console.log('8. a shape that cannot resolve is withheld, not shown half-empty');
  // ==========================================================================
  {
    // Ancient History ships no pathways, so pathway.fromLabel cannot bind. The
    // body shape must not render with an empty mint slot; the authored frames
    // stand in instead.
    await p.goto(T); await p.waitForSelector('.navtab', { timeout: 8000 });
    await p.evaluate(() => localStorage.removeItem('marginal.essay.v1'));
    await p.goto(T); await p.waitForSelector('.navtab', { timeout: 8000 });
    await p.$$eval('.navtab', es => { const t = es.find(x => /Essay practice/i.test(x.textContent)); t && t.click(); });
    await p.waitForSelector('#essubject', { timeout: 8000 });
    await p.selectOption('#essubject', 'ancient_history').catch(() => {});
    await rf(p);
    await usePractice(p);
    const any = await p.evaluate(() => { const t = document.querySelector('.qp-row'); if (t) { t.click(); return true; } return false; });
    if (any) {
      await p.click('#esstart');
      await p.waitForFunction(() => !!document.querySelector('#esline, .es-startrow'), null, { timeout: 8000 });
      await section(p, 'Body 1');
      const opened = await openShape(p);
      const v2 = await p.$$eval('.es-shape2', es => es.length);
      const legacy = await p.$$eval('.es-shape', es => es.length);
      const empty = await p.$$eval('.es-shape2frame .es-sl.res', es => es.filter(e => !e.textContent.trim()).length);
      console.log('    no-pathway subject: v2 panels', v2, 'legacy frames', legacy, 'empty mint slots', empty);
      ok(empty === 0, 'no mint slot renders empty: ' + empty);
      ok(!opened || v2 === 0 || legacy > 0, 'something is offered, and it is not a shape with a hole where a known value was promised');
    } else {
      console.log('    (no ancient history question to walk; skipped)');
    }
  }

  // ==========================================================================
  console.log('9. the library keeps provenance separately from treatment');
  // ==========================================================================
  {
    const bad = await p.evaluate(() => {
      const out = { noSource: [], noBinding: [], badTreatment: [], studentBound: [] };
      (window.ESSAY.shapes.library || []).forEach(sh => (sh.slots || []).forEach(sl => {
        if (['resolved', 'student'].indexOf(sl.treatment) < 0) out.badTreatment.push(sh.id + '/' + sl.id);
        if (sl.treatment === 'resolved') {
          if (!sl.source || sl.source === 'student') out.noSource.push(sh.id + '/' + sl.id);
          if (!sl.binding) out.noBinding.push(sh.id + '/' + sl.id);
        } else if (sl.binding) out.studentBound.push(sh.id + '/' + sl.id);
      }));
      return out;
    });
    ok(bad.badTreatment.length === 0, 'every slot declares one of the two treatments: ' + JSON.stringify(bad.badTreatment));
    ok(bad.noSource.length === 0, 'every resolved slot records where its value came from: ' + JSON.stringify(bad.noSource));
    ok(bad.noBinding.length === 0, 'and names the authored field it binds to: ' + JSON.stringify(bad.noBinding));
    ok(bad.studentBound.length === 0, 'no student slot is bound to anything: ' + JSON.stringify(bad.studentBound));
  }

  // ==========================================================================
  console.log('10. a causal shape never shows a student judgement language');
  // ==========================================================================
  // The slot key stays `judgement` for compatibility, and PR #53 fixed what the
  // COMPOSER heads that stage. The shape panel had its own copy of the same leak:
  // it rendered the raw stage key, so an Explain student read
  // "CAUSAL · CONCLUSION · JUDGEMENT" over a shape whose own words said answer the
  // question directly.
  const VERDICT = /judgement|judgment|\bweigh|on balance|strongest|most effective|verdict|more important/i;
  {
    const lib = await p.evaluate(() => window.ESSAY.shapes.library);
    const leaks = lib.filter(sh => sh.family === 'causal')
      .filter(sh => VERDICT.test([sh.family, sh.role, sh.stageLabel || sh.stage].join(' ')))
      .map(sh => sh.id + ' -> ' + (sh.stageLabel || sh.stage));
    ok(leaks.length === 0, 'no causal shape renders verdict language in its metadata: ' + JSON.stringify(leaks));
    const unlabelled = lib.filter(sh => VERDICT.test(sh.stage) && !sh.stageLabel).map(sh => sh.id);
    ok(unlabelled.length === 0, 'any shape on a verdict-named slot carries its own label: ' + JSON.stringify(unlabelled));
  }
  {
    ok(await enterBus(p, 'target markets'), 'reopened for the rendered check');
    ok(await section(p, 'Conclusion'), 'the causal conclusion opens');
    await openShape(p);
    const n = await p.$('#esnextguide');
    if (n && !(await n.evaluate(e => e.disabled))) { await n.click(); await rf(p); await openShape(p); }
    const key = await p.$eval('.es-shape2key', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
    console.log('    causal conclusion stage 2 header:', JSON.stringify(key));
    ok(!!key, 'the second stage renders a shape');
    ok(!VERDICT.test(key), 'and its header is not verdict language: ' + JSON.stringify(key));
    ok(/answer/i.test(key), 'it says what the sentence does: ' + JSON.stringify(key));
  }
  {
    ok(await enterBus(p, 'target markets'), 'reopened for the body header');
    ok(await section(p, 'Body 1'), 'a body paragraph opens');
    await openShape(p);
    const key = await p.$eval('.es-shape2key', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
    console.log('    causal body header:', JSON.stringify(key));
    ok(/state the relationship/i.test(key),
      'the body header names what the stage does, not which scaffold slot it is: ' + JSON.stringify(key));
  }

  // ==========================================================================
  console.log('11. one explanation at a time');
  // ==========================================================================
  // Individually every line in the panel earns its place. All of them at once is
  // the mini-lesson this panel exists not to be, and three of them explain the
  // same resolved-versus-student distinction.
  {
    const seen = () => p.evaluate(() => ({
      why: document.querySelectorAll('.es-shape2why').length,
      note: document.querySelectorAll('.es-slotnote').length,
      legend: document.querySelectorAll('.es-shape2legend').length,
      ex: document.querySelectorAll('.es-shapeex').length,
    }));
    const base = await seen();
    console.log('    base:', JSON.stringify(base));
    ok(base.why === 1 && base.note === 0 && base.ex === 0,
      'the base state is the frame, one explanation and the actions: ' + JSON.stringify(base));
    ok(base.legend === 0, 'and the colour key is not a third thing to read yet: ' + JSON.stringify(base));

    await p.$$eval('.es-shape2frame [data-esslot]', es => { const t = es.find(x => /^\[/.test(x.textContent)); t && t.click(); });
    await rf(p);
    const pressed = await seen();
    console.log('    slot pressed:', JSON.stringify(pressed));
    ok(pressed.note === 1, 'pressing a slot explains that slot');
    ok(pressed.why === 0, 'and replaces the general explanation rather than stacking on it');
    ok(pressed.legend === 1, 'the colour key appears where the student is investigating colours');

    await p.click('#esshapeex'); await rf(p);
    const withEx = await seen();
    console.log('    example open:', JSON.stringify(withEx));
    ok(withEx.ex === 1, 'the example opens');
    ok(withEx.why === 0 && withEx.note === 0,
      'and nothing else is explaining at the same time: ' + JSON.stringify(withEx));
    await p.click('#esshapeex'); await rf(p);
  }

  // ==========================================================================
  console.log('12. the family split works in the other direction too');
  // ==========================================================================
  // No judgement shapes are authored. The test is that the engine says so rather
  // than reaching for the nearest causal one, and that a judgement question is
  // still headed JUDGEMENT, which is correct for it.
  {
    ok(await enterBus(p, 'effectiveness of human resource'), 'the judgement question is reachable');
    const inIntro = await p.evaluate(() => {
      const d = document.querySelector('#esposdefer'); if (d) d.click();
      const t = [...document.querySelectorAll('.es-startrow')].find(x => /Introduction/i.test(x.textContent));
      if (t) { t.click(); return true; } return false; });
    await rf(p);
    if (inIntro) {
      const go = await p.$('#esstartwriting'); if (go) { await go.click(); await rf(p); }
      await openShape(p);
      const v2 = await p.$$eval('.es-shape2', es => es.length);
      const legacy = await p.$$eval('.es-shape', es => es.length);
      console.log('    judgement introduction: v2', v2, 'legacy', legacy);
      ok(v2 === 0, 'no causal shape is borrowed for a judgement introduction: ' + v2);
      ok(legacy > 0, 'the authored frames stand in instead: ' + legacy);
      const head = await p.$eval('.es-guideh', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
      ok(!/\boverall\b/i.test(await p.$eval('.es-shapes', e => e.textContent).catch(() => '')),
        'and they still carry no conclusion language: ' + JSON.stringify(head));
    } else { ok(false, 'the judgement introduction is reachable'); }
  }

  // ==========================================================================
  console.log('13. every frame resolves, in every variant');
  // ==========================================================================
  // A connector that does not resolve would put "{@lead}" in front of a student.
  {
    ok(await enterBus(p, 'target markets'), 'reopened for the frame sweep');
    ok(await section(p, 'Body 1'), 'a body paragraph opens');
    await openShape(p);
    await p.click('#esshapealts'); await rf(p);
    const frames = await p.$$eval('.es-altframe', es => es.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
    console.log('    ' + frames.map(f => '· ' + f).join('\n    '));
    ok(frames.length === 3, 'all three structures render: ' + frames.length);
    const raw = frames.filter(f => /\{@?[a-zA-Z0-9_-]+\}/.test(f));
    ok(raw.length === 0, 'none of them leaves a token unresolved: ' + JSON.stringify(raw));
    ok(!frames.some(f => /shape its/i.test(f)), 'and none of them uses the old construction');
  }

  // ==========================================================================
  console.log('14. mint means one thing, including on a legacy fallback');
  // ==========================================================================
  // A legacy frame carries no provenance, so every hole in it is the student's.
  // Drawing them in the resolved colour told an Evaluate student that "your
  // judgement" and "main reason" had already been supplied.
  {
    ok(await enterBus(p, 'effectiveness of human resource'), 'the judgement question is reachable');
    const inIntro = await p.evaluate(() => {
      const d = document.querySelector('#esposdefer'); if (d) d.click();
      const t = [...document.querySelectorAll('.es-startrow')].find(x => /Introduction/i.test(x.textContent));
      if (t) { t.click(); return true; } return false; });
    await rf(p);
    ok(inIntro, 'its introduction is reachable');
    const go = await p.$('#esstartwriting'); if (go) { await go.click(); await rf(p); }
    await openShape(p);
    const holes = await p.$$eval('.es-shape .es-hole', es => es.map(e => ({
      text: e.textContent.trim(), bg: getComputedStyle(e).backgroundColor })));
    console.log('    legacy holes:', JSON.stringify(holes.map(h => h.text)));
    ok(holes.length > 0, 'the fallback frames have holes in them: ' + holes.length);
    const asResolved = holes.filter(h => h.bg === REF.resolved);
    ok(asResolved.length === 0,
      'none of them is drawn as a value the app supplied: ' + JSON.stringify(asResolved.map(h => h.text)));
    ok(holes.every(h => h.bg === REF.student),
      'every one of them is drawn as the student\'s to write: ' + JSON.stringify(holes.map(h => h.bg).filter((v, i, a) => a.indexOf(v) === i)));
    // the exact placeholders that were mint before
    const named = ['your judgement', 'main reason', 'qualification', 'one side', 'the other side'];
    const seen = named.filter(n => holes.some(h => h.text.toLowerCase().indexOf(n) >= 0));
    ok(seen.length >= 3, 'the placeholders that were mint are on screen and checked: ' + JSON.stringify(seen));
    ok(holes.every(h => /^\[.*\]$/.test(h.text)), 'and each reads as a hole: ' + JSON.stringify(holes.map(h => h.text).slice(0, 3)));
  }

  console.log('pageerrors:', errs.length ? errs : 'none');
  ok(errs.length === 0, 'no page errors');
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
