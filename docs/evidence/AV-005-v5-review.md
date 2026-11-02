# AV-005 latest-prompt evaluation — av005-5

Date: November 2, 2026. Run: `6291cd4d-7955-49c3-ad5c-be11605229f7`. Evaluator: Codex, preliminary AI-assisted content review with targeted grammar/dictionary references. Human expectations, learning acceptance, and approval remain pending.

## What was actually generated

The owner authorized P01–P05 with the current prompt. Groq `openai/gpt-oss-120b` received the exact [av005-5 prompt](../prompts/english-coach-av005-5.md), the profile-derived strict JSON Schema, and each fixed target/context separately. Settings were temperature 0.2, low reasoning effort, maximum 4096 completion tokens, and 35-second inter-case pacing. There were no mid-run prompt changes, automatic retries, repairs, provider switches, or editorial corrections.

The [full raw record](AV-005-v5-run.json) retains the exact prompt/profile, hashes, model identity, settings, inputs, completion strings, usage, latency, validation, and fixed expectation checks. The [raw card preview](AV-005-v5-raw-cards.md) renders these values with the official profile headings, escaping Markdown characters without correcting their wording. It is separate from the [previously edited candidates](AV-005-cards-for-review.md). No approved or edited draft was created from this run.

## Measured result

| Check | Result |
|---|---|
| Requests / completions | 5 / 5 |
| JSON/profile field validation | 5 / 5 pass |
| Preserved target/context | All five, with P01 spelling correction recorded separately |
| Fixed irregular-form expectation | Four pass; P04 fails because put → put → put is missing |
| Pronunciation and translation fields | Present for all five |
| Example/chunk/alternative counts | All within 4–5 / 3–6 / 2–4 limits; all five used four additional examples |
| Reported tokens | 7,758 input + 3,104 output = **10,862 total** |
| Completed-request latency | Median **1.90 seconds**, range **1.72–2.27 seconds**, excluding pacing |
| Quota/service interruptions | None observed in this run |
| Automatic retries / repair calls | 0 / 0 |

Prompt SHA256: `3e193c129639f9de24620794a0b53f2b84e11cb9ceeb645d103db4d572ac4fa2`.

The profile provides every official section, with conditional omission of Irregular Forms for null. Because the model incorrectly returned null for P04, that card's rendered structure does **not** satisfy the full conditional requirement. Five valid JSON responses are not five fully compliant cards.

## Raw learning findings

These are preliminary judgments, not human certification. Each raw card needs at least some correction before acceptance; the strongest errors are identified explicitly rather than treating every wording preference as a blocker.

| Case | What worked | Findings requiring correction |
|---|---|---|
| P01 awkward | Correct correction, social meaning, front context, reasonable American IPA; several natural examples | Usage note says an adjective needs a noun after it, contradicting its own correct He felt awkward example. This is a misleading grammar rule. Software-workflow example and clumsy alternative drift from social discomfort. Audience guidance embeds its own heading and Spanish word/syllable comparisons; the latter do not satisfy a strict Spanish-only-in-translation policy |
| P02 draining | Main meaning, IPA, regular/adjective handling, most chunks/examples, contextual agotador | The athletes felt draining teaches the wrong form for people feeling exhausted; use drained for that intended meaning. The usage note falsely rules out literal draining and substitutes leaking/dripping, which are different actions. Sound guidance compares /ŋ/ with a sound not represented in canción as written, and calls -ing a single sound despite /ɪŋ/ containing two segments |
| P03 went | Retains target/context, correct go → went → gone, relevant core meaning and Spanish translation | Examples/chunks drift to reviewing, proceeding, and disappearing. Chunk for a activity has an article error. Released-final-t instruction is too categorical. Perfect-form warning is useful, but only-for-simple-past-actions wording needs care about form versus time reference. Usage text contains literal Markdown emphasis |
| P04 put off | Correct postponement meaning, natural core examples, contextual translation | Missing put → put → put is a blocker. Pronunciation guidance contradicts itself about released/unreleased t and mixes its /ɔ/ transcription with /ɒ/ in the other subsection; invariant first-word stress is unreliable. The put off the coffee prohibition invents an object restriction. Put off by the idea shifts to the discourage/repel sense, and no separable-pronoun pattern is taught |
| P05 fuel | Contextual figurative meaning/translation, complete real inflections, useful examples/chunks; transitive pattern useful for this context | Pronunciation explanation is unnecessarily technical for B1–B2, and clear/crisp final-l guidance needs an American-pronunciation check. The one-syllable /fjul/ variant alone is not a reason to reject it. Guidance leans on Spanish lexical examples and duration comparisons rather than clear English-only sound guidance. Usage text contains literal Markdown emphasis; harder alternatives need contextual explanation |

