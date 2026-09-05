use super::*;
use crate::personas;

fn reply(topic: Option<&str>) -> String {
    partner::reply_prompt(
        &personas::resolve(Some("baker"), "", &personas::builtins()).sketch,
        "Spanish",
        "A2",
        "English",
        topic,
        "TEACHING PLAN (advisory)\n- No errors to recast right now.",
    )
}

// ─── The partner ────────────────────────────────────────────────────────────

#[test]
fn the_chosen_topic_reaches_the_reply_prompt_as_an_instruction() {
    // The reported bug: change the topic, and it never comes up. It used to
    // arrive as one line at the bottom of the private staging notes, behind the
    // entire teaching plan.
    let p = reply(Some("Food & cooking"));
    let topic_at = p.find("Food & cooking").expect("the topic is not in the prompt");
    let notes_at = p.find("PRIVATE STAGING NOTES").unwrap();
    assert!(topic_at < notes_at, "the topic is still buried in the notes");
    assert!(p.contains("This is not a hint"));
    // ...but a topic is a starting point, not a rail. Dragging the learner back
    // to it is the same failure as never mentioning it.
    assert!(p.contains("never haul them back"));
}

#[test]
fn no_topic_means_no_topic_section() {
    for none in [None, Some(""), Some("   ")] {
        assert!(!reply(none).contains("WHAT YOU ARE TALKING ABOUT"), "{none:?}");
    }
}

#[test]
fn the_partner_is_a_person_rather_than_a_role() {
    let p = reply(None);
    assert!(p.contains("flour"), "the character sketch is missing");
    assert!(p.contains("not an assistant"));
    // The exact phrasing that produced the complaint.
    assert!(!p.contains("encouraging and patient"));
}

#[test]
fn the_reply_prompt_names_the_clichés_it_forbids() {
    let p = reply(None);
    for banned in ["how they are", "weather", "how interesting", "VARY YOUR MOVE"] {
        assert!(p.contains(banned), "{banned:?} is not forbidden any more");
    }
}

#[test]
fn nothing_in_the_reply_prompt_tells_the_partner_to_refuse_a_subject() {
    // A learner asked about colonialism in Hawaii and was told it was a sad
    // story and the subject was changed. The cause was a scope lock plus a
    // content policy stamped "these override everything else" — an amateur
    // moderation layer on top of the one the API endpoint already does
    // properly. It is gone, and it must not come back.
    let p = reply(Some("Travel stories"));
    for gone in [
        "CONTENT POLICY",
        "inappropriate content",
        "politely decline",
        "unrelated to learning",
        "practice activity",
        "PERSONA LOCK",
    ] {
        assert!(!p.contains(gone), "the refusal machinery is back: {gone:?}");
    }
}

#[test]
fn the_partner_is_told_to_follow_the_learner_anywhere() {
    let p = reply(None);
    assert!(p.contains("THE LEARNER LEADS"));
    assert!(p.contains("NEVER refuse a subject"));
    assert!(p.contains("colonialism"), "the hard cases are named, not implied");
}

#[test]
fn the_character_is_a_voice_and_never_a_knowledge_limit() {
    // "You are a real person... you run a hardware shop" plus "you are not an
    // assistant" was enough for the model to decide a shopkeeper would not know
    // about Hawaiian colonial history, and to play that.
    let p = reply(None);
    assert!(p.contains("shapes your VOICE"));
    assert!(p.contains("everything the model behind you knows"));
}

#[test]
fn the_partner_may_never_plead_ignorance() {
    // The second refusal, in the partner's own words: "No sé mucho de Hawái.
    // ¿Por qué quieres hablar de eso?" — which came almost verbatim from a line
    // in this very rule ("if they ask you something you have no opinion about,
    // say so briefly and ask what they think"). An escape valve written for
    // genuine blanks, used as a polite way out of a hard subject.
    let p = reply(None);
    assert!(p.contains("NEVER PLEAD IGNORANCE"));
    assert!(p.contains("we don't talk about that here"));
    // The escape hatch itself must not come back.
    assert!(!p.contains("no opinion about, say so"));
    // And being pushed on it settles the question.
    assert!(p.contains("they are \\\n         right") || p.contains("they are right"));
}

