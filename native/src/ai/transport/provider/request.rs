use super::{Completion, RequestOutput};
use crate::model::{AppError, ErrorCode, Result};
use std::time::Duration;
pub fn client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(90))
        .connect_timeout(Duration::from_secs(15))
        .build()
        .map_err(|cause| {
            crate::diagnostics::response::network_context(
                &cause,
                "http_client",
                AppError::new(
                    ErrorCode::Provider,
                    "Could not initialize the secure HTTP client.",
                ),
            )
        })
}
pub async fn complete(
    client: &reqwest::Client,
    key: &str,
    dispatch: &crate::ai::transport::text_request::TextRequest,
) -> Result<Completion> {
    crate::ai::transport::grouped::complete(client, key, dispatch).await
}
pub async fn complete_with_output(
    client: &reqwest::Client,
    key: &str,
    dispatch: &crate::ai::transport::text_request::TextRequest,
    output: RequestOutput<'_>,
) -> Result<Completion> {
    crate::ai::transport::grouped::complete_with_output(client, key, dispatch, output).await
}
