# English Coach evaluation set

**Version:** 0.1  
**Date:** October 11, 2026  
**Status:** Draft reference expectations; no model run or human linguistic sign-off yet.  
**Proposed owner:** Bulma  
**Proposed learning reviewer:** Dilan; obtain additional linguistic review for uncertain judgments.

This set tests the built-in English Coach profile in [CARD_SPEC.md](CARD_SPEC.md). It supplies input and expected behavior, not complete generated cards or approved ground truth. All input sentences below are synthetic examples created for the project. Expected wording may vary; a model must preserve the intended sense and learning requirements.

## Five-item prototype batch

Use these exact inputs for the first integrated demonstration:

```text
akward (context: I felt awkward asking for help.)
draining (context: Back-to-back meetings can be draining.)
went (context: I went to the office yesterday.)
put off (context: Let's not put off this conversation.)
fuel (context: These rumors fuel the argument.)
```

| ID | Expected target and sense | Expected forms/category | Learning checks and unacceptable outcomes |
|---|---|---|---|
| P01 | Correct `akward` to `awkward`; uncomfortable or uneasy in the supplied social situation | Adjective; omit irregular forms | Show correction in review, preserve original input, use corrected spelling on the card. Spanish can express feeling uncomfortable; a physical-clumsiness definition alone misses this context. |
| P02 | `draining`: the meetings cause a person to lose energy | Adjective based on regular `drain`; omit irregular forms | Distinguish the tiring thing (`draining`) from the tired person (`drained`). Spanish equivalent should fit emotional/mental exhaustion. Do not focus on removing liquid. |
| P03 | Keep `went` as target; past movement in the office context | Past-simple form of `go`; `go → went → gone` | Explain base/form simply; the front example uses `went`. Do not replace the user's inflected target with a `go` card or invent `goed`. |
| P04 | `put off`: postpone the conversation | Phrasal verb; `put → put → put` | Demonstrate a separable pattern such as `put it off`. Do not teach the discourage/repel sense as the primary meaning or model `put off it` as correct. |
| P05 | `fuel`: make the argument continue or become stronger | Verb in this context; omit irregular forms | Explain the figurative sense simply; Spanish may use `alimentar` or `avivar` in context. A brief common noun meaning is allowed, but a gasoline-only definition misses the supplied sense. |

These cover spelling, regular versus irregular forms, an inflected input, a phrasal verb, and context-sensitive meaning. They are a smoke set, not a sufficient linguistic benchmark for release.

## Additional learning cases

| ID | Input | Expected behavior |
|---|---|---|
| Q01 | `bringing (context: Thanks for bringing your notes.)` | Preserve `bringing`; explain the -ing form and base `bring`; include `bring → brought → brought`. |
| Q02 | `stuck (context: I'm stuck on this problem.)` | Explain being unable to make progress in this context; identify the relationship to `stick` and include `stick → stuck → stuck`. Allow a useful adjective description without forcing only one grammatical analysis. |
| Q03 | `wash (context: I need to wash my jacket.)` | Regular verb; no Irregular Forms heading. Natural usage and examples, without padding the card with regular-verb forms. |
| Q04 | `go after (context: go after your dreams)` | Primary sense is pursue/try to achieve; category phrasal verb; include `go → went → gone`; avoid a physical-chasing-only explanation. |
| Q05 | `circle back (context: Let's circle back to this after lunch.)` | Return to a topic later; workplace/conversational usage; regular `circle`, so omit irregular forms. Distinguish returning to a topic from reconnecting with a person where useful. |
| Q06 | `bank (context: I need to deposit this check at the bank.)` | Financial institution; noun; omit irregular forms; context controls the sense. |
| Q07 | `bank (context: We sat on the river bank.)` | Edge/land beside the river; noun; retain separately from Q06 rather than deduplicating by spelling alone. |
| Q08 | `forsooth` | Retain the card and mark it low priority/archaic in the existing usage-note section; contextual alternatives may include `really` or `indeed`. Do not portray it as ordinary modern workplace language or silently remove it. |

