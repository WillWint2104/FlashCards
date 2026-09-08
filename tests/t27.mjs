// THE COACH CONTRACT, AT THE SEAM WHERE IT IS ENFORCED.
//
// The paragraph review renders from one field, slotFeedback, and every claim it
// makes about a student's sentence rests on that field having been checked back
// against what the app actually sent. This suite is that check, run against the
// SHIPPED worker rather than a copy of it.
//
// The rules, and what each one prevents:
//
//   slot must be one of this paragraph's       a diagnosis about a structural job
//                                              this paragraph does not have
//   blockId must be one the app sent           a diagnosis anchored to nothing
//   a sentence written for one job may not     a diagnosis moved onto the wrong
//     be given another                         sentence, which the student then acts on
//   needs_work must name a sentence            an issue with nowhere to go
//   ok carries no model prose at all           praise in the model's words, on the
//                                              one path nobody is watching
//   missing is DERIVED from slotFeedback       two independent answers to one question
//
// Failing closed here loses a finding. Failing open attaches a real diagnosis to a
// sentence that did not earn it, and the student rewrites the wrong line.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const w = require("./worker.mjs");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL:", m); } };

const SLOTS = ["topic", "explain", "example", "effect", "link"];
const BLOCKS = [
  { id: "b1", slot: "topic", text: "Convenience-oriented customers value speed and low effort." },
  { id: "b2", slot: "explain", text: "Because these customers prefer quick service, the business can simplify ordering." },
  { id: "b3", slot: "", text: "For example, mobile ordering can reduce waiting." },
];
const run = (slotFeedback, extra) =>
  w.normalizeCoaching(Object.assign({ note: "", nudges: [], slotFeedback }, extra || {}), SLOTS, BLOCKS);
const one = sf => run([sf]).slotFeedback;

console.log("--- 1. the sentence list the app sends is bounded and cleaned");
{
  const s = w.sanitizeBlocks([
    { id: "b1", slot: "topic", text: "fine" },
    { id: "b1", slot: "explain", text: "a duplicate id" },
    { id: "", slot: "topic", text: "no id" },
    { id: "b2", slot: "not a key!", text: "a slot that is not an identifier" },
    { id: "b3", slot: "explain", text: "   " },
  ]);
  console.log("   ", JSON.stringify(s));
  ok(s.length === 2, "duplicates, empty ids and empty text are dropped: " + s.length);
  ok(s[1].slot === "", "a slot that is not a simple key is cleared rather than passed on");
  ok(w.sanitizeBlocks("not an array") === null, "a non-array is refused outright");
  ok(w.sanitizeBlocks([]) === null, "and so is an empty one, so the caller can tell");
  const many = w.sanitizeBlocks(Array.from({ length: 90 }, (_, i) => ({ id: "b" + i, text: "x" })));
  ok(many.length === 40, "the list is capped: " + many.length);
}

console.log("--- 2. a result is kept only when everything about it checks out");
{
  const good = one({ slot: "explain", status: "needs_work", blockId: "b2",
    issue: "You identify the change but do not explain why the characteristic causes it." });
  ok(good.length === 1 && good[0].slot === "explain" && good[0].blockId === "b2",
    "a valid result survives: " + JSON.stringify(good));
  ok(one({ slot: "judgement", status: "needs_work", blockId: "b2", issue: "x y" }).length === 0,
    "a slot this paragraph does not have is dropped");
  ok(one({ slot: "explain", status: "needs_work", blockId: "b-nope", issue: "x y" }).length === 0,
    "an id the app never sent is dropped");
  ok(one({ slot: "effect", status: "needs_work", blockId: "b2", issue: "x y" }).length === 0,
    "a slot that disagrees with the sentence it names is dropped");
  ok(one({ slot: "explain", status: "needs_work", blockId: "", issue: "x y" }).length === 0,
    "needs_work with no sentence is dropped");
  ok(one({ slot: "link", status: "missing", blockId: "", issue: "Nothing links back to the question." }).length === 1,
    "but missing with no sentence is legitimate and is kept");
  ok(one({ slot: "explain", status: "wonderful", blockId: "b2", issue: "x y" }).length === 0,
    "a status outside the three is dropped");
  ok(one({ slot: "example", status: "needs_work", blockId: "b3", issue: "x y" }).length === 1,
    "a sentence carrying no job of its own can still be named, because the id is verified");
  const longIssue = Array.from({ length: 40 }, () => "word").join(" ");
  ok(one({ slot: "explain", status: "needs_work", blockId: "b2", issue: longIssue }).length === 0,
    "a diagnosis long enough to be a rewrite is dropped");
  const dupes = run([
    { slot: "explain", status: "needs_work", blockId: "b2", issue: "the first one" },
    { slot: "explain", status: "ok", blockId: "b2", issue: "" },
  ]).slotFeedback;
  ok(dupes.length === 1 && dupes[0].issue === "the first one", "one result per slot, the first one wins");
}

