// TEST MODE STUDENT BOTS: fixed answers through the real app and the real worker.
//
// Every answer comes from tests/bots/testmode/corpus.v2.json and is the same in
// every run, so a change in what comes back is a change in Marginal. The bots
// drive the browser the way a student does (Library, setup, typing, editing,
// moving about, marking, flagging, leaving, reloading, resuming, finishing,
// Results, Review) and record, for every written attempt, what was submitted,
// the exact version graded, the mark or status, the marker's summary and every
// observation, and whether it was shown as the student's own words.
//
// OFFLINE (the default, Full tier): the app's marking requests are answered by
// the SHIPPED worker code (proxy/worker.js, via tests/worker.mjs) running in this
// process, with only the call to the model replaced by the corpus's stubbed
// reply. Grounding, reconciliation, refusal and the format the worker tells the
// marker all run for real. A stubbed score is a stand-in, not a judgement: what
// offline mode proves is that the app and the worker carry a judgement to the
// student honestly, not that the judgement is good.
//
// LIVE (MARGINAL_LIVE=1): nothing is intercepted; the real marker marks the same
// answers, and the suite asserts the corpus's ranges and orderings plus the same
// invariants. MARGINAL_SITE points it at a deployed site instead of the local
// build. Live runs need network access to the worker, and the worker allows 20
// marking requests per address in 10 minutes, so live mode paces itself.
// MARGINAL_BOTS_ONLY=id,id,... limits a run to some answers.
//
// TWO JOBS, TWO SIZES. Run as it is (the Full tier does), this is the CORE bot
// regression: the few answers and the one writing journey that catch every
// application fault the mutations name (an invented quote shown as the
// student's, an outage scored zero, a graded version that is not the one
// submitted, typing not saved, typing that redraws the box, a report marked as
// an essay): one extended response and one business report through the real
// worker, and the paper journey with the writing bot and an outage. With --all it is the STUDENT BENCHMARK: all 31 corpus answers, the
// deterministic formats, the learning loop across two sessions. That is a
// release and marking-quality run (npm run testmode-bots), not an every-commit
// one. --golden runs the 12 diagnostic answers in golden.v2.json, the first
// thing to spend live marking credits on. Live mode is always a benchmark run.
//
// The report is written to tests/out/bots/testmode-report.md, with a screenshot
// beside it for every check that failed.
const { chromium, T, OUT } = require('./env');
const fs = require('fs'), path = require('path');
const CORPUS = require('./bots/testmode/corpus.v2.json');
const X = require('./bots/testmode/expect.js');
const PAPER = require('./fixtures/bus-practice-paper.json');
const LIVE = process.env.MARGINAL_LIVE === '1';
const SITE = process.env.MARGINAL_SITE || T;
const GOLDEN = process.argv.includes('--golden');
const BENCH = process.argv.includes('--all') || GOLDEN || LIVE;
const ONLY = (process.env.MARGINAL_BOTS_ONLY || (GOLDEN ? require('./bots/testmode/golden.v2.json').answers.join(',') : '')).split(',').map(s => s.trim()).filter(Boolean);
// The core regression's answers: one of each kind of request the faults live in.
const CORE = new Set(['er11d-partial', 'br14-weak']);
const DIR = path.join(OUT, 'bots');
fs.mkdirSync(DIR, { recursive: true });

let pass = 0, fail = 0, shots = 0;
const failures = [];
let PAGE = null;
const ok = (c, m) => {
  if (c) { pass++; return true; }
  fail++; failures.push(m); console.log('  FAIL:', m);
  if (PAGE) { const f = path.join(DIR, 'fail-' + (++shots) + '.png'); PAGE.screenshot({ path: f, fullPage: true }).catch(() => {}); console.log('        screenshot ' + path.relative(OUT, f)); }
  return false;
};
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const has = (p, sel) => p.$(sel).then(Boolean);
const text = (p, sel) => p.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
const qhead = p => text(p, '.exam-qhead');
const store = p => p.evaluate(() => JSON.parse(localStorage.getItem('marginal.trial.v1') || '{}'));
const want = a => (!ONLY.length || ONLY.includes(a.id)) && (BENCH || CORE.has(a.id));
const ANSWERS = {}; CORPUS.items.forEach(it => it.answers.forEach(a => { ANSWERS[a.id] = Object.assign({ item: it }, a); }));

