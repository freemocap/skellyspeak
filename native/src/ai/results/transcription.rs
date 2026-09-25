//! Exact recording request identity. Recording/product owners are not cache identity.
use super::*;
use crate::ai::{audio::TranscriptionRequest, connections::access::ResolvedTarget};

pub fn request_key(
    target: &ResolvedTarget,
    input: &TranscriptionRequest,
    install: &str,
) -> Result<String> {
    Ok(digest(&serde_json::to_vec(&serde_json::json!([
        "transcription-local-v1",
        install,
        target.route,
        target.url,
        target.model,
        target.credential,
        digest(&input.wav),
        input.language.language_id,
        input.language.variety_id,
        input.language.language_tag,
        input.context,
        "audio/wav",
        "json"
    ]))?))
}
