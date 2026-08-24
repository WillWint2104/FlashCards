---
title:   Evidence split manifest, 58 compound records to atomic claims
date:    2026-08-23
status:  proposed
governs: the migration of business-content.js evidence records
applies-on: the content branch after PR #46 merges
case-study: McDonald's
---

**Nothing in this manifest has been applied.** `business-content.js` and
`evidence-sources.json` are untouched. This is the plan the migration executes,
written so the migration is deterministic rather than a search-and-replace.

## Why split before sourcing

A compound record cannot honestly receive one source when its component claims
have different evidentiary strength. Sourcing first means opening a source,
finding it supports two thirds of a record, rewriting the record, and then
revisiting every pathway that referenced it. Splitting first does that work once.

Sequence: **split → deduplicate → discard → prioritise → verify only what is
worth keeping.** After splitting, the bank probably needs fewer sourced records
than 58, not more, because the same underlying claim appears in several places.

## Identifier scheme

Existing records are keyed by `label` only. The migration assigns stable ids.

```
old record   mcd-mkt-12          (label: "App, loyalty rewards and mobile ordering")
splits into  mcd-mkt-12a, mcd-mkt-12b, mcd-mkt-12c
each new record carries   supersedes: mcd-mkt-12
the old record is retained with   supersededBy: [mcd-mkt-12a, mcd-mkt-12b, mcd-mkt-12c]
                                  usable: false
```

Retaining the old record rather than deleting it is what stops a pathway link
breaking silently. `esEvidenceUsable()` already withholds anything without a
source, so a superseded record is inert without any code change; the migration
adds the mapping so a link that still points at the old id can be resolved.

## Record shape after the split

Three fields kept apart, for the same reason the reference notes separate them:

```
fact:                 what McDonald's actually did or reported
derivedRelationship:  the Business Studies reasoning drawn from that fact
studentUse:           the argument this can support
```

The source attaches to `fact` alone. It never certifies `derivedRelationship`.
Several current records blend the two inside `fact` — `mcd-ops-01` states that
high volume lowers unit cost, which is economics reasoning, not something a
McDonald's source reports — and the split separates them.

## Evidence need classification

| class | meaning | what it can support |
| --- | --- | --- |
| `capability` | something McDonald's does, offers or operates | Explain, Describe, Outline |
| `outcome` | a result, a figure that moved, a stated effect | Assess, Evaluate, To what extent |
| `cost` | a documented cost, trade-off, limitation or risk | Evaluate, Discuss, Analyse |
| `context` | law, regulation, industry norm, or general business fact not specific to McDonald's | frames an argument; cannot carry it |

`context` is the class the current bank hides. A statement like "fast food work is
known for high staff turnover" is not a McDonald's fact and cannot be sourced as
one. It is true, useful, and belongs in the Learn layer or in a reference note,
not in an evidence picker where a student will cite it as a case study fact.

## Sourcing priority

1. `outcome` — decision plus a measurable or reported result
2. `cost` — decision plus documented cost, trade-off or limitation
3. `capability` — implementation facts
4. `context` — mostly relocatable to Learn; source only where a student would
   genuinely cite it, such as a named statute

## Where the bank stands before the split

| topic | records | referenced by a pathway | referenced by none |
| --- | --- | --- | --- |
| operations | 17 | 0 | 17 |
| marketing | 12 | 6 | 6 |
| finance | 13 | 6 | 7 |
| human resources | 16 | 8 | 8 |
| **total** | **58** | **20** | **38** |

Two consequences for sequencing. The 20 referenced records are where a broken
link would actually be felt, so their mapping has to be exact. The 17 operations
records currently support nothing, because `ops-01`, `ops-02` and `ops-03` have
no pathways yet, so they can be split later without risk.

---

# Marketing (12 records → 38 atomic claims)

Highest priority: `mkt-02` asks for effectiveness and `mkt-03` asks to what
extent, and neither is answerable from `capability` claims alone.

### mcd-mkt-01 — Golden Arches global branding
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 01a | The same logo and colour scheme are used across almost all markets | capability | corporate global | role of marketing |
| 01b | Core products such as the Big Mac are sold under the same name in most markets | capability | corporate global | global marketing, standardisation |
| 01c | Product names and recipes change where local tastes or law require | capability | corporate, market sites | duplicate of 11a, **merge** |
| 01d | Brand recognition is achieved without text | cost/derived | — | **move to derivedRelationship**, not a sourceable fact |
| 01e | The offering covers a good and a service | context | — | **move to Learn**, it is a classification not a fact |

**Note.** 01d and 01e are the interesting half and neither is a McDonald's
factual claim. This record shrinks to two sourceable claims plus a merge.

### mcd-mkt-02 — Economic and sociocultural influences on customer choice
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 02a | A value range priced below a full meal is offered | capability | corporate AU menu | pricing, economic influence |
| 02b | Range additions include grilled chicken, fruit, water and milk options | capability | corporate AU menu | sociocultural influence |
| 02c | Plant based burgers were trialled in some markets | capability | corporate | sociocultural influence |
| 02d | Some such items were changed or withdrawn where they did not sell | **outcome** | corporate, financial press | **priority**, mkt-02, mkt-03 |
| 02e | Household budget pressure attracts customers to the value range | derived | — | **move to derivedRelationship** |

**02d is the single most valuable claim in the marketing bank** and it is
currently buried at the end of a compound record. A withdrawn product is an
outcome and a cost at once, and it is the only thing in the marketing bank that
can support "to what extent".

### mcd-mkt-03 — Kilojoule labelling and advertising to children
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 03a | NSW law requires kilojoule display on menus for outlets above a stated threshold | context | NSW Food Authority, Food Act 2003 | government influence |
| 03b | McDonald's displays kilojoule information on NSW menu boards | capability | corporate AU, regulator | government influence |
| 03c | Advertising to children is a long running ethical criticism | context | independent, academic | ethical influence |
| 03d | Happy Meal drink options include water and milk | capability | corporate AU menu | ethical influence |
| 03e | Those options were added in response to criticism | **outcome/cost** | **unsupported** | **gap**, see pilot |

**03e is the claim the current record actually leans on and nothing establishes
it.** Split forces that into the open.

### mcd-mkt-04 — Consumer law and advertising claims
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 04a | The ACL prohibits misleading or deceptive conduct | context | ACCC, Competition and Consumer Act 2010 | consumer law |
| 04b | Consumer guarantees imply conditions into every sale | context | ACCC | consumer law |
| 04c | An advertised price must be honoured | context | ACCC | consumer law |

