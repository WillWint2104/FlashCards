// THE ATTEMPT CONTRACT (tools/contract/attempts.js, decisions 19 to 22).
//
// Every rule about what a student has done in Test Mode, run in Node against the
// synthetic paper: identity and version pinning, the safe question bank, scope
// that cannot change once started, two scopes that never share state, counts
// derived rather than stored, Start again, and a restored store that is not
// trusted. The page runs the same file (tools/contract/bundle.js).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const A = require(path.join(ROOT, 'tools/contract/attempts.js'));
const ASSESS = require(path.join(ROOT, 'tools/contract/assessment.js'));
const P = require(path.join(ROOT, 'tools/contract/exam.js'));
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const win = {}; new Function('window', read('essay-content.js'))(win);
const PACKAGES = win.ESSAY.subjects;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const RAW = read('tests/fixtures/bus-practice-paper.json');
let n = 0;
const fresh = (over) => Object.assign(JSON.parse(RAW), { id: 'exam-' + (++n) }, over || {});
const store = () => ({ exams: [], attempts: {} });
const T = i => '2026-10-0' + i + 'T10:00:00.000Z';
const marked = (score, max) => ASSESS.marked({ score, max, kind: 'points' });
const refused = max => ASSESS.refuse('MARKER_NOT_CONNECTED', 'Not marked.', { max });

console.log('--- identity and versions');
{
  const s = store(), v1 = fresh();
  ok(A.addPaper(s, v1).kind === 'new', 'a first paper is new');
  ok(A.identityOf(v1) === 'marginal-synthetic-bus-practice-1' && A.paperKey(v1) === 'paper:marginal-synthetic-bus-practice-1',
     'identity is exam.id, not the runtime id or the title');
  const same = fresh();
  ok(A.addPaper(s, same).kind === 'same' && s.exams.length === 1, 'the same version again is not added');
  const renamed = fresh({ name: 'A different title' });
  ok(A.addPaper(s, renamed).kind === 'same', 'a new title on the same id and version is the same paper');
  const k = A.paperKey(v1);
  A.begin(s, k, A.startPaper(v1, null, T(1)));
  const v2 = fresh(); v2.exam.version = '2'; v2.sections[0].questions[0].prompt = 'Version two prompt.';
  ok(A.addPaper(s, v2).kind === 'newer', 'a newer version replaces');
  ok(A.library(s.exams).length === 1 && A.library(s.exams)[0] === v2, 'the library shows only the newer version');
  ok(s.exams.includes(v1) && v1.superseded === true, 'the old version is kept, hidden, while an attempt is pinned to it');
  const seq = A.sequence(s.attempts[k].current, s.exams);
  ok(seq[0].paper === v1 && seq[0].q.prompt !== 'Version two prompt.', 'the attempt keeps sitting version 1');
  const own = new Set(), walk = o => { if (o && typeof o === 'object' && !own.has(o)) { own.add(o); Object.values(o).forEach(walk); } };
  walk(v1.sections);
  ok(seq.length > 0 && seq.every(e => own.has(e.q)),
     'every entry carries the paper\'s own question object, not a copy (ownership is by identity)');
  ok(A.startPaper(v2, null, T(2)).version === '2', 'a new attempt starts on the library version');
  const v0 = fresh(); v0.exam.version = '0';
  ok(A.addPaper(s, v0).kind === 'older' && !s.exams.includes(v0), 'an older version is not added');
  A.discard(s, k);
  ok(!s.exams.includes(v1), 'once nothing is pinned to it, the superseded version goes');
  const t = store(), a1 = fresh(); A.addPaper(t, a1);
  const a2 = fresh(); a2.exam.version = 'term-3';
  ok(A.addPaper(t, a2).kind === 'different' && A.library(t.exams).length === 1 && !t.exams.includes(a1),
     'an unorderable version replaces, and with nothing pinned the old one goes at once');
}

