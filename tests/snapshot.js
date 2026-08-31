#!/usr/bin/env node
// Run the harness against a COMMIT, not against a filesystem that keeps moving.
//
// The harness and development shared one working tree, so editing during a run
// changed the thing being tested halfway through. That invalidated three runs in
// one session, and the fix was never "sit still for 46 minutes": it was that a
// test of commit abc123 has no business caring what the branch looks like
// twenty minutes later.
//
// So: a detached git worktree at the chosen commit, its own build, its own
// fixtures, its own tests/out. Nothing it reads can be written by anyone else.
//
//   node tests/snapshot.js                 HEAD, everything
//   node tests/snapshot.js --sha abc123    a specific commit
//   node tests/snapshot.js ui39 ui40       HEAD, just these
//   node tests/snapshot.js --keep          leave the worktree for inspection
const { execFileSync, spawnSync } = require("child_process");
const path = require("path"), fs = require("fs"), os = require("os");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const keep = args.includes("--keep");
const shaIdx = args.indexOf("--sha");
const want = shaIdx >= 0 ? args[shaIdx + 1] : "HEAD";
// With no --sha, shaIdx is -1 and shaIdx+1 is 0, which silently swallowed the
// first suite name and ran the whole harness instead of the one asked for.
const shaValueIdx = shaIdx >= 0 ? shaIdx + 1 : -1;
const suites = args.filter((a, i) => !a.startsWith("--") && i !== shaValueIdx);

const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();

// Resolve first, so the result is labelled with what actually ran rather than
// with a moving reference.
let sha, subject;
try {
  sha = git("rev-parse", want);
  subject = git("log", "-1", "--format=%s", sha);
} catch (e) {
  console.error("cannot resolve " + want + ": " + e.message);
  process.exit(2);
}

// A dirty tree means the commit is not what you are about to test. Say so rather
// than testing something the SHA does not describe.
const dirty = git("status", "--porcelain");
if (dirty && want === "HEAD") {
  console.log("NOTE: uncommitted changes are NOT included. This tests " + sha.slice(0, 7) + " as committed:");
  dirty.split("\n").slice(0, 8).forEach(l => console.log("      " + l));
  console.log("");
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "marginal-snap-"));
const started = Date.now();
let code = 1;
try {
  console.log("snapshot " + sha.slice(0, 7) + "  " + subject);
  console.log("worktree " + dir);
  console.log("");
  execFileSync("git", ["worktree", "add", "--detach", dir, sha], { cwd: ROOT, stdio: ["ignore", "ignore", "pipe"] });

  // Everything from here happens inside the snapshot. The build is done once,
  // exactly as a fresh clone would, so the artefact under test is the one the
  // commit produces rather than whatever happened to be lying in tests/out.
  const step = (cmd, a, cwd) => {
    const r = spawnSync(cmd, a, { cwd: cwd, stdio: "inherit" });
    if (r.status !== 0) throw new Error(cmd + " " + a.join(" ") + " exited " + r.status);
  };
  step("node", ["build.js"], dir);
  const r = spawnSync("node", [path.join(dir, "tests", "run.js")].concat(suites),
    { cwd: path.join(dir, "tests"), stdio: "inherit" });
  code = r.status === null ? 1 : r.status;
} catch (e) {
  console.error("\nsnapshot failed to run: " + e.message);
  code = 2;
} finally {
  const mins = ((Date.now() - started) / 60000).toFixed(1);
  console.log("");
  console.log("result for " + sha.slice(0, 7) + " after " + mins + " minutes: " + (code === 0 ? "green" : "NOT green"));
  console.log("this result is authoritative for " + sha.slice(0, 7) + " and for nothing else.");
  if (keep) {
    console.log("worktree kept at " + dir);
  } else {
    try { execFileSync("git", ["worktree", "remove", "--force", dir], { cwd: ROOT, stdio: "ignore" }); } catch (e) { /* best effort */ }
  }
}
process.exit(code);
