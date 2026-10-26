// THE EXTENDED RESPONSE BENCHMARK IS FROZEN (tests/bots/testmode/corpus.v3.json,
// `benchmarks.er15`; er-analyze.js; er15-baseline.run2.json).
//
// Bots Run 2 measured Question 15 against expectations written down before any
// live marking. Its value is that the same words go in every time and are judged
// by the same rules, so a later marker can be compared with this one. This suite
// holds what makes that true: version 3 keeps every version 2 answer word for
// word, every benchmark text still has the hash it was frozen with, the
// comparisons name real answers, the analysis is a pure function, a missing mark
// satisfies no comparison, and the Run 2 baseline is consistent with the code
// that reads it. Node only, Full tier; the benchmark itself is run on demand.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIR = path.join(ROOT, 'tests/bots/testmode');
const V2 = JSON.parse(fs.readFileSync(path.join(DIR, 'corpus.v2.json'), 'utf8'));
const V3 = JSON.parse(fs.readFileSync(path.join(DIR, 'corpus.v3.json'), 'utf8'));
const BASE = JSON.parse(fs.readFileSync(path.join(DIR, 'er15-baseline.run2.json'), 'utf8'));
const A = require(path.join(DIR, 'er-analyze.js'));
const B = V3.benchmarks && V3.benchmarks.er15;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const sha = t => crypto.createHash('sha256').update(t).digest('hex');

// THE FROZEN VALUES, PINNED HERE. The corpus records its own hashes, and those
// alone cannot catch a text edited together with its hash, or an expectation
// edited with the baseline. These literals were taken from the corpus and the
// baseline as they were frozen; changing any of them is a change to this file,
// and so shows up in review.
const FROZEN_SHA256 = {
  'er15-case-heavy': '5eacd148891d92ecd0bb068d53a80cee1db056e2f23e75f57ea12e70c686e84d', 'er15-descriptive': '1a4999da3e1a16bf6cff8622e5fc1c73338caee83b55f75a137fa34b3eb134d9',
  'er15-len-1200': '4083822b73128114693bce2d58f87f89e4207806fe9fe51d497e04c5b07cbe7e', 'er15-len-400': 'bffd61a02b8529efc9a6fca30f0a52b0f544121441b71d50960ffe760798fad6',
  'er15-len-800': '34885b2e6f3da9060a095230ad1dd07bb516570d82799facc91f10d46ff8e985', 'er15-middle': '07fcd95dcc7e4587002cea553b15a067128b14d99641381533e01d87c72c4380',
  'er15-misconception': '6527f2c6804bd980751332cce430f7d0bcf48d969423352feb95487854c49d53', 'er15-name-drop': '84785d0e359d90b7868ddd58f436befae7a0e7aac14c88d04bcd871297725b85',
  'er15-no-evidence': '9c6c8135657c76c93beee6374dcd414d0755259b3bb0021579da514c27f01779', 'er15-strong': '605645fb6dbe042d6b6ddd5bfc534ff54dbad1bd1ff213cee6b950847825b48b',
  'er15-strong-reworded': '48acf9f706124db7f0616352959259f8a921e44bc46cb81ae79dad9377bc3b02', 'er15-strong-unfinished': 'ecfe6f2f6db2acb4abb7f6ee13496434553ba0c4f741d08c5c5c6fb780035f0b',
  'er15-unfinished': 'a3eae98cb065ce746d97d1ab5594ea69678ae13c63bd926f13f1489e8971fa89', 'er15-verbose': '80aed7a91a6813a6dfd1d6cfe1b7efda3559e104d3811acdaaddf6472da636f3',
  'er15-weak': '11cc66ea82e0de2c1297e5385beeba4314a4c3d6644f3c044cf7b866d1336edd',
};
const FROZEN_V2_ITEMS = 'a2924f22bb4fe9b1065272a442fa25128180381987377bf756f8346af09fc30b';
const FROZEN_EXPECTATIONS = 'a367dac21ecdab2f146a2c50982d0e7c6fc7cf6f54abb078563213e21b28fd78';
const FROZEN_BASELINE = '141b0a3257677dc7f63bb511fddbf1813f3145f37f3b38d609e6d99834f0754a';
const EXPECTATION_KEYS = ['question', 'key', 'paperVersion', 'answers', 'timing', 'profiles', 'sha256', 'words', 'panel', 'hard', 'soft', 'latencyTarget', 'frozenAt'];

