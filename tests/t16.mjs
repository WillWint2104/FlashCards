// The sentence shapes are the only structural teaching a stuck student gets, so the
// contract is that each stage teaches a DIFFERENT sentence. A student who follows
// the scaffold exactly must not end up writing a paragraph opener where an essay
// opener belongs. Static, because it is a property of the content, not of a screen.
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../essay-content.js", import.meta.url), "utf8");
globalThis.window = {};
new Function(src)();
const E = Object.values(globalThis.window)[0];
const T = E.slots.templates;
const scaffolds = (function walk(o) {
  if (!o || typeof o !== "object") return null;
  if (o.scaffolds) return o.scaffolds;
  for (const v of Object.values(o)) { const r = walk(v); if (r) return r; }
  return null;
})(E);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };
const frames = t => t ? [t.tier1].concat((t.tier2 || []).map(x => x.frame)).filter(Boolean) : [];
const norm = f => String(f).replace(/_+/g, "_").trim().toLowerCase();

console.log("1. every directive family resolves");
const fams = T.directiveFamilies;
ok(!!fams, "the directive families are authored");
const commands = [];
(function walk(o) {
  if (!o || typeof o !== "object") return;
  if (Array.isArray(o)) return o.forEach(walk);
  if (o.id && o.text && o.command) commands.push(o.command);
  Object.values(o).forEach(walk);
})(E);
const family = cmd => {
  const c = String(cmd).toLowerCase();
  for (const n of Object.keys(fams)) if ((fams[n] || []).some(x => c === x || c.indexOf(x) === 0)) return n;
  return null;
};
const unrouted = [...new Set(commands)].filter(c => !family(c));
ok(unrouted.length === 0, "every authored directive maps to a family, none fall through to the default: " + JSON.stringify(unrouted));

console.log("2. a thesis is not a topic sentence");
for (const fam of Object.keys(T.thesis.byFamily || {})) {
  const th = frames(T.thesis.byFamily[fam]).map(norm);
  for (const [name, sc] of Object.entries(scaffolds || {})) {
    const tp = frames(sc.templates && sc.templates.topic).map(norm);
    const shared = th.filter(x => tp.includes(x));
    ok(shared.length === 0, `${fam} thesis shares no frame with ${name} topic: ${JSON.stringify(shared)}`);
  }
  ok(th.some(x => /through|and|although|because/.test(x)),
    `${fam} thesis frames carry more than one part, as a whole-question answer must`);
}

console.log("3. the families genuinely differ");
const causal = frames(T.thesis.byFamily.causal).map(norm);
const judge = frames(T.thesis.byFamily.judgement).map(norm);
ok(causal.filter(x => judge.includes(x)).length === 0, "causal and judgement theses share no frame");
ok(judge.some(x => /although|balance|weigh/.test(x)), "a judgement thesis weighs something");
ok(!causal.some(x => /although|balance|weigh/.test(x)), "and a causal thesis does not, because the question did not ask for it");

console.log("4. every body stage has its own shape");
for (const [name, sc] of Object.entries(scaffolds || {})) {
  const seen = new Map();
  for (const slot of sc.body || []) {
    const f = frames(sc.templates && sc.templates[slot.key]).map(norm);
    ok(f.length > 0, `${name}.${slot.key} has at least one authored shape`);
    for (const x of f) {
      if (seen.has(x)) ok(false, `${name}: ${slot.key} repeats the shape used by ${seen.get(x)}: ${JSON.stringify(x)}`);
      seen.set(x, slot.key);
    }
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