console.log('--- the safe question bank (decision 22)');
{
  const p = fresh();
  const c = A.bankCounts([p], PACKAGES);
  ok(c.multiple_choice === 10 && c.short_answer === 4 && c.calculation === 1 && c.business_report === 1 && c.extended_response === 5,
     'counts by canonical format, both either/or options counted: ' + JSON.stringify(c));
  const sa = A.bank('short_answer', [p], PACKAGES);
  ok(sa.map(b => b.display).join(' ') === '11(a) 11(b) 12(a) 12(b)' && sa.every(b => b.paper === p.id && b.version === '1'),
     'the short answers, in paper order, pinned to their version: ' + sa.map(b => b.display).join(' '));
  // An unregistered subject whose paper is objective only: its multiple choice
  // and calculation count, nothing written does.
  const obj = fresh(); obj.curriculum.subjectKey = 'legal_studies'; obj.curriculum.course = 'Legal Studies';
  const calc = obj.sections[1].questions[0].parts[2];
  obj.sections = [obj.sections[0], { name: 'Section II - Calculation', questions: [Object.assign({}, calc, { number: '11' })] }];
  delete obj.marks; delete obj.sections[0].marks;
  const co = A.bankCounts([obj], PACKAGES);
  ok(co.multiple_choice === 10 && co.calculation === 1 && co.short_answer === 0, 'an objective unregistered paper lends its local questions: ' + JSON.stringify(co));
  // The same subject on the full paper is blocked at the door, and lends nothing.
  const blocked = fresh(); blocked.curriculum.subjectKey = 'legal_studies';
  const cb = A.bankCounts([blocked], PACKAGES);
  ok(Object.values(cb).every(x => x === 0), 'a paper that cannot be sat lends nothing: ' + JSON.stringify(cb));
  // A paper whose subject is unregistered but which still carries a locally
  // markable short answer next to one that needs the marker would be blocked,
  // so the per-question filter is proved directly.
  const ok2 = A.assessable(obj, PACKAGES);
  ok(ok2(0, 0, null) && ok2(1, 0, null), 'the predicate admits a local question');
  const mixed = fresh(); mixed.curriculum.subjectKey = 'legal_studies';
  const pred = A.assessable(Object.assign({}, mixed), {});
  ok(pred(0, 0, null) === false, 'with no packages at all, nothing in a blocked paper is assessable');
  ok(A.bank('short_answer', [Object.assign(fresh(), { superseded: true })], PACKAGES).length === 0, 'a superseded version lends nothing');
}

console.log('--- a paper attempt: fixed scope, derived counts');
{
  const s = store(), p = fresh(); A.addPaper(s, p);
  const k = A.paperKey(p);
  const a = A.begin(s, k, A.startPaper(p, [1], T(1)));
  ok(JSON.stringify(a.sections) === '[1]' && a.at === '1-0-0', 'Section II only, starting at 11(a): ' + a.at);
  let threw = false; try { A.begin(s, k, A.startPaper(p, null, T(2))); } catch (e) { threw = true; }
  ok(threw, 'an in-progress attempt is never replaced by starting another');
  threw = false; try { A.startPaper(p, [], T(2)); A.startPaper(p, [9], T(2)); } catch (e) { threw = true; }
  ok(threw, 'an attempt needs a section it can sit');
  const seq = A.sequence(a, s.exams);
  ok(seq.length === 8 && seq.every(e => e.si === 1), 'eight answerables, all in Section II');
  A.record(a, '1-0-0', 'Speed.', marked(2, 2), T(3));
  A.record(a, '1-0-1', 'Hours.', refused(3), T(3));
  A.setDraft(a, '1-0-2', '1.5', T(3));
  A.toggleFlag(a, '1-0-1', T(3)); A.toggleFlag(a, '1-1-0', T(3)); A.toggleFlag(a, '1-1-0', T(3));
  A.moveTo(a, '1-0-2', T(4));
  const sm = A.summary(a, s.exams);
  ok(sm.answered === 1 && sm.notMarked === 1 && sm.flagged === 1 && sm.got === 2 && sm.max === 40 && sm.total === 8,
     'answered is marked only; a refusal is not marked and adds nothing: ' + JSON.stringify(sm));
  ok(sm.status === 'in_progress' && sm.at.key === '1-0-2' && sm.whole === false, 'in progress, resuming at 11(c), not the whole paper');
  const st = A.itemState(a, '1-0-1');
  ok(!st.answered && st.notMarked && st.flagged && !st.current, 'one item: submitted but not marked, and flagged');
  ok(A.itemState(a, '1-0-2').drafted && A.itemState(a, '1-0-2').current, 'a draft is kept and is where Resume goes');
  A.record(a, '1-0-1', 'Hours.', marked(1, 3), T(5));
  ok(A.summary(a, s.exams).answered === 2 && A.summary(a, s.exams).notMarked === 0, 'a successful retry replaces the unmarked state');
  ok(a.drafts['1-0-0'] === undefined, 'submitting clears the draft it came from');
}

