// REVIEW & SUBMIT, IN THE REAL APP (Slice B, state 1; decisions 23 and 24).
//
// The page is frozen (docs/mockups/04-submit.html). What this proves is that the
// app keeps its decisions:
//
//   - the last question and the navigator say Review & submit (Review & finish),
//     and open the page without submitting anything; only Submit paper (Finish
//     practice) closes the attempt;
//   - an attempt nothing was submitted from cannot be closed, and says so;
//   - the page reads ATT.report: its table adds up to the attempt, an unchosen
//     either/or is one requirement, flags are listed and never block;
//   - a marking request still out blocks, until it lands or Leave it unmarked:
//       a first submission is then submitted, not marked, and its late reply
//       is ignored;
//       a resubmission keeps its earlier mark, for the version it was given for,
//       and the sitting says the mark is for that earlier version;
//   - a pending second opinion does not block, and its late reply is ignored;
//   - a closed attempt's unmarked answers stay unmarked: no Try marking again;
//   - a practice session closes through the same page, with its own verbs.
//
// Full tier only (decision 23: no new browser coverage on checkpoint).
const { chromium, T } = require('./env');
const paper = require('./fixtures/bus-practice-paper.json');

const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const REVIEW = (score, max) => ({ summary: 'The marker read this answer.', score, total: score, max,
  paragraphs: [{ name: 'Answer', score, max, reasons: [], sentences: [] }], rubric: [], overall: { summary: 'The marker read this answer.' },
  criteria: [], next_steps: [], missing_vocabulary: [], checks: {} });

