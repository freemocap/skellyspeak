#[cfg(test)]
use super::PromptMessage;
use super::response::malformed;
use super::{Completion, RequestOutput, decode, dispatch_payload};
use crate::model::{AppError, ConnectionRoute, ErrorCode, Result};
use std::time::Duration;

pub fn client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(90))
        .connect_timeout(Duration::from_secs(15))
        .build()
        .map_err(|_| {
            AppError::new(
                ErrorCode::Provider,
                "Could not initialize the secure HTTP client.",
            )
        })
}
pub async fn complete(
    client: &reqwest::Client,
    key: &str,
    dispatch: &crate::conversations::execution::Dispatch,
) -> Result<Completion> {
    if dispatch.route != ConnectionRoute::Openrouter {
        return crate::ai::transport::grouped::complete(client, key, dispatch).await;
    }
    request_payload(
        client,
        &dispatch.target.url,
        key,
        dispatch.route,
        &dispatch.install_id,
        dispatch_payload(dispatch, RequestOutput::Prose)?,
    )
    .await
}
/// Explicit structured transport entry point. Existing callers remain prose-only.
pub async fn complete_with_output(
    client: &reqwest::Client,
    key: &str,
    dispatch: &crate::conversations::execution::Dispatch,
    output: RequestOutput<'_>,
) -> Result<Completion> {
    if matches!(output, RequestOutput::Prose) {
        return complete(client, key, dispatch).await;
    }
    if dispatch.route != ConnectionRoute::Openrouter {
        return crate::ai::transport::grouped::complete_with_output(client, key, dispatch, output)
            .await;
    }
    let body = dispatch_payload(dispatch, output)?;
    request_payload(
        client,
        &dispatch.target.url,
        key,
        dispatch.route,
        &dispatch.install_id,
        body,
    )
    .await
}

#[cfg(test)]
async fn request(
    client: &reqwest::Client,
    url: &str,
    key: &str,
    model: &str,
    messages: &[PromptMessage],
    route: ConnectionRoute,
    install: &str,
) -> Result<Completion> {
    request_payload(
        client,
        url,
        key,
        route,
        install,
        super::payload(model, messages, route)?,
    )
    .await
}

async fn request_payload(
    client: &reqwest::Client,
    url: &str,
    key: &str,
    route: ConnectionRoute,
    install: &str,
    payload: serde_json::Value,
) -> Result<Completion> {
    let request = client.post(url).json(&payload);
    let request = if key.is_empty() {
        request
    } else {
        request.bearer_auth(key)
    };
    let request = if route == ConnectionRoute::Hosted {
        crate::ai::hosted::identity(request, install)
    } else {
        request
    };
    let private: Vec<&str> = payload["messages"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|m| m["content"].as_str())
        .chain(std::iter::once(key))
        .collect();
    let mut response = request
        .send()
        .await
        .map_err(|e| crate::diagnostics::response::network(&e, "chat_request"))?;
    if !response.status().is_success() && route == ConnectionRoute::Hosted {
        return match crate::ai::hosted::body_with_private(response, &private).await {
            Err(error) => Err(error),
            Ok(_) => Err(malformed()),
        };
    }
    if !response.status().is_success() {
        return Err(crate::diagnostics::response::http_error(response, "Chat", &private).await);
    }
    let http = crate::diagnostics::response::headers(&response);
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| malformed())? {
        if bytes.len() + chunk.len() > 262144 {
            return Err(malformed());
        }
        bytes.extend_from_slice(&chunk);
    }
    let mut result = decode(&bytes);
    attach_http(&mut result, http, &private);
    result
}

/// Record the HTTP facts on a result, then redact its diagnostics.
fn attach_http(result: &mut Result<Completion>, http: serde_json::Value, private: &[&str]) {
    let diagnostics = match result {
        Ok(value) => &mut value.diagnostics,
        Err(error) => &mut error.diagnostics,
    };
    diagnostics.get_or_insert_with(|| serde_json::json!({}))["http"] = http;
    *diagnostics = diagnostics
        .as_ref()
        .map(|v| crate::diagnostics::response::metadata(v, private));
}

