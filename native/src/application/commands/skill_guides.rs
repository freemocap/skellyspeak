//! On-open guide translation. Authored editions win; inference owns no learner credit.
use super::*;
use crate::ai::results::{self, Retained};
use crate::configuration::guide_translation::Edition;
use crate::configuration::guide_translation::SkillGuideResult;
use rusqlite::OptionalExtension;
use serde_json::json;

#[tauri::command]
pub(in crate::application) async fn get_skill_guide(
    state: tauri::State<'_, Arc<Application>>,
    language: String,
    variety: String,
    skill: String,
    explanation: String,
    retry: bool,
) -> Result<SkillGuideResult> {
    load(&state, &language, &variety, &skill, &explanation, retry).await
}

pub(super) async fn load(
    state: &Arc<Application>,
    language: &str,
    variety: &str,
    skill: &str,
    explanation: &str,
    retry: bool,
) -> Result<SkillGuideResult> {
    let (edition, key, request, prompt) = {
        let store = state.lock()?;
        let context = store.config.resolve(language, Some(variety), explanation)?;
        let source = store.config.guide_source(language, skill)?;
        if let Some(edition) = store.config.guide_edition(language, explanation, skill)? {
            return Ok(SkillGuideResult {
                markdown: edition.markdown(variety),
                explanation_language: explanation.into(),
                generated: false,
                context: Some(edition.context(variety)),
                provenance: json!({"sourcePaths":edition.paths,"sourceFingerprint":edition.fingerprint(),"shared":edition.shared.provenance,"guide":edition.guide.provenance}),
            });
        }
        let prompt = store.config.guide_translation_prompt().to_string();
        let key = results::digest(&serde_json::to_vec(&json!([
            "skill-guide-translation-1",
            store.snapshot()?.learner.id,
            source,
            explanation,
            variety,
            prompt
        ]))?);
        if let Some(saved) = results::lookup(&store.connection, &key)? {
            let mut result = decode(&saved)?;
            result.context = Some(source.context(variety));
            return Ok(result);
        }
        let failed: Option<(String, String)> = store.connection.query_row("SELECT id,metadata FROM inference_executions WHERE task='guide_translation' AND json_extract(metadata,'$.guideKey')=?1 AND state IN ('failed','unknown','cancelled') ORDER BY rowid DESC LIMIT 1", [&key], |r| Ok((r.get(0)?, r.get(1)?))).optional()?;
        if let Some((id, metadata)) = failed.filter(|_| !retry) {
            return Err(AppError::new(
                ErrorCode::Provider,
                "Guide translation needs an explicit retry.",
            ).with_diagnostics(json!({"sourceExecutionId":id,"response":serde_json::from_str::<serde_json::Value>(&metadata)?})));
        }
        let request =
            generation::Request::capture_context(&store, "guide_translation", context, None)?;
        (source, key, Arc::new(request), prompt)
    };
    let context = edition.context(variety);
    let (subscription, producer) = state.reading_pending.subscribe(key.clone())?;
    if let Some(producer) = producer {
        let state = state.clone();
        let variety = variety.to_string();
        let explanation = explanation.to_string();
        tauri::async_runtime::spawn(async move {
            let result = produce(
                &state,
                &request,
                Translation {
                    edition: &edition,
                    variety: &variety,
                    explanation: &explanation,
                    key: &key,
                    prompt: &prompt,
                },
                &producer,
            )
            .await;
            producer.finish(result);
        });
    }
    let mut result = decode(&subscription.wait().await?)?;
    result.context = Some(context);
    Ok(result)
}

fn decode(saved: &Retained) -> Result<SkillGuideResult> {
    let mut result: SkillGuideResult = serde_json::from_slice(&saved.payload).map_err(|_| {
        AppError::new(
            ErrorCode::Storage,
            "Saved guide translation has an invalid shape.",
        )
    })?;
    result.provenance["execution"] = json!(saved.execution);
    result.provenance["response"] = saved.metadata.clone();
    result.provenance["cacheHit"] = json!(saved.cached);
    Ok(result)
}

#[cfg(test)]
#[path = "../tests/skill_guides.rs"]
mod tests;

struct Translation<'a> {
    edition: &'a Edition,
    variety: &'a str,
    explanation: &'a str,
    key: &'a str,
    prompt: &'a str,
}

