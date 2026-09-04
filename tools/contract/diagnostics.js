// FINDINGS, GROUPED FOR A PERSON.
//
// The validator's job is to be exact: one finding per rule broken, each with a
// code and a path. That is the right output for a machine and the wrong first
// thing to show a teacher, who is looking at 32 findings and needs to know what
// KIND of work they are, not which check produced each one.
//
// So the grouping lives here, in one place, and not in the importer. Two
// reasons. A group is part of what a finding MEANS, and a copy of that meaning
// living in a UI is a second definition that drifts. And a group that exists
// only in a UI cannot be tested against the validator, which is exactly the
// test that matters: EVERY error code the validator can emit belongs to exactly
// one group, so a new code cannot quietly stop being shown.
//
// This changes no verdict, no severity and no count. It sorts.
const GROUPS = [
  { id: "legacy", title: "Written against an older shape",
    says: "These fields were replaced. Each one still works inside Marginal today and cannot be " +
      "expressed in a package, which is why the contract names them.",
    test: c => /^LEGACY_/.test(c) },

  { id: "value", title: "A value outside what the contract allows",
    says: "Each names a list. Nothing is guessed at or mapped to a nearest match.",
    codes: ["DIRECTIVE_UNKNOWN", "VALUE_OUT_OF_RANGE", "VOCAB_ROLE_UNKNOWN", "MECHANISM_STATUS_UNKNOWN",
      "LEARNING_STATUS_UNKNOWN", "EVIDENCE_ROLE_UNKNOWN", "FIELD_VALUE", "FIELD_TYPE", "ENUM_UNDEFINED",
      "CONTRACT_VERSION_MALFORMED", "CONTRACT_VERSION_UNSUPPORTED", "FORMAT_UNKNOWN",
      "PACKAGE_NOT_AN_OBJECT", "PACKAGE_NOT_JSON"] },

  { id: "ids", title: "IDs and internal references",
    says: "All inside the file. Nothing here needed anything from Marginal to check.",
    codes: ["ID_MALFORMED", "ID_DUPLICATE_IN_PACKAGE", "AREA_REF_UNKNOWN", "PATHWAY_REF_UNKNOWN",
      "VOCAB_REF_UNKNOWN", "CONCEPT_REF_UNKNOWN", "LESSON_REF_UNKNOWN", "EVIDENCE_REF_UNKNOWN",
      "SYLLABUS_REF_UNKNOWN", "RESOURCE_REF_UNKNOWN", "CRITERION_REF_UNKNOWN", "SHAPE_REF_UNKNOWN",
      // The fallback validate.js uses for a library with no named pair. It is
      // reachable, so it is grouped, even though no library uses it today.
      "REF_UNKNOWN", "LESSON_REF_MISSING"] },

  { id: "content", title: "Required content rules",
    says: "Each of these protects something a student sees, and none of them has an exception.",
    codes: ["BANDS_WITHOUT_SOURCE", "VOCAB_REF_NOT_AN_ID", "HIGHLIGHT_ANCHOR_ABSENT", "FIELD_MISSING",
      "SECOND_VOCABULARY_AUTHORITY", "WOULD_NOT_PRESERVE_DOCUMENT",
      "VOCAB_RECORD_PARTIAL", "CONCEPT_RECORD_PARTIAL", "LESSON_RECORD_PARTIAL",
      "EVIDENCE_RECORD_PARTIAL", "SYLLABUS_RECORD_PARTIAL", "RESOURCE_RECORD_PARTIAL",
      "CRITERION_RECORD_PARTIAL", "SHAPE_RECORD_PARTIAL", "RECORD_PARTIAL"] },

  { id: "self", title: "The package disagrees with itself",
    says: "Two places in the file say different things: its requires list against what it actually " +
      "references, and single fields given twice in two shapes.",
    codes: ["REQUIRES_MISMATCH", "FIELD_CONFLICT", "PROVIDES_CONFLICT"] },
];

function groupOf(code) {
  for (let i = 0; i < GROUPS.length; i++) {
    const g = GROUPS[i];
    if (g.test ? g.test(code) : g.codes.indexOf(code) >= 0) return g;
  }
  return null;
}

// Errors only. blocked, shortfall and warning are separate kinds with their own
// consequence, and folding them in here would be the aggregation every screen in
// the importer is written to avoid.
function groupErrors(findings) {
  const errs = (findings || []).filter(f => f.severity === "error");
  const out = GROUPS.map(g => ({ id: g.id, title: g.title, says: g.says, findings: [] }));
  const ungrouped = [];
  errs.forEach(f => {
    const g = groupOf(f.code);
    if (!g) { ungrouped.push(f); return; }
    out[GROUPS.findIndex(x => x.id === g.id)].findings.push(f);
  });
  // An ungrouped code is a bug in this file, not a reason to hide the finding.
  // It gets a group of its own and says so, so the count on the screen is still
  // the count the validator gave.
  if (ungrouped.length)
    out.push({ id: "ungrouped", title: "Other rules", findings: ungrouped,
      says: "These do not yet have a plain description. They are listed with their codes so nothing " +
        "is hidden while that is fixed." });
  return out.filter(g => g.findings.length);
}

module.exports = { GROUPS, groupOf, groupErrors };
