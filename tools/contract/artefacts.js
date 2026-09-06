// Everything the contract publishes, as text, computed and returned rather than
// written. build.js stages and promotes the whole set together: all the fallible
// work happens here, above the point where anything reaches disk, so a fault in
// the content refuses the build instead of publishing half a set from a build
// that then exits non-zero.
const path = require("path");
const lib = require("./libraries.js");
const gen = require("./generate.js");
const { packagize } = require("./packagize.js");
const directives = require("./directives.js");
const fixtures = require("./fixtures.js");

const J = o => JSON.stringify(o, null, 2) + "\n";

function artefacts(root) {
  const C = path.join(root, "docs", "contract");
  const man = lib.manifest();
  const { libraries, E } = lib.build();
  const out = [
    { dir: C, name: "library-manifest.json", text: J(man) },
    { dir: C, name: "shared-libraries.json",
      text: J({ schema: "marginal.shared-libraries", version: 1, libraries: libraries }) },
    { dir: C, name: "question-package.schema.json", text: J(gen.jsonSchema(man)) },
    { dir: C, name: "authoring-guide.md", text: gen.guide(man) },
    { dir: C, name: "template-causal.json", text: J(gen.template("causal", man)) },
    { dir: C, name: "template-judgement.json", text: J(gen.template("judgement", man)) },
    { dir: C, name: "template-write-only.json", text: J(gen.template("write-only", man)) },
  ];
  const ids = [];
  Object.keys(E.subjects).forEach(sk => (E.subjects[sk].questions || []).forEach(q => ids.push(q.id)));
  const built = ids.map(id => ({ id: id, r: packagize(id) }));
  built.forEach(b => out.push({ dir: C, name: "example-" + b.id + ".json", text: J(b.r.pkg) }));

  const REG = directives.registry();
  out.push({ dir: C, name: "directive-registry.json", text: J(REG) });
  // What questions already exist where an import would land. Generated for the
  // same reason the manifest is: the importer runs in a browser and cannot walk
  // the content files, and a hand kept copy of the bank would go stale silently.
  out.push({ dir: C, name: "question-registry.json", text: J(lib.questionRegistry()) });
  // Topic ids to their authored labels. The runtime needs a display name for a
  // question that carries only a topicRef, and the label belongs to the syllabus
  // record rather than to the question. Generated for the same reason the
  // manifest is: it cannot then disagree with the library it came from.
  const topicIndex = {};
  Object.values(libraries.syllabus).forEach(r => { if (r.kind === "topic") topicIndex[r.id] = r.label; });
  out.push({ dir: C, name: "topic-index.json",
    text: J({ schema: "marginal.topic-index", version: 1, topics: topicIndex }) });
  out.push({ dir: C, name: "fixture-manifest.json",
    text: J(fixtures.manifest(built.map(b => b.r.pkg), man, REG)) });
  out.push({ dir: C, name: "criterion-mapping.md", text: criterionMapping(built) });
  return out;
}

// The right-hand end of every plan claim, and what it resolved to. Published for
// review because the resolution rule is deliberately narrow: a label matches a
// syllabus sub-node or the head of a point's title, both of which are authored
// punctuation, and nothing is matched on resemblance.
function criterionMapping(built) {
  const hits = [], misses = {};
  built.forEach(b => {
    (b.r.criteria.resolved || []).forEach(h => hits.push(Object.assign({ q: b.id }, h)));
    (b.r.criteria.unresolved || []).forEach(m => {
      const k = m.label;
      misses[k] = misses[k] || { label: k, count: 0, questions: [], reason: m.reason, proposed: m.proposed };
      misses[k].count++;
      if (misses[k].questions.indexOf(b.id) < 0) misses[k].questions.push(b.id);
    });
  });
  const missRows = Object.values(misses).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const total = hits.length + missRows.reduce((n, m) => n + m.count, 0);
  const L = [];
  L.push("# Criterion ids");
  L.push("");
  L.push("**Generated. Do not edit.** A plan claim states what one end of the essay does to");
  L.push("the other, and the right-hand end has to be an id or it is a display string doing");
  L.push("the job of identity. This is where those ids come from and which ones are still");
  L.push("missing.");
  L.push("");
  L.push("## The decision");
  L.push("");
  L.push("**No separate criterion registry.** The syllabus graph already represents these:");
  L.push("a point names its own parts in its title, after an authored dash, and each part");
  L.push("becomes a node with an id.");
  L.push("");
  L.push("    business.operations.operations-strategies.performance-objectives.quality");
  L.push("    business.operations.operations-strategies.performance-objectives.speed");
  L.push("");
  L.push("A right-hand label resolves when it exactly matches, after normalising, either a");
  L.push("sub-node's label or the head of a point's title. Scoped to the question's own");
  L.push("topic first, then to the subject. A label matching two nodes in scope resolves to");
  L.push("neither: an ambiguous id is worse than a missing one.");
  L.push("");
  L.push("Nothing is recovered from the `what` prose, and no label is ever matched on");
  L.push("resemblance. An imported author never references identity by a display string.");
  L.push("");
  L.push("## What resolves today");
  L.push("");
  L.push("    " + hits.length + " of " + total + " right-hand ends resolve deterministically");
  L.push("    " + (total - hits.length) + " do not, across " + missRows.length + " distinct labels");
  L.push("");
  L.push("| question | label | resolves to | kind | scope |");
  L.push("| --- | --- | --- | --- | --- |");
  hits.forEach(h => L.push("| `" + h.q + "` | " + h.label + " | `" + h.id + "` | " + h.kind + " | " + h.scope + " |"));
  L.push("");
  L.push("## What does not, and why");
  L.push("");
  L.push("Every one of these is a real syllabus idea. None of them is in a place the graph");
  L.push("can address yet, because the syllabus point that owns it does not name its parts");
  L.push("in its title. `objectives of financial management` is the clearest case: the five");
  L.push("objectives are the point's parts and the title does not list them.");
  L.push("");
  L.push("The fix is authoring sub-nodes under the points that own them, in the existing");
  L.push("graph. It is not a new identifier scheme, and the ids it produces are the ones");
  L.push("already shown in the proposed column.");
  L.push("");
  L.push("| label | used | in | why it does not resolve | id it would have |");
  L.push("| --- | --- | --- | --- | --- |");
  missRows.forEach(m => L.push("| " + m.label + " | " + m.count + " | " +
    m.questions.map(q => "`" + q + "`").join(", ") + " | " + m.reason + " | `" +
    (m.proposed || "(the question has no topic)") + "` |"));
  L.push("");
  L.push("Until they are authored, `criterionRef` is `null` and counted. A null is the");
  L.push("contract saying it does not know, which is the one thing a display string in that");
  L.push("position could never say.");
  return L.join("\n") + "\n";
}
module.exports = { artefacts };