Entirely `context`. No McDonald's-specific claim survives the split, which is
correct: the record is a statement of law applied to a business, not a fact about
the business. Sourceable from the regulator, and strong precisely because it is.

### mcd-mkt-05 — Big Mac in the maturity stage
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 05a | Core products have been sold for decades | capability | corporate history | product life cycle |
| 05b | Extension strategies used include limited time offers and separate ranges such as McCafé | capability | corporate AU | product life cycle, situational analysis |
| 05c | Those products sit in the maturity stage | derived | — | **move to derivedRelationship**; a classification we make, not one McDonald's reports |

### mcd-mkt-06 — Test restaurants and customer feedback surveys
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 06a | New menu items are trialled in limited restaurants or one region before national launch | capability | corporate | market research |
| 06b | Customer feedback is collected by survey, reached by receipt code or the app | capability | corporate AU | market research |
| 06c | A trial result changed a specific launch decision | **outcome** | **unsupported** | **gap**, Kathmandu pattern 1 |

### mcd-mkt-07 — Segments served by Happy Meal and McCafé
*used by:* mkt01-pr-customisation, mkt01-ph-servicescape, mkt01-ph-segments

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 07a | Happy Meals include a toy or book and are marketed to families with young children | capability | corporate AU | ph-segments, pr-customisation |
| 07b | McCafé is a distinct branded coffee range | capability | corporate AU | ph-segments, ph-servicescape |
| 07c | Extended or 24 hour trading operates at selected restaurants | capability | corporate AU | ph-segments |
| 07d | McDonald's sells to a mass market while segmenting it | derived | — | **move to derivedRelationship** |

Migration: `ph-segments` takes 07a+07b+07c; `ph-servicescape` takes 07b only;
`pr-customisation` takes 07a only. The current single link gives all three
pathways all four claims, which is how a pathway ends up citing something it does
not need.

### mcd-mkt-08 — Promotion mix from advertising to sponsorship
*used by:* mkt01-em-digital

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 08a | Advertising runs on television, outdoor and social media | capability | corporate | promotion |
| 08b | Sales promotions include app-only vouchers and limited time offers | capability | corporate AU | em-digital, em-value |
| 08c | Community and junior sport sponsorship is undertaken | capability | corporate AU | promotion, publicity |
| 08d | A long association exists with Ronald McDonald House Charities | capability | RMHC, corporate AU | publicity, CSR |
| 08e | A rewards scheme operates in the app | capability | corporate AU | duplicate of 12b, **merge** |

Migration: `em-digital` needs 08b only. The other four are for promotion
pathways that do not exist yet.

### mcd-mkt-09 — Price points from value range to McCafé
*used by:* mkt01-em-value

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 09a | A value range, a standard menu and premium ranges are offered at distinct price points | capability | corporate AU menu | em-value, pricing |
| 09b | Low entry price points raise customer numbers | **outcome** | **unsupported** | **gap** |
| 09c | Customers are encouraged to add items so spend per visit rises | **outcome** | **unsupported** | **gap** |

**Two of three claims here are unsupported outcome assertions.** They are also
the two doing the argumentative work. This record is the clearest case in the
bank of a plausible mechanism presented as fact.

### mcd-mkt-10 — Intensive distribution and standardised service
*used by:* mkt01-pe-service, pe-speed, pe-consistency, pr-convenience, pr-speed, ph-selfservice (6)

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 10a | Restaurants operate as a large network of company owned and franchised sites | capability | corporate 10-K, AU | pr-convenience |
| 10b | Drive through lanes operate at most restaurants | capability | corporate AU | pr-speed, pr-convenience |
| 10c | Delivery is offered through third party platforms | capability | corporate AU | pr-convenience |
| 10d | Self service ordering kiosks are installed | capability | corporate AU | ph-selfservice, pr-speed |
| 10e | Crew uniforms, signage, packaging and menu boards are standardised | capability | corporate | pe-consistency, ph-selfservice |
| 10f | Counter, kiosk and drive through layout is consistent between restaurants | capability | corporate | pe-consistency |
| 10g | Consistency signals that service will feel the same everywhere | derived | — | **move to derivedRelationship** |

Six pathways currently share one record containing seven claims. After the split
no pathway carries more than three, and `pe-service` and `pe-speed` turn out to
need claims this record does not contain — they are about crew interaction and
service time, and the honest answer is that they should point at `mcd-ops-09`
(service times measured) once operations records are split.

### mcd-mkt-11 — Standardisation with local customisation
*used by:* mkt01-pe-consistency, mkt01-pr-customisation, mkt01-ph-servicescape

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 11a | The core menu and branding are standardised worldwide | capability | corporate global | pe-consistency |
| 11b | Restaurants in India serve no beef and offer chicken and vegetarian burgers | capability | corporate India | pr-customisation, global marketing |
| 11c | Other markets add locally suited items | capability | corporate market sites | pr-customisation |

Clean split, all three sourceable. `ph-servicescape` does not need any of them
and the link should be dropped rather than migrated.

### mcd-mkt-12 — App, loyalty rewards and mobile ordering
*used by:* mkt01-em-digital, em-value, em-convenience, pr-convenience, pr-speed, pr-customisation, ph-selfservice (7)

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 12a | The app carries digital vouchers and deals | capability | corporate AU | em-digital, em-value |
| 12b | A points-based loyalty scheme operates in the app at a stated earn rate and redemption threshold | capability | corporate AU (`candidate-primary`, pilot) | em-value, em-digital |
| 12c | The app supports mobile ordering and payment | capability | corporate AU (`candidate-primary`, pilot) | em-convenience, pr-convenience, pr-speed |
| 12d | Points can be earned on delivery orders placed in the app | capability | corporate AU (`candidate-primary`, pilot) | em-convenience |
| 12e | The app includes a restaurant locator | capability | **unsupported as worded** | drop unless established |
| 12f | Promotion runs through social media pages | capability | not searched | duplicate of 08a, **merge** |
| 12g | Customers are reached at home through third party delivery platforms | capability | corporate AU | duplicate of 10c, **merge** |
| 12h | The app collects customer data and pushes targeted offers | **outcome/capability** | **unsupported** | **gap**, this is the claim `em-digital` leans on |

