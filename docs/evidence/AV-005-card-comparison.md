# AV-005 comparison of corrected candidates and attached cards

Date: November 2, 2026. Reviewer: Codex, with targeted dictionary/grammar checks. Scope: the five corrected project candidates versus the five user-attached cards. This is a content comparison, not human approval, pronunciation listening, a new provider run, or proof of which model produced the attachment.

Sources: [project candidates at the time of comparison](AV-005-cards-for-review-revision-1.md), their [structured edit record](AV-005-edited-candidates-revision-1.json), and the [unchanged attached text](AV-005-user-comparison-source.txt). The user attachment's origin/model/settings are unknown. It must not be counted as another measured Groq response or used to revise the existing raw-model pass rates.

The attachment copy matches the source byte for byte; SHA256: `d4ed631662d49fbe2fd89d8b02923dfc7c1056c40f007a0459db5af84ab35800`.

## Overall finding

The attachment generally has a stronger learner-facing style: richer everyday chunks, more useful grammatical variation, clearer correct/incorrect examples, and more contextual Spanish options. The project candidates more consistently retain the fixed evaluation inputs and give careful sound guidance. Both sets still need editorial review. The earlier corrected candidates were proposals, and this comparison identifies a remaining overstatement in their went usage note.

Recommended direction: combine the attachment's teaching style with the project's contextual discipline and pronunciation safeguards. Do not replace one entire set automatically or treat the attachment as approved ground truth.

## Structural validation

All five attached cards have the requested FRONT/BACK headings and fixed question, followed by the required back sections in order. Each has four additional examples, six chunks, and four alternatives: within the current 4–5 / 3–6 / 2–4 limits. Irregular Forms appears only for went and put off, with go → went → gone and put → put → put. All five project candidates also meet those structural/count requirements. More chunks or alternatives are not inherently better; relevance and naturalness still matter.

The attached Markdown was inspected and its list counts checked programmatically. It was not imported into an application draft or run through a production importer. The project candidates had already passed their actual profile-field schema. Neither structural result validates every linguistic claim.

## Card-by-card comparison

| Target | Strengths in attachment | Strengths in project candidate | Changes recommended |
|---|---|---|---|
| awkward | Natural social examples; useful socially awkward/kind of awkward chunks; helpful embarrassed distinction | Retains P01 context/correction metadata; acknowledges other valid uses; more precise American-r guidance | Use attachment's examples/chunks selectively. Replace the awkwardly phrased alternative uncomfortable socially with socially uncomfortable or uneasy. Keep translations tied to the specific social context; torpe socialmente is not the best translation of awkward silence. |
| draining | Clear -ing adjective explanation; natural emotionally/mentally/physically draining chunks; useful past and present-perfect examples | More explicit /ɪ/ versus Spanish /i/ and final /ŋ/ guidance; conversational alternatives with usable phrasing | Prefer attachment's chunk set and varied examples. Wearing is a real adjective, not an error, but exhausting/tiring and a chunk such as taking a lot out of me are clearer initial speaking options. Keep approximation subordinate to IPA. |
| went | Useful go/went/gone sound comparison and have gone versus have went warning; related-form variation supports the prompt's learning goal | Retains target and office context; keeps examples/chunks on movement/travel | Correct the project's only for past events claim. Remove went wrong/went well from this movement-focused card. For its single completed event, translate as fui rather than adding iba without explanation. Alternatives such as left/moved require context, not direct substitution. |
| put off | Excellent postponement examples across forms; useful put off + -ing rule and chunks | Correct pronoun placement rule, contextual conversation front, and American vowel-variation caveat | Combine the attachment's -ing rule with put it off, not put off it. Replace project chunk put off the deadline with a clearer learning chunk such as put off a meeting; push back/extend a deadline is a better teaching choice for changing a deadline. Change attachment's both forms to all three main forms. |
| fuel | Natural complete examples, good tense variation, useful positive figurative context, and American fueled spelling note | Preserves the P05 argument/rumor context; translation and alternatives better fit that context; careful weak-vowel guidance | Both are useful standalone cards. For P05, retain argument-focused meaning/translation, rather than switching to motivation-focused alternatives. In attachment's FIU-al approximation, explicitly keep the second vowel weak /ə/, not a full Spanish a. |

## Findings that affect correctness or interpretation

### 1. The project went note is too absolute

The candidate says went is only for past events. This confuses a past verb form with past-time reference. For example, If I went tomorrow, would you come with me? uses went in an imagined future situation. Both [Cambridge's tense/time explanation](https://dictionary.cambridge.org/us/grammar/british-grammar/tenses-and-time) and the [British Council's past-tense reference](https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/past-tense) describe non-past uses of past forms.

Recommended concise replacement:

> In this sentence, went is the past simple of go and describes a completed trip. After have, has, or had, use gone, not went: She has gone home.

This keeps the card on its primary meaning without adding an unnecessary conditional lesson. The existing candidate file remains unchanged so this new finding is not hidden inside its prior correction history.

