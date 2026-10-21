// HOW LONG AN EXTENDED RESPONSE TAKES TO MARK: the benchmark's three timing
// answers (about 400, 800 and 1,200 words, `benchmarks.er15.timing` in
// corpus.v3.json) sent straight to a marking worker, one request at a time.
//
// The target (`latencyTarget`) is that 95% of usable marks arrive within 40
// seconds. A request is usable only when it comes back 200 with a whole-number
// mark from 0 to the marks available; anything else counts as never arriving.
//
// The bodies are the ones this checkout's app sends, recorded by an offline run
// of the harness, so nothing here builds a marking request by hand:
//
//   node tests/bots/testmode/er-benchmark.js --timing          # 1. record the bodies
//   MARGINAL_WORKER=https://<worker> node tests/bots/testmode/er-latency.js [run.json]
//
// With no run.json, the newest offline timing run under tests/out/bots/er15 is used.
//
// MARGINAL_VARIANTS (default lean1,lean2), each answer sent once per variant per round:
//   lean1  contract testmode-extended-1, one pass
//   lean2  the same with passes: 2 (diagnosis first), for measuring only
//   full   no contract: the full review the worker gives every other request
//   asis   the body exactly as the app sent it
// MARGINAL_REPEAT (default 5) rounds, interleaved so drift falls on every variant.
//
// This spends real marking credits and is paced under the worker's 20 requests per
// address in ten minutes. It is an explicit quality command, never part of the Fast
// or Checkpoint gates. The class code the app ships with is put back into each
// body and is never written out. Writes tests/out/bots/er15/latency-<time>/latency.json.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const ENV = require(path.join(ROOT, 'tests', 'env.js'));
const A = require('./er-analyze.js');
const CORPUS = require('./corpus.v3.json');
const BENCH = CORPUS.benchmarks.er15;
const TARGET_MS = BENCH.latencyTarget.seconds * 1000, PCT = BENCH.latencyTarget.percentile;
const WORKER = process.env.MARGINAL_WORKER;
const VARIANTS = (process.env.MARGINAL_VARIANTS || 'lean1,lean2').split(',').map(s => s.trim()).filter(Boolean);
const REPEAT = Number(process.env.MARGINAL_REPEAT || 5);
const REQUEST_MS = 240000;
// A stand-in worker on this machine has no rate limit to pace under.
const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(WORKER || '');
const SHAPE = {
  lean1: b => Object.assign({}, b, { contract: 'testmode-extended-1', passes: undefined }),
  lean2: b => Object.assign({}, b, { contract: 'testmode-extended-1', passes: 2 }),
  full: b => Object.assign({}, b, { contract: undefined, passes: undefined }),
  asis: b => b,
};

function newestTimingRun() {
  const dir = path.join(ENV.OUT, 'bots', 'er15');
  const runs = (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter(d => /^dry-/.test(d)).sort().reverse()
    .map(d => path.join(dir, d, 'run.json')).filter(f => fs.existsSync(f));
  return runs.find(f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')).requests.some(r => BENCH.timing.includes(A.idOf(r.body && r.body.answer, CORPUS))); } catch (e) { return false; } });
}
// The class code the app ships with (index.html), as the app itself sends it.
function classCode() {
  const m = /code:\s*"([^"]*)"/.exec(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'));
  return m ? m[1] : undefined;
}
const usableMark = (status, reply, marks) => status === 200 && !!reply && reply.error == null && Number.isInteger(reply.score) && reply.score >= 0 && reply.score <= marks;

