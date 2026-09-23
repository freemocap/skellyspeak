use super::*;

impl Application {
    fn check_dispatches(&self, dispatches: &[execution::Dispatch]) -> Result<()> {
        let store = self.lock()?;
        for dispatch in dispatches {
            if !store.attempt_active(&dispatch.attempt)? {
                return Err(AppError::new(
                    ErrorCode::Provider,
                    "Operation revoked before dispatch.",
                ));
            }
            holds::check(&store.connection, &dispatch.target)?;
            let capability = if dispatch.speech_source.is_some() {
                access::Capability::Speech
            } else {
                access::Capability::Chat
            };
            let mut current = access::resolve(&store.connection, capability)?;
            if dispatch.decisions.is_some() && current.route == ConnectionRoute::Openrouter {
                current.url = provider::decisions::URL.into();
            }
            if current.route != dispatch.target.route
                || current.url != dispatch.target.url
                || current.credential != dispatch.target.credential
            {
                return Err(AppError::new(
                    ErrorCode::Conflict,
                    "AI destination or credentials changed before dispatch. Retry using current settings.",
                ));
            }
        }
        Ok(())
    }

    // The probe is an asynchronous boundary: cancellation, credential revocation
    // and admission holds may have changed while it was in flight.
    async fn prepare_grouped(
        &self,
        client: &reqwest::Client,
        key: &str,
        dispatches: &[execution::Dispatch],
    ) -> Result<bool> {
        let deltas = self.grouped_deltas(client, key, &dispatches[0]).await;
        self.check_dispatches(dispatches)?;
        Ok(deltas)
    }
}