// ---- the profile report ---------------------------------------------------------------------
const rows = [];
function row(a, got, verdict, notes) {
  rows.push({ id: a.id, kind: a.kind, q: a.item.question, format: a.item.format, status: got.status, mark: got.status === 'marked' ? got.score + ' / ' + got.max : '-',
              inResponse: (got.quotes || []).length, across: (got.across || []).length, verdict, notes: notes || a.observe || '' });
}
function writeReport(meta) {
  const L = ['# Test Mode student bots: ' + (LIVE ? 'live' : 'offline') + ' run', '',
    'Corpus v' + CORPUS.version + ' · ' + (LIVE ? 'real marker' : 'shipped worker code, stubbed model') + ' · ' + new Date().toISOString(), '',
    pass + ' passed, ' + fail + ' failed.' + (meta ? ' ' + meta : ''), '',
    '| answer | kind | question | format | status | mark | in your response | across | verdict | notes |', '|---|---|---|---|---|---|---|---|---|---|'];
  rows.forEach(r => L.push('| ' + [r.id, r.kind, r.q, r.format, r.status, r.mark, r.inResponse, r.across, r.verdict, String(r.notes).replace(/\|/g, '/')].join(' | ') + ' |'));
  if (failures.length) { L.push('', '## Failed checks', ''); failures.forEach(f => L.push('- ' + f)); }
  fs.writeFileSync(path.join(DIR, 'testmode-report.md'), L.join('\n') + '\n');
}

// ---- the worker, in this process, with the model's reply stubbed --------------------------------
const DIAG = { coverage: [], arguments: [], explanation: [], evidence: [], terminology: [], repetition: [], missing: [], planVsResponse: [], firstToFix: '' };
const EXTRA = {};   // texts the bots write that are not verbatim corpus answers, mapped to the answer whose stub stands for them
function answerFor(t) {
  const s = String(t || '').trim();
  return Object.values(ANSWERS).find(a => (a.text || '').trim() === s) || (EXTRA[s] ? ANSWERS[EXTRA[s]] : null);
}
function split(total, n) { const base = Math.floor(total / n), out = new Array(n).fill(base); for (let i = 0; i < total - base * n; i++) out[i]++; return out; }
function reviewFor(a, marks) {
  const s = a.stub, blocks = String(a.textSent).split(/\n\s*\n/);
  const maxes = split(marks, blocks.length);
  let left = s.score;
  const paragraphs = blocks.map((b, i) => { const sc = Math.min(maxes[i], left); left -= sc; return { name: 'Paragraph ' + (i + 1), score: sc, max: maxes[i], reasons: [], sentences: [] }; });
  const issue = (h, w) => ({ kind: 'fix', severity: 'should', head: h, why: w, ladder: [] });
  (s.notices || []).forEach(n => { const i = Math.max(0, blocks.findIndex(b => b.includes(n.quote))); paragraphs[i].sentences.push({ text: n.quote, issues: [issue(n.head, n.why)] }); });
  (s.across || []).forEach(n => paragraphs[paragraphs.length - 1].sentences.push({ text: n.why, issues: [issue(n.head, n.why)] }));
  if (s.invent) paragraphs[0].sentences.push({ text: s.invent.text, issues: [issue(s.invent.head, s.invent.why)] });
  return { summary: s.summary, rubric: [], focus: { paragraph: 1, area: '', why: '', quote: '' }, paragraphs };
}
async function bridge(p, rec) {
  if (LIVE) return;
  const worker = (await import('./worker.mjs')).default;
  const realFetch = globalThis.fetch;
  const cors = { 'access-control-allow-origin': '*' };
  let n = 0;
  await p.route(/workers\.dev/, async route => {
    const req = route.request();
    if (req.method() !== 'POST') return route.fulfill({ status: 204, headers: cors });
    const raw = req.postData() || '{}', body = JSON.parse(raw);
    if (body.action === 'coach') return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: '{"nudges":[]}' });
    const a = answerFor(body.answer);
    const call = { body, answer: a && a.id, model: [] };
    rec.calls.push(call);
    if (rec.fail) { call.status = 'aborted'; return route.abort(); }
    globalThis.fetch = async (u, init) => {
      if (!/api\.anthropic\.com/.test(String(u))) return realFetch(u, init);
      const b = JSON.parse(init.body); call.model.push(b);
      const name = b.tools[0].name;
      if (!a || !a.stub) return new Response(JSON.stringify({ error: { type: 'not_recorded', message: 'no stub for this answer' } }), { status: 500 });
      const input = name === 'submit_diagnosis' ? DIAG : reviewFor(Object.assign({}, a, { textSent: body.answer }), Number(body.marks));
      return new Response(JSON.stringify({ content: [{ type: 'tool_use', name, input }], stop_reason: 'tool_use' }), { status: 200 });
    };
    try {
      const res = await worker.fetch(new Request('https://w/', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': 'bot-' + (++n) }, body: raw }), { ANTHROPIC_API_KEY: 'k' }, {});
      const out = await res.text();
      call.status = res.status;
      return route.fulfill({ status: res.status, contentType: 'application/json', headers: cors, body: out });
    } finally { globalThis.fetch = realFetch; }
  });
}
// Live: the worker allows 20 marking requests per address in ten minutes.
const sent = [];
async function pace() {
  if (!LIVE) return;
  const now = Date.now(); while (sent.length && now - sent[0] > 10 * 60 * 1000) sent.shift();
  if (sent.length >= 18) { const wait = 10 * 60 * 1000 - (now - sent[0]) + 2000; console.log('  (pacing for the worker\'s rate limit: ' + Math.round(wait / 1000) + 's)'); await new Promise(r => setTimeout(r, wait)); }
  sent.push(Date.now());
}