async function send(body) {
  const t0 = Date.now();
  let status = null, headersMs = null, reply = null, failure = null, bytes = 0;
  try {
    const res = await fetch(WORKER, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://willwint2104.github.io' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(REQUEST_MS) });
    status = res.status; headersMs = Date.now() - t0;
    const text = await res.text(); bytes = text.length;
    try { reply = JSON.parse(text); } catch (e) { failure = 'unreadable reply'; }
  } catch (e) { failure = String(e && e.name === 'TimeoutError' ? 'no reply within ' + REQUEST_MS / 1000 + ' s' : e).slice(0, 160); }
  return { status, headersMs, totalMs: Date.now() - t0, reply, failure, bytes };
}

function summarise(rows, variants) {
  const ms = xs => xs.filter(Number.isFinite);
  const mean = xs => { const v = ms(xs); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const group = (rs) => {
    // A request that never gave a usable mark never arrived: it sorts last.
    const arrival = rs.map(r => r.usable ? r.totalMs : Infinity);
    const p95 = A.pct(arrival, PCT);
    return { n: rs.length, usable: rs.filter(r => r.usable).length, p50: A.pct(arrival, 50), p95: Number.isFinite(p95) ? p95 : null,
      max: rs.length ? Math.max(...arrival) : null, meetsTarget: rs.length ? p95 < TARGET_MS : null,
      diagnosisMs: mean(rs.map(r => r.ms && r.ms.diagnosis)), judgementMs: mean(rs.map(r => r.ms && r.ms.judgement)),
      diagnosisSkipped: rs.filter(r => r.diagnosisState === 'skipped').length,
      inputTokens: mean(rs.map(r => r.usage && r.usage.input)), outputTokens: mean(rs.map(r => r.usage && r.usage.output)),
      models: [...new Set(rs.map(r => r.model).filter(Boolean))], contracts: [...new Set(rs.map(r => r.contract))], statuses: rs.map(r => r.status) };
  };
  const out = {};
  for (const v of variants) {
    const rv = rows.filter(r => r.variant === v);
    out[v] = { all: group(rv) };
    for (const id of BENCH.timing) out[v][id] = group(rv.filter(r => r.answer === id));
  }
  return out;
}

module.exports = { usableMark, summarise };
if (require.main === module) (async () => {
  if (!WORKER) throw new Error('set MARGINAL_WORKER to the marking worker to measure');
  const unknown = VARIANTS.filter(v => !SHAPE[v]); if (unknown.length) throw new Error('no such variant: ' + unknown);
  const src = process.argv[2] || newestTimingRun();
  if (!src) throw new Error('no recorded bodies: run `node tests/bots/testmode/er-benchmark.js --timing` first, or pass its run.json');
  const run = JSON.parse(fs.readFileSync(src, 'utf8'));
  const code = classCode();
  const bodies = {};
  for (const r of run.requests) {
    const id = A.idOf(r.body && r.body.answer, CORPUS);
    if (BENCH.timing.includes(id) && !bodies[id]) bodies[id] = Object.assign({}, r.body, { code: r.body.code === undefined ? undefined : code });
  }
  const missing = BENCH.timing.filter(id => !bodies[id]);
  if (missing.length) throw new Error(src + ' holds no request for ' + missing.join(', '));
  const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
  const OUT = path.join(ENV.OUT, 'bots', 'er15', 'latency-' + STAMP);
  fs.mkdirSync(OUT, { recursive: true });
  const log = { started: new Date().toISOString(), worker: WORKER, bodiesFrom: path.relative(ROOT, src), variants: VARIANTS, repeat: REPEAT,
    target: BENCH.latencyTarget, words: Object.fromEntries(BENCH.timing.map(id => [id, BENCH.words[id]])), rows: [] };
  const save = () => fs.writeFileSync(path.join(OUT, 'latency.json'), JSON.stringify(log, null, 1));
  const sentAt = [];
  for (let round = 1; round <= REPEAT; round++) {
    for (const id of BENCH.timing) {
      for (const v of VARIANTS) {
        const now = Date.now(), recent = sentAt.filter(t => now - t < 10 * 60 * 1000);
        if (!LOCAL && recent.length >= 17) { const wait = 10 * 60 * 1000 - (now - recent[0]) + 3000; console.log('  (pacing for the rate limit: ' + Math.round(wait / 1000) + 's)'); await new Promise(r => setTimeout(r, wait)); }
        sentAt.push(Date.now());
        const body = SHAPE[v](bodies[id]);
        const r = await send(body);
        const c = (r.reply && r.reply.checks) || {};
        const row = { round, answer: id, words: BENCH.words[id], variant: v, status: r.status, headersMs: r.headersMs, totalMs: r.totalMs,
          usable: usableMark(r.status, r.reply, Number(body.marks)), score: r.reply && Number.isInteger(r.reply.score) ? r.reply.score : null,
          contract: c.contract || null, passes: c.passes == null ? null : c.passes, diagnosis: c.diagnosis || null, diagnosisState: c.diagnosisState || null, ms: c.ms || null,
          model: c.model || null, usage: c.usage || null, bytes: r.bytes,
          failure: r.failure || (r.reply && r.reply.error ? String(r.reply.error).slice(0, 160) : null) };
        log.rows.push(row); save();
        console.log([round, id, v, row.status, (row.totalMs / 1000).toFixed(1) + ' s', row.usable ? row.score + '/' + body.marks : 'not usable',
          row.ms ? 'diag ' + row.ms.diagnosis + ' ms, judge ' + row.ms.judgement + ' ms' : '', row.usage ? 'out ' + row.usage.output + ' tok' : '', row.failure || ''].filter(Boolean).join('  '));
      }
    }
  }
  log.finished = new Date().toISOString();
  log.summary = summarise(log.rows, VARIANTS);
  save();
  console.log('\n' + PCT + 'th percentile of usable marks (target under ' + BENCH.latencyTarget.seconds + ' s):');
  for (const v of VARIANTS) {
    const s = log.summary[v];
    console.log('  ' + v + ': ' + BENCH.timing.map(id => id.replace('er15-len-', '') + ' words ' + (s[id].p95 == null ? 'not met' : (s[id].p95 / 1000).toFixed(1) + ' s') + ' (' + s[id].usable + '/' + s[id].n + ' usable)').join(', ')
      + '; all ' + (s.all.p95 == null ? 'not met' : (s.all.p95 / 1000).toFixed(1) + ' s') + (s.all.meetsTarget ? ', meets the target' : ', misses the target'));
  }
  console.log('\n' + path.relative(ROOT, path.join(OUT, 'latency.json')));
})().catch(e => { console.error('LATENCY RUN FAILED', String(e && e.message || e)); process.exit(2); });
