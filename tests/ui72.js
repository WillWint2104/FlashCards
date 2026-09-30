// NO DEMO GRADES IN TEST MODE (UX-TEST-22), IN THE REAL APP.
//
// The rule, decision 20: in a sitting, a response without a valid marker result
// is unmarked, whatever the reason. The answer is kept, "Not marked yet" is shown
// where marking again can help, nothing is scored or judged, nothing enters a
// total, and it is not counted as answered. Study keeps its demo grade.
//
// Before this, an extended response or business report in a sitting got a demo
// grade whenever the marker could not be reached; any 200 without a real score
// became a marked zero; a 4xx or 5xx was reported as "could not be reached"; a
// short answer with no marking points was scored by a keyword heuristic; a reply
// that arrived after the student left could land in their next sitting; and
// "What would make this stronger" could replace an answer-key mark with a demo.
//
// Full tier only. Nothing here is added to fast or checkpoint (decision 20).
const { chromium, T } = require('./env');
const paper = require('./fixtures/bus-practice-paper.json');

const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

// A worker reply on the question's own mark scale, as the real worker sends one.
const REVIEW = (score, max) => ({ summary: 'The marker read this answer.', score, total: score, max,
  paragraphs: [{ name: 'Answer', score, max, reasons: [], sentences: [] }], rubric: [], overall: { summary: 'The marker read this answer.' },
  criteria: [], next_steps: [], missing_vocabulary: [], checks: {} });

