# Lowest-level regression check — 2026-09-20

The latest app captures used the correct selected levels and conversation-34.
Absolute Zero nevertheless added a greeting, another speaker, quoted speech and
an open-ended opinion question, exceeding the subsequent Beginner reply. This
was an instruction-following and acceptance failure, not swapped level routing.
Saved private conversation contents are not copied into this report.

Implemented conversation-35: explicit, distinct low-level response budgets and
linguistic constraints; the selected level is last in native assembly. Absolute
Zero excludes narrative, reported speech, added speakers and abstract opinion
questions. The meaningful invitation requirement remains. No model change.

The paired suite uses actual native exports, the same synthetic starter persona
and same opening key for both levels: four pairs each in Arabic, Spanish and
Mandarin. All 12 Absolute Zero samples were shorter than their Beginner pairs.
The 24 calls cost $0.0071373 on Gemini 2.5 Flash, reasoning disabled.

This is **not a semantic quality pass**. Arabic pair 1 still uses reported speech
and two questions. Arabic pair 2 drifts into formal Arabic and asks ownership of
an unseen key. Pair 3 asks whether a door is old without giving the learner the
information to judge. Spanish pair 1 retains reported speech; several Spanish
samples exceed the target word budget. Mandarin pair 1 has an extra speaker.
The runner failed its mechanical invitation screen for one response; manual
review found these additional failures.

The runtime candidate is rebuilt, but prompt-only language/meaning compliance
remains unreliable on the current model. Do not call this generally fixed.
