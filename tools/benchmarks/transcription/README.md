# Transcription workbench

A local development experiment tool, separate from SkellySpeak conversations and
production routing. Requires Node 24 and the repository's installed dependencies.

From the repository root:

```sh
npm run transcription:lab
```

Open http://127.0.0.1:8771 in a desktop browser with microphone support. Keep the
terminal running. Set `TRANSCRIPTION_LAB_PORT` to use another port. The launcher
loads `server/local.env` when present; exported environment variables take priority.
It uses `ELEVENLABS_API_KEY`, `GROQ_API_KEY` and `OPENAI_API_KEY`. Alternatively,
enter a key under Provider access; it stays in the local server's process memory
until shutdown. Readiness means a key is present, not that authentication is verified.
No keychain, hosted-account or production settings changes are made.

## Collect and compare

1. Select English, Spanish, Arabic or Mandarin. There are 27 Arabic options and
   nine for each other language, with meanings and pronunciation aids. Arabic
   includes emphatic consonants, throat sounds and contrast drills; formal Arabic
   drills are explicitly labeled separately from Levantine phrases. Edit the
   target/meaning/reading aid for your own sentence. The saved take snapshots them.
2. Choose a read-aloud provider and press Listen. OpenRouter uses the existing
   `OPENROUTER_API_KEY` and the app's GPT Audio Mini read-aloud instruction.
   ElevenLabs uses `ELEVENLABS_API_KEY` (environment or Provider access) and
   `ELEVENLABS_VOICE_ID`, defaulting to the same George voice as the server's
   deployment configuration. It sends the same Eleven v3 accent cue and disables
   text normalization. Synthetic pronunciation is a reference, not a guarantee.
   The browser's system voices are no longer used.
   Generated speech plays automatically, with an audio control if autoplay is
   blocked. Normal/slower speed changes playback only. The last 30 phrase/provider/
   variety/voice combinations are cached in server memory; replay through the audio
   control is free of additional API calls. Restart clears the synthesis cache.
   Generation may incur provider charges; it does not run transcription.
3. Record, stop, and listen back. Each take is independently saved. The browser
   requests mono capture without echo cancellation, noise suppression or auto gain;
   reported capture settings are retained. Browser recording is decoded and
   resampled to mono PCM16 at 16 kHz. This capture path is not identical to the
   app's native desktop capture and may include the browser recorder's compression.
4. Correct the scoring reference to what you actually said, if different from the
   target, and add listening notes. The intended target remains intact. Save the
   reference before switching takes; Run and Export also save the current edits.
5. Tell Codex when a batch is ready. Codex runs the model comparisons and analyzes
   the results. You do not need to select or run models. Results refresh automatically
   in the workbench. Manual controls remain collapsed under Advanced comparison
   controls for inspection. The agent runner is:
   `node tools/benchmarks/transcription/compare.ts` (while the lab is running).
   It snapshots active takes, compares six Scribe/Whisper conditions, and skips all
   previously attempted pairs, including failures. No automatic retries.
6. Compare transcripts and diagnostics. CER/WER are reference edit distances,
   not pronunciation scores. Chinese has CER only. Case, punctuation and Arabic
   vowel marks/tatweel are normalized. Han variants and Arabic alternate spellings
   are not silently equated. Insertions can yield errors above 100%. Failed/empty
   responses are shown as failures, not excluded successes or zero-error results.

Run the same short phrase and longer sentence three times in each language.
Preserve hesitations and failed attempts as separate takes. Avoid practicing only
until a particular provider succeeds. First compare forced-language Scribe with
cleaning on/off and Whisper large-v3; then add automatic-language conditions and
other models. Playback plus manual reference review is necessary to distinguish
recognition failure from an unintended spoken word.

## Files and verification

Private recordings/results live outside the repository in
`~/SkellySpeak Recordings/transcription-study/`: canonical WAVs, take manifests and
individual request results. Future recordings use the same directory. Override
with an absolute `TRANSCRIPTION_LAB_DATA_DIR` when needed. Data survives page
reload, server restart and replacement of the checkout.

The launcher imports the old `.local/transcription-workbench/` files once, checks
SHA-256 hashes and leaves the original copy intact. Conflicting files stop import.
New audio and study records receive atomic primary and `recovery/` copies; each
startup creates a verified `snapshots/` copy. These are on the same disk, not an
independent backup against disk failure. Include this folder in your normal backup.
Snapshots accumulate without automatic pruning. Do not edit both the old and new
locations: the external folder is now the active study.

 Each request writes an unknown-outcome receipt before
