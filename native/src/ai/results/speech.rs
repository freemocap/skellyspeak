//! Speech request identity uses effective service inputs, never presentation owners.
use super::*;
use crate::ai::{audio::SpeechInput, connections::access::ResolvedTarget};
use serde_json::json;

pub fn scope(target: &ResolvedTarget, install: &str) -> Result<String> {
    Ok(digest(&serde_json::to_vec(&json!([
        install,
        target.route,
        target.url,
        target.model,
        target.credential
    ]))?))
}
pub fn request_key(scope: &str, input: &SpeechInput, profile: &str) -> Result<String> {
    Ok(digest(&serde_json::to_vec(&json!([
        "speech-v1",
        scope,
        profile,
        input.text,
        input.language
    ]))?))
}
pub fn lookup(
    db: &Connection,
    target: &ResolvedTarget,
    input: &SpeechInput,
    install: &str,
) -> Result<Option<Retained>> {
    let scope = scope(target, install)?;
    let Some(profile) = super::profile(db, &scope)? else {
        return Ok(None);
    };
    super::lookup(db, &request_key(&scope, input, &profile)?)
}
