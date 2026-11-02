# AV-005 learning findings and candidate decision

Date: November 2, 2026. Evaluator: Codex (AI-assisted preliminary review). Source expectations and final card acceptance still require human review. Findings below are not a certified linguistic assessment, an exact IPA answer key, or approval to generate audio/deliver cards.

## Method and separation

The fixed 13 inputs remain dataset 0.1. Both operational prompt versions use the owner's 4–5 additional-example rule. Version 1 was run first, then one bounded version-2 refinement addressed observed problems with forms, invented restrictions, incomplete sentences, context drift, pronunciation consistency, and formatting. Compare each version separately; no combined learning-quality pass rate is asserted.

The [raw synthetic completions and measured run records](AV-005-text-feasibility.json) are preserved separately from the [first editorial revision](AV-005-edited-candidates-revision-1.json). Its [card preview](AV-005-cards-for-review-revision-1.md) contains **25 AI-proposed field edits across five cards**: P01 4, P02 3, P03 5, P04 6, P05 7. The [latest cards for human review](AV-005-cards-for-review.md) additionally incorporate the owner's teaching-quality feedback and attached examples, with separate before/after history. These are editorial interventions, not human corrections or evidence that the model got the cards right unaided. Raw provider records are never overwritten.

## Per-case findings

All rows still have final human review **pending**. “Blocker” means the raw card must not be accepted with the identified error. “Needs correction” includes context, usefulness, formatting, or guidance weaknesses; it is not a structural-schema failure.

| Case | Version 1 raw findings | Version 2 raw findings | Preliminary disposition |
|---|---|---|---|
| P01 awkward | Corrects spelling/context, but invents a ban on using awkward for objects; includes isolated derivative awkwardly among chunks | Replaces the incorrect restriction, but introduces /æ/ “cat” vowel in awkward; isolated derivative remains | Blocker; corrected pronunciation/chunks/usage proposed |
| P02 draining | Correct tiring-versus-tired distinction, but visible backslashes/Markdown in usage; vowel guidance reduces /ɪ/ to length alone | Removes escapes; contextual meaning retained; alternatives “wearing out”/“sapping” need usable phrase framing and sound guidance needs improvement | Needs correction; category/pronunciation/alternatives proposed |
| P03 went | Retains target/forms, but examples/chunks drift to other go phrasal-verb senses; final-t instruction is too categorical | Retains those patterns rather than staying on travel/movement | Needs correction; travel examples/chunks and more careful sound guidance proposed |
| P04 put off | Omits put → put → put; approximation changes initial /p/ to /s/; fixed stress rule; weak usage-note choice | Still omits forms and changes /p/ to /s/; repeats front sentence as an additional example | Blocker; forms/pronunciation/separable-pronoun pattern and examples proposed |
| P05 fuel | Uses fuel(ed) placeholders in examples; misleading short-oo guidance and contradictory usage claim | Still uses fuel(ed), adds “fuel (or fuelled)” and literal-fuel chunks; claims verb usually is not literal | Blocker; complete American-spelled examples, contextual chunks, pronunciation, and usage proposed |
| Q01 bringing | Correct forms, but meaning defines the thanks construction; unsupported soft-/g/ guidance and gerund restriction; chunks drift to other senses | Better core meaning and no soft-/g/ claim, but repeats front and drifts to bring up/about/out; length-only /ɪ/ guidance remains | Blocker in v1; v2 needs correction/reference review, not accepted |
| Q02 stuck | Contextual meaning correct, but missing stick → stuck → stuck; broad sense drift | Still missing forms; repeats front, vowel approximation describes quality as merely a shorter Spanish a | Blocker; no edited Q candidate prepared |
| Q03 wash | Omits irregular heading correctly; useful washed /t/ note; chunks introduce unrelated senses and Spanish vowel guidance is inconsistent | Continues sound-guidance inconsistency; usage note about wash up is unclear and contains stray quote | Needs correction; no edited Q candidate prepared |
| Q04 go after | Pursue meaning retained, but omits go → went → gone; awkward restaurant example; invented completed-results restriction | Still omits forms; some content moves to police pursuit/legal action; drops rhotic sound in one respelling despite IPA | Blocker; no edited Q candidate prepared |
| Q05 circle back | Good main sense/patterns; categorical ban on physical use is unsupported | Physical-use ban removed; approximation equates /æ/ with Spanish a, and formal-writing rule needs nuance | Needs correction/reference review; no edited Q candidate prepared |
| Q06 bank (money) | Keeps financial sense; “cash a few bills” is an unnatural example here; /ŋ/ compared with a sound not present in canción as written | Better examples and no canción comparison; “savings place” is an unnatural alternative for this card | Needs correction; no edited Q candidate prepared |
| Q07 bank (river) | Keeps river sense/translation, but chunks introduce bank account/loan/reliance sense | River sense/chunks are now consistent; pronunciation approximation and short alternative “edge” still need contextual review | Improved, pending human/reference review; no edited Q candidate prepared |
| Q08 forsooth | Low-priority warning retained; category needs checking against adverb use, /θ/ taught as s+t, and blanket Spanish-sound claim is misleading | Warning retained, but prose calls /θ/ voiced like this, while Spanish guidance compares it with soft d: both conflict with the IPA | Blocker in both versions; no edited Q candidate prepared |

