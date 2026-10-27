// THE EXTENDED RESPONSE BENCHMARK, ANALYSED. Pure functions over a run's record
// (what er-benchmark.js writes as run.json) and corpus v3: no clock, no network,
// no randomness, so the same run always gives the same analysis. tests/t41.mjs
// holds the rules, and er15-baseline.run2.json is this analysis of Run 2, cut
// down to what a later run is compared with.
//
//   node tests/bots/testmode/er-analyze.js <run.json>   # analyse a saved run
const fs = require('fs'), path = require('path');

// What the student must never be shown in Test Mode feedback, by the rules the
// app itself applies since PR #74 (app.js TM_BAND, TM_BAND_PLAIN, tmMarkerText):
// - band language in any form ("Band 4", "Band6", "the upper bands", a bare
//   "B6"), but not the subjects' own ordinary uses of the word ("target band",
//   "age band"), which the app keeps;
// - glossary markup, closed or not; after the app's brace strip a leak would
//   show as a pipe between words;
// - a mark for anything but the whole response: "4 of 5", "3/5", "2 out of 4",
//   and a percentage beside a criterion. The whole response's own mark ("17 of
//   20") is removed before looking, and a percentage in feedback prose is the
//   case's own figures ("share rose to 11%").
// On Run 2's raw record these count exactly what the earlier, looser definitions
// counted (band 12, markup 60, mini-marks 0), so the baseline still compares
// like with like.
const BAND = /\bbands?(?![a-z])|\bB[1-6]\b/i;
const BAND_PLAIN = /\b(?:target|income|pay|salary|wage|tax|price|age|tolerance|trading|frequency)[- ]bands?\b/gi;
const MINI = /\b\d+\s*\/\s*\d+\b|\b\d+\s+out of\s+\d+\b|\b\d+ of \d+\b/i;
const PERCENT = /\d+\s*%/;
const MARKUP = /[{}]|\S\|\S/;
const ECONOMICS = /\bEconomics\b/;

const timed = r => !!r && Number.isFinite(r.t0) && Number.isFinite(r.t1);
const validMark = r => !!r && r.status === 'marked' && Number.isFinite(r.score) && Number.isFinite(r.max) && r.score >= 0 && r.score <= r.max;
const stripMarks = (s, total) => String(s || '').replace(new RegExp('\\b\\d+ of ' + total + '( marks?)?\\b', 'g'), '')
  .replace(new RegExp('\\b\\d+\\s*\\/\\s*' + total + '\\b', 'g'), '').replace(/\b\d+ of \d+ answered\b/g, '');
// A usable mark, by the app's own test (app.js invalidMarkerReply): a 200 whose
// reply is an object with no error, a whole-number score from 0 to max, and max
// equal to the question's marks. Anything else is not a mark, and for timing it
// never arrived. er-latency.js uses this same rule.
const usableMark = (status, reply, marks) => status === 200 && !!reply && typeof reply === 'object' && !Array.isArray(reply) && reply.error == null &&
  Number.isInteger(reply.score) && typeof reply.max === 'number' && reply.max === Math.round(Number(marks)) && reply.score >= 0 && reply.score <= reply.max;
const usableRequest = r => timed(r) && usableMark(r.status, r.reply, r.body && r.body.marks);

