# Seven-language guide grid: Portuguese explanation column — 2026-10-07

Status: assigned target editions implemented; independent/native review pending. This agent owns the Arabic, Mandarin and Cantonese targets (24 files) and read-only review of the eight shared Portuguese headings and Portuguese target self-edition. English, Spanish and French targets are owned by another worker; the Portuguese self-edition and shared headings are owned by root.

The shared files and Portuguese self-edition have been read in full (42 concepts, 42 self-edition sections and 43 examples). One naturalness suggestion for the self-edition short answer meaning was sent to root; no shared or self-edition files were edited here.

The Mandarin target is implemented in eight Portuguese explanation guides, covering 42 subskills. Context, target-language form teaching, comparisons and full worked practice were translated from the current English guides. A local writer checked each prose field’s exact backticked target-fragment multiset, every principal sentence and the shared-link/review metadata before saving.

The Cantonese target is implemented in eight Portuguese explanation guides, also covering 42 subskills. It retains the English guide’s conversational roles, classifying expressions, aspect distinctions and practice answers. The same per-field fragment and principal-text checks passed.

The Arabic target is implemented in eight Portuguese explanation guides, with 42 Modern Standard Arabic sections and 42 Levantine variety sections. Both branches were translated separately for their actual forms and examples, with practice prompts and answers retained. The writer checked every source-marked fragment and principal example in both branches.

All 24 new guides translate the current English teaching prose and preserve the target-language principal examples, subskill order, variety branches, exact marked target fragments per prose field, scoped sources, and `needs_review` status. The shared grid audit (`node docs/notes/seven-language-grid-audit.ts --partial`), `git diff --check`, and `npm run check:fast` passed after the three targets were completed. Other workers' columns still had 16 missing files at this checkpoint, so the audit was partial. No native-speaker review is claimed.

## English, Spanish and French target batches

The English, Spanish and French targets are now implemented in 24 Portuguese explanation guides: 42 core subskills per target, plus every English United States and French Canada replacement section. The English and Spanish guides retain complete comparison and practice passages from their current English sources, and the French Canada sections explain `déjeuner` as breakfast where the France core explains it as lunch. The original principal examples, IDs, variety dispositions, source keys and exact marked target fragments were preserved. New revisions and review revisions identify the Portuguese explanation editions; `needs_review` remains. This is an authored localization, not an independent certification of the original linguistic claims.

Local verification on this checkpoint: `node docs/notes/seven-language-grid-audit.ts --partial` passes with 8/8 Portuguese explanation guides for English, Spanish and French targets. The grid contained 347 present files and 2,199 sections overall at this run; 45 files in other cells were still absent. The per-file writer also compared every principal example and exact backtick-fragment multiset before writing. Repository-wide gates belong to root after the grid stabilizes.
