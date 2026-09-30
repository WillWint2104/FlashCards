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
// And the request now carries what the question authored for its marker: the
// report's case study (UX-TEST-11), its format through both passes, and - for the
// extended response too - its own marking points (UX-TEST-12). The extended
// response's request is therefore NOT byte-identical to state 12's any more, on
// purpose: it gained exactly one field, requirements, carrying its four points,
// and this suite pins that it gained nothing else.
const { chromium, T } = require('./env');
const path = require('path');

const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL:', m); } };

const paper = require('./fixtures/bus-practice-paper.json');
const PAPER = require('../tools/contract/exam.js');
const q14 = paper.sections[2].questions[0];
const q15 = paper.sections[3].questions[0];
// Every key the extended response's request carried BEFORE state 13. A key
// appearing beyond these is a change to what state 12's marker is told, and the
// only one allowed is requirements, carrying its own authored points.
const EXT_KEYS = ['answer', 'bands', 'bandsSource', 'code', 'command', 'criteria', 'format', 'marks',
  'model_answer', 'prompt', 'responseType', 'stimulus', 'subject'];
// The report's request before state 13, captured from the pre-change build. It has
// no model_answer because q14 authors no model answer - the one 20-mark question in
// the paper without one, which the audit logged - so JSON drops the undefined key.
const REPORT_KEYS_BEFORE = EXT_KEYS.filter(k => k !== 'model_answer');