console.log('--- the frozen values are the pinned ones');
ok(sha(JSON.stringify(V2.items)) === FROZEN_V2_ITEMS, 'corpus v2\'s items are the ones frozen, so v2 and v3 cannot be edited together');
ok(sha(JSON.stringify(EXPECTATION_KEYS.map(k => [k, (B || {})[k]]))) === FROZEN_EXPECTATIONS,
  'the benchmark\'s texts list, hashes, word counts, panel, comparisons, profiles and latency target are the ones frozen');
ok(sha(fs.readFileSync(path.join(DIR, 'er15-baseline.run2.json'))) === FROZEN_BASELINE, 'the Run 2 baseline file is byte for byte the one frozen');

console.log('--- version 3 keeps version 2 word for word');
const v3answers = Object.fromEntries(V3.items.flatMap(i => i.answers.map(a => [a.id, a])));
const v2answers = V2.items.flatMap(i => i.answers);
ok(V3.version === 3 && v2answers.length === 32, 'v3 is version 3 and v2 still holds its 32 answers');
ok(v2answers.every(a => JSON.stringify(v3answers[a.id]) === JSON.stringify(a)), 'every v2 answer is in v3 unchanged, field for field: ' + v2answers.filter(a => JSON.stringify(v3answers[a.id]) !== JSON.stringify(a)).map(a => a.id));
ok(V2.items.every((it, i) => { const x = V3.items[i]; const strip = o => JSON.stringify(Object.assign({}, o, { answers: null })); return x && strip(x) === strip(it); }), 'every item other than its answers is unchanged, in order');
ok(['paper', 'localPoints', 'progression', 'writing'].every(k => JSON.stringify(V3[k]) === JSON.stringify(V2[k])), 'paper, local points, progression and writing are unchanged');

console.log('--- the benchmark texts are the frozen ones');
const item = V3.items.find(i => i.question === (B || {}).question);
ok(!!B && !!item && B.key === item.key, 'benchmarks.er15 names Question 15 and its key');
const ids = (B.answers || []).concat(B.timing || []);
ok(B.answers.length === 12 && B.timing.length === 3, 'twelve benchmark answers and three timing answers');
ok(ids.every(id => v3answers[id] && item.answers.includes(v3answers[id])), 'every benchmark answer is an answer to Question 15 in v3');
ok(ids.length === Object.keys(FROZEN_SHA256).length && ids.every(id => sha(v3answers[id].text) === FROZEN_SHA256[id] && B.sha256[id] === FROZEN_SHA256[id]),
  'every benchmark text has the sha256 it was frozen with, pinned in this file: ' + ids.filter(id => sha(v3answers[id].text) !== FROZEN_SHA256[id]));
ok(ids.every(id => B.words[id] === v3answers[id].text.trim().split(/\s+/).length), 'the recorded word counts are the texts\' word counts');
ok(B.timing.every(id => { const w = B.words[id], n = Number(id.split('-').pop()); return Math.abs(w - n) / n <= 0.1; }), 'the timing answers are within 10% of 400, 800 and 1,200 words: ' + B.timing.map(id => B.words[id]));
ok(ids.filter(id => !v2answers.some(a => a.id === id)).every(id => !/[–—]/.test(v3answers[id].text)), 'no new answer contains an em or en dash');

console.log('--- the expectations were set down before the run, and name real answers');
const KNOWN = ['>', '>=', 'within 2 of'];
ok(B.hard.length === 8 && B.hard.concat(B.soft).every(c => B.answers.includes(c.a) && B.answers.includes(c.b) && KNOWN.includes(c.op)), 'eight hard comparisons, and every comparison names benchmark answers and a known operator');
ok(B.answers.every(id => { const p = B.panel[id]; if (!p) return false; const [lo, hi] = p.range.split('-').map(Number); return lo <= p.median && p.median <= hi && lo >= 0 && hi <= 20; }), 'every panel median sits inside its range, on a 20-mark scale');
ok(B.answers.filter(id => !v2answers.some(a => a.id === id)).every(id => { const [lo, hi] = B.panel[id].range.split('-').map(Number); return v3answers[id].live.min === lo && v3answers[id].live.max === hi; }), 'each new answer\'s live range is its panel range');
ok(B.timing.every(id => v3answers[id].timingOnly === true && !v3answers[id].live), 'the timing answers assert nothing about marks');
ok(B.latencyTarget.seconds === 40 && B.latencyTarget.percentile === 95, 'the latency target is p95 under 40 seconds');