#[test]
fn a_subject_in_the_teaching_plan_cannot_make_it_off_limits() {
    // The observer had genuinely written "Discussions on complex socio-political
    // topics (e.g., colonialism)" into the plan's `avoid` list, and that list is
    // injected here every turn: the app had taught itself to refuse. Plans
    // already on disk keep that entry until the next observer pass rewrites it,
    // so the prompt has to neutralise it rather than rely on the fix upstream.
    let p = partner::reply_prompt(
        &personas::resolve(Some("shopkeeper"), "", &personas::builtins()).sketch,
        "Spanish",
        "PRE-A1",
        "English",
        None,
        "TEACHING PLAN (advisory)\n- Too much for them right now: \
         Discussions on complex socio-political topics (e.g., colonialism)",
    );
    assert!(p.contains("list a SUBJECT as something to avoid, that entry \\\n         is a mistake")
        || p.contains("is a mistake — ignore it"));
    // And the observer is told not to write one in the first place.
    assert!(observer::plan_prompt("Spanish").contains("never a list of subjects"));
    assert!(observer::directives_block(&Default::default(), &[]).contains("advisory"));
}

#[test]
fn a_true_beginner_discusses_hard_things_in_tiny_words() {
    // "Build every exchange from a tiny survival core" reads as *keep it
    // light*. It governs words, never subjects — the learner in the report was
    // on Absolute zero when they asked about colonialism.
    let zero = partner::reply_prompt(
        &personas::resolve(Some("shopkeeper"), "", &personas::builtins()).sketch,
        "Spanish",
        "PRE-A1",
        "English",
        None,
        "",
    );
    assert!(zero.contains("THIS LIMITS YOUR WORDS, NEVER YOUR SUBJECT"));
    assert!(zero.contains("Short sentences about a serious thing"));
}

#[test]
fn only_the_follow_rule_claims_to_override_everything() {
    // Order is load-bearing. Anything phrased as outranking what came before it
    // WILL outrank it, so exactly one section may be phrased that way — and it
    // must be the last thing before the reply, where nothing can answer back.
    let p = reply(Some("Family & friends"));
    assert_eq!(p.matches("OVERRIDES EVERYTHING").count(), 1);
    assert!(!p.contains("these override everything else"));
    let follow_at = p.find("THE LEARNER LEADS").unwrap();
    assert!(
        follow_at > p.find("PRIVATE STAGING NOTES").unwrap(),
        "the teaching plan is stated after the rule that is supposed to beat it"
    );
}

#[test]
fn a_true_beginner_still_gets_the_survival_core() {
    let zero = partner::reply_prompt(
        &personas::resolve(Some("nurse"), "", &personas::builtins()).sketch,
        "Spanish",
        "PRE-A1",
        "English",
        None,
        "",
    );
    assert!(zero.contains("TRUE BEGINNER MODE"));
    // ...without losing the character.
    assert!(zero.contains("rotating shifts"));
    assert!(!reply(None).contains("TRUE BEGINNER MODE"));
    // Sheltering governs the words, never the subject.
    assert!(reply(None).contains("governs the WORDS, never the subject"));
}

#[test]
fn a_true_beginner_gets_a_hard_sentence_length_cap() {
    // "Keep sentences short where possible" let PRE-A1 replies drift back to
    // full complex sentences. The cap must be a hard, named limit, and it must
    // not bleed into the higher levels.
    let zero = partner::reply_prompt(
        &personas::resolve(Some("nurse"), "", &personas::builtins()).sketch,
        "Spanish",
        "PRE-A1",
        "English",
        None,
        "",
    );
    assert!(zero.contains("FIVE WORDS IS THE ABSOLUTE MAXIMUM"));
    assert!(zero.contains("3 to 5 words"));
    assert!(!reply(None).contains("FIVE WORDS IS THE ABSOLUTE MAXIMUM"));
}

#[test]
fn the_opener_is_not_a_greeting() {
    // "Greet the learner warmly and ask one simple opening question" is what
    // produced "hello, how are you?" at the top of every chat.
    let g = partner::greeting_turn(None);
    assert!(g.contains("FORBIDDEN openers"));
    assert!(g.contains("in the middle of your day"));
    assert!(partner::greeting_turn(Some("Music & hobbies")).contains("Music & hobbies"));
    assert!(!partner::greeting_turn(Some("  ")).contains("wants to talk about"));
}

#[test]
fn every_builtin_persona_is_distinct_and_describes_a_person() {
    let ids: std::collections::HashSet<&str> =
        partner::BUILTIN_PERSONAS.iter().map(|p| p.id).collect();
    assert_eq!(ids.len(), partner::BUILTIN_PERSONAS.len(), "duplicate persona id");
    for p in partner::BUILTIN_PERSONAS {
        // Shorter than this is an adjective list, which is the failure the
        // whole persona idea exists to avoid.
        assert!(p.sketch.len() > 150, "{} has a thin sketch", p.id);
        assert!(!p.label.is_empty());
    }
}

// ─── The other surfaces ─────────────────────────────────────────────────────

