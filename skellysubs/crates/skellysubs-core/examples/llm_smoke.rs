//! Live smoke test: run the real translation orchestrator against a real
//! OpenAI-compatible endpoint.
//!
//! Usage:
//!   cargo run -p skellysubs-core --example llm_smoke -- <base_url> <model> [api_key]
//!
//! LM Studio (local, default, no key):
//!   cargo run -p skellysubs-core --example llm_smoke
//!   cargo run -p skellysubs-core --example llm_smoke -- http://localhost:1234/v1 google/gemma-4-e4b
//!
//! OpenAI:
//!   cargo run -p skellysubs-core --example llm_smoke -- https://api.openai.com/v1 gpt-4o-mini sk-YOURKEY

use skellysubs_core::languages;
use skellysubs_core::llm::OpenAiCompatibleClient;
use skellysubs_core::models::{TranscriptSegment, Transcription, WordTimestamp};
use skellysubs_core::translation::pipeline::translate_utterance;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let base_url = args
        .first()
        .cloned()
        .unwrap_or_else(|| "http://localhost:1234/v1".into());
    let model = args
        .get(1)
        .cloned()
        .unwrap_or_else(|| "google/gemma-4-e4b".into());
    let api_key = args.get(2).cloned().filter(|k| !k.is_empty());

    println!("base_url: {base_url}");
    println!("model:    {model}");
    println!("api_key:  {}", if api_key.is_some() { "(set)" } else { "(none)" });

    let client = OpenAiCompatibleClient::new(&base_url, &model, api_key).expect("build client");
    let target = languages::get("spanish").expect("spanish config exists");

    let transcription = Transcription {
        language: "english".into(),
        text: "Hello, my name is Jon. Nice to meet you.".into(),
        segments: vec![TranscriptSegment {
            start_ms: 0,
            end_ms: 3000,
            text: "Hello, my name is Jon. Nice to meet you.".into(),
            words: vec![
                WordTimestamp { start_ms: 0, end_ms: 500, text: "Hello".into(), index_in_segment: 0, index_in_transcript: 0 },
                WordTimestamp { start_ms: 600, end_ms: 900, text: "my".into(), index_in_segment: 1, index_in_transcript: 1 },
                WordTimestamp { start_ms: 900, end_ms: 1300, text: "name".into(), index_in_segment: 2, index_in_transcript: 2 },
                WordTimestamp { start_ms: 1300, end_ms: 1600, text: "is".into(), index_in_segment: 3, index_in_transcript: 3 },
                WordTimestamp { start_ms: 1600, end_ms: 1900, text: "Jon".into(), index_in_segment: 4, index_in_transcript: 4 },
            ],
        }],
    };

    println!("\n--- translating '{}' into {} ---\n", transcription.text, target.language_name);

    match translate_utterance(&client, &transcription, &target, "English") {
        Ok(out) => {
            println!("FULL TEXT: {}", out.full_text.translated_text);
            if let Some(r) = &out.full_text.romanized_text {
                println!("ROMANIZED: {r}");
            }
            for (i, seg) in out.matched_segments.iter().enumerate() {
                println!("SEGMENT {i}: {}", seg.translated_segment_text);
                for w in &seg.matched_translated_words {
                    println!("  {} -> {}", w.original_word_text, w.translated_word_text);
                }
            }
            println!("\nSMOKE TEST PASSED");
        }
        Err(e) => {
            eprintln!("SMOKE TEST FAILED: {e}");
            std::process::exit(1);
        }
    }
}
