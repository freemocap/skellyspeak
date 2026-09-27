# Pink Trombone sequencing demo

**Status: spike. Not app behaviour, not integrated, not committed to.**

A standalone page that drives the Pink Trombone vocal tract model through
authored sequences of articulatory targets, to find out whether it can speak on
request. The published exhibit is drag-to-play only — you cannot make it say a
word — so there was no way to judge it from the demo alone.

## What it demonstrates

- A scriptable vocal tract: tongue body/tip, lips, velum, glottis, rendered as a
  sagittal section that reshapes as it speaks.
- Single sounds (`ɑ`, `i`, `u`, `s`, `m`…), minimal-pair contrasts (`s`/`z`,
  `b`/`m`, which differ by exactly one parameter), and short words
  (`mama`, `papa`, `banana`, `sisi`, `wawa`, `haha`).
- Playback from any segment, a live parameter readout, and a tract-speed slider
  that shows how movement speed alone affects intelligibility.

## Running it

An `AudioWorklet` module is loaded by URL and fetched as an ES module, which
browsers block from `file://`. Opening `index.html` directly will fail with a
clear error. Serve it instead:

```sh
cd docs/notes/pink-trombone-demo
python -m http.server 8000
# then open http://localhost:8000/
```

Then press **Enable audio** — the browser requires a user gesture before any
audio starts.

## The point of the split

The synthesizer is free. The mapping from sound to mouth shape is the work, and
this folder is arranged so that the two are visibly separate:

| Path | Role | Cost if adopted |
| --- | --- | --- |
| `vendor/` | Third-party synthesizer, MIT, unmodified | One-time fork |
| `utterances.js` | Articulatory targets, authored by hand | **The ongoing work** |
| `engine.js` | Turns targets into scheduled AudioParam ramps | Small, done |
| `demo.js`, `index.html` | Transport and readout | Throwaway |

`utterances.js` holds 28 shapes and 18 utterances. Every number in it was tuned
by hand and **none of it is validated against a phonetic source.** The vowel
positions are transcribed from the labels the upstream exhibit draws on its own
chart — hand-placed for English, never measured, and visibly approximate (the
exhibit places /æ/ above /e/, which is backwards phonetically). They are a
starting point, not reference data.

That is the real answer to "could we include something wholesale": the renderer
and the acoustic model, yes. The sound-to-shape mapping, no — nobody ships one
that is usable here, and the good reference material is licensed in a way that
prevents reuse (see below).

## What was verified

Measured, in a real browser (headless Edge, HTTP-served, real time — headless
virtual time does not advance the audio clock, so a `--virtual-time-budget`
run cannot measure audio and was not used for this):

- `AudioContext` reaches `running` at 48 kHz and the AudioWorklet loads and
  registers. This was the main unknown; it works over HTTP.
- The tract reports 44 diameter segments and an authored velum value, so the
  processors are running, not just constructed.
- Playing `mama` produced **21 of 49 sampled windows with signal** (peak 0.174,
  roughly 1.3 s of sound against an authored 1.11 s plus release), then silence.
  The fade-out works: neither the gain nor the fricative noise runs on after the
  utterance, which matters because a final `/s/` would otherwise hiss forever.
- Segment tracking, replay-while-fading, and `stop()` were checked against a
  stubbed audio layer: 18 utterances, 1341 scheduled events, all time-ordered.

Two defects were found and fixed during this work, both in `engine.js`:
a pending fade-out from a previous play could cut a replay short, and a
float-precision comparison could schedule a hold event fractionally before an
existing ramp.

## What was NOT verified

- **Whether it sounds like the words.** The measurement above proves sound is
  produced, starts, sustains and stops. It does not prove intelligibility. That
  needs ears on the actual page. Some sequences are much more likely to read
  than others; `haha` and `ŋ` are the least confident.
- Whether it can say arbitrary words. Only the handful authored here have been
  attempted, and they were tuned by ear.
- Any automatic route from text to tract shapes. There is none. Producing shapes
  for real content would need a general articulatory feature source (e.g. the
  MIT-licensed PanPhon dataset maps IPA segments to feature vectors) plus
  grapheme-to-phoneme, rather than hand-authored tables.
- Behaviour inside Tauri's custom protocol. The HTTP requirement above is a
  guess at what Tauri would need to satisfy, not a test of it.
- Any app integration: replacing the vendored renderer with app-styled drawing,
  the per-block `port.postMessage` traffic (roughly 375 messages/second), audio
  device and latency handling, or how this sits beside the existing speech
  playback authority in `ui/src/platform/audio/`.
- Anything about licensing in a distributed build. This repository is AGPL-3.0;
  see below.

## Licensing

- `vendor/` — MIT. Copyright (c) 2023 Yonatan Rozin, itself derived from Neil
  Thapen's Pink Trombone, MIT, Copyright 2017 Neil Thapen. Both notices are in
  `vendor/`. Upstream is
  [yonatanrozin/Modular-Pink-Trombone](https://github.com/yonatanrozin/Modular-Pink-Trombone)
  at `c9b3449`; last upstream commit was 2024-07-24, so the fork is expected
  rather than exceptional. See `vendor/PROVENANCE.md` for checksums.
- MIT and the GPL-3 that this repository's AGPL-3 can absorb are compatible.
  The reference-quality articulatory material found during the survey is not:
  [Seeing Speech](https://seeingspeech.ac.uk/) and
  [eNunciate](https://oer.open.ubc.ca/enunciate/) are CC BY-NC-ND (no
  derivatives, non-commercial, and Seeing Speech additionally forbids AI
  training), and the University of Iowa's *Sounds of Speech* is all rights
  reserved. Those can be linked to, not embedded or adapted.

This demo exists to inform a decision that has not been made. Nothing here has
been reviewed for adoption, and no part of it should be read as a plan.