console.log('--- the either/or is one slot until chosen');
{
  const s = store(), p = fresh(); A.addPaper(s, p);
  const a = A.startPaper(p, null, T(1));
  let seq = A.sequence(a, s.exams);
  ok(seq.length === 20 && seq.filter(e => e.si === 3).length === 1 && seq[19].eitherSlot, 'twenty items, Section IV one slot');
  ok(A.summary(a, s.exams).max === 90, 'the paper is out of 90 before anything is chosen');
  A.choose(a, 3, 1, T(2));
  seq = A.sequence(a, s.exams);
  ok(seq[19].key === '3-1' && !seq[19].eitherSlot && seq[19].display === '16', 'choosing Question 16 puts it in the slot');
  A.setDraft(a, '3-1', 'A draft.', T(3));
  let threw = false; try { A.choose(a, 3, 0, T(4)); } catch (e) { threw = true; }
  ok(threw, 'a choice with work in it cannot be changed');
  A.setDraft(a, '3-1', '', T(5));
  A.choose(a, 3, 0, T(6));
  ok(A.sequence(a, s.exams)[19].key === '3-0', 'with the draft cleared, the choice can change');
}
{
  // Options that are parents: the slot is one item to visit, but it stands for
  // the option's parts, as PAPER.totals counts them before the attempt starts.
  const s = store(), p = fresh();
  const iv = p.sections[3];
  iv.questions = iv.questions.map((q, i) => ({ id: q.id, number: q.number, marks: q.marks, prompt: 'Option ' + (i + 1),
    parts: [{ id: q.id + 'a', label: 'a', marks: q.marks - 5, format: 'extended_response', prompt: q.prompt },
            { id: q.id + 'b', label: 'b', marks: 5, format: 'extended_response', prompt: q.prompt }] }));
  A.addPaper(s, p);
  const a = A.startPaper(p, null, T(1));
  const before = A.summary(a, s.exams).total, seq = A.sequence(a, s.exams);
  ok(seq.filter(e => e.si === 3).length === 1 && before === P.totals(p).questions,
     'an unchosen either/or of parents counts as the overview counts it: ' + before + ' vs ' + P.totals(p).questions);
  A.choose(a, 3, 1, T(2));
  ok(A.summary(a, s.exams).total === before, 'and choosing does not change the count');
}

console.log('--- a type session never touches the paper (decision 19)');
{
  const s = store(), p = fresh(); A.addPaper(s, p);
  const pk = A.paperKey(p), tk = A.typeKey('short_answer');
  const pa = A.begin(s, pk, A.startPaper(p, null, T(1)));
  A.record(pa, '1-0-0', 'Paper answer.', marked(1, 2), T(1));
  const chosen = A.bank('short_answer', s.exams, PACKAGES).filter(b => ['11(b)', '12(b)'].includes(b.display));
  const ta = A.begin(s, tk, A.startType('short_answer', chosen, T(2)));
  ok(ta.items.length === 2 && ta.at === p.id + '#1-0-1', 'the session covers exactly the two chosen questions');
  const tseq = A.sequence(ta, s.exams);
  ok(tseq.map(e => e.display).join(' ') === '11(b) 12(b)' && tseq.every(e => e.parent), 'each is found in its paper, with its parent');
  A.record(ta, tseq[0].key, 'Type answer.', marked(3, 3), T(3));
  A.toggleFlag(ta, tseq[1].key, T(3));
  const before = JSON.stringify(s.attempts[pk]);
  ok(A.summary(ta, s.exams).answered === 1 && A.summary(ta, s.exams).flagged === 1, 'the session counts its own work');
  ok(JSON.stringify(s.attempts[pk]) === before && !('1-0-1' in pa.answers) && pa.flags.length === 0,
     'the paper attempt has none of it');
  ok(A.summary(pa, s.exams).answered === 1 && pa.answers['1-0-0'] === 'Paper answer.', 'and keeps its own');
  // The same question in both, with different answers, never collides.
  A.record(pa, '1-0-1', 'Paper 11(b).', refused(3), T(4));
  ok(ta.answers[tseq[0].key] === 'Type answer.' && pa.answers['1-0-1'] === 'Paper 11(b).', 'the same 11(b), two answers');
  // Either option of an either/or can be practised.
  const ext = A.bank('extended_response', s.exams, PACKAGES);
  const both = A.startType('extended_response', ext.filter(b => b.si === 3), T(5));
  ok(A.sequence(both, s.exams).map(e => e.display).join(' ') === '15 16', 'both Section IV options in a session');
}