// What one marked result shows the student, checked against the rules.
function shown(res, graded, authored) {
  const obs = (res.inResponse || []).map(o => Object.assign({ placement: 'in' }, o)).concat((res.across || []).map(o => Object.assign({ placement: 'across' }, o)));
  const texts = [res.summary || ''].concat(obs.map(o => (o.head || '') + ' ' + (o.why || '')));
  const crit = (res.criteria || []).map(c => c.name + ' ' + (c.descriptor || ''));
  const total = Number.isFinite(Number(res.max)) && Number(res.max) > 0 ? Number(res.max) : 20;
  const g = String(graded || '');
  return {
    observations: obs.length,
    inResponse: (res.inResponse || []).length,
    across: (res.across || []).length,
    emptyQuotes: (res.inResponse || []).filter(o => !String(o.quote || '').trim()).length,
    unverifiedQuotes: (res.inResponse || []).filter(o => String(o.quote || '').trim() && !g.includes(o.quote)).length,
    markup: texts.filter(t => MARKUP.test(t)).length,
    bands: texts.filter(t => BAND.test(t.replace(BAND_PLAIN, ''))).length,
    miniMarks: texts.filter(t => MINI.test(stripMarks(t, total))).length + crit.filter(t => MINI.test(stripMarks(t, total)) || PERCENT.test(t)).length,
    economics: ECONOMICS.test(res.sheetText || texts.join(' ')),
    criteria: (res.criteria || []).map(c => c.name),
    // The names on screen are the subject package's own, in its order (state 12).
    criteriaAuthored: Array.isArray(authored) ? JSON.stringify((res.criteria || []).map(c => c.name)) === JSON.stringify(authored) : null,
  };
}

// The text each request was for, by matching the words sent to the frozen texts.
function idOf(text, corpus) {
  const t = String(text || '').trim();
  const item = corpus.items.find(i => i.question === corpus.benchmarks.er15.question);
  const a = item.answers.find(x => (x.text || '').trim() === t);
  return a ? a.id : null;
}
function pct(xs, p) {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}
function compare(op, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (op === '>') return x > y;
  if (op === '>=') return x >= y;
  if (op === 'within 2 of') return Math.abs(x - y) <= 2;
  throw new Error('unknown comparison ' + op);
}
// The comparisons set down before the run, on the first mark each answer got.
function orderings(marks, bench) {
  const one = list => list.map(c => ({ a: c.a, op: c.op, b: c.b, why: c.why || null, marks: [marks[c.a] ?? null, marks[c.b] ?? null], ok: compare(c.op, marks[c.a], marks[c.b]) }));
  return { hard: one(bench.hard), soft: one(bench.soft) };
}