Seven pathways currently share this record. 12h is what most of them actually
need and it is the one nothing supports.

---

# Finance (13 records → 34 atomic claims)

Six records are referenced, all by `fin-01`. Finance is the topic where the
strongest primary source exists: the parent company's annual report on Form 10-K
is a filed, dated, audited document, and most of the structural claims here can
be sourced from it.

### mcd-fin-01 — Franchising funds network growth
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 01a | Most restaurants worldwide are operated by franchisees, at a stated percentage and date | capability | 10-K, Restaurants by Market | growth objective |
| 01b | McDonald's typically secures and develops the site and building | capability | 10-K, franchising overview | growth, working capital |
| 01c | The franchisee funds much of the equipment, fit-out and running costs | capability | AU franchising booklet | growth |
| 01d | Franchisees pay ongoing fees plus rent | capability | 10-K | fin-01 revenue structure |
| 01e | The network therefore grows without the company funding every restaurant | derived | — | **move to derivedRelationship** |

The existing record already carries the guard "Do not claim this keeps its
gearing low", which is exactly the kind of instruction that belongs in `limits`
on the atomic record rather than in prose.

### mcd-fin-02 — Finance funds every other function
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 02a | Capital was spent on self-order kiosks, drive-through upgrades and delivery | capability | 10-K capital expenditure discussion | interdependence |
| 02b–02d | finance approves marketing spend / operations capital / HR wages and training | context | — | **move to Learn**; true of every business, not a McDonald's fact |

Almost entirely generic. One sourceable claim survives.

### mcd-fin-03 — Listed parent using retained profits and borrowing
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 03a | McDonald's Corporation is listed and its shares trade on a US exchange | capability | 10-K cover page | sources of finance |
| 03b | The Australian business sits inside that global group | capability | ASIC filings, 10-K | influences |
| 03c | It funds itself mainly from retained profits and borrowing in capital markets | capability | 10-K financing activities | debt vs equity |
| 03d | It returns cash to shareholders as dividends | **outcome** | 10-K, investor relations | **priority**, a reported figure |

03d is one of very few claims in the whole bank that comes with a published
number attached and a document that is filed annually.

### mcd-fin-04 — Australian company under ASIC and company tax
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 04a | ASIC oversees company registration, financial reporting and disclosure under the Corporations Act | context | ASIC | government influence |
| 04b | Australian company tax applies to taxable profits at a stated rate | context | ATO | government influence |
| 04c | The Australian entity is registered as a company under the Corporations Act | capability | ASIC register | government influence |
| 04d | The parent is listed in the United States, not on the ASX | capability | 10-K | corrects a common student error |

### mcd-fin-05 — Interest rates, overseas funds and the economic outlook
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 05a | Both franchisor and franchisee borrow to build, fit out or refurbish | capability | AU franchising booklet | interest rate influence |
| 05b | The group raises funds in overseas capital markets | capability | 10-K debt note | global market influence |
| 05c | Borrowing abroad adds exchange rate risk on repayments | context | — | **move to derivedRelationship** |
| 05d | Value pricing attracts customers trading down in a weak economy | **outcome** | **unsupported** | **gap**; the record already hedges this both ways |

### mcd-fin-06 — Immediate cash sales, almost no customer receivables
*used by:* fin01-cf-liquidity

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 06a | Customers pay at the point of purchase across all order channels | capability | corporate AU | cf-liquidity |
| 06b | Restaurants therefore carry negligible customer receivables | capability | 10-K balance sheet | cf-liquidity |
| 06c | Supplier invoices are paid later on agreed credit terms | capability | 10-K payables, supplier terms | cf-liquidity |
| 06d | The timing gap gives a steady inflow to meet short-term debts | derived | — | **move to derivedRelationship** |

A good record. All three factual claims are independently checkable in the same
document, and the derived step is the one this pathway teaches.

### mcd-fin-07 — Two levels of margin, restaurant and corporation
*used by:* fin01-pm-revenue

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 07a | Corporation revenue comes mainly from franchise fees and rent | **outcome** | 10-K revenue segments | **priority**, pm-revenue |
| 07b | Franchised margins are materially higher than company-operated margins | **outcome** | 10-K segment margins | **priority**, pm-revenue |
| 07c | Restaurant-level margin per item is small | capability | franchising disclosure | pm-revenue |
| 07d | Restaurant profitability depends on volume and cost control | derived | — | **move to derivedRelationship** |

**07a and 07b are the best outcome claims available anywhere in the bank**: both
are reported line items in a filed annual report, both carry figures, and both
support an Evaluate argument directly.

### mcd-fin-08 — Choosing debt or equity for expansion
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 08a | The group funds expansion mainly from retained profits and borrowing rather than new share issues | capability | 10-K financing activities | debt vs equity |
| 08b | A franchisee typically combines own funds with a bank loan or equipment lease | capability | AU franchising booklet | debt vs equity |
| 08c | Interest is tax deductible and principal must be repaid regardless of trading | context | ATO | **move to Learn** |

### mcd-fin-09 — Consolidated global reports and one-off gains
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 09a | Results are reported consolidated for the global group in US dollars | capability | 10-K | limitations of reports |
| 09b | Company-operated restaurants have been sold to franchisees | **outcome** | 10-K, refranchising disclosure | **priority**, limitations of reports |
| 09c | Such sales can create one-off gains affecting reported earnings | context | accounting standards | **move to derivedRelationship** |

### mcd-fin-10 — Audited accounts and disclosure in a listed group
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 10a | Financial statements are prepared under accounting standards and independently audited | capability | 10-K auditor's report | ethical reporting |
| 10b | The Australian company meets Corporations Act reporting and disclosure requirements | capability | ASIC register | ethical reporting |
| 10c | Ethical reporting means honest and complete, not merely legal | context | — | **move to Learn** |

The existing guard "Do not allege any specific wrongdoing" becomes `limits` on
10a and 10b.

### mcd-fin-11 — Standardisation as cost control, marketing as revenue control
*used by:* fin01-pm-cost

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 11a | Equipment and procedures are standardised across restaurants | capability | corporate | pm-cost |
| 11b | Purchasing runs through long-term supplier agreements at volume | capability | corporate supply chain | pm-cost |
| 11c | Revenue controls include value menu deals, app-only offers, McCafé and delivery | capability | corporate AU | pm-revenue |
| 11d | Bulk purchasing cuts cost per unit | derived | — | **move to derivedRelationship** |

