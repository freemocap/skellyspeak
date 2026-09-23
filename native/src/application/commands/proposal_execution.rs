//! One structured-generation executor for persona and Drill proposals.
use super::*;

pub(super) struct Output<T> {
    pub completion: Option<provider::Completion>,
    pub outcome: Result<T>,
}
pub(super) struct Task {
    pub messages: Vec<provider::PromptMessage>,
    pub schema: serde_json::Value,
    pub name: &'static str,
    pub max_output_tokens: i32,
}
pub(super) async fn execute<T>(
    state: &Application,
    request: &generation::Request,
    task: Task,
    parse: impl FnOnce(&Store, &provider::Completion) -> Result<T>,
) -> Output<T> {
    let mut provider_outcome = None;
    let outcome = async {
        let validate = || request.validate(&*state.lock()?);
        validate()?;
        let _permit = state.admission.try_chat().ok_or_else(|| {
            AppError::new(
                ErrorCode::AdmissionHeld,
                "AI work is at capacity. Try again when pending work finishes.",
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
        let dispatch = execution::Dispatch {
            temperature: execution::TASK_TEMPERATURE,
            target: request.target.clone(),
            attempt: request.attempt.clone(),
            operation: request.operation.clone(),
            credential: request.credential.clone(),
            model: request.target.model.clone(),
            route: request.target.route,
            install_id: request.install_id.clone(),
            messages: task.messages,
            gloss_schema: None,
            decisions: None,
            coaching_schema: None,
            gloss_source: None,
            speech_source: None,
        };
        {
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
                            max_output_tokens: task.max_output_tokens,
                            name: task.name,
                            schema: &task.schema,
                        },
                    )
                },
                validate,
                |error| generation_receipts::record_retry(&*state.lock()?, request, error),
            )
            .await,
        );
        let completed = provider_outcome
            .as_ref()
            .expect("provider outcome captured");
        let mut store = state.lock()?;
        generation::accept_completion(&mut store, request, completed)?;
        let value = parse(&store, completed.as_ref().map_err(Clone::clone)?)?;
        request.validate(&store)?;
        Ok(value)
    }
    .await;
    Output {
        completion: provider_outcome.and_then(std::result::Result::ok),
        outcome,
    }
}