function analyze(run, corpus, baseline) {
  const bench = corpus.benchmarks.er15;
  const req = n => (run.requests || []).find(r => r.n === n) || null;
  const profiles = [];
  for (const s of run.steps || []) {
    if (s.probe || !s.id || !s.result) continue;
    const r = req(s.request), ms = r && r.reply && r.reply.checks && r.reply.checks.ms;
    const res = s.result;
    profiles.push({
      id: s.id, tag: s.tag || null, status: res.status, mark: validMark(res) ? res.score : null, max: res.max,
      badge: res.badge || null, summary: res.summary || null, why: res.status === 'marked' ? null : ((res.stored || {}).why || null),
      criteria: res.criteria || [], inResponse: res.inResponse || [], across: res.across || [],
      shown: res.status === 'marked' ? shown(res, res.graded, r && r.body && r.body.criteria) : null,
      gradedIsTheText: res.graded == null ? null : res.graded === (s.text || ''),
      timing: { diagnosisMs: ms ? ms.diagnosis : null, judgementMs: ms ? ms.judgement : null, requestMs: timed(r) ? r.t1 - r.t0 : null,
        diagnosisCapped: !!ms && ms.diagnosis >= 19990, replyStatus: r ? r.status : null, replyError: r && r.reply && r.reply.error || null, failure: r ? r.failure : null },
      results: s.closed && s.closed.cell ? s.closed.cell.v : null,
      reviewMark: s.closed && s.closed.review ? s.closed.review.score : null,
    });
  }
  const first = {};
  for (const p of profiles) if (!p.tag && !(p.id in first)) first[p.id] = p;
  const marks = Object.fromEntries(Object.entries(first).map(([id, p]) => [id, p.mark]));
  // Every mark each text got, from any step: profiles, repeats and probes.
  const allMarks = {};
  for (const r of run.requests || []) {
    const id = idOf(r.body && r.body.answer, corpus); if (!id) continue;
    (allMarks[id] = allMarks[id] || []).push({ n: r.n, status: r.status, score: r.reply && Number.isFinite(r.reply.score) ? r.reply.score : null, failure: r.failure || (r.reply && r.reply.error) || null });
  }
  // Every marked result the student saw, profiles and probes alike.
  const seen = profiles.filter(p => p.status === 'marked').map(p => p.shown);
  const sentCriteria = ((run.requests || []).find(r => r.body && Array.isArray(r.body.criteria)) || { body: {} }).body.criteria;
  for (const s of run.steps || []) if (s.probe) for (const k of ['result', 'firstResult', 'secondResult']) if (s[k] && s[k].status === 'marked') seen.push(shown(s[k], s[k].graded, sentCriteria));
  const sum = k => seen.reduce((n, x) => n + (typeof x[k] === 'number' ? x[k] : x[k] ? 1 : 0), 0);
  const display = { results: seen.length, observations: sum('observations'), inResponse: sum('inResponse'), across: sum('across'), emptyQuotes: sum('emptyQuotes'),
    unverifiedQuotes: sum('unverifiedQuotes'), markup: sum('markup'), bands: sum('bands'), miniMarks: sum('miniMarks'), economics: sum('economics'),
    resultsWithBands: seen.filter(x => x.bands).length, resultsWithMarkup: seen.filter(x => x.markup).length,
    criteriaNotAuthored: seen.filter(x => x.criteriaAuthored === false).length };
  // p50, p95 and the rest describe the replies that were usable marks. The
  // latency target is judged on the timing answers alone, and there a request
  // with no usable mark counts as never arriving: it sorts last, so a marker that
  // fails cannot meet the target by failing fast or by dropping out.
  const done = (run.requests || []).filter(usableRequest);
  const totals = done.map(r => r.t1 - r.t0);
  const passes = done.filter(r => r.reply.checks && r.reply.checks.ms);
  const timingIds = new Set(bench.timing);
  const timingReqs = (run.requests || []).filter(r => timingIds.has(idOf(r.body && r.body.answer, corpus)));
  const arrival = timingReqs.map(r => usableRequest(r) ? r.t1 - r.t0 : Infinity);
  const tp = pct(arrival, bench.latencyTarget.percentile);
  const timing = {
    requests: (run.requests || []).length, usable: done.length,
    failed: (run.requests || []).filter(r => !usableRequest(r)).map(r => ({ n: r.n, status: r.status, error: (r.reply && r.reply.error) || r.failure || null, ms: timed(r) ? r.t1 - r.t0 : null })),
    p50: pct(totals, 50), p95: pct(totals, 95), max: totals.length ? Math.max(...totals) : null,
    judgementP50: pct(passes.map(r => r.reply.checks.ms.judgement), 50), diagnosisCapped: passes.filter(r => r.reply.checks.ms.diagnosis >= 19990).length,
    under45: totals.filter(t => t < 45000).length, under40: totals.filter(t => t < 40000).length,
    timingAnswers: { usable: arrival.filter(Number.isFinite).length, p95: Number.isFinite(tp) ? tp : null, meetsTarget: timingReqs.length ? tp < bench.latencyTarget.seconds * 1000 : null, n: timingReqs.length },
  };
  const out = { corpus: { version: corpus.version, frozenAt: bench.frozenAt }, run: { mode: run.mode, site: run.site, started: run.started, finished: run.finished, checks: (run.checks || []).length, failedChecks: (run.checks || []).filter(c => !c.ok) },
    profiles, marks, allMarks, orderings: orderings(marks, bench), display, timing };
  if (baseline && run.mode === 'live') out.vsBaseline = against(out, baseline);
  return out;
}

