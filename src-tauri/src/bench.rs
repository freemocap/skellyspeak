// Model candidate benchmark — NOT part of the app binary.
// Run with:  cargo test model_bench -- --ignored --nocapture
//
// Exercises the app's REAL prompt/validation/retry path against candidate
// worker models and reports success, latency, time-to-first-token (reply),
// and corrective-retry counts per call.

use crate::ontology;
use crate::trace::RunContext;
use crate::ai::{Provider, HTTP_429_RETRY, PARSE_RETRY, VALIDATION_RETRY};
use crate::commands::coach::CoachFeedback;
use crate::commands::guided::{
    LearnerTokensOut, MechanicsOut, ScaffoldsOut, TokensOut, TranslationOut,
};
use crate::commands::stories::StoryResponse;
use crate::observer::{self, ObserverOutput, Profile, TeachingPlan};
use crate::prompts;
use std::time::{Duration, Instant};

/// Candidates, cheapest/fastest first. Structured-output reliability is the
/// gate: a model that cannot be trusted to fill a schema is unusable here no
/// matter how cheap, because every surface in the app is schema-driven.
///
/// Set BENCH_MODELS to override, e.g.
///   BENCH_MODELS="a/b,c/d" cargo test model_bench -- --ignored --nocapture
const CANDIDATES: &[&str] = &[
    "google/gemini-2.5-flash",
    "google/gemini-3.5-flash-lite",
    "google/gemini-3.1-flash-lite",
    "openai/gpt-5-nano",
];

fn candidates() -> Vec<String> {
    match std::env::var("BENCH_MODELS") {
        Ok(v) if !v.trim().is_empty() => {
            v.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()
        }
        _ => CANDIDATES.iter().map(|s| s.to_string()).collect(),
    }
}

/// The greeting reply that historically triggered repetition loops.
const LOOP_BAIT_REPLY: &str = "¡Hola! ¿Qué tal estás hoy?";

fn test_key() -> String {
    if let Ok(k) = std::env::var("OPENROUTER_API_KEY") {
        return k;
    }
    let cfg = std::env::var("APPDATA").unwrap_or_default()
        + "\\com.freemocap.skellyspeak\\settings.json";
    let raw = std::fs::read_to_string(&cfg)
        .expect("no OPENROUTER_API_KEY env var and no desktop settings.json");
    serde_json::from_str::<serde_json::Value>(&raw)
        .expect("settings.json not JSON")["openrouter_key"]
        .as_str()
        .expect("no openrouter_key in settings.json")
        .to_string()
}

fn retry_delta(
    before: (u64, u64, u64),
) -> u64 {
    let after = (
        PARSE_RETRY.load(std::sync::atomic::Ordering::Relaxed),
        VALIDATION_RETRY.load(std::sync::atomic::Ordering::Relaxed),
        HTTP_429_RETRY.load(std::sync::atomic::Ordering::Relaxed),
    );
    (after.0 + after.1 + after.2)
        .saturating_sub(before.0 + before.1 + before.2)
}

fn snapshot() -> (u64, u64, u64) {
    (
        PARSE_RETRY.load(std::sync::atomic::Ordering::Relaxed),
        VALIDATION_RETRY.load(std::sync::atomic::Ordering::Relaxed),
        HTTP_429_RETRY.load(std::sync::atomic::Ordering::Relaxed),
    )
}

