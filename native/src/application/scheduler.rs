use super::*;

pub(super) async fn scheduler(state: Arc<Application>) {
    let client = match provider::client() {
        Ok(client) => client,
        Err(error) => {
            state.stop(error);
            return;
        }
    };
    loop {
        let mut groups: Vec<Vec<(execution::Dispatch, tokio::sync::OwnedSemaphorePermit)>> =
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
                if dispatch.speech_source.is_none()
                    && dispatch.route != ConnectionRoute::Openrouter
                    && let Some(group) = groups.iter_mut().find(|g| {
                        g.len() < grouped::MAX_ITEMS
                            && g[0].0.speech_source.is_none()
                            && grouped::compatible(&g[0].0, &dispatch)
                    })
                {
                    group.push((dispatch, permit));
                    continue;
                }
                groups.push(vec![(dispatch, permit)]);
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
            tauri::async_runtime::spawn(async move {
                let (dispatches, permits): (Vec<_>, Vec<_>) = group.into_iter().unzip();
                let mut permits: Vec<_> = permits.into_iter().map(Some).collect();
                let mut finished = vec![false; dispatches.len()];
                let result: Result<()> = async {
                    let first = &dispatches[0];
                    let key = if first.credential.is_empty() { Zeroizing::new(String::new()) }
                        else { read_secret(first.credential.clone()).await? };
                    // A group is captured under one authority; reject before HTTP
                    // if any item lost that authority during credential access.
                    for dispatch in &dispatches {
                        if !state.lock()?.attempt_active(&dispatch.attempt)? {
                            return Err(AppError::new(ErrorCode::Provider, "Operation revoked before grouped dispatch."));
                        }
                        holds::check(&state.lock()?.connection, &dispatch.target)?;
                    }
                    let schemas: Vec<_> = dispatches.iter().map(|d| match &d.gloss_source { Some(source) => linguistics::adapter::source_schema(&source.text).map_err(|_| gloss::validation_error()), None => Ok(linguistics::adapter::output_schema()) }).collect::<Result<Vec<_>>>()?;
                    let outputs: Vec<_> = dispatches.iter().zip(&schemas).map(|(dispatch,schema)| match dispatch.coaching_schema.as_ref() { Some(schema) => provider::RequestOutput::JsonSchema { name: "coaching", schema }, None => gloss::request_output(dispatch.gloss_source.as_ref(), schema) }).collect();
                    if let Some(source) = &first.speech_source {
                        let input = audio::SpeechInput { text: source.text.clone(), voice: source.voice.clone(), language: source.language.clone() };
                        let request = audio::synthesize(&client, &first.target, &key, &input, &first.install_id);
                        tokio::pin!(request);
                        let outcome = loop {
                            tokio::select! {
                                result = &mut request => break result,
                                _ = tokio::time::sleep(Duration::from_millis(100)) => {
                                    if !state.lock()?.attempt_active(&first.attempt)? {
                                        return Err(AppError::new(ErrorCode::UnknownOutcome, "Speech cancelled locally; provider billing may continue."));
                                    }
                                }
                            }
                        };
                        let mut store = state.lock()?;
                        if let Some(audio) = store.finish_speech(first, outcome)? {
                            store.speech_cache.insert(audio)?;
                        }
                        finished[0] = true;
                        permits[0].take();
                    } else if first.route == ConnectionRoute::Openrouter {
                        let request = provider::complete_with_output(&client, &key, first, outputs[0]);
                        tokio::pin!(request);
                        let outcome = loop {
                            tokio::select! {
                                result = &mut request => break result,
                                _ = tokio::time::sleep(Duration::from_millis(100)) => {
                                    if !state.lock()?.attempt_active(&first.attempt)? {
                                        return Err(AppError::new(ErrorCode::UnknownOutcome, "Request cancelled locally; provider billing may continue."));
                                    }
                                }
                            }
                        };
                        state.lock()?.finish(first, outcome)?;
                        finished[0] = true;
                        permits[0].take();
                    } else {
                        let request = grouped::request_with_outputs(&client, &key, &dispatches, &outputs, |index, outcome| {
                            state.lock()?.finish(&dispatches[index], outcome)?;
                            finished[index] = true;
                            permits[index].take();
                            Ok(())
                        });
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
                                store.finish(dispatch, Err(error))
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
