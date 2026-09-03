# Criterion ids

**Generated. Do not edit.** A plan claim states what one end of the essay does to
the other, and the right-hand end has to be an id or it is a display string doing
the job of identity. This is where those ids come from and which ones are still
missing.

## The decision

**No separate criterion registry.** The syllabus graph already represents these:
a point names its own parts in its title, after an authored dash, and each part
becomes a node with an id.

    business.operations.operations-strategies.performance-objectives.quality
    business.operations.operations-strategies.performance-objectives.speed

A right-hand label resolves when it exactly matches, after normalising, either a
sub-node's label or the head of a point's title. Scoped to the question's own
topic first, then to the subject. A label matching two nodes in scope resolves to
neither: an ambiguous id is worse than a missing one.

Nothing is recovered from the `what` prose, and no label is ever matched on
resemblance. An imported author never references identity by a display string.

## What resolves today

    14 of 63 right-hand ends resolve deterministically
    49 do not, across 34 distinct labels

| question | label | resolves to | kind | scope |
| --- | --- | --- | --- | --- |
| `ops-01` | speed | `business.operations.operations-strategies.performance-objectives.speed` | part | topic |
| `ops-01` | cost | `business.operations.operations-strategies.performance-objectives.cost` | part | topic |
| `ops-01` | dependability | `business.operations.operations-strategies.performance-objectives.dependability` | part | topic |
| `ops-01` | cost | `business.operations.operations-strategies.performance-objectives.cost` | part | topic |
| `ops-01` | quality | `business.operations.operations-strategies.performance-objectives.quality` | part | topic |
| `ops-01` | dependability | `business.operations.operations-strategies.performance-objectives.dependability` | part | topic |
| `ops-01` | cost | `business.operations.operations-strategies.performance-objectives.cost` | part | topic |
| `ops-02` | cost leadership | `business.operations.role-of-operations-management.strategic-role-of-operations-management.cost-leadership` | part | topic |
| `mkt-01` | e-marketing | `business.marketing.marketing-strategies.e-marketing` | point | topic |
| `mkt-04` | promotion | `business.marketing.marketing-strategies.promotion` | point | topic |
| `mkt-04` | e-marketing | `business.marketing.marketing-strategies.e-marketing` | point | topic |
| `hr-01` | skills | `business.hr.strategies-in-human-resource-management.global.skills` | part | topic |
| `hr-03` | skills | `business.hr.strategies-in-human-resource-management.global.skills` | part | topic |
| `hr-03` | costs | `business.hr.strategies-in-human-resource-management.global.costs` | part | topic |

## What does not, and why

Every one of these is a real syllabus idea. None of them is in a place the graph
can address yet, because the syllabus point that owns it does not name its parts
in its title. `objectives of financial management` is the clearest case: the five
objectives are the point's parts and the title does not list them.

The fix is authoring sub-nodes under the points that own them, in the existing
graph. It is not a new identifier scheme, and the ids it produces are the ones
already shown in the proposed column.

| label | used | in | why it does not resolve | id it would have |
| --- | --- | --- | --- | --- |
| liquidity | 5 | `fin-01`, `fin-02` | no node in this question's topic carries that label | `business.finance.<point>.liquidity` |
| profitability | 4 | `mkt-02`, `fin-01`, `fin-02` | no node in this question's topic carries that label | `business.marketing.<point>.profitability` |
| satisfaction | 3 | `hr-01`, `hr-03` | no node in this question's topic carries that label | `business.hr.<point>.satisfaction` |
| culture | 2 | `hr-01`, `hr-03` | no node in this question's topic carries that label | `business.hr.<point>.culture` |
| people | 2 | `mkt-01`, `mkt-04` | no node in this question's topic carries that label | `business.marketing.<point>.people` |
| physical evidence | 2 | `mkt-01`, `mkt-04` | no node in this question's topic carries that label | `business.marketing.<point>.physical-evidence` |
| processes | 2 | `mkt-01`, `mkt-04` | no node in this question's topic carries that label | `business.marketing.<point>.processes` |
| productivity | 2 | `hr-01`, `hr-03` | no node in this question's topic carries that label | `business.hr.<point>.productivity` |
| sales | 2 | `mkt-02` | no node in this question's topic carries that label | `business.marketing.<point>.sales` |
| an appropriate workforce | 1 | `hr-03` | no node in this question's topic carries that label | `business.hr.<point>.an-appropriate-workforce` |
| awareness | 1 | `mkt-02` | no node in this question's topic carries that label | `business.marketing.<point>.awareness` |
| community responsibilities | 1 | `ops-03` | no node in this question's topic carries that label | `business.operations.<point>.community-responsibilities` |
| costs | 1 | `ops-02` | no node in this question's topic carries that label | `business.operations.<point>.costs` |
| differentiation | 1 | `ops-02` | no node in this question's topic carries that label | `business.operations.<point>.differentiation` |
| disputation | 1 | `hr-01` | no node in this question's topic carries that label | `business.hr.<point>.disputation` |
| efficiency | 1 | `fin-01` | no node in this question's topic carries that label | `business.finance.<point>.efficiency` |
| employee | 1 | `ops-03` | no node in this question's topic carries that label | `business.operations.<point>.employee` |
| environmental | 1 | `ops-03` | no node in this question's topic carries that label | `business.operations.<point>.environmental` |
| environmental sustainability | 1 | `ops-03` | no node in this question's topic carries that label | `business.operations.<point>.environmental-sustainability` |
| growth | 1 | `fin-01` | no node in this question's topic carries that label | `business.finance.<point>.growth` |
| innovation | 1 | `ops-02` | no node in this question's topic carries that label | `business.operations.<point>.innovation` |
| market expansion | 1 | `mkt-02` | no node in this question's topic carries that label | `business.marketing.<point>.market-expansion` |
| market share | 1 | `mkt-02` | no node in this question's topic carries that label | `business.marketing.<point>.market-share` |
| performance | 1 | `hr-01` | no node in this question's topic carries that label | `business.hr.<point>.performance` |
| place | 1 | `mkt-04` | no node in this question's topic carries that label | `business.marketing.<point>.place` |
| price | 1 | `mkt-04` | no node in this question's topic carries that label | `business.marketing.<point>.price` |
| product | 1 | `mkt-04` | no node in this question's topic carries that label | `business.marketing.<point>.product` |
| restructuring | 1 | `hr-03` | no node in this question's topic carries that label | `business.hr.<point>.restructuring` |
| retention | 1 | `hr-03` | no node in this question's topic carries that label | `business.hr.<point>.retention` |
| social consequences | 1 | `ops-03` | no node in this question's topic carries that label | `business.operations.<point>.social-consequences` |
| social responsibility | 1 | `ops-03` | no node in this question's topic carries that label | `business.operations.<point>.social-responsibility` |
| solvency | 1 | `fin-01` | no node in this question's topic carries that label | `business.finance.<point>.solvency` |
| supply | 1 | `ops-02` | no node in this question's topic carries that label | `business.operations.<point>.supply` |
| turnover | 1 | `hr-01` | no node in this question's topic carries that label | `business.hr.<point>.turnover` |

Until they are authored, `criterionRef` is `null` and counted. A null is the
contract saying it does not know, which is the one thing a display string in that
position could never say.
