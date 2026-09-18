use super::response::malformed;
use super::{Completion, PromptMessage, RequestOutput, decode, payload, payload_with_output};
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
    let url = &dispatch.target.url;
    request(
        client,
        url,
        key,
        &dispatch.model,
        &dispatch.messages,
        dispatch.route,
        &dispatch.install_id,
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
    let body = payload_with_output(&dispatch.model, &dispatch.messages, dispatch.route, output)?;
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
        payload(model, messages, route)?,
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
    match &mut result {
        Ok(value) => {
            value
                .diagnostics
                .get_or_insert_with(|| serde_json::json!({}))["http"] = http;
        }
        Err(error) => {
            error
                .diagnostics
                .get_or_insert_with(|| serde_json::json!({}))["http"] = http;
        }
    }
    match &mut result {
        Ok(value) => {
            value.diagnostics = value
                .diagnostics
                .as_ref()
                .map(|v| crate::diagnostics::response::metadata(v, &private))
        }
        Err(error) => {
            error.diagnostics = error
                .diagnostics
                .as_ref()
                .map(|v| crate::diagnostics::response::metadata(v, &private))
        }
    }
    result
}

#[cfg(test)]
#[path = "tests/request.rs"]
mod tests;
