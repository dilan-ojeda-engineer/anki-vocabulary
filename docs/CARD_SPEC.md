# Card content specification

**Version:** 0.6
**Source:** User-supplied English-coach prompt.  
**Status:** Content requirements recorded; front/back boundary and audio placement are proposed interpretations for review.

**Scope:** This document specifies the built-in **English Coach** profile for the first release. It is not a mandatory structure for every future user profile. Custom prompts and card structures are a confirmed future feature; see [AI_GENERATION.md](AI_GENERATION.md#future-custom-prompts-and-card-structures). Preserve this profile and the archived prompt when adding others.

## Content and rendering contract

Teach one vocabulary target in one primary context per note. Preserve context, American English usage, B1–B2 explanation difficulty, and useful B2–C1 nuances. The owner confirmed on November 2, 2026 that the complete official structure must remain, including Spanish Translation. Meanings, examples, usage notes, corrections, and both pronunciation subsections are written in English; contextual Spanish appears only in Spanish Translation. This supersedes the section removals in av005-3/av005-4; archives and recorded runs remain unchanged.

Proposed front:

```text
{word or expression}
“{natural example sentence}”
What does this expression mean?
```

Back headings must appear in this exact order:

1. Meaning:
2. Category:
3. Irregular Forms: — only when the target contains or is based on an irregular verb.
4. Pronunciation tip:
5. Native English:
6. For Spanish speakers:
7. More examples:
8. Common collocations/chunks:
9. Common mistake and usage note:
10. Natural alternatives:
11. Spanish Translation:

`Native English:` and `For Spanish speakers:` are subsections of `Pronunciation tip:`. Both are written in English; the second gives practical English sound guidance for that learner audience, not a translation or Spanish spelling approximation. General American IPA remains required. Use the actual user's content requirements rather than generating prose for these numbered entries.

Provide 4–5 additional examples, 3–6 chunks, and 2–4 alternatives. The default is four additional examples; a fifth is allowed when useful. This owner decision on November 1, 2026 supersedes the earlier 3–4 default for AV-005 onward. Never omit required content merely to fit a shorter card. The original archive below and AV-003 fixtures preserve their historical wording; the newly supplied [prompt archive](prompts/english-coach-user-2026-11-01.txt) is also preserved unchanged, with its conflicts resolved in the [versioned operational adaptation](prompts/english-coach-av005-1.md).

Keep spelling corrections in the app's review area before the card; use the corrected target in the card. Explain an inflected form/base word through the category or existing usage sections. Add a low-priority warning inside the existing usage-note section, without adding a new heading. These placement choices are implementation defaults derived from the user's restrictions on additional sections.

The original prompt contains a teaching specification followed by the final template. The final template supplies the definitive section labels. The trailing empty bullet markers in the original message are preserved below for reference but are not learning content and should not be rendered as empty bullets.

## Structured content and audio

Store target, front example, contextual meaning, category, optional irregular forms, both English-written pronunciation subsections, extra examples, chunks, usage note, alternatives, and contextual Spanish translation as distinct typed fields. Current profile `av005-5` requires `spanishPronunciation` for English-written audience-specific guidance and `spanishTranslation` for the Spanish equivalent. Historical snapshots retain their original fields for reproduction. Keep corrections, input context, prompt/model metadata, approval state, and media references separately from visible learning content.

Use a nullable irregular-forms value in machine output and omit its visible heading when absent. Array length, required text, and rendering order are programmatically checked; pronunciation, naturalness, and semantic accuracy also need human review.

Adapt the prompt's output instructions to a structured transport format for automation. Preserve all learning instructions and render the exact front/back format afterward. Keep the archived user prompt intact; any operational prompt adaptation must have its own recorded version.

Accepted audio behavior for the local web direction:

- Create one clip for the target vocabulary, one for the front example, and one for each additional example. The target may be a word, phrase, expression, or complete target sentence.
- Place each clip beside its corresponding sentence, without adding new learning headings.
- Speak the exact plain-English target or sentence, preserving words and contractions. Remove only display markup and surrounding quotation marks.
- Do not speak definitions, IPA, Spanish approximations, or headings by default.
- Generate only after approval of the exact card revision. Content edits clear approval; regenerate or reuse audio only once the edited revision is approved.
- Verify replay controls and autoplay in Anki's actual desktop/mobile clients. The back must not accidentally replay the front audio through a repeated front template.

This accepted local web requirement supersedes the earlier front/examples-only selection. The current profile code still needs an implementation change to add `target` to its audio selectors. Four additional examples imply six audio placements per default card; a useful fifth example implies seven. Exact duplicate text/configuration may reuse one artifact while retaining each placement association.

Alternative card types, cloze deletion, extra quizzes, rankings, and summaries are outside this specification unless the user explicitly requests them.

## Original user prompt

The following preserves the supplied prompt's wording and order. The contract above makes the application's proposed interpretation explicit; it does not replace the original learning requirements.

```text
You are an English coach helping me consolidate my B1 English level and gradually expand toward B2–C1 vocabulary and natural expressions using Anki flashcards.
I will provide a list of English words, expressions, idioms, phrasal verbs, or conversational chunks.
Your task is to create high-quality Anki flashcards optimized for:
- long-term memory
- speaking fluency
- natural conversational American English
- pronunciation awareness
- contextual learning
- understanding vocabulary as it is actually used by native speakers
- Teach vocabulary in context, not as isolated dictionary definitions.
- Use natural, modern American English.
- Keep the main explanations easy enough for a B1–B2 learner.
- You may introduce B2–C1 nuances when they are useful, but explain them simply.
- Prioritize high-frequency everyday and workplace English.
- Focus on helping me understand and SPEAK naturally.
- Prefer common phrases, collocations, chunks, phrasal verbs, and conversational patterns.
- Avoid unnecessarily academic, outdated, overly formal, or rare vocabulary.
- Keep each card concise enough to review comfortably in Anki.
- Avoid long paragraphs.
- Use realistic examples from daily life, work, conversations, meetings, learning, travel, relationships, etc.
- Do not generate robotic or unnatural examples.
If I misspell a word or expression:
1. Briefly correct the spelling before generating the card.
2. Generate the flashcard using the correct form.
3. Do not create a card for the misspelled form.
Example:
akward → awkward
If I provide an inflected form such as bringing, went, draining, or stuck, explain what form it is and identify the base word when useful.
Example:
bringing
Category: Verb — present participle / gerund form of bring
Some English words and phrasal verbs have many meanings.
When this happens:
- Focus primarily on the meaning suggested by my example or context.
- If no context is provided, choose the most common conversational meaning.
- Mention another important meaning only when it is common enough to prevent confusion.
- Do not overload the card with every dictionary meaning.
If I provide context in parentheses, use that context when creating the card.
Example:
go after (context: go after your dreams)
Focus on the meaning pursue or actively try to achieve something.
Do not change the section names or their order.
{word / expression / phrasal verb}
“{One natural example sentence using the target naturally}”
What does this expression mean?
Meaning:
Give a short, simple explanation of what the word or expression means in this context.
Category:
Identify the grammatical category when applicable.
Examples:
- Noun
- Verb
- Adjective
- Adverb
- Preposition
- Conjunction
- Pronoun
- Interjection
- Phrasal verb
- Idiom
- Expression
- Conversational phrase
- Workplace expression
- Noun phrase
A word may belong to more than one category when appropriate.
Example:
fuel
Category: Noun / Verb
Do not force idioms, phrases, or phrasal verbs into one of the traditional eight parts of speech. Use the most useful linguistic category.
Include this field ONLY if the target contains or is based on an irregular verb.
Format:
Irregular Forms:
base form → past simple → past participle
Example:
go → went → gone
For regular verbs, completely omit this section.
Do not include forms such as:
wash → washed → washed
exfoliate → exfoliated → exfoliated
because they are regular verbs.
Always include these two subsections:
Native English:
- Give the General American IPA pronunciation.
- Explain the most important stress, linking, reduction, or connected-speech feature when useful.
- Focus on how Americans naturally pronounce the word or expression.
For Spanish speakers:
- Give a simple Spanish-friendly pronunciation approximation when useful.
- Explain sounds that may be difficult for a native Spanish speaker.
- Point out important differences between Spanish and English sounds.
- Do not replace accurate pronunciation with Spanish spelling; the approximation is only additional help.
If the target is an irregular verb, pronunciation guidance may also mention an irregular form when that form has a pronunciation learners often struggle with.
Give 3-4 additional natural examples.
The examples must:
- reflect high-frequency, natural American English usage
- sound like something an American English speaker would realistically say
- prioritize the most common meanings and sentence patterns
- use common collocations, chunks, and grammar patterns
- show the target in different realistic contexts
- include contractions when they sound natural
- prefer conversational English over textbook-style English
- avoid unusual, overly formal, literary, or artificial examples
- avoid repeating essentially the same sentence structure
When possible, include a useful mix of contexts such as:
- everyday conversation
- work or meetings
- friends and family
- learning or studying
- common problems or decisions
- opinions, plans, or personal experiences
If one particular construction is especially common among American English speakers, include it in at least one example.
Do not create unusual examples simply for variety. Frequency and naturalness are more important than variety.
Give 3–6 high-value collocations or chunks that will help me use the target naturally when speaking.
Prefer chunks such as:
- put it off
- emotionally draining
- go after your dreams
- circle back to something
- circle back with someone
rather than isolated words.
Explain:
- one important learner mistake, if there is one
- an important grammar pattern
- register when relevant: informal, formal, workplace, slang, etc.
- differences from commonly confused words when useful
Use short examples when they make the distinction clearer.
Example:
draining = describes the thing causing tiredness
drained = describes how a person feels
Do not invent a mistake merely to fill this section. If there is no major mistake, give a useful usage note instead.
Give 2–4 natural alternatives.
The alternatives should have a similar meaning in the target context, but they do not need to be perfect synonyms.
Prefer expressions people actually use in conversation.
Give the most natural Spanish translation for the meaning used on this card.
Do not simply translate the word literally if a different Spanish expression better communicates its meaning.
If the English word has different translations depending on context, include the most relevant ones briefly.
If a target is uncommon, outdated, overly formal, highly specialized, or low priority for everyday English, add a short warning such as:
⚠️ Low priority: This word is uncommon in everyday conversation. A more useful alternative is _____.
Do not remove the card unless I ask you to.
- Follow the exact FRONT/BACK structure above for every card.
- Keep the same section names and order.
- Separate each card clearly using ---.
- Do not add rankings, scores, summaries, vocabulary priority lists, quizzes, or additional sections unless I explicitly request them.
- Do not create a different flashcard format.
- Do not shorten or remove requested fields to save space.
- Do not use dictionary-style definitions.
- Do not include unnecessary linguistic terminology.
- Keep explanations practical and learner-friendly.
- Use American English spelling and usage.
- Use contractions when they sound natural in examples.
- Prefer natural spoken English over textbook English.
- Preserve any context I provide for a word or expression.
{word or expression}
“{natural example sentence}”
What does this expression mean?
Meaning:
{simple contextual meaning}
Category:
{category}
Irregular Forms:
{ONLY include if there is an irregular verb}
Pronunciation tip:
Native English:
{General American IPA + useful natural pronunciation guidance}
For Spanish speakers:
{Spanish-speaker pronunciation guidance}
More examples:
- {example 1}
- {example 2}
- {example 3}
Common collocations/chunks:
- {chunk 1}
- {chunk 2}
- {chunk 3}
- {additional high-value chunks if useful}
Common mistake and usage note:
{concise mistake, grammar pattern, register note, or usage distinction}
Natural alternatives:
- {alternative 1}
- {alternative 2}
- {alternative 3 if useful}
Spanish Translation:
{natural Spanish equivalent for this context}
- 
-
-
```
