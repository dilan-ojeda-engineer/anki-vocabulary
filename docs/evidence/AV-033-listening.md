# AV-033 initial ElevenLabs listening samples

Date: November 3, 2026. The owner selected Sarah for initial use after receiving both samples. Broader voice quality and complete card-audio acceptance remain pending.

The owner selected ElevenLabs first, configured a local replacement key, enabled account read permissions, and authorized continuation with short River and Sarah samples. The subscription endpoint reported tier `free`, usage 0, limit 10000, and allowance extension disabled before generation. The same values were reported immediately afterward; this does not establish that the requests consumed no credits or that accounting had updated.

The account's voice list identified these premade voices as American English:

| Sample | Voice ID | Model | Output | Bytes |
|---|---|---|---|---|
| River | SAz9YHcvj6GT2YYXdXww | eleven_multilingual_v2 | mp3_44100_128 | 115399 |
| Sarah | EXAVITQu4vr4xnSDxMaL | eleven_multilingual_v2 | mp3_44100_128 | 122087 |

Settings for both: stability 0.5, similarity boost 0.75, style 0, speed 1, speaker boost enabled. Voice/model versions were not supplied by the provider and remain unknown.

Text: “This is a pronunciation sample. Please listen for clear American English, natural rhythm, and a comfortable speaking speed.”

Both requests completed through the TypeScript ElevenLabs adapter and artifact cache. MP3 headers and checksums were verified; no human listening or full media-decoder validation is claimed. Local samples and metadata are in the ignored `.tools/av033-listening/` directory, with cached originals in `.tools/av033-listening-cache/`. They are diagnostic voice samples, not approved learning-card audio. No Anki writes occurred.

## Application integration check

The application now connects generation, cached artifacts, per-card associations, and current/previous playback. Controlled checks passed `npm run check` with 102 tests; code review identified retry and duplicate-counting issues that were fixed and re-reviewed.

An isolated workspace at `.tools/av033-browser-smoke` held one disposable, structurally valid card explicitly approved by the test harness. Through the browser UI, the target-only preview reported ElevenLabs, Sarah, `eleven_multilingual_v2`, MP3, one clip, seven characters, and account usage 246/10000. Confirmation generated the target “awkward.” The HTML audio element decoded and played to the end: duration 1.021678 seconds, readyState 4, ended true, error null. After restarting the isolated server and reloading the browser, the saved clip remained complete and played to the end again. This establishes browser decoding/playback, not a human judgment of pronunciation quality. No Anki write or delivery occurred; complete real batches and learning-quality acceptance remain pending.

A separate isolated browser run at `.tools/av033-fake-queue` used two approved fixture cards, a diagnostic WAV provider, and no Anki connection or external speech requests. The whole-list preview showed 2 cards, 12 placements, 283 text characters, and 148 unique uncached characters. Confirmation completed both cards; the provider recorded 7 synthesis calls, with matching text shared across separate placements. Navigating to the second card showed all six placements complete. This verifies browser queue orchestration with fake media, not spoken sentence quality. Queue execution uses bound per-card previews, preserves completed results, stops on relevant quota/configuration failures, and can resume missing work after interruption. Closing the browser does not provide durable background queue execution.