#[test]
fn no_surface_tells_a_model_to_change_the_subject() {
    // The partner was the visible failure, but the coach and the scaffolds sit
    // in the same conversation: a coach that steers away from a hard topic, or
    // scaffolds written for the subject the learner just left, break it the
    // same way from one layer down.
    let surfaces = [
        coach::analysis_prompt("Spanish", "English"),
        coach::thread_prompt("Spanish", "English"),
        analysis::scaffolds_prompt("Spanish", "English", ""),
        observer::plan_prompt("Spanish"),
    ];
    for s in &surfaces {
        for gone in ["inappropriate", "politely decline", "suggest a language-learning topic"] {
            assert!(!s.contains(gone), "refusal machinery in a background pass: {gone:?}");
        }
    }
    assert!(surfaces[0].contains("Never suggest a different topic"));
    assert!(surfaces[3].contains("never a list of subjects"));
}

#[test]
fn the_coach_names_the_teaching_it_is_modelled_on() {
    // Adjectives do nothing to a model: "be warm and encouraging" produces the
    // saccharine assistant voice everyone can already imitate. A named book is
    // a whole posture, and moves the register further in one clause than a
    // paragraph of instructions does — the same reason the personas say "you
    // smell of flour until the afternoon" rather than "cheerful".
    for p in [
        coach::analysis_prompt("Spanish", "English"),
        coach::thread_prompt("Spanish", "English"),
    ] {
        assert!(p.contains("Freire"), "the lineage is back to adjectives");
        assert!(p.contains("bell hooks"));
        assert!(p.contains("Tools for Conviviality"));
        // Freire's actual point, not just his name.
        assert!(p.contains("not an empty account"));
    }
}

#[test]
fn the_coach_is_not_a_marketing_project() {
    // "I'm SkellyBot, your trusty assistant for this course" is the voice this
    // is written against.
    for p in [
        coach::analysis_prompt("Spanish", "English"),
        coach::thread_prompt("Spanish", "English"),
    ] {
        assert!(p.contains("NOT A MARKETING PROJECT"));
        assert!(p.contains("Never introduce"));
        assert!(p.contains("not saccharine"));
        assert!(p.contains("SHORT UNLESS ASKED FOR MORE"));
    }
}

#[test]
fn the_plan_is_a_convenience_and_never_an_obligation() {
    // The convivial-tool line: the app's structures serve the person using it,
    // not the other way round. Every surface that can see the plan says so.
    assert!(coach::analysis_prompt("Spanish", "English")
        .contains("conveniences for the app, not obligations"));
    assert!(coach::thread_prompt("Spanish", "English").contains("LET THEM DRIVE, ALL THE WAY"));
    assert!(reply(None).contains("ANY EXPECTATION ABOUT THIS APP IS MET"));
    // And the observer writes for a person rather than for a syllabus.
    assert!(observer::plan_prompt("Spanish").contains("NOT WRITING A SYLLABUS"));
}

#[test]
fn the_coach_offers_rabbit_holes_it_can_actually_answer() {
    // The markers are only allowed in the prompt because pressing one really
    // does ask the coach about that term — see `markdown.test.tsx`. The thread
    // has to know what a bare marker coming back at it means, or the feature
    // is a button that produces a translation request.
    for p in [
        coach::analysis_prompt("Spanish", "English"),
        coach::thread_prompt("Spanish", "English"),
    ] {
        assert!(p.contains("[[double brackets]]"));
    }
    let thread = coach::thread_prompt("Spanish", "English");
    assert!(thread.contains("PRESSED MARKERS"));
    assert!(thread.contains("NOT a request to"), "a pressed marker reads as a translation ask");
}

#[test]
fn the_coach_writes_in_the_learners_own_language() {
    // This pane is the refuge. A remark that reads like more target-language
    // practice has failed at its job.
    let c = coach::analysis_prompt("Spanish", "English");
    assert!(c.contains("REFUGE"));
    assert!(c.contains("predominantly in English"));
}

#[test]
fn structured_prompts_all_say_how_to_answer_with_nothing() {
    // Every schema is strict, so "required" must not come to mean "invented".
    for p in [
        analysis::tokens_prompt("Spanish", "English", None, true),
        analysis::translation_prompt("Spanish", "English"),
        analysis::mechanics_prompt("Spanish", "A2", "English", ""),
        analysis::scaffolds_prompt("Spanish", "English", ""),
        analysis::learner_tokens_prompt("Spanish", "English", None, true),
        story::story_prompt("Spanish", "A2", "English", "beginner", ""),
    ] {
        assert!(p.contains(NOT_APPLICABLE), "a strict schema with no escape hatch");
    }
}