pub(super) async fn scheduler(state: Arc<Application>, app: tauri::AppHandle) {
    let client = match provider::client() {
        Ok(client) => client,
        Err(error) => {
            state.stop(error);
            return;
        }
    };
    loop {
        // Each dispatch carries the stream generation it was registered under.
        let mut groups: Vec<Vec<(execution::Dispatch, tokio::sync::OwnedSemaphorePermit, u32)>> =
            Vec::new();
        // Bounded local planning pass; no timer or artificial batch-fill delay.
        for _ in 0..128 {
            let Some(permit) = state.admission.try_chat() else {
                match state.lock().and_then(|store| store.has_ready_work()) {
                    Ok(true) => state.admission.warn_chat_wait(),
                    Ok(false) => {}
                    Err(error) => {
                        state.stop(error);
                        return;
                    }
                }
                break;
            };
            let dispatch = match state.lock().and_then(|mut store| store.dispatch()) {
                Ok(value) => value,
                Err(error) => {
                    state.stop(error);
                    return;
                }
            };
            if let Some(dispatch) = dispatch {
                let generation = if dispatch.speech_source.is_none() {
                    state.register_stream(&dispatch)
                } else {
                    0
                };
                if dispatch.speech_source.is_none()
                    && dispatch.route != ConnectionRoute::Openrouter
                    && let Some(group) = groups.iter_mut().find(|g| {
                        g.len() < grouped::MAX_ITEMS
                            && g[0].0.speech_source.is_none()
                            && grouped::compatible(&g[0].0, &dispatch)
                    })
                {
                    group.push((dispatch, permit, generation));
                    continue;
                }
                groups.push(vec![(dispatch, permit, generation)]);
            } else {
                drop(permit);
                match state.lock().and_then(|store| store.has_ready_work()) {
                    Ok(true) => continue,
                    Ok(false) => break,
                    Err(error) => {
                        state.stop(error);
                        return;
                    }
                }
            }
        }
        for group in groups {
            let state = state.clone();
            let client = client.clone();
            let app = app.clone();
            tauri::async_runtime::spawn(async move {
                let mut dispatches = Vec::new();
                let mut permits = Vec::new();
                let mut generations = Vec::new();
                for (dispatch, permit, generation) in group {
                    dispatches.push(dispatch);
                    permits.push(permit);
                    generations.push(generation);
                }
                let mut permits: Vec<_> = permits.into_iter().map(Some).collect();
                let mut finished = vec![false; dispatches.len()];
                let result: Result<()> = async {
                    let first = &dispatches[0];
                    let key = if first.credential.is_empty() { Zeroizing::new(String::new()) }
                        else { read_secret(first.credential.clone()).await? };
                    // A group is captured under one authority; reject before HTTP
                    // if any item lost that authority during credential access.
                    state.check_dispatches(&dispatches)?;
                    let outputs: Vec<_> = dispatches.iter().map(|dispatch| {
                        if let Some(schema) = dispatch.coaching_schema.as_ref() {
                            Ok(provider::structured_output(schema))
                        } else if dispatch.gloss_source.is_some() {
                            let schema = dispatch.gloss_schema.as_ref().ok_or_else(gloss::validation_error)?;
                            Ok(gloss::request_output(dispatch.gloss_source.as_ref(), schema))
                        } else {
                            Ok(provider::RequestOutput::Prose)
                        }
                    }).collect::<Result<Vec<_>>>()?;
                    if let Some(source) = &first.speech_source {
                        let input = audio::SpeechInput { text: source.text.clone(), voice: source.voice.clone(), language: source.language.clone() };
                        let outcome = retry::run(
                            || audio::synthesize(&client, &first.target, &key, &input, &first.install_id),
                            || state.check_dispatches(std::slice::from_ref(first)),
                            |error| state.lock()?.record_retry(first, error),
                        ).await;
                        let mut store = state.lock()?;
                        if let Some(audio) = store.finish_speech(first, outcome)? {
                            store.speech_cache.insert(audio)?;
                        }
                        finished[0] = true;
                        permits[0].take();
                    } else if first.route == ConnectionRoute::Openrouter {
                        // Prose streams; structured requests stay whole until
                        // structured deltas are verified (plan D4).
                        let request = || async {
                            if first.decisions.is_some() {
                                provider::decisions::complete(&client, &key, first).await
                            } else if matches!(outputs[0], provider::RequestOutput::Prose) {
                                provider::complete_streaming(&client, &key, first, |text| state.stream_delta(generations[0], &first.attempt, text)).await
                            } else {
                                provider::complete_with_output(&client, &key, first, outputs[0]).await
                            }
                        };
                        let outcome = retry::run(
                            request,
                            || state.check_dispatches(std::slice::from_ref(first)),
                            |error| state.lock()?.record_retry(first, error),
                        ).await;
                        state.finish_attempt(&app, generations[0], first, outcome)?;
                        finished[0] = true;
                        permits[0].take();
                    } else {
                        // Version 2 streams prose items' text; an older or
                        // custom server keeps the whole-result protocol.
                        let deltas = state.prepare_grouped(&client, &key, &dispatches).await?;
                        let request = grouped::request_streaming(&client, &key, &dispatches, &outputs, deltas, |index, outcome| {
                            state.finish_attempt(&app, generations[index], &dispatches[index], outcome)?;
                            finished[index] = true;
                            permits[index].take();
                            Ok(())
                        }, |index, text| state.stream_delta(generations[index], &dispatches[index].attempt, text));
                        tokio::pin!(request);
                        loop {
                            tokio::select! {
                                result = &mut request => { result?; break; },
                                _ = tokio::time::sleep(Duration::from_millis(100)) => {
                                    let store = state.lock()?;
                                    let mut active = false;
                                    for dispatch in &dispatches { active |= store.attempt_active(&dispatch.attempt)?; }
                                    if !active { break; }
                                }
                            }
                        }
                    }
                    Ok(())
                }.await;
                // A broken stream must not overwrite already committed siblings.
                for (index, dispatch) in dispatches.iter().enumerate() {
                    if !finished[index] {
                        let error = result.as_ref().err().cloned().unwrap_or_else(|| AppError::new(ErrorCode::UnknownOutcome, "Grouped operation has no confirmed result. No automatic retry was made."));
                        if let Err(error) = state.lock().and_then(|mut store| {
                            if dispatch.speech_source.is_some() {
                                store
                                    .finish_speech(
                                        dispatch,
                                        audio::SpeechOutcome {
                                            diagnostics: None,
                                            audio: Err(error),
                                            transcript_diagnostics: None,
                                            actual_model: None,
                                            provider_id: None,
                                            input_tokens: None,
                                            output_tokens: None,
                                            cost_micros: None,
                                            finish_reason: None,
                                        },
                                    )
                                    .map(|_| ())
                            } else {
                                drop(store);
                                state.finish_attempt(&app, generations[index], dispatch, Err(error))
                            }
                        }) {
                            state.stop(error);
                        }
                    }
                }
            });
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}

#[cfg(test)]
#[path = "tests/scheduler.rs"]
mod tests;
