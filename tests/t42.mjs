// TEST MODE'S EXTENDED RESPONSE CONTRACT: ONE PASS, ONLY WHAT THE SCREEN SHOWS.
//
// Bots Run 2 timed the full review on the production marker: 63 to 122 seconds
// for a 20-mark extended response against the app's 45, and a 400-word answer
// failed upstream. Most of what the model wrote, every sentence copied back,
// three model sentences per fault and band descriptors per criterion, is never
// shown in Test Mode. A request that names the lean contract now gets one pass
// that asks for a mark, a judgement, the criteria and at most six observations,
// and the worker grounds and cleans that reply in code before it leaves.
//
// This suite holds the contract with the model stubbed: who gets the lean path
// and who keeps the full review, what the model is asked for (and not), and what
// the reply may carry. Full tier, node only.
import worker from './worker.mjs';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };

const CRITERIA = ['knowledge and understanding of course content', 'application of business case studies and contemporary business issues',
  'business terminology and concepts', 'sustained, logical and cohesive response'];
const ANSWER = 'Northline set a clear objective of growing its teenage share.\n\nIts video campaign cut the cost per view from 19 to 4 cents, so the same budget reached far more teenagers.';
const BODY = {
  prompt: 'Evaluate the effectiveness of marketing strategies in achieving the marketing objectives of a business you have studied.',
  command: 'evaluate', marks: 20, answer: ANSWER, subject: 'Business Studies', criteria: CRITERIA,
  bands: [{ range: 'Band 6', text: 'Holds one judgement from the first paragraph to the last.' }], bandsSource: 'Marginal general',
  requirements: { accomplish: ['States the marketing objectives being judged against'] }, model_answer: 'A strong response defines the objectives.',
  format: 'extended_response', responseType: 'extended', stimulus: false, contract: 'testmode-extended-1',
};
const LEAN = {
  mark: 11,
  judgement: 'The response states an objective and uses one figure well. It reads as a {{Band 4|x|0}} response. It does not weigh the strategies against each other.',
  criteria: [
    { name: 'Business terminology and concepts', rewards: 'Terms that carry the reasoning.' },
    { name: 'knowledge and understanding of course content', rewards: 'Accurate {{marketing mix|the four Ps|0}} knowledge — used to answer.' },
    { name: 'an invented criterion', rewards: 'Never shown.' },
  ],
  observations: [
    { head: 'Figure used as evidence', why: 'The cost per view does work for the claim. It would reach the top band with a link to share.', quote: 'cut the cost per view from 19 to 4 cents' },
    { head: 'Objective has no target', why: 'Say what share Northline wanted.', quote: 'Northline set a clear objective of growing its teenage share' },
    { head: 'No overall judgement', why: 'The response never weighs the strategies.', quote: '' },
    { head: 'A claim not in the response', why: 'Said of words the student never wrote.', quote: 'Northline doubled its sales in a single month' },
    { head: 'Spans two paragraphs', why: 'Not one run of the student’s words.', quote: 'growing its teenage share. Its video campaign cut' },
    { head: 'Band 6 needs a judgement', why: 'Only band talk.', quote: '' },
    { head: 'A seventh observation', why: 'There is room for six.', quote: '' },
  ],
};
// Every property name in a schema, and every string in a reply, however deep.
const keysOf = o => o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => (Array.isArray(o) ? [] : [k]).concat(keysOf(v))) : [];
const stringsOf = o => typeof o === 'string' ? [o] : o && typeof o === 'object' ? Object.values(o).flatMap(stringsOf) : [];
const DIAG = { coverage: [], arguments: [], explanation: [], evidence: [], terminology: [], repetition: [], missing: [], planVsResponse: [], firstToFix: '' };
const REVIEW = { summary: 's', focus: { area: 'a', paragraph: 1, why: 'w', quote: '' }, rubric: [],
  paragraphs: [{ name: 'P', score: 5, max: 10, reasons: [], sentences: [] }, { name: 'Q', score: 5, max: 10, reasons: [], sentences: [] }] };

