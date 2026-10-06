//! Structural checks for shared content and declared prompt fragments.
use super::validation::{parse, text};
use super::*;
use crate::configuration::{Result, error};

pub(super) fn require_files(files: &BTreeMap<String, String>) -> Result<()> {
    for path in [
        "language-foundations/language-foundations.yaml",
        "conversation-topics/conversation-topics.yaml",
        "policies/teaching-policy.yaml",
        "policies/guide-authoring.yaml",
        "prompts/skills/guide-translation.md",
        "prompts/skills/coach-guide.md",
        "speech/speech-routing.yaml",
        "policies/skill-credit.yaml",
        "prompts/assessment/skill-assessment.md",
        "prompts/assessment/skill-criteria.yaml",
        "prompts/assessment/evidence-attribution.md",
        "prompts/assessment/grammar.md",
        "prompts/assessment/grammar-criteria.yaml",
        "prompts/assessment/understandability.md",
        "prompts/assessment/understandability-criteria.yaml",
        "prompts/practice/practice.md",
        "prompts/conversation/base.md",
        "prompts/conversation/persona.md",
        "prompts/conversation/interaction.md",
        "prompts/conversation/history-start.md",
        "prompts/conversation/examples-intro.md",
        "prompts/conversation/ceiling.md",
        "prompts/conversation/coach-focus.md",
        "prompts/conversation/past.md",
        "prompts/conversation/future.md",
        "prompts/conversation/opening.md",
        "prompts/conversation/phrase-opening.md",
        "prompts/conversation/response.md",
        "prompts/conversation/subject.md",
        "prompts/conversation/examples.yaml",
        "prompts/conversation/difficulty.yaml",
        "prompts/conversation/opening-angles.yaml",
    ] {
        if !files.contains_key(path) {
            return Err(error(path, "missing", "Required content file is missing."));
        }
    }
    Ok(())
}

pub(super) fn validate_file(files: &BTreeMap<String, String>, path: &str) -> Result<()> {
    match path {
        "policies/guide-authoring.yaml" => {
            let _: guide_policy::GuidePolicy = parse(files, path)?;
        }
        "language-foundations/language-foundations.yaml" => {
            let _: documents::Foundations = parse(files, path)?;
        }
        "conversation-topics/conversation-topics.yaml" => {
            let _: Vec<documents::ConversationTopic> = parse(files, path)?;
        }
        "policies/teaching-policy.yaml" => {
            let _: documents::TeachingPolicy = parse(files, path)?;
        }
        "speech/speech-routing.yaml" => {
            let d: crate::configuration::speech::Catalog = parse(files, path)?;
            d.validate()?;
        }
        "policies/skill-credit.yaml"
        | "prompts/assessment/skill-criteria.yaml"
        | "prompts/assessment/grammar-criteria.yaml"
        | "prompts/assessment/understandability-criteria.yaml" => {
            let _: serde_yaml_ng::Value = parse(files, path)?;
        }
        "prompts/assessment/skill-assessment.md"
        | "prompts/skills/guide-translation.md"
        | "prompts/skills/coach-guide.md"
        | "prompts/assessment/evidence-attribution.md"
        | "prompts/assessment/grammar.md"
        | "prompts/assessment/understandability.md"
        | "prompts/practice/practice.md"
        | "prompts/conversation/base.md"
        | "prompts/conversation/persona.md"
        | "prompts/conversation/interaction.md"
        | "prompts/conversation/examples-intro.md"
        | "prompts/conversation/ceiling.md"
        | "prompts/conversation/coach-focus.md"
        | "prompts/conversation/past.md"
        | "prompts/conversation/future.md"
        | "prompts/conversation/opening.md"
        | "prompts/conversation/phrase-opening.md"
        | "prompts/conversation/response.md"
        | "prompts/conversation/history-start.md"
        | "prompts/conversation/subject.md" => text(path, &files[path])?,
        "prompts/conversation/examples.yaml" | "prompts/conversation/difficulty.yaml" => {
            let _: BTreeMap<String, String> = parse(files, path)?;
        }
        "prompts/conversation/opening-angles.yaml" => {
            let _: Vec<String> = parse(files, path)?;
        }
        _ => return Err(error(path, "unknown_file", "Unknown content file.")),
    }
    Ok(())
}
