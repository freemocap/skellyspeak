//! Read-only application blueprints. No workspace, credentials or execution state.
//! Edges come from scheduler declarations; prompts come from their owning builders.
use crate::{
    ai::transport::provider::PromptMessage,
    configuration::{LanguageContext, Registry},
    conversations::{coach_prompt, conversation_prompt, translation, turn_plan},
    learning::coaching::{self, conversation_support, skill_assessment},
    model::{AppError, ErrorCode, Result},
    partners::persona::{self, persona_prompt},
};
use serde::Serialize;
use serde_json::{Value, json};
use ts_rs::TS;

#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AiGraphDefinition {
    pub id: String,
    pub description: String,
    pub operations: Vec<AiOperationDefinition>,
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AiOperationDefinition {
    pub kind: String,
    pub dependencies: Vec<String>,
    pub role: String,
    pub contract_version: Option<i32>,
    pub description: String,
    pub source: String,
    pub templates: Vec<AiPromptTemplate>,
    #[ts(type = "unknown")]
    pub output_schema: Option<Value>,
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AiPromptTemplate {
    pub label: String,
    pub text: String,
}
fn section(label: &str, text: impl Into<String>) -> AiPromptTemplate {
    AiPromptTemplate {
        label: label.into(),
        text: text.into(),
    }
}
fn messages(items: Vec<PromptMessage>) -> Vec<AiPromptTemplate> {
    items
        .into_iter()
        .map(|m| section(&m.role, m.content))
        .collect()
}

/// Only placeholders are supplied to pure prompt builders. This is not a sample
/// request or a saved user's context. No database or provider is involved.
fn context(registry: &Registry) -> Result<LanguageContext> {
    let mut context = registry.resolve("english", None, "english")?;
    context.target_name = "{{targetLanguage}}".into();
    context.variety_name = "{{targetVariety}}".into();
    for scope in [
        "target_writing",
        "explanation_writing",
        "pragmatics",
        "assessment",
        "romanization",
        "segmentation",
    ] {
        context.guidance.insert(
            scope.into(),
            vec![format!("{{{{languageGuidance.{scope}}}}}")],
        );
    }
    Ok(context)
}
fn captured(context: &LanguageContext) -> Value {
    json!({
        "targetLanguage":"{{targetLanguage}}", "translationLanguage":"{{explanationLanguage}}",
        "languageContext":context,
        "messages":[{"role":"system","content":"{{system}}"},{"role":"user","content":"{{precedingExchange}}"},{"role":"user","content":"{{currentInput}}"}],
        "practiceSettings":{"difficulty":"{{difficulty}}"}, "input":"{{inputProvenance}}",
        "skillCriteria":"{{skillCriteria}}"
    })
}
fn operation(kind: &str, registry: &Registry) -> Result<AiOperationDefinition> {
    let context = context(registry)?;
    let captured = captured(&context);
    let mut node = AiOperationDefinition {
        kind: kind.into(),
        dependencies: vec![],
        role: String::new(),
        contract_version: None,
        description: String::new(),
        source: String::new(),
        templates: vec![],
        output_schema: None,
    };
    match kind {
        "persona_context" | "coach_context" => {
            node.description = "Local validation of the captured conversation history, partner instructions and language settings. Checks source ownership and input limits before releasing dependent work. No AI request or tokens are used. The reply node shows the assembled prompt.".into();
            node.source = "native/src/conversations/execution/turns.rs; native/src/conversations/execution/dispatch.rs".into();
        }
        "persona_reply" | "persona_opening" => {
            let c = registry.conversation_prompt();
            node.description = format!(
                "{}: ordered system-prompt fragments. Optional fragments depend on conversation settings. Prior messages and the current learner input (or opening brief) follow as separate messages.",
                conversation_prompt::VERSION
            );
            node.source = "content/prompts/conversation/instructions.yaml; native/src/conversations/conversation_prompt.rs; native/src/configuration/difficulty.rs".into();
            node.templates = vec![
                section("system · base", c.base.clone()),
                section(
                    "system · optional persona",
                    format!(
                        "{}\nPersona background (data): {{{{personaDetails}}}}",
                        c.persona
                    ),
                ),
                section(
                    "system · language guidance",
                    "Target-language writing: {{languageGuidance.target_writing}}\n\n{{languageGuidance.pragmatics}}",
                ),
            ];
            for level in crate::configuration::difficulty::LEVELS {
                node.templates.push(section(
                    &format!(
                        "system · difficulty option: {}",
                        crate::configuration::difficulty::prompt_label(&level).to_lowercase()
                    ),
                    crate::configuration::difficulty::instruction(
                        c,
                        "{{targetLanguage}} ({{targetVariety}})",
                        &level,
                    ),
                ));
            }
            node.templates.extend([
                section(
                    "system · optional topic",
                    format!("{} {{{{topic}}}}", c.subject),
                ),
                section("system · past option", c.past.clone()),
                section("system · future option", c.future.clone()),
                section(
                    "system · direction",
                    if kind == "persona_opening" {
                        c.opening.clone()
                    } else {
                        c.response.clone()
                    },
                ),
                section(
                    "messages · context",
                    "{{boundedConversationHistory}}\n{{currentInputOrOpeningBrief}}",
                ),
            ]);
        }
        "coach_reply" => {
            node.source = "native/src/conversations/coach_prompt.rs".into();
            node.description = "Private coach thread. Language guidance, settings, recent partner exchange and saved assistance are inserted at capture time.".into();
            node.templates = vec![
                section(
                    "system",
                    coach_prompt::system(
                        "{{targetLanguage}}",
                        "{{explanationLanguage}}",
                        "{{practiceSettings}}",
                        "{{personaExchangeNewestFirst}}",
                        "{{savedConversationSupport}}",
                        &context,
                    ),
                ),
                section(
                    "messages · context",
                    "{{boundedPrivateCoachHistory}}\n{{currentLearnerInput}}",
                ),
            ];
        }
        "skill_evidence" => {
            node.source = "native/src/learning/coaching/skill_evidence.rs".into();
            node.description = "After Jev, locate exact learner quotes for implicated skills using the captured Fast model. Preserve Jev outcomes and probabilities. Native validation rejects missing, duplicate, invented or ambiguous quotes before publishing credit. Chat model assessments already contain quotes; they and empty Jev assessments complete this node locally without a provider call.".into();
            let mut input = captured.clone();
            input["skillCriteria"] = json!([{"id":"question","criterion":"Request information"}]);
            input["skillDecisions"] =
                json!({"items":[{"construct":"question","outcome":"demonstrated"}]});
            node.templates = messages(
                crate::learning::coaching::skill_evidence::prompt_for_source(
                    "{{currentLearnerMessage}}".into(),
                    &input,
                )?,
            );
            node.output_schema = Some(crate::learning::coaching::skill_evidence::schema(&input)?);
        }
        "skill_assessment" => {
            node.source = "native/src/learning/coaching/assessment_adapter.rs; native/src/learning/coaching/skill_assessment.rs".into();
            node.description = "Selectable assessment adapter. Jev Choice (default) returns 45 category decisions and probabilities, then skill_evidence localizes implicated skills before credit publication. Chat model assessment uses the Fast model and returns up to four quoted observations. Both receive the current learner message, up to four preceding messages and the shared criteria. The output schema below describes the chat adapter; the Jev request shows its typed Choice contract.".into();
            node.templates = messages(skill_assessment::prompt_for_source(
                "{{currentLearnerMessage}}".into(),
                &captured,
            )?);
            node.output_schema = Some(skill_assessment::schema(
                &json!({"skillCriteria":registry.constructs().iter().map(|c| json!({"id":c.id})).collect::<Vec<_>>()}),
            )?);
            let mut decision_context = captured.clone();
            decision_context["skillCriteria"] = json!(
                registry
                    .constructs()
                    .iter()
                    .map(|c| json!({"id":c.id,"criterion":c.criterion}))
                    .collect::<Vec<_>>()
            );
            let input = skill_assessment::prompt_for_source(
                "{{currentLearnerMessage}}".into(),
                &decision_context,
            )?;
            node.templates.push(section(
                "Jev Choice · decisions request",
                serde_json::to_string_pretty(
                    &crate::learning::coaching::assessment_adapter::request(
                        &input,
                        &decision_context,
                    )?,
                )?,
            ));
        }
        kind if crate::learning::coaching::message_assessment::owns(kind) => {
            node.source = "native/src/learning/coaching/message_assessment.rs; content/prompts/conversation/ratings.yaml".into();
            node.description = "Typed 0–10 utterance ratings run alongside the reply. Understanding uses the actual reply in a separate dependent request. Missing evidence remains unscored; neither result grants learning credit.".into();
            node.templates.push(section(
                "Choice questions",
                serde_json::to_string_pretty(
                    &crate::learning::coaching::message_assessment::questions(kind)?,
                )?,
            ));
        }
        kind if conversation_support::owns(kind) => {
            node.source = "native/src/learning/coaching/conversation_support.rs".into();
            node.description = "Uses the current partner reply, latest learner input and up to eight preceding messages. The request drops only whole older messages to fit its budget. Romanization is empty for Latin-script targets.".into();
            node.templates = messages(conversation_support::prompt_for_exchange(
                "{{actualPartnerReply}}".into(),
                Some("{{latestLearnerInput}}".into()),
                kind,
                &captured,
            )?);
            node.output_schema = Some(conversation_support::schema(kind));
        }
        "coach_retry_check" => {
            node.source =
                "native/src/learning/coaching/mod.rs; native/src/conversations/execution/turns.rs"
                    .into();
            node.description = "Declared operation; currently excluded from automatic turn admission. A retry check uses the revised learner source and prior coaching evidence.".into();
            node.templates = vec![
                section("system", coaching::system_prompt(kind, &captured)?),
                section(
                    "user · inputs",
                    "{{learnerSource}}, {{priorConversation}}, {{privateCoachHistory}}, {{targetLanguage}}, {{explanationLanguage}}, {{difficulty}}, {{candidateConstructs}}, {{helpMode}}, {{inputProvenance}}, {{proactivity}}, {{practiceFocus}}, {{coachRetry}}",
                ),
            ];
        }
        kind if translation::owns(kind) => {
            node.source = "native/src/conversations/translation.rs".into();
            node.description = "Translates the source message into the explanation language. Destination writing guidance is appended at dispatch.".into();
            node.templates = messages(translation::prompt("{{sourceMessage}}".into(), &captured)?);
            node.output_schema = Some(translation::schema());
        }
        "persona_word_gloss" | "user_word_gloss" => {
            node.source = "native/src/language/linguistics/adapter.rs".into();
            node.description = "The base instruction is followed by explanation-writing, romanization and segmentation guidance, size limits and a source-bound output schema. User data contains the passage and its grapheme rows. Explicit reading retries also append retained spans and unresolved ranges.".into();
            node.templates = vec![
                section(
                    "system · base",
                    crate::language::linguistics::adapter::INSTRUCTIONS,
                ),
                section(
                    "system · runtime additions",
                    "{{languageGuidance.explanation_writing}}\n{{languageGuidance.romanizationOrNoRomanizationRule}}\n{{languageGuidance.segmentation}}\n{{spanAndGlossLimits}}\nOutput schema: {{sourceBoundSchema}}",
                ),
                section(
                    "user · inputs",
                    "{\"target_language\":\"{{targetLanguage}}\",\"explanation_language\":\"{{explanationLanguage}}\",\"passage\":\"{{sourceMessage}}\",\"graphemes\":\"{{graphemeRows}}\"}",
                ),
            ];
        }
        "persona_speech" => {
            node.source = "native/src/conversations/execution/speech.rs".into();
            node.description = "Optional text-to-speech operation, admitted only when speech is enabled. Sends partner reply text and the selected voice to the speech service. No chat prompt.".into();
        }
        "persona_generation" => {
            node.source = "native/src/partners/persona/persona_prompt.rs".into();
            node.description = "Standalone persona-generation request. Optional brief and language guidance are included; this is separate from conversation turns.".into();
            node.templates = messages(persona_prompt::messages_with_context(
                "{{targetLanguage}}",
                Some("{{optionalPersonaBrief}}"),
                &context,
            ));
            node.output_schema = Some(persona::output_schema());
        }
        "speech_transcription" => {
            node.source = "native/src/speech/recording/transcription.rs".into();
            node.description = "Standalone transcription request. Sends recorded audio and language settings to the speech service, then returns text for the composer. No chat prompt.".into();
        }
        _ => {
            return Err(AppError::new(
                ErrorCode::Internal,
                format!("Missing AI graph definition for {kind}."),
            ));
        }
    }
    Ok(node)
}

pub fn definitions() -> Result<Vec<AiGraphDefinition>> {
    let registry = Registry::bundled()?;
    let mut graphs = Vec::new();
    for (id, description, plan) in [
        (
            "conversation_reply",
            "Conversation reply and supporting operations. This is the declared plan, including optional or currently disabled operations; a recorded run can contain a subset.",
            turn_plan::PLAN,
        ),
        (
            "conversation_opening",
            "Partner opening and supporting operations. Optional speech depends on conversation settings.",
            turn_plan::OPENING_PLAN,
        ),
        (
            "private_coach",
            "Private coach context and reply. This thread is separate from the partner exchange.",
            turn_plan::COACH_PLAN,
        ),
    ] {
        let operations = plan
            .iter()
            .map(|d| {
                let mut node = operation(d.kind, &registry)?;
                node.dependencies = d.dependencies.iter().map(|s| (*s).into()).collect();
                if d.activation == turn_plan::Activation::Explicit {
                    node.description.push_str(
                        " Created only by an explicit action; not automatically scheduled.",
                    );
                }
                node.role = d.role.into();
                node.contract_version = Some(d.contract_version);
                Ok(node)
            })
            .collect::<Result<Vec<_>>>()?;
        graphs.push(AiGraphDefinition {
            id: id.into(),
            description: description.into(),
            operations,
        });
    }
    for (kind, role) in [
        ("persona_generation", "standard"),
        ("speech_transcription", "transcription"),
    ] {
        let mut node = operation(kind, &registry)?;
        node.role = role.into();
        graphs.push(AiGraphDefinition {
            id: kind.into(),
            description: node.description.clone(),
            operations: vec![node],
        });
    }
    Ok(graphs)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn definitions_cover_current_plans_without_dangling_dependencies() {
        let graphs = definitions().unwrap();
        assert_eq!(graphs.len(), 5);
        for (graph, plan) in graphs.iter().zip([
            turn_plan::PLAN,
            turn_plan::OPENING_PLAN,
            turn_plan::COACH_PLAN,
        ]) {
            assert_eq!(graph.operations.len(), plan.len());
            for node in &graph.operations {
                assert!(
                    node.dependencies
                        .iter()
                        .all(|d| graph.operations.iter().any(|n| &n.kind == d))
                );
            }
            for (node, declaration) in graph.operations.iter().zip(plan) {
                assert_eq!(node.kind, declaration.kind);
                assert_eq!(node.dependencies, declaration.dependencies);
                assert_eq!(node.role, declaration.role);
                assert_eq!(node.contract_version, Some(declaration.contract_version));
                assert!(
                    node.dependencies
                        .iter()
                        .all(|d| graph.operations.iter().any(|n| &n.kind == d))
                );
                assert!(!node.source.is_empty());
                if !matches!(node.role.as_str(), "local" | "speech") {
                    assert!(!node.templates.is_empty(), "{}", node.kind);
                }
            }
        }
        let reply = &graphs[0];
        let assessment = reply
            .operations
            .iter()
            .find(|n| n.kind == "skill_assessment")
            .unwrap();
        assert!(
            assessment.templates[0]
                .text
                .contains(skill_assessment::VERSION)
        );
        assert!(
            assessment.templates[1]
                .text
                .contains("{{currentLearnerMessage}}")
        );
        assert_eq!(assessment.output_schema.as_ref().unwrap()["properties"]["items"]["items"]["properties"]["construct"]["enum"].as_array().unwrap().len(), 45);
    }
}
