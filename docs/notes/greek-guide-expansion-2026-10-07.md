# Greek skill-guide teaching expansion — 2026-10-07

Status: implemented content and local verification; independent Greek and Cantonese review pending.

## Scope and behavior

Expanded the English and Cantonese explanation guides for all eight Greek skill groups and all 42 subskills in the existing `greek-greece` variety. Each section now opens with a learner-use context and explains the actual Greek words, forms, or order used. Each principal example has a worked meaning and a small practice task with a complete answer and reason. The existing principal target sentences, section IDs, group IDs, shared explanation paths, and variety dispositions were retained. Two sections with second examples received worked meanings and practice for those examples too. Assessment guidance was read for semantic alignment but was not edited.

These are AI-authored teaching texts marked `needs_review`, not native-speaker certification or new product behavior. The selected variety teaches its own example directly. The short `section.explanation` remains declarative/contextual for the AI partner; practice prompts live in example notes.

## Sources reviewed

- [Greek Ministry of Education school grammar](https://ebooks.edu.gr/ebooks/d/8547/774/21-0058-02_V2_Grammatiki-Neas-Ellinikis-Glossas_A-B-G-Gymnasiou.pdf), [@hatzisavvidis_el_school_grammar2026]: consulted adjective agreement, verb stems and aspect, modality, adverbials, reason and conditional clauses, and question/context guidance. These support constructions but do not independently validate our new examples or Cantonese wording.
- [Centre for the Greek Language, person and polite plural](https://www.greek-language.gr/digitalResources/modern_greek/tools/lexica/glossology_edu/iframe.html?heading=2&id=162), [@tsaggalidis_el_person2026]: confirms second-person plural address to one person in respectful contexts.
- [Centre for the Greek Language, politeness](https://www.greek-language.gr/digitalResources/modern_greek/tools/lexica/glossology_edu/iframe.html?heading=7&id=140), [@archakis_el_politeness2026]: supports indirect request interpretation; relationship-specific choices still need human review.
- [Dictionary of Standard Modern Greek](https://www.greek-language.gr/greekLang/modern_greek/tools/lexica/triantafyllides/), including the [δηλαδή entry](https://www.greek-language.gr/greekLang/modern_greek/tools/lexica/triantafyllides/search.html?lq=%CE%B4%CE%B7%CE%BB%CE%B1%CE%B4%CE%AE&dq=), [@triantafyllides_el_diladi2026]: checked reformulation sense. The dictionary serves as lexical cross-check, not proof of every conversational reading.

The guides retain their existing `poulopoulou_el_grammar2015` and `hatzisavvidis_el_school_grammar2026` source keys. No new bibliography key was introduced. The university grammar's existing reference describes a prior read; I did not rely on a new read of its inaccessible official full text for this expansion.

## Verification and unresolved review

Local YAML parse and section-count checks covered 16 guides and 42 parallel section IDs. The writer preserved each principal example sentence and the single selected variety, and wrote each YAML through a parse-checked temporary file followed by rename. Final repository checks are coordinated by the root integrator.

Independent review should check naturalness of newly written practice answers, whether Cantonese explanations read naturally across learner varieties, and the pragmatic fit of respectful versus familiar address in examples. No semantic contradiction with the eight existing assessments was found in the retained principal examples; that observation is not a validation of all assessment policy.

A cross-review on 2026-10-07 identified three wording issues, now corrected in both editions where relevant: `Αυτός` is described as a masculine form referring to Nikos rather than glossed as an invariant “this man”; the invitation practice specifies the repair shop; and the door-repair practice specifies damaged doors in a repair workshop so `φτιάχνω` is read as repair rather than manufacture. The principal examples were unchanged.
