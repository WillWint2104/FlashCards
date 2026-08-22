// Pull the REAL reconciliation functions out of app.js so the tests exercise the
// shipped code, not a copy of it.
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
function grab(startMarker, endMarker) {
  const i = src.indexOf(startMarker); if (i < 0) throw new Error("missing " + startMarker);
  const j = src.indexOf(endMarker, i); if (j < 0) throw new Error("missing end for " + startMarker);
  return src.slice(i, j);
}
const parts = [
  grab("  const ES_ABBR =", "  // Ids are minted per draft"),
  grab("  function esNewBlock(d, text, slot, status) {", "  const esNormLine ="),
  grab("  const esNormLine =", "  function esBlocks(p) {"),
].join("\n");
fs.writeFileSync(path.join(__dirname, "blocks.mjs"),
  parts + "\nexport { esSplitBlocks, esNewBlock, esNormLine, esReconcileBlocks };\n");
console.log("block shim written");
