// THE PAGE'S OWN WEB FONTS, FOR THE SUITES THAT MEASURE WHERE THINGS LAND.
//
// tests/env.js blocks every external request, fonts included, because nothing it
// asserts depends on them and a blocked page loads in 0.14s. Fold positions DO
// depend on them: the fallback face is wider than Nunito, lines break earlier, and
// every fold number this project took that way was wrong - the state 13 review
// found the business report's mark behind the footer where the fallback said it
// was below the fold.
//
// So a suite that asserts a fold uses the real fonts, served from a local cache:
// fetched once with curl (which goes through the sandbox proxy reliably, where a
// font request from inside Chromium did not), kept under tests/out/fonts, which is
// gitignored, so no font file is committed. The CSS is the exact stylesheet the
// mockups link. If it cannot be fetched and is not cached, this throws: a fold
// suite that quietly ran on the fallback face is the failure it exists to prevent.
const fs = require("fs"), path = require("path");
const { execFileSync } = require("child_process");
const { OUT } = require("./env");

const CSS_URL = "https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap";
// A current Chrome's user agent, so the stylesheet names woff2 files.
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const DIR = path.join(OUT, "fonts");

// Downloaded beside the cache and moved in only once complete, so a timeout or
// a dropped connection never leaves a truncated file that later runs trust.
function fetchTo(url, file) {
  const tmp = file + ".part";
  try {
    execFileSync("curl", ["-sS", "-f", "--max-time", "30", "-A", UA, "-o", tmp, url], { stdio: ["ignore", "ignore", "pipe"] });
    fs.renameSync(tmp, file);
  } finally {
    try { fs.unlinkSync(tmp); } catch (e) { /* renamed, or never written */ }
  }
}
function ensureFonts() {
  fs.mkdirSync(DIR, { recursive: true });
  const cssFile = path.join(DIR, "fonts.css");
  if (!fs.existsSync(cssFile)) fetchTo(CSS_URL, cssFile);
  const css = fs.readFileSync(cssFile, "utf8");
  const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1]))];
  if (!urls.length) throw new Error("the cached font stylesheet names no font files: " + cssFile);
  const files = {};
  urls.forEach(u => {
    const f = path.join(DIR, u.replace(/^https:\/\/fonts\.gstatic\.com\//, "").replace(/[^\w.-]/g, "_"));
    if (!fs.existsSync(f)) fetchTo(u, f);
    files[u] = f;
  });
  return { css, files };
}
// Route a page's font requests to the cache. Everything else stays blocked, as
// tests/env.js blocks it.
async function serveFonts(page) {
  const { css, files } = ensureFonts();
  await page.route(/^https:\/\/fonts\.googleapis\.com\//, r => r.fulfill({ status: 200, contentType: "text/css", body: css }));
  await page.route(/^https:\/\/fonts\.gstatic\.com\//, r => {
    const f = files[r.request().url()];
    return f ? r.fulfill({ status: 200, contentType: "font/woff2", body: fs.readFileSync(f) }) : r.abort();
  });
}
// Proven, not assumed: document.fonts.check() is true when no face matches at all.
async function fontsLoaded(page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const f = [...document.fonts].filter(x => x.status === "loaded").map(x => x.family.replace(/"/g, ""));
    return f.includes("Fredoka") && f.includes("Nunito");
  });
}
module.exports = { ensureFonts, serveFonts, fontsLoaded };
