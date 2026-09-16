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
    let mut response=request.send().await.map_err(|_|AppError::new(ErrorCode::UnknownOutcome,"Provider outcome unknown: connection interrupted or timed out. A charge may have occurred. No automatic retry was made."))?;
    if !response.status().is_success() && route == ConnectionRoute::Hosted {
        return match crate::ai::hosted::body(response).await {
            Err(error) => Err(error),
            Ok(_) => Err(malformed()),
        };
    }
    if !response.status().is_success() {
        if let Some(message) = crate::ai::connections::auth_errors::message(
            route,
            response.url().as_str(),
            "Chat",
            response.status().as_u16(),
        ) {
            return Err(AppError::new(ErrorCode::Provider, message));
        }

        let error = AppError::new(
            ErrorCode::Provider,
            format!(
                "{} HTTP {}. Check sign-in, allowance and model access in Settings. No automatic retry was made.",
                route.label(),
                response.status().as_u16()
            ),
        );
        return Err(if response.status().as_u16() == 429 {
            error.with_refusal(crate::ai::policy::refusal::from_response(&response))
        } else {
            error
        });
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| malformed())? {
        if bytes.len() + chunk.len() > 262144 {
            return Err(malformed());
        }
        bytes.extend_from_slice(&chunk);
    }
    decode(&bytes)
}

#[cfg(test)]
#[path = "tests/request.rs"]
mod tests;
