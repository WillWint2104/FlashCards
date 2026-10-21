// THE EXTENDED RESPONSE BENCHMARK (bots Run 2): Question 15, written and marked
// through the real Test Mode journey, from the frozen answers in
// tests/bots/testmode/corpus.v3.json (`benchmarks.er15`).
//
// For each answer: Test mode, Extended response practice, choose Question 15,
// type the response key by key (a misspelt word fixed in place, a phrase inserted
// mid-text), leave and resume, reload and resume, submit, capture exactly what the
// student is shown and what was stored, finish, Results, and the closed Review.
// Then four probes: a later edit never takes an earlier mark; a reply after Start
// again touches nothing; a reply while another question is open lands on its own
// question only; a reply after Leave it unmarked does not rewrite a closed session.
//
// OFFLINE (the default): the marking requests are answered by the SHIPPED worker
// (tests/worker.mjs) in this process with the model's reply taken from each
// answer's `stub`. That proves the journey and the invariants, not the marking.
// LIVE (MARGINAL_LIVE=1): nothing is intercepted on the way to the grader. This
// spends real marking credits and is paced under the worker's 20 requests per
// address in ten minutes. It is an explicit quality command, never part of the
// Fast or Checkpoint gates.
//
//   node tests/bots/testmode/er-benchmark.js            # offline, local build
//   MARGINAL_LIVE=1 node tests/bots/testmode/er-benchmark.js
//   MARGINAL_SITE=https://willwint2104.github.io/FlashCards/ MARGINAL_LIVE=1 node tests/bots/testmode/er-benchmark.js
//   MARGINAL_BOTS_ONLY=er15-strong,probe:edit ...       # some steps only
//   ... --timing                                        # the three timing answers
//
// A deployed site signs in through a STAND-IN Supabase client (a sample student,
// 12Ec126 · #1234): the site's own code runs and no request reaches Supabase. Test
// Mode attempts live in the browser, and the marking request carries the class
// code the app ships with, so marking sees exactly what a signed-in student sends.
//
// MARGINAL_CLIENT_MS raises the app's 45 second marking limit IN THE TEST BROWSER
// ONLY, on a deployed site whose app.js is byte-identical to this checkout's; it
// refuses otherwise. Run 2 needed it to see what the production grader marks at
// all. It is a measuring aid, never a fix.
//
// Behind a TLS-intercepting proxy, set MARGINAL_CA_SPKI to the proxy CA's SPKI
// hash; HTTPS_PROXY is used when set.
//
// Writes tests/out/bots/er15/<mode>-<time>/run.json, analysis.json and a
// screenshot per marked state, Results and closed Review, then compares the run
// with the Run 2 baseline (er15-baseline.run2.json) through er-analyze.js.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const ENV = require(path.join(ROOT, 'tests', 'env.js'));
const { serveFonts } = require(path.join(ROOT, 'tests', 'fontcache.js'));
const pw = (() => { for (const id of ['playwright', '@playwright/test', '/opt/node22/lib/node_modules/playwright']) { try { return require(id); } catch (e) { /* next */ } } throw new Error('Playwright not found'); })();
const EXE = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const LIVE = process.env.MARGINAL_LIVE === '1';
const SITE = process.env.MARGINAL_SITE || ENV.T;
const DEPLOYED = /^https?:\/\//.test(SITE);
const TIMING = process.argv.includes('--timing');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUT = path.join(ENV.OUT, 'bots', 'er15', (LIVE ? 'live' : 'dry') + '-' + STAMP);
fs.mkdirSync(OUT, { recursive: true });
const CORPUS = require('./corpus.v3.json');
const BENCH = CORPUS.benchmarks.er15;
const PAPER = require(path.join(ROOT, 'tests', 'fixtures', 'bus-practice-paper.json'));
const PAPER_NAME = PAPER.name;
const TK = 'type:extended_response';

const STAND_IN = `(function () {
  var S = { user: { id: "er-benchmark-stand-in" } }, session = S;
  window.__cloud = { signOuts: 0 };
  function done(v) { return Promise.resolve(v); }
  function chain() { var c = { select: function () { return c; }, eq: function () { return c; }, order: function () { return c; },
    insert: function () { return c; }, update: function () { return c; }, delete: function () { return c; }, upsert: function () { return c; },
    maybeSingle: function () { return done({ data: session ? { class_code: "12Ec126", student_number: "1234" } : null }); },
    single: function () { return done({ data: null, error: null }); },
    then: function (a, b) { return done({ data: [], error: null }).then(a, b); } }; return c; }
  window.supabase = { createClient: function () { return {
    auth: { getSession: function () { return done({ data: { session: session } }); },
            signOut: function () { session = null; window.__cloud.signOuts++; return done({}); },
            signInWithPassword: function () { return done({ data: { session: null }, error: { message: "stand-in" } }); } },
    from: chain, functions: { invoke: function () { return done({ data: null }); } } }; } };
})();`;

// ---- the record --------------------------------------------------------------------------------
const LOG = { mode: LIVE ? 'live' : 'offline', site: DEPLOYED ? SITE : 'local build', started: new Date().toISOString(), steps: [], requests: [], checks: [], errors: [] };
let PASS = 0, FAIL = 0;
function check(c, what, step) {
  LOG.checks.push({ ok: !!c, what, step: step || null });
  if (c) PASS++; else { FAIL++; console.log('  FAIL:', what); }
  return !!c;
}
const save = () => fs.writeFileSync(path.join(OUT, 'run.json'), JSON.stringify(LOG, null, 1));
const settled = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
// The sitting has a sticky footer; a fullPage capture paints it mid-page. Grow the
// window to the page's height instead, capture, and put it back.
async function shoot(p, file) {
  const h = await p.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  await p.setViewportSize({ width: 1440, height: Math.min(Math.max(900, h), 12000) }); await settled(p); await p.waitForTimeout(150);
  await p.screenshot({ path: path.join(OUT, file) });
  await p.setViewportSize({ width: 1440, height: 900 }); await settled(p);
}
const has = (p, sel) => p.$(sel).then(Boolean);
const text = (p, sel) => p.$eval(sel, e => e.innerText.replace(/[ \t]+/g, ' ').trim()).catch(() => '');
const store = p => p.evaluate(() => JSON.parse(localStorage.getItem('marginal.trial.v1') || '{}'));
const rawStore = p => p.evaluate(() => localStorage.getItem('marginal.trial.v1'));
const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
const redact = b => { const o = Object.assign({}, b); if ('code' in o) o.code = o.code ? '(class code, redacted)' : o.code; return o; };

