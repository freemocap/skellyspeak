//! Offline experiment export using the real prompt builder and output schema.
use super::*;

#[test]
#[ignore = "writes an explicitly requested development experiment artifact"]
fn export_spanish_assessment_experiment() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("..");
    let fixture: Value = serde_json::from_str(
        &std::fs::read_to_string(root.join(
            std::env::var("SKELLY_ASSESSMENT_FIXTURE").unwrap_or_else(|_| {
                "tools/benchmarks/conversation-prompts/assessment/spanish-cases.json".into()
            }),
        ))
        .unwrap(),
    )
    .unwrap();
    let registry = crate::configuration::Registry::load(&root.join("content")).unwrap();
    let mut exports = Vec::new();
    for case in fixture["cases"].as_array().unwrap() {
        for context in ["alone", "before", "after"] {
            for order in ["normal", "reversed"] {
                let mut criteria: Vec<Value> = registry
                    .constructs()
                    .iter()
                    .map(|c| json!({"id":c.id,"criterion":c.criterion}))
                    .collect();
                if order == "reversed" {
                    criteria.reverse();
                }
                let mut previous = Vec::new();
                if context != "alone" {
                    previous = fixture["distractors"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .map(|text| json!({"role":"assistant","content":text}))
                        .collect();
                    if let Some(partner) = case["partner"].as_str() {
                        previous[0] = json!({"role":"assistant","content":partner});
                    }
                }
                let mut messages = vec![json!({"role":"system","content":"synthetic fixture"})];
                messages.extend(previous);
                messages.push(json!({"role":"user","content":case["text"]}));
                let captured = json!({"skillCriteria":criteria,"messages":messages,
                    "targetLanguage":"spanish","translationLanguage":"english",
                    "input":{"modality":"text","suggestion":false,"scaffold":false,"revision":false}});
                let prompt =
                    prompt_for_source(case["text"].as_str().unwrap().into(), &captured).unwrap();
                let data: Value = serde_json::from_str(&prompt[1].content).unwrap();
                assert_eq!(
                    data["precedingExchange"].as_array().unwrap().len(),
                    if context == "alone" {
                        0
                    } else {
                        fixture["distractors"].as_array().unwrap().len().min(4)
                    }
                );
                exports.push(json!({"caseId":case["id"],"context":context,"order":order,
                    "messages":prompt,"schema":schema(&captured).unwrap()}));
            }
        }
    }
    let out = std::env::var("SKELLY_ASSESSMENT_EXPORT")
        .expect("Set SKELLY_ASSESSMENT_EXPORT to an output path");
    std::fs::write(
        out,
        serde_json::to_string_pretty(&json!({"version":VERSION,"exports":exports})).unwrap(),
    )
    .unwrap();
}

#[test]
#[ignore = "replays synthetic benchmark outputs through the actual validator"]
fn replay_assessment_experiment() {
    let path = std::env::var("SKELLY_ASSESSMENT_REPLAY").expect("Set replay input path");
    let rows: Vec<Value> = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
    let mut results = Vec::new();
    for row in rows {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch("CREATE TABLE turns(id TEXT, context TEXT); CREATE TABLE messages(turn_id TEXT,role TEXT,text TEXT);").unwrap();
        db.execute(
            "INSERT INTO turns VALUES('test',?1)",
            [json!({"skillCriteria":row["criteria"]}).to_string()],
        )
        .unwrap();
        db.execute(
            "INSERT INTO messages VALUES('test','user',?1)",
            [row["source"].as_str().unwrap()],
        )
        .unwrap();
        let completion = Completion {
            diagnostics: None,
            text: row["output"].to_string(),
            finish_reason: "stop".into(),
            actual_model: "experiment".into(),
            provider_id: "experiment".into(),
            input_tokens: None,
            output_tokens: None,
        };
        let result = validate(&db, "test", &completion);
        results.push(match result {
            Ok(value) => json!({"id":row["id"],"valid":true,"validated":value}),
            Err(error) => json!({"id":row["id"],"valid":false,"error":format!("{error:?}")}),
        });
    }
    std::fs::write(
        format!("{path}.validated.json"),
        serde_json::to_string_pretty(&results).unwrap(),
    )
    .unwrap();
}
