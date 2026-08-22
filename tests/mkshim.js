// Pull the REAL worker out of proxy/worker.js and re-export its internals, so the
// suites exercise the shipped code rather than a copy of it.
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "proxy", "worker.js"), "utf8");
const out = src + `
export { default as worker } from './worker.mjs';
export { diagnose, DIAG_SAFE, groundProse, scopeFor, planProse, DIAG_TO_PASS2, echoesPlan, planEcho, answerIndex, spanText, snapSentences, quoteSpan, assertScoreFree, offPathwayCount, deDash, sweepDashes, verifyQuote, quoteWords, normalizeDiagnosis, diagnosisText, pass2Message, PASS2_FIELDS, groundFocus, markingInput, finalize, normalizeReview, markCriteria, diagMessage, DIAG_TOOL, REVIEW_TOOL, SYSTEM, DIAG_SYSTEM };
`;
fs.writeFileSync(path.join(__dirname, "worker.mjs"), out);
console.log("shim written");
