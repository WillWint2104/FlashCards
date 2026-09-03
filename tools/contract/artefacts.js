// Everything the contract publishes, as text, computed and returned rather than
// written. build.js stages and promotes the whole set together: all the fallible
// work happens here, above the point where anything reaches disk, so a fault in
// the content refuses the build instead of publishing half a set from a build
// that then exits non-zero.
const path = require("path");
const lib = require("./libraries.js");
const gen = require("./generate.js");
const { packagize } = require("./packagize.js");

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
  ids.forEach(id => out.push({ dir: C, name: "example-" + id + ".json", text: J(packagize(id).pkg) }));
  return out;
}
module.exports = { artefacts };