console.log('--- a comparison holds only between two real marks');
ok(A.compare('>', 16, 15) === true && A.compare('>', 15, 15) === false, '">" is strict');
ok(A.compare('>=', 15, 15) === true && A.compare('>=', 14, 15) === false, '">=" allows a tie');
ok(A.compare('within 2 of', 15, 17) === true && A.compare('within 2 of', 14, 17) === false, '"within 2 of" is two marks either way, inclusive');
ok([null, undefined, NaN].every(x => A.compare('>', x, 1) === null && A.compare('>=', 20, x) === null), 'a missing mark makes a comparison undecided, never a pass');
ok(A.orderings({ 'er15-strong': 16 }, B).hard.find(c => c.b === 'er15-weak').ok === null, 'an answer that was not marked leaves its comparisons undecided');

console.log('--- what the student is shown, checked the way the run checks it');
const res = { summary: 'This is a Band 5 response.', criteria: [{ name: 'knowledge and understanding of course content', descriptor: '' }],
  inResponse: [{ head: 'Fine', quote: 'cut prices', why: 'state its {{market share|the share|0}}' }, { head: 'Absent', quote: '', why: 'No conclusion.' }, { head: 'Made up', quote: 'never written', why: 'x' }],
  across: [{ head: 'Weighs', why: 'scored 4/5 on knowledge' }] };
const s = A.shown(res, 'Northline cut prices across its range.', ['knowledge and understanding of course content']);
ok(s.emptyQuotes === 1 && s.unverifiedQuotes === 1, 'an empty quote and a quote the student never wrote are each counted');
ok(s.markup === 1 && s.bands === 1 && s.miniMarks === 1, 'glossary markup, band language and a criterion mini-mark are each counted');
ok(s.criteriaAuthored === true && A.shown(res, '', ['Knowledge and understanding of course content']).criteriaAuthored === false, 'criterion names are checked against the authored list exactly, casing included');
ok(A.shown({ summary: 'You scored 17 of 20 marks.', inResponse: [], across: [], criteria: [] }, '').miniMarks === 0, 'the mark itself is not a mini-mark');
const one = (summary, criteria) => A.shown({ summary, max: 20, inResponse: [], across: [], criteria: criteria || [] }, '');
ok(['This is a Band6 response.', 'It reads as B6 work.', 'It sits at Band5/6.', 'A top band answer.'].every(t => one(t).bands === 1),
  'band language in any form counts, run together or bare: Band6, B6, Band5/6');
ok(['It targets the 13 to 17 age band well.', 'Inflation sat above the RBA target band.', 'It explains pay bands.'].every(t => one(t).bands === 0) && one('The age band is right, and it is a Band 5 answer.').bands === 1,
  'the subjects\' own words, age, target and pay bands, are not band language, as the app keeps them; a band beside them still counts');
ok(['State its {{market share|the share|p. 41', 'State its market share|the share|p. 41', 'A {single} brace.'].every(t => one(t).markup === 1) && one('A plain sentence.').markup === 0,
  'glossary markup counts closed or not, and as the pipes it leaves once the braces are stripped');
ok(one('You earned 4 of 5 for knowledge.').miniMarks === 1 && one('Share reached 11%, short of the 12% target.').miniMarks === 0 &&
   one('Fine.', [{ name: 'knowledge and understanding of course content', descriptor: 'Secure: 80%' }]).miniMarks === 1,
  'a mark for a part of the response counts; the case\'s own percentages in feedback do not, and a percentage beside a criterion does');

console.log('--- the analysis is a pure function of the run');
const run = { mode: 'offline', site: 'local build', requests: [{ n: 1, body: { answer: v3answers['er15-strong'].text, marks: 20 }, status: 200, t0: 0, t1: 30000, reply: { score: 16, max: 20, checks: { ms: { diagnosis: 9000, judgement: 20000 } } } }],
  steps: [{ id: 'er15-strong', text: v3answers['er15-strong'].text, request: 1, result: { status: 'marked', score: 16, max: 20, graded: v3answers['er15-strong'].text, summary: 'ok', criteria: [], inResponse: [], across: [] } }], checks: [] };