async function sit(b, section, answer, storedPaper, unreachable) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  // A paper already in a student's storage is not re-validated when it is sat, so
  // a paper saved before the validator learned a rule reaches the runtime whatever
  // the validator now says. Seeded exactly as tests/mkwalk.py seeds, before boot.
  if (storedPaper) await ctx.addInitScript(sp => {
    localStorage.setItem('marginal.trial.v1', JSON.stringify({ cards: {}, endpoint: '', code: '12Ec126', log: [],
      customSets: [], lessons: {}, exams: [Object.assign({}, sp, { id: 'walk-2025-bus' })] }));
  }, storedPaper);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  let body = null;
  await p.route(/workers\.dev/, async r => {
    const s = JSON.parse(r.request().postData() || '{}');
    if (s.action === 'coach') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"nudges":[]}' });
    body = s;
    // The degraded path: the marker cannot be reached. In Test Mode that leaves
    // the answer unmarked (UX-TEST-22); it used to grade a demo.
    if (unreachable) return r.abort();
    // The worker's own reply shape: a score on the question's own mark scale. A
    // reply out of 20 for a 2-mark question is not a mark and is refused now.
    const mk = Math.round(Number(s.marks)) || 20, sc = Math.min(10, mk);
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      summary: 'ok', score: sc, total: sc, max: mk, paragraphs: [], rubric: [], overall: { summary: 'ok' },
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
  await p.waitForFunction(() => !!(document.querySelector('#sheet') || {}).textContent, null, { timeout: 8000 }).catch(() => {});
  const sheet = await p.$eval('#sheet', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
  await p.close();
  return { surface, body, errs, sheet };
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
  ok(JSON.stringify(Object.keys(body).sort()) === JSON.stringify(REPORT_KEYS_BEFORE.concat('requirements', 'stimulusContext').sort()),
     'and requirements and the source material are the only keys it gained: ' + Object.keys(body).sort().join(','));
  // THE CASE STUDY, exactly as the contract builds it from what was authored.
  const sc = PAPER.sourceContext([{ stimulus: paper.sections[2].source }, q14]);
  ok(body.stimulusContext === sc.text, 'the case study travels exactly as the contract builds it (' + (body.stimulusContext || '').length + ' characters)');
  ok(body.stimulusContext.includes(q14.stimulus.text) && /2022: 250[\s\S]*2025: 700/.test(body.stimulusContext),
     'its text verbatim, and its chart as the four values the bars read to');
  ok(body.stimulus === true, 'and the stimulus flag still says there was one');

  // Through the shipped worker: its intake, then both prompt builders.
  const ctx = W.markingInput(body);
  const base = { subject: body.subject, prompt: body.prompt, command: body.command, marks: body.marks,
    responseType: ctx.responseType, format: ctx.format, stimulusContext: ctx.stimulusContext, requirements: ctx.requirements };
  const paras = String(body.answer).split(/\n\s*\n/).map((t, i) => `P${i + 1}: ${t}`).join('\n');
  const p1 = W.diagMessage(Object.assign({}, base, { validContent: ctx.validContent, plan: ctx.plan, response: paras, answer: body.answer }));
  const p2 = W.pass2Message(Object.assign({}, base, { criteria: body.criteria, bands: ctx.bands, bandsSource: ctx.bandsSource,
    stimulus: ctx.stimulus, blocks: ctx.blocks, reference: '', vocab: [], scaffold: '(none provided)', faults: '(none provided)',
    rubric: ctx.rubric, diagnosis: '(none)', offPathway: 0, response: paras }));
  ok(want.every(x => p1.includes(x)), 'the diagnosis pass is told all six, through the shipped worker');
  ok(want.every(x => p2.includes(x)), 'and so is the judging pass');
  ok(/report structure with headings/.test(p2),
     'including the point the audit was about, which the marker had never seen');
  for (const [n, msg] of [['the diagnosis pass', p1], ['the judging pass', p2]]) {
    ok(/RESPONSE TYPE: business report/.test(msg) && !/extended response/.test(msg),
       `${n} is told it is a business report, never an extended response`);
    ok(/QUESTION \(recommend\)/.test(msg), `${n} carries the directive, recommend, separately`);
    ok(msg.includes(q14.stimulus.text) && /2025: 700/.test(msg), `${n} is given the case study and the chart's values`);
  }
  ok(R.errs.length === 0, 'no page errors: ' + R.errs.join(' | '));

  // ---- UX-TEST-18: a short answer's weighted points go to the marker --------
  // 11(a) authors two one-mark points and no phrasings to match them with. It
  // used to be scored locally by searching the answer for each point's own
  // description, so a full, correct answer scored 0/2.
  console.log('--- sit 11(a), whose weighted points author no phrasings');
  const A11 = 'Speed. Customers at the vans wait too long in the 7am to 9am morning peak, so the vans are not serving orders quickly enough.';
  const S = await sit(b, 'Section II - Short answer', A11);
  const sb = S.body || {};
  ok(!!S.body && sb.answer === A11, "11(a) goes to the marker rather than being scored against its points' descriptions");
  const pts11 = (sb.requirements || {}).accomplish || [];
  ok(pts11.length === 2 && pts11[0] === 'Names speed, or dependability, as the objective (1 mark)',
     'its points travel as marking requirements, with their authored weights: ' + JSON.stringify(pts11));
  ok(/^\s*2\s*\/\s*2/.test(S.sheet) && !/key points addressed/.test(S.sheet),
     "the mark is the marker's, and no tick or miss is inferred from a point's description: " + S.sheet.slice(0, 80));
  const U = await sit(b, 'Section II - Short answer', A11, null, true);
  ok(/could not be reached/.test(U.sheet) && !/demo grade/i.test(U.sheet) && !/^\s*\d+\s*\//.test(U.sheet),
     'an unreachable marker leaves it unmarked: no demo grade, no zero: ' + U.sheet.slice(0, 120));
  ok(!S.errs.length && !U.errs.length, 'no page errors: ' + JSON.stringify(S.errs.concat(U.errs)));

  // ---- the extended response, which must not have moved --------------------
  console.log('--- sit the extended response (state 12, re-verified)');
  const E = await sit(b, 'Section IV - Extended response', 'A paragraph.\n\nAnother paragraph.');
  ok(E.surface.shape && JSON.stringify(E.surface.shapeRows) === JSON.stringify(['introduction', 'each body paragraph', 'conclusion']),
     'it still gets the essay shape, which is right for an essay');
  ok(/between paragraphs/.test(E.surface.placeholder), 'and the paragraphs placeholder');
  const eb = E.body || {};
  // Printed so the figure in the docs is one a re-run reproduces.
  console.log('    extended request for q15:', JSON.stringify(eb).length, 'bytes');
  ok(JSON.stringify(Object.keys(eb).sort()) === JSON.stringify(EXT_KEYS.concat('requirements').sort()),
     'its request gained one key, requirements, and nothing else: ' + Object.keys(eb).sort().join(','));
  const q15pts = (q15.points || []).map(pt => typeof pt === 'string' ? pt : pt.text);
  ok(eb.requirements && JSON.stringify(eb.requirements.accomplish) === JSON.stringify(q15pts),
     'carrying its own four marking points, which used to reach nothing (UX-TEST-12)');
  ok(!('stimulusContext' in eb) && !('instructions' in eb), 'and no source it was not given, and no instructions');
  {
    const c = W.markingInput(eb);
    const m2 = W.pass2Message({ subject: eb.subject, prompt: eb.prompt, command: eb.command, marks: eb.marks,
      responseType: c.responseType, format: c.format, stimulusContext: c.stimulusContext, requirements: c.requirements,
      criteria: eb.criteria, bands: c.bands, stimulus: c.stimulus, blocks: [], reference: '', vocab: [], scaffold: '',
      faults: '', diagnosis: '', offPathway: 0, response: 'P1: x' });
    ok(/RESPONSE TYPE: extended response/.test(m2) && q15pts.every(x => m2.includes(x)),
       'its marker is still told it is an extended response, and is now given its points');
  }
  ok(eb.format === 'extended_response' && eb.responseType === 'extended', 'and it is still an extended response');
  ok(E.errs.length === 0, 'no page errors: ' + E.errs.join(' | '));

  // ---- a stored paper the validator would now refuse -----------------------
  //
  // q14 with an instruction and ten points is eleven items, and the worker keeps
  // ten. The runtime refusal is the only thing between that paper and a report
  // marked against the first ten pieces of its own guidance.
  console.log('--- a stored report over the marker\'s budget, and an extended response with its own instructions');
  const over = JSON.parse(JSON.stringify(paper));
  over.sections[2].questions[0].points = Array.from({ length: 10 }, (_, i) => 'Point ' + (i + 1));
  over.sections[3].questions[0].instructions = 'Refer to the stimulus in your answer.';
  const O = await sit(b, 'Section III - Business report', 'Executive summary\nA report.', over);
  ok(O.body === null, 'the over-budget report is NOT sent to the marker at all');
  ok(/not marked/i.test(O.sheet) && /marking guidance/.test(O.sheet) && /10/.test(O.sheet),
     'and the student is told why, in words: ' + JSON.stringify(O.sheet.slice(0, 160)));
  ok(!/\u2014/.test(O.sheet), 'with no em dash in what they read');
  ok(O.errs.length === 0, 'no page errors: ' + O.errs.join(' | '));
  // State 12 is frozen, so an extended response's own instructions render nowhere,
  // exactly as before: they are not sent to its marker either, and showing a
  // student a line their marker never reads is the mismatch this avoids.
  const X = await sit(b, 'Section IV - Extended response', 'A paragraph.\n\nAnother paragraph.', over);
  ok(X.surface.instructions.length === 0,
     "an extended response's own instructions do not render: its surface is state 12's, unchanged");
  ok(!JSON.stringify(X.body || {}).includes('Refer to the stimulus'),
     'and they are not sent to its marker');
  ok(JSON.stringify(Object.keys(X.body || {}).sort()) === JSON.stringify(EXT_KEYS.concat('requirements').sort()),
     'its request carries the same keys as the extended response above');

  // ---- the degraded path speaks the format's language (UX-TEST-15) ----------
  // NO DEMO GRADE IN TEST MODE (UX-TEST-22). This section used to assert the
  // demo grade's wording here, in a sitting. A sitting now leaves the answer
  // unmarked, and the demo wording (sections for a report, paragraphs for an
  // extended response) is pinned where it still runs, in Study: tests/ui72.js.
  console.log('--- the marker cannot be reached: not marked yet, in a sitting');
  const D = await sit(b, 'Section III - Business report', 'Executive summary\nA report.\n\nFindings\nMore.', null, true);
  const DE = await sit(b, 'Section IV - Extended response', 'A paragraph.\n\nAnother paragraph.', null, true);
  [['the business report', D], ['the extended response', DE]].forEach(([n, x]) => {
    ok(/Not marked yet/.test(x.sheet) && /could not be reached/.test(x.sheet),
       n + ' is not marked yet: ' + JSON.stringify(x.sheet.slice(0, 120)));
    ok(!/demo grade/i.test(x.sheet) && !/Structure detected/.test(x.sheet) && !/^\s*\d+\s*\//.test(x.sheet),
       n + ' gets no demo grade and no score');
    ok(/Try marking again/.test(x.sheet) && !/\u2014/.test(x.sheet), n + ' offers marking again, with no em dash');
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