The figurative verb sense in P05 is supported by [Merriam-Webster's fuel entry](https://www.merriam-webster.com/dictionary/fuel). The register expectation in Q08 follows [Merriam-Webster's forsooth entry](https://www.merriam-webster.com/dictionary/forsooth), which identifies archaic and humorous/ironic usage. Dictionary checks support those expectations; they do not verify generated cards, Spanish translations, or every pronunciation detail.

## Input and response fixtures

These are controlled pipeline checks, normally using fake provider responses rather than extra hosted calls:

| ID | Fixture | Observable outcome |
|---|---|---|
| F01 | Sentence-only input: `Back-to-back meetings can be draining.` | Import preview requires a selected target span before generation; it does not silently choose vocabulary. |
| F02 | P01 plus another entry spelled `awkward` with the same context | Flag the potential duplicate after correction for review; do not automatically send two notes or merge distinct contexts. |
| F03 | Context contains quotation marks, angle brackets, or instruction-like text | Preserve it as content, render escaped text, and do not execute scripts or commands. Check boundary handling; no claim of universal prompt-injection prevention. |
| F04 | Malformed JSON, missing meaning, empty examples, or incorrect field types | Save an actionable failure; no approval/audio/delivery. Any repair attempt remains bounded and separately recorded. |
| F05 | Valid-looking structured response with the wrong sense for P05 | Show a draft for semantic review. Structural validation must not label its learning content correct or auto-approve it. |
| F06 | Refusal or truncated provider output | No partial response becomes an approved card; preserve successful items and report the failed item. |
| F07 | Small alternate profile with `question`, `answer`, and optional audio selection | Generic validation/rendering does not require English Coach headings. This fixture exercises core boundaries; it does not add the future editor to the prototype. |

Define the actual fixture field keys and schema during AV-003. This document describes behaviors without freezing unimplemented TypeScript contracts.

## Review rubric

For every generated card, check:

- **Structure:** exact profile headings/order; every required field; 3–4 additional examples, 3–6 chunks, 2–4 alternatives; irregular forms present only when applicable.
- **Meaning and grammar:** target/context preserved, correction explained, useful category/base-form guidance, accurate sense and forms.
- **Speaking usefulness:** natural American English examples, useful common chunks, varied but realistic constructions, B1–B2 explanations.
- **Pronunciation:** suitable General American IPA and both required pronunciation subsections; accurate Spanish-speaker guidance. Review pronunciation with a reliable pronunciation reference or qualified reviewer where uncertain; no exact IPA answer key is asserted here.
- **Translation and alternatives:** contextual Spanish and alternatives that fit the supplied meaning; no requirement that every synonym be interchangeable in every sentence.
- **Review usability:** concise entries without omitted content; readable phone layout; no extra quizzes, rankings, or headings introduced by the model.

Classify findings as **blocker**, **needs correction**, or **acceptable variation**. Wrong meaning, false forms, missing required content, or misleading pronunciation block that card's acceptance. Acceptable differences in phrasing or supported American pronunciation variants do not fail a card merely for differing from a single answer string.

## Execution and evidence

1. Human reviewer checks these expectations and records amendments before calling them approved reference expectations.
2. Bulma records provider/model, operational prompt/profile/schema versions, supported output mode, request settings, and run time. Validate the current provider capability and free account allowance before generation.
3. Start with one attempt per learning case. Run P01–P05 first; run Q01–Q08 for the text-provider evaluation when allowance permits. Record interrupted or unrun cases rather than claiming complete coverage.
4. Preserve raw output, structural findings, and linguistic findings separately from edited/approved revisions. Synthetic evaluation artifacts may be deliberately shared after secret redaction; normal logs must not dump private inputs or keys.
5. Record input/output usage where provided, latency, quota pauses, retry/repair counts, and the number/type of manual corrections. Account allowance and real token consumption determine capacity; do not infer free support for 50 items from a successful five-item run.
6. If a prompt changes, record a new version and rerun affected cases. Report the changed subset separately; do not combine outputs from multiple prompt versions into an unexplained pass rate.

Prototype demo acceptance requires all five final reviewed cards to satisfy the rubric and all structural checks to pass. Record how many were acceptable on the first response and how much correction was needed. Fixing cards by hand does not establish model suitability: the provider decision also considers raw errors, repeated problem patterns, latency, and quota consumption. Unresolved linguistic blockers keep the affected cards out of the accepted demo.

## Run record template

```text
Run ID/date and evaluator:
Dataset version / case IDs executed:
Provider/model and request settings:
Operational prompt/profile/schema versions:
Source-expectation review: pending / reviewer and date
Per case: raw structure result / learning findings / correction / final review status
Usage, latency, repair attempts, and quota interruptions:
Unrun cases and reasons:
Candidate decision: suitable for next experiment / adjust and rerun / replace / unresolved
Reviewer, evidence location, and linked issue:
```

**Current evidence:** P01–P05, Q01–Q08, and F01–F07 are defined. All execution results and human approvals remain **Not run / Pending**. Do not mark AV-005 complete merely because this document exists.
