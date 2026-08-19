// Shared paths and the browser handle, so the suites run from a clone on any
// machine rather than from one container's scratch directory.
//
//   node tests/mkwalk.py-equivalent   -> tests/out/marginal-walkthrough.html
//   node tests/ui16.js               -> runs against it
//
// Playwright is taken from the project if it is installed there, and otherwise
// from the system install used by the hosted environment.
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "out") + path.sep;
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function loadPlaywright() {
  const tries = ["playwright", "@playwright/test", "/opt/node22/lib/node_modules/playwright"];
  for (const id of tries) { try { return require(id); } catch (e) { /* try the next */ } }
  throw new Error("Playwright not found. Run: npm i -D playwright");
}
const pw = loadPlaywright();

// The hosted environment pre-installs Chromium and asks that it not be re-fetched.
const HOSTED_CHROME = "/opt/pw-browsers/chromium";
const EXECUTABLE = fs.existsSync(HOSTED_CHROME) ? HOSTED_CHROME : undefined;

const chromium = {
  launch: (opts) => pw.chromium.launch(Object.assign({}, EXECUTABLE ? { executablePath: EXECUTABLE } : {}, opts || {})),
};

const url = f => "file://" + f.split(path.sep).join("/");
const WALK = path.join(OUT, "marginal-walkthrough.html");
// The plain build: shipped defaults, no walkthrough seed, marking switch off.
// Suites that test those defaults must use PLAIN, not the walkthrough.
const PLAIN = path.join(OUT, "test.html");
module.exports = {
  chromium, ROOT, OUT, BASE: OUT,
  WALK, T: url(WALK),
  PLAIN, P: url(PLAIN),
  fileUrl: name => url(path.join(OUT, name)),
};
