# AV-005 Qwen comparison — incomplete because of rate limits

Date: November 2, 2026. Evaluator: Codex, preliminary AI-assisted content review. Human linguistic approval remains pending.

## Controlled configuration

The owner explicitly selected `qwen/qwen3.8-27b` on Groq for a comparison with the previous `openai/gpt-oss-120b` run. The runner now accepts an allowlisted `--model` argument; its default remains GPT-OSS for historical reproduction, not a production endorsement. No automatic model/provider fallback was introduced.

The comparison retained the exact av005-5 prompt, profile-derived strict schema, P01–P05 inputs, temperature 0.2, low reasoning effort, and maximum 4096 completion tokens. Prompt SHA256: `3e193c129639f9de24620794a0b53f2b84e11cb9ceeb645d103db4d572ac4fa2`. The exported [raw evidence](AV-005-qwen-run.json) verifies identical prompt, schema, settings, and matched inputs against [the GPT-OSS baseline](AV-005-v5-run.json). Different tokenizers and internal reasoning behavior mean identical settings do not imply identical internal computation or token counts.

[Groq's structured-output documentation](https://console.groq.com/docs/structured-outputs?form=MG0AV3) listed this Qwen candidate, and a read-only authenticated models listing confirmed its availability. The two completed live responses accepted strict-schema mode and returned the requested Qwen model identity. [Groq's model guidance](https://console.groq.com/docs/model/qwen/qwen3.8-27b) also recommends model-specific tuning; that was not applied because this first comparison intentionally held the request configuration fixed. These results characterize this configuration, not every possible Qwen setup.

## Actual coverage and rate-limit history

| Stage | Actual result |
|---|---|
| Initial run bd3df4f9-cfd8-4e95-a0cf-787020823418 | P01 and P02 completed; P03 rejected with HTTP 429; runner stopped before P04/P05 |
| Deliberate continuation 743a9d5f-0895-4c86-ac22-0c860789141a | After a 60-second wait, requested P03–P05 with 60-second pacing; P03 again rejected with HTTP 429, and runner stopped |
| Final coverage | Two completed cases, two rejected attempts for P03, zero attempts for P04/P05 |

The continuation was one deliberate additional attempt, not an automatic retry loop. There were **four inference requests, two completed responses, and two rate-limit rejections**, with no further calls after the repeated rejection. Neither error returned a retry-after value. The saved evidence does not distinguish a minute limit from a daily/other account allowance; no reset time or underlying quota cause is invented. One read-only models-list request was separate from inference accounting. No paid fallback, account upgrade, alternative model, or silent provider switch occurred.

Both completed responses passed the profile schema and fixed target/irregular-form checks. Since P01/P02 correctly require null irregular forms, this does not establish Qwen's behavior on went or put off.

Reported completed-response usage was **2,371 input + 2,828 output = 5,199 tokens**. Failed-request usage was unavailable. Successful-request latencies were **3.96 seconds** and **6.29 seconds**; the two-sample median is **5.13 seconds**. Pacing and the deliberate wait are excluded. The median for the same two GPT-OSS baseline cases was **1.99 seconds**, but two non-repeated observations are insufficient for a general performance ranking. Completion usage may include internal reasoning and is not just visible learning text; no monetary-cost comparison is asserted.

## Raw learning comparison

The [Qwen card preview](AV-005-qwen-raw-cards.md) contains unedited learning values, with only profile formatting/Markdown escaping. The existing edited candidate set and all prior raw outputs remain unchanged.

| Case | GPT-OSS av005-5 findings | Qwen av005-5 findings |
|---|---|---|
| P01 awkward | Wrong noun-after-adjective rule; context drift and weak guidance | Correct target/context and useful social examples. Its fifth example adds an infinitive construction. However, the correction reason misleadingly says w belongs before k, not after; the input omits an additional w, and the correct word retains a w after k as well. The usage note treats awkward for general difficulty, such as an awkward problem, as a learner error; that is an unsupported restriction. The pronunciation claim that the word is usually fully pronounced because it often ends a clause is unsupported and not a reliable teaching rule |
| P02 draining | Incorrect athletes felt draining example; false literal-use restriction and misleading sound advice | Most examples are more useful; includes a natural verbal form, draining her energy. However, the required full-target General American IPA is absent: individual /eɪ/ and /ŋ/ segments are not a complete transcription of draining. Guidance explicitly recommends a rolled/tapped r, describes /eɪ/ as gliding toward a back vowel, and uses enorme as an example of the nasal before g/k even though that word has no such environment. The usage note discourages drained me before admitting it is valid, creating an unnecessary confusing restriction |
| P03 went | Full baseline available with documented defects | No completed response; rejected twice |
| P04 put off | Missing required put → put → put and further documented defects | Never attempted; no claim that Qwen fixed the missing forms |
| P05 fuel | Full baseline available with documented defects | Never attempted |

The two completed Qwen cards have the requested learning fields, both pronunciation subsections, contextual translations, and allowed array counts. Their explanations are English prose with quoted Spanish sound examples; strict confinement of Spanish lexical material to translation still needs editorial attention, as in the baseline. Structural/schema passes do not establish full teaching compliance. In this preliminary review, neither completed card is ready for acceptance unchanged.

## Reference checks and judgment limits

[Cambridge's awkward entry](https://dictionary.cambridge.org/dictionary/english/awkward) includes difficulty using, doing, or dealing with something. Qwen's general-difficulty restriction should therefore be replaced with contextual guidance rather than taught as a categorical error. This does not invalidate choosing the social sense as the card's primary focus.

[Cambridge's draining pronunciation](https://dictionary.cambridge.org/pronunciation/english/draining) provides the full target /ˈdreɪ.nɪŋ/. The Qwen native-pronunciation field has respelling and individual segments, but not that full IPA transcription. [Pronuncian's American r guidance](https://pronuncian.com/pronounce-r-sound) explains that the tongue tip does not touch the tooth ridge, supporting rejection of rolled/tapped-r advice for this General American target. Its [long-a guidance](https://pronuncian.com/pronounce-long-a) is a reference for the diphthong rather than a movement toward a back vowel.

Other example/register, Spanish-phonology, and explanatory-clarity findings are preliminary evaluator judgments, not certified linguistic results. No reference audio was listened to, and no qualified human pronunciation or Spanish review was obtained. Valid American pronunciation variants are not rejected merely for differing from one dictionary transcription. The documentation's recommended alternative settings were not tested.

## Decision and remaining work

**Do not adopt Qwen from this evidence. The comparison is incomplete and the two available cards still contain teaching defects.** Some examples improved, but the pronunciation/usage problems prevent a claim that the replacement solved the task. No overall winner is established from two matched cases.

P03–P05 remain ungenerated. Completing the requested five-case comparison requires available account allowance; the repeated 429 prevented that work during this session. Inspect the account's actual limits before planning another continuation, and retain the failed attempts if a later run succeeds. There is no automatic scheduled retry or promise that a one-minute wait resets the relevant quota.

No cards were edited, approved, sent for speech, or delivered to Anki during this comparison. No commit, merge, or board acceptance occurred. Code validation passed types, zero-warning lint, formatting, **59 unit tests**, desktop build, standalone experiment build, and offline Qwen planning. A separate read-only code review found no issues with explicit selection, metadata, or no-fallback behavior. Evidence integrity and human learning acceptance remain separate checks.

The separate evidence reviewer verified the configuration equivalence, raw previews, counts, usage, latency median, and pending statuses. It caught one report attribution error: a software-workflow example belonged to the GPT baseline, not Qwen. That statement was removed and Qwen's actual spelling-correction explanation was checked directly. The executor additionally revalidated completed raw responses against the real schema, returned model identities, prompt/schema hashes, inputs/settings, local links, and absence of credential-shaped text. These are evidence checks, not human linguistic approval.
