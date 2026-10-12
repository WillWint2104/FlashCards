// WHAT COUNTS AS A MARK, for the Test Mode student bots (tests/ui76.js).
//
// Every corpus expectation about a number is checked here, in one place, so a
// check cannot be satisfied by the absence of a number. Run 1 found the hole
// this closes: three live answers came back "not marked", and two of them still
// passed "at most 2", because a range written as `status !== "marked" || score
// <= max` treats no mark as a mark within range. A run that spends real marking
// credits and reports "ok" for an answer nobody marked is worse than no run.
//
// The rule: an expectation that names a number (exactly, at least, at most, or
// an ordering between two answers) holds only for a VALID mark. Not marked,
// refused, failed, null and undefined satisfy none of them. "Never full marks"
// is the one expectation a missing mark can meet, and only as "never sent":
// an answer that was sent and came back without a mark has not been shown to be
// below full marks, it has not been judged at all.
//
// tests/t40.mjs holds these rules; tools/mutations.js puts the old hole back and
// t40 has to catch it.

// A mark the corpus can be checked against: marked, with a finite score inside
// a finite scale.
function validMark(got) {
  return !!got && got.status === "marked" &&
    typeof got.score === "number" && Number.isFinite(got.score) &&
    typeof got.max === "number" && Number.isFinite(got.max) &&
    got.score >= 0 && got.score <= got.max;
}

// The corpus's `expect.exact`.
function exactly(got, n) {
  return validMark(got) && got.score === n;
}

// The corpus's `live` range: { min }, { max } or both. No valid mark, no pass.
function inRange(got, range) {
  if (!validMark(got)) return false;
  const r = range || {};
  if (r.min != null && got.score < r.min) return false;
  if (r.max != null && got.score > r.max) return false;
  return true;
}

// The corpus's `expect.neverFull`: never sent, or marked below full marks.
function neverFull(got) {
  if (got && got.status === "none") return true;
  return validMark(got) && got.score < got.max;
}

// A `liveOrder` pair: the first answer must not score below the second. Both
// must carry a valid mark; an ordering with a missing side has not been shown.
function ordered(hi, lo) {
  return validMark(hi) && validMark(lo) && hi.score >= lo.score;
}

// How a result reads in a failure message, so "null" is never the whole story.
function describe(got) {
  if (!got) return "no result";
  if (validMark(got)) return got.score + "/" + got.max;
  return (got.status || "no status") + (got.score != null ? " (score " + got.score + ")" : "");
}

module.exports = { validMark, exactly, inRange, neverFull, ordered, describe };
