//! Exact transport contract identity; execution and consumer IDs are excluded.
use super::*;
use crate::ai::transport::{provider, text_request::TextRequest};

pub fn request_key(
    request: &TextRequest,
    output: provider::RequestOutput<'_>,
    contract: &str,
    context: &serde_json::Value,
) -> Result<String> {
    Ok(digest(&serde_json::to_vec(&serde_json::json!([
        "text-result-v1",
        contract,
        context,
        request.install_id,
        request.route,
        request.target.url,
        request.credential,
        provider::dispatch_payload(request, output)?
    ]))?))
}
