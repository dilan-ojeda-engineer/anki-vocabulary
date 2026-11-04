# AV-036 — Content review and provenance

**Status:** AI-assisted editorial review prepared. The owner accepted the five cards as correct and useful and all 30 current clips as clear and matching the text on November 4, 2026. No separate specialist translation audit is claimed. No new text-model output was generated or accepted.

## Fixture provenance

The five words and teaching material come from the owner-supplied [comparison archive](AV-005-user-comparison-source.txt). That archive remains unchanged. Its numbered Markdown titles and FRONT/BACK report wrappers were removed only when preparing the structured [acceptance fixture](../../tests/fixtures/av036-cards.json); the current plain-card importer does not accept those wrappers. The live run imported structured JSON and also exposed a separate invalid sixth entry.

All five audience-specific pronunciation tips use the English-written guidance from [editorial revision 4](AV-005-edited-candidates-revision-4.json), with the fuel wording simplified further below. This avoids the Spanish-style respellings in the older comparison archive. Contextual Spanish remains in Spanish Translation, as required by the current English Coach contract. Earlier raw provider runs and their failed/pending evaluations are not relabelled as successful by these manual adaptations.

## Review by card

| Card | AI-assisted assessment and changes | Human check remaining |
| --- | --- | --- |
| awkward | Social-discomfort meaning, four varied examples, and collocations fit the front context. Kept the informal label on weird; removed the redundant, awkwardly phrased alternative uncomfortable socially. The two American vowel transcriptions found in Cambridge's learner and American sections are acceptable variation, so the archived /ɔ/ choice was not rejected. | Are the meaning contrast and alternatives clear and useful? |
| draining | The causing-tiredness versus feeling-drained contrast is supported. Examples cover emotional, mental, and physical contexts; the audience guidance is now English rather than a Spanish-style spelling. | Are all examples and the final /ŋ/ sound clear? |
| went | Preserved go → went → gone and examples of related forms. Revised the usage note to show a straightforward has gone home example and explain that been is often clearer for completed visits; removed the potentially confusing repeated-visit example with gone. | Is the went/gone/been distinction understandable at the learner's level? |
| put off | Preserved the postponement meaning, -ing pattern, four examples, and put → put → put. Reworded the native tip from both forms to base, past, and participle forms, all pronounced the same. | Are the gerund pattern and connected speech easy to follow? |
| fuel | Kept the verb meaning, noun/verb contrast, examples, and American fueled spelling. Simplified the audience tip by removing the technical phrase strongly fricated consonant. This non-spoken edit reused cached audio and preserved all Anki audio references. | Is the figurative sense useful, and is the spoken word clear? |

These are editorial judgments, not proof that every paraphrase is interchangeable in every context. No automatic language detector or schema is claimed to establish linguistic correctness.

## Primary reference checks

- [Cambridge awkward](https://dictionary.cambridge.org/us/dictionary/english/awkward?topic=embarrassing) supports social/anxious and physical-skill senses and supplies differing American transcription conventions across its dictionary sections. It supports allowing pronunciation variation rather than treating one vowel symbol as a universal failure.
- [Cambridge draining](https://dictionary.cambridge.org/us/dictionary/english/draining?topic=tired-and-making-tired) and [drained](https://dictionary.cambridge.org/us/dictionary/english/drained?topic=tired-and-making-tired) support the causing-tiredness versus tired-state distinction.
- [Cambridge basic verb forms](https://dictionary.cambridge.org/grammar/british-grammar/basic) records go/went/gone. Its [been/gone guidance](https://dictionary.cambridge.org/us/grammar/british-grammar/been-and-gone) supports the completed-visit clarification; the fixture says often clearer rather than making an unsupported categorical claim about all American usage.
- [Cambridge put off](https://dictionary.cambridge.org/us/dictionary/english/put-off) supports postponement, the following -ing form, and unchanged put past/participle forms.
- [Cambridge fuel pronunciation](https://dictionary.cambridge.org/us/pronunciation/english/fuel) supplies the two-syllable American form used in the card; its [American dictionary entry](https://dictionary.cambridge.org/dictionary/english/fuel) also records a one-syllable variant. A natural one-syllable rendition alone would not fail voice acceptance.

Reference text was retrieved through search results; some direct page fetches returned access errors. Reference recordings were not listened to. Human review must judge the actual Sarah clips, not infer speech quality from IPA, MP3 validation, or successful playback controls.

## Owner review

The [five-card review document](AV-036-cards-for-review.md) contains the final proposed teaching content. The isolated workspace at `http://127.0.0.1:43112/` presents the same saved cards and 30 current clips. Use Next to review every card and listen to Target, Front example, and the four additional examples. The extra previous awkward clip is retained for comparison and is not an additional required current placement.

The controlled server approval records are engineering test prerequisites. They do not substitute for the owner's linguistic/listening assessment or milestone acceptance.
