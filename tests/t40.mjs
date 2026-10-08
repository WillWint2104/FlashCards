// A MISSING MARK NEVER PASSES A MARK CHECK (tests/bots/testmode/expect.js).
//
// Run 1 of the live student bots spent real marking credits on seven 11(b)
// answers. Three came back "not marked", and two of those three were reported
// "ok", because "at most 2" was written as `status !== "marked" || score <= 2`:
// no mark was read as a mark within range. Only the answer with a minimum
// failed. This suite holds the rule that replaced it: every expectation that
// names a number holds only for a valid mark, and not marked, refused, failed,
// null and undefined satisfy none of them.
//
// The shapes below are the ones Run 1 produced, and the ones tests/ui76.js
// capture() returns. Full tier only, like the bots it protects.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const X = require(path.join(ROOT, 'tests/bots/testmode/expect.js'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

// What capture() returns for each outcome.
const marked = (score, max) => ({ status: 'marked', score, max, nm: false });
const NOT_MARKED = { status: 'not_marked', score: null, max: null, nm: true };          // Run 1: the marker could not be reached
const REFUSED = { status: 'not_marked', score: null, max: null, nm: true, stored: { outcome: 'refused' } };
const FAILED = { status: 'not_marked', score: null, max: null, nm: true, stored: { outcome: 'failed', max: 3 } };
const NEVER_SENT = { status: 'none', score: null, max: null };
const NOTHING = [['not marked', NOT_MARKED], ['refused', REFUSED], ['failed', FAILED], ['null', null], ['undefined', undefined],
  ['marked without a score', { status: 'marked', score: null, max: 3 }], ['marked with NaN', marked(NaN, 3)],
  ['marked with a string', { status: 'marked', score: '1', max: 3 }], ['marked above its scale', marked(4, 3)],
  ['marked below zero', marked(-1, 3)], ['marked with no scale', { status: 'marked', score: 1, max: null }]];

console.log('--- a range is about a mark: nothing that is not a mark satisfies one');
for (const [name, got] of NOTHING) {
  ok(!X.inRange(got, { max: 2 }), name + ' does not satisfy "at most 2"');
  ok(!X.inRange(got, { min: 2 }), name + ' does not satisfy "at least 2"');
  ok(!X.inRange(got, { min: 1, max: 2 }), name + ' does not satisfy "1 to 2"');
  ok(!X.inRange(got, {}), name + ' does not satisfy an empty range either');
  ok(!X.exactly(got, 0) && !X.exactly(got, 1), name + ' is not exactly 0 or 1');
  ok(!X.validMark(got), name + ' is not a valid mark');
}
{
  // Run 1, exactly: sa11b-misconception and sa11b-verbose had only a maximum.
  ok(!X.inRange(NOT_MARKED, { max: 2 }), 'Run 1: an unmarked misconception answer no longer passes "at most 2"');
  ok(!X.inRange(NOT_MARKED, { max: 2 }) && !X.inRange(NOT_MARKED, { min: 2 }), 'Run 1: the unmarked answers fail whichever bound they carry');
}

console.log('--- a real mark is judged by the range, at its edges');
ok(X.inRange(marked(0, 3), { max: 1 }) && X.inRange(marked(1, 3), { max: 1 }) && !X.inRange(marked(2, 3), { max: 1 }), 'at most 1: 0 and 1 pass, 2 fails');
ok(X.inRange(marked(2, 3), { min: 2 }) && X.inRange(marked(3, 3), { min: 2 }) && !X.inRange(marked(1, 3), { min: 2 }), 'at least 2: 2 and 3 pass, 1 fails (Run 1 sa11b-unusual)');
ok(X.inRange(marked(1, 3), { min: 1, max: 2 }) && X.inRange(marked(2, 3), { min: 1, max: 2 }) && !X.inRange(marked(0, 3), { min: 1, max: 2 }) && !X.inRange(marked(3, 3), { min: 1, max: 2 }), '1 to 2: both edges in, both neighbours out');
ok(X.inRange(marked(0, 3), { max: 2 }), 'a real zero is a mark, and is within "at most 2"');
ok(X.exactly(marked(0, 2), 0) && X.exactly(marked(2, 2), 2) && !X.exactly(marked(1, 2), 2), 'exactly: a real zero counts, a near miss does not');

console.log('--- never full marks: never sent, or marked below full; never "sent and not marked"');
ok(X.neverFull(NEVER_SENT), 'a blank answer that was never sent has never been given full marks');
ok(X.neverFull(marked(0, 3)) && X.neverFull(marked(2, 3)), 'below full marks passes');
ok(!X.neverFull(marked(3, 3)), 'full marks fails');
ok(!X.neverFull(NOT_MARKED) && !X.neverFull(FAILED) && !X.neverFull(null), 'sent and not marked is not evidence of anything, so it fails');

console.log('--- an ordering needs both marks');
ok(X.ordered(marked(3, 3), marked(1, 3)) && X.ordered(marked(2, 3), marked(2, 3)), 'higher or equal passes');
ok(!X.ordered(marked(1, 3), marked(3, 3)), 'lower fails');
ok(!X.ordered(NOT_MARKED, marked(0, 3)) && !X.ordered(marked(3, 3), NOT_MARKED) && !X.ordered(NOT_MARKED, NOT_MARKED), 'an unmarked side fails the ordering instead of skipping it');

console.log('--- a failure says what came back');
ok(/not_marked/.test(X.describe(NOT_MARKED)) && X.describe(marked(1, 3)) === '1/3' && X.describe(undefined) === 'no result', 'describe names the status, not a bare null');

console.log('--- ui76 checks every number through these rules');
{
  const src = fs.readFileSync(path.join(ROOT, 'tests/ui76.js'), 'utf8');
  const body = (name) => { const i = src.indexOf('function ' + name + '('); const j = src.indexOf('\n}\n', i); return i < 0 ? '' : src.slice(i, j); };
  const exp = body('expectOf'), ord = body('orderings');
  ok(exp.length > 0 && ord.length > 0, 'expectOf and orderings exist');
  ok(/X\.inRange\(/.test(exp) && /X\.exactly\(/.test(exp) && /X\.neverFull\(/.test(exp), 'expectOf uses inRange, exactly and neverFull');
  ok(/X\.ordered\(/.test(ord) && !/return;\s*\n\s*ok\(LIVE_SCORES/.test(ord), 'orderings uses ordered, and does not skip an attempted answer for having no mark');
  ok(!/status\s*!==\s*'marked'\s*\|\|\s*got\.score/.test(src), 'no inline "not marked or within range" check anywhere in ui76');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
