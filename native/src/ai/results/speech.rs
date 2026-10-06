//! Local speech identity uses exact wire inputs and access scope, never presentation owners.
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
pub fn request_key(scope: &str, input: &SpeechInput) -> Result<String> {
    Ok(digest(&serde_json::to_vec(&json!([
        "speech-local-v3",
        scope,
        input.text,
        input.language,
        input.language_tag
    ]))?))
}
pub fn lookup(
    db: &Connection,
    target: &ResolvedTarget,
    input: &SpeechInput,
    install: &str,
) -> Result<Option<Retained>> {
    let scope = scope(target, install)?;
    Ok(super::lookup(db, &request_key(&scope, input)?)?.filter(reusable_timing))
}

// Older decoders discarded every timestamp on an endpoint overrun. Keep those
// receipts/blobs intact, but let the next requested playback regenerate them.
// This is not a retry loop: new results retain timing and use a different reason.
fn reusable_timing(saved: &Retained) -> bool {
    let validation = &saved.metadata["diagnostics"]["alignmentValidation"];
    if ["original", "normalized"]
        .iter()
        .any(|lane| validation[lane]["status"] == "available")
    {
        return true;
    }
    !["original", "normalized"]
        .iter()
        .any(|lane| validation[lane]["reason"] == "timing_exceeds_audio_duration")
}

#[cfg(test)]
mod timing_tests {
    use super::*;

    #[test]
    fn only_legacy_discarded_timing_needs_regeneration() {
        for (reason, reusable) in [
            ("timing_exceeds_audio_duration", false),
            ("display_clipped_to_audio", true),
            ("available", true),
            ("not_supplied", true),
            ("invalid_provider_timing", true),
        ] {
            let saved = Retained {
                cached: true,
                execution: "saved".into(),
                payload: vec![1],
                metadata: json!({"diagnostics":{"alignmentValidation":{"original":{"reason":reason}}}}),
            };
            assert_eq!(reusable_timing(&saved), reusable);
        }
        let saved = Retained {
            cached: true,
            execution: "saved".into(),
            payload: vec![1],
            metadata: json!({"diagnostics":{"alignmentValidation":{
                "original":{"reason":"timing_exceeds_audio_duration","status":"unavailable"},
                "normalized":{"reason":"available","status":"available"}
            }}}),
        };
        assert!(reusable_timing(&saved));
    }
}