// Drive the worker with the model stubbed. `reply` answers the lean tool; the full
// review's two tools get a plain diagnosis and review.
async function call(body, reply, opts) {
  opts = opts || {};
  const seen = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (u, init) => {
    const b = JSON.parse(init.body); seen.push(b);
    const name = b.tools[0].name;
    if (opts.status) return new Response('{}', { status: opts.status });
    if (opts.diagStatus && name === 'submit_diagnosis') return new Response('{}', { status: opts.diagStatus });
    const input = name === 'submit_test_mark' ? reply : name === 'submit_diagnosis' ? DIAG : REVIEW;
    return new Response(JSON.stringify({ content: [{ type: 'tool_use', name, input }], stop_reason: opts.stop || 'tool_use',
      usage: { input_tokens: 2100, output_tokens: 420, cache_read_input_tokens: 1300 } }), { status: 200 });
  };
  try {
    const res = await worker.fetch(new Request('https://w/', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': 't42-' + Math.random() }, body: JSON.stringify(body) }), { ANTHROPIC_API_KEY: 'k' }, {});
    return { status: res.status, out: await res.json(), seen };
  } finally { globalThis.fetch = real; }
}

console.log('--- who gets the lean contract');
{
  const r = await call(BODY, LEAN);
  ok(r.status === 200 && r.seen.length === 1 && r.seen[0].tools[0].name === 'submit_test_mark', 'a Test Mode extended response that names the contract is marked in ONE pass, by the lean tool: ' + r.seen.map(s => s.tools[0].name));
  for (const [what, b] of [['without the contract', Object.assign({}, BODY, { contract: undefined })], ['with another contract', Object.assign({}, BODY, { contract: 'something-else' })],
    ['for a business report', Object.assign({}, BODY, { format: 'business_report' })], ['for a short answer', Object.assign({}, BODY, { format: 'short_answer', responseType: 'short', marks: 3 })]]) {
    const x = await call(b, LEAN);
    ok(x.seen.some(s => s.tools[0].name === 'submit_review') && !x.seen.some(s => s.tools[0].name === 'submit_test_mark'), what + ', the full review runs exactly as before');
  }
  const two = await call(Object.assign({}, BODY, { passes: 2 }), LEAN);
  ok(two.status === 200 && two.seen.map(s => s.tools[0].name).join(',') === 'submit_diagnosis,submit_test_mark', 'passes: 2, for measuring only, runs the diagnosis first and then the lean pass');
  ok(r.out.checks.passes === 1 && two.out.checks.passes === 2, 'and the reply says how many passes ran');
  const lost = await call(Object.assign({}, BODY, { passes: 2 }), LEAN, { diagStatus: 529 });
  ok(r.out.checks.diagnosisState === 'not run' && two.out.checks.diagnosisState === 'used' && lost.status === 200 && lost.out.checks.diagnosisState === 'skipped',
    'whether the diagnosis was used is stated, never silent: one pass "not run", two "used", and a failed diagnosis "skipped": ' + [r, two, lost].map(x => x.out.checks && x.out.checks.diagnosisState));
}

console.log('--- what the model is asked for, and what it is not');
{
  const r = await call(BODY, LEAN), req = r.seen[0], tool = JSON.stringify(req.tools[0].input_schema), msg = req.messages[0].content, sys = req.system[0].text;
  ok(req.max_tokens <= 1500, 'a small output budget: ' + req.max_tokens);
  const asked = keysOf(req.tools[0].input_schema.properties);
  ok(!asked.some(k => /^(ladder|level|bands|range|here|score|max|paragraphs|sentences|focus|reasons|text)$/.test(k)) && JSON.stringify(Object.keys(req.tools[0].input_schema.properties)) === JSON.stringify(['mark', 'judgement', 'criteria', 'observations']),
    'the tool asks for a mark, a judgement, criteria and observations, and no ladder, bands, criterion or paragraph marks, sentences copied back or focus: ' + asked);
  ok(req.tools[0].input_schema.properties.observations.maxItems === 6 && req.tools[0].input_schema.properties.criteria.maxItems === 4, 'at most six observations and four criteria');
  ok(/Never write any of these, anywhere: a band/.test(sys) && /model answer for the student to copy/.test(sys) && /no em-dashes/.test(sys), 'the instructions forbid bands, criterion marks, copyable prose and em-dashes');
  ok(CRITERIA.every(c => msg.includes(c)) && msg.includes('Holds one judgement') && msg.includes(BODY.prompt) && msg.includes('[1] Northline set a clear objective') && msg.includes('States the marketing objectives being judged against'),
    'the message carries the criteria, the band expectations to judge by, the question, its requirements and the numbered response');
  ok(/never name a band in what you write/.test(msg), 'and says the band expectations are for deciding the mark, not for writing');
}

console.log('--- what comes back');
{
  const r = await call(BODY, LEAN), o = r.out;
  ok(o.contract === 'testmode-extended-1' && o.score === 11 && o.total === 11 && o.max === 20, 'the whole-number mark, out of the question\'s marks: ' + o.score + '/' + o.max);
  ok(JSON.stringify(o.rubric.map(c => c.name)) === JSON.stringify(CRITERIA) && o.rubric.every(c => !('score' in c) && !('bands' in c)), 'the rubric is the four criteria the request named, in its order, with no marks and no bands');
  ok(o.rubric[0].descriptor === 'Accurate marketing mix knowledge, used to answer.' && o.rubric[2].descriptor === 'Terms that carry the reasoning.' && o.rubric[1].descriptor === '',
    'a descriptor only where the model gave one for that criterion, cleaned of markup and dashes: ' + JSON.stringify(o.rubric.map(c => c.descriptor)));
  const sn = o.paragraphs[0].sentences;
  ok(o.paragraphs.length === 1 && sn.length === 5, 'six observations at most, and one headed only by band talk is dropped: ' + sn.length);
  ok(sn[0].text === 'cut the cost per view from 19 to 4 cents' && !sn[0].unplaced && sn[1].text === 'Northline set a clear objective of growing its teenage share' && !sn[1].unplaced,
    'a quote that is in the response is kept, as the student\'s exact words');
  ok(sn.slice(2).every(s => s.unplaced && s.text === null), 'an empty quote, a quote the student never wrote and one across two paragraphs are about the whole response');
  ok(sn[0].issues[0].why === 'The cost per view does work for the claim.' && !stringsOf(o).some(t => /\bband/i.test(t)), 'a sentence naming a band is left out, and no band survives anywhere in the reply');
  ok(o.summary === 'The response states an objective and uses one figure well. It does not weigh the strategies against each other.' && o.overall.summary === o.summary,
    'the judgement is the summary, cleaned: ' + o.summary);
  ok(!stringsOf(o).some(t => /\{\{|\}\}|\u2014/.test(t)), 'no glossary markup and no em-dash in anything the reply says');
  ok(!/ladder/.test(JSON.stringify(o)) && sn.every(s => s.issues.length === 1 && Object.keys(s.issues[0]).sort().join() === 'head,kind,severity,why'), 'no ladder, and each observation is a head and a why');
  ok(o.checks.sentencesVerified === 2 && o.checks.sentencesUnplaced === 2 && o.checks.wholeResponse === 1 && o.checks.grounded === 0.5, 'the checks count verified, unverified and whole-response observations: ' + JSON.stringify(o.checks));
  ok(o.checks.model && o.checks.usage.output === 420 && o.checks.usage.input === 2100 && o.checks.ms && o.checks.ms.diagnosis === 0, 'and carry the model, its token usage and the time per pass');
}

console.log('--- a reply that is not a mark is not a mark');
for (const [what, mark] of [['a mark above the marks', 21], ['a negative mark', -1], ['a fraction', 10.5], ['a string', '10'], ['no mark', undefined]]) {
  const r = await call(BODY, Object.assign({}, LEAN, { mark }));
  ok(r.status === 502 && r.out.retryable === true && !('score' in r.out), what + ' comes back 502, retryable, with no mark in it');
}
{
  const cut = await call(BODY, LEAN, { stop: 'max_tokens' });
  ok(cut.status === 502 && cut.out.retryable === true && !('score' in cut.out), 'a reply cut off by its budget is not a mark');
  const down = await call(BODY, LEAN, { status: 529 });
  ok(down.status === 502 && down.out.retryable === true && !('score' in down.out), 'an upstream failure is not a mark');
  const zero = await call(BODY, Object.assign({}, LEAN, { mark: 0 }));
  ok(zero.status === 200 && zero.out.score === 0, 'a real zero is a mark');
}

console.log(`t42 ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