async function open(b, seed) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(sd => { if (sd && !localStorage.getItem('marginal.trial.v1')) localStorage.setItem('marginal.trial.v1', JSON.stringify(sd)); }, seed || null);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const dialogs = []; p.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  const mode = { reply: () => 'abort', sent: [] };
  await p.route(/workers\.dev/, async r => {
    const s = JSON.parse(r.request().postData() || '{}');
    if (s.action === 'coach') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"nudges":[]}' });
    mode.sent.push(s);
    const out = mode.reply(s);
    if (out === 'abort') return r.abort();
    if (out && out.delay) await new Promise(res => setTimeout(res, out.delay));
    if (out && out.status) return r.fulfill({ status: out.status, contentType: 'application/json', body: JSON.stringify(out.body || {}) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  await p.goto(T + '?review=1'); await settled(p);
  return { p, ctx, mode, errs, dialogs };
}
const has = (p, sel) => p.$(sel).then(Boolean);
const text = (p, sel) => p.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
const qhead = p => text(p, '.exam-qhead');
const stored = p => p.evaluate(() => JSON.parse(localStorage.getItem('marginal.trial.v1') || '{}').attempts || {});
const current = async p => { const at = await stored(p); const k = Object.keys(at).find(x => at[x] && at[x].current); return k ? { key: k, a: at[k].current, rec: at[k] } : null; };
async function toTest(p) { await p.$$eval('.navtab', es => es.find(x => /Test mode/i.test(x.textContent)).click()); await settled(p); }
async function sit(p, name, sections) {
  await toTest(p);
  await p.evaluate(n => { const c = [...document.querySelectorAll('.tm-paper')].find(x => !n || x.textContent.includes(n)) || document.querySelector('.tm-paper'); c.querySelector('[data-tmopen]').click(); }, name || '');
  await settled(p);
  if (await has(p, '#tmstartagain')) { await p.click('#tmstartagain'); await settled(p); }
  if (sections) { await p.click('#exampicknone'); await settled(p); await p.$$eval('.tm-row', (es, ss) => es.filter(x => ss.some(s => x.textContent.includes(s))).forEach(x => x.click()), sections); await settled(p); }
  await p.click('#exampickgo'); await settled(p);
}
async function navTo(p, label) {
  await p.click('#examnav'); await settled(p);
  await p.evaluate(l => {
    const m = /^(\d+)\(([a-z]+)\)$/.exec(l);
    const name = c => c.textContent.replace(/[✓⚑()\s]/g, '');
    const t = [...document.querySelectorAll('[data-tmnav]')].find(c => m ? name(c) === m[2] && new RegExp('Question ' + m[1] + '\\b').test((c.closest('.tm-pblock') || { querySelector: () => ({ textContent: '' }) }).querySelector('.pbh b').textContent) : name(c) === 'Q' + l);
    t && t.click();
  }, label);
  await settled(p);
}
async function submit(p, answer) {
  if (answer != null) await p.fill('#ans', answer);
  await p.click('#check');
  await p.waitForFunction(() => !!document.querySelector('#sheet .tm-result') && !/Checking/.test((document.querySelector('#check') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
  await settled(p);
}
const review = async p => { await p.click('#examnav'); await settled(p); await p.click('#tmnavreview'); await settled(p); };
const rows = p => p.$$eval('.tm-tally tbody tr, .tm-tally tfoot tr', es => es.map(e => [...e.children].map(c => c.textContent.replace(/\s+/g, ' ').trim())));

(async () => {
  const b = await chromium.launch();

  console.log('--- 1. honest verbs, and nothing submitted means nothing to close');
  {
    const { p, ctx, errs, dialogs } = await open(b);
    await sit(p, '', null);
    await p.click('#examnav'); await settled(p);
    ok(/Review & submit/.test(await text(p, '#tmnavreview')), 'the navigator offers Review & submit');
    await p.keyboard.press('Escape'); await settled(p);
    await navTo(p, '10');
    for (let i = 0; i < 30 && !(await has(p, '#examfinish')); i++) { await p.click('#examnext'); await settled(p); }
    ok((await text(p, '#examfinish')) === 'Review & submit', 'the last question says Review & submit, not Submit paper: ' + await text(p, '#examfinish'));
    await p.click('#examfinish'); await settled(p);
    ok(await has(p, '#tmreview') && (await text(p, '#tmreview h1')) === 'Submit paper', 'it opens the page, titled Submit paper');
    ok((await current(p)) && !(await current(p)).rec.last, 'and nothing has been submitted or closed by opening it');
    ok(/Nothing has been submitted yet/.test(await text(p, '#tmrdh')) && /Answer at least one question before ending this attempt/.test(await text(p, '#tmreview')),
       'with nothing submitted, the page says so');
    ok(!(await has(p, '#tmsubmitpaper')) && await has(p, '#tmbacktoq'), 'and offers Back to questions, not Submit paper');
    await p.click('#tmbacktoq'); await settled(p);
    ok(await has(p, '#examquit') && /15 or 16|Section IV/.test(await qhead(p)), 'Back to questions returns to the question the student was on: ' + await qhead(p));
    ok(!errs.length && !dialogs.length, 'no page errors and no dialogs ' + JSON.stringify(errs.concat(dialogs)));
    await ctx.close();
  }

  console.log('--- 2. the page reads ATT.report; routes back; a closed attempt stays as it is');
  {
    const { p, ctx, mode, errs } = await open(b);
    mode.reply = () => ({ status: 503, body: {} });
    await sit(p, '', null);
    await p.click('.choice'); await p.click('#check'); await settled(p);         // Q1, marked from its key
    await p.click('#examnext'); await settled(p); await p.click('#examflag'); await settled(p);   // flag Q2, unanswered
    await navTo(p, '11(a)');
    await submit(p, 'Speed. Customers wait too long at the vans in the morning.');   // the marker fails: not marked
    await review(p);
    const t = await rows(p);
    const live = await p.evaluate(() => {
      const at = JSON.parse(localStorage.getItem('marginal.trial.v1')).attempts, k = Object.keys(at).find(x => at[x].current);
      const st = JSON.parse(localStorage.getItem('marginal.trial.v1'));
      const r = window.MarginalAttempts.report(at[k].current, st.exams, []);
      return { m: r.rows.marked.count, nm: r.rows.notMarked.count, na: r.rows.notAnswered.count, total: r.total, max: r.max, got: r.got };
    });
    ok(t[0][1] === String(live.m) && t[1][1] === String(live.nm) && t[2][1] === String(live.na), 'the table is ATT.report: ' + JSON.stringify(t.slice(0, 3).map(r => r[1])) + ' ' + JSON.stringify(live));
    ok(live.m + live.nm + live.na === live.total && t[3][1] === String(live.total) && t[3][2] === live.max + ' marks', 'and adds up to the attempt: ' + JSON.stringify(t[3]));
    ok(t[1][3] === 'Not marked' && t[2][3] === 'None', 'a marker failure reads Not marked, never 0, and not answered reads None');
    const slot = await p.$$eval('#tmg-na li', es => es.filter(e => /Question 15 or 16/.test(e.textContent)).map(e => e.textContent.replace(/\s+/g, ' ')));
    ok(slot.length === 1 && /Answer one of these, not both\. It counts as one question\./.test(slot[0]), 'the either/or is one requirement: ' + JSON.stringify(slot));
    ok(/Question 2\b/.test(await text(p, '#tmg-fl')) && !(await p.$eval('#tmsubmitpaper', e => e.disabled)), 'a flag is listed and does not block');
    ok(/marking it again can help/.test(await text(p, '#tmg-nm')) && /could not finish|ran into a problem/.test(await text(p, '#tmg-nm')), 'the not-marked answer says why, in the app\'s words, and what can help');
    await p.$$eval('#tmg-nm [data-tmreviewgo]', es => es[0].click()); await settled(p);
    ok(/11\(a\)/.test(await qhead(p)) && await has(p, '#examremark'), 'its route lands on 11(a), where it can be marked again');
    await review(p);
    await p.click('#tmsubmitpaper'); await settled(p);
    const after = await stored(p), rec = after[Object.keys(after)[0]];
    ok(!rec.current && rec.last && rec.last.completedAt, 'Submit paper closes the attempt');
    const res = await text(p, '#app');
    ok(!(await has(p, '#examremark')) && !/Try marking again/.test(res) && /1 answer is not marked, so its marks/.test(res) && !/not marked yet/.test(res),
       'the closed attempt\'s unmarked answer stays unmarked: no Try marking again, and no "yet" (decision 24)');
    ok(!errs.length, 'no page errors ' + JSON.stringify(errs));
    await ctx.close();
  }

  console.log('--- 3. marking in flight blocks; Leave it unmarked on a first submission');
  {
    const { p, ctx, mode } = await open(b);
    mode.reply = () => Object.assign(REVIEW(3, 3), { delay: 3000 });
    await sit(p, '', ['Section II']);
    await navTo(p, '11(b)');
    await p.fill('#ans', 'Casual operators have no guaranteed hours, so they leave for steadier work.');
    await p.click('#check'); await settled(p);
    await review(p);
    ok(/11\(b\) is still being marked/.test(await text(p, '#tmbusy')) && await p.$eval('#tmsubmitpaper', e => e.disabled), 'an answer being marked blocks, and says so');
    ok(/submitted without a mark/.test(await text(p, '#tmbusy')), 'Leave it unmarked spells out its consequence');
    await p.click('[data-tmleave="1-0-1"]'); await settled(p);
    ok(!(await has(p, '#tmbusy')) && !(await p.$eval('#tmsubmitpaper', e => e.disabled)), 'left unmarked, nothing blocks');
    ok((await p.evaluate(() => document.activeElement && document.activeElement.id)) === 'tmsubmitpaper', 'and focus moves to Submit paper, the next thing to do');
    ok(/Submitting closes this attempt/.test(await text(p, '#tmlive')), 'the change is announced from a region that outlives the redraw: ' + JSON.stringify(await text(p, '#tmlive')));
    ok(/11\(b\)/.test(await text(p, '#tmg-nm')) && /chose not to wait/.test(await text(p, '#tmg-nm')), 'and it is listed as submitted, not marked');
    await p.waitForTimeout(3500); await settled(p);
    const c = await current(p);
    ok(c.a.results['1-0-1'] && c.a.results['1-0-1'].code === 'MARKING_LEFT' && c.a.results['1-0-1'].outcome !== 'success',
       'the late reply is ignored: ' + JSON.stringify(c.a.results['1-0-1'] && { code: c.a.results['1-0-1'].code, score: c.a.results['1-0-1'].score }));
    ok(/11\(b\)/.test(await text(p, '#tmg-nm')), 'and the page still shows it not marked');
    await ctx.close();
  }
  {
    // The same words sent again after Leave it unmarked are a new request: the
    // abandoned one's reply (here a failure, arriving first) is not taken for it.
    const { p, ctx, mode } = await open(b);
    let n = 0;
    mode.reply = () => ++n === 1 ? { status: 503, body: {}, delay: 2500 } : Object.assign(REVIEW(3, 3), { delay: 4000 });
    await sit(p, '', ['Section II']);
    await navTo(p, '11(b)');
    const SAME = 'Casual operators have no guaranteed hours, so they leave for steadier work.';
    await p.fill('#ans', SAME); await p.click('#check'); await settled(p);
    await review(p);
    await p.click('[data-tmleave="1-0-1"]'); await settled(p);
    await p.$$eval('#tmg-nm [data-tmreviewgo]', es => es.find(e => /11\(b\)/.test(e.textContent)).click()); await settled(p);
    ok((await p.$eval('#ans', e => e.value)) === SAME && await has(p, '#examremark'), 'back on 11(b), the same words can be marked again');
    await p.click('#examremark'); await settled(p);
    await p.waitForTimeout(5000); await settled(p);
    const c = await current(p);
    ok(c.a.results['1-0-1'] && c.a.results['1-0-1'].score === 3 && c.a.results['1-0-1'].outcome === 'success',
       'the retry\'s own mark lands, and the abandoned request\'s failure is ignored: ' + JSON.stringify(c.a.results['1-0-1'] && c.a.results['1-0-1'].code));
    await ctx.close();
  }

  console.log('--- 4. a resubmission left unmarked keeps its mark, for the version it was given for');
  {
    const { p, ctx, mode } = await open(b);
    mode.reply = () => REVIEW(2, 2);
    await sit(p, '', ['Section II']);
    const OLD = 'Speed. Customers wait too long at the vans in the morning peak.', NEW = 'Speed, and a second version that the marker never saw.';
    await submit(p, OLD);
    await p.click('#examretry'); await settled(p);
    mode.reply = () => Object.assign(REVIEW(1, 2), { delay: 3000 });
    await p.fill('#ans', NEW); await p.click('#check'); await settled(p);   // sent; its reply is still out
    await review(p);
    ok(/earlier mark of 2 of 2 marks stands, for the version it was given for/.test(await text(p, '#tmbusy')), 'the notice says the earlier mark stands, for its own version');
    await p.click('[data-tmleave="1-0-0"]'); await settled(p);
    await p.waitForTimeout(3500); await settled(p);
    const c = await current(p);
    ok(c.a.results['1-0-0'].score === 2 && c.a.answers['1-0-0'] === OLD && c.a.drafts['1-0-0'] === NEW,
       'the mark and the version it was given for are kept, apart from the newer text, and the late reply is ignored');
    ok(/stands, for the version it was given for/.test(await text(p, '#tmg-ch')), 'Changed after marking says which version the mark is for');
    await p.$$eval('#tmg-ch [data-tmreviewgo]', es => es[0].click()); await settled(p);
    ok((await p.$eval('#ans', e => e.value)) === NEW, 'the sitting opens on the newer text');
    ok(/That mark is for the version you submitted earlier, not the text in the box/.test(await text(p, '.tm-earlier')) && !(await has(p, '#sheet .tm-result')),
       'and says the mark is for the earlier version, rather than showing it under the new text');
    await p.click('.tm-earlierv summary'); await settled(p);
    ok((await text(p, '.tm-earliertext')) === OLD, 'the version that was marked can be read');
    await ctx.close();
  }

  console.log('--- 5. a second opinion still out does not block, and its late reply is ignored');
  {
    const keyed = JSON.parse(JSON.stringify(paper));
    keyed.name = 'Phrased points paper';
    keyed.sections[1].questions[0].parts[0].points = [{ text: 'Names speed as the objective', marks: 1, need: ['speed'] },
                                                      { text: 'Links it to the waiting times', marks: 1, need: ['wait'] }];
    const seed = { cards: {}, endpoint: '', code: '12Ec126', log: [], customSets: [], lessons: {}, exams: [Object.assign({}, keyed, { id: 'phrased' })] };
    const { p, ctx, mode, errs } = await open(b, seed);
    await sit(p, 'Phrased points paper', ['Section II']);
    await submit(p, 'Speed, because customers wait too long.');
    mode.reply = () => Object.assign(REVIEW(1, 2), { delay: 3000 });
    await p.click('#examreview'); await settled(p);
    await review(p);
    ok(!(await has(p, '#tmbusy')) && !(await p.$eval('#tmsubmitpaper', e => e.disabled)), 'a second opinion does not block');
    const before = await text(p, '#tmrsum');
    await p.waitForTimeout(3500); await settled(p);              // it lands while the page is open
    ok((await text(p, '#tmrsum')) === before && (await current(p)).a.results['1-0-0'].score === 2,
       'landing while the page is open, it is abandoned: the total shown is the one Submit closes at');
    await p.click('#tmsubmitpaper'); await settled(p);
    const at = await stored(p), rec = at[Object.keys(at)[0]];
    ok(!rec.current && rec.last.results['1-0-0'].score === 2 && rec.last.results['1-0-0'].kind === 'points',
       'it was abandoned on submit, and its late reply did not touch the closed attempt: ' + JSON.stringify(rec.last.results['1-0-0'] && rec.last.results['1-0-0'].score));
    ok(mode.sent.length === 1 && !errs.length, 'one request, no page errors ' + JSON.stringify(errs));
    await ctx.close();
  }

  console.log('--- 5b. another tab changed the attempt: this one does not close it on stale data');
  {
    const { p, ctx } = await open(b);
    await sit(p, '', ['Section I']);
    await p.click('.choice'); await p.click('#check'); await settled(p);
    await review(p);
    await p.evaluate(() => {                                   // what another tab's save does
      const st = JSON.parse(localStorage.getItem('marginal.trial.v1'));
      const k = Object.keys(st.attempts).find(x => st.attempts[x].current);
      st.attempts[k].current.updatedAt = '2099-01-01T00:00:00.000Z';
      localStorage.setItem('marginal.trial.v1', JSON.stringify(st));
    });
    await p.click('#tmsubmitpaper'); await settled(p);
    const t = await p.$$eval('.toast', es => es.map(e => e.textContent).join(' | '));
    const c = await current(p);
    ok(/changed in another tab/.test(t) && c && !c.rec.last, 'it says so, and nothing is closed: ' + JSON.stringify(t));
    await ctx.close();
  }

  console.log('--- 6. a practice session closes through the same page, with its own verbs');
  {
    const { p, ctx, mode } = await open(b);
    mode.reply = () => REVIEW(2, 2);
    await toTest(p);
    await p.click('[data-tmtype="short_answer"]'); await settled(p);
    await p.click('#tmtypego'); await settled(p);
    await submit(p, 'Speed. Customers wait too long at the vans.');
    for (let i = 0; i < 10 && !(await has(p, '#examfinish')); i++) { await p.click('#examnext'); await settled(p); }
    ok((await text(p, '#examfinish')) === 'Review & finish', 'the last question says Review & finish');
    await p.click('#examfinish'); await settled(p);
    ok((await text(p, '#tmreview h1')) === 'Finish practice' && /Finishing ends this session/.test(await text(p, '#tmrdh')) && (await text(p, '#tmsubmitpaper')) === 'Finish practice',
       'the same page, with Finish practice and finishing throughout');
    ok(!/[Ss]ubmitting/.test(await text(p, '.tm-rpanel')), 'and no submitting anywhere on it');
    await p.click('#tmsubmitpaper'); await settled(p);
    const at = await stored(p), rec = at[Object.keys(at).find(k => k.startsWith('type:'))];
    ok(rec && !rec.current && rec.last && rec.last.completedAt, 'Finish practice closes the session');
    await ctx.close();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close(); process.exit(fail ? 1 : 0);
})();
