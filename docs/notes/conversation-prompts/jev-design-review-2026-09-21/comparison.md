# Quantified condition comparison

Implemented experiment results, not production acceptance. Mean semantic cosine is averaged equally over within-difficulty pair means, never over mixed levels. Ordering counts ties as half. All cells have ten successful observations; 45 pairs per cell are not independent samples. Sampling settings are listed per condition; default means not supplied. See README for interpretation and caveats.

| Prompt / settings / identity | N | Mean cosine | Worst-level length fit | P(AZ < Beginner) | P(Beginner < Intermediate) |
|---|---:|---:|---:|---:|---:|
| Spanish · Spain / English instructions / Instruction language · English instructions · T 1.1 · p default · No persona | 30 | 0.382 | 40% | 100.0% | 99.0% |
| Arabic · Levantine / English instructions / Instruction language · English instructions · T 1.1 · p default · No persona | 30 | 0.417 | 30% | 90.5% | 88.0% |
| Mandarin · Mainland / English instructions / Instruction language · English instructions · T 1.1 · p default · No persona | 30 | 0.403 | 40% | 84.5% | 88.5% |
| Spanish · Spain / Target-language instructions / Instruction language · Target-language instructions · T 1.1 · p default · No persona | 30 | 0.407 | 40% | 100.0% | 93.5% |
| Arabic · Levantine / Target-language instructions / Instruction language · Target-language instructions · T 1.1 · p default · No persona | 30 | 0.444 | 50% | 93.5% | 96.0% |
| Mandarin · Mainland / Target-language instructions / Instruction language · Target-language instructions · T 1.1 · p default · No persona | 30 | 0.361 | 50% | 100.0% | 91.0% |

## Detailed cells

| Condition / level | N | Mean words | In target | Unique text | Words/sentence | Letters/word | Cosine | Exact-pair collision | Opening-pair collision |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Spanish · Spain / English instructions / Instruction language · English instructions · T 1.1 · p default · No persona / Absolute Zero | 10 | 4.90 | 60% | 10 | 3.80 | 3.44 | 0.365 | 0.0% | 2.2% |
| Spanish · Spain / English instructions / Instruction language · English instructions · T 1.1 · p default · No persona / Beginner | 10 | 12.80 | 40% | 10 | 6.85 | 4.52 | 0.395 | 0.0% | 15.6% |
| Spanish · Spain / English instructions / Instruction language · English instructions · T 1.1 · p default · No persona / Intermediate | 10 | 21.50 | 80% | 10 | 9.98 | 4.23 | 0.387 | 0.0% | 2.2% |
| Arabic · Levantine / English instructions / Instruction language · English instructions · T 1.1 · p default · No persona / Absolute Zero | 10 | 4.40 | 90% | 8 | 3.03 | 3.65 | 0.476 | 6.7% | 22.2% |
| Arabic · Levantine / English instructions / Instruction language · English instructions · T 1.1 · p default · No persona / Beginner | 10 | 8.10 | 80% | 10 | 4.65 | 4.11 | 0.370 | 0.0% | 0.0% |
| Arabic · Levantine / English instructions / Instruction language · English instructions · T 1.1 · p default · No persona / Intermediate | 10 | 11.50 | 30% | 10 | 5.75 | 3.86 | 0.404 | 0.0% | 0.0% |
| Mandarin · Mainland / English instructions / Instruction language · English instructions · T 1.1 · p default · No persona / Absolute Zero | 10 | 5.60 | 40% | 10 | 4.15 | 1.66 | 0.439 | 0.0% | 6.7% |
| Mandarin · Mainland / English instructions / Instruction language · English instructions · T 1.1 · p default · No persona / Beginner | 10 | 9.70 | 70% | 10 | 7.95 | 1.60 | 0.354 | 0.0% | 4.4% |
| Mandarin · Mainland / English instructions / Instruction language · English instructions · T 1.1 · p default · No persona / Intermediate | 10 | 15.30 | 60% | 10 | 9.75 | 1.58 | 0.414 | 0.0% | 4.4% |
| Spanish · Spain / Target-language instructions / Instruction language · Target-language instructions · T 1.1 · p default · No persona / Absolute Zero | 10 | 4.70 | 90% | 10 | 3.30 | 3.50 | 0.411 | 0.0% | 2.2% |
| Spanish · Spain / Target-language instructions / Instruction language · Target-language instructions · T 1.1 · p default · No persona / Beginner | 10 | 13.20 | 40% | 8 | 7.02 | 3.74 | 0.474 | 6.7% | 33.3% |
| Spanish · Spain / Target-language instructions / Instruction language · Target-language instructions · T 1.1 · p default · No persona / Intermediate | 10 | 21.80 | 60% | 10 | 10.03 | 4.08 | 0.337 | 0.0% | 6.7% |
| Arabic · Levantine / Target-language instructions / Instruction language · Target-language instructions · T 1.1 · p default · No persona / Absolute Zero | 10 | 4.20 | 50% | 10 | 3.30 | 3.95 | 0.429 | 0.0% | 33.3% |
| Arabic · Levantine / Target-language instructions / Instruction language · Target-language instructions · T 1.1 · p default · No persona / Beginner | 10 | 8.30 | 90% | 10 | 4.65 | 4.02 | 0.484 | 0.0% | 80.0% |
| Arabic · Levantine / Target-language instructions / Instruction language · Target-language instructions · T 1.1 · p default · No persona / Intermediate | 10 | 13.40 | 60% | 10 | 6.40 | 4.11 | 0.419 | 0.0% | 13.3% |
| Mandarin · Mainland / Target-language instructions / Instruction language · Target-language instructions · T 1.1 · p default · No persona / Absolute Zero | 10 | 5.90 | 50% | 10 | 4.75 | 1.57 | 0.344 | 0.0% | 0.0% |
| Mandarin · Mainland / Target-language instructions / Instruction language · Target-language instructions · T 1.1 · p default · No persona / Beginner | 10 | 13.10 | 50% | 10 | 9.25 | 1.55 | 0.371 | 0.0% | 2.2% |
| Mandarin · Mainland / Target-language instructions / Instruction language · Target-language instructions · T 1.1 · p default · No persona / Intermediate | 10 | 20.70 | 80% | 10 | 9.68 | 1.54 | 0.368 | 0.0% | 15.6% |
