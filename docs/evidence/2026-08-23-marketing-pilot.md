---
title:   McDonald's evidence pilot, marketing
date:    2026-08-23
status:  active
governs: business_studies marketing evidence records
case-study: McDonald's
verification-ceiling: candidate-primary (direct page fetch blocked this session)
---

Pilot run of the record format in `README.md` against the marketing half of the
bank. **Nothing here has been written into `evidence-sources.json`**, so no
record has been made student-visible.

The pilot is here to test the pipeline before the remaining concept notes are
written. It found two structural problems, both worth fixing before bulk
sourcing.

---

## Finding 1: the bank records are compound and cannot be sourced as units

Every marketing record bundles several claims. Worked example, the record as it
currently stands:

> **App, loyalty rewards and mobile ordering** — "McDonald's runs e-marketing
> through its mobile app, which carries digital vouchers, a loyalty rewards
> scheme, mobile ordering and payment, and a restaurant locator. It also promotes
> through social media pages and reaches customers at home through third party
> delivery platforms."

That is six assertions with six different evidentiary positions:

| # | claim | status |
| --- | --- | --- |
| 1.1 | the app carries deals or vouchers | `candidate-primary` |
| 1.2 | the app carries a points-based loyalty scheme | `candidate-primary`, with rate and threshold available |
| 1.3 | the app supports mobile ordering and payment | `candidate-primary` |
| 1.4 | the app includes a restaurant locator | `unsupported` as worded |
| 1.5 | McDonald's promotes through social media pages | `unsupported` in this pass |
| 1.6 | it reaches customers at home through *third party* delivery platforms | `split-required` — delivery is supported, the *third party* characterisation is not |

Under the project's own rule the record cannot be sourced as it stands, because
sourcing it would put 1.4, 1.5 and 1.6 in front of a student on the strength of
1.1 to 1.3.

### Proposed replacement records

```
claim               The MyMacca's app awards 100 points per dollar on eligible
                    purchases, and rewards can be redeemed from 3000 points.
source              McDonald's Australia, MyMacca's Rewards help centre
source title        Earning Points with MyMacca's Rewards / MyMacca's Rewards
source url          https://mcdonalds.com.au/mymaccas-rewards
date checked        not yet confirmed
verification        candidate-primary
business area       marketing
syllabus concepts   e-marketing; relationship marketing; customer loyalty
pathways supported  mkt01-em-digital; mkt01-em-value
SOURCE FACT         A loyalty scheme exists inside the app, with a stated earn rate
                    and a stated redemption threshold.
DERIVED RELATIONSHIP  A points threshold high enough to require repeat visits
                    converts a single purchase into a reason to return, which is
                    how e-marketing acts on customer retention rather than on
                    acquisition.
STUDENT USE         Explain: e-marketing as a retention strategy, with the earn
                    rate as the mechanism. Analyse: why the threshold is set where
                    it is.
limits              Establishes the scheme's existence and terms only. It does not
                    establish uptake, effect on sales, or that the data collected
                    is used for research.
```

```
claim               The MyMacca's app supports mobile ordering and payment, and
                    points can be earned on delivery orders placed through it.
source              McDonald's Australia, mobile ordering FAQs
source title        MyMacca's mobile ordering FAQs
source url          https://mcdonalds.com.au/mobile-ordering-faqs
date checked        not yet confirmed
verification        candidate-primary
business area       marketing
syllabus concepts   e-marketing; processes; place and distribution
pathways supported  mkt01-em-convenience; mkt01-pr-convenience
SOURCE FACT         Ordering and payment happen in the app; delivery orders placed
                    in the app earn loyalty points.
DERIVED RELATIONSHIP  When the transaction moves into the app, the app becomes the
                    process the customer experiences, so an e-marketing decision
                    and a processes decision are the same decision.
STUDENT USE         Explain: how a target market that expects to self-serve pulls
                    e-marketing and processes in the same direction.
limits              Says nothing about proportion of orders placed this way, and
                    nothing about the effect on speed or cost.
```

Claims 1.4, 1.5 and 1.6 are dropped rather than carried, and recorded below as
gaps.

---

## Finding 2: the bank has capabilities and almost no outcomes

The Kathmandu pattern pass predicted this and the pilot confirms it. Every
marketing record states something McDonald's *does*. None states a result, a
figure that moved, or a cost.

That is a bank shaped for **Explain**. Two of the four marketing questions ask
for more:

- `mkt-02` — assess the effectiveness of marketing strategies in achieving
  marketing objectives
- `mkt-03` — to what extent do influences on marketing determine business success

Neither can be answered from capability statements. This is the single most
important thing to fix, and it changes what to look for while sourcing: prefer
records where an outcome is published, even if the capability is less
interesting.

---

## Records worked in this pass

### Kilojoule labelling, split from a compound record

The existing record *Kilojoule labelling and advertising to children* bundles a
legal obligation with an ethical criticism and a voluntary response. Three
different claims, three different sources, and the second and third are much
harder to establish than the first.

