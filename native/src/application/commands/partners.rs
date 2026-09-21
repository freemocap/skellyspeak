use super::*;

/// Reserve bounded ownership before any provider work. The proposal remains
/// volatile; creating the reviewed contact is a separate ordinary action.
#[tauri::command]
pub(in crate::application) fn begin_persona_generation(
    state: tauri::State<'_, Arc<Application>>,
    language_id: String,
    brief: Option<String>,
) -> Result<String> {
    reserve_persona_generation(&state, language_id, brief)
}

fn reserve_persona_generation(
    state: &Application,
    language_id: String,
    brief: Option<String>,
) -> Result<String> {
    let mut store = state.lock()?;
    for expired in state.generations.expire()? {
        generation_receipts::expire(&mut store, &expired)?;
    }
    let request = generation::Request::capture(&store, language_id, brief)?;
    let request = state.generations.insert(request)?;
    if let Err(error) = generation_receipts::begin(&mut store, &request) {
        state.generations.cancel(&request.id)?;
        return Err(error);
    }
    Ok(request.id.clone())
}

#[tauri::command]
pub(in crate::application) fn cancel_persona_generation(
    state: tauri::State<'_, Arc<Application>>,
    generation_id: String,
) -> Result<()> {
    cancel_owned_persona_generation(&state, &generation_id)
}

fn cancel_owned_persona_generation(state: &Application, generation_id: &str) -> Result<()> {
    let mut store = state.lock()?;
    if let Some(request) = state.generations.cancel(generation_id)? {
        generation_receipts::cancel(&mut store, &request)?;
    }
    Ok(())
}

#[tauri::command]
pub(in crate::application) async fn run_persona_generation(
    state: tauri::State<'_, Arc<Application>>,
    generation_id: String,
) -> Result<PersonaDetails> {
    let run = {
        let mut store = state.lock()?;
        for expired in state.generations.expire()? {
            generation_receipts::expire(&mut store, &expired)?;
        }
        state.generations.claim(&generation_id)?
    };
    let request = &run.request;
    // Keep completion metadata even when the proposal fails parsing or loses
    // authority before adoption. Its text never enters the durable receipt.
    let mut provider_outcome = None;
    let outcome = async {
        let validate = || {
            let store = state.lock()?;
            request.validate(&store)
        };
        validate()?;
        let permit = state.admission.try_chat().ok_or_else(|| {
            AppError::new(
                ErrorCode::AdmissionHeld,
                "AI work is already at capacity. Let pending work finish, then generate again.",
            )
        })?;
        let client = provider::client()?;
        let key = generation::await_checked(
            request,
            async {
                if request.credential.is_empty() {
                    Ok(Zeroizing::new(String::new()))
                } else {
                    read_secret(request.credential.clone()).await
                }
            },
            validate,
        )
        .await??;
        validate()?;
        let language = &request.language;
        let schema = persona::output_schema();
        let dispatch = execution::Dispatch {
            temperature: 0.7,
            target: request.target.clone(),
            attempt: request.attempt.clone(),
            operation: request.operation.clone(),
            credential: request.credential.clone(),
            model: request.target.model.clone(),
            route: request.target.route,
            install_id: request.install_id.clone(),
            messages: persona_prompt::messages_with_context(
                &language.name,
                request.brief.as_deref(),
                &request.language_context,
            ),
            gloss_schema: None,
            decisions: None,
            coaching_schema: None,
            gloss_source: None,
            speech_source: None,
        };
        {
            // Cancellation also takes Store before Registry. Validation, the
            // durable dispatch boundary and submission state are one ordered step.
            let mut store = state.lock()?;
            request.validate(&store)?;
            generation_receipts::dispatch(&mut store, request)?;
            request.mark_submitted();
        }
        provider_outcome = Some(
            retry::run(
                || {
                    provider::complete_with_output(
                        &client,
                        &key,
                        &dispatch,
                        provider::RequestOutput::JsonSchema {
                            max_output_tokens: 2048,
                            name: persona_prompt::SCHEMA_NAME,
                            schema: &schema,
                        },
                    )
                },
                validate,
                |error| generation_receipts::record_retry(&*state.lock()?, request, error),
            )
            .await,
        );
        drop(permit);
        let completed = provider_outcome
            .as_ref()
            .expect("provider outcome was captured");
        generation::accept_completion(&mut *state.lock()?, request, completed)?;
        let completion = completed.as_ref().map_err(Clone::clone)?;
        let details = generated_persona_for_language(&completion.text, &request.language)?;
        validate()?;
        Ok(details)
    }
    .await;
    let completion = provider_outcome
        .as_ref()
        .and_then(|value| value.as_ref().ok());
    finish_persona_generation(&state, request, completion, outcome)
}

fn finish_persona_generation(
    state: &Application,
    request: &generation::Request,
    completion: Option<&provider::Completion>,
    mut outcome: Result<PersonaDetails>,
) -> Result<PersonaDetails> {
    // The final authority check and terminal receipt share the Store lock with
    // cancel/settings actions. A failed terminal write never adopts a proposal.
    let mut store = state.lock()?;
    if outcome.is_ok()
        && let Err(error) = request.validate(&store)
    {
        outcome = Err(error);
    }
    generation_receipts::finish(&mut store, request, completion, &outcome)?;
    outcome
}

#[tauri::command]
pub(in crate::application) fn get_persona_generation_activity(
    state: tauri::State<'_, Arc<Application>>,
) -> Result<model::PersonaGenerationActivity> {
    let mut store = state.lock()?;
    for expired in state.generations.expire()? {
        generation_receipts::expire(&mut store, &expired)?;
    }
    generation_receipts::activity(&store.connection)
}

/// Attempt and operation identities for one generation request, in the forms every
/// dispatch uses. The hosted server refuses a grouped request whose identities have
/// any other shape.
pub(crate) fn generation_identity() -> (String, String) {
    (
        execution::new_attempt_id(),
        uuid::Uuid::new_v4().simple().to_string(),
    )
}

/// Parse and validate one completion. Pure, so both outcomes are covered without
/// a provider and a rejected response cannot have written anything.
#[cfg(test)]
fn generated_persona(text: &str, language_id: &str) -> Result<PersonaDetails> {
    generated_persona_for_language(text, &languages::language(language_id)?)
}

fn generated_persona_for_language(
    text: &str,
    language: &model::Language,
) -> Result<PersonaDetails> {
    let details = persona_prompt::parse(text)?;
    persona::validate_for_language(&details, language)?;
    Ok(details)
}

#[cfg(test)]
#[path = "../tests/generation.rs"]
mod tests;