English explanatory sentences and contextual Spanish translations were returned throughout. However, the audience guidance in P01/P02/P05 quotes Spanish lexical examples outside the translation field. These are sound comparisons rather than Spanish explanatory paragraphs, but they still need revision under the strict agreed language separation. IPA comparisons to Spanish phonemes can be expressed with English explanations instead. A schema cannot establish this language distinction by field presence alone.

Several pronunciation tips and usage notes use unnecessary terms or reproduce a fixed subsection label inside the field. These are additional readability/format issues; no headings were removed from the profile to hide them.

## Reference checks

[Cambridge's adjective-position guidance](https://dictionary.cambridge.org/us/grammar/british-grammar/adjective-phrases-position) distinguishes adjectives before nouns from adjectives after linking verbs. This supports rejecting P01's blanket noun-after-adjective rule. [Cambridge's draining](https://dictionary.cambridge.org/us/dictionary/english/draining) and [drained](https://dictionary.cambridge.org/dictionary/english/drained) distinguish causing tiredness from feeling tired. Its [drain entry](https://dictionary.cambridge.org/us/dictionary/english/drain) also records literal water draining, contrary to P02's categorical restriction.

[Purdue OWL](https://owl.purdue.edu/owl/general_writing/grammar/articles_a_versus_an.html) explains an before a vowel sound, supporting an activity rather than a activity. [Cambridge's tense/time explanation](https://dictionary.cambridge.org/us/grammar/british-grammar/tenses-and-time) supports keeping past verb forms distinct from categorical claims about past-time events.

[Cambridge's put off entry](https://dictionary.cambridge.org/dictionary/english/put-off) records put as both past and participle and the postponement/-ing pattern. P04's missing irregular forms directly contradict the explicit learning rule. Its [off pronunciation](https://dictionary.cambridge.org/us/pronunciation/english/off) is a useful reference for consistent American guidance; the two subsections should not prescribe contradictory releases or unlabelled dialect changes. The coffee-object restriction is an unsupported evaluator-identified usage problem, not a dictionary prohibition.

[Cambridge's fuel pronunciation](https://dictionary.cambridge.org/us/pronunciation/english/fuel) supplies a useful two-syllable reference. This review does not reject an American one-syllable variant merely for differing from that transcription. No reference audio was listened to or qualified pronunciation review obtained. Final Spanish accuracy, naturalness, dialect details, and learning acceptance still require human review.

## Decision

**Needs changes before adoption.** The current prompt produces the requested data fields and translations, but the raw content still violates important teaching rules. Missing irregular forms, false usage restrictions, incorrect learner examples, and inconsistent pronunciation guidance recur. Do not count the manually corrected candidate set as proof that this run succeeded unaided.

The five raw responses remain unchanged. This run made no new edited/approved revisions, no speech requests, and no Anki delivery. Q01–Q08 were not selected under v5; earlier versions' results do not establish current full-set quality. No further prompt iteration or alternative-model evaluation was performed during this run. The next provider/content-validation decision should use these actual results, not structural pass rates alone.

Evidence verification: the separate read-only reviewer confirmed the five completions/schema passes, token and latency totals, exact prompt/hash, raw-preview correspondence, P04 failure, combined accounting, and pending statuses, with no remaining findings. The executor also revalidated raw fields against the actual v5 schema, checked prompt/schema hashes and local links, and found no credential-shaped text. No application code changed and the prior 58-test code checks were not rerun; the standalone experiment was rebuilt before execution. These checks establish evidence integrity, not human linguistic approval.
