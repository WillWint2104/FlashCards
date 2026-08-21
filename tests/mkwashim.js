// Pull the REAL working-answer assembler out of app.js so the combinatorial test
// exercises the shipped code rather than a copy of it that could stay correct
// while the app drifts.
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
function grab(startMarker, endMarker) {
  const i = src.indexOf(startMarker); if (i < 0) throw new Error("missing " + startMarker);
  const j = src.indexOf(endMarker, i); if (j < 0) throw new Error("missing end for " + startMarker);
  return src.slice(i, j);
}
const parts = [
  grab("  function esWorkingParts(d) {", "  function esList(xs) {"),
  grab("  function esShapeKey(pos, n) {", "  function esPositionTensionHTML(d) {"),
].join("\n");

// The stubs the extracted code needs. Every one of them is a fact about the
// draft, never a reimplementation of the assembly under test.
const head = `
let QDEF = null;
export function setQuestion(q) { QDEF = q; }
function esQuestionDef() { return QDEF; }
function esBodyIndexes(d) { return d.paras.map((p, i) => i).filter(i => d.paras[i].body); }
function esPathway(p) { return (p && p.argumentId && (QDEF.pathways || []).find(x => x.id === p.argumentId)) || null; }
function esWordsOf(t) { return String(t || "").trim() ? String(t).trim().split(/\\s+/).length : 0; }
function esIsJudgement() { return ((QDEF && QDEF.coreAnswer && QDEF.coreAnswer.mode) || "causal") === "judgement"; }
function esPositionOf(d) {
  const id = d && d.position; if (!id) return null;
  if (String(id).indexOf("own:") === 0) return { id: id, label: String(id).slice(4), own: true };
  return ((QDEF.coreAnswer || {}).positions || []).find(x => x.id === id) || null;
}
`;
fs.writeFileSync(path.join(__dirname, "wa.mjs"),
  head + parts + "\nexport { esWorkingParts, esWorkingAnswer, esPositionTension };\n");
console.log("working answer shim written");
