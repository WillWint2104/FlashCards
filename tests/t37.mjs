// NO UNUSABLE MARK LEAVES THE WORKER (UX-TEST-22, the worker's half).
//
// Test Mode's rule is "no valid marker result, no mark". The app checks every
// reply it is given (tests/ui72.js), but two ways to a fabricated mark start here,
// before the app can see them:
//
//   a review cut off by max_tokens used to be refused only when it had fewer
//   paragraphs than the answer had blank-line blocks, so a one-block short
//   answer's truncated review came back 200 with whatever marks it held;
//
//   a paragraph whose score or max is missing or not a number was read by
//   reconcileParagraphs as 0, so a broken reply became a low grade.
//
// Both now come back 502, retryable, with no mark in them. Full tier only: this
// is not in fast or checkpoint (decision 20).
import worker from './worker.mjs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

const REVIEW = {
  summary: 'A clear answer.', focus: { area: 'Explanation', paragraph: 1, why: 'w', quote: '' },
  paragraphs: [{ name: 'Answer', score: 2, max: 3, reasons: [], sentences: [{ text: 'Casual work has no guaranteed hours.', issues: [] }] }],
  rubric: [],
};
const DIAG = { coverage: [], arguments: [], explanation: [], evidence: [], terminology: [], repetition: [], missing: [], planVsResponse: [], firstToFix: '' };

// One answer block, as a short answer usually is.
const REQBODY = {
  prompt: 'Explain how casual employment could contribute to staff turnover.', command: 'Explain', marks: 3,
  answer: 'Casual work has no guaranteed hours.', responseType: 'short',
  subject: 'Business Studies', criteria: ['knowledge and understanding of course content'],
};
const mkReq = () => new Request('https://w/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(REQBODY) });
async function reply(review, stop) {
  globalThis.fetch = async (url, init) => {
    const name = JSON.parse(init.body).tools[0].name;
    const input = name === 'submit_diagnosis' ? DIAG : JSON.parse(JSON.stringify(review));
    return new Response(JSON.stringify({ content: [{ type: 'tool_use', name, input }], stop_reason: name === 'submit_diagnosis' ? 'tool_use' : stop }), { status: 200 });
  };
  const res = await worker.fetch(mkReq(), { ANTHROPIC_API_KEY: 'k' }, {});
  let body = null; try { body = await res.json(); } catch (e) { /* not json */ }
  return { status: res.status, body };
}
const noMark = b => !b || b.score === undefined;

console.log('--- a valid review is still a mark ---');
const good = await reply(REVIEW, 'tool_use');
ok(good.status === 200 && good.body.score === 2 && good.body.max === 3, 'a complete review marks as before: ' + good.status + ' ' + JSON.stringify(good.body && [good.body.score, good.body.max]));

console.log('--- a truncated review is refused, however long it is ---');
const cut = await reply(REVIEW, 'max_tokens');
ok(cut.status === 502 && noMark(cut.body) && cut.body.retryable === true,
   'max_tokens on a one-block answer is a retryable 502 with no mark, not a 200: ' + cut.status + ' ' + JSON.stringify(cut.body));

console.log('--- a paragraph without a real mark is not a mark of zero ---');
const broken = [
  ['score missing', p => { delete p.score; }],
  ['score a string', p => { p.score = '2'; }],
  ['score not a number', p => { p.score = null; }],
  ['score negative', p => { p.score = -1; }],
  ['max missing', p => { delete p.max; }],
  ['max negative', p => { p.max = -1; }],
];
for (const [name, edit] of broken) {
  const r = JSON.parse(JSON.stringify(REVIEW)); edit(r.paragraphs[0]);
  const out = await reply(r, 'tool_use');
  ok(out.status === 502 && noMark(out.body) && out.body.retryable === true && /unusable mark/.test(out.body.error || ''),
     name + ': a retryable 502 with no mark in it, not a fabricated grade: ' + out.status + ' ' + JSON.stringify(out.body));
}
const second = JSON.parse(JSON.stringify(REVIEW));
second.paragraphs.push({ name: 'More', reasons: [], sentences: [] });
const two = await reply(second, 'tool_use');
ok(two.status === 502 && noMark(two.body), 'one unusable paragraph among good ones still refuses the whole review: ' + two.status);

console.log('--- a paragraph worth nothing is a real reply; a review with no scale is not ---');
// A heading on its own line is worth 0, and reconcileParagraphs shares the marks
// out around it. Refusing it would leave a real review unmarked for ever.
const heading = JSON.parse(JSON.stringify(REVIEW));
heading.paragraphs.unshift({ name: 'Heading', score: 0, max: 0, reasons: [], sentences: [] });
const hd = await reply(heading, 'tool_use');
ok(hd.status === 200 && hd.body.score === 2 && hd.body.max === 3,
   'a zero-max heading paragraph still marks, reconciled: ' + hd.status + ' ' + JSON.stringify(hd.body && [hd.body.score, hd.body.max]));
const noScale = JSON.parse(JSON.stringify(REVIEW)); noScale.paragraphs[0].max = 0; noScale.paragraphs[0].score = 0;
const ns = await reply(noScale, 'tool_use');
ok(ns.status === 502 && noMark(ns.body), 'a review whose every paragraph is worth nothing has no scale, and is refused: ' + ns.status);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