### 2. Valid American pronunciation variants should remain valid

The attachment's awkward /ˈɔkwɚd/ and gone /ɡɔn/ should not be rejected just because a reference lists /ɑ/ variants or writes vowel length differently. [Merriam-Webster's gone entry](https://www.merriam-webster.com/dictionary/gone) lists both vowel variants in its own notation; [Cambridge's US gone pronunciation](https://dictionary.cambridge.org/pronunciation/english/gone) illustrates the /ɑ/ variant. These are not the erroneous cat vowel that appeared in a raw Groq awkward card.

Both sets' core target IPA is broadly reasonable for an American-English learning card. Spanish-friendly approximations such as ÓK-werd, DRÉI-ning, uent, put óf, and FIU-al are approximate aids, not exact equivalents. For fuel, [Cambridge](https://dictionary.cambridge.org/us/pronunciation/english/fuel) gives /ˈfjuː.əl/: the weak second vowel should not become an emphasized Spanish a. For draining, the attachment's explicit final /ŋ/ guidance is useful; a careful citation-form instruction should not be interpreted as claiming conversational -in' variants never occur.

### 3. The attachment's grammar variation is a strength

Using go, went, gone, and goes among the additional examples is compatible with the supplied prompt's request for useful form/pronunciation variation. The attachment retains went on the front; it does not silently replace the target with a go card. Those forms should not fail a mechanical exact-target-string check on every additional sentence.

Its put off + -ing guidance is supported by [Cambridge's postponement entry](https://dictionary.cambridge.org/dictionary/english/put-off). The project's separable-pronoun guidance complements it. The phrase both forms in the attachment is imprecise: the listed base, past, and participle are three grammatical forms with the same spelling/pronunciation.

The attachment's I have gone there before / I've gone there several times should not be labelled categorically ungrammatical in American English. If the teaching goal is specifically completed visits followed by return, I've been there before is often a clearer example; if the goal is the participle after has, She has gone home avoids distracting nuance.

### 4. Alternatives and translations need context, not literal interchangeability

The prompt allows similar expressions rather than perfect synonyms. Wearing is supported as an adjective meaning tiring by [Collins](https://www.collinsdictionary.com/dictionary/english/wearing). It can be valid while still being a lower teaching priority than exhausting or tiring for this learner.

Likewise, embarrassed and embarrassing describe different roles in a situation: I felt embarrassed versus It was embarrassing. Both can be useful alternatives on an awkward card when that relationship is made clear. Uncomfortable socially is understandable, but socially uncomfortable or uneasy is a more natural list entry. Spanish options such as incómodo, vergonzoso, or torpe socialmente must be selected for the example; they are not interchangeable translations of every occurrence.

Attachment fuel uses a positive motivation context. Project fuel uses arguments/rumors. Impulsar/motivar and drive/encourage fit the former better; alimentar/avivar and feed/add to/intensify fit the latter. This is a contextual difference, not evidence that either figurative use is wrong.

## Evaluation-context boundary

The attachment uses different front sentences for all five targets. Most retain the same broad sense, but they are not the exact P01–P05 evaluation inputs. The motivation-focused fuel card is especially different from the argument-focused P05 case. The attachment also supplies no trace of the original P01 spelling error, which is fine for a standalone finished card but cannot establish that spelling correction worked in the pipeline.

Retain the original input/context and spelling-correction metadata when incorporating improvements into AV-005 candidates. Do not mark unchanged benchmark cases as passed based on cards generated for different contexts. The existing measured Groq results and negative adoption decision remain unchanged.

## Disposition

- Structural requirements: both sets pass the inspected heading/count/forms-presence checks.
- Learning quality: the attachment is a valuable editorial reference, with useful improvements; neither set is accepted wholesale.
- Required candidate revision: remove the went only-for-past-events overstatement. Other proposed changes improve idiomaticity, context, or learner clarity.
- Human acceptance: pending. No audio was evaluated, no card was approved/delivered, and no provider call, commit, or merge occurred for this comparison.

This comparison preserves both input sets and records proposed changes rather than silently modifying prior evidence. A later edited candidate revision should identify which improvements were adopted from the attachment and keep its own before/after record.

Follow-up: the owner emphasized that the full prompt requires strong teaching examples and usage notes, not merely valid structure. [Editorial revision 2](AV-005-cards-for-review-revision-2.md) incorporates that feedback; its [change record](AV-005-edited-candidates-revision-2.json) retains the original revision and new before/after values. [Revision 3](AV-005-cards-for-review-revision-3.md) removed both Spanish-related fields. [Revision 4](AV-005-cards-for-review-revision-4.md) restored pronunciation tips for Spanish speakers written in English. The [current revision 5](AV-005-cards-for-review.md) also restores Spanish Translation following the owner's explicit confirmation to preserve the complete official structure. This comparison remains a record of revision 1, not a fresh review or approval of later revisions.
