# Quantified condition comparison

Implemented experiment results, not production acceptance. Mean semantic cosine is averaged equally over within-difficulty pair means, never over mixed levels. Ordering counts ties as half. All cells have ten successful observations; 45 pairs per cell are not independent samples. Sampling settings are listed per condition; default means not supplied. See README for interpretation and caveats.

| Prompt / settings / identity | N | Mean cosine | Worst-level length fit | P(AZ < Beginner) | P(Beginner < Intermediate) |
|---|---:|---:|---:|---:|---:|
| Prompt 1 · Direct / 03 · Temperature · Original prompts · T 0.3 · p default · No persona | 30 | 0.596 | 0% | 82.5% | 100.0% |
| Prompt 1 · Direct / 03 · Temperature · Original prompts · T 0.3 · p default · Persona | 30 | 0.694 | 0% | 86.5% | 100.0% |
| Prompt 1 · Direct / 01 · Baseline · Original prompts · T 0.7 · p default · No persona | 30 | 0.500 | 10% | 81.5% | 100.0% |
| Prompt 1 · Direct / 01 · Baseline · Original prompts · T 0.7 · p default · Persona | 30 | 0.547 | 50% | 93.5% | 100.0% |
| Prompt 1 · Direct / 03 · Temperature · Original prompts · T 1.1 · p default · No persona | 30 | 0.433 | 40% | 90.0% | 100.0% |
| Prompt 1 · Direct / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · No persona | 30 | 0.483 | 10% | 74.5% | 100.0% |
| Prompt 1 · Direct / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · No persona | 30 | 0.474 | 30% | 77.5% | 100.0% |
| Prompt 1 · Direct / 03 · Temperature · Original prompts · T 1.1 · p default · Persona | 30 | 0.534 | 50% | 89.5% | 100.0% |
| Prompt 1 · Direct / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · Persona | 30 | 0.546 | 20% | 94.0% | 100.0% |
| Prompt 1 · Direct / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · Persona | 30 | 0.457 | 40% | 79.0% | 100.0% |
| Prompt 1 · Direct / 02 · Wording · Variety instruction · T 0.7 · p default · No persona | 30 | 0.428 | 20% | 76.0% | 100.0% |
| Prompt 1 · Direct / 02 · Wording · Variety instruction · T 0.7 · p default · Persona | 30 | 0.576 | 10% | 87.5% | 100.0% |
| Prompt 2 · Relationship / 03 · Temperature · Original prompts · T 0.3 · p default · No persona | 30 | 0.731 | 10% | 100.0% | 100.0% |
| Prompt 2 · Relationship / 03 · Temperature · Original prompts · T 0.3 · p default · Persona | 30 | 0.738 | 0% | 100.0% | 100.0% |
| Prompt 2 · Relationship / 01 · Baseline · Original prompts · T 0.7 · p default · No persona | 30 | 0.551 | 20% | 100.0% | 100.0% |
| Prompt 2 · Relationship / 01 · Baseline · Original prompts · T 0.7 · p default · Persona | 30 | 0.498 | 30% | 100.0% | 100.0% |
| Prompt 2 · Relationship / 03 · Temperature · Original prompts · T 1.1 · p default · No persona | 30 | 0.403 | 50% | 98.0% | 98.0% |
| Prompt 2 · Relationship / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · No persona | 30 | 0.396 | 10% | 100.0% | 100.0% |
| Prompt 2 · Relationship / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · No persona | 30 | 0.370 | 30% | 100.0% | 85.0% |
| Prompt 2 · Relationship / 03 · Temperature · Original prompts · T 1.1 · p default · Persona | 30 | 0.399 | 30% | 94.5% | 100.0% |
| Prompt 2 · Relationship / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · Persona | 30 | 0.413 | 30% | 100.0% | 98.5% |
| Prompt 2 · Relationship / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · Persona | 30 | 0.418 | 20% | 100.0% | 99.0% |
| Prompt 2 · Relationship / 02 · Wording · Variety instruction · T 0.7 · p default · No persona | 30 | 0.479 | 30% | 98.0% | 100.0% |
| Prompt 2 · Relationship / 02 · Wording · Variety instruction · T 0.7 · p default · Persona | 30 | 0.434 | 30% | 97.5% | 95.0% |
| Prompt 3 · Contract / 03 · Temperature · Original prompts · T 0.3 · p default · No persona | 30 | 0.615 | 40% | 91.0% | 100.0% |
| Prompt 3 · Contract / 03 · Temperature · Original prompts · T 0.3 · p default · Persona | 30 | 0.659 | 0% | 20.0% | 100.0% |
| Prompt 3 · Contract / 01 · Baseline · Original prompts · T 0.7 · p default · No persona | 30 | 0.452 | 60% | 85.5% | 100.0% |
| Prompt 3 · Contract / 01 · Baseline · Original prompts · T 0.7 · p default · Persona | 30 | 0.480 | 20% | 68.5% | 100.0% |
| Prompt 3 · Contract / 03 · Temperature · Original prompts · T 1.1 · p default · No persona | 30 | 0.433 | 50% | 83.0% | 100.0% |
| Prompt 3 · Contract / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · No persona | 30 | 0.484 | 40% | 70.5% | 98.5% |
| Prompt 3 · Contract / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · No persona | 30 | 0.419 | 60% | 84.0% | 95.0% |
| Prompt 3 · Contract / 03 · Temperature · Original prompts · T 1.1 · p default · Persona | 30 | 0.464 | 60% | 74.0% | 100.0% |
| Prompt 3 · Contract / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · Persona | 30 | 0.512 | 30% | 58.0% | 100.0% |
| Prompt 3 · Contract / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · Persona | 30 | 0.432 | 30% | 70.5% | 100.0% |
| Prompt 3 · Contract / 02 · Wording · Variety instruction · T 0.7 · p default · No persona | 30 | 0.451 | 80% | 93.5% | 100.0% |
| Prompt 3 · Contract / 02 · Wording · Variety instruction · T 0.7 · p default · Persona | 30 | 0.512 | 30% | 52.0% | 100.0% |
| Prompt 4 · Examples / 03 · Temperature · Original prompts · T 0.3 · p default · No persona | 30 | 0.794 | 90% | 100.0% | 100.0% |
| Prompt 4 · Examples / 03 · Temperature · Original prompts · T 0.3 · p default · Persona | 30 | 0.835 | 80% | 100.0% | 100.0% |
| Prompt 4 · Examples / 01 · Baseline · Original prompts · T 0.7 · p default · No persona | 30 | 0.664 | 90% | 95.5% | 100.0% |
| Prompt 4 · Examples / 01 · Baseline · Original prompts · T 0.7 · p default · Persona | 30 | 0.639 | 70% | 97.5% | 100.0% |
| Prompt 4 · Examples / 03 · Temperature · Original prompts · T 1.1 · p default · No persona | 30 | 0.512 | 80% | 87.5% | 100.0% |
| Prompt 4 · Examples / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · No persona | 30 | 0.545 | 80% | 93.0% | 100.0% |
| Prompt 4 · Examples / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · No persona | 30 | 0.442 | 60% | 83.0% | 100.0% |
| Prompt 4 · Examples / 03 · Temperature · Original prompts · T 1.1 · p default · Persona | 30 | 0.464 | 80% | 88.0% | 100.0% |
| Prompt 4 · Examples / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · Persona | 30 | 0.542 | 70% | 100.0% | 100.0% |
| Prompt 4 · Examples / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · Persona | 30 | 0.527 | 70% | 96.0% | 100.0% |
| Prompt 4 · Examples / 02 · Wording · Variety instruction · T 0.7 · p default · No persona | 30 | 0.596 | 50% | 96.5% | 100.0% |
| Prompt 4 · Examples / 02 · Wording · Variety instruction · T 0.7 · p default · Persona | 30 | 0.632 | 90% | 96.5% | 100.0% |

