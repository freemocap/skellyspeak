# Conversational quality review — 2026-09-20

## Conclusion and current implementation

The previous question-only recommendation failed the product requirement. This review judges the actual meaning of outputs, not their punctuation. Seven prompt revisions were compared, including concise, long explanatory shaping, lean casual messages, richer/light/no persona, and explicit opening situations. Model comparisons were added after prompt-only attempts continued failing.

The recommended direction is a brief conversational brief, a small contribution plus a connected question, lighter low-level persona context, varied opening situations, and a conversation model that passes meaning-based follow-up probes. The tested default Gemini 2.5 Flash still does not meet that bar. GPT-6 Astra low effort gave the best Arabic follow-up reference here; it is substantially more expensive and has not been selected in the app. This is not a recommendation to replace every model or deploy an untested routing change.

Implemented candidate: `content/prompts/conversation/instructions.yaml`, request label conversation-34. Native composition keeps all interests/opinions; omits occupation/current situation at low levels; disables the canned examples. Fresh conversations without an explicit topic select one of twelve editable starting situations using a stable hash of conversation ID. Preview and capture agree. User topics override situations; replies never receive a new situation. Different chats can select the same situation, and regeneration within the same chat retains it. No guarantee of unique prose. No new persistence, provider fallback, automatic retry or app model change.

The development app rebuilt with this candidate. That is source/runtime readiness, **not** a claim that default-model conversational quality is solved.

## Method and limits

Unblinded qualitative review by the coding assistant, not independent teachers or a validated CEFR assessment. I read every completed response. Judgment considers whether there is a concrete thought, whether the learner can answer at the level, whether that answer matters to the next turn, role ownership, responsiveness, and repetition across starts. I did not treat a question mark as semantic acceptance.

The main suite has 30 openings and eight fixed Arabic Absolute Zero history probes. Fixed histories make failures comparable but are not long live conversations. The reference suite is the 16 Arabic Absolute Zero cases only. Most candidates use Gemini 2.5 Flash without reasoning at temperature 0.7, 512 output tokens. Minimal-reasoning/newer-Flash tests use 2,048 tokens; OpenAI comparisons omit unsupported temperature. Every plan records exact parameters. No saved user chats were uploaded.

All system prompts are native composer exports. Starting-situation runs use actual composer outputs for distinct synthetic conversation IDs; earlier runs repeat identical systems. This changes the treatment deliberately, so it is not an isolated wording comparison. Persona and ordering changes also prevent attributing every improvement to a single sentence.

## Batch decisions

| Batch | Completed / attempted | Known cost USD | Semantic judgment |
| --- | ---: | ---: | --- |
| balanced | 38 / 38 | 0.0127818 | Not sufficient. Some actual small situations appear, but questions still drift, topic change can be ignored and one choice reply has no invitation. |
| balanced-new-model | 38 / 38 | 0.0687120 | Better individual contributions, not accepted. More real dilemmas, but biography dominates; ending incorrectly asks when to talk again. |
| balanced-reasoning | 38 / 38 | 0.0303668 | Not sufficient. Minimal reasoning gives no reliable semantic rescue. The cat request receives a mint question and confusion is answered for the learner. |
| baseline | 38 / 38 | 0.0106202 | Rejected. Seven of eight Arabic lowest-level openings are coffee/tea. The blue choice becomes red; rejection is ignored; repetition resumes tea. |
| concise | 38 / 38 | 0.0121948 | Rejected. More context, but mostly biography-plus-preference. Arabic formality drifts; tiredness and rejection are ignored. |
| lean | 38 / 38 | 0.0081897 | Rejected. Seven of eight Arabic openings repeat being at home. Brevity strips substance; disclosure still becomes coffee. |
| no-persona | 23 / 24 | 0.0069666 | Incomplete comparison after provider 503. More topic variety but generic preference questions remain; no basis to claim removing persona fixes conversation. |
| refined | 38 / 38 | 0.0112090 | Better brevity, still not sufficient. Choice sometimes develops sensibly, but confusion chooses blue and a rejected activity is called strange. |
| refined-mini | 0 / 1 | 0.0000000 | No quality conclusion: endpoint rejected unsupported temperature before a completion. |
| refined-mini-supported | 38 / 38 | 0.0283920 | Rejected. Paper/wind/drawing dominates openings; several semantically odd details. Some good choice and goodbye handling do not compensate. |
| refined-new-model | 38 / 38 | 0.0442425 | Some stronger substantive higher-level turns and improved refusals. Lowest-level openings still cluster around doors and drinks; weak confusion repair. |
| shaped | 38 / 38 | 0.0184878 | Rejected. Long shaping increases backstory and length without reliably improving listening. Rejection still pushes drawing; confusion chooses red for the learner. |
| varied | 38 / 38 | 0.0117207 | Starting material broadens on unchanged app model, but semantic reliability remains insufficient. Still invents learner cat ownership and pushes rejected drawing. |
| varied-reference | 16 / 16 | 0.1744900 | Best semantic reference in this small Arabic-only sample. Preserves choices, simplifies same question, follows tiredness/topic change and respects ending. Not a general pass: repeated window/flower scenes and coffee-history probe remain weak. |