console.log('--- Start again, completing, deleting');
{
  const s = store(), p = fresh(); A.addPaper(s, p);
  const k = A.paperKey(p);
  A.begin(s, k, A.startPaper(p, null, T(1)));
  const done = A.complete(s, k, T(2));
  ok(done && done.completedAt === T(2) && s.attempts[k].current === null && A.summary(done, s.exams).status === 'completed',
     'completing moves the attempt to last');
  const again = A.begin(s, k, A.startPaper(p, [0], T(3)));
  A.record(again, '0-0', 0, marked(1, 1), T(3));
  A.discard(s, k);
  ok(s.attempts[k].current === null && s.attempts[k].last === done, 'Start again discards the attempt in progress and keeps the last');
  A.begin(s, k, A.startPaper(p, null, T(4)));
  A.begin(s, A.typeKey('multiple_choice'), A.startType('multiple_choice', A.bank('multiple_choice', s.exams, PACKAGES).slice(0, 2), T(4)));
  A.deletePaper(s, A.identityOf(p));
  ok(!s.exams.length && !Object.keys(s.attempts).length, 'deleting a paper removes its versions, its attempts and the sessions it lent to');
}

console.log('--- a backup restores papers by the version rule');
{
  const s = store(), v1 = fresh(); v1.id = 'here-1'; A.addPaper(s, v1);
  const v2 = fresh(); v2.id = 'backup-2'; v2.exam.version = '2';
  const dup = fresh(); dup.id = 'backup-1';
  A.restorePapers(s, [dup, v2]);
  ok(A.library(s.exams).length === 1 && A.library(s.exams)[0] === v2, 'a newer version from a backup replaces, one card: ' + A.library(s.exams).map(p => p.id));
  A.collect(s);
  ok(!s.exams.some(p => p.id === 'backup-1') && !s.exams.includes(v1), 'and the unpinned old copies are collected');
  const t = store(), w2 = fresh(); w2.id = 'here-2'; w2.exam.version = '2'; A.addPaper(t, w2);
  const old = fresh(); old.id = 'backup-old';
  const pinnedOld = A.startPaper(old, null, T(1));
  A.restorePapers(t, [old]);
  t.attempts[A.paperKey(old)] = { current: pinnedOld, last: null };
  A.collect(t);
  ok(A.library(t.exams).length === 1 && A.library(t.exams)[0] === w2 && t.exams.includes(old),
     'an older version from a backup stays hidden while its restored attempt is pinned to it');
}

