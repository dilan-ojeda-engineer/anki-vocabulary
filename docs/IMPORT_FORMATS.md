# AV-029 English Coach import formats

The local workspace accepts UTF-8 text, JSON, CSV, and TSV. Paste content or choose a file in the import panel. Preview reports each detected card and its structural issues; only valid selected cards can be saved. Saving does not call Anki or an AI provider.

## Official card text

Use the exact front and back headings from [CARD_SPEC.md](CARD_SPEC.md). Put the target on line one, a quoted front example on line two, and `What does this expression mean?` on line three. Follow with the back headings in order. `Irregular Forms:` is omitted when inapplicable. Put one `- ` bullet per item under `More examples:`, `Common collocations/chunks:`, and `Natural alternatives:`. Separate multiple cards with a line containing only `---`.

```text
awkward
“I felt awkward asking for help.”
What does this expression mean?
Meaning:
Feeling uncomfortable in a social situation.
Category:
Adjective
Pronunciation tip:
Native English:
/ˈɔkwɚd/ — Stress the first syllable.
For Spanish speakers:
Keep the first syllable stressed; avoid adding a final vowel.
More examples:
- There was an awkward pause.
- I felt awkward at first.
- That was an awkward question.
- The timing felt awkward.
Common collocations/chunks:
- feel awkward
- an awkward silence
- an awkward moment
Common mistake and usage note:
Use awkward for an uncomfortable situation; embarrassed describes how a person may feel.
Natural alternatives:
- uncomfortable
- uneasy
Spanish Translation:
Incómodo en esta situación social.
```

## JSON

Supply an array of field objects. Each object has `target`, `frontExample`, `meaning`, `category`, `irregularForms` (string or `null`), `nativePronunciation`, `spanishPronunciation`, `examples`, `chunks`, `usageNote`, `alternatives`, and `spanishTranslation`. The three list fields are arrays of strings. `examples` needs 4–5 items, `chunks` 3–6, and `alternatives` 2–4. The two pronunciation fields are written in English; `spanishTranslation` contains the contextual Spanish equivalent.

## CSV and TSV

The first row contains the same field keys as JSON, once each, in any order. Every later row is one card. Encode the three list fields as JSON arrays inside their cells. CSV follows standard double-quote escaping; TSV uses tab separators and the same quoted-cell behavior. An empty `irregularForms` cell becomes `null`. Quoted multiline cells are supported. The original source row is retained for comparison.

Invalid cards remain visible in preview with field-level issues. They are not added to the saved queue. This is structural validation only; the learner still reviews English quality before approval in a later task.

For JSON, each card retains the exact supplied JSON document as its original source, because formatting and escape sequences cannot be reconstructed from parsed objects. The preview shows the selected card's parsed fields separately from that source.