async fn produce(
    state: &Application,
    request: &generation::Request,
    translation: Translation<'_>,
    producer: &results::pending::Producer<Retained>,
) -> Result<Retained> {
    let Translation {
        edition,
        variety,
        explanation,
        key,
        prompt,
    } = translation;
    let id = producer.id();
    {
        let store = state.lock()?;
        request.validate(&store)?;
        if let Some(saved) = results::lookup(&store.connection, key)? {
            return Ok(saved);
        }
        results::begin(&store.connection, id, "guide_translation")?;
        store.connection.execute(
            "UPDATE inference_executions SET metadata=?2 WHERE id=?1",
            rusqlite::params![id, json!({"guideKey":key}).to_string()],
        )?;
    }
    let mut metadata = json!({"guideKey":key,"requestedModel":request.target.model,"route":request.target.route.label(),"attemptId":request.attempt,"operationId":request.operation});
    let mut private = vec![request.credential.clone()];
    let outcome: Result<Vec<u8>> = async {
        let _permit = state.admission.try_chat().ok_or_else(|| AppError::new(ErrorCode::AdmissionHeld, "AI work is at capacity. Retry when pending work finishes."))?;
        let secret = match &request.target.credential { Some(id) => read_secret(id.clone()).await?, None => Zeroizing::new(String::new()) };
        private.push(secret.to_string());
        request.validate(&*state.lock()?)?;
        if !producer.has_subscribers() { return Err(AppError::new(ErrorCode::Conflict, "Guide closed before translation started.")); }
        let data = json!({"explanationLanguage":explanation,"sourceExplanationLanguage":edition.guide.explanation_language,
            "fields":edition.fields(variety),"context":edition.guide.sections});
        let messages = vec![provider::PromptMessage { role:"system".into(), content:prompt.into() }, provider::PromptMessage { role:"user".into(), content:data.to_string() }];
        private.extend(messages.iter().map(|m| m.content.clone()));
        let dispatch = crate::ai::transport::text_request::TextRequest {
            decisions:None, temperature:crate::ai::connections::model_routing::TASK_TEMPERATURE,
            target:request.target.clone(), attempt:request.attempt.clone(), operation:request.operation.clone(),
            credential:request.credential.clone(), model:request.target.model.clone(), route:request.target.route,
            install_id:request.install_id.clone(), messages,
        };
        let schema = edition.schema(variety);
        let client = provider::client()?;
        results::dispatched(&state.lock()?.connection, id)?;
        request.mark_submitted();
        let completed = provider::complete_with_output(&client, &secret, &dispatch,
            provider::RequestOutput::JsonSchema { name:"skill_guide_translation", schema:&schema, max_output_tokens:8192 }).await;
        if let Ok(value) = &completed {
            private.push(value.text.clone());
            metadata["actualModel"] = json!(value.actual_model);
            metadata["providerId"] = json!(value.provider_id);
            metadata["finishReason"] = json!(value.finish_reason);
            metadata["inputTokens"] = json!(value.input_tokens);
            metadata["outputTokens"] = json!(value.output_tokens);
            metadata["diagnostics"] = json!(value.diagnostics);
        }
        generation::accept_completion(&mut *state.lock()?, request, &completed)?;
        let completed = completed?;
        if completed.finish_reason != "stop" { return Err(AppError::new(ErrorCode::Provider, "Guide translation did not finish normally.")); }
        let markdown = edition.translated(variety, &completed.text)?;
        let result = SkillGuideResult { markdown, explanation_language:explanation.into(), generated:true, context:None,
            provenance:json!({"origin":"ai","review":"needs_review","sourcePaths":edition.paths,"sourceFingerprint":edition.fingerprint(),"sourceGuideRevision":edition.guide.revision,"sourceSharedRevision":edition.shared.revision,"model":completed.actual_model}) };
        Ok(serde_json::to_vec(&result)?)
    }.await;
    let private: Vec<_> = private.iter().map(String::as_str).collect();
    if let Err(error) = &outcome {
        metadata["error"] = crate::diagnostics::response::error_metadata(error, &private);
    }
    metadata = crate::diagnostics::response::metadata(&metadata, &private);
    metadata["guideKey"] = json!(key);
    metadata["guideLanguage"] = json!(request.language_id);
    let store = state.lock()?;
    if store.snapshot()?.learner.id != request.install_id {
        return Err(AppError::new(
            ErrorCode::SessionExpired,
            "Workspace changed during guide translation.",
        ));
    }
    results::finish(
        &store.connection,
        id,
        key,
        &metadata,
        outcome.as_ref().ok().map(Vec::as_slice),
        outcome.as_ref().err(),
    )
    .map_err(|error| error.with_diagnostics(json!({"sourceExecutionId":id,"response":metadata})))?;
    let payload = outcome.map_err(|error| {
        error.with_diagnostics(json!({"sourceExecutionId":id,"response":metadata}))
    })?;
    Ok(Retained {
        cached: false,
        execution: id.into(),
        payload,
        metadata,
    })
}