### mcd-fin-12 — Property, leasing and working capital
*used by:* fin01-wc-control, fin01-wc-leasing

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 12a | Restaurant sites are secured by buying property or taking long leases | capability | 10-K property note | wc-control |
| 12b | Many sites are sub-leased to franchisees | capability | 10-K | wc-control |
| 12c | Rent from franchisees is a major revenue stream, at a stated figure | **outcome** | 10-K revenue segments | **priority**, wc-control |
| 12d | Leasing rather than buying preserves cash | context | — | **move to derivedRelationship** |

The existing guard about not presenting sale and lease-back as this business's
practice becomes `limits` on 12a. It is a real and unusual instance of the bank
protecting against a plausible-but-wrong inference, and it must survive the split.

### mcd-fin-13 — Exchange rate exposure and hedging
*used by:* fin01-gf-hedging

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 13a | Revenue is earned in many currencies and reported in US dollars | capability | 10-K | gf-hedging |
| 13b | A stronger US dollar reduces the reported value of overseas earnings, by a stated amount in a stated year | **outcome** | 10-K currency impact disclosure | **priority**, gf-hedging |
| 13c | The group uses foreign currency debt and derivative instruments to manage the exposure | capability | 10-K market risk note | gf-hedging |
| 13d | Multinationals in this position use forward contracts and local-currency borrowing | context | — | **move to Learn**; currently written as generic, not as a McDonald's fact |

**13b is the highest-value unclaimed item in the finance bank.** Annual reports
routinely quantify the currency effect on reported results, which turns a
hedging pathway from an explanation into an evaluation.

---

# Human resources (16 records → 44 atomic claims)

Eight records referenced, all by `hr-01`. This topic has the highest proportion
of `context` claims, because much of it describes the fast food industry rather
than McDonald's, and the highest proportion of claims qualified by "the
franchisee sets the detail", which is itself the most valuable thing in the topic.

### mcd-hrm-01 — Franchise model splits HR responsibility
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 01a | Most restaurants are run by franchisees rather than the company | capability | 10-K, AU franchising | role of HRM |
| 01b | The franchisee is the legal employer of crew in that store | **context/capability** | AU franchising booklet, Fair Work | role of HRM, **load-bearing** |
| 01c | Corporate sets operating standards, training systems and brand requirements | capability | AU franchising booklet | role of HRM |

**01b governs almost every other HR record.** It is why appraisal, rewards and
rostering vary between stores, and it should be sourced first because eight other
records depend on it being true.

### mcd-hrm-02 — Outsourcing and use of contractors
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 02a | Cleaning, maintenance, building work and equipment servicing are commonly contracted out | capability | corporate AU | outsourcing |
| 02b | Home delivery runs through third party platforms whose riders are not employees | capability | corporate AU, platform terms | outsourcing, **duplicate of mcd-ops-15b** |
| 02c | Payroll processing and online recruitment can sit with external providers | context | — | **unsupported as a McDonald's claim**, drop or move to Learn |

### mcd-hrm-03 — National Employment Standards and the award set the floor
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 03a | The Fast Food Industry Award covers crew in Australia | context | Fair Work Commission | legal influence |
| 03b | The award sets minimum rates, junior rates, breaks and penalty rates | context | Fair Work Ombudsman | legal influence |
| 03c | The NES set leave and notice of termination entitlements | context | Fair Work Ombudsman | legal influence |
| 03d | Most crew are engaged as casual or part time | capability | **unsupported for McDonald's specifically** | **gap** |

03a–03c are `context` and are among the most reliably sourceable claims in the
entire bank, because the regulator publishes them. 03d is asserted about
McDonald's and nothing checked supports it.

### mcd-hrm-04 — Work health and safety in the restaurant
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 04a | WHS law imposes duties on the employer | context | SafeWork NSW | legal influence |
| 04b | Induction includes compulsory safety training | capability | corporate AU careers | WHS |
| 04c | Protective equipment and slip resistant flooring are provided | capability | **unsupported** | **gap** |
| 04d | Workers compensation covers injured staff | context | icare NSW | legal influence |
| 04e | A kitchen contains hot fryers, wet floors and chemicals | context | — | **move to Learn** |

### mcd-hrm-05 — Technology and changing work patterns
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 05a | Kiosks, app ordering and delivery platforms are in use | capability | corporate AU | duplicate of mcd-mkt-10d/12c, **merge** |
| 05b | Labour has shifted from order taking towards assembly and dispatch | **outcome** | **unsupported** | **gap**, this is what the pathway needs |
| 05c | The workforce is largely casual and part time, much of it students | capability | **unsupported for McDonald's** | **gap** |

### mcd-hrm-06 — Standardised acquisition and development
*used by:* hr01-td-productivity

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 06a | Applications are made online or in store | capability | corporate AU careers | acquisition |
| 06b | Induction and on-the-job training are structured, one station at a time | capability | corporate AU careers | td-productivity |
| 06c | E-learning modules are used | capability | corporate AU careers | td-productivity |
| 06d | Managers are developed through structured programs at Hamburger University | capability | corporate global | td-productivity, td-retention |

Clean record. All four are ordinary published recruitment material and should
source easily.

### mcd-hrm-07 — Maintenance through rostering and grievance handling
*used by:* hr01-jd-flexibility

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 07a | Crew submit availability each roster period | capability | corporate AU careers | jd-flexibility |
| 07b | Rest and meal breaks are set by the award | context | Fair Work | jd-flexibility |
| 07c | Uniforms are provided by the employer | capability | corporate AU | maintenance |
| 07d | An internal grievance procedure exists | capability | **unsupported** | **gap** |
| 07e | Detail varies between stores because the franchisee is the employer | context | see 01b | **keep as `limits` on 07a, 07c, 07d** |

### mcd-hrm-08 — Separation in a young casual workforce
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 08a | Fast food is characterised by high turnover with a young casual workforce | context | ABS, industry research | separation |
| 08b | Most separations are voluntary resignations | context | **unsupported for McDonald's** | **gap** |
| 08c | Dismissal must follow warnings and a fair process to avoid an unfair dismissal claim | context | Fair Work Commission | separation |

Entirely industry-level. No McDonald's claim survives. This record should become
Learn content with 08c sourced from the regulator.