## Reference checks and judgment limits

Cambridge documents both social discomfort and difficulty using/handling things for [awkward](https://dictionary.cambridge.org/dictionary/english/awkward). Its [US pronunciation](https://dictionary.cambridge.org/us/pronunciation/english/awkward) does not use the cat vowel. The v1 /ɔ/ American variant is not rejected merely for differing from the reference's /ɑ/ transcription; the problem in v1 is its usage claim, while v2 introduces /æ/.

Cambridge explicitly records [put as irregular with put in past and participle](https://dictionary.cambridge.org/us/grammar/british-grammar/put), [stuck as past/participle of stick as well as an adjective](https://dictionary.cambridge.org/us/dictionary/english/stuck?topic=not-able-to-be-changed), and [go after something as trying to get it, based on go/went/gone](https://dictionary.cambridge.org/us/dictionary/english/go-after?topic=trying-and-making-an-effort). These support the dataset's missing-form flags; adjective/phrasal labels do not justify null under this profile's explicit rule.

Cambridge's [bring pronunciation](https://dictionary.cambridge.org/pronunciation/english/bring) ends in /ŋ/, not a separate soft /g/. Its [fuel pronunciation](https://dictionary.cambridge.org/us/pronunciation/english/fuel) supplies /ˈfjuː.əl/; spelling placeholders such as fuel(ed) are editorial failures independently of pronunciation variants. The one-syllable variant is not rejected solely for syllable count; the unchecked explanatory guidance and unfinished examples still need correction. [Dictionary.com](https://www.dictionary.com/browse/forsooth) identifies forsooth as an archaic adverb and gives final /θ/; teaching it as an s+t sequence is misleading.

Other findings about example usefulness, Spanish guidance, register, and context drift are the evaluator's preliminary judgments, not claims that those sources validate every sentence. No reference audio was listened to, no qualified pronunciation reviewer was consulted, and no human Spanish/English sign-off is claimed. Some direct dictionary fetches returned HTTP 403; indexed official dictionary text/pronunciation results supported the specific checks above. A valid American pronunciation variant is acceptable; this is not string matching against one dictionary.

## Candidate decision

**Needs changes before adoption.** Groq access and strict JSON transport worked, but both prompt versions produced substantive learning errors. The refinement did not reliably eliminate missing irregular forms, misleading sound guidance, unrelated senses, or incomplete inflected examples, and introduced a new awkward pronunciation error. No model replacement was silently selected.

Keep this provider/model as an experimental candidate, with any adoption decision requiring a stronger content-validation/reference strategy and renewed evaluation. A verified forms/pronunciation source and targeted rejection checks are more promising than asserting that another prompt sentence guarantees correctness. This bounded experiment stops after two prompt versions; no alternative provider was called. The edited five-card set is for learning review, not proof of raw-model suitability.

No card is approved, no audio or Anki delivery occurred, and AV-005 is not marked Done. Human expectation review, corrected-card acceptance, and the eventual provider decision remain explicit follow-ups. Other Q cases have raw findings only; no accepted edited Q set or integrated prototype demo is claimed.