fn stream_error(message: &str, diagnostics: serde_json::Value) -> AppError {
    let mut error = AppError::new(ErrorCode::Provider, message);
    error.diagnostics = Some(diagnostics);
    error
}

/// Prose on the direct route, streamed. `on_delta` receives the full text so
/// far each time it grows. A completed stream is decoded exactly like a
/// non-streaming response; a failed one reports what arrived without its text.
pub async fn complete_streaming(
    client: &reqwest::Client,
    key: &str,
    dispatch: &crate::conversations::execution::Dispatch,
    mut on_delta: impl FnMut(&str),
) -> Result<Completion> {
    use crate::ai::transport::streaming::{CompletionAccumulator, SseFramer, StreamEnd};
    if dispatch.route != ConnectionRoute::Openrouter {
        return complete(client, key, dispatch).await;
    }
    let mut body = dispatch_payload(dispatch, RequestOutput::Prose)?;
    body["stream"] = serde_json::json!(true);
    // OpenRouter reports usage and cost in the final chunk only when asked.
    body["usage"] = serde_json::json!({"include": true});
    let request = client.post(&dispatch.target.url).json(&body);
    let request = if key.is_empty() {
        request
    } else {
        request.bearer_auth(key)
    };
    let private: Vec<&str> = dispatch
        .messages
        .iter()
        .map(|m| m.content.as_str())
        .chain(std::iter::once(key))
        .collect();
    let mut response = request
        .send()
        .await
        .map_err(|e| crate::diagnostics::response::network(&e, "chat_request"))?;
    if !response.status().is_success() {
        return Err(crate::diagnostics::response::http_error(response, "Chat", &private).await);
    }
    let http = crate::diagnostics::response::headers(&response);
    let mut framer = SseFramer::default();
    let mut accumulator = CompletionAccumulator::default();
    // A framing or limit failure while reading; None means the body ended.
    let mut failure: Option<AppError> = None;
    loop {
        let chunk = match response.chunk().await {
            Ok(Some(chunk)) => chunk,
            Ok(None) => break,
            Err(_) => {
                failure = Some(stream_error(
                    "The AI service's streamed reply broke off. Usage may have been incurred; no automatic retry was made.",
                    accumulator.partial_diagnostics("connection_lost"),
                ));
                break;
            }
        };
        let mut grew = false;
        let pushed = framer.push(&chunk, |event| {
            grew |= accumulator.accept(&event)?;
            Ok(())
        });
        if grew {
            on_delta(accumulator.text());
        }
        if let Err(mut error) = pushed {
            // Framing and size failures must retain facts received before the
            // failure, just like provider errors and an interrupted connection.
            let mut details = accumulator.partial_diagnostics("stream_failure");
            if let Some(serde_json::Value::Object(cause)) = error.diagnostics.take() {
                for (key, value) in cause {
                    details[key] = value;
                }
            }
            error.diagnostics = Some(details);
            failure = Some(error);
            break;
        }
    }
    // Providers can echo already streamed content in their error metadata.
    let mut private = private;
    if !accumulator.text().is_empty() {
        private.push(accumulator.text());
    }
    let mut result = match (failure, accumulator.end()) {
        (Some(error), _) => Err(error),
        (None, StreamEnd::Completed) => {
            decode(&serde_json::to_vec(&accumulator.completion_json())?)
        }
        (None, StreamEnd::ProviderError) => {
            let reason = accumulator
                .error_payload()
                .map(|error| crate::diagnostics::response::metadata(error, &private))
                .and_then(|error| crate::diagnostics::response::reason(&error).map(str::to_owned));
            Err(stream_error(
                &match reason {
                    Some(reason) => format!(
                        "The AI service reported an error during the reply. Provider reason: {reason}"
                    ),
                    None => "The AI service reported an error during the reply.".into(),
                },
                accumulator.partial_diagnostics("provider_error"),
            ))
        }
        (None, StreamEnd::TransportBroken) => Err(stream_error(
            "The AI service's streamed reply broke off. Usage may have been incurred; no automatic retry was made.",
            accumulator.partial_diagnostics("transport_broken"),
        )),
    };
    attach_http(&mut result, http, &private);
    result
}

#[cfg(test)]
#[path = "tests/request.rs"]
mod tests;
