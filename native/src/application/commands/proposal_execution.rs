//! One structured-generation executor for persona and Drill proposals.
use super::*;
use crate::ai::results;
use serde_json::json;

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

struct ConsumerGuard {
    state: Arc<Application>,
    request: Arc<generation::Request>,
    received: bool,
}
impl Drop for ConsumerGuard {
    fn drop(&mut self) {
        if self.received {
            return;
        }
        self.request.cancel();
        let settled = (|| {
            let mut store = self.state.lock()?;
            if store.snapshot()?.learner.id != self.request.install_id {
                return Ok(());
            }
            generation_receipts::cancel(&mut store, &self.request)
        })();
        if let Err(error) = settled {
            crate::diagnostics::failures::report("proposal_consumer_cancellation", &error);
        }
    }
}

pub(super) async fn execute<T: Send + 'static>(
    state: &Arc<Application>,
    request: Arc<generation::Request>,
    task: Task,
    parse: impl FnOnce(&Store, &generation::Request, &provider::Completion) -> Result<T>
    + Send
    + 'static,
) -> Output<T> {
    let mut consumer = ConsumerGuard {
        state: state.clone(),
        request: request.clone(),
        received: false,
    };
    let state = state.clone();
    let (sender, receiver) = tokio::sync::oneshot::channel();
    // A proposal is intentionally fresh: no cache lookup and no prompt deduplication.
    // The detached worker owns settlement if its command future disappears.
    tokio::spawn(async move {
        let output = produce(&state, &request, task, parse, || !sender.is_closed()).await;
        if let Err(output) = sender.send(output) {
            let outcome: Result<()> = Err(AppError::new(
                if request.was_submitted() {
                    ErrorCode::UnknownOutcome
                } else {
                    ErrorCode::Conflict
                },
                "Proposal consumer closed. Its result was not adopted.",
            ));
            let settled = (|| {
                let mut store = state.lock()?;
                if store.snapshot()?.learner.id != request.install_id {
                    return Ok(());
                }
                generation_receipts::finish(
                    &mut store,
                    &request,
                    output.completion.as_ref(),
                    &outcome,
                )
            })();
            if let Err(error) = settled {
                crate::diagnostics::failures::report("proposal_consumer_settlement", &error);
            }
        }
    });
    let output = receiver.await.unwrap_or_else(|_| Output {
        completion: None,
        outcome: Err(AppError::new(
            ErrorCode::UnknownOutcome,
            "Proposal execution ended before reporting its outcome.",
        )),
    });
    consumer.received = true;
    output
}

async fn produce<T>(
    state: &Application,
    request: &generation::Request,
    task: Task,
    parse: impl FnOnce(&Store, &generation::Request, &provider::Completion) -> Result<T>,
    consumer_alive: impl Fn() -> bool,
) -> Output<T> {
    let execution = uuid::Uuid::new_v4().to_string();
    let begun = (|| -> Result<()> {
        let store = state.lock()?;
        request.validate(&store)?;
        let tx = store.connection.unchecked_transaction()?;
        results::begin(&tx, &execution, request.kind)?;
        results::associate(&tx, &request.id, &execution)?;
        tx.commit()?;
        Ok(())
    })();
    if let Err(error) = begun {
        return Output {
            completion: None,
            outcome: Err(error),
        };
    }
    let mut provider_outcome = None;
    let mut outcome = async {
        let check_consumer = || {
            if consumer_alive() {
                Ok(())
            } else {
                Err(AppError::new(
                    ErrorCode::Conflict,
                    "Proposal consumer closed before dispatch.",
                ))
            }
        };
        let validate = || {
            check_consumer()?;
            request.validate(&*state.lock()?)
        };
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
        let dispatch = crate::ai::transport::text_request::TextRequest {
            temperature: crate::ai::connections::model_routing::TASK_TEMPERATURE,
            target: request.target.clone(),
            attempt: request.attempt.clone(),
            operation: request.operation.clone(),
            credential: request.credential.clone(),
            model: request.target.model.clone(),
            route: request.target.route,
            install_id: request.install_id.clone(),
            messages: task.messages,

            decisions: None,
        };
        {
            let mut store = state.lock()?;
            check_consumer()?;
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
                || request.validate_execution(&*state.lock()?),
                |error| results::record_retry(&state.lock()?.connection, &execution, error),
            )
            .await,
        );
        let completed = provider_outcome
            .as_ref()
            .expect("provider outcome captured");
        let mut store = state.lock()?;
        if store.snapshot()?.learner.id != request.install_id {
            return Err(AppError::new(
                ErrorCode::SessionExpired,
                "Workspace changed during proposal execution.",
            ));
        }
        generation::accept_completion(&mut store, request, completed)?;
        let value = parse(&store, request, completed.as_ref().map_err(Clone::clone)?)?;
        Ok(value)
    }
    .await;
    let completion = provider_outcome.and_then(std::result::Result::ok);
    let private = [
        &request.credential,
        request.brief.as_deref().unwrap_or_default(),
        completion
            .as_ref()
            .map(|c| c.text.as_str())
            .unwrap_or_default(),
    ];
    let mut metadata = json!({
        "requestedModel":request.target.model,"route":request.target.route.label(),
        "attemptId":request.attempt,"operationId":request.operation,
        "actualModel":completion.as_ref().map(|c| &c.actual_model),
        "providerId":completion.as_ref().map(|c| &c.provider_id),
        "finishReason":completion.as_ref().map(|c| &c.finish_reason),
        "inputTokens":completion.as_ref().and_then(|c| c.input_tokens),
        "outputTokens":completion.as_ref().and_then(|c| c.output_tokens),
        "diagnostics":completion.as_ref().and_then(|c| c.diagnostics.as_ref()).map(|v| crate::diagnostics::response::metadata(v, &private)),
        "error":outcome.as_ref().err().map(|e| crate::diagnostics::response::error_metadata(e, &private)),
    });
    let settled = (|| -> Result<()> {
        let store = state.lock()?;
        if store.snapshot()?.learner.id != request.install_id {
            return Err(AppError::new(
                ErrorCode::SessionExpired,
                "Workspace changed during proposal settlement.",
            ));
        }
        let finished = results::finish(
            &store.connection,
            &execution,
            &execution,
            &metadata,
            None,
            outcome.as_ref().err(),
        );
        if let Err(error) = &finished {
            // A failed terminal update must still retain known response facts if
            // metadata writes remain possible. The command continues to fail.
            metadata["storageError"] = crate::diagnostics::response::error_metadata(error, &[]);
            if let Err(error) = store.connection.execute(
                "UPDATE inference_executions SET metadata=CASE WHEN json_type(metadata,'$.retry') IS NOT NULL THEN json_set(?2,'$.retry',json_extract(metadata,'$.retry')) ELSE ?2 END WHERE id=?1 AND state='pending'",
                rusqlite::params![execution, metadata.to_string()],
            ) {
                metadata["receiptMetadataError"] =
                    crate::diagnostics::response::error_metadata(&error.into(), &[]);
            }
        }
        finished
    })();
    if let Err(mut error) = settled {
        error.diagnostics = Some(json!({"sourceExecutionId":execution,"response":metadata}));
        outcome = Err(error);
    }
    Output {
        completion,
        outcome,
    }
}