## Detailed cells

| Condition / level | N | Mean words | In target | Unique text | Words/sentence | Letters/word | Cosine | Exact-pair collision | Opening-pair collision |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Prompt 1 · Direct / 03 · Temperature · Original prompts · T 0.3 · p default · No persona / Absolute Zero | 10 | 8.00 | 0% | 7 | 4.00 | 3.57 | 0.535 | 8.9% | 46.7% |
| Prompt 1 · Direct / 03 · Temperature · Original prompts · T 0.3 · p default · No persona / Beginner | 10 | 9.80 | 100% | 4 | 4.90 | 3.80 | 0.753 | 35.6% | 100.0% |
| Prompt 1 · Direct / 03 · Temperature · Original prompts · T 0.3 · p default · No persona / Intermediate | 10 | 25.90 | 20% | 10 | 8.93 | 4.65 | 0.501 | 0.0% | 100.0% |
| Prompt 1 · Direct / 03 · Temperature · Original prompts · T 0.3 · p default · Persona / Absolute Zero | 10 | 6.90 | 0% | 2 | 3.45 | 3.08 | 0.953 | 80.0% | 100.0% |
| Prompt 1 · Direct / 03 · Temperature · Original prompts · T 0.3 · p default · Persona / Beginner | 10 | 9.60 | 100% | 3 | 4.80 | 3.96 | 0.585 | 31.1% | 53.3% |
| Prompt 1 · Direct / 03 · Temperature · Original prompts · T 0.3 · p default · Persona / Intermediate | 10 | 19.40 | 80% | 9 | 8.10 | 4.62 | 0.546 | 2.2% | 100.0% |
| Prompt 1 · Direct / 01 · Baseline · Original prompts · T 0.7 · p default · No persona / Absolute Zero | 10 | 7.40 | 10% | 9 | 3.23 | 3.50 | 0.478 | 2.2% | 15.6% |
| Prompt 1 · Direct / 01 · Baseline · Original prompts · T 0.7 · p default · No persona / Beginner | 10 | 8.70 | 100% | 8 | 4.35 | 3.83 | 0.639 | 6.7% | 62.2% |
| Prompt 1 · Direct / 01 · Baseline · Original prompts · T 0.7 · p default · No persona / Intermediate | 10 | 23.00 | 40% | 10 | 9.32 | 4.43 | 0.382 | 0.0% | 100.0% |
| Prompt 1 · Direct / 01 · Baseline · Original prompts · T 0.7 · p default · Persona / Absolute Zero | 10 | 5.30 | 60% | 8 | 2.65 | 4.01 | 0.627 | 6.7% | 35.6% |
| Prompt 1 · Direct / 01 · Baseline · Original prompts · T 0.7 · p default · Persona / Beginner | 10 | 8.30 | 100% | 9 | 4.55 | 3.86 | 0.529 | 2.2% | 40.0% |
| Prompt 1 · Direct / 01 · Baseline · Original prompts · T 0.7 · p default · Persona / Intermediate | 10 | 22.90 | 50% | 10 | 9.67 | 4.68 | 0.484 | 0.0% | 80.0% |
| Prompt 1 · Direct / 03 · Temperature · Original prompts · T 1.1 · p default · No persona / Absolute Zero | 10 | 6.10 | 40% | 10 | 2.95 | 4.17 | 0.419 | 0.0% | 11.1% |
| Prompt 1 · Direct / 03 · Temperature · Original prompts · T 1.1 · p default · No persona / Beginner | 10 | 8.80 | 90% | 10 | 4.40 | 3.85 | 0.504 | 0.0% | 24.4% |
| Prompt 1 · Direct / 03 · Temperature · Original prompts · T 1.1 · p default · No persona / Intermediate | 10 | 22.00 | 70% | 10 | 8.97 | 4.63 | 0.375 | 0.0% | 13.3% |
| Prompt 1 · Direct / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · No persona / Absolute Zero | 10 | 7.90 | 10% | 10 | 3.70 | 3.87 | 0.423 | 0.0% | 13.3% |
| Prompt 1 · Direct / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · No persona / Beginner | 10 | 9.40 | 90% | 7 | 4.70 | 3.84 | 0.642 | 8.9% | 62.2% |
| Prompt 1 · Direct / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · No persona / Intermediate | 10 | 23.30 | 30% | 10 | 9.37 | 4.37 | 0.384 | 0.0% | 15.6% |
| Prompt 1 · Direct / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · No persona / Absolute Zero | 10 | 7.10 | 30% | 9 | 3.65 | 3.96 | 0.574 | 2.2% | 46.7% |
| Prompt 1 · Direct / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · No persona / Beginner | 10 | 9.20 | 90% | 10 | 4.60 | 3.91 | 0.490 | 0.0% | 24.4% |
| Prompt 1 · Direct / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · No persona / Intermediate | 10 | 22.40 | 50% | 10 | 8.53 | 4.45 | 0.358 | 0.0% | 22.2% |
| Prompt 1 · Direct / 03 · Temperature · Original prompts · T 1.1 · p default · Persona / Absolute Zero | 10 | 5.30 | 60% | 9 | 2.85 | 3.66 | 0.700 | 2.2% | 46.7% |
| Prompt 1 · Direct / 03 · Temperature · Original prompts · T 1.1 · p default · Persona / Beginner | 10 | 7.90 | 90% | 10 | 3.95 | 4.17 | 0.475 | 0.0% | 33.3% |
| Prompt 1 · Direct / 03 · Temperature · Original prompts · T 1.1 · p default · Persona / Intermediate | 10 | 25.40 | 50% | 10 | 10.23 | 4.37 | 0.427 | 0.0% | 22.2% |
| Prompt 1 · Direct / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · Persona / Absolute Zero | 10 | 6.10 | 40% | 10 | 3.05 | 3.54 | 0.557 | 0.0% | 17.8% |
| Prompt 1 · Direct / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · Persona / Beginner | 10 | 9.50 | 100% | 9 | 4.75 | 4.17 | 0.540 | 2.2% | 46.7% |
| Prompt 1 · Direct / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · Persona / Intermediate | 10 | 26.10 | 20% | 10 | 10.75 | 4.44 | 0.541 | 0.0% | 100.0% |
| Prompt 1 · Direct / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · Persona / Absolute Zero | 10 | 5.90 | 40% | 10 | 2.90 | 4.07 | 0.504 | 0.0% | 24.4% |
| Prompt 1 · Direct / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · Persona / Beginner | 10 | 8.00 | 90% | 10 | 4.00 | 4.16 | 0.454 | 0.0% | 20.0% |
| Prompt 1 · Direct / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · Persona / Intermediate | 10 | 20.40 | 80% | 10 | 8.48 | 4.61 | 0.412 | 0.0% | 22.2% |
| Prompt 1 · Direct / 02 · Wording · Variety instruction · T 0.7 · p default · No persona / Absolute Zero | 10 | 8.00 | 20% | 9 | 3.58 | 3.90 | 0.432 | 2.2% | 15.6% |
| Prompt 1 · Direct / 02 · Wording · Variety instruction · T 0.7 · p default · No persona / Beginner | 10 | 9.80 | 80% | 10 | 4.90 | 4.26 | 0.476 | 0.0% | 46.7% |
| Prompt 1 · Direct / 02 · Wording · Variety instruction · T 0.7 · p default · No persona / Intermediate | 10 | 24.90 | 40% | 10 | 8.70 | 4.23 | 0.377 | 0.0% | 28.9% |
| Prompt 1 · Direct / 02 · Wording · Variety instruction · T 0.7 · p default · Persona / Absolute Zero | 10 | 6.90 | 10% | 4 | 3.45 | 3.22 | 0.765 | 46.7% | 80.0% |
| Prompt 1 · Direct / 02 · Wording · Variety instruction · T 0.7 · p default · Persona / Beginner | 10 | 9.10 | 100% | 9 | 4.55 | 4.24 | 0.565 | 2.2% | 46.7% |
| Prompt 1 · Direct / 02 · Wording · Variety instruction · T 0.7 · p default · Persona / Intermediate | 10 | 23.80 | 60% | 10 | 10.42 | 4.52 | 0.398 | 0.0% | 33.3% |
| Prompt 2 · Relationship / 03 · Temperature · Original prompts · T 0.3 · p default · No persona / Absolute Zero | 10 | 5.30 | 80% | 4 | 4.55 | 3.10 | 0.824 | 35.6% | 48.9% |
| Prompt 2 · Relationship / 03 · Temperature · Original prompts · T 0.3 · p default · No persona / Beginner | 10 | 12.70 | 10% | 5 | 6.35 | 3.68 | 0.840 | 17.8% | 100.0% |
| Prompt 2 · Relationship / 03 · Temperature · Original prompts · T 0.3 · p default · No persona / Intermediate | 10 | 25.30 | 30% | 10 | 12.30 | 3.75 | 0.530 | 0.0% | 80.0% |
| Prompt 2 · Relationship / 03 · Temperature · Original prompts · T 0.3 · p default · Persona / Absolute Zero | 10 | 4.90 | 100% | 4 | 4.65 | 3.23 | 0.719 | 46.7% | 46.7% |
| Prompt 2 · Relationship / 03 · Temperature · Original prompts · T 0.3 · p default · Persona / Beginner | 10 | 13.80 | 0% | 6 | 6.58 | 3.67 | 0.686 | 15.6% | 100.0% |
| Prompt 2 · Relationship / 03 · Temperature · Original prompts · T 0.3 · p default · Persona / Intermediate | 10 | 27.50 | 0% | 8 | 9.17 | 3.85 | 0.808 | 4.4% | 80.0% |
| Prompt 2 · Relationship / 01 · Baseline · Original prompts · T 0.7 · p default · No persona / Absolute Zero | 10 | 5.40 | 60% | 8 | 3.80 | 3.20 | 0.694 | 6.7% | 35.6% |
| Prompt 2 · Relationship / 01 · Baseline · Original prompts · T 0.7 · p default · No persona / Beginner | 10 | 12.50 | 20% | 10 | 6.25 | 3.75 | 0.546 | 0.0% | 44.4% |
| Prompt 2 · Relationship / 01 · Baseline · Original prompts · T 0.7 · p default · No persona / Intermediate | 10 | 22.10 | 80% | 10 | 10.52 | 4.15 | 0.412 | 0.0% | 8.9% |
| Prompt 2 · Relationship / 01 · Baseline · Original prompts · T 0.7 · p default · Persona / Absolute Zero | 10 | 4.60 | 80% | 8 | 3.50 | 3.35 | 0.556 | 6.7% | 8.9% |
| Prompt 2 · Relationship / 01 · Baseline · Original prompts · T 0.7 · p default · Persona / Beginner | 10 | 12.80 | 30% | 10 | 6.40 | 3.95 | 0.519 | 0.0% | 62.2% |
| Prompt 2 · Relationship / 01 · Baseline · Original prompts · T 0.7 · p default · Persona / Intermediate | 10 | 23.70 | 50% | 10 | 11.27 | 4.12 | 0.419 | 0.0% | 15.6% |
| Prompt 2 · Relationship / 03 · Temperature · Original prompts · T 1.1 · p default · No persona / Absolute Zero | 10 | 5.00 | 70% | 10 | 3.00 | 3.56 | 0.466 | 0.0% | 8.9% |
| Prompt 2 · Relationship / 03 · Temperature · Original prompts · T 1.1 · p default · No persona / Beginner | 10 | 11.90 | 50% | 10 | 5.72 | 3.99 | 0.364 | 0.0% | 0.0% |
| Prompt 2 · Relationship / 03 · Temperature · Original prompts · T 1.1 · p default · No persona / Intermediate | 10 | 22.90 | 50% | 10 | 10.97 | 4.14 | 0.380 | 0.0% | 4.4% |
| Prompt 2 · Relationship / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · No persona / Absolute Zero | 10 | 5.20 | 50% | 9 | 3.15 | 3.50 | 0.391 | 2.2% | 4.4% |
| Prompt 2 · Relationship / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · No persona / Beginner | 10 | 13.40 | 10% | 10 | 5.92 | 3.82 | 0.380 | 0.0% | 4.4% |
| Prompt 2 · Relationship / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · No persona / Intermediate | 10 | 23.50 | 50% | 10 | 9.72 | 3.92 | 0.416 | 0.0% | 4.4% |
| Prompt 2 · Relationship / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · No persona / Absolute Zero | 10 | 4.20 | 90% | 10 | 2.85 | 3.65 | 0.375 | 0.0% | 2.2% |
| Prompt 2 · Relationship / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · No persona / Beginner | 10 | 14.60 | 30% | 10 | 6.93 | 4.00 | 0.402 | 0.0% | 8.9% |
| Prompt 2 · Relationship / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · No persona / Intermediate | 10 | 22.10 | 60% | 10 | 10.12 | 4.09 | 0.333 | 0.0% | 6.7% |
| Prompt 2 · Relationship / 03 · Temperature · Original prompts · T 1.1 · p default · Persona / Absolute Zero | 10 | 6.40 | 60% | 10 | 3.82 | 3.54 | 0.383 | 0.0% | 0.0% |
| Prompt 2 · Relationship / 03 · Temperature · Original prompts · T 1.1 · p default · Persona / Beginner | 10 | 13.00 | 30% | 10 | 6.50 | 4.06 | 0.467 | 0.0% | 46.7% |
| Prompt 2 · Relationship / 03 · Temperature · Original prompts · T 1.1 · p default · Persona / Intermediate | 10 | 22.50 | 80% | 10 | 11.10 | 4.03 | 0.347 | 0.0% | 4.4% |
| Prompt 2 · Relationship / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · Persona / Absolute Zero | 10 | 5.50 | 60% | 9 | 3.70 | 3.54 | 0.441 | 2.2% | 8.9% |
| Prompt 2 · Relationship / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · Persona / Beginner | 10 | 12.90 | 30% | 10 | 6.45 | 3.97 | 0.419 | 0.0% | 22.2% |
| Prompt 2 · Relationship / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · Persona / Intermediate | 10 | 25.00 | 60% | 10 | 10.92 | 4.09 | 0.380 | 0.0% | 22.2% |
| Prompt 2 · Relationship / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · Persona / Absolute Zero | 10 | 6.00 | 30% | 10 | 3.55 | 3.68 | 0.400 | 0.0% | 0.0% |
| Prompt 2 · Relationship / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · Persona / Beginner | 10 | 13.80 | 20% | 10 | 6.65 | 3.88 | 0.446 | 0.0% | 6.7% |
| Prompt 2 · Relationship / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · Persona / Intermediate | 10 | 24.10 | 40% | 10 | 10.70 | 3.93 | 0.407 | 0.0% | 2.2% |
| Prompt 2 · Relationship / 02 · Wording · Variety instruction · T 0.7 · p default · No persona / Absolute Zero | 10 | 6.50 | 50% | 8 | 4.60 | 3.17 | 0.457 | 4.4% | 20.0% |
| Prompt 2 · Relationship / 02 · Wording · Variety instruction · T 0.7 · p default · No persona / Beginner | 10 | 11.80 | 40% | 8 | 5.90 | 3.93 | 0.560 | 6.7% | 33.3% |
| Prompt 2 · Relationship / 02 · Wording · Variety instruction · T 0.7 · p default · No persona / Intermediate | 10 | 25.90 | 30% | 10 | 11.28 | 3.90 | 0.421 | 0.0% | 28.9% |
| Prompt 2 · Relationship / 02 · Wording · Variety instruction · T 0.7 · p default · Persona / Absolute Zero | 10 | 6.60 | 30% | 10 | 4.05 | 3.79 | 0.385 | 0.0% | 6.7% |
| Prompt 2 · Relationship / 02 · Wording · Variety instruction · T 0.7 · p default · Persona / Beginner | 10 | 14.70 | 30% | 10 | 7.02 | 4.02 | 0.439 | 0.0% | 33.3% |
| Prompt 2 · Relationship / 02 · Wording · Variety instruction · T 0.7 · p default · Persona / Intermediate | 10 | 24.20 | 50% | 10 | 9.97 | 3.99 | 0.478 | 0.0% | 20.0% |
| Prompt 3 · Contract / 03 · Temperature · Original prompts · T 0.3 · p default · No persona / Absolute Zero | 10 | 5.20 | 40% | 5 | 2.60 | 4.25 | 0.532 | 20.0% | 26.7% |
| Prompt 3 · Contract / 03 · Temperature · Original prompts · T 0.3 · p default · No persona / Beginner | 10 | 6.70 | 100% | 4 | 3.35 | 3.97 | 0.825 | 35.6% | 62.2% |
| Prompt 3 · Contract / 03 · Temperature · Original prompts · T 0.3 · p default · No persona / Intermediate | 10 | 16.80 | 100% | 8 | 8.40 | 4.27 | 0.489 | 4.4% | 40.0% |
| Prompt 3 · Contract / 03 · Temperature · Original prompts · T 0.3 · p default · Persona / Absolute Zero | 10 | 8.80 | 0% | 6 | 3.27 | 4.42 | 0.642 | 15.6% | 26.7% |
| Prompt 3 · Contract / 03 · Temperature · Original prompts · T 0.3 · p default · Persona / Beginner | 10 | 7.00 | 90% | 4 | 3.50 | 3.95 | 0.821 | 35.6% | 100.0% |
| Prompt 3 · Contract / 03 · Temperature · Original prompts · T 0.3 · p default · Persona / Intermediate | 10 | 21.80 | 70% | 10 | 8.27 | 4.40 | 0.514 | 0.0% | 53.3% |
| Prompt 3 · Contract / 01 · Baseline · Original prompts · T 0.7 · p default · No persona / Absolute Zero | 10 | 4.60 | 60% | 9 | 2.40 | 4.32 | 0.430 | 2.2% | 4.4% |
| Prompt 3 · Contract / 01 · Baseline · Original prompts · T 0.7 · p default · No persona / Beginner | 10 | 6.50 | 90% | 8 | 3.25 | 4.30 | 0.546 | 6.7% | 22.2% |
| Prompt 3 · Contract / 01 · Baseline · Original prompts · T 0.7 · p default · No persona / Intermediate | 10 | 18.30 | 70% | 10 | 7.87 | 4.19 | 0.379 | 0.0% | 8.9% |
| Prompt 3 · Contract / 01 · Baseline · Original prompts · T 0.7 · p default · Persona / Absolute Zero | 10 | 6.70 | 20% | 10 | 3.18 | 4.38 | 0.455 | 0.0% | 6.7% |
| Prompt 3 · Contract / 01 · Baseline · Original prompts · T 0.7 · p default · Persona / Beginner | 10 | 8.40 | 80% | 9 | 3.80 | 4.20 | 0.503 | 2.2% | 8.9% |
| Prompt 3 · Contract / 01 · Baseline · Original prompts · T 0.7 · p default · Persona / Intermediate | 10 | 22.40 | 80% | 10 | 8.45 | 4.47 | 0.481 | 0.0% | 13.3% |
| Prompt 3 · Contract / 03 · Temperature · Original prompts · T 1.1 · p default · No persona / Absolute Zero | 10 | 5.10 | 50% | 10 | 2.70 | 4.35 | 0.373 | 0.0% | 0.0% |
| Prompt 3 · Contract / 03 · Temperature · Original prompts · T 1.1 · p default · No persona / Beginner | 10 | 6.60 | 80% | 10 | 3.55 | 4.01 | 0.570 | 0.0% | 24.4% |
| Prompt 3 · Contract / 03 · Temperature · Original prompts · T 1.1 · p default · No persona / Intermediate | 10 | 19.30 | 80% | 10 | 9.15 | 4.14 | 0.358 | 0.0% | 0.0% |
| Prompt 3 · Contract / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · No persona / Absolute Zero | 10 | 5.50 | 40% | 9 | 2.75 | 4.29 | 0.429 | 2.2% | 6.7% |
| Prompt 3 · Contract / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · No persona / Beginner | 10 | 6.50 | 90% | 8 | 3.25 | 4.07 | 0.600 | 4.4% | 33.3% |
| Prompt 3 · Contract / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · No persona / Intermediate | 10 | 18.40 | 50% | 10 | 8.33 | 4.18 | 0.423 | 0.0% | 2.2% |
| Prompt 3 · Contract / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · No persona / Absolute Zero | 10 | 5.50 | 60% | 10 | 2.75 | 4.17 | 0.416 | 0.0% | 2.2% |
| Prompt 3 · Contract / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · No persona / Beginner | 10 | 8.10 | 70% | 9 | 3.85 | 4.33 | 0.449 | 2.2% | 6.7% |
| Prompt 3 · Contract / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · No persona / Intermediate | 10 | 15.70 | 70% | 10 | 6.28 | 4.25 | 0.392 | 0.0% | 2.2% |
| Prompt 3 · Contract / 03 · Temperature · Original prompts · T 1.1 · p default · Persona / Absolute Zero | 10 | 7.10 | 60% | 10 | 2.75 | 4.55 | 0.435 | 0.0% | 2.2% |
| Prompt 3 · Contract / 03 · Temperature · Original prompts · T 1.1 · p default · Persona / Beginner | 10 | 7.50 | 80% | 10 | 3.90 | 4.83 | 0.521 | 0.0% | 13.3% |
| Prompt 3 · Contract / 03 · Temperature · Original prompts · T 1.1 · p default · Persona / Intermediate | 10 | 21.00 | 80% | 10 | 8.80 | 4.17 | 0.436 | 0.0% | 4.4% |
| Prompt 3 · Contract / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · Persona / Absolute Zero | 10 | 6.30 | 30% | 10 | 3.00 | 4.03 | 0.477 | 0.0% | 6.7% |
| Prompt 3 · Contract / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · Persona / Beginner | 10 | 6.80 | 70% | 8 | 3.40 | 4.35 | 0.608 | 6.7% | 48.9% |
| Prompt 3 · Contract / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · Persona / Intermediate | 10 | 21.50 | 70% | 10 | 9.18 | 4.36 | 0.452 | 0.0% | 13.3% |
| Prompt 3 · Contract / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · Persona / Absolute Zero | 10 | 6.80 | 30% | 10 | 3.20 | 4.50 | 0.410 | 0.0% | 2.2% |
| Prompt 3 · Contract / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · Persona / Beginner | 10 | 8.00 | 90% | 10 | 3.87 | 4.39 | 0.427 | 0.0% | 8.9% |
| Prompt 3 · Contract / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · Persona / Intermediate | 10 | 20.80 | 80% | 10 | 9.15 | 4.40 | 0.460 | 0.0% | 2.2% |
| Prompt 3 · Contract / 02 · Wording · Variety instruction · T 0.7 · p default · No persona / Absolute Zero | 10 | 4.50 | 80% | 9 | 2.75 | 3.63 | 0.425 | 2.2% | 2.2% |
| Prompt 3 · Contract / 02 · Wording · Variety instruction · T 0.7 · p default · No persona / Beginner | 10 | 6.90 | 90% | 8 | 3.70 | 3.81 | 0.541 | 6.7% | 28.9% |
| Prompt 3 · Contract / 02 · Wording · Variety instruction · T 0.7 · p default · No persona / Intermediate | 10 | 20.20 | 80% | 10 | 10.33 | 4.20 | 0.387 | 0.0% | 2.2% |
| Prompt 3 · Contract / 02 · Wording · Variety instruction · T 0.7 · p default · Persona / Absolute Zero | 10 | 7.20 | 30% | 10 | 3.17 | 3.96 | 0.483 | 0.0% | 13.3% |
| Prompt 3 · Contract / 02 · Wording · Variety instruction · T 0.7 · p default · Persona / Beginner | 10 | 6.90 | 80% | 9 | 3.45 | 4.34 | 0.619 | 2.2% | 62.2% |
| Prompt 3 · Contract / 02 · Wording · Variety instruction · T 0.7 · p default · Persona / Intermediate | 10 | 21.10 | 80% | 10 | 8.23 | 4.19 | 0.432 | 0.0% | 2.2% |
| Prompt 4 · Examples / 03 · Temperature · Original prompts · T 0.3 · p default · No persona / Absolute Zero | 10 | 4.00 | 100% | 1 | 2.00 | 4.25 | 1.000 | 100.0% | 100.0% |
| Prompt 4 · Examples / 03 · Temperature · Original prompts · T 0.3 · p default · No persona / Beginner | 10 | 6.00 | 100% | 2 | 3.00 | 3.90 | 0.899 | 46.7% | 100.0% |
| Prompt 4 · Examples / 03 · Temperature · Original prompts · T 0.3 · p default · No persona / Intermediate | 10 | 21.00 | 90% | 9 | 7.32 | 4.25 | 0.482 | 2.2% | 80.0% |
| Prompt 4 · Examples / 03 · Temperature · Original prompts · T 0.3 · p default · Persona / Absolute Zero | 10 | 4.60 | 100% | 3 | 2.30 | 4.05 | 0.954 | 40.0% | 100.0% |
| Prompt 4 · Examples / 03 · Temperature · Original prompts · T 0.3 · p default · Persona / Beginner | 10 | 6.00 | 100% | 1 | 3.00 | 3.83 | 1.000 | 100.0% | 100.0% |
| Prompt 4 · Examples / 03 · Temperature · Original prompts · T 0.3 · p default · Persona / Intermediate | 10 | 22.10 | 80% | 10 | 9.62 | 4.01 | 0.553 | 0.0% | 80.0% |
| Prompt 4 · Examples / 01 · Baseline · Original prompts · T 0.7 · p default · No persona / Absolute Zero | 10 | 4.10 | 90% | 5 | 2.05 | 4.40 | 0.714 | 33.3% | 46.7% |
| Prompt 4 · Examples / 01 · Baseline · Original prompts · T 0.7 · p default · No persona / Beginner | 10 | 6.10 | 100% | 4 | 3.05 | 3.88 | 0.811 | 35.6% | 80.0% |
| Prompt 4 · Examples / 01 · Baseline · Original prompts · T 0.7 · p default · No persona / Intermediate | 10 | 19.30 | 90% | 10 | 6.92 | 4.44 | 0.466 | 0.0% | 24.4% |
| Prompt 4 · Examples / 01 · Baseline · Original prompts · T 0.7 · p default · Persona / Absolute Zero | 10 | 4.70 | 90% | 5 | 2.35 | 4.04 | 0.745 | 20.0% | 62.2% |
| Prompt 4 · Examples / 01 · Baseline · Original prompts · T 0.7 · p default · Persona / Beginner | 10 | 6.50 | 100% | 6 | 3.25 | 3.95 | 0.707 | 13.3% | 100.0% |
| Prompt 4 · Examples / 01 · Baseline · Original prompts · T 0.7 · p default · Persona / Intermediate | 10 | 22.70 | 70% | 10 | 8.63 | 4.11 | 0.465 | 0.0% | 28.9% |
| Prompt 4 · Examples / 03 · Temperature · Original prompts · T 1.1 · p default · No persona / Absolute Zero | 10 | 4.50 | 90% | 9 | 2.25 | 4.25 | 0.464 | 2.2% | 2.2% |
| Prompt 4 · Examples / 03 · Temperature · Original prompts · T 1.1 · p default · No persona / Beginner | 10 | 5.90 | 80% | 7 | 2.95 | 4.14 | 0.630 | 13.3% | 46.7% |
| Prompt 4 · Examples / 03 · Temperature · Original prompts · T 1.1 · p default · No persona / Intermediate | 10 | 18.50 | 100% | 10 | 7.70 | 4.29 | 0.443 | 0.0% | 8.9% |
| Prompt 4 · Examples / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · No persona / Absolute Zero | 10 | 3.70 | 100% | 8 | 2.00 | 4.40 | 0.509 | 6.7% | 13.3% |
| Prompt 4 · Examples / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · No persona / Beginner | 10 | 5.80 | 80% | 6 | 2.90 | 4.11 | 0.706 | 11.1% | 62.2% |
| Prompt 4 · Examples / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · No persona / Intermediate | 10 | 19.50 | 90% | 10 | 7.68 | 4.46 | 0.422 | 0.0% | 35.6% |
| Prompt 4 · Examples / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · No persona / Absolute Zero | 10 | 4.00 | 70% | 8 | 2.15 | 4.41 | 0.411 | 6.7% | 6.7% |
| Prompt 4 · Examples / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · No persona / Beginner | 10 | 6.00 | 60% | 9 | 2.82 | 4.47 | 0.511 | 2.2% | 22.2% |
| Prompt 4 · Examples / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · No persona / Intermediate | 10 | 21.20 | 60% | 10 | 8.73 | 4.27 | 0.405 | 0.0% | 2.2% |
| Prompt 4 · Examples / 03 · Temperature · Original prompts · T 1.1 · p default · Persona / Absolute Zero | 10 | 4.50 | 80% | 8 | 2.25 | 4.62 | 0.423 | 4.4% | 8.9% |
| Prompt 4 · Examples / 03 · Temperature · Original prompts · T 1.1 · p default · Persona / Beginner | 10 | 6.10 | 80% | 9 | 3.05 | 4.08 | 0.605 | 2.2% | 33.3% |
| Prompt 4 · Examples / 03 · Temperature · Original prompts · T 1.1 · p default · Persona / Intermediate | 10 | 20.20 | 80% | 10 | 9.32 | 4.30 | 0.365 | 0.0% | 8.9% |
| Prompt 4 · Examples / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · Persona / Absolute Zero | 10 | 4.00 | 100% | 8 | 2.00 | 4.41 | 0.511 | 6.7% | 15.6% |
| Prompt 4 · Examples / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · Persona / Beginner | 10 | 6.50 | 100% | 4 | 3.25 | 4.06 | 0.662 | 28.9% | 35.6% |
| Prompt 4 · Examples / 04 · Nucleus sampling · Original prompts · T 1.1 · p 0.8 · Persona / Intermediate | 10 | 22.60 | 70% | 10 | 9.30 | 4.20 | 0.451 | 0.0% | 40.0% |
| Prompt 4 · Examples / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · Persona / Absolute Zero | 10 | 4.50 | 80% | 10 | 2.25 | 4.27 | 0.444 | 0.0% | 22.2% |
| Prompt 4 · Examples / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · Persona / Beginner | 10 | 6.80 | 100% | 7 | 3.40 | 3.68 | 0.729 | 13.3% | 35.6% |
| Prompt 4 · Examples / 04 · Nucleus sampling · Original prompts · T 1.1 · p 1 · Persona / Intermediate | 10 | 20.60 | 70% | 10 | 9.35 | 4.22 | 0.408 | 0.0% | 20.0% |
| Prompt 4 · Examples / 02 · Wording · Variety instruction · T 0.7 · p default · No persona / Absolute Zero | 10 | 4.10 | 80% | 7 | 2.15 | 4.37 | 0.537 | 13.3% | 22.2% |
| Prompt 4 · Examples / 02 · Wording · Variety instruction · T 0.7 · p default · No persona / Beginner | 10 | 6.40 | 100% | 4 | 3.20 | 3.76 | 0.832 | 46.7% | 80.0% |
| Prompt 4 · Examples / 02 · Wording · Variety instruction · T 0.7 · p default · No persona / Intermediate | 10 | 20.90 | 50% | 10 | 10.03 | 4.36 | 0.420 | 0.0% | 22.2% |
| Prompt 4 · Examples / 02 · Wording · Variety instruction · T 0.7 · p default · Persona / Absolute Zero | 10 | 4.10 | 90% | 3 | 2.05 | 3.97 | 0.793 | 62.2% | 62.2% |
| Prompt 4 · Examples / 02 · Wording · Variety instruction · T 0.7 · p default · Persona / Beginner | 10 | 6.80 | 100% | 6 | 3.40 | 3.86 | 0.659 | 13.3% | 62.2% |
| Prompt 4 · Examples / 02 · Wording · Variety instruction · T 0.7 · p default · Persona / Intermediate | 10 | 18.60 | 100% | 10 | 8.92 | 4.17 | 0.444 | 0.0% | 22.2% |