// A page on the walkthrough build with a controllable marker. `mode.reply` is a
// function of the request returning 'abort', {status, body, delay} or a review.
async function open(b, seed) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.addInitScript(sd => {
    if (sd) localStorage.setItem('marginal.trial.v1', JSON.stringify(sd));
  }, seed || null);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  p.on('dialog', d => d.accept());
  const mode = { reply: () => 'abort', sent: [] };
  await p.route(/workers\.dev/, async r => {
    const s = JSON.parse(r.request().postData() || '{}');
    if (s.action === 'coach') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"nudges":[]}' });
    mode.sent.push(s);
    const out = mode.reply(s);
    if (out === 'abort') return r.abort();
    if (out && out.delay) await new Promise(res => setTimeout(res, out.delay));
    if (out && out.status) return r.fulfill({ status: out.status, contentType: 'application/json',
      body: typeof out.body === 'string' ? out.body : JSON.stringify(out.body || {}) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  await p.goto(T + '?review=1'); await settled(p);
  return { p, ctx, mode, errs };
}
async function sit(p, paperName, sectionName) {
  await p.$$eval('.navtab', es => { const t = es.find(x => /Test mode/i.test(x.textContent)); t && t.click(); }); await settled(p);
  await p.evaluate(n => {
    const r = [...document.querySelectorAll('.exam-row')].find(x => !n || x.textContent.includes(n)) || document.querySelector('.exam-row');
    r.querySelector('[data-examsit]').click();
  }, paperName || ''); await settled(p);
  if (sectionName) {
    await p.click('#exampicknone'); await settled(p);
    await p.$$eval('.exam-pick', (es, name) => { const t = es.find(x => x.textContent.includes(name)); t && t.click(); }, sectionName); await settled(p);
  }
  await p.click('#exampickgo'); await settled(p);
  const begin = await p.$('#exambegin'); if (begin) { await begin.click(); await settled(p); }
  const choose = await p.$('[data-examchoose="0"]'); if (choose) { await choose.click(); await settled(p); }
}
async function submit(p, text) {
  if (text != null) await p.fill('#ans', text);
  await p.evaluate(() => { const s = document.querySelector('#sheet'); if (s) s.innerHTML = ''; });
  await p.click('#check');
  await p.waitForFunction(() => !!(document.querySelector('#sheet') || {}).textContent, null, { timeout: 15000 }).catch(() => {});
  await settled(p);
}
async function remark(p) {
  await p.evaluate(() => { const s = document.querySelector('#sheet .sheet'); if (s) s.remove(); });
  await p.click('#examremark');
  await p.waitForFunction(() => !!document.querySelector('#sheet .sheet'), null, { timeout: 15000 }).catch(() => {});
  await settled(p);
}
const sheet = p => p.$eval('#sheet', e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
const bar = p => p.$eval('.exam-progress', e => e.textContent.trim()).catch(() => '');
const has = (p, sel) => p.$(sel).then(Boolean);
// Unmarked, in the sitting's words: no score, no judgement, answer still there.
async function unmarkedYet(p, n, why) {
  const s = await sheet(p);
  ok(/Not marked yet/.test(s) && why.test(s), n + ': not marked yet, and says why: ' + JSON.stringify(s.slice(0, 150)));
  ok(!/demo grade/i.test(s) && !/Structure detected/.test(s) && !/^\s*\d+\s*\//.test(s) && !/Not yet|Partly there|Most of it|Full marks/.test(s),
     n + ': no score and no judgement');
  ok(await has(p, '#examremark') && await has(p, '#examnext'), n + ': offers "Try marking again", and Continue still moves on');
  ok(!/—/.test(s), n + ': no em dash');
  const kept = await p.$eval('#ans', e => e.value).catch(() => '');
  ok(kept.length > 0, n + ': the answer is still in its box');
}

(async () => {
  const b = await chromium.launch();

  // ---- 1. each marker-dependent format, marker unreachable ----------------
  console.log('--- 1. unreachable marker: short answer, extended response, business report');
  for (const [n, sec, text] of [
    ['short answer 11(a)', 'Section II - Short answer', 'Speed. Customers wait too long at the vans in the morning peak.'],
    ['business report 14', 'Section III - Business report', 'Executive summary\nConsolidate.\n\nFindings\nOnline sales grew.'],
    ['extended response 15', 'Section IV - Extended response', 'A paragraph.\n\nAnother paragraph.'],
  ]) {
    const { p, ctx, mode, errs } = await open(b);
    await sit(p, '', sec);
    await submit(p, text);
    ok(mode.sent.length === 1, n + ': the marker was asked');
    await unmarkedYet(p, n, /could not be reached/);
    const br = await bar(p);
    ok(/^0\/\d+ answered · 0\/\d+ marks · 1 not marked$/.test(br), n + ': counted as not marked, not as answered, and adds nothing: ' + br);
    ok(!errs.length, n + ': no page errors ' + JSON.stringify(errs));
    await ctx.close();
  }

  // ---- 2. replies that are not marks, and a retry that is -----------------
  console.log('--- 2. a 200 that is not a mark stays unmarked; marking again replaces it with a real mark');
  {
    const { p, ctx, mode } = await open(b);
    await sit(p, '', 'Section III - Business report');
    const cases = [
      ['an empty object', { status: 200, body: {} }],
      ['an error body', { status: 200, body: { error: 'no', score: 5, max: 20 } }],
      ['a score above the scale', { status: 200, body: REVIEW(25, 20) }],
      ['a reply on a different scale', { status: 200, body: REVIEW(5, 10) }],
      ['a negative score', { status: 200, body: REVIEW(-1, 20) }],
      ['a bare number', { status: 200, body: '7' }],
      ['text that is not JSON', { status: 200, body: 'oops' }],
    ];
    let first = true;
    for (const [n, reply] of cases) {
      mode.reply = () => reply;
      if (first) { await submit(p, 'Executive summary\nConsolidate.\n\nFindings\nOnline sales grew.'); first = false; }
      else await remark(p);
      await unmarkedYet(p, n, /did not contain a mark|could not be read/);
    }
    ok(/^0\/1 answered · 0\/20 marks · 1 not marked$/.test(await bar(p)), 'none of them counted: ' + await bar(p));
    mode.reply = () => REVIEW(12, 20);
    await remark(p);
    const s = await sheet(p);
    ok(/^12\s*\/\s*20/.test(s) && !/not marked/i.test(s), 'Try marking again replaces the unmarked state with the marker\'s real mark: ' + s.slice(0, 60));
    ok(await bar(p) === '1/1 answered · 12/20 marks', 'and only now does it count, once: ' + await bar(p));
    ok(!(await has(p, '#examremark')), 'no "Try marking again" on a marked answer');
    await ctx.close();
  }

  // ---- 3. what the worker said, not "could not be reached" ----------------
  console.log('--- 3. statuses: busy and broken can be retried; a refused request cannot');
  for (const [n, status, retry, why] of [
    ['429', 429, true, /busy/], ['500', 500, true, /ran into a problem/], ['502', 502, true, /ran into a problem/],
    ['403', 403, false, /class's code/], ['400', 400, false, /would not accept/],
  ]) {
    const { p, ctx, mode } = await open(b);
    mode.reply = () => ({ status, body: { error: 'Slow down — try again in a few minutes.' } });
    await sit(p, '', 'Section IV - Extended response');
    await submit(p, 'A paragraph.\n\nAnother paragraph.');
    const s = await sheet(p);
    ok(why.test(s) && !/could not be reached/.test(s), n + ': says what happened: ' + s.slice(0, 140));
    ok(!/—/.test(s), n + ': the worker\'s own text, em dash and all, is not shown');
    ok((await has(p, '#examremark')) === retry, n + ': "Try marking again" ' + (retry ? 'offered' : 'not offered, because it cannot help'));
    ok(retry ? /Not marked yet/.test(s) : (/Not marked/.test(s) && !/Not marked yet/.test(s)), n + ': ' + (retry ? '"not marked yet"' : '"not marked", with nothing to wait for'));
    const ch = await p.$eval('#check', e => ({ disabled: e.disabled, label: e.textContent.trim() }));
    ok(!ch.disabled && !/Checking/.test(ch.label), n + ': the submit button comes back: ' + JSON.stringify(ch));
    ok(/1 not marked/.test(await bar(p)) && /^0\//.test(await bar(p)), n + ': not counted as answered');
    await ctx.close();
  }

  // ---- 4. results leave the unmarked answer out of the total, and say so ---
  console.log('--- 4. the results page');
  {
    const { p, ctx } = await open(b);
    await sit(p, '', 'Section III - Business report');
    await submit(p, 'Executive summary\nConsolidate.');
    await p.click('#examnext'); await settled(p);
    const big = await p.$eval('.bigscore', e => e.textContent.replace(/\s+/g, '')).catch(() => '');
    const txt = await p.$eval('.summary', e => e.textContent.replace(/\s+/g, ' ')).catch(() => '');
    ok(big === '0/20', 'the unmarked answer adds nothing, and the paper is still out of 20: ' + big);
    ok(/1 answer is not marked yet, so its marks are not in this total/.test(txt), 'the total says what it leaves out');
    ok(/not marked/.test(await p.$eval('.exam-results', e => e.textContent)), 'its row says not marked');
    await ctx.close();
  }

  // ---- 5. a reply that arrives after the student has left ----------------
  console.log('--- 5. a late reply does not land in the next sitting');
  {
    const { p, ctx, mode } = await open(b);
    mode.reply = () => Object.assign(REVIEW(15, 20), { delay: 2500 });
    await sit(p, '', 'Section III - Business report');
    await p.fill('#ans', 'Executive summary\nConsolidate.');
    await p.click('#check'); await settled(p);
    await p.click('#examquit'); await settled(p);
    await sit(p, '', 'Section III - Business report');
    await p.waitForTimeout(3500); await settled(p);
    ok(await bar(p) === '0/1 answered · 0/20 marks', 'the new sitting is untouched by the old reply: ' + await bar(p));
    ok(!(await p.$('#sheet .sheet')), 'and no sheet appears on the new question');
    await ctx.close();
  }

  // ---- 6. a short answer with no marking points goes to the marker --------
  console.log('--- 6. no points: the marker, not a keyword estimate');
  {
    const bare = JSON.parse(JSON.stringify(paper));
    bare.name = 'No points paper';
    const part = bare.sections[1].questions[0].parts[0];
    delete part.points; delete part.model;
    const seed = { cards: {}, endpoint: '', code: '12Ec126', log: [], customSets: [], lessons: {},
      exams: [Object.assign({}, bare, { id: 'no-points' })] };
    const { p, ctx, mode } = await open(b, seed);
    await sit(p, 'No points paper', 'Section II - Short answer');
    await submit(p, 'Speed, because customers wait at the vans.');
    ok(mode.sent.length === 1 && mode.sent[0].responseType === 'short', 'it is sent to the marker as a short answer: ' + mode.sent.length);
    await unmarkedYet(p, 'the unreachable marker', /could not be reached/);
    mode.reply = () => REVIEW(1, 2);
    await remark(p);
    ok(/^1\s*\/\s*2/.test(await sheet(p)), 'and the mark is the marker\'s: ' + (await sheet(p)).slice(0, 40));
    await ctx.close();
  }

  // ---- 7. "What would make this stronger" keeps the answer-key mark -------
  console.log('--- 7. a failed second opinion never replaces a mark');
  {
    const keyed = JSON.parse(JSON.stringify(paper));
    keyed.name = 'Phrased points paper';
    const part = keyed.sections[1].questions[0].parts[0];
    part.points = [{ text: 'Names speed as the objective', marks: 1, need: ['speed'] },
                   { text: 'Links it to the waiting times', marks: 1, need: ['wait'] }];
    const seed = { cards: {}, endpoint: '', code: '12Ec126', log: [], customSets: [], lessons: {},
      exams: [Object.assign({}, keyed, { id: 'phrased' })] };
    const { p, ctx, mode } = await open(b, seed);
    await sit(p, 'Phrased points paper', 'Section II - Short answer');
    await submit(p, 'Speed, because customers wait too long.');
    ok(mode.sent.length === 0 && /^2\s*\/\s*2/.test(await sheet(p)), 'scored from its authored phrasings, without the marker: ' + (await sheet(p)).slice(0, 30));
    ok(await has(p, '#examreview'), 'and the second-opinion door is offered');
    await p.click('#examreview');
    await p.waitForFunction(() => { const b = document.querySelector('#examreview'); return b && !b.disabled; }, null, { timeout: 15000 }).catch(() => {});
    await settled(p);
    const s = await sheet(p);
    ok(/^2\s*\/\s*2/.test(s) && !/demo grade/i.test(s), 'the unreachable marker leaves the 2/2 in place, with no demo grade over it: ' + s.slice(0, 60));
    ok(await bar(p) === '1/8 answered · 2/40 marks', 'and the bar is unchanged: ' + await bar(p));
    await ctx.close();
  }

  // ---- 8. Study keeps its demo grade -------------------------------------
  // The demo is Study's, on purpose, and its wording is format-aware (UX-TEST-15):
  // sections for a report, paragraphs for an extended response. This is where
  // that wording is pinned now that no sitting shows it.
  console.log('--- 8. Study mode still demo-grades, in the format\'s own words');
  for (const [n, card, want, never] of [
    ['a business report card', { id: 'rep1', type: 'essay', command: 'Report', marks: 20, prompt: 'Recommend strategies a retailer could use to respond to growing online sales.', model: 'A model report.', vocab: [] },
      /section\(s\)/, /paragraph/i],
    ['an extended response card', { id: 'ext1', type: 'essay', marks: 20, prompt: 'Evaluate the effectiveness of a marketing strategy.', model: 'A model answer.', vocab: [] },
      /4 to 5 paragraphs/, /section\(s\)/],
  ]) {
    const seed = { cards: {}, endpoint: '', code: '12Ec126', log: [], lessons: {},
      customSets: [{ id: 'custom-x', name: 'Practice set', cards: [card] }],
      exams: [Object.assign({}, paper, { id: 'walk-2025-bus' })] };
    const { p, ctx } = await open(b, seed);
    await p.click('[data-open="custom-x"]'); await settled(p);
    await p.$$eval('.mode', es => { const m = es.find(x => /Long answer/.test(x.textContent)); m && m.click(); }); await settled(p);
    await p.fill('#ans', 'Executive summary\nThe retailer should consolidate.\n\nFindings\nOnline sales are growing.');
    await p.click('#check');
    await p.waitForFunction(() => !!document.querySelector('#sheet .sheet'), null, { timeout: 15000 }).catch(() => {});
    const s = await sheet(p);
    ok(/demo grade/i.test(s) && /^\d+\s*\/\s*20/.test(s), n + ': Study still gives its demo grade: ' + s.slice(0, 60));
    ok(want.test(s) && !never.test(s), n + ': in its own format\'s words');
    await ctx.close();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