console.log('--- the submit report adds up, from one predicate (Slice B, state 1)');
{
  const s = store(), p = fresh(); A.addPaper(s, p);
  const a = A.startPaper(p, null, T(1));
  const M = (score, max) => ASSESS.marked({ score, max, kind: 'mc' });
  for (let i = 0; i < 10; i++) A.record(a, '0-' + i, 0, M(i % 2, 1), T(2));
  A.record(a, '1-0-0', 'Speed.', M(2, 2), T(3));
  A.setDraft(a, '1-0-0', 'Speed, because the queue is long.', T(3));               // changed after marking
  A.record(a, '1-0-2', '60000 40000', ASSESS.refuse('CALC_UNREADABLE', 'Write the final value.', { max: 4 }), T(4));
  A.record(a, '1-1-0', 'An answer.', ASSESS.fail('MARKER_UNREACHABLE', 'Not reached.', { max: 3, retry: true }), T(5));
  A.record(a, '1-1-1', 'Another.', ASSESS.refuse('MARKER_NOT_CONNECTED', 'No marker.', { max: 5, retry: false }), T(5));
  A.setDraft(a, '1-0-3', 'A draft never submitted.', T(6));
  A.setDraft(a, '1-1-2', 'Being marked now.', T(6));
  A.toggleFlag(a, '0-6', T(7)); A.toggleFlag(a, '1-2', T(7));
  const r = A.report(a, s.exams, ['1-1-2']), sm = A.summary(a, s.exams);
  const by = k => r.items.find(x => x.key === k);
  ok(r.rows.marked.count + r.rows.notMarked.count + r.rows.notAnswered.count === sm.total && r.total === sm.total,
     'the three rows add up to the attempt: ' + [r.rows.marked.count, r.rows.notMarked.count, r.rows.notAnswered.count, sm.total].join(' '));
  ok(r.rows.marked.worth + r.rows.notMarked.worth + r.rows.notAnswered.worth === sm.max && r.max === 90,
     'their marks add up to what the paper is out of: ' + [r.rows.marked.worth, r.rows.notMarked.worth, r.rows.notAnswered.worth].join(' + '));
  ok(r.rows.marked.earned === sm.got && r.rows.marked.count === sm.answered && r.rows.notMarked.count === sm.notMarked,
     'and agree with summary() on marks, answered and not marked');
  ok(by('1-0-2').help === 'change' && by('1-1-0').help === 'retry' && by('1-1-1').help === 'settings',
     'a not-marked answer says what could change it: ' + ['1-0-2', '1-1-0', '1-1-1'].map(k => by(k).help).join(' '));
  ok(by('1-0-3').status === 'not_answered' && by('1-0-3').draft === 'written' && by('1-2').draft === null,
     'a draft never submitted is not answered, and is told apart from a blank question');
  ok(by('1-0-0').status === 'marked' && by('1-0-0').changed && r.changed.join() === '1-0-0',
     'a change after marking keeps the mark and is reported as a change');
  ok(by('1-1-2').pending && by('1-1-2').status === 'not_answered' && r.rows.notAnswered.pending === 1 && r.pending.join() === '1-1-2',
     'an answer being marked is pending, and not answered until its mark lands');
  ok(r.flagged.join(' ') === '0-6 1-2' && r.flagged.length === sm.flagged, 'flags are the attempt\'s, in paper order');
  const slot = r.items.find(x => x.eitherSlot);
  ok(slot && slot.options.join(' ') === '15 16' && slot.weight === 1 && slot.marks === 20 && slot.status === 'not_answered',
     'an unchosen either/or is one item, worth one option');
  ok(r.either.length === 1 && r.either[0].chosen === null && !r.either[0].locked, 'and the either/or reads as not chosen');
  A.choose(a, 3, 1, T(8)); A.setDraft(a, '3-1', 'Started.', T(8));
  const r2 = A.report(a, s.exams, []);
  ok(r2.either[0].chosen === 1 && r2.either[0].locked && !r2.items.some(x => x.key === '3-0'),
     'chosen with work, it is locked, and the other option is in no list');
  ok(r2.pending.length === 0 && r2.sections.length === 4 && r2.sections.reduce((n, x) => n + x.total, 0) === r2.total,
     'nothing is pending without a pending list, and the sections add up');
  const part = A.startPaper(p, [1], T(9));
  const r3 = A.report(part, s.exams, []);
  ok(r3.total === 8 && r3.max === 40 && r3.sections.length === 1 && r3.either.length === 0, 'a partial attempt reports only its sections');
}
{
  const s = store(), p = fresh(); A.addPaper(s, p);
  const a = A.startPaper(p, null, T(1));
  a.results['0-0'] = { score: 1, max: 1 };          // written before outcomes existed
  a.results['0-1'] = { error: 'no' };
  a.results['0-2'] = 'nonsense';
  const st = { [A.paperKey(p)]: { current: a, last: null } };
  A.sane(st, s.exams);
  ok(a.results['0-0'].outcome === 'success' && A.itemState(a, '0-0').answered && A.summary(a, s.exams).answered === 1,
     'a stored result without an outcome is read one way by every reader');
  ok(a.results['0-1'].outcome === 'refused' && !('0-2' in a.results), 'an old error is refused, and a result that is not one is dropped');
}

