//! Drill-specific prompt and response projection; shared generation owns execution.
use super::previews::*;
use crate::{
    ai::{
        generation::Request,
        transport::provider::{Completion, PromptMessage},
    },
    model::*,
    storage::store::Store,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use ts_rs::TS;

// Requested shape is independent of proficiency. Bounds use the same UTF-16
// units as the existing Drill text limit, not whitespace-delimited word counts.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum DrillLength {
    Word,
    ShortPhrase,
    Sentence,
    SeveralSentences,
}
pub const LENGTHS: [DrillLength; 4] = [
    DrillLength::Word,
    DrillLength::ShortPhrase,
    DrillLength::Sentence,
    DrillLength::SeveralSentences,
];
impl DrillLength {
    pub(crate) fn max_units(self) -> usize {
        match self {
            Self::Word => 64,
            Self::ShortPhrase => 160,
            Self::Sentence => 320,
            Self::SeveralSentences => 512,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DrillGenerationInput {
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skill_target: Option<super::skill_focus::DrillSkillTarget>,
    pub language: String,
    pub variety: Option<String>,
    pub explanation: String,
    pub explanation_variety: Option<String>,
    pub topic: Option<String>,
    pub count: u32,
    pub difficulty: Difficulty,
    pub length: DrillLength,
}
impl DrillGenerationInput {
    // Bounded output headroom for text, translation and JSON. This is a request
    // allowance, not a token measurement or billing estimate.
    pub(crate) fn output_budget(&self) -> i32 {
        (1024 + self.count.min(20) as usize * (3 * self.length.max_units() + 128))
            .clamp(2048, 32768) as i32
    }

    pub(crate) fn capture(&self, store: &Store) -> Result<Request> {
        if !(1..=20).contains(&self.count)
            || self.topic.as_ref().is_some_and(|t| {
                t.trim().is_empty() || t.encode_utf16().count() > 500 || t.contains('\0')
            })
        {
            return Err(super::invalid(
                "Request 1–20 phrases and a topic of at most 500 characters, or no topic.",
            ));
        }
        let context = store.config.resolve_pair(
            &self.language,
            self.variety.as_deref(),
            &self.explanation,
            self.explanation_variety.as_deref(),
        )?;
        Request::capture_context(store, "drill", context, self.topic.clone())
    }
}
pub(crate) fn messages(
    store: &Store,
    request: &Request,
    input: &DrillGenerationInput,
    focus: Option<&super::skill_focus::DrillSkillFocus>,
) -> Vec<PromptMessage> {
    let difficulty = crate::configuration::difficulty::instruction(
        store.config.conversation_prompt(),
        &request.language_context.target_name,
        &input.difficulty,
    );
    let guidance = ["target_writing", "explanation_writing", "pragmatics"]
        .into_iter()
        .flat_map(|scope| request.language_context.guidance(scope))
        .collect::<Vec<_>>()
        .join("\n");
    vec![
        PromptMessage {
            role: "system".into(),
            content: format!(
                "{}\n{}\nTarget variety: {}. Explanation language: {}.\n{}",
                store.config.drill_instruction(),
                difficulty,
                request.language_context.variety_name,
                request.language_context.explanation_language_id,
                guidance
            ),
        },
        PromptMessage {
            role: "user".into(),
            content: json!({"skillFocus":focus,"topic":input.topic,"count":input.count,"length":input.length,"maxUtf16Units":input.length.max_units()}).to_string(),
        },
    ]
}
pub(crate) fn schema(length: DrillLength) -> Value {
    let reported = json!({"type":"object","additionalProperties":false,"required":["difficulty","tags"],"properties":{"difficulty":{"type":["string","null"]},"tags":{"type":"array","items":{"type":"string"}}}});
    let candidate = json!({"type":"object","additionalProperties":false,"required":["text","translation","reported"],"properties":{"text":{"type":"string","maxLength":length.max_units()},"translation":{"type":["string","null"],"maxLength":2048},"reported":reported}});
    json!({"type":"object","additionalProperties":false,"required":["candidates"],"properties":{"candidates":{"type":"array","maxItems":20,"items":candidate}}})
}
pub(crate) fn candidates(
    store: &Store,
    request: &Request,
    input: &DrillGenerationInput,
    completed: &Completion,
    focus: Option<&super::skill_focus::DrillSkillFocus>,
) -> Result<Vec<DrillCandidate>> {
    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct Response {
        candidates: Vec<Generated>,
    }
    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct Generated {
        text: String,
        translation: Option<String>,
        reported: DrillReportedLabels,
    }
    let response: Response = serde_json::from_str(&completed.text).map_err(|error| {
        crate::diagnostics::response::json_context(
            &error,
            "drill_candidates_decode",
            super::invalid("Invalid Drill candidate response."),
        )
    })?;
    if response.candidates.len() > 20 {
        return Err(super::invalid(
            "Drill candidate response exceeds its item limit.",
        ));
    }
    let mut seen = std::collections::HashSet::new();
    let mut candidates = Vec::new();
    for value in response.candidates {
        if candidates.len() >= input.count as usize {
            break;
        }
        if !valid_text(&value.text)
            || value.text.encode_utf16().count() > input.length.max_units()
            || value
                .translation
                .as_ref()
                .is_some_and(|t| t.contains('\0') || t.encode_utf16().count() > 2048)
            || value.reported.tags.len() > 16
            || value
                .reported
                .tags
                .iter()
                .any(|t| t.len() > 128 || t.contains('\0'))
            || value
                .reported
                .difficulty
                .as_ref()
                .is_some_and(|d| d.len() > 128 || d.contains('\0'))
            || !seen.insert(value.text.clone())
        {
            continue;
        }
        let duplicate = duplicate(&store.connection, &request.language_context, &value.text)?;
        if duplicate {
            continue;
        }
        let id = uuid::Uuid::new_v4().to_string();
        candidates.push(DrillCandidate {
            candidate_id: id.clone(),
            text: value.text,
            translation: value.translation,
            reported: value.reported,
            verified: DrillVerifiedProperties {
                scope_matches_request: true,
                length_ok: true,
                non_empty: true,
                duplicate: false,
            },
            source: DrillSource::Generated {
                skill_focus: focus.cloned(),
                request_id: request.id.clone(),
                candidate_id: id,
                topic: input.topic.clone(),
                difficulty: input.difficulty.clone(),
                length: input.length,
            },
        });
    }
    Ok(candidates)
}
