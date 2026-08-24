// Pull the REAL evidence verification gate out of app.js, for the same reason as
// the other shims: a copy of the rule here could stay correct while the app
// drifts, which is the failure the shim exists to prevent.
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
function grab(startMarker, endMarker) {
  const i = src.indexOf(startMarker); if (i < 0) throw new Error("missing " + startMarker);
  const j = src.indexOf(endMarker, i); if (j < 0) throw new Error("missing end for " + startMarker);
  return src.slice(i, j);
}
const body = grab("  function esEvidenceUsable(e)", "  function esEvidenceBank()");
// Tripwires, one per half of the rule. Publication needs a recorded source AND a
// date someone checked it, and neither may be satisfied by whitespace. If any of
// these stops being in the extracted text, this shim is describing a weaker rule
// and the contract test below would be defending it.
if (!/e\.source/.test(body)) {
  throw new Error("esEvidenceUsable no longer reads e.source; re-read it before trusting this shim");
}
if (!/e\.checked/.test(body)) {
  throw new Error("esEvidenceUsable no longer reads e.checked; a source nobody opened would now publish");
}
if ((body.match(/\.trim\(\)/g) || []).length < 2) {
  throw new Error("esEvidenceUsable no longer trims both fields; whitespace would now publish");
}
const OUT = path.join(__dirname, "out");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "evidence-shim.mjs"), body + "\nexport { esEvidenceUsable };\n");
console.log("evidence shim written");
