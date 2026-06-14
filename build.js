#!/usr/bin/env node
// =============================================================================
// build.js — regenerate marginal-preview.html from the three sources.
//
// marginal-preview.html is a GENERATED single-file build of the whole app:
// it inlines content.js and app.js into the index.html shell so the app can be
// previewed or shared as one self-contained file. Never hand-edit it — edit the
// sources and re-run:  node build.js
//
// The TEACHER SETUP config block in index.html is carried through unchanged,
// so the single-file build picks up the same baked-in endpoint/class code.
// =============================================================================
const fs = require("fs");
const path = require("path");

const root = __dirname;
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

const shell = read("index.html");
const content = read("content.js");
const app = read("app.js");

// Inline a source file as a <script> block. Use a replacer FUNCTION so `$` in
// the source (template literals etc.) is never interpreted as a replacement
// pattern, and assert the tag exists exactly once.
function inlineScript(html, srcTag, source) {
  if (/<\/script/i.test(source)) {
    throw new Error(`Source for ${srcTag} contains a literal </script — cannot inline.`);
  }
  const occurrences = html.split(srcTag).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected exactly one ${srcTag} in index.html, found ${occurrences}.`);
  }
  return html.replace(srcTag, () => `<script>\n${source}\n</script>`);
}

let out = shell;
out = inlineScript(out, '<script src="content.js"></script>', content);
out = inlineScript(out, '<script src="app.js"></script>', app);

fs.writeFileSync(path.join(root, "marginal-preview.html"), out);
console.log(`built marginal-preview.html (${out.length} bytes)`);
