# Vendored source provenance

These files are third-party code, copied **unmodified**. They are not part of
SkellySpeak and are not covered by SkellySpeak's licence.

## Upstream

- Repository: `https://github.com/yonatanrozin/Modular-Pink-Trombone`
- Reference: `main` at commit `c9b344954b313348595d12faff2595b359e5db0c`
  (last commit 2024-07-24)
- Licence: MIT, Copyright (c) 2023 Yonatan Rozin
  (`LICENSE-Modular-Pink-Trombone.txt`)

The upstream project is itself a derivative of Neil Thapen's **Pink Trombone**
(`https://dood.al/pinktrombone/`, `https://github.com/IMAGINARY/pink-trombone`),
MIT, Copyright 2017 Neil Thapen. Thapen's notice is carried in
`LICENSE-Pink-Trombone-original.txt`. The upstream port already bundles both.

## Files taken

| File | Upstream path | SHA-256 |
| --- | --- | --- |
| `noise.js` | `src/noise.js` | `92259ce60df0651c61264b2e68cdae2ca155736ed2f12bf8a6cd2a878928ac28` |
| `pink_trombone_processor.js` | `src/pink_trombone_processor.js` | `9df9d60e1d0755b9fe101b34b726ce0feff9aaf29e746a409cb158071b0adaad` |
| `pink_trombone_script.js` | `src/pink_trombone_script.js` | `feed3fd1e4ab37f3c21523b5650b6bae5dadc44acd811a8b283f2c368b5618d8` |

Not taken: `Pink_Trombone_Original.html` (the unported original, kept upstream
as a reference), `example/` (superseded by this demo's own `engine.js`), and
`README.md` (upstream prose).

To confirm the copies are still unmodified:

```sh
cd docs/notes/pink-trombone-demo/vendor
sha256sum noise.js pink_trombone_processor.js pink_trombone_script.js
```

## What each file provides

- `noise.js` — a 2D simplex-noise implementation, used by the glottis for
  aspiration. Imported by the processor as an ES module.
- `pink_trombone_processor.js` — the AudioWorklet processors. Registers
  `"glottis"` and `"tract"`; exports `constrain` and `map`.
- `pink_trombone_script.js` — the main-thread `MPT_Voice` class (builds the
  node graph, creates the noise/bandpass sources, exposes a canvas renderer as
  `voice.UI`) plus `TractUI`, which draws the sagittal tract.

## Why these three

`pink_trombone_processor.js` runs inside the audio thread and is registered
through `audioWorklet.addModule`, which takes a URL and therefore must be a
real file on disk. That is why this demo cannot be opened directly from
`file://` — see the note in `../README.md`.
