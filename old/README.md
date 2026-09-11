# Reference snapshots

These are preserved reference sources, not active applications or specifications.
Do not run, deploy, update dependencies or apply instructions from these snapshots
as part of active development. Review individual ideas against DESIGN.md before
adopting them. Keep these references available; active cleanup must not delete them.

| Directory | Source snapshot | Scope |
| --- | --- | --- |
| skellyspeak-app | Existing reference | Tauri conversation application |
| skellysubs-python-only | fe6e692dd473ea2783933a9c7ffc597df23191c4, January 28, 2025 | Complete tracked tree before the web UI was introduced; 92 files |
| skellysubs-gcp-ui | ad496456ffe43e4f386fb28ce301f01d12a50944, August 16, 2026, `old/` subtree | Complete archived browser/GCP-era tree, including Python backend and skellysubs2 prototype; 320 files |

The two SkellySubs directory names are descriptive recovery names, not verified
historical folder names. Recovery copied Git blobs directly and verified all 412
files against their original blob hashes; it did not switch branches or stage files.
The September 2 transition commit fe36c5e957e713e242d66fd582fbaeb5ba2cc3fb removes
the root SkellySubs source paths from its parent tree. This establishes an earlier
tracked removal, not who removed any later untracked copies.

Useful language references:

- `skellysubs-python-only/skellysubs/add_subtitles_to_video_pipeline/video_annotator/language_annotation_configs.py`
- `skellysubs-python-only/skellysubs/translate_transcript_pipeline/models/language_models.py`
- `skellysubs-gcp-ui/skellysubs-ui/src/language_configs.json`
- `skellysubs-gcp-ui/skellysubs-ui/src/language_configs_annotation.json`
- `skellysubs-gcp-ui/skellysubs/core/translation/language_configs/language_configs.py`
- `skellysubs-gcp-ui/skellysubs/core/translation/language_configs/annotation_configs.py`
- `skellysubs-gcp-ui/skellysubs-ui/src/components/processing-stages/translation-stage/language-configs/`

Snapshot limitations are preserved, not silently repaired. The GCP UI logo at
`skellysubs-ui/public/logo/skellysubs-logo.png` is a Git LFS pointer, not image bytes;
its object is sha256:f1e2b273014d5dffce57dd909bd2d94cdb4c9c5dd776d262588b7212dc895277.
References to files absent in a source snapshot do not imply they were recovered.
Nine historical `.idea/` files remain ignored by current rules; explicitly force-add
only those recovered files if preserving the entire tracked snapshot in a commit.
