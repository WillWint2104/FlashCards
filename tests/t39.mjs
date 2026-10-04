// WHAT THE IMPORT PAGE SAYS (tools/contract/importread.js, Page 2).
//
// The five verdicts, a sentence a teacher can act on for every finding code the
// contract can emit, places in the paper's own numbering, the library match by
// identity and version, and what adding the paper puts under Practise a
// question type, which is the safely assessable questions only (decision 22).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const R = require(path.join(ROOT, 'tools/contract/importread.js'));
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const win = {}; new Function('window', read('essay-content.js'))(win);
const PK = win.ESSAY.subjects;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL:', m); } };
const RAW = read('tests/fixtures/bus-practice-paper.json');
const fresh = () => JSON.parse(RAW);
const T = o => JSON.stringify(o);

console.log('--- every finding code has a sentence');
{
  const all = new Set();
  for (const f of ['tools/contract/exam.js', 'tools/contract/assessment.js'])
    for (const m of read(f).matchAll(/"([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)"/g)) all.add(m[1]);
  const missing = [...all].filter(c => !R.NOT_AT_IMPORT.includes(c) && !R.SAY[c]);
  ok(all.size > 40 && !missing.length, 'codes without a sentence: ' + missing.join(', '));
  const words = Object.values(R.SAY).map(f => f({ course: 'X', needs: 2, label: 'Y', said: 1, sum: 2 })).join(' ');
  ok(!/—/.test(words), 'no em dash in any sentence');
}

console.log('--- the verdicts');
const verdict = (text, lib) => { const r = R.read(text, lib || [], PK); return r.kind === 'paper' ? r.group.title : r.kind; };
ok(verdict(T(fresh())) === 'Ready to import', 'the synthetic paper is ready');
{ const p = fresh(); delete p.curriculum.jurisdiction; ok(verdict(T(p)) === 'Ready with limited support', 'a missing state is limited support'); }
{ const p = fresh(); p.curriculum.subjectKey = 'legal_studies'; ok(verdict(T(p)) === 'Needs something resolved', 'an unregistered subject with written questions'); }
{ const p = fresh(); p.format = 'marginal-exam@2'; ok(verdict(T(p)) === 'version', 'a newer format is unsupported'); }
{ const p = fresh(); p.sections[1].marks = 38; ok(verdict(T(p)) === 'Invalid file', 'a disagreeing total is invalid'); }
{ const p = fresh(); delete p.sections[1].questions[0].parts[2].tolerance; ok(verdict(T(p)) === 'Invalid file', 'a calculation with no tolerance is invalid'); }
ok(verdict(RAW.slice(0, 500)) === 'unreadable', 'half a file is unreadable');
ok(verdict(T({ name: 'Set', cards: [{ prompt: 'a', model: 'b' }] })) === 'flashcards', 'a flashcard set belongs to Create');

console.log('--- the library');
{
  const lib = [fresh()];
  const same = R.read(RAW, lib, PK);
  ok(same.dup && !same.replacing, 'the same id and version is already there');
  const v2 = fresh(); v2.exam.version = '2';
  const r2 = R.read(T(v2), lib, PK);
  ok(r2.replacing && r2.match.kind === 'newer' && r2.match.from === '1', 'a newer version replaces version 1');
  const v0 = fresh(); v0.exam.version = '0';
  ok(R.read(T(v0), lib, PK).older, 'an older version adds nothing');
  const renamed = fresh(); renamed.name = 'Something else';
  ok(R.read(T(renamed), lib, PK).dup, 'a title is not identity');
}

console.log('--- places, in the paper\'s own words (decision 22)');
{
  const p = fresh();
  p.sections.forEach((s, i) => { s.name = 'Part ' + 'ABCD'[i] + ' - ' + s.name.split(' - ')[1]; });
  p.sections[1].questions[0].parts[1].marks = 'three';
  const r = R.read(T(p), [], PK);
  const where = R.groups(r).shown.flatMap(g => g.items.map(i => i.where));
  ok(where.includes('Part B, Question 11(b)'), 'Part B, never a numeral from position: ' + where.join(' | '));
  const c = R.contents(R.read(RAW, [], PK));
  ok(c.map(x => x.name).join('|') === 'Section I - Multiple choice|Section II - Short answer|Section III - Business report|Section IV - Extended response'
     && c[3].meta === 'choose 1 of 2 · 20 marks', 'contents are the authored names');
}

console.log('--- what adding it offers (decision 22)');
{
  const a = R.adds(fresh(), PK);
  ok(a.total === 21 && a.parts.join(', ') === '10 multiple choice, 4 short answer, 1 calculation, 1 business report, 5 extended response' && a.either.join() === 'Section IV',
     'the full paper offers everything: ' + JSON.stringify(a));
  const obj = fresh(); obj.curriculum.subjectKey = 'legal_studies';
  const calc = obj.sections[1].questions[0].parts[2];
  obj.sections = [obj.sections[0], { name: 'Section II - Calculation', questions: [Object.assign({}, calc, { number: '11' })] }];
  delete obj.marks; delete obj.sections[0].marks;
  const o = R.adds(obj, PK);
  ok(o.total === 11 && o.parts.join(', ') === '10 multiple choice, 1 calculation', 'an objective unregistered paper offers its local questions: ' + JSON.stringify(o));
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