// What changed since the baseline: marks, comparisons, what the student sees, time.
function against(a, base) {
  const ids = Object.keys(base.marks);
  return {
    baseline: base.label,
    marks: ids.map(id => ({ id, then: base.marks[id], now: a.marks[id] ?? null, change: Number.isFinite(a.marks[id]) && Number.isFinite(base.marks[id]) ? a.marks[id] - base.marks[id] : null,
      evaluator: base.evaluator && base.evaluator[id] ? base.evaluator[id].fairMark : null })),
    hard: a.orderings.hard.map((c, i) => ({ a: c.a, op: c.op, b: c.b, then: base.orderings.hard[i] ? base.orderings.hard[i].ok : null, now: c.ok })),
    display: Object.fromEntries(Object.keys(base.display).map(k => [k, { then: base.display[k], now: a.display[k] }])),
    timing: { p50: { then: base.timing.p50, now: a.timing.p50 }, p95: { then: base.timing.p95, now: a.timing.p95 }, diagnosisCapped: { then: base.timing.diagnosisCapped, now: a.timing.diagnosisCapped } },
  };
}

function baseline() { return JSON.parse(fs.readFileSync(path.join(__dirname, 'er15-baseline.run2.json'), 'utf8')); }

function summary(a) {
  const L = ['Extended Response benchmark · corpus v' + a.corpus.version + ' · ' + a.run.mode + ' · ' + a.run.checks + ' checks, ' + a.run.failedChecks.length + ' failed', ''];
  for (const p of a.profiles) L.push('  ' + (p.id + (p.tag ? ' (' + p.tag + ')' : '')).padEnd(34) + (p.status === 'marked' ? String(p.mark).padStart(2) + '/20' : p.status.padEnd(5)) +
    (p.timing.requestMs != null ? '  ' + (p.timing.requestMs / 1000).toFixed(1) + ' s' + (p.timing.diagnosisCapped ? ' (diagnosis capped)' : '') : ''));
  L.push('');
  for (const c of a.orderings.hard) L.push('  ' + (c.ok === null ? 'n/a ' : c.ok ? 'pass' : 'FAIL') + '  ' + c.a + ' ' + c.op + ' ' + c.b + '  ' + JSON.stringify(c.marks));
  const d = a.display;
  L.push('', '  shown: ' + d.results + ' marked results, ' + d.observations + ' observations; empty quotes ' + d.emptyQuotes + ', unverified quotes ' + d.unverifiedQuotes +
    ', markup ' + d.markup + ', band language ' + d.bands + ', mini-marks ' + d.miniMarks + ', across ' + d.across + ', criteria not the authored ones in ' + d.criteriaNotAuthored + ' results');
  const t = a.timing;
  const sec = ms => ms == null ? 'n/a' : (ms / 1000).toFixed(1) + ' s';
  L.push('  time: ' + t.usable + ' of ' + t.requests + ' usable; p50 ' + sec(t.p50) + ', p95 ' + sec(t.p95) + '; under 40 s: ' + t.under40 + '; diagnosis capped: ' + t.diagnosisCapped);
  const ta = t.timingAnswers;
  if (ta.n) L.push('  timing answers: ' + ta.usable + ' of ' + ta.n + ' usable; p95 ' + (ta.p95 == null ? 'not met (a request had no usable mark)' : sec(ta.p95)) + (ta.meetsTarget ? ', meets the target' : ', misses the target'));
  if (a.vsBaseline) L.push('  vs ' + a.vsBaseline.baseline + ': ' + a.vsBaseline.marks.filter(m => m.change).map(m => m.id.replace('er15-', '') + ' ' + (m.change > 0 ? '+' : '') + m.change).join(', '));
  return L.join('\n');
}

module.exports = { analyze, orderings, compare, shown, idOf, pct, against, baseline, summary, validMark, usableMark };

if (require.main === module) {
  const run = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const corpus = require('./corpus.v3.json');
  console.log(summary(analyze(run, corpus, baseline())));
}