// ---- moving about the app as a student does ----------------------------------------------------
async function open(b) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage(); PAGE = p;
  const rec = { errs: [], dialogs: [], calls: [], fail: false, toasts: [] };
  p.on('pageerror', e => rec.errs.push(String(e).slice(0, 200)));
  p.on('dialog', d => { rec.dialogs.push(d.message()); d.accept(); });
  await bridge(p, rec);
  await p.goto(SITE + (SITE === T ? '?review=1' : '')); await settled(p);
  // A deployed site starts with an empty library: the bots import the paper the
  // way a teacher would. The local build seeds it, and then this does nothing.
  await toTest(p);
  if (!(await p.evaluate(n => [...document.querySelectorAll('.tm-paper h2')].some(h => h.textContent.trim() === n), PAPER.name))) {
    await p.click('#tmimport'); await settled(p);
    await p.setInputFiles('#tmfile', path.join(__dirname, 'fixtures', 'bus-practice-paper.json')); await settled(p);
    await p.waitForSelector('#tmadd', { timeout: 8000 }); await p.click('#tmadd'); await settled(p);
  }
  return { p, ctx, rec };
}
async function toTest(p) { await p.$$eval('.navtab', es => es.find(x => /Test mode/i.test(x.textContent)).click()); await settled(p); }
async function importLocalPaper(p) {
  const P = JSON.parse(JSON.stringify(PAPER)), L = CORPUS.localPoints;
  P.exam = Object.assign({}, P.exam, { id: L.examId, title: L.name }); P.name = L.name;
  const [si, qi, pi] = L.key.split('-').map(Number);
  const q = P.sections[si].questions[qi].parts[pi];
  // The closed question that declares phrase matching (decision 27) replaces 11(a)
  // whole: its prompt, directive, marking setting and points, never phrasings
  // grafted onto the open 'outline' question, which the import page now refuses.
  delete q.command; Object.assign(q, JSON.parse(JSON.stringify(L.leaf)));
  const f = path.join(DIR, 'local-points-paper.json'); fs.writeFileSync(f, JSON.stringify(P));
  await p.click('#tmimport'); await settled(p);
  await p.setInputFiles('#tmfile', f); await settled(p);
  await p.waitForSelector('#tmadd', { timeout: 8000 });
  await p.click('#tmadd'); await settled(p);
}
// Choose these questions (paper name, display) for a question-type practice session.
async function practise(p, format, picks) {
  await toTest(p);
  await p.click(`[data-tmtype="${format}"]`); await settled(p);
  if (await has(p, 'input[name=tmmode][value=choose]')) {
    await p.check('input[name=tmmode][value=choose]'); await settled(p);
    const n = await p.$$eval('.tm-from', (fs2, picks) => {
      let n = 0;
      fs2.forEach(f => { const paper = f.querySelector('h3').textContent.trim();
        f.querySelectorAll('[data-tmq]').forEach(b => { const d = b.closest('label').querySelector('.tm-qn').textContent.replace(/^Question\s+/, '').trim();
          const on = picks.some(x => x[0] === paper && x[1] === d); if (b.checked !== on) b.click(); if (on) n++; }); });
      return n;
    }, picks);
    ok(n === picks.length, format + ': chose ' + n + ' of ' + picks.length + ' questions in setup');
    await settled(p);
  }
  await p.click('#tmtypego'); await settled(p);
}
async function sitPaper(p, name) {
  await toTest(p);
  await p.evaluate(n => { const c = [...document.querySelectorAll('.tm-paper')].find(x => x.querySelector('h2').textContent.trim() === n); c.querySelector('[data-tmopen]').click(); }, name);
  await settled(p);
  if (await has(p, '#tmstartagain')) { await p.click('#tmstartagain'); await settled(p); }
  await p.click('#exampickgo'); await settled(p);
}
// Open a question through the Questions navigator, by its label: "11(b)" or "15".
async function goTo(p, label) {
  await p.click('#examnav'); await settled(p);
  const hit = await p.evaluate(l => {
    const m = /^(\d+)\(([a-z]+)\)$/.exec(l);
    const name = c => c.textContent.replace(/[✓⚑()\s]/g, '');
    const parent = c => { const b = c.closest('.tm-pblock'); const h = b && b.querySelector('.pbh b'); return h ? h.textContent : ''; };
    const t = [...document.querySelectorAll('[data-tmnav]')].find(c => m ? name(c) === m[2] && new RegExp('Question ' + m[1] + '\\b').test(parent(c)) : name(c) === 'Q' + l);
    if (t) { t.click(); return true; } return false;
  }, label);
  await settled(p);
  if (!hit) { await p.keyboard.press('Escape'); await settled(p); }
  ok(hit, 'the navigator has ' + label);
  return hit;
}
// What the student is shown about this question's result, and what was stored.
async function capture(p, attemptKey, key) {
  const dom = await p.evaluate(() => {
    const r = document.querySelector('#sheet .tm-result');
    const pr = r && [...r.querySelectorAll('.pair')].find(x => (x.querySelector('.k') || {}).textContent === 'Marks');
    const v = pr && pr.querySelector('.v'); const m = v && /(\d+) of (\d+)/.exec(v.textContent);
    return {
      shown: !!r, nm: !!(r && r.classList.contains('nm')), score: m ? Number(m[1]) : null, max: m ? Number(m[2]) : null,
      summary: ((document.querySelector('#sheet .tm-mnote') || {}).textContent || '').replace(/^Marked against [^\n]*?criteria/, '').trim(),
      quotes: [...document.querySelectorAll('#sheet .obs .ev q')].map(q => q.textContent.replace(/^[“"]|[”"]$/g, '')),
      across: [...document.querySelectorAll('#sheet .obs .ob')].filter(o => o.querySelector('.acrossl')).map(o => o.querySelector('.obh').textContent),
      toast: ((document.querySelector('.toast, #toast') || {}).textContent || ''),
    };
  });
  const st = await store(p), a = st.attempts[attemptKey].current;
  const k = Object.keys(a.results).concat(Object.keys(a.answers)).find(x => x === key || x.endsWith('#' + key)) || key;
  const res = a.results[k];
  return Object.assign(dom, { key: k, stored: res || null, graded: a.answers[k] == null ? null : String(a.answers[k]),
    status: !res ? 'none' : res.outcome === 'success' ? 'marked' : 'not_marked' });
}
async function submitText(p, value, opts) {
  if (await has(p, '#examretry')) { await p.click('#examretry'); await settled(p); }
  if (opts && opts.choice != null) {
    await p.click(`.tm-mc .choice[data-i="${opts.choice}"]`); await settled(p);
  } else {
    await p.fill('#ans', value); await settled(p);
  }
  await pace();
  await p.click('#check');
  await p.waitForFunction(() => !/Checking/.test((document.querySelector('#check') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
  await settled(p);
}

// ---- what every written attempt must satisfy ------------------------------------------------------
function invariants(a, got, where) {
  const g = got.graded || '';
  ok(got.quotes.every(q => g.includes(q)), where + ': every "In your response" quote is in the version graded: ' + JSON.stringify(got.quotes.filter(q => !g.includes(q))));
  if (a.stub && a.stub.invent && !LIVE) {
    ok(!got.quotes.some(q => q.includes(a.stub.invent.text)) && !got.summary.includes(a.stub.invent.text), where + ': a sentence the student never wrote is never shown as theirs');
    if (a.item.format !== 'short_answer') ok(got.across.includes(a.stub.invent.head), where + ': its observation is about the response as a whole: ' + JSON.stringify(got.across));
  }
  if (got.status === 'marked') ok(got.score === got.stored.score && got.max === got.stored.max, where + ': the mark shown is the mark stored: ' + got.score + '/' + got.max + ' vs ' + got.stored.score + '/' + got.stored.max);
  if (got.status === 'not_marked') ok(got.score == null && got.nm, where + ': not marked shows no number');
  ok(got.status !== 'marked' || got.stored.kind !== 'demo', where + ': no demo grade');
}
function expectOf(a, got, where) {
  const e = a.expect || {};
  if (e.exact != null) ok(X.exactly(got, e.exact), where + ': exactly ' + e.exact + ': got ' + X.describe(got));
  if (e.status) ok(got.status === e.status, where + ': ' + e.status + ': got ' + got.status);
  if (e.neverFull) ok(X.neverFull(got), where + ': never full marks: ' + X.describe(got));
  if (!LIVE && a.stub) {
    ok(got.status === 'marked' && got.score === a.stub.score, where + ': the marker\'s ' + a.stub.score + ' reaches the student unchanged: ' + got.status + ' ' + got.score);
    ok(got.summary.includes(a.stub.summary), where + ': and so does its summary');
  }
  // A range is about a mark: an answer that came back without one fails it, so
  // "not marked" can never pass as "at most 2" (Run 1).
  if (LIVE && a.live && (a.live.min != null || a.live.max != null))
    ok(X.inRange(got, a.live), where + ': ' + [a.live.min != null ? 'at least ' + a.live.min : '', a.live.max != null ? 'at most ' + a.live.max : ''].filter(Boolean).join(' and ') + ': got ' + X.describe(got));
}
const LIVE_GOT = {};   // every answer attempted, marked or not: an ordering needs both sides
async function attemptOne(p, attemptKey, a, where) {
  const before = fail;
  await submitText(p, a.text, a.choice != null ? { choice: a.choice } : null);
  const got = await capture(p, attemptKey, a.item.key);
  if (a.text === '') {
    ok(got.status === 'none' || got.graded !== '', where + ': a blank answer is not submitted');
  } else {
    const sentText = a.choice != null ? String(a.choice) : a.text.trim();
    ok(got.graded === sentText, where + ': the version graded is exactly what was submitted');
  }
  expectOf(a, got, where); invariants(a, got, where);
  LIVE_GOT[a.id] = got;
  row(a, got, fail === before ? 'ok' : 'FAIL');
  return got;
}
function orderings() {
  if (!LIVE) return;
  CORPUS.items.forEach(it => (it.liveOrder || []).forEach(([hi, lo]) => {
    // Skipped only when the run did not attempt both answers. Attempted but
    // unmarked is a failure: the ordering was never shown.
    if (!(hi in LIVE_GOT) || !(lo in LIVE_GOT)) return;
    ok(X.ordered(LIVE_GOT[hi], LIVE_GOT[lo]), 'live ordering: ' + hi + ' (' + X.describe(LIVE_GOT[hi]) + ') is not below ' + lo + ' (' + X.describe(LIVE_GOT[lo]) + ')');
  }));
}
async function finish(p) {
  await p.click('#examnav'); await settled(p); await p.click('#tmnavreview'); await settled(p);
  await p.click('#tmsubmitpaper'); await settled(p);
}
// Results agree with what was stored, cell by cell.
async function resultsAgree(p, attemptKey, where) {
  const r = await p.evaluate(k => { const st = JSON.parse(localStorage.getItem('marginal.trial.v1')); const R = window.MarginalAttempts.results(st.attempts[k].last, st.exams);
    return R.items.map(x => ({ k: x.key, s: x.status, v: x.status === 'marked' ? x.score + ' / ' + x.max : x.status === 'not_marked' ? 'Not marked' : 'Not answered' })); }, attemptKey);
  const cells = await p.$$eval('.tm-rs-cell', es => es.map(e => ({ k: e.dataset.tmrv, v: e.querySelector('.v').textContent.trim() })));
  ok(cells.length === r.length && cells.every((c, i) => c.k === r[i].k && c.v === r[i].v), where + ': every Results cell agrees with the closed attempt');
}

(async () => {
  const b = await chromium.launch();

  // Benchmark only: the core proves an outage is never a zero in the paper attempt (section 4).
  if (BENCH) {
  console.log('--- 1. short answer practice: the logic bots');
    const { p, ctx, rec } = await open(b);
    await toTest(p);
    const TK = 'type:short_answer';
    const paperBefore = JSON.stringify(((await store(p)).attempts || {})['paper:' + PAPER.exam.id] || null);
    const local = ['cl11a-blank', 'cl11a-irrelevant', 'cl11a-one-point', 'cl11a-unusual', 'cl11a-shotgun', 'cl11a-negation', 'cl11a-two-points'].filter(id => want(ANSWERS[id]));
    if (local.length) {
      // Benchmark only: the deterministic phrase matcher, on the bots' own paper.
      await importLocalPaper(p);
      ok(await p.evaluate(n => [...document.querySelectorAll('.tm-paper h2')].some(h => h.textContent.trim() === n), CORPUS.localPoints.name), 'the bots paper is imported through the Import page');
      await practise(p, 'short_answer', [[CORPUS.localPoints.name, '11(a)'], [PAPER.name, '11(b)']]);
      await goTo(p, '11(a)');
      ok(/Question 11\(a\)/.test(await qhead(p)), 'the navigator opens 11(a)');
      for (const id of local) {
        const got = await attemptOne(p, TK, ANSWERS[id], id);
        if (id === 'cl11a-blank') ok(got.status === 'none' && rec.calls.length === 0, id + ': nothing was sent to the marker for a blank answer');
      }
      ok(rec.calls.length === 0, 'a locally marked question never calls the marker: ' + rec.calls.length);
    } else {
      await practise(p, 'short_answer', [[PAPER.name, '11(b)']]);
    }
    await goTo(p, '11(b)');
    ok(/Question 11\(b\)/.test(await qhead(p)), 'the navigator opens 11(b)');
    // 11(b), marked by the marker: what it says reaches the student unchanged and grounded.
    if (want(ANSWERS['sa11b-blank'])) await attemptOne(p, TK, ANSWERS['sa11b-blank'], 'sa11b-blank');
    if (!LIVE) {
      // The marker fails on a first submission: not marked, never a zero; marking again later marks it.
      rec.fail = true;
      const s = ANSWERS['sa11b-irrelevant'];
      await submitText(p, s.text);
      const down = await capture(p, TK, '1-0-1');
      ok(down.status === 'not_marked' && down.nm && down.score == null && down.graded === s.text, 'marker unreachable: not marked, no number, the answer kept: ' + down.status);
      ok(/could not be reached/.test(await text(p, '#sheet')), 'and it says why: ' + (await text(p, '#sheet')).slice(0, 120));
      rec.fail = false;
      ok(await has(p, '#examremark'), 'Try marking again is offered while the attempt is open');
      if (await has(p, '#examremark')) { await p.click('#examremark'); await p.waitForFunction(() => !!document.querySelector('#sheet .tm-result:not(.nm)'), null, { timeout: 15000 }).catch(() => {}); await settled(p); }
      const back = await capture(p, TK, '1-0-1');
      ok(back.status === 'marked' && back.score === s.stub.score, 'Try marking again marks the same answer once the marker is back: ' + back.status + ' ' + back.score);
    }
    for (const id of ['sa11b-irrelevant', 'sa11b-misconception', 'sa11b-verbose', 'sa11b-unusual', 'sa11b-strong']) {
      const a = ANSWERS[id]; if (!want(a)) continue;
      await attemptOne(p, TK, a, id);
    }
    if (!LIVE) ok(rec.calls.filter(c => c.status !== 'aborted').every(c => c.body.format === 'short_answer' && c.status === 200),
      'every 11(b) request was a short answer and the worker answered it: ' + JSON.stringify(rec.calls.map(c => [c.answer, c.body.format, c.status])));
    // The learning loop, part 1: the session ends on the weak version.
    const weak = ANSWERS[CORPUS.progression.from];
    if (want(weak)) await attemptOne(p, TK, weak, CORPUS.progression.from + ' (last in session 1)');
    await finish(p);
    ok(/Results/.test(await text(p, '.tm-top h1')), 'Finish practice opens Results');
    await resultsAgree(p, TK, 'short answer session 1');
    const r1 = await p.$eval('.tm-rs-cell[data-tmrv$="#1-0-1"] .v', e => e.textContent.trim()).catch(() => '');
    // Review shows the graded version, read only.
    await p.click('.tm-rs-cell[data-tmrv$="#1-0-1"]'); await settled(p);
    const graded1 = (await store(p)).attempts[TK].last.answers;
    ok((await text(p, '#tmrvans')) === String(Object.entries(graded1).find(([k]) => k.endsWith('#1-0-1'))[1]).replace(/\s+/g, ' ') && !(await has(p, '#app textarea')), 'Review shows exactly the version graded, read only');
    await p.click('#tmrvback'); await settled(p);
    // Part 2 (benchmark): a new session, the improved answer, the old result untouched until it is finished.
    if (BENCH && want(ANSWERS[CORPUS.progression.to])) {
    await p.click('#tmback'); await settled(p);
    await practise(p, 'short_answer', [[PAPER.name, '11(b)']]);
    const lastBefore = JSON.stringify((await store(p)).attempts[TK].last);
    const strong = ANSWERS[CORPUS.progression.to];
    await attemptOne(p, TK, strong, CORPUS.progression.to + ' (session 2)');
    ok(JSON.stringify((await store(p)).attempts[TK].last) === lastBefore, 'while session 2 is in progress, session 1\'s result is not rewritten');
    await p.click('#examquit'); await settled(p);
    await p.click('[data-tmtyperesults="short_answer"]'); await settled(p);
    ok((await p.$eval('.tm-rs-cell[data-tmrv$="#1-0-1"] .v', e => e.textContent.trim()).catch(() => '')) === r1, 'and its Results still read ' + r1);
    }
    ok(JSON.stringify(((await store(p)).attempts || {})['paper:' + PAPER.exam.id] || null) === paperBefore, 'question-type practice never touched the paper attempt');
    ok(!rec.errs.length, 'no page errors ' + JSON.stringify(rec.errs));
    await ctx.close();
  }

  if (BENCH && ['mc1-wrong', 'mc1-right', 'calc-inverted', 'calc-two-numbers', 'calc-working'].some(id => want(ANSWERS[id]))) {
  console.log('--- 2. multiple choice and calculation: exact marks from the key');
    const { p, ctx, rec } = await open(b);
    await practise(p, 'multiple_choice', [[PAPER.name, '1']]);
    for (const id of ['mc1-wrong', 'mc1-right']) if (want(ANSWERS[id])) await attemptOne(p, 'type:multiple_choice', ANSWERS[id], id);
    await p.click('#examquit'); await settled(p);
    await practise(p, 'calculation', [[PAPER.name, '11(c)']]);
    for (const id of ['calc-inverted', 'calc-two-numbers', 'calc-working']) if (want(ANSWERS[id])) await attemptOne(p, 'type:calculation', ANSWERS[id], id);
    ok(rec.calls.length === 0, 'neither format ever calls the marker');
    ok(!rec.errs.length, 'no page errors ' + JSON.stringify(rec.errs));
    await ctx.close();
  }

  console.log('--- 3. extended response and business report: grounding and the format the marker is told');
  {
    const { p, ctx, rec } = await open(b);
    const e11 = ['er11d-minimal', 'er11d-misconception', 'er11d-partial', 'er11d-strong'].filter(id => want(ANSWERS[id]));
    const e15 = ['er15-weak', 'er15-unfinished', 'er15-no-evidence', 'er15-middle', 'er15-strong'].filter(id => want(ANSWERS[id]));
    const brs = ['br14-essay', 'br14-weak', 'br14-report'].filter(id => want(ANSWERS[id]));
    if (e11.length || e15.length) {
      await practise(p, 'extended_response', [e11.length ? [PAPER.name, '11(d)'] : null, e15.length ? [PAPER.name, '15'] : null].filter(Boolean));
      if (e11.length) { await goTo(p, '11(d)'); for (const id of e11) await attemptOne(p, 'type:extended_response', ANSWERS[id], id); }
      if (e15.length) { await goTo(p, '15'); for (const id of e15) await attemptOne(p, 'type:extended_response', ANSWERS[id], id); }
      await p.click('#examquit'); await settled(p);
    }
    if (brs.length) {
    await practise(p, 'business_report', []);
    for (const id of brs) await attemptOne(p, 'type:business_report', ANSWERS[id], id);
    }
    if (!LIVE && (e11.length || e15.length) && brs.length) {
      const told = c => c.model.map(m => JSON.stringify(m.messages || [])).join(' ');
      const er = rec.calls.filter(c => /^er/.test(c.answer || '')), br = rec.calls.filter(c => /^br/.test(c.answer || ''));
      ok(er.length && er.every(c => c.body.format === 'extended_response' && /Mark it as an extended response/.test(told(c)) && !/Mark it as a business report/.test(told(c))),
         'an extended response is sent as one, and the marker is told to mark it as one');
      ok(br.length && br.every(c => c.body.format === 'business_report' && /Mark it as a business report/.test(told(c))),
         'a business report is sent as one, and the marker is told to mark it as a report, whichever shape the student gave it');
      ok(br.every(c => /business report with a clear structure/i.test(told(c))), 'the question\'s own report instructions reach the marker');
    }
    if (brs.length) { await finish(p); await resultsAgree(p, 'type:business_report', 'business report session'); }
    ok(!rec.errs.length, 'no page errors ' + JSON.stringify(rec.errs));
    await ctx.close();
  }

  console.log('--- 4. the writing experience, in a paper attempt');
  {
    const { p, ctx, rec } = await open(b);
    await sitPaper(p, PAPER.name);
    const PK = 'paper:' + PAPER.exam.id;
    // Multiple choice and a calculation on the way.
    if (want(ANSWERS['mc1-right'])) await attemptOne(p, PK, ANSWERS['mc1-right'], 'mc1-right (paper)');
    await goTo(p, '11(c)');
    if (want(ANSWERS['calc-right'])) await attemptOne(p, PK, ANSWERS['calc-right'], 'calc-right (paper)');
    // 11(b), typed key by key, with a typo fixed and a phrase inserted mid-sentence.
    await goTo(p, '11(b)');
    const W = CORPUS.writing, base = ANSWERS[W.answer].text;
    const final = base.replace(W.insert.after, W.insert.after + W.insert.text);
    EXTRA[final.trim()] = W.answer;
    await p.click('#ans');
    await p.keyboard.type(W.typo.type, { delay: 2 });
    const typed = await p.$eval('#ans', e => ({ v: e.value, focus: document.activeElement === e, at: e.selectionStart }));
    ok(typed.v === W.typo.type && typed.focus && typed.at === W.typo.type.length, 'typing: every key landed, focus stayed, the caret is at the end: ' + JSON.stringify(typed));
    // Fix the typo in the middle, as a student does: select it and type over it.
    await p.$eval('#ans', (e, w) => { const i = e.value.indexOf(w); e.focus(); e.setSelectionRange(i, i + w.length); }, W.typo.fixAt);
    await p.keyboard.type(W.typo.fixTo, { delay: 2 });
    const fixed = await p.$eval('#ans', e => ({ v: e.value, at: e.selectionStart, focus: document.activeElement === e }));
    const fixedText = W.typo.type.replace(W.typo.fixAt, W.typo.fixTo);
    ok(fixed.v === fixedText && fixed.focus && fixed.at === fixedText.indexOf(W.typo.fixTo) + W.typo.fixTo.length, 'editing mid-sentence: the caret stays after the fix and nothing else moved: ' + JSON.stringify(fixed));
    await p.$eval('#ans', e => { e.setSelectionRange(e.value.length, e.value.length); });
    await p.keyboard.type(base.slice(W.typo.type.replace(W.typo.fixAt, W.typo.fixTo).length), { delay: 0 });
    // Insert a phrase into the middle.
    await p.$eval('#ans', (e, w) => { const i = e.value.indexOf(w) + w.length; e.setSelectionRange(i, i); }, W.insert.after);
    await p.keyboard.type(W.insert.text, { delay: 2 });
    ok((await p.$eval('#ans', e => e.value)) === final, 'the inserted phrase sits exactly where the caret was');
    await p.waitForTimeout(500);   // the app saves a draft 400ms after the last keystroke
    // A reload straight after typing, with no navigation to save it: the typing itself was saved.
    await p.reload(); await settled(p); await toTest(p);
    await p.click('[data-examresume]'); await settled(p);
    ok(/Question 11\(b\)/.test(await qhead(p)) && (await p.$eval('#ans', e => e.value)) === final, 'after a reload, Resume opens 11(b) with the draft intact');
    // Flag it, go away and come back, reload again: the draft and the flag survive.
    await p.click('#examflag'); await settled(p);
    await p.click('#examnext'); await settled(p); await p.click('#examprev'); await settled(p);
    ok((await p.$eval('#ans', e => e.value)) === final, 'Next and Previous keep the draft exactly');
    await p.reload(); await settled(p); await toTest(p);
    await p.click('[data-examresume]'); await settled(p);
    ok(/Flagged/.test(await text(p, '#examflag')) && (await p.$eval('#ans', e => e.value)) === final, 'and the flag and the draft survive a second reload');
    await pace();
    await p.click('#check'); await p.waitForFunction(() => !!document.querySelector('#sheet .tm-result'), null, { timeout: 15000 }).catch(() => {}); await settled(p);
    const got = await capture(p, PK, '1-0-1');
    ok(got.graded === final && got.status === 'marked', 'the version graded is the edited text, exactly: ' + got.status);
    invariants(ANSWERS[W.answer], got, 'writing bot');
    row(Object.assign({ item: ANSWERS[W.answer].item }, ANSWERS[W.answer], { id: 'writing-bot', kind: 'typed, edited, reloaded' }), got, 'ok');
    // A written answer the marker could not mark, and the either/or chosen and answered.
    rec.fail = true;
    await goTo(p, '12(a)');
    await submitText(p, 'The gross profit ratio fell from 40% to about 37%.');
    rec.fail = false;
    const nm = await capture(p, PK, '1-1-0');
    ok(nm.status === 'not_marked' && nm.score == null, '12(a), marker unreachable: not marked, no number');
    await goTo(p, '15');
    if (await has(p, '[data-examchoose="0"]')) { await p.click('[data-examchoose="0"]'); await settled(p); }
    if (want(ANSWERS['er15-middle'])) await attemptOne(p, PK, ANSWERS['er15-middle'], 'er15-middle (paper)');
    // Leave and resume, then Review & submit, Submit paper, Results and Review.
    await p.click('#examquit'); await settled(p); await p.click('[data-examresume]'); await settled(p);
    await finish(p);
    const rec2 = (await store(p)).attempts[PK];
    ok(rec2.last && rec2.last.completedAt && !rec2.current, 'Submit paper closed the attempt');
    await resultsAgree(p, PK, 'paper');
    const before = await p.evaluate(() => localStorage.getItem('marginal.trial.v1'));
    await p.click('.tm-rs-cell[data-tmrv="1-0-1"]'); await settled(p);
    ok((await text(p, '#tmrvans')) === final.replace(/\s+/g, ' ') && /3 of 3/.test(await text(p, '#sheet .tm-result')), 'Review: the marked written answer, its exact text and its mark');
    await p.click('#tmrvback'); await settled(p);
    await p.click('.tm-rs-cell[data-tmrv="1-1-0"]'); await settled(p);
    ok(/Not marked/.test(await text(p, '#sheet')) && !/\bagain\b/.test(await text(p, '#sheet')), 'Review: the unmarked answer stays unmarked, with no retry');
    await p.click('#tmrvback'); await settled(p);
    ok((await p.evaluate(() => localStorage.getItem('marginal.trial.v1'))) === before, 'nothing in Results or Review changed the completed attempt');
    ok(!/HSC Economics|Economics/.test(await text(p, 'header .unit')), 'the header names Business Studies, never Economics: ' + await text(p, 'header .unit'));
    ok(!rec.errs.length && !rec.dialogs.length, 'no page errors and no dialogs ' + JSON.stringify(rec.errs.concat(rec.dialogs)));
    await ctx.close();
  }

  orderings();
  await b.close();
  writeReport();
  console.log('report: ' + path.relative(OUT, path.join(DIR, 'testmode-report.md')));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