#[test]
fn romanization_rides_with_the_language_not_the_prompt() {
    let latin = analysis::tokens_prompt("Spanish", "English", None, true);
    let arabic = analysis::tokens_prompt("Arabic", "English", Some("ALA-LC"), true);
    assert!(!latin.contains("romanization"));
    assert!(arabic.contains("ALA-LC"));
}

#[test]
fn mandarin_segmentation_and_pinyin_ride_with_the_language() {
    let mandarin =
        analysis::tokens_prompt("Chinese (Mandarin)", "English", Some("PINYIN"), false);
    assert!(mandarin.contains("PINYIN"));
    assert!(mandarin.contains("segment"));
    assert!(mandarin.contains("single characters"));
    let latin = analysis::tokens_prompt("Spanish", "English", None, true);
    assert!(!latin.contains("segment"));
}

#[test]
fn word_insight_describes_particles_for_isolating_languages() {
    let inflecting = analysis::word_insight_prompt("Spanish", "English", true);
    let isolating =
        analysis::word_insight_prompt("Chinese (Mandarin)", "English", false);
    assert!(inflecting.contains("conjugation/declension"));
    assert!(!isolating.contains("conjugation/declension"));
    assert!(isolating.contains("measure words"));
}

#[test]
fn the_story_prompt_scales_with_the_level() {
    assert!(story::story_prompt("Spanish", "A2", "English", "beginner", "").contains("40-70 words"));
    assert!(story::story_prompt("Spanish", "C1", "English", "advanced", "").contains("140-200 words"));
    // An unknown level is the gentlest one, not a panic.
    assert!(story::story_prompt("Spanish", "A2", "English", "???", "").contains("40-70 words"));
}

#[test]
fn every_language_has_an_overlay() {
    // The registry holds the facts and this module holds the words, which is
    // only safe if adding a language without its guidance fails the build
    // rather than silently shipping an unsteered language.
    for lang in crate::languages::LANGUAGES {
        let text = overlays::for_code(lang.code);
        assert!(!text.is_empty(), "{} has no overlay", lang.code);
        assert!(
            text.contains("{dialect}"),
            "{} cannot interpolate its dialect",
            lang.code
        );
    }
}

// ─── The rule this module exists to enforce ─────────────────────────────────

#[test]
fn no_stray_prompts() {
    // Every string this app sends to a model lives under `prompts/`. This walks
    // the source and fails if prompt text reappears at a call site, because
    // that is exactly how the partner's voice drifted out of sync with itself
    // the first time: four files each holding a piece of it, and a benchmark
    // measuring a fifth.
    //
    // The rule is mechanical: whatever fills a message's `"content"` must be a
    // variable or a `prompts::` call — never a literal, and never a `format!`
    // assembled on the spot.
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut offenders = Vec::new();
    walk(&root, &mut |path, text| {
        // This module IS the place prompts live.
        if path.components().any(|c| c.as_os_str() == "prompts") {
            return;
        }
        for (n, line) in text.lines().enumerate() {
            if let Some(rest) = content_value(line) {
                offenders.push(format!("{}:{}  {}", path.display(), n + 1, rest.trim()));
            }
        }
    });
    assert!(
        offenders.is_empty(),
        "prompt text outside `prompts/`:\n{}\n\
         Move the string into the matching `prompts/` module and pass the data in.",
        offenders.join("\n")
    );
}

/// The offending half of a message line, or None if it is fine.
///
/// Shared with the test below that proves this actually catches something —
/// a guard that silently matches nothing is worse than no guard, because it
/// reads like protection.
fn content_value(line: &str) -> Option<&str> {
    let rest = line.split_once("\"content\":")?.1.trim_start();
    let is_literal = rest.starts_with('"');
    let is_assembled = rest.starts_with("format!(");
    (is_literal || is_assembled).then_some(rest)
}

#[test]
fn the_stray_prompt_guard_can_actually_fail() {
    // Both shapes the old code used, and the shapes that replaced them.
    assert!(content_value(r#"json!({"role": "user", "content": "Write a story"})"#).is_some());
    assert!(content_value(r#"    "content": format!("Learner message:\n{m}")"#).is_some());
    assert!(content_value(r#"json!({"role": "user", "content": prompts::story::story_turn()})"#).is_none());
    assert!(content_value(r#"    "content": reply_system,"#).is_none());
    // Not a message at all: reading a field off a response body.
    assert!(content_value(r#"let text = obj.get("content").and_then(Value::as_str);"#).is_none());
}

fn walk(dir: &std::path::Path, f: &mut impl FnMut(&std::path::Path, &str)) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk(&path, f);
        } else if path.extension().is_some_and(|e| e == "rs") {
            if let Ok(text) = std::fs::read_to_string(&path) {
                f(&path, &text);
            }
        }
    }
}
