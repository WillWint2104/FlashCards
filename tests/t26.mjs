// THE MUTATION RUNNER'S OWN SAFETY, WHICH IS NOT A HYPOTHETICAL.
//
// A mutation is applied by writing a file and undone by writing back what was
// read. That is only an undo if what was read was committed. Run it over
// uncommitted work and the restore puts back the uncommitted version, which is
// right until something goes wrong - and then the fault and the work are the same
// bytes and nothing can tell them apart.
//
// It went wrong. Mutation testing was being done by hand, in shell blocks, and
// `git checkout <file>` was used to undo mutations on three files that had
// uncommitted changes in them. The changes were gone. They were reconstructed
// from diffs that happened to have been printed earlier in the same session,
// which worked and is not a procedure: it depends on having printed the right
// thing before you needed it.
//
// tools/mutate.js now refuses to begin unless every tracked file is clean, checks
// again after each mutant, and has no flag to get past either. This suite is
// those guards, and it exercises the real functions against a real throwaway
// checkout rather than reading the source and hoping.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const mutate = require("../tools/mutate.js");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const TMP = path.join(ROOT, "tests/out/mutguard");
const git = (cwd, ...args) => execFileSync("git", args, { cwd: cwd, encoding: "utf8",
  env: Object.assign({}, process.env, { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" }) });

// ---- 1. requiring the runner does not start one ---------------------------
// It has to be requireable for this suite to exist at all, and a required copy
// that registers the exit handlers would delete the in-flight lock belonging to a
// real run in another process the moment this one exits.
console.log("--- 1. requiring it is not running it");
ok(typeof mutate.trackedDirty === "function", "the tree guard is exported");
ok(typeof mutate.dirtyRefusal === "function", "and so are the words it refuses with");
ok(Array.isArray(mutate.MUTATIONS) && mutate.MUTATIONS.length > 0,
  "the catalogue came with it: " + (mutate.MUTATIONS || []).length + " mutations");
ok(!fs.existsSync(path.join(ROOT, "tests/out/.mutation-in-flight")),
  "and requiring it left no lock behind");
{
  const src = fs.readFileSync(path.join(ROOT, "tools/mutate.js"), "utf8");
  ok(/const IS_RUN = require\.main === module;/.test(src), "the file knows whether it IS the run");
  ok(/if \(IS_RUN\) \{\s*\["exit", "SIGINT"/.test(src),
    "and only then does it take over the exit signals");
}

// ---- 2. a real checkout, clean and then not ------------------------------
console.log("--- 2. clean, dirty and not a checkout, told apart");
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
let haveGit = true;
try {
  git(TMP, "init", "-q");
  git(TMP, "config", "user.email", "t26@example.invalid");
  git(TMP, "config", "user.name", "t26");
  fs.writeFileSync(path.join(TMP, "kept.js"), "module.exports = 1;\n");
  fs.writeFileSync(path.join(TMP, "other.js"), "module.exports = 2;\n");
  git(TMP, "add", "-A");
  git(TMP, "commit", "-q", "-m", "one");
} catch (e) { haveGit = false; console.log("    (no usable git here: " + String(e).slice(0, 60) + ")"); }

if (haveGit) {
  ok(JSON.stringify(mutate.trackedDirty(TMP)) === "[]", "a committed tree is clean: " +
    JSON.stringify(mutate.trackedDirty(TMP)));
  ok(mutate.dirtyRefusal(mutate.trackedDirty(TMP)) === null, "and nothing is refused over it");

  // An UNTRACKED file is not uncommitted work in a tracked file, and treating it
  // as one would refuse every run in a tree with a scratch file in it.
  fs.writeFileSync(path.join(TMP, "scratch.log"), "noise\n");
  ok(JSON.stringify(mutate.trackedDirty(TMP)) === "[]",
    "an untracked file does not make it dirty: " + JSON.stringify(mutate.trackedDirty(TMP)));

  // The case that cost a session.
  fs.writeFileSync(path.join(TMP, "kept.js"), "module.exports = 1; // uncommitted work\n");
  const dirty = mutate.trackedDirty(TMP);
  ok(dirty.length === 1 && dirty[0] === "kept.js",
    "a modified tracked file is reported by name: " + JSON.stringify(dirty));
  const words = mutate.dirtyRefusal(dirty);
  ok(/^REFUSING TO START/.test(String(words)), "and the run is refused: " + JSON.stringify(String(words).slice(0, 40)));
  ok(/kept\.js/.test(String(words)), "with the file named, so it can be dealt with");
  ok(/not an undo/.test(String(words)), "and the reason given rather than an error code");

  // A file the run was never going to touch still stops it. The old check
  // intersected the dirty list with the files to be mutated, which meant a run
  // could start beside uncommitted work and call the tree safe.
  fs.writeFileSync(path.join(TMP, "kept.js"), "module.exports = 1;\n");
  fs.writeFileSync(path.join(TMP, "other.js"), "module.exports = 2; // elsewhere\n");
  const elsewhere = mutate.trackedDirty(TMP);
  ok(elsewhere.length === 1 && elsewhere[0] === "other.js",
    "a dirty file nothing intends to mutate is still dirty: " + JSON.stringify(elsewhere));
  ok(mutate.dirtyRefusal(elsewhere) !== null, "and still refuses the run");
}

// Somewhere that is not a checkout at all is a THIRD answer, and is refused for
// its own reason: nothing there can undo a mutation if the process dies.
// Outside the repository, or it is not outside a checkout: a directory under
// tests/out is still inside this one and git answers for the repo above it.
const os = require("node:os");
const notARepo = fs.mkdtempSync(path.join(os.tmpdir(), "mutguard-nogit-"));
{
  const r = mutate.trackedDirty(notARepo);
  ok(r === null, "a directory with no checkout answers null, not clean: " + JSON.stringify(r));
  const words = mutate.dirtyRefusal(null);
  ok(/^REFUSING TO START/.test(String(words)) && /not a git checkout/.test(String(words)),
    "and is refused as such: " + JSON.stringify(String(words).slice(0, 60)));
}

// ---- 3. there is no way past it ------------------------------------------
console.log("--- 3. no flag, and a check after every mutant");
{
  const src = fs.readFileSync(path.join(ROOT, "tools/mutate.js"), "utf8");
  ok(!/--dirty-ok/.test(src), "the --dirty-ok escape is gone");
  ok(/const refusal = dirtyRefusal\(trackedDirty\(\)\);/.test(src),
    "the whole tree is checked before the first mutation");
  ok(/const drift = trackedDirty\(\);/.test(src), "and again after each one");
  ok(/STOPPING: the tree did not go back after/.test(src),
    "with the run stopping rather than carrying a loose fault into the next mutant");
  ok(/if \(NEEDS_BUILD\.test\(m\.file\)\) rebuild\(timeout\);/.test(src),
    "a built artefact is rebuilt from the restored source, so the check can be honest");

  // ---- 4. the two ways a run can report a lie -----------------------------
  console.log("--- 4. a run cannot report green over its own results");
  // A --repeat run matched none of its own results, because summarise() re-read
  // the results FILE through priorResults(), which returns nothing under
  // --repeat. It printed "0 of 10 recorded ... MUTATION RUN PASS" over three
  // mutations that had just survived.
  ok(/const THIS_RUN = \{\};/.test(src), "results are kept as the run makes them");
  ok(/summarise\(list, Object\.assign\(\{\}, priorResults\(\), THIS_RUN\)\);/.test(src),
    "and the summary reads them, not only what was on disk before it started");

  // A mutation in a file the page is BUILT from, with no rebuild, tests the
  // previous fixture: the suite passes and the fault is filed as one nothing
  // notices. The list is therefore checked against build.js's own reads rather
  // than against memory.
  const build = fs.readFileSync(path.join(ROOT, "build.js"), "utf8");
  const readsAtTop = [...build.matchAll(/read\("([^"]+)"\)/g)].map(m => m[1]);
  const inlined = [...build.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  // Only the ones that EXIST. contract-bundle.js and importer-data.js are script
  // tags build.js replaces with generated text; there is no such file to mutate.
  const inputs = [...new Set(readsAtTop.concat(inlined))]
    .filter(f => /\.(js|html)$/.test(f))
    .filter(f => fs.existsSync(path.join(ROOT, f)));
  const NEEDS_BUILD = (() => {
    const m = src.match(/const NEEDS_BUILD = (\/\^.*\$\/);/);
    return m ? eval(m[1]) : null;   // the runner's own literal, not a copy of it
  })();
  ok(!!NEEDS_BUILD, "the runner's build-needed test is readable");
  const missed = inputs.filter(f => NEEDS_BUILD && !NEEDS_BUILD.test(f));
  console.log("    build inputs:", JSON.stringify(inputs));
  ok(missed.length === 0,
    "every file the page is built from forces a rebuild before its mutation is tested: missing " +
    JSON.stringify(missed));
}

fs.rmSync(TMP, { recursive: true, force: true });
fs.rmSync(notARepo, { recursive: true, force: true });

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
