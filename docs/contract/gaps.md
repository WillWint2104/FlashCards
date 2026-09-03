# What is missing, and what kind of missing it is

Two different lists, kept apart because they are fixed by different people doing
different work. A content gap is authoring against an architecture that already
handles it. An architecture gap is something the application cannot do yet, and
no amount of authoring closes it.

Neither list is filled in this branch. `mkt-01` reaching some capabilities and
not others is the evidence that the format can represent an honestly incomplete
question, and making the dashboard green would destroy that evidence.

## Content gaps

The contract already expresses all of these. Every one is somebody writing
something.

| gap | size | what closes it |
| --- | --- | --- |
| criterion ids | 49 of 63 right-hand ends | sub-nodes authored under the syllabus point that owns them. `criterion-mapping.md` lists the id each would have |
| evidence roles | 25 references | an author saying what each item does in that response. Never inferred from topic, label or neighbours |
| evidence sources | 58 of 58 records | a checkable source per record. No question can reach `evidence-complete` until then, and the requirement is not weakened to make the top state reachable |
| vocabulary display | 14 of 14 records | a plain meaning and an example. They teach on the Learn surface today and the vocabulary panel will not offer them |
| pathway lessons | 24 of 28 pathways | learning review, which may conclude `none-required`. That is an authored decision and is not the same as nobody having looked |
| concept explanations | 6 concepts | named by an interface and explained nowhere |
| plan claims | 12 lines | they state no right-hand end because they are section names rather than relationship claims. Rewriting, not a new field |
| study resources | 0 records | nothing is authored, so the Learn button's resource list is empty on every question |

One more, which is content in the wrong place rather than content missing. The
`human_resources` syllabus section **effectiveness of human resource management**
holds seven points, and six of them are course administration: indicative hours
twice, the prerequisite, two assessment weighting lines and the examination
specifications. Each has an authored `what` and `why`, so somebody wrote them
deliberately; they are filed as syllabus content and render on the study panel
beside the actual indicators. Found by building the syllabus graph, and left
alone: moving content is not this branch's work.

## Architecture gaps

No authoring closes these. Each is a thing Marginal cannot do.

| gap | what it costs today | where it is answered |
| --- | --- | --- |
| no judgement sentence shapes | every Evaluate, Assess, Discuss, To what extent and Critically question resolves no shape, and the panel is withheld | authoring six shapes for the judgement family, in the engine's library rather than in a package |
| 8 directives assign no family | Compare, distinguish, identify, list, justify, recommend, propose and demonstrate get no guided writing at all. They are valid and importable, and the report says the support is missing | either slot sets for those shapes of answer, or a decision that Marginal does not serve them |
| the runtime reads `essay-content.js` | a package cannot reach a student, however valid it is | migration stage 2: the loader |
| the four prose joins live in the engine | bundled content can still reach a student through a route no imported package may use, so two kinds of question behave differently for reasons nobody can see | migration stage 3 |
| the concept surface renders `concept.terms` | the fourteen migrated vocabulary records are not yet what the Learn surface reads, so there are two code paths to one library | migration stage 3 |
| no importer | nothing can be published | migration stage 4, and a separate pull request |
| Ancient History has no syllabus library | its six questions can carry a `topicLabel` and never a `topicRef`, so no study content, no syllabus refs and no criterion ids | a syllabus graph for the subject, which is a content project rather than a field |

## The one that is both

`assessment-complete` requires `marking.bandSource`, and band descriptors may
only appear with a source. Ten of the nineteen questions carry
`"general HSC band expectations"` and no descriptors, which is honest and is also
the reason nothing can show a student a band table. Closing it needs a source
somebody is entitled to quote, which is a permissions question before it is
either a content or an architecture one.