### mcd-hrm-09 — Leadership style on a shift
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 09a | Procedures are set centrally | capability | corporate | leadership style |
| 09b | Shift managers assign stations and give direct instructions | **capability** | **unsupported** | **gap** |
| 09c | Crew trainers coach new staff | capability | corporate AU careers | leadership style |
| 09d | The style is close to autocratic but not purely so | derived | — | **move to derivedRelationship** |
| 09e | Store level leadership sits with the franchisee | context | see 01b | `limits` |

### mcd-hrm-10 — Job design using specific tasks
*used by:* hr01-jd-enrichment

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 10a | Work is divided into narrow tasks at fixed stations with set procedures | capability | corporate | jd-enrichment |
| 10b | Crew are rotated between stations to widen skills | capability | corporate AU careers | jd-enrichment |
| 10c | Specialisation makes a new employee productive quickly and keeps quality consistent | derived | — | **move to derivedRelationship** |
| 10d | Repetition can cause boredom and low motivation | **cost** | academic / industry | **priority**, the only `cost` claim in the HR bank |

**10d is the only documented downside anywhere in the HR records** and it is
currently a clause inside a sentence. It is what makes `jd-enrichment` an
evaluate-capable pathway.

### mcd-hrm-11 — Internal recruitment and promotion pathway
*used by:* hr01-td-retention

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 11a | A promotion path runs crew → crew trainer → shift manager → assistant manager → restaurant manager | capability | corporate AU careers | td-retention |
| 11b | McDonald's publicly states that many restaurant managers began as crew, with a figure | **outcome** | corporate AU careers | **priority**, td-retention |
| 11c | Crew recruitment is external, management usually internal | capability | corporate AU careers | td-retention |

**11b is an outcome claim with a published figure that McDonald's itself
promotes**, which makes it both high value and easy to source. It is the best
candidate in the HR bank.

### mcd-hrm-12 — Performance management against set standards
*used by:* hr01-pf-accountability

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 12a | Every task has a set procedure against which performance can be measured | capability | corporate | pf-accountability |
| 12b | Observation by crew trainers and managers during shifts is the usual method | capability | **unsupported** | **gap** |
| 12c | Results are used developmentally and administratively | derived | — | **move to derivedRelationship** |
| 12d | The appraisal process is set by each franchisee | context | see 01b | `limits` |

### mcd-hrm-13 — Monetary and non monetary rewards
*used by:* hr01-rw-motivation

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 13a | Crew receive an hourly rate set by the award including penalty rates | context | Fair Work | rw-motivation |
| 13b | Discounted or free meals are provided on shift | capability | corporate AU careers | rw-motivation |
| 13c | Nationally recognised training is offered | capability | corporate AU careers | rw-motivation |
| 13d | Crew recognition awards operate | capability | **unsupported** | **gap** |
| 13e | Flexible rostering is offered | capability | duplicate of 07a | **merge** |
| 13f | The exact package is set by each franchisee | context | see 01b | `limits` |

### mcd-hrm-14 — Global staffing with local employees
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 14a | Restaurants in many countries are staffed almost entirely with local employees | capability | corporate global | global HR |
| 14b | Training systems and operating procedures are globally standardised | capability | corporate global | duplicate of 01c, **merge** |
| 14c | A small number of head office and training roles move between countries | capability | **unsupported** | **gap** |

### mcd-hrm-15 — Workplace disputes in fast food
*used by:* hr01-pf-trust — **and this is the only record with `verify: false`**

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 15a | Disputes in fast food typically concern rostering, unpaid overtime, breaks and penalty rates | context | Fair Work, union reporting | pf-trust |
| 15b | Disputes are raised through internal grievance, then union, then tribunal | context | Fair Work | pf-trust |
| 15c | Large scale industrial action is uncommon in the industry | context | industry research | pf-trust |

Entirely `context`. Not one claim is about McDonald's, yet the record is attached
to a McDonald's pathway. This is the clearest instance of the class confusion the
split exists to expose: a student citing it would be citing an industry
generalisation as a case study fact.

### mcd-hrm-16 — Turnover and benchmarking across stores
*used by:* none

| new id | atomic claim | class | source type | supports |
| --- | --- | --- | --- | --- |
| 16a | Fast food is characterised by high turnover | context | ABS, industry research | duplicate of 08a, **merge** |
| 16b | HRM effectiveness is judged on turnover, absenteeism, accidents and satisfaction | context | — | **move to Learn** |
| 16c | Common systems allow service speed, order accuracy and safety incidents to be compared store to store | capability | corporate | effectiveness of HRM |
| 16d | Turnover and absenteeism data are held by each franchisee | context | see 01b | `limits` |

---

# Operations (17 records → 52 atomic claims)

No operations record is referenced by any pathway, because `ops-01`, `ops-02` and
`ops-03` have no pathways yet. Nothing breaks if these are split last. They are
listed at lower resolution, with only the decisions that differ from the pattern
already established above.

