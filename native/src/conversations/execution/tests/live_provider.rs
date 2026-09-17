use super::*;

/// Synthetic voice transcripts, real economical-model requests. This does not
/// measure microphone recognition, audio playback or human learning outcomes.
#[tokio::test]
#[ignore = "uses explicitly configured live credentials; fifteen paid requests"]
async fn live_multilingual_conversation_support() {
    let path =
        std::env::var("SKELLYSPEAK_LIVE_KEYS").expect("Set the local key-file path explicitly");
    let keys = std::fs::read_to_string(path).unwrap();
    let key = keys
        .lines()
        .find_map(|line| line.strip_prefix("OPENROUTER_API_KEY="))
        .expect("Missing OpenRouter key")
        .trim()
        .trim_matches(['\"', '\'']);
    let client = crate::ai::transport::provider::client().unwrap();
    for (language, text) in [
        ("spanish", "Ayer yo go al parque con mi hermana."),
        ("arabic", "أمس ذهبت إلى الحديقة مع my sister."),
        ("mandarin", "昨天我和 my sister 去公园。"),
    ] {
        let (_dir, mut store, existing) = setup();
        let conversation = if language == "spanish" {
            existing
        } else {
            apply(
                &mut store,
                Action::CreateContact {
                    language_id: language.into(),
                    details: crate::partners::persona::starter(language).unwrap(),
                },
            )
            .entity_id
        };
        store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.readAloud',json('false')) WHERE conversation_id=?1",[&conversation]).unwrap();
        let mut command = send(&store, &conversation);
        if let Action::SendMessage {
            text: source,
            input,
            ..
        } = &mut command.action
        {
            *source = text.into();
            input.modality = "speech_transcript".into();
        }
        store.execute(command).unwrap();
        store.connection.execute("DELETE FROM operations WHERE kind IN ('user_translation','user_word_gloss','persona_word_gloss','reply_translation')",[]).unwrap();
        store.dispatch().unwrap();
        let persona = store.dispatch().unwrap().unwrap();
        let start = std::time::Instant::now();
        let result = crate::ai::transport::provider::complete(&client, key, &persona)
            .await
            .unwrap();
        println!(
            "LIVE {language} persona_reply {}ms input={:?} output={:?}: {}",
            start.elapsed().as_millis(),
            result.input_tokens,
            result.output_tokens,
            result.text
        );
        store.finish(&persona, Ok(result)).unwrap();
        for _ in 0..4 {
            let work = store.dispatch().unwrap().unwrap();
            let kind: String = store
                .connection
                .query_row(
                    "SELECT kind FROM operations WHERE id=?1",
                    [&work.operation],
                    |r| r.get(0),
                )
                .unwrap();
            let start = std::time::Instant::now();
            let output = crate::ai::transport::provider::complete_with_output(
                &client,
                key,
                &work,
                crate::ai::transport::provider::RequestOutput::JsonSchema {
                    name: "conversation_support",
                    schema: work.coaching_schema.as_ref().unwrap(),
                },
            )
            .await
            .unwrap();
            println!(
                "LIVE {language} {kind} {}ms input={:?} output={:?}: {}",
                start.elapsed().as_millis(),
                output.input_tokens,
                output.output_tokens,
                output.text
            );
            store.finish(&work, Ok(output)).unwrap();
            let (state, error): (String, Option<String>) = store
                .connection
                .query_row(
                    "SELECT state,error FROM attempts WHERE id=?1",
                    [&work.attempt],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .unwrap();
            assert_eq!(state, "succeeded", "{language} {kind}: {error:?}");
        }
        let view = store.conversation_snapshot(&conversation, None).unwrap();
        let feedback = view.messages[0].conversation_feedback.as_ref().unwrap();
        assert!(
            feedback
                .corrections
                .iter()
                .any(|c| c.said.contains(if language == "spanish" {
                    "go"
                } else {
                    "my sister"
                }) && !c.corrected.contains(if language == "spanish" {
                    "go"
                } else {
                    "my sister"
                })),
            "{language}: missing code-switch help"
        );
        let profile = crate::learning::learner::progression::snapshot(&store, language).unwrap();
        assert!(
            profile["profile"]["xp"].as_u64().unwrap() > 0,
            "{language}: no skill evidence"
        );
        assert!(view.messages[1].reply_assistance.is_some());
        assert!(view.messages[1].reply_explanations.is_some());
    }
}