submission; an interrupted process never silently loses that attempt or retries it.
Exports contain the full manifest, results and base64 WAVs in a portable JSON file.
There is no import UI; original local files remain the resumption source. Exports
contain intentional audio/transcript content and should be shared deliberately.

Provider diagnostics retain bounded allowlisted metadata, IDs, language confidence,
usage, timing and validation stages. Content and free-form error messages are
explicitly removed; unknown field names are listed as omitted. Raw response bodies,
credentials, arbitrary headers and provider URLs are not retained. Actual cost is
unknown unless the provider supplies cost metadata; no cost is inferred from status.

```sh
npm run transcription:check
```

This checks TypeScript, scoring, audio validation, request parity, content/credential
redaction, partial metadata on failure, local API protection, persistence and export.
Tests use provider fixtures, not paid requests. Local server integration tests need
loopback networking. Microphone, listening quality and live provider accuracy need
interactive verification. See the [investigation and options](../../../docs/notes/transcription-workbench-2026-09-21.md).

Read-aloud diagnostics are stored in `*.speech.json` and shown under Speech
 diagnostics. They retain provider/model, request IDs, usage and failure stages,
 while omitting generated speech text/audio from diagnostics. The generated audio
 cache is process-local, separate from durable learner recordings. Groq's current
 TTS models cover English and Saudi Arabic, so they are not used as a four-language
 reference route.

Use Remove beside a saved take to exclude it and its results from the study and
exports. Removed takes remain recoverable under Removed takes → Restore; this
is not permanent disk erasure. Model execution rejects removed takes. Removal
is refused while a provider comparison is in flight to avoid ambiguous ownership.

After comparison, Codex runs `node tools/benchmarks/transcription/report.ts` to
write the current kept-take summary and per-take transcripts to ignored private
`comparison-latest.md` / `.json` files. It uses the first attempt per condition,
shows failures/missing results separately and excludes removed takes. Character
scores compare intended references, not independently verified spoken content.

Character error is not a success percentage, and 100 minus CER is not semantic
accuracy. Exact text matches are secondary diagnostics. Codex's qualitative review
should distinguish acceptable spelling variants, understandable imperfections,
meaning-preserving rewrites, meaning changes and wrong-language/unusable outputs.
Review dialect/wording fidelity separately from communication usefulness. Comparing
written transcripts to intended targets cannot establish what was actually spoken;
that requires listening review, with uncertainty retained.

## Scientific figures

Codex can regenerate private descriptive plots without any provider requests:

```sh
node tools/benchmarks/transcription/export-analysis.ts "$TRANSCRIPTION_LAB_DATA_DIR/figures"
python tools/benchmarks/transcription/plot_analysis.py "$TRANSCRIPTION_LAB_DATA_DIR/figures"
```

Set `TRANSCRIPTION_LAB_DATA_DIR` to the absolute study path first. Plotting requires
Matplotlib and NumPy in an isolated Python environment. The exporter verifies WAV
and result hashes and uses the workbench's scoring implementation. PNG previews,
SVG vector figures, scored JSON and methods notes stay outside Git. Figures show
individual recordings, equal-take means, a shared-scale heatmap, and paired setting
changes. The combined dashboard facets the cohort by language; individual plot generation
requires one language at a time. No confidence intervals, significance claims or semantic
success percentages are inferred from this small, repeated-phrase sample.

Build the interactive dashboard after exporting scored data and reviewing outputs:

```sh
node tools/benchmarks/transcription/dashboard/build.ts "$TRANSCRIPTION_LAB_DATA_DIR/figures/latest"
```

Export to that same directory first. The private `transcript-review.json` ledger
holds explicit assistant judgments, reasons, result IDs, exact reference/output
text, reviewer and review basis. The builder refuses stale or duplicate reviews;
unreviewed results are labeled and cannot silently become ranked failures.
Reviews assess written output against intended messages, not independently
adjudicated speech. Keep ambiguous cases uncertain. Accepted script/spelling
variants must not silently modify the raw CER diagnostic.

The lab serves the self-contained dashboard at `/dashboard/`, linked from the
recorder. Overview ranks message retention, faithful wording or raw CER with
languages weighted equally; language views retain individual take weighting.
Native HTML tables and responsive SVG replace scaled PNGs. Every review cell opens
the actual output and judgment reason. Interactive script execution uses hashes
of the generated script bytes in the response CSP; no external script sources.
Only dashboard HTML and allowlisted chart assets are served, not raw study JSON.
The Python build_dashboard.py command forwards to the TypeScript builder; it
cannot recreate the obsolete raster dashboard. Scientific PNG/SVG exports remain
available through plot_analysis.py as separate exports.

This is a dated snapshot refreshed by Codex after comparisons and review, not an
automatic background run. No production settings change when building/viewing it.