| old id | label | atomic split | notes |
| --- | --- | --- | --- |
| mcd-ops-01 | Standardised production system | 01a same specifications, portions and cooking times across markets (capability); 01b some equipment and menu vary by market (capability, **merge with mkt-11c**); 01c high volume lowers unit cost (**derived, move**) | the unit-cost claim is economics, not a McDonald's report |
| mcd-ops-02 | Interdependence at a menu launch | 02a–02d one claim per function (**all context**); 02e if one function is not ready the promotion is wasted (**derived**) | entirely generic. **Move to Learn in full.** No McDonald's claim exists here |
| mcd-ops-03 | A good and a service in one transaction | 03a order channels offered (capability, **merge with mkt-10**); 03b seating and cleaning provided (capability); 03c the meal is a good and the service a service (**context, classification**) | mostly a definition worked through an example |
| mcd-ops-04 | Global menu localisation | 04a core products and system kept the same everywhere (capability, **merge with mkt-11a**); 04b menu changes for local tastes, religious requirements and available ingredients (capability, **merge with mkt-11b/c**); 04c globalisation pushes two ways at once (**derived**) | **fully duplicated by mcd-mkt-11.** Candidate for deletion, not split |
| mcd-ops-05 | Packaging waste, the law and voluntary action | 05a NSW single-use plastics ban, itemised (**context**, NSW EPA, highly sourceable); 05b lightweight plastic bag ban (**context**); 05c food safety and labelling law (**context**); 05d packaging moved to recyclable or fibre based materials (capability); 05e certified fibre sourced for cups and boxes (capability); 05f in-restaurant waste separation (capability); 05g surplus food donated (capability) | the best-structured record in the bank: it already separates legal compliance from voluntary action, which is exactly the ops-03 distinction |
| mcd-ops-06 | Inputs, transformed and transforming | 06a–06e itemised inputs (**all context/classification**) | a worked application of a syllabus framework. **Move to Learn in full** |
| mcd-ops-07 | Volume, variety, variation and visibility | 07a high volume, narrow item count (capability); 07b kiosks and app allow ingredient changes (capability, **merge with mkt-12c**); 07c demand varies around meal-time peaks (capability, **unsupported as stated**); 07d front of house high contact, back of house low (capability) | the four Vs framework applied; 07c needs a source or becomes context |
| mcd-ops-08 | Technology, task design and process layout | 08a assembly-line kitchen layout (capability); 08b narrow repeated task per crew member (capability, **merge with hrm-10a**); 08c kiosks, app and delivery orders (**merge with mkt-10d/12c**); 08d kitchen display screens route orders (capability) | |
| mcd-ops-09 | Outputs, order accuracy and service time | 09a order accuracy checked at handover (capability, **unsupported**); 09b remake or refund is the standard response (capability); 09c drive-through service times are measured (capability, **priority**); 09d app and delivery orders are trackable (capability); 09e consumer guarantees apply under ACL (**context**, merge with mkt-04b) | **09c is what `mkt01-pe-speed` actually needs** and it currently points at a marketing record that does not contain it |
| mcd-ops-10 | Approved suppliers and distribution centres | 10a small group of approved suppliers on long-term contracts (capability); 10b distribution centres deliver on a set schedule (capability); 10c suppliers must meet set product specifications (capability); 10d **the large majority of Australian food inputs come from Australian farmers and suppliers, with a stated proportion** (**outcome**, corporate AU, **priority**); 10e global sourcing applies mainly to non-food inputs (capability) | 10d is a published figure McDonald's Australia promotes; strong and easy |
| mcd-ops-11 | Frozen stock, FIFO and made to order | 11a frozen inputs held between scheduled deliveries (capability); 11b fresh inputs rotated FIFO with set holding times (capability); 11c most items cooked or assembled after the order is placed (capability); 11d finished goods inventory close to zero (**derived**); 11e little prepared food is thrown away (**outcome, unsupported**) | 11e is the claim that would make this evaluate-capable and nothing supports it |
| mcd-ops-12 | Quality control, assurance and improvement | 12a cooking times, temperatures and holding times checked (capability); 12b set standards every restaurant including franchised must follow (capability); 12c compliance checked by audit (capability, **priority**); 12d crew training and customer feedback drive improvement (capability) | 12b/12c are the QA-by-certification shape and connect to the franchise structure |
| mcd-ops-13 | Performance objectives on the restaurant floor | 13a–13f one claim per objective | **all six duplicate claims held elsewhere** (speed→ops-09c, dependability→ops-01a, flexibility→ops-07c, customisation→mkt-12c, quality→ops-12a, cost→ops-01c). **Delete rather than split**; rebuild as a Learn view that assembles the six |
| mcd-ops-14 | Kiosks and the app beside the grill | 14a kiosks, app, delivery integration and kitchen screens are the newer layer (capability, **merge**); 14b grills, fryers, freezers and holding cabinets are established equipment (capability); 14c kiosks and apps are spreading across the industry (**context**); 14d as they spread they stop being an advantage (**derived**) | 14d is the load-bearing derived claim from the technology reference note and must be labelled as ours |
| mcd-ops-15 | Outsourcing, and why franchising is not outsourcing | 15a maintenance, waste removal, cleaning and construction contracted out (capability, **merge with hrm-02a**); 15b delivery through third party platforms (capability, **merge with mkt-10c**); 15c a franchisee is an independent operator running a whole restaurant under licence (**context/capability**, merge with hrm-01b) | the distinction it teaches is valuable; the facts are all held elsewhere |
| mcd-ops-16 | Resistance when kiosks and table service arrived | 16a restaurants refitted and equipment bought (capability, **unsupported**); 16b crew and franchisees retrained into new roles (capability, **unsupported**); 16c table service introduced (capability); 16d staff fast on the old routine can resist (**derived**) | **16a and 16b are cost claims and both are unsupported.** This is the operations equivalent of hrm-10d: the only record aimed at a cost, and it cannot currently carry it |
| mcd-ops-17 | Global scale, menu trials and test kitchens | 17a equipment, packaging and inputs sourced internationally where unavailable locally (capability, merge with ops-10e); 17b volume purchasing spreads fixed costs and gives buying power (**derived**); 17c ideas that work in one country are rolled out to others (capability); 17d several well known menu items began in a single market (capability, **priority**, checkable and memorable); 17e products developed and tested in product development kitchens (capability) | 17d is concrete, verifiable and the kind of fact a student remembers |

---

# What the split found

## Counts

| | records | atomic claims |
| --- | --- | --- |
| operations | 17 | 52 |
| marketing | 12 | 38 |
| finance | 13 | 34 |
| human resources | 16 | 44 |
| **before dedup** | **58** | **168** |

Then the reductions:

| action | approximate count | effect |
| --- | --- | --- |
| **move to `derivedRelationship`** | 31 | not facts; they are our reasoning sitting inside a `fact` field |
| **move to Learn** | 22 | true, generic, and not a McDonald's claim; a student citing them cites nothing |
| **merge as duplicates** | 19 | the same claim held in two or three topics |
| **delete** | 2 records entire | `mcd-ops-13` is six claims all held elsewhere; `mcd-ops-04` duplicates `mcd-mkt-11` |
| **remains to source** | **≈ 96** | of which about 60 are `capability` |

So the bank does not grow from 58 to 168. It converges on roughly 96 atomic
claims, and **only about 25 of those are worth sourcing first**, which is the
point of splitting before verifying.

## Class distribution, and the problem it confirms

| class | count | share |
| --- | --- | --- |
| `capability` | ~60 | 63% |
| `context` | ~24 | 25% |
| `outcome` | ~8 | 8% |
| `cost` | ~4 | 4% |

**Twelve per cent of the bank can support a judgement command word.** The
Kathmandu pattern pass predicted this from the marketing records alone; the full
split confirms it across all four topics. `mkt-02`, `mkt-03`, `hr-01`, `ops-02`
and `ops-03` all use command words that need `outcome` or `cost` evidence, and
between them the bank holds twelve such claims, of which several are currently
unsupported assertions rather than sourced facts.

