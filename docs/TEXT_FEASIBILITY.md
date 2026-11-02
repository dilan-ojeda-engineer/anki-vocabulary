# AV-005 text-model feasibility

Status: paused as inconclusive by the owner on November 2, 2026. Live execution, raw outputs, manual editorial candidates, and preliminary AI findings are preserved, but no production text provider or generated card set was adopted. Human learning-content review and board acceptance remain pending. Committing or merging this feasibility record does not imply provider adoption or card approval.

## Configuration and prompt provenance

The owner selected Groq / `openai/gpt-oss-120b` and confirmed an available free allowance. After local setup, live requests began November 2, 2026. The process loads the user-scoped `GROQ_API_KEY` without displaying or persisting it.

The [attached prompt archive](prompts/english-coach-user-2026-11-01.txt) is copied unchanged, including the trailing `buy` input. Its SHA256 is `63eef6b800b187708876093c712371470d478bb8d5f6b24c43c02771bbcb10e9`. The earlier archive in [CARD_SPEC.md](CARD_SPEC.md#original-user-prompt) is preserved too.

The owner resolved the conflicting count in favor of **4–5 additional examples**, four by default, on November 1, 2026. Profile/prompt `av005-1` records this choice. The [operational adaptation](prompts/english-coach-av005-1.md) replaces display-format instructions with structured JSON transport and keeps the teaching requirements. The archive's WORD LIST is excluded from the system prompt; exact P01–P05/Q01–Q08 inputs are sent separately. Historical AV-003 fixtures remain unchanged. Audio planning now implies five clips per default card, six if there are five additional examples; no audio is generated in AV-005.

On November 2, 2026, the owner clarified the language requirement and explicitly confirmed that every official section must remain, including Spanish Translation. The current [self-contained prompt av005-5](prompts/english-coach-av005-5.md), profile, and editorial revision 5 therefore use English in all explanations and both pronunciation subsections, with contextual Spanish confined to the required translation field. The earlier v3/v4 section removals and their [revision-3](evidence/AV-005-cards-for-review-revision-3.md)/[revision-4](evidence/AV-005-cards-for-review-revision-4.md) previews remain preserved. The [live v3 evaluation](evidence/AV-005-english-only-review.md) remains historical. A subsequent owner-authorized [live v5 evaluation](evidence/AV-005-v5-review.md) records the current prompt's actual P01–P05 outputs, with teaching defects preserved rather than silently corrected.

[Groq structured-output documentation](https://console.groq.com/docs/structured-outputs) lists strict JSON Schema support for the selected model. The experiment requests `strict: true`, temperature 0.2, low reasoning effort, maximum 4096 completion tokens, no streaming, no tools. Runtime validation is still required; a valid schema does not establish correct meaning, IPA, translation, or naturalness. [Account limits](https://console.groq.com/docs/rate-limits) are organization-specific. The owner's free-allowance confirmation is not an independently verified billing audit.

## Running

Configure `GROQ_API_KEY` only in the local environment. Never paste it in chat, put it in a command literal/history, or commit it. For PowerShell 7, the following reads it without displaying it and makes it available to future processes:

```powershell
$groqCredential = Read-Host 'Groq API key' -MaskInput
[Environment]::SetEnvironmentVariable('GROQ_API_KEY', $groqCredential, 'User')
Remove-Variable groqCredential
```

Use a fresh terminal, or load that user-scoped variable into the current process without printing it. Windows PowerShell 5 users can use `Read-Host -AsSecureString` and their normal secret-management tooling instead.

```powershell
npm run experiment:text
# Offline plan only; no API request and no key required.

# After the owner's allowance confirmation:
node out/text-experiment/text-feasibility.mjs --run --free-allowance-confirmed

# Additional cases, explicitly selected after inspecting the first batch:
node out/text-experiment/text-feasibility.mjs --run --free-allowance-confirmed --cases Q01,Q02,Q03,Q04,Q05,Q06,Q07,Q08

# Explicit comparison model; no automatic fallback:
node out/text-experiment/text-feasibility.mjs --run --free-allowance-confirmed --model qwen/qwen3.8-27b

# Explicit Gemini experiment; requires local GEMINI_API_KEY and confirmed free allowance:
npm run experiment:text -- --provider gemini
node out/text-experiment/text-feasibility.mjs --run --free-allowance-confirmed --provider gemini
```

Requests are sequential with 35 seconds between selected cases by default (`--interval-ms`, integer 0–60000). This pacing was introduced after a real HTTP 429 on the third request; it is not a retry loop. Each stopped run remains intact. The default is now `av005-5`, preserving the official structure, English explanations/pronunciation tips, and contextual Spanish translation. Explicit `--prompt-version av005-4` reproduces the earlier translation removal. Explicit `--prompt-version av005-3` reproduces the earlier removal of both Spanish-related fields. Explicit `--prompt-version av005-1` or `--prompt-version av005-2` reproduces the historical bilingual prompts; v2 includes a separately versioned [refinement](prompts/english-coach-av005-2.md). All versions retain the 4–5 example limits. Historical versions are for explicit reproduction, not the current learning-content policy.

Each live invocation creates a distinct run under ignored `.tools/av005-evidence/<UUID>`. It saves the exact immutable profile/prompt, hashes, model/settings, synthetic inputs, raw completion text, structural findings, request identity, observed token usage, latency, and pending review fields. No edited or approved revision is manufactured. Error bodies/transport exception messages are not logged. Refused/truncated outputs cannot become validated drafts. The runner stops on the first non-completed response, records successful prior items, and makes no automatic retry, repair, provider switch, or paid fallback. A new invocation is a new attempt, not a durable production-job resume.

This backend-only experiment does not expose credentials to React, deliver to Anki, generate audio, render untrusted HTML, or implement production storage/jobs. F01/F02 import behavior and F03 renderer escaping remain outside AV-005; the runner preserves structured target/context data without executing it. F04/F05/F06 and alternate-profile validation have controlled offline coverage. Prompt-injection prevention and linguistic correctness are not established by those checks.

## Actual results and candidate decision

### Gemini configuration

On November 2, 2026, the owner selected Gemini, configured `GEMINI_API_KEY` locally, and reported the associated project's **Free / Free tier** label. This is owner-reported account status, not an independent billing or remaining-quota audit. The explicit `--provider gemini` path uses the native `generateContent` API and fixed `gemini-3.8-flash` model. Google's [pricing page](https://ai.google.dev/gemini-api/docs/pricing) lists free input/output for this candidate; project-specific capacity is separate.

The av005-5 prompt, fixed inputs, canonical profile/schema, and local validation remain unchanged. Gemini uses temperature 0.2, 4096 maximum output tokens, one candidate, and LOW thinking without thought summaries. These native settings are recorded rather than claimed identical to Groq's API semantics. Its documented [JSON Schema subset](https://ai.google.dev/api/generate-content) does not list `minLength`; the transport adapter omits that keyword while retaining canonical nonempty-text validation locally. Both schema hashes and the actual transport schema are retained. Native token counts, including reported thinking tokens, are preserved; counts across providers are not equivalent visible-text measurements. Credentials use the `x-goog-api-key` header, never a URL parameter. No automatic retry or model/provider fallback is added.

The full check passed with **65 unit tests**, including six fake-transport Gemini tests; desktop/experiment builds and Gemini offline planning passed. A separate read-only review found no actionable adapter issues. These checks do not establish live API compatibility or learning quality.

The [actual Gemini run](evidence/AV-005-gemini-run.json), `d9d938d0-532f-4daa-a280-270b97907551`, attempted P01 and returned a sanitized transport error after **120,001.83 ms**. The request reached the configured timeout; no HTTP status, completion, validation result, or token usage was obtained. The runner stopped; P02–P05 were never attempted. There was no automatic retry, fallback, or card editing. A subsequent read-only selected-model metadata request returned HTTP 200 and listed `generateContent`; an unauthenticated service-root probe returned HTTP 404. These establish basic connectivity and metadata access. Whether the timed-out request consumed allowance is unknown.

Two deliberate [minimal generation diagnostics](evidence/AV-005-gemini-diagnostics.json) then removed the card prompt, system instruction, and structured-output schema. Both sent their request bodies successfully and received **HTTP 503** response headers after 2.88 and 5.82 seconds. Google documents 503 as a temporarily overloaded or unavailable service; quota/rate-limit failures use HTTP 429, authentication failures use 401, and access failures use 403. This isolates the observed failure to Gemini generation-service availability rather than demonstrating a defect in the card prompt, schema, API key, model name, or local network. It does not prove that the account has unused quota. One probe and one deliberate follow-up were made; neither produced output or usage, and no automatic retry or fallback was added.

**Gemini decision: generation is currently blocked by observed service unavailability; live learning comparison remains incomplete.** There are no Gemini cards to review. Groq's historical accounting below remains separate; Gemini adds three generation attempts in total (one card request and two minimal diagnostics), zero received completions, two HTTP 503 responses, one client deadline, and unavailable usage. P02–P05 remain unattempted. A later deliberate run may retry after service recovery; the existing evidence is preserved rather than overwritten.

The [raw synthetic evidence](evidence/AV-005-text-feasibility.json) retains exact composed prompts, hashes, settings, inputs, completions, usage, latency, and validation outcomes. Both versions use strict JSON Schema with the same profile-derived 4–5 example constraints.

| Prompt/profile | Hosted attempts | Completed / structurally valid | Reported input / output tokens | Median completed-request latency | Fixed target/forms mismatches |
|---|---|---|---|---|---|
| av005-1 | 14 | 13 / 13 | 41,081 / 6,931 | 1.77 seconds | P04, Q02, Q04 |
| av005-2 | 13 | 13 / 13 | 45,085 / 7,785 | 1.97 seconds | P04, Q02, Q04 |

The first run `71659198-bc13-4538-a8e1-6b5db76570ac` completed P01/P02, then received HTTP 429 for P03 with `retry-after: 2`. P04/P05 were unrun in that stopped run. A deliberate new paced run `b1ffdd3c-c2d7-4d35-9fa4-76c68b1c76cf` completed P03–P05 and Q01–Q08. This is one recorded additional P03 attempt, not an automatic retry; successful P01/P02 were preserved rather than regenerated under v1. The refinement run `13e1cf08-3eb2-4014-bff5-77a5193491fd` completed all 13 cases independently under v2. No selected learning case remains unrun in either version's combined coverage. The paced runs had no further observed quota errors; that is not a guaranteed throughput limit.

There were **27 hosted attempts, 26 completed responses, one rate-limit rejection, zero automatic retries/repair calls, and no provider or paid fallback**. Reported completed-response usage totaled **100,882 tokens** (86,166 input and 14,716 output). Usage for the rejected request was unavailable, so this is not an audited billing total. Request latency excludes the 35-second inter-case pacing; successful-request ranges were 1.41–2.47 seconds (v1) and 1.65–2.69 seconds (v2). No 50-item capacity, daily allowance, or cache-efficiency claim is made.

**Decision: needs changes before adoption.** Real access and structured transport worked, but both versions produced substantive learning defects. The [per-case preliminary learning review](evidence/AV-005-learning-review.md) records meaning, grammar, examples/chunks, pronunciation, Spanish, and register findings separately from structure. In the evaluator's preliminary judgment, none of the five raw core cards in either version is ready to accept unchanged; this is not a human-scored benchmark result. Missing irregular forms persist, v2 retains unfinished `fuel(ed)` examples, and v2 introduces a wrong awkward vowel. Further use needs stronger reference-backed content checks and a renewed provider decision; this experiment did not silently replace the model or run unlimited prompt iterations.

The first editorial revision contained **25 AI-proposed field edits across five cards** and remains preserved in its [original change record](evidence/AV-005-edited-candidates-revision-1.json) and [card preview](evidence/AV-005-cards-for-review-revision-1.md). Following the attachment comparison and the owner's requirement to enforce teaching quality, [editorial revision 2](evidence/AV-005-cards-for-review-revision-2.md) made **38 further field edits** relative to revision 1: richer natural examples, useful tense/form variation, contextual Spanish, clearer pronunciation explanations, and stronger usage patterns. Its [change record](evidence/AV-005-edited-candidates-revision-2.json) is preserved. [Editorial revision 3](evidence/AV-005-cards-for-review-revision-3.md) removed both Spanish-related fields while retaining the English examples and usage improvements. [Editorial revision 4](evidence/AV-005-cards-for-review-revision-4.md) restored five audience-specific pronunciation tips written in English. The current [editorial revision 5](evidence/AV-005-cards-for-review.md) restores the five contextual Spanish translations to follow the full official structure. Its [JSON record](evidence/AV-005-edited-candidates.json) identifies content profile av005-5 and preserves each addition separately from the prior history. Editorial revision numbers are separate from operational prompt versions. All cards remain unapproved with human review pending. These revisions do not establish raw-model quality or an accepted integrated demo; no new hosted run was made for these editorial passes. Q cases retain raw findings rather than fabricated approved revisions.

A subsequent [comparison with five user-attached cards](evidence/AV-005-card-comparison.md) records stronger teaching examples and remaining issues in the original editorial revision. Both comparison sources are preserved unchanged. The latest editorial revision addresses those findings while retaining the evaluation contexts; the attachment remains an editorial reference with unknown model provenance, not a new measured Groq run or accepted answer key.

## Checks and remaining acceptance

### Qwen comparison — rate-limited, incomplete

The owner authorized `qwen/qwen3.8-27b` with unchanged av005-5 prompt, schema, inputs, and request settings. The [comparison report](evidence/AV-005-qwen-comparison.md), [raw run records](evidence/AV-005-qwen-run.json), and [two unedited cards](evidence/AV-005-qwen-raw-cards.md) preserve the actual result. Qwen completed P01/P02, then received HTTP 429 on P03. One deliberate continuation after a 60-second wait also received 429 on P03, so requests stopped. **Four inference attempts, two completions/schema passes, two rate-limit rejections; P04/P05 never attempted.** Failed responses supplied no retry-after value, and the quota/reset cause is unknown from retained evidence.

Reported completed-response usage was **5,199 tokens** (2,371 input, 2,828 output); two-sample median latency was **5.13 seconds**, excluding waits. No paid/provider fallback or automatic retry occurred. The two cards still have learning defects, including incomplete full-target IPA and incorrect rolled/tapped-r guidance. The comparison is incomplete; Qwen is not adopted and no overall winner is declared. The runner's `--model` option is an explicit allowlisted experiment selection; the default remains GPT-OSS for reproduction, not an endorsement.

Across all recorded models/versions, inference accounting now totals **41 attempts, 38 completed responses, three rate-limit rejections, and 126,050 reported completed-response tokens**. This combines accounting only, not equivalent coverage or learning-quality scores. The single read-only models-list request confirming availability is separate from inference counts. Further P03–P05 work requires available account allowance; no unrun case is labelled passed.

### Current v5 live follow-up

Run `6291cd4d-7955-49c3-ad5c-be11605229f7` completed five requests with five valid JSON/profile results, no quota interruption, and no retries/repairs. Reported usage was **7,758 input + 3,104 output = 10,862 tokens**; median request latency was **1.90 seconds** (range 1.72–2.27 seconds, pacing excluded). The [raw record](evidence/AV-005-v5-run.json), [raw card preview](evidence/AV-005-v5-raw-cards.md), and [content review](evidence/AV-005-v5-review.md) remain separate from the manually edited candidates. P04 again omits required irregular forms; other cards contain misleading grammar, usage, or pronunciation guidance. English prose is used in explanatory fields, but quoted Spanish lexical sound examples outside translation still need adjustment to the strict policy. The decision remains **needs changes before adoption**. All five need some correction in the preliminary review; human approval remains pending. Q01–Q08 were unrun under v5.

Across all separately reported versions, usage accounting is now **37 hosted attempts, 36 completed responses, one rate-limit rejection, and 120,851 reported completed-response tokens**. This total combines accounting only, not equivalent learning-case coverage or quality pass rates. The historical totals below remain associated with their original cutoff. No application code changed for this live follow-up; the standalone experiment was rebuilt before execution, and evidence counts/hashes/schema/links were checked separately.

### English-only v3 live follow-up

Run `b5023078-1b58-4564-b8fc-26571f85fe07` completed P01–P05 with **5/5 structurally valid, English-only raw cards**, no rate-limit error, and no automatic retries or repair calls. Reported usage was **6,843 input + 2,264 output = 9,107 tokens**; median request latency was **1.54 seconds** with 35-second inter-case pacing excluded. Target checks passed for all five, while the fixed irregular-form check failed for P04. The [raw record](evidence/AV-005-english-only-run.json), [unedited cards](evidence/AV-005-english-only-raw-cards.md), and [per-case content review](evidence/AV-005-english-only-review.md) preserve the evidence separately from the edited candidate set. All five require some correction in the preliminary review; no human approval is claimed. The candidate decision remains needs changes before adoption. Q01–Q08 were unrun under v3.

Across the three separately reported versions there are now **32 hosted attempts, 31 completed responses, and one rate-limit rejection**. Reported completed-response usage is **109,989 tokens** in total. This accounting combines usage only, not learning-quality pass rates or equivalent case coverage. No new application code changed for the live follow-up, so the prior code-check results below apply; evidence links, hashes, raw profiles, and report counts were checked separately.

Types, zero-warning lint, formatting, **65 unit tests**, desktop build, standalone experiment build, and offline planning passed before the final checkpoint. The tests use fake transport and cover response failures, usage/context handling, strict schema, no-retry quota behavior, target/forms expectations, versioned example counts, the full elapsed-time correction, the exact official heading order, required audience guidance and translation fields, historical versions, explicit comparison-model selection, and the Gemini transport/schema boundary. Direct runtime validation of the five edited candidates also passed. Desktop E2E, production worker/storage integration, real refusal/truncation/authentication failures, pronunciation listening, mobile, audio/delivery, remote CI, and human linguistic acceptance were not performed in AV-005.

The requesting-code-review skill dispatched a separate read-only reviewer. No Critical/Important issue was found. One minor failure-path latency defect was fixed and regression-tested; the reviewer confirmed it and the subsequent pacing/version/expectation checks with no remaining code findings. The final evidence review independently checked run arithmetic, prompt hashes, edit provenance, Markdown field coverage, pending approvals, and absence of credential-shaped text. It found stale provider-selection wording in PROJECT.md; that wording and the related design explanation were corrected. The reviewer made no live calls and is not the human learning reviewer.

The English-only implementation review found no code issues and confirmed the current learning fields/preview, removal history, and historical-version preservation. Its minor finding about stale revision-2 descriptions and the prior test count was corrected in this report. Real av005-3 generation is now recorded for five cases; human learning acceptance remains pending.

The later focused av005-5 implementation review found no issues with restoration of the full official structure, required contextual translation, English pronunciation guidance, candidate addition history, or pending approval status. The default offline plan and all 58 code checks passed. Real v5 generation is now recorded for five cases; human learning acceptance remains pending.

Remaining acceptance is human expectation/card review and the owner's disposition of the candidate decision. No board status has been changed, no human assignment has been claimed accepted, and no card has been approved or sent to Anki.

Use the [evaluation rubric](AI_EVALUATION.md#review-rubric). Preserve raw outputs when editing cards. No generated card is approved by structural validation, and no 50-item capacity claim follows from a five-item run.