Total: 459 attempted requests, 457 completed; known provider-reported cost $0.4383739. Two failed requests omit usage/cost; their cost is unknown, not assumed zero. Price-check failures sent no completion calls. No automatic retries.

## Why apparently valid responses were rejected

- Baseline: learner chooses blue; partner asks “A red door?” This reverses the answer despite having a question mark.
- Long shaping: learner rejects drawing; partner describes a brown door and asks red or blue again. More prose did not produce listening.
- Lean: “I am at home. Are you at home?” repeated across starts. Short and grammatical, but no interesting contribution.
- Refined default: learner says they do not understand; partner chooses blue and asks whether the door is old. It answers its own question and changes the decision.
- Newer Flash: elaborate architecture dilemmas can be interesting for advanced learners, but repeating them is narrow and some responses are too long.
- Mini: electric power returning supposedly makes a chair wobble; oddity without coherent cause is not interesting conversation.

## Reference: sample-by-sample semantic review

These rows are the complete Arabic reference sample, not a selection of only the best outputs. Translations are explanatory glosses; actual text is in results.jsonl.

| Case | Interpretation and judgment |
| --- | --- |
| opening-r1 | Rain starts; asks go out or stay home. Coherent, very short, clear agency. Modest interest rather than generic liking. |
| opening-r2 | Friend wants the window closed; asks close or leave open. Answerable, but the stakes are thin without a reason. |
| opening-r3 | Pen will not write; asks choose blue or black replacement. Practical continuity; still a fairly thin color choice. |
| opening-r4 | Flower in a teacup; asks whether it is nice. Concrete, playful and simple. No need to see a hidden object to understand the idea. |
| opening-r5 | Friend opens the window in the cold; asks close or leave. Clear mild tension, but repeats the window theme of r2. |
| opening-r6 | Flowers in a teapot; asks nice or strange. Good small personality cue, but too close to r4 across repeated starts. |
| opening-r7 | Music is loud; asks turn it down. Coherent easy decision, modest personality. |
| opening-r8 | Plant has flowered; asks move it beside the window. Specific little delight, clear next step. |
| choice | Will draw it blue; asks add flowers. Uses the actual choice and keeps the partner as the person drawing. Strong improvement. |
| rejection | Drops drawing; offers food as a topic. Respects refusal, but topic offer is generic: adequate repair, weak engagement. |
| confusion | “The door: red or blue?” Preserves the same choice while removing extra language. Strong repair. |
| reciprocal | Answers with oud music at night, then asks what learner listens to. Gives own detail and follows music; open question is answerable with one word. |
| disclosure | Suggests resting from cooking and ordering food. Responds to tiredness without forcing the original activity. |
| topic-change | Shares a cat sleeping on the partner’s chair; asks whether learner has a cat. Follows requested subject without assuming learner ownership. |
| dead-end-history | Adds bitter-coffee detail, then asks sugar or milk. Some narrative movement, but still fails our escape-from-drink-survey probe. |
| ending | Returns a natural goodbye without another question. Passes the intended behavior. |

## Cost and recommendation boundary

The 16 reference calls cost $0.17449 in total. This is experiment cost, not a production estimate; prompt/history length, routing and reasoning change it. Do not silently switch the user’s ongoing conversations to this model.

Recommendation: keep the tested source improvements, but require semantic acceptance before calling an app trial successful. Use the stronger reference responses as target behavior while evaluating a conversation-specific model route and cost/latency tradeoff. Do not approve a cheaper candidate solely for speed, shortness or question presence. Before a model switch, test generated multi-turn exchanges, all difficulty levels, explicit topics, persona-off, endings and native provider payload compatibility.

## Verification

Native composer tests (6), opening/execution tests (5), configuration tests (30), content/schema checks, TypeScript benchmark checks and clippy passed. Preview/capture consistency, stable varied openings, topic precedence, reply isolation and low-level persona projection are covered. Semantic findings above remain independent of these automated passes. Changes are uncommitted.

## API references

Parameter support was checked against [OpenRouter reasoning documentation](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens), [GPT-5.4 Mini documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini), and [GPT-6 Astra documentation](https://developers.openai.com/api/docs/models/gpt-6-astra). Public endpoint catalogs supplied run-time price checks. Those pages do not establish conversational quality; the saved outputs do.