## Three failure modes the split exposed

**1. Reasoning inside `fact`.** Thirty-one claims are Business Studies inference,
not reports. "High volume lowers the cost of each unit", "the timing gap gives a
steady inflow", "as kiosks spread they stop being an advantage". Every one is
correct and none is sourceable, because no McDonald's document says it. Attaching
a source to the record would present our reasoning as the source's.

**2. Industry generalisations presented as case study facts.** `mcd-hrm-15` is
attached to a live pathway and contains no claim about McDonald's at all. A
student citing it in an answer would be citing the fast food industry as though
it were their case study. `mcd-hrm-08` and `mcd-ops-02` are the same.

**3. The interesting claim is the unsupported one.** This is the pattern that
repeats: `mcd-mkt-09` (cheap entry prices lift customer numbers and spend),
`mcd-mkt-12h` (the app's data drives targeted offers), `mcd-mkt-03e` (Happy Meal
options changed because of criticism), `mcd-ops-11e` (little prepared food is
thrown away), `mcd-ops-16a/b` (the cost of the kiosk rollout). In each case the
capability around it is checkable and the causal or quantified claim is not.

## Migration mapping

The deterministic part. Every currently-live link, and what it becomes.

| old record | pathways using it now | claims those pathways actually need | link changes |
| --- | --- | --- | --- |
| mcd-mkt-07 | mkt01-pr-customisation, ph-servicescape, ph-segments | 07a / 07b / 07a+07b+07c | narrow all three |
| mcd-mkt-08 | mkt01-em-digital | 08b | narrow |
| mcd-mkt-09 | mkt01-em-value | 09a only; 09b and 09c unsupported | narrow, and the pathway loses its outcome claim |
| mcd-mkt-10 | mkt01-pe-service, pe-speed, pe-consistency, pr-convenience, pr-speed, ph-selfservice | 10e+10f / **none, repoint to ops-09c** / 10e+10f / 10a+10b+10c / 10b+10d / 10d+10e | two repoints, four narrowings |
| mcd-mkt-11 | mkt01-pe-consistency, pr-customisation, ph-servicescape | 11a / 11b+11c / **none, drop link** | one link removed |
| mcd-mkt-12 | mkt01-em-digital, em-value, em-convenience, pr-convenience, pr-speed, pr-customisation, ph-selfservice | 12a+12b / 12a+12b / 12c+12d / 12c / 12c / **none, drop** / 12c | one link removed, 12h needed by em-digital and unsupported |
| mcd-fin-06 | fin01-cf-liquidity | 06a+06b+06c | narrow |
| mcd-fin-07 | fin01-pm-revenue | 07a+07b | narrow, both are priority outcome claims |
| mcd-fin-11 | fin01-pm-cost | 11a+11b | narrow |
| mcd-fin-12 | fin01-wc-control, wc-leasing | 12a+12b+12c / 12a | narrow; keep the sale-and-lease-back guard as `limits` |
| mcd-fin-13 | fin01-gf-hedging | 13a+13c, and 13b when sourced | narrow |
| mcd-hrm-06 | hr01-td-productivity | 06b+06c | narrow |
| mcd-hrm-07 | hr01-jd-flexibility | 07a, with 07e as `limits` | narrow |
| mcd-hrm-10 | hr01-jd-enrichment | 10a+10b, and 10d for the cost step | narrow |
| mcd-hrm-11 | hr01-td-retention | 11a+11c, and 11b when sourced | narrow |
| mcd-hrm-12 | hr01-pf-accountability | 12a; 12b unsupported | narrow |
| mcd-hrm-13 | hr01-rw-motivation | 13a+13b+13c | narrow |
| mcd-hrm-15 | hr01-pf-trust | **none are McDonald's claims** | **flag for review before migration** |

Two links are removed, two are repointed, one is flagged, and the rest narrow.
No link breaks, because superseded records are retained with `supersededBy` and
remain unusable rather than absent.

## Verification queue

Only these are worth opening a source for first. Roughly twenty-five items, not
ninety-six.

**Tier 1, outcome claims with a published figure** — every one supports a
judgement command word, and all five finance items sit in one annually filed
document.

| id | claim | source |
| --- | --- | --- |
| fin-07a, 07b | franchise fee and rent revenue; franchised vs company-operated margins | Form 10-K, revenue and segment notes |
| fin-13b | quantified currency effect on reported results | Form 10-K, market risk |
| fin-12c | rent from franchisees as a revenue stream | Form 10-K |
| fin-03d | dividends returned to shareholders | Form 10-K, investor relations |
| fin-09b | refranchising of company-operated restaurants | Form 10-K |
| hrm-11b | proportion of restaurant managers who began as crew | McDonald's AU careers |
| ops-10d | proportion of Australian food inputs sourced domestically | McDonald's AU |
| mkt-02d | items changed or withdrawn where they did not sell | corporate, financial press |

**Tier 2, cost and trade-off claims** — the bank's scarcest class.

| id | claim | source |
| --- | --- | --- |
| hrm-10d | repetition in specialised job design causes boredom and low motivation | academic or industry |
| ops-16a, 16b | refit cost and retraining for the kiosk rollout | corporate, financial press |
| mkt-03e | Happy Meal changes and their cause | currently unsupported |

**Tier 3, structural capability claims other records depend on.**

| id | claim | source |
| --- | --- | --- |
| hrm-01b | the franchisee is the legal employer | AU franchising, Fair Work |
| fin-01a | proportion of restaurants franchised | Form 10-K, Restaurants by Market |
| ops-12b, 12c | set standards all restaurants follow, checked by audit | corporate |
| mkt-12b, 12c | loyalty scheme terms; mobile ordering and payment | McDonald's AU (`candidate-primary` already recorded) |

**Tier 4, regulator `context` claims** — cheap, reliable, and they anchor the
legal and government-influence pathways.

`mkt-04a/b/c` (ACCC), `mkt-03a` (NSW Food Authority), `ops-05a/b/c` (NSW EPA and
food law), `hrm-03a/b/c` (Fair Work), `hrm-04a/d` (SafeWork, icare),
`hrm-08c` (Fair Work).

## Status of every claim in this manifest

