# Korean skill-guide teaching expansion — 2026-10-07

Status: all 16 existing English and Cantonese guides revised; independent Korean and Cantonese review remains pending. This is an implementation note, not an independent linguistic certification.

## Proposed new bibliography entries for root integration

These National Institute of Korean Language sources were opened and the stated passages read on 2026-10-07. The root integrator registered these keys in `references.bib` before their use in YAML. The time-fragment answer was read in full, not solely from a search snippet. Its exact example is `금요일에요`; the shop-closing answer `다섯 시에요` is a narrowly applied analogy, not a verbatim example in that source.

```bibtex
@misc{nikl_ko_language_overview2026,
  title = {Everything You Wanted to Know About the Korean Language},
  author = {{National Institute of Korean Language}},
  url = {https://www.korean.go.kr/common/download.do?book_seq=143&c_file_name=786b421a-c4f2-448c-ab3a-b3023b085319_0.pdf&downGubun=bookDataView&file_path=bookData&o_file_name=%EA%B5%AD%EC%96%B4%EC%88%9C%ED%99%94-03-10.pdf},
  review = {full-text},
  claim = {Selected pp. 22-31 were read: postpositional particles mark noun roles, verb endings mark sentence force and tense or subject honorification, connective endings distinguish parallel from contrastive relations, and the basic clause order is subject-object-verb with contextually flexible order. This does not certify all generated examples or prescribe address level for every relationship.},
  note = {Selected pages consulted 2026-10-07; original guide prose and practice remain AI-authored and needs_review.}
}

@misc{nikl_ko_honorific_eusi2026,
  title = {Korean Basic Dictionary: -으시-},
  author = {{National Institute of Korean Language}},
  url = {https://krdict.korean.go.kr/eng/dicSearch/SearchView?ParaNationCode=6&ParaWordNo=80329&captchaNumber=&commentTitle=&comment_user_name=&divSearch=defViewGlobal&nation=eng&nationCode=6&viewTypes=on&wordComment=},
  review = {full-text},
  claim = {The dictionary entry defines -으시- as a subject-honorifying ending on predicates and separately notes honorific use when the grammatical subject is a respected person's possession or body part. It does not equate this ending with polite sentence endings directed to the listener.},
  note = {Entry consulted 2026-10-07; generated teaching examples remain needs_review.}
}

@misc{nikl_ko_time_fragment2026,
  title = {Online Korean usage answer: geumyoireyo / geumyoirieyo},
  author = {{National Institute of Korean Language, Online Ganada}},
  url = {https://www.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=73&pageIndex=1&qna_seq=323328},
  review = {full-text},
  claim = {In reply to when an action happened, a time adverbial with temporal particle 에 plus listener-polite particle 요 can stand alone after the predicate is omitted; the predicative statement that it is Friday instead uses 이에요 or 예요. The consulted answer demonstrates 금요일에요 in this distinction, not the exact 다섯 시에요 example.},
  note = {Answer consulted 2026-10-07; applied narrowly to an elliptical time answer with a recoverable event.}
}
```

## Existing source review

The previously registered original lessons from How to Study Korean on [predicates](https://www.howtostudykorean.com/unit1/unit-1-lessons-1-8/unit-1-lesson-3/), [conjugation](https://www.howtostudykorean.com/unit1/unit-1-lessons-1-8/unit-1-lesson-5/), [desire](https://www.howtostudykorean.com/unit1/unit-1-lessons-17-25-2/lesson-17/) and [permission](https://www.howtostudykorean.com/unit-2-lower-intermediate-korean-grammar/unit-2-lessons-42-50/lesson-49/) were opened in this pass. They support the specific constructions described in their existing bibliography claims, not global rules or independent validation of the new practice answers.

## Implemented guide content

The eight guide groups now cover all 42 subskills in each edition, including situated explanations, an interpreted worked example, and a practice prompt with a complete answer and reason. Explanations state the scene and form choices; exercises are confined to example notes. The chosen `korean-south-korea` variety is taught directly. Original principal Korean sentences, section IDs, and variety identity were retained. The eight assessment YAMLs were read for semantic alignment and not edited. This AI-authored prose and all generated practice sentences retain `needs_review`; the checked sources support particular constructions, not native-speaker certification.

## Verification

All 16 guides parsed as YAML. A local comparison against HEAD confirmed the 84 edition-sections retain their IDs and principal Korean example text, and the English/Cantonese editions have paired section and example order. A content scan confirmed practice stayed outside `section.explanation`, worked meanings and practice notes are present, and backticks are balanced. `git diff --check` passed for the Korean guides and this note. The repository integrator owns the final `npm run check:fast` gate.