#[tokio::test]
#[ignore]
async fn model_bench() {
    let key = test_key();
    let tln = "Spanish";
    let native = "English";

    for model in candidates() {
        let model = model.as_str();
        let provider = Provider::openrouter(&key, model);
        eprintln!("\n================ {} ================", model);

        // 1. Streaming greeting reply (TTFT + total).
        let sys = prompts::guided_reply_prompt(tln, "A2", native, "");
        let messages = vec![
            serde_json::json!({"role": "system", "content": sys}),
            serde_json::json!({"role": "user", "content": "[Session start] Greet the learner warmly and ask one simple opening question they can answer at their level."}),
        ];
        let start = Instant::now();
        let mut ttft: Option<u128> = None;
        let started = start;
        let mut on_delta = |_: &str| {
            if ttft.is_none() {
                ttft = Some(started.elapsed().as_millis());
            }
        };
        let before = snapshot();
        let reply = provider
            .chat_streaming(
                RunContext::new(ontology::op::REPLY, None),
                &messages,
                0.6,
                &mut on_delta,
            )
            .await;
        let ms = start.elapsed().as_millis();
        match &reply {
            Ok(r) => eprintln!(
                "reply        OK  total={}ms ttft={:?}ms retries={} len={}",
                ms, ttft, retry_delta(before), r.len()
            ),
            Err(e) => eprintln!("reply        FAIL ({}ms): {}", ms, &e[..e.len().min(160)]),
        }
        let reply_text = reply.unwrap_or_else(|_| LOOP_BAIT_REPLY.to_string());

        // 2. Tokens — on the loop bait.
        let msgs = vec![
            serde_json::json!({"role": "system", "content": prompts::guided_tokens_prompt(tln, native, None)}),
            serde_json::json!({"role": "user", "content": format!("Tutor reply to tokenize:\n{}", reply_text)}),
        ];
        let start = Instant::now();
        let before = snapshot();
        let res = provider
            .structured_validated::<TokensOut, _>(
                RunContext::new(ontology::op::TOKENIZE, None),
                &msgs,
                0.1,
                "TokensOut",
                false,
                None,
                |t: &TokensOut| {
                    if t.tokens.is_empty() { Some("empty".into()) } else { None }
                },
            )
            .await;
        let ms = start.elapsed().as_millis();
        match &res {
            Ok(t) => eprintln!("tokens       OK  total={}ms retries={} n={}", ms, retry_delta(before), t.tokens.len()),
            Err(e) => eprintln!("tokens       FAIL ({}ms): {}", ms, &e[..e.len().min(160)]),
        }

        // 3. Scaffolds — the wrapper-shape failure case.
        let msgs = vec![
            serde_json::json!({"role": "system", "content": prompts::guided_scaffolds_prompt(tln, native, "")}),
            serde_json::json!({"role": "user", "content": format!("Learner message:\nHola\n\nTutor reply:\n{}", reply_text)}),
        ];
        let start = Instant::now();
        let before = snapshot();
        let res = provider
            .structured_validated::<ScaffoldsOut, _>(
                RunContext::new(ontology::op::SUGGEST, None),
                &msgs,
                0.6,
                "ScaffoldsOut",
                false,
                None,
                |sc: &ScaffoldsOut| {
                    if sc.replies.is_empty() || sc.frames.is_empty() || sc.starters.is_empty() {
                        Some("empty lists".into())
                    } else {
                        None
                    }
                },
            )
            .await;
        let ms = start.elapsed().as_millis();
        match &res {
            Ok(s) => eprintln!("scaffolds    OK  total={}ms retries={} {}/{}", ms, retry_delta(before), s.replies.len(), s.frames.len()),
            Err(e) => eprintln!("scaffolds    FAIL ({}ms): {}", ms, &e[..e.len().min(160)]),
        }

        // 4. Translation.
        let msgs = vec![
            serde_json::json!({"role": "system", "content": prompts::guided_translation_prompt(tln, native)}),
            serde_json::json!({"role": "user", "content": format!("Tutor reply to translate:\n{}", reply_text)}),
        ];
        let start = Instant::now();
        let before = snapshot();
        let res = provider
            .structured_validated::<TranslationOut, _>(
                RunContext::new(ontology::op::TRANSLATE, None),
                &msgs,
                0.2,
                "TranslationOut",
                false,
                None,
                |t: &TranslationOut| {
                    if t.translation.trim().is_empty() { Some("empty".into()) } else { None }
                },
            )
            .await;
        let ms = start.elapsed().as_millis();
        match &res {
            Ok(t) => eprintln!("translation  OK  total={}ms retries={} len={}", ms, retry_delta(before), t.translation.len()),
            Err(e) => eprintln!("translation  FAIL ({}ms): {}", ms, &e[..e.len().min(160)]),
        }

        // 5. Mechanics.
        let msgs = vec![
            serde_json::json!({"role": "system", "content": prompts::guided_mechanics_prompt(tln, "A2", native, "")}),
            serde_json::json!({"role": "user", "content": format!("Learner message (A2 level):\nHola\n\nTutor reply:\n{}", reply_text)}),
        ];
        let start = Instant::now();
        let before = snapshot();
        let res = provider
            .structured_validated::<MechanicsOut, _>(
                RunContext::new(ontology::op::EXPLAIN, None),
                &msgs,
                0.4,
                "MechanicsOut",
                false,
                None,
                |m: &MechanicsOut| {
                    if m.mechanics.is_empty() { Some("empty".into()) } else { None }
                },
            )
            .await;
        let ms = start.elapsed().as_millis();
        match &res {
            Ok(m) => eprintln!("mechanics    OK  total={}ms retries={} n={}", ms, retry_delta(before), m.mechanics.len()),
            Err(e) => eprintln!("mechanics    FAIL ({}ms): {}", ms, &e[..e.len().min(160)]),
        }

        // 6. Story (heaviest single output).
        let sys = prompts::story_prompt(tln, "A2", native, "beginner", "");
        let msgs = vec![
            serde_json::json!({"role": "system", "content": sys}),
            serde_json::json!({"role": "user", "content": "Write a new story. Vary the topic."}),
        ];
        let start = Instant::now();
        let before = snapshot();
        let res = provider
            .structured_validated::<StoryResponse, _>(
                RunContext::new(ontology::op::STORY, None),
                &msgs,
                0.7,
                "StoryResponse",
                false,
                None,
                |st: &StoryResponse| {
                    let glossed = st
                        .paragraphs
                        .iter()
                        .flat_map(|p| p.tokens.iter())
                        .filter(|t| t.gloss.is_some())
                        .count();
                    if glossed == 0 { Some("no glosses".into()) } else { None }
                },
            )
            .await;
        let ms = start.elapsed().as_millis();
        match &res {
            Ok(s) => {
                let n: usize = s.paragraphs.iter().map(|p| p.tokens.len()).sum();
                eprintln!("story        OK  total={}ms retries={} tokens={}", ms, retry_delta(before), n);
            }
            Err(e) => eprintln!("story        FAIL ({}ms): {}", ms, &e[..e.len().min(160)]),
        }

        // 7. Learner tokens — the call that hit the old 6000-token cap.
        let sys = prompts::learner_tokens_prompt(tln, native, None);
        let msgs = vec![
            serde_json::json!({"role": "system", "content": sys}),
            serde_json::json!({"role": "user", "content": "Learner message to analyze:
Si, me gusta mucho viajar. Quiero ir a la playa con mi familia el proximo verano porque me encanta el mar."}),
        ];
        let start = Instant::now();
        let before = snapshot();
        let res = provider
            .structured_validated::<LearnerTokensOut, _>(
                RunContext::new(ontology::op::TOKENIZE_LEARNER, None),
                &msgs,
                0.1,
                "LearnerTokensOut",
                false,
                None,
                |t: &LearnerTokensOut| {
                    if t.tokens.is_empty() { Some("empty".into()) } else { None }
                },
            )
            .await;
        let ms = start.elapsed().as_millis();
        match &res {
            Ok(t) => eprintln!("learner-tok  OK  total={}ms retries={} n={}", ms, retry_delta(before), t.tokens.len()),
            Err(e) => eprintln!("learner-tok  FAIL ({}ms): {}", ms, &e[..e.len().min(160)]),
        }

        // 8. Coach feedback — nested array of correction objects.
        let sys = prompts::coach_system_prompt(tln, native);
        let msgs = vec![
            serde_json::json!({"role": "system", "content": sys}),
            serde_json::json!({"role": "user", "content": "Learner wrote: 'Si, me gusta mucho viajar. ¿De dónde te gusta viajar tú?'"}),
        ];
        let start = Instant::now();
        let before = snapshot();
        let res = provider
            .structured_validated::<CoachFeedback, _>(
                RunContext::new(ontology::op::REVIEW, None),
                &msgs,
                0.3,
                "CoachFeedback",
                false,
                None,
                |c: &CoachFeedback| c.validate(),
            )
            .await;
        let ms = start.elapsed().as_millis();
        match &res {
            Ok(c) => eprintln!("coach        OK  total={}ms retries={} corrections={}", ms, retry_delta(before), c.corrections.len()),
            Err(e) => eprintln!("coach        FAIL ({}ms): {}", ms, &e[..e.len().min(160)]),
        }

        // 9. Observer — THE hard case. Two levels of nesting, each with
        //    arrays of objects. This is the schema that silently degraded to
        //    a stringified blob when the `allOf` wrapper reached the provider,
        //    so it is the one that decides whether a model is usable at all.
        let plan = TeachingPlan::default();
        let profile = Profile::default();
        let transcript = "L: Hola
T: ¡Hola! ¿Te gusta viajar?
L: Si, me gusta mucho viajar.";
        let start = Instant::now();
        let before = snapshot();
        let res = observer::run_observer(
            &provider,
            RunContext::new(ontology::op::REFLECT, None),
            tln,
            transcript,
            &plan,
            &profile,
            &[],
        )
        .await;
        let ms = start.elapsed().as_millis();
        match &res {
            Ok(o) => eprintln!(
                "observer*    OK  total={}ms retries={} focus={} errors={}",
                ms,
                retry_delta(before),
                o.plan.session_focus.len(),
                o.plan.recurring_errors.len()
            ),
            Err(e) => eprintln!("observer*    FAIL ({}ms): {}", ms, &e[..e.len().min(200)]),
        }
        let _ = std::any::type_name::<ObserverOutput>();

        std::thread::sleep(Duration::from_secs(2));
    }
}