`verification: pending` throughout. No `source` and no `checked` value is
proposed for `evidence-sources.json` by this document, because filling those
fields is what makes a record student-visible and no primary source has been
opened. The `candidate-primary` URLs already gathered are recorded in
`2026-08-23-marketing-pilot.md`.

## Order of operations for the migration

1. Apply the split to `business-content.js` on the content branch after #46,
   with `supersedes` and `supersededBy` on both sides.
2. Move the 31 derived claims into `derivedRelationship` and the 22 generic ones
   into the Learn layer.
3. Apply the merges and the two deletions.
4. Rewrite the 20 live pathway links per the migration mapping above.
5. Review `mcd-hrm-15` before it is carried across at all.
6. Only then verify, in queue order, in an environment that can open sources.
---

# Addendum: three destinations, roles, and the removal test

Supersedes the two-way `move to Learn` / `keep` handling used in the tables
above. The tables stay accurate; this section redirects where each item goes.

## The question the evidence drawer answers

> What can I truthfully say McDonald's did, experienced, reported or achieved?

A claim that does not answer that question is not evidence, whatever else it is.
Keeping such claims in the bank makes it look fuller and makes "evidence" mean
less.

## The removal test

For every proposed atomic item:

> Remove the words "McDonald's" from the claim. Is the proposition still
> essentially the same?

If yes, it is not McDonald's evidence. It is either a general relationship or an
industry condition, and it has a different destination.

Worked example, from `mcd-fin-01`:

```
"McDonald's uses franchising, which allows rapid expansion."

fact                  McDonald's uses franchising.          -> Evidence, once sourced
derived relationship  franchising can support expansion.    -> Learn
```

The first fails the removal test in the right direction: without the name, the
claim is empty. The second passes it, which is exactly why it is not evidence.

## Three destinations

| claim type | destination | example |
| --- | --- | --- |
| general concept or causal relationship | **Learn** | finance approval can constrain marketing expenditure |
| industry-level fact or condition | **Industry context** | fast food businesses can experience high employee turnover |
| specific verified McDonald's fact | **McDonald's evidence** | McDonald's reported X result, or adopted Y practice |

Industry context is a new third category, not a second-class evidence tier. It
situates an argument and cannot carry it. It still requires a source, because an
unsourced industry claim is no safer than an unsourced case-study claim; it is
simply presented as what it is.

Revised destinations for the 22 items previously marked "move to Learn":

| destination | approximate count | character |
| --- | --- | --- |
| Learn | 14 | causal relationships and definitions: finance funds other functions, the four Vs, inputs classification, interdependence at a launch, tax deductibility of interest, benchmarking definitions |
| Industry context | 8 | conditions of the fast food or retail industry: turnover norms, typical dispute subjects, dispute escalation practice, thin restaurant margins as an industry characteristic |
| McDonald's evidence | 0 | none of the 22 survives the removal test |

## Role on every atomic item

Every proposed record carries a `role`, replacing the informal "class" column:

```
role: capability   what McDonald's does, offers or operates
role: outcome      a result, a figure that moved, a reported effect
role: cost         a documented cost, trade-off, limitation or risk
role: context      an industry or regulatory condition, sourced, and not a McDonald's claim
```

`role` is stored on the record rather than inferred, so downstream checks can
read it.

## Readiness check for judgement pathways

The marketing audit found a bank that can explain and cannot evaluate. `role`
makes that checkable rather than a matter of opinion.

Proposed rule for the coverage report:

| pathway's question command | evidence roles required |
| --- | --- |
| Explain, Describe, Outline | one or more `capability` |
| Analyse | `capability` plus at least one of `outcome` or `cost` |
| Assess, Evaluate, To what extent | `capability` plus at least one `outcome` **or** `cost` |

A judgement pathway whose evidence is `capability + capability + capability`
counts as **weak**, not as covered. Under the current bank that flags most of
`hr-01` and, once `mkt-02` and `mkt-03` have pathways, most of those too, which
is the correct result: they are weak, and the report should say so rather than
count links.

This is a change to `tools/coverage.js` on the migration branch, not now.

## mcd-hrm-15: remove the link, do not replace it

`mcd-hrm-15` ("Workplace disputes in fast food") is attached to
`hr-01/hr01-pf-trust`. Under the removal test every one of its three claims
passes, which means none is about McDonald's:

- disputes in fast food typically concern rostering, unpaid overtime, breaks and
  penalty rates
- disputes escalate through internal grievance, then union, then tribunal
- large scale industrial action is uncommon in the industry

**Migration action: remove the link now.** `hr01-pf-trust` is left with no
case-study evidence until a genuine McDonald's record exists. It keeps every
other layer, and the picker already withholds unsourced items rather than showing
a warning, so a student sees a pathway with no evidence rather than a pathway
with a false case study.

The three claims move to Industry context if a reliable source is found, and are
dropped if not. An honest gap is better than a false case study, and the record
is not preserved merely because it is currently linked.

## What the bank should feel like

Scarce and trustworthy. Three tightly relevant McDonald's facts on a pathway,
each sourced, each connected to that pathway, at least one carrying an outcome or
a cost, beats eight vague items of which several are business theory.

The architecture the split produces:

```
Learn              teaches the argument
Industry context   situates it
McDonald's evidence proves the case
```
---

# Addendum: what the publication gate does and does not check

Recorded here rather than on the frozen contract branch, because it is a decision
about the evidence content pass rather than about the gate.

The gate in `esEvidenceUsable` now requires **both** `source` and `checked` to be
non-empty once trimmed. What it does not do is check that `checked` is a *date*.
A value of `yes` or `soon` would satisfy it.

That is deliberate and it is the right boundary for a publication gate: its job is
to refuse anything where verification was not recorded, not to adjudicate the
quality of the record. Widening it into format validation would put schema rules
inside a safety check that has to stay small enough to reason about.

**Where the format belongs instead.** If `checked` should be an ISO date, or
should grow into a structured verification record, enforce it in the content
validator during the evidence pass, alongside the other build-time refusals.
`build.js` already refuses to publish on a content fault, which is the natural
home for a rule about the shape of authored data.

So the split stays:

| layer | asks |
| --- | --- |
| `build.js` validator | is this record well formed |
| `esEvidenceUsable` | was verification recorded at all |
| `t15` / `ui33` | does the rule hold, and does the student see the result |

Nothing to do now. This exists so that whoever runs the evidence pass does not
either assume `checked` is validated as a date, or widen the frozen gate to make
it so.