// ---- the worker: watched (live) or the shipped code with the model stubbed (offline) ----------
const STUB_DELAY = Number(process.env.MARGINAL_STUB_DELAY || 4000);
const CLIENT_MS = Number(process.env.MARGINAL_CLIENT_MS || 0);
const ITEM = CORPUS.items.find(i => i.question === BENCH.question);
const byText = t => ITEM.answers.find(a => (a.text || '').trim() === String(t || '').trim()) || null;
function split(total, n) { const base = Math.floor(total / n), out = new Array(n).fill(base); for (let i = 0; i < total - base * n; i++) out[i]++; return out; }
// The stubbed review, as tests/ui76.js builds it: the corpus stub's score spread over
// the paragraphs, its notices anchored on the sentences they quote.
function reviewFor(a, sent, marks) {
  const s = a && a.stub ? a.stub : { score: 0, summary: 'Stand-in reply for a text the corpus does not hold.', notices: [] };
  const blocks = String(sent).split(/\n\s*\n/), maxes = split(marks, blocks.length);
  let left = Math.min(s.score, marks);
  const paragraphs = blocks.map((b, i) => { const sc = Math.min(maxes[i], left); left -= sc; return { name: 'Paragraph ' + (i + 1), score: sc, max: maxes[i], reasons: [], sentences: [] }; });
  const issue = (h, w) => ({ kind: 'fix', severity: 'should', head: h, why: w, ladder: [] });
  (s.notices || []).forEach(n => { const i = Math.max(0, blocks.findIndex(b => b.includes(n.quote))); paragraphs[i].sentences.push({ text: n.quote, issues: [issue(n.head, n.why)] }); });
  (s.across || []).forEach(n => paragraphs[paragraphs.length - 1].sentences.push({ text: n.why, issues: [issue(n.head, n.why)] }));
  return { summary: s.summary, rubric: [], focus: { paragraph: 1, area: '', why: '', quote: '' }, paragraphs };
}
// The stubbed lean Test Mode mark (contract testmode-extended-1, tool submit_test_mark),
// as tests/ui76.js builds it: the same stub's mark, judgement and observations.
function leanFor(a) {
  const s = a && a.stub ? a.stub : { score: 0, summary: 'Stand-in reply for a text the corpus does not hold.', notices: [] };
  return { mark: s.score, judgement: s.summary, criteria: [],
    observations: (s.notices || []).map(n => ({ head: n.head, why: n.why, quote: n.quote }))
      .concat((s.across || []).map(n => ({ head: n.head, why: n.why, quote: '' }))) };
}
async function wire(p, rec) {
  // Offline, or live against the local build: nothing leaves the process but the
  // grader's requests (live) or nothing at all (offline).
  if (!DEPLOYED) await p.route(/^https?:\/\//, r => r.abort());
  await serveFonts(p);
  if (DEPLOYED) {
    await p.route(/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: STAND_IN }));
    await p.route(/supabase\.co/, r => r.abort());
  }
  if (CLIENT_MS) {
    if (!DEPLOYED) throw new Error('MARGINAL_CLIENT_MS needs MARGINAL_SITE: the local build inlines app.js');
    const appUrl = new URL('app.js', SITE).href;
    await p.route(u => u.href.split('?')[0] === appUrl, async route => {
      const res = await route.fetch(); const body = await res.text();
      const here = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
      const needle = 'const ES_REQUEST_MS = 45000;';
      LOG.clientBound = { servedEqualsCheckout: body === here, occurrences: body.split(needle).length - 1, raisedTo: CLIENT_MS,
        servedSha256: crypto.createHash('sha256').update(body).digest('hex') };
      if (body !== here || LOG.clientBound.occurrences !== 1) throw new Error('the served app.js is not this checkout\'s; refusing to patch it');
      return route.fulfill({ response: res, body: body.replace(needle, 'const ES_REQUEST_MS = ' + CLIENT_MS + ';'), contentType: 'application/javascript' });
    });
  }
  p.on('request', req => {
    if (!/workers\.dev/.test(req.url()) || req.method() !== 'POST') return;
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (e) { /* not json */ }
    const r = { n: LOG.requests.length + 1, step: rec.step, at: new Date().toISOString(), t0: Date.now(), body: redact(body), status: null, reply: null, t1: null, failure: null };
    LOG.requests.push(r); rec.reqs.push(r); req.__r = r;
  });
  p.on('requestfailed', req => { if (req.__r) { req.__r.failure = (req.failure() || {}).errorText || 'failed'; req.__r.t1 = Date.now(); } });
  p.on('response', async res => {
    const req = res.request(); if (!req.__r) return;
    const r = req.__r; r.status = res.status();
    try { r.reply = JSON.parse(await res.text()); } catch (e) { r.reply = { unreadable: String(e).slice(0, 120) }; }
    r.t1 = Date.now();
  });
  if (LIVE) { if (!DEPLOYED) await p.route(/workers\.dev/, r => r.continue()); return; }
  const worker = (await import(path.join(ROOT, 'tests', 'worker.mjs'))).default;
  const realFetch = globalThis.fetch;
  const cors = { 'access-control-allow-origin': '*' };
  let n = 0;
  await p.route(/workers\.dev/, async route => {
    const req = route.request();
    if (req.method() !== 'POST') return route.fulfill({ status: 204, headers: cors });
    const raw = req.postData() || '{}', body = JSON.parse(raw);
    await new Promise(r => setTimeout(r, STUB_DELAY));
    globalThis.fetch = async (u, init) => {
      if (!/api\.anthropic\.com/.test(String(u))) return realFetch(u, init);
      const b = JSON.parse(init.body), name = b.tools[0].name;
      const DIAG = { coverage: [], arguments: [], explanation: [], evidence: [], terminology: [], repetition: [], missing: [], planVsResponse: [], firstToFix: '' };
      const input = name === 'submit_diagnosis' ? DIAG : name === 'submit_test_mark' ? leanFor(byText(body.answer))
        : reviewFor(byText(body.answer), body.answer, Number(body.marks));
      return new Response(JSON.stringify({ content: [{ type: 'tool_use', name, input }], stop_reason: 'tool_use' }), { status: 200 });
    };
    try {
      const res = await worker.fetch(new Request('https://w/', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': 'er15-' + (++n) }, body: raw }), { ANTHROPIC_API_KEY: 'k' }, {});
      return route.fulfill({ status: res.status, contentType: 'application/json', headers: cors, body: await res.text() });
    } catch (e) { return route.abort(); } finally { globalThis.fetch = realFetch; }
  });
}
// The worker allows 20 marking requests per address in ten minutes.
async function pace() {
  if (!LIVE) return;
  const now = Date.now(), recent = LOG.requests.filter(r => now - r.t0 < 10 * 60 * 1000);
  if (recent.length >= 17) { const wait = 10 * 60 * 1000 - (now - recent[0].t0) + 3000; console.log('  (pacing for the rate limit: ' + Math.round(wait / 1000) + 's)'); await new Promise(r => setTimeout(r, wait)); }
}

// ---- moving about the app ------------------------------------------------------------------------
async function toTest(p) { await p.$$eval('.ash-link', es => es.find(x => /Test mode/i.test(x.textContent)).click()); await settled(p); }
async function ensurePaper(p) {
  await toTest(p);
  if (!(await p.evaluate(n => [...document.querySelectorAll('.tm-paper h2')].some(h => h.textContent.trim() === n), PAPER_NAME))) {
    await p.click('#tmimport'); await settled(p);
    await p.setInputFiles('#tmfile', ROOT + '/tests/fixtures/bus-practice-paper.json'); await settled(p);
    await p.waitForSelector('#tmadd', { timeout: 15000 }); await p.click('#tmadd'); await settled(p);
    await toTest(p);
  }
}
// Extended response practice, these questions only, from a clean start.
async function startPractice(p, picks) {
  await toTest(p);
  // The tile's name opens the overview (Start again lives there); Resume would go straight back in.
  await p.click('[data-tmtypeopen="extended_response"]'); await settled(p);
  if (await has(p, '#tmstartagain')) { await p.click('#tmstartagain'); await settled(p); }
  await p.check('input[name=tmmode][value=choose]'); await settled(p);
  const n = await p.$$eval('.tm-from', (fs2, a) => {
    let n = 0;
    fs2.forEach(f => { const paper = f.querySelector('h3').textContent.trim();
      f.querySelectorAll('[data-tmq]').forEach(b => { const d = b.closest('label').querySelector('.tm-qn').textContent.replace(/^Question\s+/, '').trim();
        const on = paper === a.paper && a.picks.includes(d); if (b.checked !== on) b.click(); if (on) n++; }); });
    return n;
  }, { paper: PAPER_NAME, picks });
  await settled(p);
  await p.click('#tmtypego'); await settled(p);
  await p.waitForSelector('#ans', { timeout: 15000 });
  return n;
}
// Library: Resume practice goes straight back to the saved question (decision 23).
async function resume(p) {
  await toTest(p);
  await p.click('[data-tmtype="extended_response"]'); await settled(p);
  await p.waitForSelector('.exam-qhead', { timeout: 15000 });
}
const qhead = p => text(p, '.exam-qhead');
const boxValue = p => p.$eval('#ans', e => e.value).catch(() => null);

// Type the response as a student does: a misspelt word fixed in place, and a
// phrase left out and then inserted where it belongs. Ends with exactly `final`.
async function typeWithEdits(p, final, step) {
  const typoM = /\b([A-Za-z]{7,})\b/.exec(final);
  const word = typoM[1], wi = typoM.index;
  const typo = word.slice(0, 2) + word[3] + word[2] + word.slice(4);
  const words = [...final.matchAll(/ \S+/g)];
  const k = Math.floor(words.length * 0.6);
  const insAt = words[k].index, insEnd = words[Math.min(k + 2, words.length - 1)].index + words[Math.min(k + 2, words.length - 1)][0].length;
  const phrase = final.slice(insAt, insEnd);
  const typed = final.slice(0, insAt) + final.slice(insEnd);
  const typedTypo = typed.slice(0, wi) + typo + typed.slice(wi + word.length);
  await p.click('#ans');
  await p.keyboard.type(typedTypo, { delay: 0 });
  const t1 = await p.$eval('#ans', e => ({ v: e.value, focus: document.activeElement === e, at: e.selectionStart }));
  check(t1.v === typedTypo && t1.focus && t1.at === typedTypo.length, 'typing: every key landed, focus stayed, caret at the end', step);
  await p.$eval('#ans', (e, a) => { e.focus(); e.setSelectionRange(a.wi, a.wi + a.len); }, { wi, len: typo.length });
  await p.keyboard.type(word, { delay: 2 });
  const t2 = await p.$eval('#ans', e => ({ v: e.value, at: e.selectionStart, focus: document.activeElement === e }));
  check(t2.v === typed && t2.focus && t2.at === wi + word.length, 'editing mid-text: the misspelling fixed in place, caret after it', step);
  await p.$eval('#ans', (e, i) => { e.focus(); e.setSelectionRange(i, i); }, insAt);
  await p.keyboard.type(phrase, { delay: 2 });
  const t3 = await p.$eval('#ans', e => ({ v: e.value, at: e.selectionStart, focus: document.activeElement === e }));
  check(t3.v === final && t3.focus && t3.at === insAt + phrase.length, 'inserting a phrase mid-text: it lands where the caret was', step);
  await p.waitForTimeout(700);   // the app saves a draft 400ms after the last keystroke
  return { typo: [typo, word], inserted: phrase };
}

// What the student is shown about Question 15's result, and what was stored.
async function captureResult(p, key) {
  const dom = await p.evaluate(() => {
    const sheet = document.querySelector('#sheet'); if (!sheet) return { shown: false };
    const r = sheet.querySelector('.tm-result');
    const pr = r && [...r.querySelectorAll('.pair')].find(x => (x.querySelector('.k') || {}).textContent === 'Marks');
    const v = pr && pr.querySelector('.v'); const m = v && /(\d+) of (\d+)/.exec(v.textContent);
    const t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    const mn = sheet.querySelector('.tm-mnote');
    return {
      shown: !!r, nm: !!(r && r.classList.contains('nm')), badge: t(r && r.querySelector('.badge')), marksText: t(v),
      score: m ? Number(m[1]) : null, max: m ? Number(m[2]) : null,
      who: t(mn && mn.querySelector('.who')), summary: mn ? t(mn).replace(t(mn.querySelector('.who')), '').trim() : '',
      criteriaLede: t(sheet.querySelector('.crits') && sheet.querySelector('.crits').previousElementSibling),
      criteria: [...sheet.querySelectorAll('.crits .tm-crit')].map(c => ({ name: t(c.querySelector('.critn')), descriptor: t(c.querySelector('p')) })),
      noticedLede: t([...sheet.querySelectorAll('.tm-sect')].map(s => s.querySelector('.secth')).find(h => h && /noticed/.test(h.textContent)) && [...sheet.querySelectorAll('.tm-sect')].find(s => /noticed/.test(s.querySelector('.secth').textContent)).querySelector('.lede')),
      inResponse: [...sheet.querySelectorAll('.obs .ob')].filter(o => o.querySelector('.ev')).map(o => ({ head: t(o.querySelector('.obh')), quote: (o.querySelector('.ev q') || {}).textContent || '', why: t(o.querySelector(':scope > p')) })),
      across: [...sheet.querySelectorAll('.obs .ob')].filter(o => o.querySelector('.acrossl')).map(o => ({ head: t(o.querySelector('.obh')), why: t(o.querySelector(':scope > p')) })),
      sections: [...sheet.querySelectorAll('.secth')].map(t),
      sheetText: sheet.innerText,
      earlier: t(document.querySelector('.tm-earlier')),
    };
  });
  const st = await store(p), rec = (st.attempts || {})[TK] || {}, a = rec.current || rec.last;
  const k = a ? Object.keys(a.results || {}).concat(Object.keys(a.answers || {})).find(x => x === key || x.endsWith('#' + key)) : null;
  const res = a && k ? a.results[k] : null;
  return Object.assign(dom, { key: k, stored: res || null, graded: a && k && a.answers[k] != null ? String(a.answers[k]) : null,
    status: !res ? 'none' : res.outcome === 'success' ? 'marked' : 'not_marked' });
}
// The rules every marked or unmarked result must keep.
function resultRules(got, reqRec, sent, step) {
  if (got.status === 'marked') {
    check(got.graded === sent, 'the graded snapshot is exactly the text submitted', step);
    check(got.score === got.stored.score && got.max === got.stored.max && got.max === 20, 'the mark shown is the mark stored, out of 20: ' + got.score + '/' + got.max, step);
    check(!!reqRec && reqRec.status === 200 && reqRec.reply && reqRec.reply.score === got.score && norm(reqRec.body.answer) === norm(sent),
      'the mark shown is the grader\'s reply to THIS text (status ' + (reqRec && reqRec.status) + ', reply ' + (reqRec && reqRec.reply && reqRec.reply.score) + ')', step);
    const bad = got.inResponse.filter(o => !sent.includes(o.quote));
    check(!bad.length, '"In your response" quotes only words the student wrote' + (bad.length ? ': ' + JSON.stringify(bad.map(o => o.quote)) : ''), step);
  } else {
    check(got.score == null && (got.status === 'none' || got.nm), 'not marked shows no number', step);
    check(!got.stored || got.stored.outcome !== 'success', 'a failed or refused mark is not stored as a mark', step);
  }
  const minis = /(\b\d+\s*\/\s*\d+\b|\bBand\s*\d|\d+\s*%|\b\d+ of \d+\b|\b\d+ marks?\b)/i;
  const critText = got.criteria.map(c => c.name + ' ' + c.descriptor).join(' | ');
  check(!minis.test(critText), 'no criterion mini-marks, bands or percentages: ' + (critText.match(minis) || [''])[0], step);
  check(!/Economics/.test(got.sheetText || '') && !/Economics/.test(got.who || ''), 'Economics is never named as the subject in the result', step);
}

// Finish practice, then Results and the closed Review of Question 15.
async function finishAndReview(p, step, shotBase, sent) {
  await p.click('#examnav'); await settled(p); await p.click('#tmnavreview'); await settled(p);
  await p.waitForSelector('#tmsubmitpaper', { timeout: 15000 });
  const finishPage = await text(p, '#app');
  await p.click('#tmsubmitpaper'); await settled(p);
  await p.waitForSelector('.tm-rs-cell', { timeout: 15000 });
  const st = await store(p), rec = st.attempts[TK];
  check(!!rec.last && !!rec.last.completedAt && !rec.current, 'Finish practice closed the session', step);
  const items = await p.evaluate(k => { const st = JSON.parse(localStorage.getItem('marginal.trial.v1')); const R = window.MarginalAttempts.results(st.attempts[k].last, st.exams);
    return { items: R.items.map(x => ({ k: x.key, s: x.status, v: x.status === 'marked' ? x.score + ' / ' + x.max : x.status === 'not_marked' ? 'Not marked' : 'Not answered' })) }; }, TK);
  const cells = await p.$$eval('.tm-rs-cell', es => es.map(e => ({ k: e.dataset.tmrv, v: e.querySelector('.v').textContent.trim() })));
  check(cells.length === items.items.length && cells.every((c, i) => c.k === items.items[i].k && c.v === items.items[i].v), 'every Results cell agrees with the closed attempt', step);
  const resultsText = await text(p, '#app');
  await shoot(p, shotBase + '-results.png');
  const ctxBar = await text(p, '.ash-ctx');
  const before = await rawStore(p);
  const cell = cells.find(c => /#3-0$/.test(c.k));
  await p.click('.tm-rs-cell[data-tmrv$="#3-0"]'); await settled(p);
  await p.waitForSelector('.tm-submitted, #tmrvans', { state: 'attached', timeout: 15000 });
  // Open the submitted response so the screenshot shows the words that were graded.
  if (await has(p, '.tm-submitted summary')) { await p.click('.tm-submitted summary'); await settled(p); }
  const rv = await p.evaluate(() => {
    const t = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    const r = document.querySelector('#sheet .tm-result'); const m = r && /(\d+) of (\d+)/.exec(r.textContent);
    const sub = document.querySelector('.tm-submitted .response');
    const answer = sub ? [...sub.querySelectorAll('p')].map(x => x.textContent).join('\n\n') : (document.querySelector('#tmrvans') || {}).textContent || '';
    return { answer, words: t(document.querySelector('.tm-submitted summary')), head: t(document.querySelector('.exam-qhead')), topMark: t(document.querySelector('.tm-top')),
      score: m ? Number(m[1]) : null, max: m ? Number(m[2]) : null, nm: !!(r && r.classList.contains('nm')),
      editable: [...document.querySelectorAll('#app textarea, #app input:not([type=hidden]), #app [contenteditable="true"]')].filter(e => !e.disabled).length,
      actions: ['#examretry', '#check', '#examremark', '#tmsoln'].filter(s => document.querySelector(s)),
      quotes: [...document.querySelectorAll('#sheet .obs .ev q')].map(q => q.textContent), sheet: document.querySelector('#sheet') ? document.querySelector('#sheet').innerText : '',
      bar: t(document.querySelector('.ash-ctx')) };
  });
  await shoot(p, shotBase + '-review.png');
  // Try to type into the review as a student would: nothing may change.
  await p.click('.tm-submitted .response, #tmrvans').catch(() => {}); await p.keyboard.type('xyz', { delay: 0 }); await settled(p);
  const afterType = await p.evaluate(() => { const sub = document.querySelector('.tm-submitted .response'); return sub ? [...sub.querySelectorAll('p')].map(x => x.textContent).join('\n\n') : (document.querySelector('#tmrvans') || {}).textContent || ''; });
  const lastRes = Object.entries(rec.last.results).find(([k]) => /#3-0$/.test(k));
  const lastAns = Object.entries(rec.last.answers).find(([k]) => /#3-0$/.test(k));
  const storedV = lastRes ? (lastRes[1].outcome === 'success' ? lastRes[1].score + ' / ' + lastRes[1].max : 'Not marked') : 'Not answered';
  check(cell && cell.v === storedV, 'Results show what the closed attempt holds for Question 15: ' + (cell && cell.v) + ' vs ' + storedV, step);
  check(lastRes && lastRes[1].outcome === 'success' ? (rv.score === lastRes[1].score && rv.max === lastRes[1].max) : rv.score == null, 'Review shows the same mark as Results', step);
  if (sent != null) check(rv.answer === sent.split(/\n\s*\n/).join('\n\n') && (!lastAns || lastAns[1] === sent), 'Review shows exactly the version graded', step);
  check(!rv.editable && !rv.actions.length && afterType === rv.answer, 'the completed Review is not editable (no box, no Try again, typing changes nothing)', step);
  check(rv.quotes.every(q => (lastAns ? String(lastAns[1]) : '').includes(q)), 'Review quotes only the words graded', step);
  check(/^Business Studies/.test(rv.bar) && !/Economics/.test(rv.bar + ctxBar), 'the bar names Business Studies, never Economics: ' + rv.bar, step);
  await p.click('#tmrvback'); await settled(p);
  check((await rawStore(p)) === before, 'Results and Review changed nothing in the stored attempt', step);
  return { finishPage, resultsText, cells, cell, review: rv, storedV };
}

// ---- one profile, the whole journey ----------------------------------------------------------------
async function profileSession(p, rec, a, opts) {
  opts = opts || {};
  const step = a.id + (opts.tag ? ' (' + opts.tag + ')' : ''); rec.step = step;
  const shot = String(LOG.steps.length + 1).padStart(2, '0') + '-' + a.id + (opts.tag ? '-' + opts.tag : '');
  console.log('--- ' + step);
  const S = { step, id: a.id, kind: a.kind, text: a.text, tag: opts.tag || null };
  const picked = await startPractice(p, ['15']);
  check(picked === 1 && /Question 15/.test(await qhead(p)), 'Extended response practice opens Question 15', step);
  S.prompt = await text(p, '.exam-prompt');
  S.barSitting = await text(p, '.ash-ctx');
  if (opts.quick) { await p.fill('#ans', a.text); await p.waitForTimeout(700); }
  else {
    S.edits = await typeWithEdits(p, a.text, step);
    // Navigate away and back, then reload and resume: nothing is lost.
    await p.click('#examquit'); await settled(p);
    check(/Resume practice/.test(await text(p, '[data-tmtype="extended_response"]')), 'the library offers Resume practice', step);
    await resume(p);
    check((await boxValue(p)) === a.text, 'after leaving and resuming, the draft is exact', step);
    await p.reload(); await settled(p); await p.waitForSelector('.ash-link', { timeout: 20000 });
    await resume(p);
    check(/Question 15/.test(await qhead(p)) && (await boxValue(p)) === a.text, 'after a reload, Resume opens Question 15 with the draft exact', step);
  }
  await pace();
  const nBefore = rec.reqs.length;
  const tClick = Date.now();
  await p.click('#check'); await settled(p);
  S.whilePending = await p.evaluate(() => ({ box: !!(document.querySelector('#ans') || {}).disabled, button: ((document.querySelector('#check') || {}).textContent || '').trim() }));
  await p.waitForFunction(() => !!document.querySelector('#sheet .tm-result'), null, { timeout: 240000 }).catch(() => {});
  S.appSeconds = (Date.now() - tClick) / 1000;
  await settled(p); await p.waitForTimeout(400);
  const r = rec.reqs[nBefore] || null;
  S.request = r ? r.n : null;
  const got = await captureResult(p, '3-0');
  S.result = got;
  S.timing = r ? { diagnosisMs: r.reply && r.reply.checks && r.reply.checks.ms ? r.reply.checks.ms.diagnosis : null, judgementMs: r.reply && r.reply.checks && r.reply.checks.ms ? r.reply.checks.ms.judgement : null,
    requestMs: r.t1 && r.t0 ? r.t1 - r.t0 : null, browserMs: r.timing && r.timing.responseEnd > 0 ? Math.round(r.timing.responseEnd) : null, appSeconds: S.appSeconds } : { appSeconds: S.appSeconds };
  check(S.whilePending.box && /Checking/.test(S.whilePending.button), 'while it is being marked the box is locked and says Checking', step);
  check(rec.reqs.length === nBefore + 1, 'exactly one marking request was sent', step);
  if (r) {
    check(r.body.format === 'extended_response' && r.body.subject && /Business Studies/i.test(String(r.body.subject)) && !/Economics/i.test(String(r.body.subject)), 'the request is an extended response for Business Studies: ' + r.body.format + ' / ' + r.body.subject, step);
    check(Number(r.body.marks) === 20 && norm(r.body.answer) === norm(a.text), 'the request carries 20 marks and exactly the submitted text', step);
  }
  resultRules(got, r, a.text, step);
  await shoot(p, shot + '-marked.png');
  S.shots = { marked: shot + '-marked.png', results: shot + '-results.png', review: shot + '-review.png' };
  S.closed = await finishAndReview(p, step, shot, got.graded);
  LOG.steps.push(S); save();
  return S;
}

// ---- the probes --------------------------------------------------------------------------------------
// A later edit never takes an earlier mark: the unfinished opening is marked,
// then rewritten into the complete response and marked again.
async function probeEdit(p, rec, A, B) {
  const step = 'probe: later edit vs earlier mark'; rec.step = step; console.log('--- ' + step);
  const S = { step, probe: 'edit', first: A.id, second: B.id };
  await startPractice(p, ['15']);
  await p.fill('#ans', A.text); await p.waitForTimeout(700);
  await pace(); let n0 = rec.reqs.length;
  await p.click('#check'); await p.waitForFunction(() => !!document.querySelector('#sheet .tm-result'), null, { timeout: 240000 }).catch(() => {}); await settled(p);
  const g1 = await captureResult(p, '3-0'); S.firstResult = g1; S.firstRequest = (rec.reqs[n0] || {}).n;
  resultRules(g1, rec.reqs[n0], A.text, step + ' (first version)');
  await p.click('#examretry'); await settled(p);
  await p.fill('#ans', B.text); await p.waitForTimeout(700); await settled(p);
  const mid = await captureResult(p, '3-0');
  S.whileEditing = { earlier: mid.earlier, shownScore: mid.score, graded: mid.graded };
  // Straight after Try again the notice reads "Your answer was marked ... Until then,
  // this mark stands"; once redrawn beside different text it says "Your earlier
  // version". Either way no result is shown as this text's.
  check(mid.score == null && !mid.shown && (/earlier version was marked/i.test(mid.earlier) || /submit it again to have a new version marked/i.test(mid.earlier)),
    'beside the edited text no result is shown as this text\'s; the old mark is a notice about the earlier submission: ' + mid.earlier.slice(0, 200), step);
  check(mid.graded === A.text, 'the stored graded version is still the first one until the edit is submitted', step);
  await p.reload(); await settled(p); await p.waitForSelector('.ash-link', { timeout: 20000 }); await resume(p);
  const mid2 = await captureResult(p, '3-0');
  check((await boxValue(p)) === B.text && mid2.score == null && /earlier version/i.test(mid2.earlier), 'after a reload the edit is still the draft and the old mark still belongs to the earlier version', step);
  await shoot(p, String(LOG.steps.length + 1).padStart(2, '0') + '-probe-edit-stale.png');
  await pace(); n0 = rec.reqs.length;
  await p.click('#check'); await p.waitForFunction(() => !!document.querySelector('#sheet .tm-result'), null, { timeout: 240000 }).catch(() => {}); await settled(p);
  const g2 = await captureResult(p, '3-0'); S.secondResult = g2; S.secondRequest = (rec.reqs[n0] || {}).n;
  resultRules(g2, rec.reqs[n0], B.text, step + ' (edited version)');
  check(g2.graded === B.text && (g2.status !== 'marked' || g2.score === (rec.reqs[n0].reply || {}).score), 'the edited version carries its own mark, from its own request', step);
  const shot = String(LOG.steps.length + 1).padStart(2, '0') + '-probe-edit';
  await shoot(p, shot + '-marked.png');
  S.closed = await finishAndReview(p, step, shot, g2.graded);
  LOG.steps.push(S); save();
}
// A reply that arrives after the session was discarded and a new one started
// touches nothing in the new one.
async function probeRestart(p, rec, A) {
  const step = 'probe: late reply after Start again'; rec.step = step; console.log('--- ' + step);
  const S = { step, probe: 'restart', answer: A.id };
  await startPractice(p, ['15']);
  await p.fill('#ans', A.text); await p.waitForTimeout(700);
  await pace(); const n0 = rec.reqs.length;
  const lastBefore = JSON.stringify(((await store(p)).attempts[TK] || {}).last || null);
  await p.click('#check'); await settled(p);
  await p.waitForFunction(n => window.__n === undefined, null).catch(() => {});
  await p.click('#examquit'); await settled(p);
  await startPractice(p, ['15']);
  await p.click('#ans'); await p.keyboard.type('A new start in the new session', { delay: 5 });
  const r = rec.reqs[n0];
  // Wait for the old reply to actually arrive, so the guard is really exercised.
  const t0 = Date.now(); while (r && !r.t1 && Date.now() - t0 < 240000) await p.waitForTimeout(500);
  await p.waitForTimeout(2500); await settled(p);
  S.request = r && r.n; S.replyArrived = !!(r && r.t1); S.replyStatus = r && r.status; S.replyScore = r && r.reply && r.reply.score;
  check(S.replyArrived, 'the abandoned request\'s reply did arrive (status ' + S.replyStatus + '), so the guard was exercised', step);
  const st = await store(p), cur = st.attempts[TK].current;
  const box = await p.$eval('#ans', e => ({ v: e.value, focus: document.activeElement === e, disabled: e.disabled }));
  check(cur && !Object.keys(cur.results || {}).length && !Object.keys(cur.answers || {}).length, 'the new session holds no result and no graded answer', step);
  check(box.v === 'A new start in the new session' && box.focus && !box.disabled && !(await has(p, '#sheet .tm-result')), 'the new session\'s box keeps what was typed, keeps focus, and shows no result', step);
  check(JSON.stringify(st.attempts[TK].last || null) === lastBefore, 'the last finished session is untouched', step);
  await shoot(p, String(LOG.steps.length + 1).padStart(2, '0') + '-probe-restart.png');
  await p.click('#examquit'); await settled(p);
  LOG.steps.push(S); save();
}
// A reply that arrives while the student is on another question is recorded for
// its own question and does not redraw the one being written.
async function probeOther(p, rec, A) {
  const step = 'probe: late reply while on another question'; rec.step = step; console.log('--- ' + step);
  const S = { step, probe: 'other', answer: A.id };
  const n = await startPractice(p, ['15', '16']);
  S.picked = n;
  if (!/Question 15/.test(await qhead(p))) { await p.click('#examnav'); await settled(p); await p.evaluate(() => { const t = [...document.querySelectorAll('[data-tmnav]')].find(c => /15/.test(c.textContent)); t && t.click(); }); await settled(p); }
  await p.fill('#ans', A.text); await p.waitForTimeout(700);
  await pace(); const n0 = rec.reqs.length;
  await p.click('#check'); await settled(p);
  await p.click('#examnext'); await settled(p);
  S.otherHead = await qhead(p);
  check(/Question 16/.test(S.otherHead), 'Next moves to Question 16 while 15 is being marked', step);
  await p.click('#ans'); await p.keyboard.type('Northline set a financial objective of', { delay: 5 });
  S.progressBefore = await text(p, '.tm-prog');
  const r = rec.reqs[n0];
  const t0 = Date.now(); while (r && !r.t1 && Date.now() - t0 < 240000) await p.waitForTimeout(500);
  await p.waitForTimeout(2500); await settled(p);
  S.request = r && r.n; S.replyArrived = !!(r && r.t1);
  S.progressAfter = await text(p, '.tm-prog');
  check(S.replyArrived, 'Question 15\'s reply arrived while Question 16 was open', step);
  const box = await p.$eval('#ans', e => ({ v: e.value, focus: document.activeElement === e, at: e.selectionStart }));
  check(/Question 16/.test(await qhead(p)) && box.v === 'Northline set a financial objective of' && box.focus && box.at === box.v.length && !(await has(p, '#sheet .tm-result')),
    'Question 16 is untouched: same question, same text, focus and caret kept, no result drawn on it', step);
  const st = await store(p), cur = st.attempts[TK].current;
  const k16 = Object.keys(cur.results || {}).find(k => /#3-1$/.test(k)), k15 = Object.keys(cur.results || {}).find(k => /#3-0$/.test(k));
  check(!k16, 'no result was recorded against Question 16', step);
  check(!!k15 && cur.answers[k15] === A.text, 'Question 15\'s result was recorded for Question 15, for the text submitted', step);
  await shoot(p, String(LOG.steps.length + 1).padStart(2, '0') + '-probe-other.png');
  await p.click('#examprev'); await settled(p);
  const got = await captureResult(p, '3-0'); S.result = got;
  resultRules(got, r, A.text, step);
  S.closed = await finishAndReview(p, step, String(LOG.steps.length + 1).padStart(2, '0') + '-probe-other', got.graded);
  LOG.steps.push(S); save();
}
// The student leaves an answer unmarked and finishes; the reply that comes later
// does not rewrite the closed session.
async function probeLeave(p, rec, A) {
  const step = 'probe: leave unmarked, then the reply arrives'; rec.step = step; console.log('--- ' + step);
  const S = { step, probe: 'leave', answer: A.id };
  await startPractice(p, ['15']);
  await p.fill('#ans', A.text); await p.waitForTimeout(700);
  await pace(); const n0 = rec.reqs.length;
  await p.click('#check'); await settled(p);
  await p.click('#examnav'); await settled(p); await p.click('#tmnavreview'); await settled(p);
  await p.waitForSelector('[data-tmleave]', { timeout: 15000 }).catch(() => {});
  S.reviewPage = await text(p, '#app');
  const canLeave = await has(p, '[data-tmleave]');
  check(canLeave, 'Review & finish offers Leave it unmarked while 15 is being marked', step);
  if (canLeave) { await p.click('[data-tmleave]'); await settled(p); }
  await p.click('#tmsubmitpaper'); await settled(p);
  await p.waitForSelector('.tm-rs-cell', { timeout: 15000 });
  const closedBefore = JSON.stringify((await store(p)).attempts[TK].last);
  const r = rec.reqs[n0];
  const t0 = Date.now(); while (r && !r.t1 && Date.now() - t0 < 240000) await p.waitForTimeout(500);
  await p.waitForTimeout(2500); await settled(p);
  S.request = r && r.n; S.replyArrived = !!(r && r.t1); S.replyStatus = r && r.status; S.replyScore = r && r.reply && r.reply.score;
  check(S.replyArrived, 'the reply arrived after the session was finished (status ' + S.replyStatus + ', score ' + S.replyScore + ')', step);
  const st = await store(p);
  check(JSON.stringify(st.attempts[TK].last) === closedBefore, 'the closed session is not rewritten by the late reply', step);
  const cell = await p.$eval('.tm-rs-cell[data-tmrv$="#3-0"] .v', e => e.textContent.trim()).catch(() => '');
  check(cell === 'Not marked', 'Results still read Not marked for 15: ' + cell, step);
  const shot = String(LOG.steps.length + 1).padStart(2, '0') + '-probe-leave';
  await shoot(p, shot + '-results.png');
  await p.click('.tm-rs-cell[data-tmrv$="#3-0"]'); await settled(p);
  S.reviewSheet = await text(p, '#sheet');
  check(/Not marked/.test(S.reviewSheet) && !/\d+ of 20/.test(S.reviewSheet) && !(await has(p, '#examremark')), 'Review: not marked, no number, no retry', step);
  await shoot(p, shot + '-review.png');
  await p.click('#tmrvback'); await settled(p);
  LOG.steps.push(S); save();
}

// ---- the run -------------------------------------------------------------------------------------------
const PLAN = BENCH.answers.concat(['repeat:er15-strong-reworded', 'probe:edit', 'probe:restart', 'probe:other', 'probe:leave']);
(async () => {
  const ANS = {};
  for (const a of ITEM.answers) {
    if (!BENCH.sha256[a.id]) continue;
    if (crypto.createHash('sha256').update(a.text).digest('hex') !== BENCH.sha256[a.id]) throw new Error('a frozen benchmark text has changed: ' + a.id);
    ANS[a.id] = { id: a.id, kind: a.kind, text: a.text, sha256: BENCH.sha256[a.id] };
  }
  const only = (process.env.MARGINAL_BOTS_ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
  const STEPS = only.length ? only : TIMING ? BENCH.timing.map(id => 'timing:' + id) : PLAN;
  LOG.steps_planned = STEPS; LOG.corpus = { version: CORPUS.version, frozenAt: BENCH.frozenAt };
  const proxy = (DEPLOYED || LIVE) && process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {};
  const args = process.env.MARGINAL_CA_SPKI ? ['--ignore-certificate-errors-spki-list=' + process.env.MARGINAL_CA_SPKI] : [];
  const b = await pw.chromium.launch(Object.assign({ args }, EXE ? { executablePath: EXE } : {}, proxy));
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const rec = { reqs: [], step: null, errs: [], dialogs: [] };
  p.on('pageerror', e => { rec.errs.push(String(e).slice(0, 200)); LOG.errors.push({ step: rec.step, page: String(e).slice(0, 300) }); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon\.ico/.test(((m.location() || {}).url) || '')) LOG.errors.push({ step: rec.step, console: m.text().slice(0, 300) }); });
  p.on('dialog', d => { rec.dialogs.push(d.message()); d.accept(); });
  await wire(p, rec);
  await p.goto(SITE, { waitUntil: 'load', timeout: 60000 }); await p.waitForSelector('.ash-link', { timeout: 20000 }); await settled(p);
  LOG.who = await text(p, '.ash-who');
  await ensurePaper(p);
  try {
    for (const s of STEPS) {
      const [kind, arg, arg2] = s.split(':');
      try {
        if (kind === 'probe' && arg === 'edit') await probeEdit(p, rec, ANS['er15-unfinished'], ANS['er15-middle']);
        else if (kind === 'probe' && arg === 'restart') await probeRestart(p, rec, ANS[arg2 || 'er15-weak']);
        else if (kind === 'probe' && arg === 'other') await probeOther(p, rec, ANS[arg2 || 'er15-strong']);
        else if (kind === 'probe' && arg === 'leave') await probeLeave(p, rec, ANS[arg2 || 'er15-name-drop']);
        else if (kind === 'repeat') await profileSession(p, rec, ANS[arg], { tag: 'repeat', quick: true });
        else if (kind === 'timing') await profileSession(p, rec, ANS[arg], { tag: 'timing', quick: true });
        else if (ANS[kind]) await profileSession(p, rec, ANS[kind]);
        else throw new Error('no such step: ' + s);
      } catch (e) {
        console.log('STEP CRASHED', s, String(e).slice(0, 400));
        LOG.errors.push({ step: s, crash: String(e.stack || e).slice(0, 1500) });
        check(false, 'step completed without crashing: ' + s, s);
        await p.screenshot({ path: path.join(OUT, 'crash-' + s.replace(/[^a-z0-9-]/gi, '_') + '.png'), fullPage: true }).catch(() => {});
        await p.goto(SITE, { waitUntil: 'load', timeout: 60000 }).catch(() => {}); await p.waitForSelector('.ash-link', { timeout: 20000 }).catch(() => {});
      }
      save();
    }
  } finally {
    check(!LOG.errors.filter(e => e.page).length, 'no page errors: ' + JSON.stringify(LOG.errors.filter(e => e.page)));
    LOG.dialogs = rec.dialogs;
    LOG.finished = new Date().toISOString(); LOG.pass = PASS; LOG.fail = FAIL;
    save();
    await ctx.close(); await b.close();
  }
  const A = require('./er-analyze.js');
  const analysis = A.analyze(LOG, CORPUS, A.baseline());
  fs.writeFileSync(path.join(OUT, 'analysis.json'), JSON.stringify(analysis, null, 1));
  console.log(A.summary(analysis));
  console.log('\n' + PASS + ' passed, ' + FAIL + ' failed · ' + LOG.requests.length + ' marking requests · ' + path.relative(ROOT, OUT));
  process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('RUN CRASHED', e); process.exit(2); });
