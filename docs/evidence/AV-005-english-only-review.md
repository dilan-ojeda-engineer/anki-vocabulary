# AV-005 English-only live evaluation — av005-3

Date: November 2, 2026. Run: `b5023078-1b58-4564-b8fc-26571f85fe07`. Evaluator: Codex, preliminary AI-assisted content review with targeted references. Human expectation review and card approval remain pending.

## Execution

The owner authorized testing the new English-only prompt with P01–P05. The run used Groq `openai/gpt-oss-120b`, strict profile-derived JSON Schema, temperature 0.2, low reasoning effort, maximum 4096 completion tokens, and 35-second inter-case pacing. No settings or prompt changed during the run. The key was loaded locally without display or persistence in evidence.

- Five requests, five completed responses, five structurally valid results.
- All five raw cards and correction explanations are English-only on inspection; no translation or Spanish-speaker field was returned.
- Original inputs/contexts retained; P01 spelling correction recorded separately.
- Target checks pass for all five; irregular-form checks pass for four. P04 incorrectly returns null instead of put → put → put.
- Reported usage: 6,843 input tokens and 2,264 output tokens, **9,107 total**.
- Completed-request latency: median **1.54 seconds**, range **1.31–2.44 seconds**, excluding inter-case pacing.
- No quota interruption, automatic retry, repair request, provider switch, or paid fallback occurred in this run. This does not establish general allowance or throughput guarantees.

Exact prompt SHA256: `53cb49846c42881a8e7272fa1120330c8f7e86423af0d44ddfe74165be284f19`.

The [full run record](AV-005-english-only-run.json) retains the exact prompt/profile/schema identity, raw completion strings, usage, latency, structural validation, expectation checks, and pending review fields. The [rendered raw cards](AV-005-english-only-raw-cards.md) preserve the learning values without editorial correction. These are separate from the [manually edited candidate set](AV-005-cards-for-review.md); the latter was not regenerated or substituted for the raw outputs.

## Learning review and proposed corrections

All corrections below are proposals, not mutations of the raw responses or accepted revised cards. In this preliminary review, none of the five raw cards is ready to approve unchanged. That is an evaluator judgment, not a human-scored benchmark or a claim that every sentence is wrong.

| Case | What worked | Findings | Proposed correction |
|---|---|---|---|
| P01 awkward | Correct spelling/context, reasonable American IPA, natural social examples | Includes isolated derivative awkwardly as a chunk. Usage note begins with an unnecessarily restrictive avoid-describing-a-person rule, although its later caveat permits the socially-clumsy sense; this should not be misreported as an absolute ban | Replace awkwardly with socially awkward. Give a straightforward distinction between I felt awkward and He is socially awkward, without discouraging valid person descriptions |
| P02 draining | Correct contextual meaning, IPA, regular/adjective treatment, most examples natural | After the marathon, the crowd felt draining is misleading for the intended tired-person meaning. The note contrasts figurative/literal senses but misses the more valuable draining versus drained distinction | Replace the sentence with The long wait at the finish line was draining for the crowd. Explain The meeting was draining / I felt drained afterward |
| P03 went | Keeps inflected target, context, correct go → went → gone, English-only meaning | Budget-review and went-missing examples/chunks drift beyond movement/travel. The went-to-go redundancy warning is not a useful categorical rule; pronunciation states final t is released as though invariant. Usage text also contains Markdown emphasis despite plain-text instructions | Keep examples/chunks on travel, with useful go/went/gone/goes variation. Teach went versus gone after have/has/had. Allow unreleased final t rather than mandating release; remove formatting markup |
| P04 put off | Correct postponement sense; natural varied examples; permitted fifth example gives another habitual form | Missing required irregular forms is a blocker. Neither examples nor note teaches the separable-pronoun pattern. Put off for good is an ambiguous/low-value postponement chunk; stress guidance is too categorical | Supply put → put → put. Include put it off and put off + -ing patterns. Replace weaker chunks with those forms; describe stress/linking without an invariant first-word rule |
| P05 fuel | Correct figurative sense, complete real inflections instead of fuel(ed), broadly useful examples and chunks, accurate core IPA | Usage note's literal-object versus fuel-the-argument’s contrast invents an unhelpful distinction. Its example does not demonstrate literal versus figurative meaning. Pronunciation phrasing about /j/ in fuel the is unclear: /j/ is inside fuel, not the word boundary | Use a concrete noun/verb distinction and American fueled spelling note. Explain few-like /fjuː/ followed by weak /ə/ and l. Prefer transparent everyday alternatives where possible; stoke/exacerbate may be useful nuances but need simple context |

P04's five additional examples satisfy the count; a fifth is not automatically an error. The remaining cards have four. Chunks and alternatives fall within the required counts. These checks do not establish that a chunk is high-value or an alternative fits every grammatical frame.

## Reference checks and limits

[Cambridge's draining entry](https://dictionary.cambridge.org/us/dictionary/english/draining) describes the cause of tiredness, while [drained](https://dictionary.cambridge.org/dictionary/english/drained) describes feeling very tired. This supports replacing P02's misleading people-feeling example and strengthening its usage note. It does not imply every possible predicative use of felt draining is ungrammatical; a situation can feel draining to someone.

[Cambridge's social-language guidance](https://dictionaryblog.cambridge.org/2019/01/16/the-life-and-soul-of-the-party-how-we-behave-at-social-events/) includes descriptions of people as awkward. P01's caveat acknowledges that use, so the finding concerns clarity and overrestriction, not a fabricated claim that the entire note prohibits it.

[Cambridge's go grammar](https://dictionary.cambridge.org/grammar/british-grammar/go) discusses go plus a to-infinitive, and the [British Council's purpose-infinitive guidance](https://learnenglish.britishcouncil.org/free-resources/grammar/a1-a2/infinitive-purpose) explains purpose constructions. These do not justify teaching a blanket redundancy prohibition for went to go. A concise, verified form distinction is a better learning note than this invented restriction.

[Cambridge's put off entry](https://dictionary.cambridge.org/dictionary/english/put-off) records put as both past and participle and illustrates the -ing pattern. P04's null forms directly conflict with the explicit prompt/profile learning rule, even though the JSON field is structurally nullable. [Cambridge's fuel pronunciation](https://dictionary.cambridge.org/us/pronunciation/english/fuel) supplies /ˈfjuː.əl/ and its component sounds; it supports clearer guidance without treating every American syllable-compression variant as wrong.

Example usefulness, register, and clarity findings remain preliminary linguistic judgments. No reference audio was listened to, no qualified linguistic reviewer approved the cards, and no pronunciation certification is claimed. Machine validation cannot establish semantic correctness or English-only behavior for every possible future input.

## Decision and remaining coverage

**Language-policy result:** the five tested v3 outputs satisfy English-only output on inspection.

**Candidate decision:** still **needs changes before adoption**. Removing Spanish and using a shorter self-contained prompt did not resolve recurring irregular-form, context, and usage-note problems. The successful English-only constraint must not be presented as full teaching-quality acceptance. This run is a five-case smoke check, not a controlled proof that v3 is better or worse than v1/v2 on the full 13-case set.

Q01–Q08 were not run with v3 because this follow-up specifically selected P01–P05. Their older bilingual results remain historical; English-only coverage is not claimed for them. The raw run has zero edited/approved revisions. Existing manually edited cards remain available for human review without being counted as successful raw model responses. No audio, Anki delivery, commit, merge, or board acceptance occurred.
