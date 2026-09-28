# Pink Trombone sequencing demo

**Status: spike. Not app behaviour, not integrated, not committed to.**

A standalone page that drives the Pink Trombone vocal tract model through
authored sequences of articulatory targets, to find out whether it can speak on
request. The published exhibit is drag-to-play only — you cannot make it say a
word — so there was no way to judge it from the demo alone.

## What it demonstrates

- A scriptable vocal tract: tongue, lips, velum, glottis, reshaping as it
  speaks.
- Single sounds (`ɑ`, `i`, `u`, `s`, `m`…), minimal-pair contrasts (`s`/`z`,
  `b`/`m`, which differ by exactly one parameter), and short words
  (`mama`, `papa`, `banana`, `sisi`, `wawa`, `haha`).
- Playback from any segment, a live parameter readout, and a tract-speed slider
  that shows how movement speed alone affects intelligibility.
- **Two renderers for the same data.** "Anatomy" draws a side-on head;
  "Model diagram" draws the vendored exhibit's own output. Switching between
  them is the point: the audio is identical, only the picture differs.

## The two renderers

The vendored exhibit draws its 44 tube cross-sections as a fan of spokes around
a pivot. That is an impedance diagram — accurate to the physics, and not a mouth.
`anatomy.js` draws the same 44 numbers as a tongue in a head. That works because
the two are separable: the audio engine's job is to report an area function, and
how you draw an area function is a separate decision.

The trick is the one the "reference palate" articulatory models use. A path is
laid down for the tract roof — posterior pharyngeal wall, soft palate, hard
palate, alveolar ridge, upper lip — resampled to 44 stations, and at each
station the floor is placed at `roof + normal * diameter`. The palate is bone,
so it does not move, and the moving surface falls out of the area function.

**What is honest, and what is scenery.** Modelled by the audio engine, and
therefore real in the picture: the tongue surface, the constriction, the lip
aperture, the velum, and voicing at the glottis. Not modelled, drawn as fixed
decoration: the jaw does not rotate, there is no separate tongue tip and tongue
body, the larynx does not move, and the skull, teeth and nasal cavity are
illustration. This is an interpretation of a one-dimensional tube.

**The illustration is spike quality.** It is drawn from hand-placed points, not
traced from anatomy, and it shows. Doing it properly means tracing a
permissively licensed anatomical plate — see Licensing below.

### Existing options, and why each was not used

There is no permissively licensed, anatomically drawn sagittal animation to
adopt. What exists, and why it does not fit:

| Resource | What it is | Why not |
| --- | --- | --- |
| [Seeing Speech](https://seeingspeech.ac.uk/) (Glasgow) | MRI and ultrasound of every IPA sound, plus 2D midsagittal animations | CC BY-NC-ND: no derivatives, non-commercial, and no AI training |
| [eNunciate](https://oer.open.ubc.ca/enunciate/) (UBC) | Ultrasound overlaid on a face profile, ~91 IPA videos | CC BY-NC-ND, same problem |
| Iowa *Sounds of Speech* | The classic animated sagittal diagrams | All rights reserved, sold as an app |
| Interactive Sagittal Section (D. C. Hall) | Exactly the right look: labelled articulators driven by place, manner and voicing controls | No licence stated, and derived from a textbook figure |
| [VocalTractLab](https://vocaltractlab.de/) | A genuine anatomical sagittal view with 17 control parameters, exportable contours | GPL, so licence-compatible, but a C++ desktop application; its renderer is not separable from it |
| [ArtiSynth](https://github.com/artisynth/artisynth_core) | 3D biomechanical jaw, tongue and larynx | BSD, but a Java 3D research platform |

**The base artwork is a different story.** Two usable sources for a proper
illustration:

- **Gray's Anatomy, 1918** — public domain, no conditions at all. Wikimedia
  Commons has a category of
  [SVG mid-sagittal sections of the human face and neck](https://commons.wikimedia.org/wiki/Category:SVG_mid-sagittal_section_of_the_human_face_and_neck),
  24 files, plus `Sagittalmouth.png` (nose, mouth, pharynx and larynx). A plate
  can be traced into clean vector paths and driven parametrically.
- **OpenStax *Anatomy and Physiology*** — CC BY 4.0, attribution only, which an
  AGPL application can satisfy. Figures 22.4 ("Anatomy of
  Nose-Pharynx-Mouth-Larynx") and 23.7 ("Structures of the Mouth") both show
  the sagittal region with the tongue and palate.

Both are static, so either way the parametric tongue is drawn, not copied. That
is a day of illustration work against a trace, not a research problem.

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
| `anatomy.js` | Draws the tract as a head, from the same diameters | Spike; needs a traced plate to be production art |
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
- Any app integration: the per-block `port.postMessage` traffic (roughly 375
  messages/second), audio device and latency handling, or how this sits beside
  the existing speech playback authority in `ui/src/platform/audio/`.
- Whether the anatomical drawing reads correctly to anyone but its author. It
  was iterated against headless screenshots, not reviewed.
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
