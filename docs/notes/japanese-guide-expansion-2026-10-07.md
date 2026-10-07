# Japanese skill-guide expansion — 2026-10-07

Status: implemented teaching-content revision, awaiting independent Japanese and Cantonese review. This note records what was changed and checked; the generated guide is not thereby a certified language reference.

## Coverage and behavior

Expanded the existing English and Cantonese explanation guides for all eight Japanese skill groups: 42 subskills and 42 principal target examples in each explanation language. The sole declared selected variety is `japanese-japan`, which continues to use the core sections. Each `section.explanation` now starts from a plausible learner situation, unpacks words and particles in the preserved example, and draws a reusable distinction. Each `examples.note` gives a transfer task with a whole Japanese answer and its reason. The content is declarative guide data consumed by practice AI. No assessment, shared/runtime field, subskill ID, or principal Japanese example text was changed.

The eight assessment guidance files were read before authoring. The guides retain their distinctions between a request and an offer, a wish and a commitment, acknowledgment and agreement, permission and ability, sequence and cause, and non-past, progressive and completed readings. No contradiction requiring an assessment edit was found.

## Primary source review

The existing `jpf_irodori_grammar2026` bibliography key cites [Irodori: Japanese for Life in Japan, Grammar Notes](https://www.irodori.jpf.go.jp/assets/data/Grammar_all.pdf), issued by the Japan Foundation. Relevant English/Japanese notes were inspected directly in the PDF: the introduction pages on topic `は`, question `か` and context-based omission; pages around 37, 59, 80, 91–93, 107, 127, 129, 132–133, 137, 142–143, 161 and 164 on shared `ましょう`, desire `たい`, ability `ことができます`, `て`-form requests, offers `ましょうか`, obligation `なければなりません`, `ている` readings, reason `ので`, responsive `なら`, sequence `てから`, conditional `たら`, possibility `かもしれません`, and comparison `より`/`のほうが`. The PDF also describes polite permission forms and conversational confirmation. Only relevant passages were inspected, not every page. Original lesson wording and transfer answers remain AI-authored and `needs_review`.

The integrator expanded the existing bibliography claim to record the selected passages consulted in this expansion. Additional attestation entries below record the separate review of two preserved examples. The source supports construction-level claims, not independent certification of each newly written example or Cantonese rendering.

## Verification

Local YAML parsing passed for all 16 explanation files. Comparison with `HEAD` verified all 42 subskill IDs, all 42 principal Japanese example texts per language, every original example count, and the `japanese-japan` variety key. English and Cantonese target examples remain identical. Explanations and notes contain paired backticks, no Markdown headings or blockquotes, and each note includes a full worked answer. Cross-review sharpened two transfer tasks: the inference now relies on footsteps heard inside, and the library key-return task establishes that it is a borrowed study-room key. These are data checks, not a running-app review. Root integration owns `npm run check:fast` and any wider final-state gates on the shared checkout.

## Open review

Independent Japanese and Cantonese review should confirm the conversational naturalness of the original principal examples and the new practice answers. A read-only cross-review found no demonstrated error in the preserved `この答えで合っているか、自信がありません` or `橋が通れません`; their exact contextual naturalness can still be checked by a native speaker. No principal example was rewritten on inference alone.

## Independent source spot-check and bibliography proposals

Read-only cross-review opened the primary publisher pages below and read their indexed search-result snippets for the relevant passages. The web reader did not locate the exact strings in its extracted full-page text, so this is a **snippet-level attestation check**, not full-text review of those passages. The [Yamagata court transcript](https://www.courts.go.jp/yamagata/vc-files/yamagata/file/H280223.pdf) snippet contains `この答えで合っているのかな`, which supports that phrase, but not the entire preserved sentence or its `か、自信がありません` combination. The [Consumer Affairs Agency transcript](https://www.caa.go.jp/policies/policy/consumer_system/meeting_materials/assets/consumer_system_cms101_221122_00.pdf) snippet contains `適切に回答できているか自信がございませんが`, supporting an embedded `か` uncertainty clause with `自信` in a different context and register. The [transport ministry meeting record](https://www.mlit.go.jp/common/001097544.pdf) and [House of Representatives committee transcript](https://www.shugiin.go.jp/internet/itdb_kaigiroku.nsf/html/kaigiroku/009919820190417007.htm) snippets each contain `橋が通れない`, attesting a bridge with `が` in a potential clause; this alone does not establish a grammatical subject analysis. Root subsequently read the transport ministry passage on PDF page index 5: it concerns boats unable to pass under a bridge at high tide, a narrower context than road traffic. None is an attestation of the exact original lesson sentence or a native-speaker style verdict. The spot-check found no basis to rewrite either principal example as an error.

Bibliography entries registered by the root integrator; the excerpt-level limitations below remain in force:

```bibtex
@misc{jp_courts_answer_transcript2026,
  author = {{Yamagata District Court}},
  title = {Court participant discussion transcript, 23 February 2016},
  year = {2016},
  url = {https://www.courts.go.jp/yamagata/vc-files/yamagata/file/H280223.pdf},
  review = {reviewed},
  claim = {Indexed passage contains この答えで合っているのかな. This supports the phrase この答えで合っている in speech, not the whole original SkellySpeak sentence or its idiomaticity. The full passage was not located in extracted PDF text.}
}

@misc{jp_caa_uncertainty_transcript2026,
  author = {{Consumer Affairs Agency}},
  title = {Fifth meeting transcript on the state and future of consumer law},
  year = {2022},
  url = {https://www.caa.go.jp/policies/policy/consumer_system/meeting_materials/assets/consumer_system_cms101_221122_00.pdf},
  review = {reviewed},
  claim = {Indexed passage contains 適切に回答できているか自信がございませんが. This supports an embedded か clause with 自信 in a different context and formal register, not the exact original SkellySpeak sentence. The full passage was not located in extracted PDF text.}
}

@misc{jp_mlit_bridge_passability2026,
  author = {{Ministry of Land, Infrastructure, Transport and Tourism}},
  title = {Fifth roundtable on marine tourism},
  year = {2015},
  url = {https://www.mlit.go.jp/common/001097544.pdf},
  review = {full-text},
  claim = {Selected passage on PDF page index 5 uses 橋が通れない for boats unable to pass under a bridge at high tide. This attests a bridge with が in a potential clause in that specific context, not the exact original SkellySpeak sentence, a road-crossing interpretation, or a grammatical subject analysis.}
}

@misc{jp_diet_bridge_passability2026,
  author = {{House of Representatives, National Diet of Japan}},
  title = {Land, Infrastructure, Transport and Tourism Committee transcript, 17 April 2019},
  year = {2019},
  url = {https://www.shugiin.go.jp/internet/itdb_kaigiroku.nsf/html/kaigiroku/009919820190417007.htm},
  review = {reviewed},
  claim = {Indexed passage uses 橋が通れない for bridge unavailability during snow. This supports the construction in that context, not the exact original SkellySpeak sentence. The relevant full passage was not located in extracted page text.}
}
```
