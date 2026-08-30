// Pull the REAL withholding rule out of app.js, so the contract test exercises
// the shipped function rather than a copy that could stay correct while the app
// drifts. Same technique as the other shims in this directory, and for the same
// reason.
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
function grab(startMarker, endMarker) {
  const i = src.indexOf(startMarker); if (i < 0) throw new Error("missing " + startMarker);
  const j = src.indexOf(endMarker, i); if (j < 0) throw new Error("missing end for " + startMarker);
  return src.slice(i, j);
}
const body = grab("  function esLearning(p) {", "  // The concept store for the subject");
if (!/status === "authored"/.test(body)) {
  // The rule is one comparison. If it stops being one, this shim is extracting
  // something else and the test below would be checking the wrong thing.
  throw new Error("esLearning no longer tests status === authored; re-read it before trusting this shim");
}
const head = `
// The only stub. A fact about which pathway was selected, never a
// reimplementation of the rule under test.
let PATHS = [];
export function setPathways(ps) { PATHS = ps || []; }
function esPathway(p) {
  return (p && p.argumentId && PATHS.find(x => x.id === p.argumentId)) || null;
}
`;
const out = head + body + "\nexport { esLearning };\n";
const OUT = path.join(__dirname, "out");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(__dirname, "out", "learn-shim.mjs"), out);
console.log("learning shim written");
