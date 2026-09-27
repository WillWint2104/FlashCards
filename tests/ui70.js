// STATE 13 IN THE REAL APP: WHAT A REPORT WRITER SEES, AND WHAT THEIR MARKER IS SENT.
//
// tests/t35.mjs holds the contract. This holds the two things only a browser can
// see: the answering surface a student actually meets, and the marking request
// that actually leaves the page - and then feeds that captured request through the
// shipped worker's own intake and prompt builders, so the claim "the marker is
// told" is proven end to end rather than inferred from a payload.
//
// Before state 13 a report writer was shown the essay skeleton - introduction,
// body paragraphs, conclusion - under a note that the marker wanted "a sustained
// argument, not a list of points", while the question credits "a report structure
// with headings rather than continuous prose". The question's own instructions
// rendered nowhere. And the request carried nothing that said "report".
//
// The other half is what must NOT move. The extended response is state 12's
// format and it is frozen; its request is pinned here key by key, and measured
// against the pre-change build it was byte-identical (3243 bytes).
const { chromium, T } = require('./env');
const path = require('path');

const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL:', m); } };

const paper = require('./fixtures/bus-practice-paper.json');
const q14 = paper.sections[2].questions[0];
const q15 = paper.sections[3].questions[0];
// Every key the extended response's request carried before and after this change.
// A key appearing here is a change to what state 12's marker is told.
const EXT_KEYS = ['answer', 'bands', 'bandsSource', 'code', 'command', 'criteria', 'format', 'marks',
  'model_answer', 'prompt', 'responseType', 'stimulus', 'subject'];
// The report's request before state 13, captured from the pre-change build. It has
// no model_answer because q14 authors no model answer - the one 20-mark question in
// the paper without one, which the audit logged - so JSON drops the undefined key.
const REPORT_KEYS_BEFORE = EXT_KEYS.filter(k => k !== 'model_answer');

async function sit(b, section, answer) {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  let body = null;
  await p.route(/workers\.dev/, async r => {
    const s = JSON.parse(r.request().postData() || '{}');
    if (s.action === 'coach') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"nudges":[]}' });
    body = s;
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      summary: 'ok', score: 10, total: 10, max: 20, paragraphs: [], rubric: [], overall: { summary: 'ok' },
      criteria: [], next_steps: [], missing_vocabulary: [], checks: {} }) });
  });
  await p.goto(T + '?review=1'); await settled(p);
  await p.$$eval('.navtab', es => { const t = es.find(x => /Test mode/i.test(x.textContent)); t && t.click(); }); await settled(p);
  await p.$$eval('button, .area', es => { const t = es.find(x => /^Sit\b|Sit /i.test(x.textContent.trim())); t && t.click(); }); await settled(p);
  await p.click('text=Clear'); await settled(p);
  await p.$$eval('.exam-pick', (es, name) => { const t = es.find(x => x.textContent.includes(name)); t && t.click(); }, section); await settled(p);
  await p.click('text=Start'); await settled(p);
  const begin = await p.$('#exambegin'); if (begin) { await begin.click(); await settled(p); }
  const choose = await p.$('[data-examchoose="0"]'); if (choose) { await choose.click(); await settled(p); }
  const surface = await p.evaluate(() => {
    const q = document.querySelector('.exam-q');
    return {
      order: q ? [...q.children].map(e => e.className || e.tagName) : [],
      instructions: [...document.querySelectorAll('.exam-q .exam-instr')].map(e => e.textContent.trim()),
      shape: !!document.querySelector('.ansshape'),
      shapeRows: [...document.querySelectorAll('.ansshape .es-skellabel')].map(e => e.textContent.trim()),
      placeholder: (document.querySelector('#ans') || {}).placeholder || null,
    };
  });
  await p.fill('#ans', answer);
  await p.click('#check'); await settled(p);
  await p.waitForFunction(() => !!document.querySelector('#sheet .sheet'), null, { timeout: 8000 }).catch(() => {});
  await p.close();
  return { surface, body, errs };
}