const a1 = A.analyze(run, V3, BASE), a2 = A.analyze(JSON.parse(JSON.stringify(run)), V3, BASE);
ok(JSON.stringify(a1) === JSON.stringify(a2), 'the same run gives the same analysis');
ok(a1.marks['er15-strong'] === 16 && a1.timing.p95 === 30000 && a1.timing.under40 === 1, 'marks and request times are read from the run');
ok(A.analyze(Object.assign({}, run, { mode: 'live' }), V3, BASE).vsBaseline.marks.find(m => m.id === 'er15-strong').change === 0 && !a1.vsBaseline, 'a live run is compared with the Run 2 baseline; an offline one, whose marks are stand-ins, is not');
ok(A.idOf(v3answers['er15-len-800'].text + '\n', V3) === 'er15-len-800' && A.idOf('not a frozen text', V3) === null, 'a request is matched to its frozen text, and to nothing else');

console.log('--- a result that is not a mark is never one');
{
  const text = id => v3answers[id].text;
  const step = (id, result, extra) => Object.assign({ id, text: text(id), result: Object.assign({ graded: text(id), summary: '', criteria: [], inResponse: [], across: [] }, result) }, extra || {});
  const r2 = { mode: 'offline', requests: [], checks: [], steps: [
    step('er15-weak', { status: 'not_marked', score: 12, max: 20 }),
    step('er15-middle', { status: 'marked', score: 25, max: 20 }),
    step('er15-strong', { status: 'marked', score: 16, max: 20 }),
    step('er15-strong', { status: 'marked', score: 9, max: 20 }),
    step('er15-strong', { status: 'marked', score: 3, max: 20 }, { tag: 'repeat' }),
  ] };
  const a = A.analyze(r2, V3, BASE);
  ok(a.marks['er15-weak'] === null && a.marks['er15-middle'] === null, 'a result not marked, even with a score left on it, and a score above the marks, are no mark');
  ok(a.marks['er15-strong'] === 16, 'an answer\'s mark is the first one it got, as Run 2 counted it, not a later one or a repeat\'s');
  ok(a.orderings.hard.find(c => c.a === 'er15-strong' && c.b === 'er15-weak').ok === null, 'and a comparison with no mark is undecided');
  const req = (n, id, status, reply, ms) => ({ n, body: { answer: text(id), marks: 20 }, status, reply, t0: 0, t1: ms });
  const mk = s => ({ score: s, max: 20, checks: { ms: { diagnosis: 0, judgement: 1000 } } });
  const timingRun = reqs => A.analyze({ mode: 'offline', steps: [], checks: [], requests: reqs }, V3, BASE).timing;
  const t1 = timingRun([req(1, 'er15-len-400', 200, mk(12), 30000), req(2, 'er15-len-800', 502, { error: 'upstream 524', retryable: true }, 145000), req(3, 'er15-len-1200', null, null, 45000)]);
  ok(t1.timingAnswers.usable === 1 && t1.timingAnswers.n === 3 && t1.timingAnswers.p95 === null && t1.timingAnswers.meetsTarget === false,
    'two timing answers with no mark and one marked in 30 s do not meet the latency target: a failure counts as never arriving: ' + JSON.stringify(t1.timingAnswers));
  const t2 = timingRun([req(1, 'er15-len-400', 200, mk(12), 30000), req(2, 'er15-len-800', 200, mk(13), 35000), req(3, 'er15-len-1200', 200, mk(14), 38000)]);
  ok(t2.timingAnswers.usable === 3 && t2.timingAnswers.p95 === 38000 && t2.timingAnswers.meetsTarget === true, 'three usable marks under 40 s do: ' + JSON.stringify(t2.timingAnswers));
  const t3 = timingRun([req(1, 'er15-len-400', 200, { score: 25, max: 20, checks: { ms: {} } }, 1000), req(2, 'er15-len-800', 200, { score: 12, checks: { ms: {} } }, 1000)]);
  ok(t3.usable === 0 && t3.timingAnswers.usable === 0, 'a score above the marks, or a reply with no max, is not a usable mark in the timings either');
  ok(/p50 n\/a, p95 n\/a/.test(A.summary(A.analyze({ mode: 'offline', steps: [], checks: [], requests: [req(1, 'er15-len-400', 502, { error: 'x' }, 145000)] }, V3, BASE))),
    'with no usable mark the summary says n/a, not 0.0 s');
}

console.log('--- the Run 2 baseline agrees with the code that reads it');
const re = A.orderings(BASE.marks, B);
ok(JSON.stringify(re.hard.map(c => c.ok)) === JSON.stringify(BASE.orderings.hard.map(c => c.ok)) && BASE.orderings.hard.every(c => c.ok === true), 'the baseline\'s eight hard comparisons recompute as recorded, all passing');
ok(JSON.stringify(B.hard.map(c => [c.a, c.op, c.b])) === JSON.stringify(BASE.orderings.hard.map(c => [c.a, c.op, c.b])) &&
   JSON.stringify(B.soft.map(c => [c.a, c.op, c.b])) === JSON.stringify(BASE.orderings.soft.map(c => [c.a, c.op, c.b])),
  'and they are the same comparisons, answer for answer and operator for operator, hard and soft');