```
claim               NSW law requires standard food outlets with 20 or more
                    locations in NSW, or 50 or more nationally, to display the
                    average kilojoule content of each standard food item on menus,
                    together with the statement that the average adult daily energy
                    intake is 8700 kJ.
source              NSW Food Authority, Fast Choices menu labelling scheme; Food
                    Act 2003 (NSW) and the Food Standards Code
source title        Fast Choices program: nutritional information menu labelling
source url          https://www.foodauthority.nsw.gov.au/retail/cafes-restaurants-and-retail-outlets/kJs-on-menus
date checked        not yet confirmed
verification        candidate-primary
business area       marketing
syllabus concepts   government influence on marketing; legal compliance
pathways supported  influences on marketing, government and legal
SOURCE FACT         The obligation, the threshold that triggers it, and the exact
                    wording of the required reference statement.
DERIVED RELATIONSHIP  The threshold is what makes this a scale-dependent influence:
                    it binds large chains and not small operators, so compliance
                    cost falls on the businesses best able to absorb it while
                    removing a presentational freedom they previously had.
STUDENT USE         Explain: a government influence changing a marketing decision,
                    with the threshold as the reason it applies to this business.
limits              Establishes the law and that it applies to businesses of this
                    size. It does not by itself establish McDonald's compliance;
                    that needs its own record.
```

**Claim: McDonald's complies.** `candidate-secondary` only. A trade publication
reports a McDonald's spokesperson saying the company made changes to its menu
boards in consultation with the NSW Food Authority. That is a reported statement
in a secondary outlet, not a McDonald's publication, and it is undated in what
was retrieved. Recorded, not sourced.

**Claim: advertising to children and the Happy Meal response.** Partly
supported and partly not. Current Happy Meal drink options published by
McDonald's Australia include water and flavoured milk alongside juice, which is
`candidate-primary` from the Happy Meal menu page. The claim the existing record
actually makes is a *change over time in response to criticism*, and nothing
retrieved establishes the change or the causal link. This is the clearest
instance in the pilot of a record whose interesting half is the unverified half.

```
claim               McDonald's Australia Happy Meals offer water and flavoured milk
                    as drink choices alongside juice.
source              McDonald's Australia, Happy Meal menu
source title        Happy Meal | McDonald's Australia
source url          https://mcdonalds.com.au/menu/happy-meal
date checked        not yet confirmed
verification        candidate-primary
business area       marketing
syllabus concepts   ethical influences on marketing; product; target markets
pathways supported  influences on marketing, ethical
SOURCE FACT         The current drink options offered with a Happy Meal.
DERIVED RELATIONSHIP  Offering a non-sugar option inside a children's product is a
                    change to the product itself rather than to the promotion,
                    which is what distinguishes a substantive ethical response
                    from a presentational one.
STUDENT USE         Explain: an ethical influence acting on the product element.
limits              A current-state fact. It does not establish that the options
                    were added, when, or that criticism caused it. Any answer
                    arguing McDonald's responded to pressure needs a further source.
```

### Scale figures, useful across three topics

```
claim               At year-end 2024 McDonald's had 43,477 restaurants systemwide,
                    approximately 95 per cent of them franchised.
source              McDonald's Corporation annual report on Form 10-K for the year
                    ended 31 December 2024; and Restaurants by Market 2024
source title        mcd-20241231 (Form 10-K); Restaurants by Market 2024
source url          https://corporate.mcdonalds.com/content/dam/sites/corp/nfl/pdf/Restaurants%20by%20Market%202024.pdf
date checked        not yet confirmed
verification        candidate-primary
business area       finance; operations; marketing
syllabus concepts   franchising; global business; economies of scale; standardisation
pathways supported  role of marketing (global branding); role of financial
                    management (franchising funds growth)
SOURCE FACT         Restaurant count and franchised proportion at a stated date,
                    from company reporting.
DERIVED RELATIONSHIP  A 95 per cent franchised network means most restaurant
                    operating cost and most employment sit outside the corporation,
                    which is why the same business can pursue global scale and
                    still be described as locally operated.
STUDENT USE         Analyse: how ownership structure changes what a business's
                    financial and human resource functions actually manage.
limits              A point-in-time figure that moves annually, so it carries
                    verify: true. It says nothing about profitability or about
                    Australian operations specifically.
```

The same search surfaced an Australia-specific franchised proportion in the same
company document. Worth a separate record when sourced, because an
Australia-specific figure is more useful to an HSC student than a global one.

---

## Gaps recorded, not filled

| gap | what is needed |
| --- | --- |
| any McDonald's marketing **outcome** | a published objective and a published result for a named campaign or strategy |
| any McDonald's marketing **weakness** | a documented decline, withdrawn product, or disclosed risk from company reporting |
| app data used for **market research** | a McDonald's statement linking app or trial data to a menu or range decision |
| a delivery or channel change with a **stated external cause** | company material tying the change to an event, with an outcome |
| social media promotion | not searched in this pass |
| restaurant locator in the app | not established as worded; may simply be true and unretrieved |
| McDonald's compliance with kilojoule display | a McDonald's or regulator publication, not a trade report of a spokesperson |
| Happy Meal changes over time and their cause | material establishing the change, not the current state |

Nothing above has been filled by analogy from the Kathmandu chapter or from
general knowledge of large businesses.

---

## What the pilot says about the pipeline

1. **The format works.** Splitting into one claim per record and separating
   SOURCE FACT from DERIVED RELATIONSHIP immediately exposed which half of each
   record was carrying the weight, and in two cases the interesting half was the
   unverified one.

2. **The bank needs restructuring before bulk sourcing, not after.** Sourcing 58
   compound records produces 58 items that each cannot be attached at full
   strength. Splitting first is cheaper.

3. **Verification is currently capped below the level that can flip a record
   live.** Search locates sources; it does not open them. Recording a `checked`
   date on that basis would assert a confirmation that did not happen, which is
   the exact failure `EVIDENCE-SOURCES.md` exists to prevent. So the pipeline
   stops one step short, deliberately, and the stored URLs make the last step
   cheap for whoever has access.

4. **Prefer outcomes over capabilities when choosing what to source next**, since
   two of the four marketing questions cannot be answered without them.