(async () => {
  const W = await import('./worker.mjs');
  const b = await chromium.launch();

  // ---- the business report -----------------------------------------------
  console.log('--- sit the business report');
  const R = await sit(b, 'Section III - Business report',
    'Executive summary\nTidewater should consolidate its stores.\n\nRecommendations\nClose two stores and refit the warehouse.');
  const s = R.surface;
  ok(s.instructions.length === 1 && s.instructions[0] === q14.instructions,
     "the question's own instructions render, once and verbatim (UX-TEST-10): " + JSON.stringify(s.instructions));
  const iI = s.order.indexOf('exam-instr'), iH = s.order.indexOf('exam-qhead'), iS = s.order.indexOf('exam-source'), iP = s.order.indexOf('exam-prompt');
  ok(iH >= 0 && iI > iH && iS > iI && iP > iS,
     'under the question heading and ABOVE its case study, so "use the case study below" is true: ' + s.order.join(' > '));
  ok(!s.shape && s.shapeRows.length === 0,
     'no answer shape at all, rather than the essay skeleton (UX-TEST-09)');
  ok(/between sections/.test(s.placeholder) && !/paragraph/.test(s.placeholder),
     'the placeholder says sections, not paragraphs: ' + JSON.stringify(s.placeholder));

  const body = R.body || {};
  ok(!!R.body, 'a marking request went out');
  ok(body.format === 'business_report' && body.responseType === 'extended',
     'it says business_report and asks for the extended marker, as before');
  const acc = body.requirements && body.requirements.accomplish;
  const want = [q14.instructions].concat(q14.points);
  ok(Array.isArray(acc) && JSON.stringify(acc) === JSON.stringify(want),
     "requirements.accomplish carries the report's own words, instruction first, points in order (" + (acc || []).length + ')');
  ok(JSON.stringify(Object.keys(body).sort()) === JSON.stringify(REPORT_KEYS_BEFORE.concat('requirements').sort()),
     'and requirements is the only key the report request gained: ' + Object.keys(body).sort().join(','));

  // Through the shipped worker: its intake, then both prompt builders.
  const ctx = W.markingInput(body);
  const base = { subject: body.subject, prompt: body.prompt, command: body.command, marks: body.marks,
    responseType: ctx.responseType, requirements: ctx.requirements };
  const paras = String(body.answer).split(/\n\s*\n/).map((t, i) => `P${i + 1}: ${t}`).join('\n');
  const p1 = W.diagMessage(Object.assign({}, base, { validContent: ctx.validContent, plan: ctx.plan, response: paras, answer: body.answer }));
  const p2 = W.pass2Message(Object.assign({}, base, { criteria: body.criteria, bands: ctx.bands, bandsSource: ctx.bandsSource,
    stimulus: ctx.stimulus, blocks: ctx.blocks, reference: '', vocab: [], scaffold: '(none provided)', faults: '(none provided)',
    rubric: ctx.rubric, diagnosis: '(none)', offPathway: 0, response: paras }));
  ok(want.every(x => p1.includes(x)), 'the diagnosis pass is told all six, through the shipped worker');
  ok(want.every(x => p2.includes(x)), 'and so is the judging pass');
  ok(/report structure with headings/.test(p2),
     'including the point the audit was about, which the marker had never seen');
  ok(R.errs.length === 0, 'no page errors: ' + R.errs.join(' | '));

  // ---- the extended response, which must not have moved --------------------
  console.log('--- sit the extended response (state 12, frozen)');
  const E = await sit(b, 'Section IV - Extended response', 'A paragraph.\n\nAnother paragraph.');
  ok(E.surface.shape && JSON.stringify(E.surface.shapeRows) === JSON.stringify(['introduction', 'each body paragraph', 'conclusion']),
     'it still gets the essay shape, which is right for an essay');
  ok(/between paragraphs/.test(E.surface.placeholder), 'and the paragraphs placeholder');
  const eb = E.body || {};
  ok(JSON.stringify(Object.keys(eb).sort()) === JSON.stringify(EXT_KEYS),
     'its request carries exactly the keys it carried before: ' + Object.keys(eb).sort().join(','));
  ok(!('requirements' in eb), 'no requirements appear from nowhere');
  const flat = JSON.stringify(eb);
  ok((q15.points || []).every(pt => !flat.includes(typeof pt === 'string' ? pt : pt.text)),
     "none of its own marking points leak into the request: routing them is a separate decision");
  ok(eb.format === 'extended_response' && eb.responseType === 'extended', 'and it is still an extended response');
  ok(E.errs.length === 0, 'no page errors: ' + E.errs.join(' | '));

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