ok(BASE.marks['er15-verbose'] === null && BASE.display.emptyQuotes === 14 && BASE.display.markup === 60 && BASE.display.criteriaNotAuthored === 0 && BASE.timing.under40 === 0, 'it records what Run 2 found: verbose unmarked, 14 empty quotes, 60 texts with markup, the authored criteria every time, nothing under 40 s');
const raw = JSON.stringify(BASE);
ok(!/"body"|"reply"|"ladder"|"code"\s*:/.test(raw), 'it holds no request bodies, model replies, model sentences or class code fields');
ok((raw.match(/12Ec126/g) || []).length === 1, 'the class code appears only in the note on the stand-in sign-in');

console.log('--- latency counts only usable marks, and a failure as never arriving');
const L = require(path.join(DIR, 'er-latency.js'));
ok(L.usableMark === A.usableMark, 'the measurement and the analysis use one rule for what a usable mark is');
ok(L.usableMark(200, { score: 12, max: 20 }, 20) && L.usableMark(200, { score: 0, max: 20 }, 20), 'a 200 with a whole-number mark in range, out of the question\'s marks, is usable, zero included');
ok([[200, { score: 10.5, max: 20 }], [200, { score: 21, max: 20 }], [200, { score: '12', max: 20 }], [200, { score: 12, max: 20, error: 'x' }], [502, { score: 12, max: 20 }], [null, null],
    [200, { score: 12 }], [200, { score: 8, max: 10 }], [200, { score: 12, max: '20' }], [200, [12]]].every(([st, r]) => !L.usableMark(st, r, 20)),
  'a fraction, a mark out of range, a string, an error, a non-200, no reply, and a missing, wrong or string max are not usable, as the app would not show them');
const lean = (contract, passes) => ({ score: 12, max: 20, checks: { contract, passes } });
ok(L.sampleOk('lean1', lean('testmode-extended-1', 1)) && !L.sampleOk('lean1', lean(undefined, 2)) && !L.sampleOk('lean1', lean('testmode-extended-1', 2)) &&
   L.sampleOk('lean2', lean('testmode-extended-1', 2)) && !L.sampleOk('lean2', lean('testmode-extended-1', 1)) && L.sampleOk('full', lean(undefined, 2)) && !L.sampleOk('full', lean('testmode-extended-1', 1)),
  'a lean sample counts only if the worker says it marked under the lean contract with that many passes, so the full review is never measured under the lean name');
const row = (ms, usable, id) => ({ variant: 'lean1', answer: id || 'er15-len-400', totalMs: ms, usable });
const fast = Array.from({ length: 19 }, (_, i) => row(10000 + i * 100, true));
const S1 = L.summarise(fast.concat([row(12000, true)]), ['lean1']).lean1.all;
const S2 = L.summarise(fast.slice(1).concat([row(500, false), row(600, false)]), ['lean1']).lean1.all;
const S3 = L.summarise(fast.concat([row(500, false)]), ['lean1']).lean1.all;
ok(S1.meetsTarget === true && S1.p95 === 11800 && S1.usable === 20, 'twenty usable marks under 40 s meet the target: p95 ' + S1.p95);
ok(S2.meetsTarget === false && S2.p95 === null && S2.usable === 18, 'two requests in twenty with no usable mark miss it, however fast they failed: ' + JSON.stringify([S2.p95, S2.meetsTarget]));
ok(S3.meetsTarget === true && S3.usable === 19 && S3.n === 20, 'one in twenty is the 5% the target allows, and the failure is still counted: ' + JSON.stringify([S3.usable, S3.n]));
ok(L.summarise(fast.slice(1).concat([row(41000, true), row(45000, true)]), ['lean1']).lean1.all.meetsTarget === false, 'and two usable marks past 40 s miss it too');

console.log('--- the harness and the analysis parse');
for (const f of ['er-benchmark.js', 'er-analyze.js', 'er-latency.js']) { const r = spawnSync(process.execPath, ['--check', path.join(DIR, f)]); ok(r.status === 0, f + ' parses: ' + String(r.stderr).slice(0, 200)); }

console.log(`t41 ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