console.log("--- 3. an approved slot carries no model prose");
{
  const okRow = one({ slot: "topic", status: "ok", blockId: "b1",
    issue: "This sentence clearly states the paragraph's argument and reads well." });
  ok(okRow.length === 1, "the result is kept");
  ok(okRow[0].issue === "", "and every word the model wrote about it is discarded: " + JSON.stringify(okRow[0].issue));
  ok(!("fix" in okRow[0]), "there is no frame field for it to arrive through either");
  const json = JSON.stringify(okRow);
  ok(json.indexOf("reads well") < 0, "nothing of it survives anywhere in the result: " + json);
}

console.log("--- 4. the compatibility fields are derived, not answered twice");
{
  const r = run([
    { slot: "link", status: "missing", blockId: "", issue: "Nothing links back." },
    { slot: "effect", status: "missing", blockId: "", issue: "No effect is stated." },
    { slot: "topic", status: "ok", blockId: "b1", issue: "" },
  ], { missing: [{ slot: "topic" }] });
  console.log("   ", JSON.stringify(r.missing));
  ok(r.missing.length === 2, "missing has one entry per missing slot: " + r.missing.length);
  ok(r.missing.every(m => m.slot === "link" || m.slot === "effect"),
    "taken from slotFeedback and not from the model's own missing list");
  ok(!r.missing.some(m => m.slot === "topic"),
    "so a model that contradicts itself cannot have it both ways");
  // An older worker output, with no slotFeedback at all, must still parse.
  const legacy = w.normalizeCoaching({ note: "a note", nudges: [], missing: [{ slot: "effect" }] }, SLOTS, BLOCKS);
  ok(legacy.slotFeedback.length === 0, "no slotFeedback means none is invented");
  ok(legacy.missing.length === 1 && legacy.missing[0].slot === "effect",
    "and the model's own missing list is used, so nothing that reads it today changes");
}

console.log("--- 5. the tool the model is given is built from this request");
{
  const tool = w.coachTool(SLOTS, ["b1", "b2"]);
  const props = tool.input_schema.properties.slotFeedback.items.properties;
  ok(JSON.stringify(props.slot.enum) === JSON.stringify(SLOTS),
    "the slot enum is this paragraph's keys: " + JSON.stringify(props.slot.enum));
  ok(props.blockId.enum && props.blockId.enum.indexOf("b1") >= 0 && props.blockId.enum.indexOf("") >= 0,
    "the id enum is the sentences sent, plus empty for a missing element");
  ok(!props.fix, "there is no fix field: the app owns every scaffold the student sees");
  ok(tool.input_schema.required.indexOf("slotFeedback") >= 0, "and a result is required, not optional");
  const noBlocks = w.coachTool(SLOTS, []);
  ok(!noBlocks.input_schema.properties.slotFeedback.items.properties.blockId.enum,
    "a request with no sentence list offers no ids to choose from");
}

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
