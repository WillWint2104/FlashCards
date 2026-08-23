---
title:   mkt-01 evidence map, atomic records per pathway
date:    2026-08-23
status:  proposed
governs: the evidence layer for mkt-01, the first Learn & Build target
applies-on: the content branch after PR #46 merges
case-study: McDonald's
---

The per-pathway half of the split manifest, for the one question being taken to
Learn & Build first. Atomic ids are those proposed in
`2026-08-23-split-manifest.md`. **Nothing is applied and nothing is sourced.**

## Why mkt-01 is the right question to take first

`mkt-01` is *Explain how target markets affect e-marketing, people, processes and
physical evidence.* Under the readiness rule in the manifest addendum:

| command | evidence roles required |
| --- | --- |
| **Explain** | one or more `capability` |
| Analyse | `capability` plus `outcome` or `cost` |
| Assess, Evaluate, To what extent | `capability` plus `outcome` or `cost` |

The bank is 63 per cent `capability`. That is a serious weakness for `mkt-02`,
`mkt-03` and `hr-01`, and it is **not** a weakness for `mkt-01`, because an
Explain question is answered by showing what the business does and why the market
made it do that. So the one question closest to completion is also the one the
current evidence shape can actually support.

That is worth saying plainly: the evidence problem does not block the first
Learn & Build question. It blocks the ones after it.

## The map

Twelve pathways. `needs` lists the atomic records that genuinely support the
argument; anything the current link carries beyond that is dropped.

### e-marketing

| pathway | currently linked | needs | roles | change |
| --- | --- | --- | --- | --- |
| `em-digital` | mkt-12, mkt-08 | mkt-12a, mkt-12b, mkt-08a | capability ×3 | narrow. **12h (data drives targeted offers) is what the lesson leans on and is unsupported** |
| `em-value` | mkt-12, mkt-09 | mkt-12a, mkt-12b, mkt-09a | capability ×3 | narrow. 09b and 09c are unsupported outcome assertions and are dropped |
| `em-convenience` | mkt-12 | mkt-12c, mkt-12d | capability ×2 | narrow |

**Note on `em-value`.** The pathway argues that a price-sensitive market forces a
cheap repeatable channel. `mkt-12b` carries the loyalty scheme's earn rate and
redemption threshold, which is the strongest available support because a stated
threshold is evidence of a mechanism designed for repetition rather than a claim
that customers repeat.

### people

| pathway | currently linked | needs | roles | change |
| --- | --- | --- | --- | --- |
| `pe-service` | mkt-10 | mkt-10e, mkt-10f | capability ×2 | narrow |
| `pe-speed` | mkt-10 | **none in marketing** | — | **repoint to `ops-09c`** (drive-through service times are measured), once operations records are split |
| `pe-consistency` | mkt-11, mkt-10 | mkt-11a, mkt-10e, mkt-10f | capability ×3 | narrow |

**`pe-speed` is the clearest mis-link in the question.** It argues that a market
expecting speed changes staffing and rostering. The marketing record it points at
covers distribution and standardised presentation, neither of which is about
staffing or service time. The claim it needs sits in the operations bank. Until
operations is split, this pathway is better with no evidence than with evidence
that does not support it.

### processes

| pathway | currently linked | needs | roles | change |
| --- | --- | --- | --- | --- |
| `pr-convenience` | mkt-12, mkt-10 | mkt-12c, mkt-10a, mkt-10b, mkt-10c | capability ×4 | narrow |
| `pr-speed` | mkt-12, mkt-10 | mkt-12c, mkt-10b, mkt-10d | capability ×3 | narrow |
| `pr-customisation` | mkt-07, mkt-11, mkt-12 | mkt-12c, mkt-11b, mkt-11c | capability ×3 | narrow; **drop mkt-07**, the segment records do not speak to carrying a variation through a process |

### physical evidence

| pathway | currently linked | needs | roles | change |
| --- | --- | --- | --- | --- |
| `ph-servicescape` | mkt-11, mkt-07 | mkt-10e, mkt-10f | capability ×2 | **repoint.** The pathway is about designed surroundings; standardised uniforms, signage, packaging and layout are the claims that support it, and they sit in mkt-10 rather than mkt-11 |
| `ph-segments` | mkt-07 | mkt-07a, mkt-07b, mkt-07c | capability ×3 | narrow. Note these establish *segments served*, not *space divided* |
| `ph-selfservice` | mkt-12, mkt-10 | mkt-10d, mkt-10e | capability ×2 | narrow |

**Note on `ph-segments`.** The pathway argues that serving several segments leads
to different physical settings for each. The available records establish that
distinct segments are served by distinct sub-brands. They do **not** establish
that the physical space is divided between them. That is a genuine gap, and the
honest position is that this pathway's evidence supports the first half of its
argument and not the second.

## Gaps this map exposes

| gap | pathway affected | needed |
| --- | --- | --- |
| app data used to target offers | `em-digital` | a McDonald's statement linking app data to a promotion decision |
| service times measured | `pe-speed` | split the operations bank; the claim exists there |
| physical space divided by segment | `ph-segments` | evidence about the setting, not the sub-brand |
| entry price points raising customer numbers or spend | `em-value` | currently an unsupported assertion; dropped rather than sourced |

Four gaps, none filled by analogy. Three are answerable from existing material
once split; one (`em-value`'s outcome claim) probably is not, and the pathway
works without it because the question is Explain.

## Verification set for mkt-01

To make `mkt-01` Learn & Build ready, these atomic claims need a source opened.
**Eleven records, not fifty-eight.**

| id | claim | source located |
| --- | --- | --- |
| mkt-12a | the app carries digital vouchers and deals | McDonald's AU |
| mkt-12b | points-based loyalty scheme, stated earn rate and redemption threshold | McDonald's AU, `candidate-primary` |
| mkt-12c | app supports mobile ordering and payment | McDonald's AU, `candidate-primary` |
| mkt-12d | points earned on delivery orders in the app | McDonald's AU, `candidate-primary` |
| mkt-08a | advertising on television, outdoor and social media | corporate |
| mkt-09a | value range, standard menu and premium ranges at distinct price points | McDonald's AU menu |
| mkt-10a | large network of company owned and franchised restaurants | 10-K, AU |
| mkt-10b | drive through lanes | McDonald's AU |
| mkt-10c | delivery through third party platforms | McDonald's AU |
| mkt-10d | self service ordering kiosks | McDonald's AU |
| mkt-10e, 10f | standardised uniforms, signage, packaging, menu boards; consistent layout | corporate |
| mkt-11a, 11b, 11c | core menu standardised; India serves no beef; local additions elsewhere | corporate, market sites |
| mkt-07a, 07b, 07c | Happy Meal with toy for families; McCafé as a distinct range; extended trading | McDonald's AU |

That is the whole verification job for the first Learn & Build question. Every
one is a capability claim on a public McDonald's page, which is the easiest class
to confirm and the class an Explain question needs.
