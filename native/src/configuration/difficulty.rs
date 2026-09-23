//! The one owner of difficulty levels and their prompt instructions.
//!
//! Level order, content keys, prompt labels and the rendered instruction are
//! defined here once. Conversation prompts, prompt previews, AI graph templates
//! and content validation all read them from this module.
use super::ConversationPromptContent;
use crate::model::Difficulty;

/// Every level, easiest first.
pub const LEVELS: [Difficulty; 5] = [
    Difficulty::AbsoluteZero,
    Difficulty::Beginner,
    Difficulty::Intermediate,
    Difficulty::Advanced,
    Difficulty::Fluent,
];

/// The level's key in `content/prompts/conversation/instructions.yaml → difficulty`.
pub fn key(level: &Difficulty) -> &'static str {
    match level {
        Difficulty::AbsoluteZero => "absolute_zero",
        Difficulty::Beginner => "beginner",
        Difficulty::Intermediate => "intermediate",
        Difficulty::Advanced => "advanced",
        Difficulty::Fluent => "fluent",
    }
}

/// The level's English name as it appears inside prompts.
pub fn prompt_label(level: &Difficulty) -> &'static str {
    match level {
        Difficulty::AbsoluteZero => "Absolute zero",
        Difficulty::Beginner => "Beginner",
        Difficulty::Intermediate => "Intermediate",
        Difficulty::Advanced => "Advanced",
        Difficulty::Fluent => "Fluent",
    }
}

/// The instruction describing what is said at `level` in `language`, followed by
/// the shared ceiling. Content validation guarantees every level has text.
pub fn instruction(
    content: &ConversationPromptContent,
    language: &str,
    level: &Difficulty,
) -> String {
    format!(
        "{language}. {} difficulty level: {}\n\n{}",
        prompt_label(level),
        content.difficulty[key(level)],
        content.ceiling
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn levels_are_ordered_and_keys_are_unique() {
        let keys: Vec<_> = LEVELS.iter().map(key).collect();
        assert_eq!(
            keys,
            [
                "absolute_zero",
                "beginner",
                "intermediate",
                "advanced",
                "fluent"
            ]
        );
        let labels: std::collections::BTreeSet<_> = LEVELS.iter().map(prompt_label).collect();
        assert_eq!(labels.len(), LEVELS.len());
    }

    #[test]
    fn every_level_renders_its_own_instruction_and_the_ceiling() {
        let registry = crate::configuration::Registry::bundled().unwrap();
        let content = registry.conversation_prompt();
        for level in &LEVELS {
            let text = instruction(content, "Spanish (Mexico)", level);
            assert!(text.starts_with(&format!(
                "Spanish (Mexico). {} difficulty level: ",
                prompt_label(level)
            )));
            assert!(text.contains(&content.difficulty[key(level)]));
            assert!(text.ends_with(&content.ceiling));
        }
    }
}
