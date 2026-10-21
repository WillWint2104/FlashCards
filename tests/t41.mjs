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
ok(ids.every(id => B.sha256[id] === sha(v3answers[id].text)), 'every benchmark text has the sha256 it was frozen with: ' + ids.filter(id => B.sha256[id] !== sha(v3answers[id].text)));
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

console.log('--- the analysis is a pure function of the run');
const run = { mode: 'offline', site: 'local build', requests: [{ n: 1, body: { answer: v3answers['er15-strong'].text }, status: 200, t0: 0, t1: 30000, reply: { score: 16, checks: { ms: { diagnosis: 9000, judgement: 20000 } } } }],
  steps: [{ id: 'er15-strong', text: v3answers['er15-strong'].text, request: 1, result: { status: 'marked', score: 16, max: 20, graded: v3answers['er15-strong'].text, summary: 'ok', criteria: [], inResponse: [], across: [] } }], checks: [] };
const a1 = A.analyze(run, V3, BASE), a2 = A.analyze(JSON.parse(JSON.stringify(run)), V3, BASE);
ok(JSON.stringify(a1) === JSON.stringify(a2), 'the same run gives the same analysis');
ok(a1.marks['er15-strong'] === 16 && a1.timing.p95 === 30000 && a1.timing.under40 === 1, 'marks and request times are read from the run');
ok(A.analyze(Object.assign({}, run, { mode: 'live' }), V3, BASE).vsBaseline.marks.find(m => m.id === 'er15-strong').change === 0 && !a1.vsBaseline, 'a live run is compared with the Run 2 baseline; an offline one, whose marks are stand-ins, is not');
ok(A.idOf(v3answers['er15-len-800'].text + '\n', V3) === 'er15-len-800' && A.idOf('not a frozen text', V3) === null, 'a request is matched to its frozen text, and to nothing else');

console.log('--- the Run 2 baseline agrees with the code that reads it');
const re = A.orderings(BASE.marks, B);
ok(JSON.stringify(re.hard.map(c => c.ok)) === JSON.stringify(BASE.orderings.hard.map(c => c.ok)) && BASE.orderings.hard.every(c => c.ok === true), 'the baseline\'s eight hard comparisons recompute as recorded, all passing');
ok(BASE.marks['er15-verbose'] === null && BASE.display.emptyQuotes === 14 && BASE.display.markup === 60 && BASE.display.criteriaNotAuthored === 0 && BASE.timing.under40 === 0, 'it records what Run 2 found: verbose unmarked, 14 empty quotes, 60 texts with markup, the authored criteria every time, nothing under 40 s');
const raw = JSON.stringify(BASE);
ok(!/"body"|"reply"|"ladder"|"code"\s*:/.test(raw), 'it holds no request bodies, model replies, model sentences or class code fields');
ok((raw.match(/12Ec126/g) || []).length === 1, 'the class code appears only in the note on the stand-in sign-in');

console.log('--- the harness and the analysis parse');
for (const f of ['er-benchmark.js', 'er-analyze.js']) { const r = spawnSync(process.execPath, ['--check', path.join(DIR, f)]); ok(r.status === 0, f + ' parses: ' + String(r.stderr).slice(0, 200)); }

console.log(`t41 ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
