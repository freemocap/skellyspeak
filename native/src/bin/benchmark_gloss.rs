//! Offline benchmark boundary: build real app prompts and validate saved completions.
//! No network, credentials, database or app state is accessed.
use serde_json::{Value, json};
use skellyspeak_core::{
    linguistics::{ANALYSIS_VERSION, SourceIdentity, adapter},
    provider::Completion,
};
use std::{env, fs};
fn cases() -> Vec<Value> {
    [("Arabic", "ar", "أحب الكتب."), ("Arabic", "ar", "أُحِبُّ القراءةَ في البيتِ."),
     ("Mandarin", "zh", "我喜欢看书。"), ("Spanish", "es", "Me gusta cocinar en casa.")]
    .into_iter().enumerate().map(|(index, (language, id, source))| {
        let identity = SourceIdentity { message_id: format!("native-gloss-{index}"), target_language_id: id.into(),
            explanation_language_id: "en".into(), analysis_version: ANALYSIS_VERSION.into() };
        let prompt = adapter::build_word_gloss_prompt(&identity, source).expect("synthetic language supported");
        json!({"id":identity.message_id,"task":"gloss","language":language,"languageId":id,"source":source,
            "messages":prompt.messages,"schema":prompt.output_schema,"template":prompt.template_id})
    }).collect()
}
fn split_cases() -> Vec<Value> {
    let mut result = Vec::new();
    for (language, id, sentences) in [
        (
            "Spanish",
            "es",
            [
                "Hoy estoy cansado.",
                "Me gusta cocinar en casa.",
                "Mi hermana prepara sopa.",
                "Después vamos a leer.",
            ],
        ),
        (
            "Arabic",
            "ar",
            [
                "أنا متعب اليوم.",
                "أحب الطبخ في البيت.",
                "أختي تطبخ الحساء.",
                "بعد ذلك نقرأ كتابا.",
            ],
        ),
    ] {
        let paragraph = sentences.join(" ");
        let mut targets = vec![("whole".to_string(), paragraph.clone())];
        targets.extend(
            sentences
                .iter()
                .enumerate()
                .map(|(i, source)| (i.to_string(), source.to_string())),
        );
        for (part, source) in targets {
            let identity = SourceIdentity {
                message_id: format!("split-{id}-{part}"),
                target_language_id: id.into(),
                explanation_language_id: "en".into(),
                analysis_version: ANALYSIS_VERSION.into(),
            };
            let mut prompt = adapter::build_word_gloss_prompt(&identity, &source).unwrap();
            if part != "whole" {
                prompt.messages[0].content.push_str(" The full_passage_for_context field supplies surrounding context only. Annotate only passage using its supplied grapheme IDs; never annotate the surrounding context.");
                let mut data: Value = serde_json::from_str(&prompt.messages[1].content).unwrap();
                data["full_passage_for_context"] = json!(paragraph);
                prompt.messages[1].content = data.to_string();
            }
            result.push(json!({"id":identity.message_id,"task":"gloss","language":language,"languageId":id,"source":source,
                "group":id,"part":part,"messages":prompt.messages,"schema":prompt.output_schema,"template":prompt.template_id}));
        }
    }
    result
}
fn main() {
    let args: Vec<_> = env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("export-split") => {
            println!("{}", serde_json::to_string_pretty(&split_cases()).unwrap())
        }
        Some("export") => println!("{}", serde_json::to_string_pretty(&cases()).unwrap()),
        Some("validate") => {
            let input = fs::read_to_string(args.get(2).expect("results JSONL path")).unwrap();
            let mut fixtures = cases();
            fixtures.extend(split_cases());
            for line in input.lines() {
                let record: Value = serde_json::from_str(line).unwrap();
                let case = fixtures
                    .iter()
                    .find(|c| c["id"] == record["fixture"])
                    .expect("known fixture");
                let identity = SourceIdentity {
                    message_id: case["id"].as_str().unwrap().into(),
                    target_language_id: case["languageId"].as_str().unwrap().into(),
                    explanation_language_id: "en".into(),
                    analysis_version: ANALYSIS_VERSION.into(),
                };
                let completion = Completion {
                    text: record["content"].as_str().unwrap_or("").into(),
                    finish_reason: record["finishReason"].as_str().unwrap_or("").into(),
                    actual_model: record["actualModel"].as_str().unwrap_or("").into(),
                    provider_id: "benchmark".into(),
                    input_tokens: None,
                    output_tokens: None,
                };
                let outcome = match adapter::validate_word_gloss_completion(
                    &identity,
                    case["source"].as_str().unwrap(),
                    &completion,
                ) {
                    Ok(analysis) => {
                        json!({"accepted":true,"coverage":format!("{:?}",analysis.coverage()),"segments":analysis.segments().len(),"glossCount":analysis.gloss_count()})
                    }
                    Err(error) => json!({"accepted":false,"error":error.diagnostic_code()}),
                };
                println!(
                    "{}",
                    json!({"fixture":record["fixture"],"model":record["requestedModel"],"trial":record["trial"],"variant":record["variant"],"group":record["group"],"outcome":outcome})
                );
            }
        }
        _ => panic!("Usage: benchmark_gloss export | validate RESULTS.jsonl"),
    }
}
