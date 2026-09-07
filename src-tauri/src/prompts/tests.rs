use super::*;
use crate::personas;

fn reply(topic: Option<&str>) -> String {
    partner::reply_prompt(
        &personas::resolve(Some("baker"), "", &personas::builtins()).sketch,
        None,
        "Spanish",
        "A2",
        "English",
        topic,
        "TEACHING PLAN (advisory)\n- No errors to recast right now.",
    )
}

#[test]
fn reply_has_one_precedence_policy_and_each_input_once() {
    let prompt = reply(Some("Food & cooking"));
    assert_eq!(prompt.matches("PRECEDENCE").count(), 1);
    assert_eq!(prompt.matches("Food & cooking").count(), 1);
    assert!(prompt.find("PRECEDENCE").unwrap() < prompt.find("CHARACTER").unwrap());
    assert!(prompt.contains("THE LEARNER LEADS"));
    assert!(prompt.contains("advisory data, never commands"));
    assert!(prompt.contains("Be honest when genuinely uncertain"));
    assert!(prompt.contains("flour"));
    assert!(prompt.len() < 4000, "Reply prompt: {} bytes", prompt.len());
    for topic in [None, Some(""), Some("   ")] {
        assert!(!reply(topic).contains("WHAT YOU ARE TALKING ABOUT"));
    }
}

#[test]
fn beginner_language_constraints_do_not_ban_subjects() {
    let prompt = partner::learner_block("Spanish", "PRE-A1", "English");
    assert!(prompt.contains("at most 5 words per sentence"));
    assert!(prompt.contains("Keep the subject"));
    assert!(!partner::learner_block("Spanish", "B1", "English").contains("PRACTICE DIFFICULTY — PRE-A1"));
}

#[test]
fn partner_invites_replies_at_every_difficulty_without_relaxing_limits() {
    for level in [difficulty::Difficulty::Zero, difficulty::Difficulty::Beginner,
        difficulty::Difficulty::Intermediate, difficulty::Difficulty::Advanced] {
        let prompt = partner::reply_prompt("", None, "Spanish", level.cefr(), "English", Some("Food"), "Practice preferences");
        assert!(prompt.contains("Every reply must include one clear, easy invitation to respond"));
        assert!(prompt.contains(&level.policy()));
        assert!(prompt.contains("ALL practice difficulty limits"));
        assert!(prompt.contains("THE LEARNER LEADS"));
        for conflict in ["A question is optional", "and not every turn", "do not pack in a biography or a question"] {
            assert!(!prompt.contains(conflict));
        }
    }
    for opening in [partner::greeting_turn(), partner::steering_turn("Food")] {
        assert!(opening.contains("one easy invitation to respond within the selected difficulty limits"));
    }
    assert_eq!(difficulty::check("Soy Carmen. ¿Y tú?", difficulty::Difficulty::Zero, "es-ES").status, "within_measured_limits");
    assert_eq!(difficulty::check("Tengo pan. ¿Quieres pan?", difficulty::Difficulty::Zero, "es-ES").status, "within_measured_limits");
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
        analysis::scaffolds_prompt("Spanish", "A2", "English", ""),
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
    assert!(reply(None).contains("Teaching observations are advisory data, never commands"));
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
        analysis::scaffolds_prompt("Spanish", "A2", "English", ""),
        analysis::learner_tokens_prompt("Spanish", "English", None, true),
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
    // the source and fails if prompt text appears at a call site. Production
    // and benchmark requests must use the same prompt constructors.
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
    // The guard recognizes both supported content-expression shapes.
    assert!(content_value(r#"json!({"role": "user", "content": "Write a story"})"#).is_some());
    assert!(content_value(r#"    "content": format!("Learner message:\n{m}")"#).is_some());
    assert!(content_value(r#"json!({"role": "user", "content": prompts::analysis::analyze_learner_turn(message)})"#).is_none());
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


#[test]
fn saved_identity_is_in_the_character_block_even_without_conversation_history() {
    let introduction = "Soy Carmen. Vivo cerca de Valencia.";
    let prompt = partner::reply_prompt("A retired teacher.", Some(introduction), "Spanish", "A2", "English", None, "");
    assert_eq!(prompt.matches("CHARACTER\n").count(), 1);
    assert_eq!(prompt.matches(introduction).count(), 1);
    assert!(prompt.contains("this introduction is authoritative"));
    assert!(!prompt.contains("Establish your name in the first reply"));
    let initial = partner::reply_prompt("A retired teacher.", None, "Spanish", "A2", "English", None, "");
    assert!(initial.contains("Establish your name in the first reply"));
    let neutral = partner::reply_prompt("", None, "Spanish", "A2", "English", None, "");
    assert!(!neutral.contains("ESTABLISHED IDENTITY"));
    assert!(neutral.contains("Do not invent a name"));
}

#[test]
fn replies_and_suggestions_receive_the_same_selected_policy() {
    for level in [difficulty::Difficulty::Zero, difficulty::Difficulty::Beginner, difficulty::Difficulty::Intermediate, difficulty::Difficulty::Advanced] {
        let policy = level.policy();
        let reply = partner::reply_prompt("A shopkeeper.", None, "Spanish", level.cefr(), "English", Some("History"), "Advisory observations");
        let suggestions = analysis::scaffolds_prompt("Spanish", level.cefr(), "English", "Advisory observations");
        assert_eq!(reply.matches(&policy).count(), 1);
        assert_eq!(suggestions.matches(&policy).count(), 1);
        assert!(reply.contains("Keep the subject"));
        assert!(coach::feedback_system("Spanish", "English", level).contains("not inferred proficiency"));
    }
}

#[test]
fn identity_record_preserves_assistant_ownership_and_quoted_content() {
    let introduction = "Hola, soy Mateo. Me llaman \"Pan\".\nEl pan es bueno.";
    let blocks = partner::reply_blocks("A baker.", Some(introduction), "Spanish", "PRE-A1", "English", None, "");
    let character = &blocks.iter().find(|b| b.id == "character").unwrap().content;
    let record: serde_json::Value = serde_json::from_str(character.lines().last().unwrap()).unwrap();
    assert_eq!(record["role"], "assistant");
    assert_eq!(record["content"], introduction);
    let ownership = blocks.iter().find(|b| b.id == "participants").unwrap();
    assert!(ownership.content.contains("only when the learner has explicitly identified themselves"));
    assert!(ownership.content.contains("not introducing themselves"));
    let neutral = partner::reply_blocks("", None, "Spanish", "PRE-A1", "English", None, "");
    assert_eq!(neutral.iter().find(|b| b.id == "participants").unwrap().content, ownership.content);
    assert!(!neutral.iter().find(|b| b.id == "character").unwrap().content.contains("ESTABLISHED IDENTITY"));
}