console.log('--- a flag follows an either/or choice; changes still being marked are not changes');
{
  const s = store(), p = fresh(); A.addPaper(s, p);
  const a = A.startPaper(p, null, T(1));
  A.toggleFlag(a, '3-0', T(2));                       // the unchosen slot, Question 15 or 16
  A.choose(a, 3, 1, T(3), p);
  ok(A.report(a, s.exams, []).flagged.join() === '3-1' && A.summary(a, s.exams).flagged === 1,
     'a flag on the slot moves to the question chosen: ' + a.flags.join());
  A.choose(a, 3, 0, T(4), p);
  ok(a.flags.join() === '3-0', 'and with nothing written, switching takes it along');
  const q = fresh(); q.exam = Object.assign({}, q.exam, { id: 'parents-copy' }); q.sections[3].questions = q.sections[3].questions.map((x, i) => ({ id: x.id, number: x.number, marks: x.marks, prompt: 'Option',
    parts: [{ id: 'a' + i, label: 'a', marks: x.marks - 5, format: 'extended_response', prompt: x.prompt }, { id: 'b' + i, label: 'b', marks: 5, format: 'extended_response', prompt: x.prompt }] }));
  A.addPaper(s, q);
  const b = A.startPaper(q, null, T(1));
  A.toggleFlag(b, '3-0', T(2)); A.choose(b, 3, 0, T(3), q);
  ok(b.flags.join() === '3-0-0' && A.report(b, s.exams, []).flagged.join() === '3-0-0', 'and onto the first part when the option has parts: ' + b.flags.join());

  const c = A.startPaper(p, null, T(1));
  A.record(c, '1-0-0', 'Speed.', ASSESS.marked({ score: 1, max: 2, kind: 'points' }), T(2));
  A.setDraft(c, '1-0-0', 'Speed, because customers wait.', T(3));
  ok(A.report(c, s.exams, ['1-0-0']).changed.length === 0, 'a change being marked was submitted, so it is not reported as a change');
  ok(A.report(c, s.exams, []).changed.join() === '1-0-0', 'after a reload, with nothing pending, it is a change again');
  A.record(c, '0-0', 1, ASSESS.marked({ score: 0, max: 1, kind: 'mc' }), T(2)); A.setDraft(c, '0-0', '2', T(3));
  ok(!A.report(c, s.exams, []).changed.includes('0-0'), 'a multiple-choice re-pick is not listed, since the sitting does not show it beside the mark');
  A.record(c, '1-1-0', 'x', ASSESS.refuse('MARKER_NOT_CONNECTED', 'No marker.', { max: 3, retry: false }), T(2));
  ok(A.report(c, s.exams, []).items.find(x => x.key === '1-1-0').help === 'settings', 'a refusal a marker setting fixes says so');
  A.record(c, '1-0-2', '1.5', ASSESS.refuse('CALC_KEY_INCOMPLETE', 'No key.', { max: 4 }), T(2));
  ok(A.report(c, s.exams, []).items.find(x => x.key === '1-0-2').help === 'none', 'and one nothing in the sitting changes says that');
}

console.log('--- a restored store is not trusted');
{
  const p = fresh();
  const good = A.startPaper(p, null, T(1));
  const raw = {
    'paper:x': { current: good, last: { scope: 'paper', paper: 'gone', sections: [0] } },
    'paper:y': { current: { scope: 'nonsense' }, last: null },
    'type:short_answer': { current: { scope: 'type', items: [{ paper: 'gone', key: '1-0-0' }] }, last: null },
    'paper:z': 'not an object',
  };
  delete good.flags; good.results = null;
  const out = A.sane(raw, [p]);
  ok(Object.keys(out).join() === 'paper:x' && out['paper:x'].last === null, 'only the recognisable attempt survives: ' + Object.keys(out));
  ok(Array.isArray(out['paper:x'].current.flags) && typeof out['paper:x'].current.results === 'object',
     'and its bags are made well formed rather than repaired into something else');
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
