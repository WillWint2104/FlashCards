// THE DIRECTIVE REGISTRY.
//
// Every command the content recognises, what family it assigns, and what
// support actually exists for it. It exists because the engine answers "which
// family is this?" with `causal` when nothing matches:
//
//   for (const name of Object.keys(fams))
//     if ((fams[name] || []).some(x => cmd === x || cmd.indexOf(x) === 0)) return name;
//   return "causal";
//
// so a question commanded "Compare" is scaffolded as a cause all the way to
// submission, with no error anywhere. Eight commands carry an authored answer
// shape and are in neither family, which is exactly that position.
//
// The registry replaces the fallback with three distinguishable answers:
//
//   UNKNOWN            the content has never heard of this command. An error.
//   KNOWN, UNSUPPORTED it is a real directive and guided writing cannot serve
//                      it yet. The package is valid; family-dependent guidance
//                      is WITHHELD rather than defaulted, and the report says so.
//   KNOWN, SUPPORTED   a family, and the guidance that hangs off it.
//
// Nothing here is authored twice: families come from slots.templates.
// directiveFamilies, answer shapes from answerShapes.commands, and shape
// coverage from the sentence shape library. The notes are the only prose.
const lib = require("./libraries.js");

// Why a known command is unsupported, where the reason is not simply "no
// family". One line each, and no line claims more than is true.
const NOTES = {
  compare: "Comparison needs two subjects held side by side. The causal slots ask for one relationship, so serving them here would scaffold the wrong essay.",
  distinguish: "Same shape as compare: the answer is the difference between two things, not the effect of one on another.",
  identify: "A short-answer directive. The extended-response scaffolding does not apply.",
  list: "A short-answer directive. The extended-response scaffolding does not apply.",
  justify: "Justification is a judgement made after a decision is stated, which is close to the judgement family and is not the same shape.",
  recommend: "Ends in a decision the student makes, which none of the current slot sets asks for.",
  propose: "Ends in a proposal, same reason as recommend.",
  demonstrate: "Asks for a worked showing rather than an argued relationship.",
};

function registry() {
  const { E } = lib.build();
  const fams = ((E.slots || {}).templates || {}).directiveFamilies || {};
  const shapes = (E.shapes || {}).library || [];
  const answerShapes = (E.answerShapes || {}).commands || {};
  const familyOf = cmd => Object.keys(fams).find(f =>
    (fams[f] || []).some(x => cmd === x || cmd.indexOf(x) === 0)) || null;

  const commands = [...new Set(
    Object.keys(fams).reduce((a, f) => a.concat(fams[f] || []), []).concat(Object.keys(answerShapes))
  )].sort();

  const rows = commands.map(cmd => {
    const family = familyOf(cmd);
    const cover = shapes.filter(s => s.family === family).map(s => [s.family, s.role, s.stage].join("."));
    return {
      command: cmd,
      family: family,
      assignsFamily: !!family,
      answerShape: !!answerShapes[cmd],
      // Guided writing needs a family: every slot label, every guidance line and
      // every sentence shape is chosen by it. No family, no guided writing, and
      // the alternative is not a default but withholding.
      supportedInGuidedWriting: !!family,
      sentenceShapeCoverage: [...new Set(cover)].sort(),
      notes: family
        ? (cover.length ? null : "In the " + family + " family, and no sentence shape is authored for that family, so the shape panel is withheld.")
        : (NOTES[cmd] || "In neither directive family. Family-dependent guidance is withheld."),
    };
  });
  const byFamily = {};
  Object.keys(fams).forEach(f => { byFamily[f] = (fams[f] || []).slice().sort(); });
  return {
    schema: "marginal.directive-registry", version: 1,
    counts: {
      known: rows.length,
      supported: rows.filter(r => r.supportedInGuidedWriting).length,
      unsupported: rows.filter(r => !r.supportedInGuidedWriting).length,
      withShapes: rows.filter(r => r.sentenceShapeCoverage.length).length,
    },
    families: byFamily,
    // The one rule the whole file exists to state.
    fallback: "none. A command outside this registry is DIRECTIVE_UNKNOWN and does not import. A command in it with assignsFamily false is valid, and every piece of guidance chosen by family is withheld rather than defaulted to causal.",
    commands: rows,
  };
}
const isKnown = (reg, cmd) => reg.commands.some(r => r.command === String(cmd || "").toLowerCase());
const rowFor = (reg, cmd) => {
  const c = String(cmd || "").toLowerCase();
  return reg.commands.find(r => r.command === c)
    || reg.commands.find(r => c.indexOf(r.command) === 0) || null;
};
module.exports = { registry, isKnown, rowFor };
