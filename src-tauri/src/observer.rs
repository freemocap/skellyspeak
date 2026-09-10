//! The Observer: a reasoning-model pass that runs in the background and
//! maintains two small, learner-visible documents — the session TeachingPlan
//! and the cross-session Profile. It never talks to the learner; its only
//! job is keeping the documents accurate so the fast worker prompts can
//! steer the conversation.

use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::Path;

use crate::ai::{MaxTokens, Provider};
use crate::prompts::observer as prompts;

// ─── Documents ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct RecurringError {
    /// The learner's actual erroneous phrasing.
    pub error: String,
    /// The correct target-language form.
    pub correction: String,
    /// How many times it has been observed.
    #[serde(default)]
    pub seen_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct TaughtMechanic {
    /// The grammar mechanic covered by an analysis card.
    pub mechanic: String,
    /// The conversation turn it was last taught on.
    #[serde(default)]
    pub last_seen_turn: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct TeachingPlan {
    /// 1-3 grammar structures / skills to steer toward right now.
    #[serde(default)]
    pub session_focus: Vec<String>,
    /// The recast queue: learner errors worth gently correcting.
    #[serde(default)]
    pub recurring_errors: Vec<RecurringError>,
    /// Vocabulary worth recycling in upcoming replies.
    #[serde(default)]
    pub vocab_recycle: Vec<String>,
    /// Structures/topics to avoid (overload guard).
    #[serde(default)]
    pub avoid: Vec<String>,
    /// Learner interests worth asking about.
    #[serde(default)]
    pub learner_interests: Vec<String>,
    /// One-phrase read of the learner's energy this session.
    #[serde(default)]
    pub energy_read: String,
    /// Max recasts allowed per reply (correction budget).
    #[serde(default = "default_correction_budget")]
    pub correction_budget: u32,
    /// Mechanics already covered — workers must not re-teach these.
    #[serde(default)]
    pub taught_ledger: Vec<TaughtMechanic>,
}

fn default_correction_budget() -> u32 {
    1
}

impl Default for TeachingPlan {
    /// Bootstraps the very first session: a generic, language-neutral
    /// beginner plan so the learner never sees an empty tutor.
    fn default() -> Self {
        Self {
            session_focus: vec![
                "Everyday greetings and simple present-tense exchanges".into(),
                "Survival phrases — asking to repeat, saying you don't understand".into(),
            ],
            recurring_errors: Vec::new(),
            vocab_recycle: Vec::new(),
            avoid: vec![
                "Past tenses — until the learner shows they are ready".into(),
                "Very long tutor turns — keep replies short and warm".into(),
            ],
            learner_interests: Vec::new(),
            energy_read: "First session — warming up".into(),
            correction_budget: default_correction_budget(),
            taught_ledger: Vec::new(),
        }
    }
}

impl TeachingPlan {
    pub fn validate(&self) -> Option<String> {
        if self.session_focus.len() > 3 || self.correction_budget > 2
            || self.recurring_errors.len() > 10 || self.taught_ledger.len() > 20
            || self.energy_read.chars().count() > 160 {
            return Some("Plan limits: 3 focuses, 2 recasts, 10 errors, 20 taught mechanics, 160 energy characters".into());
        }
        for (name, list) in [("session_focus", &self.session_focus), ("vocab_recycle", &self.vocab_recycle), ("avoid", &self.avoid), ("learner_interests", &self.learner_interests)] {
            if let Some(error) = validate_list(name, list) { return Some(error); }
        }
        for error in &self.recurring_errors {
            if let Some(problem) = validate_error(error) { return Some(problem); }
        }
        if self.taught_ledger.iter().any(|m| m.mechanic.trim().is_empty() || m.mechanic.chars().count() > 256) {
            return Some("Taught mechanics must contain 1–256 characters".into());
        }
        None
    }
}

fn validate_list(name: &str, values: &[String]) -> Option<String> {
    if values.len() > 10 {
        return Some(format!("{name} has {} entries; keep at most 10, selecting the most relevant.", values.len()));
    }
    for (index, value) in values.iter().enumerate() {
        if value.trim().is_empty() {
            return Some(format!("{name}[{index}] is blank; remove it. Use [] when there is no evidence."));
        }
        let length = value.chars().count();
        if length > 256 {
            return Some(format!("{name}[{index}] has {length} characters; rewrite this entry in at most 256 characters."));
        }
    }
    None
}

fn validate_error(error: &RecurringError) -> Option<String> {
    ([&error.error, &error.correction].iter().any(|v| v.trim().is_empty() || v.chars().count() > 256))
        .then(|| "Error evidence and corrections must contain 1–256 characters".into())
}

/// Durable, cross-session knowledge about the learner.
#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
#[derive(Default)]
pub struct Profile {
    /// 2-3 sentence summary of who the learner is and where they are.
    #[serde(default)]
    pub about: String,
    /// Level read over time (CEFR-ish, with evidence).
    #[serde(default)]
    pub level_notes: String,
    /// Things the learner does well.
    #[serde(default)]
    pub strengths: Vec<String>,
    /// Things the learner struggles with.
    #[serde(default)]
    pub weaknesses: Vec<String>,
    /// Durable interests (conversation fuel across sessions).
    #[serde(default)]
    pub interests: Vec<String>,
    /// Long-term error history worth watching across sessions.
    #[serde(default)]
    pub long_term_errors: Vec<RecurringError>,
}

impl Profile {
    pub fn validate(&self) -> Option<String> {
        if self.about.chars().count() > 1200 || self.level_notes.chars().count() > 1200 || self.long_term_errors.len() > 10 {
            return Some("Profile prose is limited to 1200 characters per field and 10 error records".into());
        }
        for (name, list) in [("strengths", &self.strengths), ("weaknesses", &self.weaknesses), ("interests", &self.interests)] {
            if let Some(error) = validate_list(name, list) { return Some(error); }
        }
        self.long_term_errors.iter().find_map(validate_error)
    }
}


#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct ObserverOutput {
    /// The rewritten session TeachingPlan (full replacement).
    pub plan: TeachingPlan,
    /// The rewritten learner Profile (full replacement).
    pub profile: Profile,
}

impl ObserverOutput {
    pub fn validate(&self) -> Option<String> {
        self.plan.validate().or_else(|| self.profile.validate())
    }

    /// Bound active prompt memory; the complete source is archived before saving.
    fn bound_memory(&mut self) {
        fn text(value: &mut String, limit: usize) {
            if let Some((offset, _)) = value.char_indices().nth(limit) {
                value.truncate(offset);
            }
        }
        fn list(values: &mut Vec<String>, limit: usize) {
            values.truncate(limit);
            for value in values { text(value, 256); }
        }
        fn errors(values: &mut Vec<RecurringError>) {
            values.sort_by_key(|error| std::cmp::Reverse(error.seen_count));
            values.truncate(10);
            for error in values {
                text(&mut error.error, 256);
                text(&mut error.correction, 256);
            }
        }
        list(&mut self.plan.session_focus, 3);
        list(&mut self.plan.vocab_recycle, 10);
        list(&mut self.plan.avoid, 10);
        list(&mut self.plan.learner_interests, 10);
        text(&mut self.plan.energy_read, 160);
        self.plan.correction_budget = self.plan.correction_budget.min(2);
        errors(&mut self.plan.recurring_errors);
        self.plan.taught_ledger.sort_by_key(|mechanic| std::cmp::Reverse(mechanic.last_seen_turn));
        self.plan.taught_ledger.truncate(20);
        for mechanic in &mut self.plan.taught_ledger { text(&mut mechanic.mechanic, 256); }
        text(&mut self.profile.about, 1200);
        text(&mut self.profile.level_notes, 1200);
        list(&mut self.profile.strengths, 10);
        list(&mut self.profile.weaknesses, 10);
        list(&mut self.profile.interests, 10);
        errors(&mut self.profile.long_term_errors);
    }
}

// ─── Persistence ─────────────────────────────────────────────────────────────

/// Missing documents use defaults. Invalid files remain intact and block loading.
fn load_document<T: serde::de::DeserializeOwned + Default>(
    dir: &Path,
    name: &str,
    faults: &mut Vec<String>,
) -> T {
    let path = dir.join(name);
    let raw = match crate::persistence::read(&path) {
        Ok(Some(raw)) => raw,
        Ok(None) => return T::default(),
        Err(error) => { faults.push(error); return T::default(); }
    };
    match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(e) => {
            let fault = format!("{} could not be read: {e}. Repair the file before continuing.", path.display());
            log::error!("Persistence failed; details reported to the UI");
            faults.push(fault);
            T::default()
        }
    }
}

pub fn load_documents(dir: &Path, faults: &mut Vec<String>) -> (TeachingPlan, Profile) {
    let result = match crate::persistence::read(&dir.join("memory.json")) {
        Ok(Some(raw)) => serde_json::from_str::<ObserverOutput>(&raw)
            .map_err(|error| format!("memory.json is invalid: {error}. Repair the file before continuing.")),
        Ok(None) => {
            let plan = load_document(dir, "plan.json", faults);
            let profile = load_document(dir, "profile.json", faults);
            Ok(ObserverOutput { plan, profile })
        }
        Err(error) => Err(error),
    };
    match result {
        Ok(mut output) => {
            if output.validate().is_some() && faults.is_empty() {
                let original = output.clone();
                output.bound_memory();
                if let Some(error) = output.validate() {
                    faults.push(format!("Invalid tutor memory: {error}"));
                    return (original.plan, original.profile);
                }
                let migration = (|| -> Result<(), String> {
                    let raw = match crate::persistence::read(&dir.join("memory.json"))? {
                        Some(raw) => raw.into_bytes(),
                        None => serde_json::to_vec_pretty(&original)
                            .map_err(|error| format!("Cannot archive tutor memory: {error}"))?,
                    };
                    let archive = dir.join(format!("memory-archive-{}.json", uuid::Uuid::new_v4()));
                    crate::persistence::write(&archive, &raw)?;
                    let failures = persist_documents(dir, &output.plan, &output.profile);
                    if !failures.is_empty() { return Err(failures.join("; ")); }
                    log::info!("Tutor memory bounded for prompts; complete source archived at {}", archive.display());
                    Ok(())
                })();
                if let Err(error) = migration {
                    faults.push(format!("Cannot migrate tutor memory: {error}"));
                    return (original.plan, original.profile);
                }
            }
            (output.plan, output.profile)
        }
        Err(error) => {
            faults.push(error);
            (TeachingPlan::default(), Profile::default())
        }
    }
}

/// Plan and profile commit together in one atomic file replacement.
pub fn persist_documents(dir: &Path, plan: &TeachingPlan, profile: &Profile) -> Vec<String> {
    let output = ObserverOutput { plan: plan.clone(), profile: profile.clone() };
    if let Some(error) = output.validate() { return vec![format!("Invalid tutor memory: {error}")]; }
    let result = serde_json::to_vec_pretty(&output)
        .map_err(|error| format!("Cannot serialize tutor memory: {error}"))
        .and_then(|raw| crate::persistence::write(&dir.join("memory.json"), &raw));
    match result {
        Ok(()) => Vec::new(),
        Err(error) => vec![error],
    }
}

// ─── The observer pass ───────────────────────────────────────────────────────
//
// The words it says live in `prompts::observer`; what it reads, writes and
// costs lives here.

/// Cheap failure budget. Both documents are a few hundred tokens; 4k is
/// generous. The point is not to constrain the output but to make a runaway
/// CHEAP — it dies in ~10s instead of burning 32k tokens over two minutes.
const OBSERVER_MAX_TOKENS: MaxTokens = MaxTokens(4_000);

/// Generate plan and profile concurrently. Both must validate before either is applied.
#[allow(clippy::too_many_arguments)]
pub async fn run_observer(
    provider: &Provider,
    ctx: crate::trace::RunContext,
    target_language_name: &str,
    transcript: &str,
    plan: &TeachingPlan,
    profile: &Profile,
    recent_mechanics: &[String],
    learner_directives: &str,
) -> Result<ObserverOutput, String> {
    let (plan_json, profile_json) = prompts::documents_json(plan, profile);
    let context = format!("{}\n{}", prompts::shared_context(transcript, &plan_json, &profile_json, recent_mechanics), learner_directives);

    let plan_msgs = vec![
        json!({"role": "system", "content": prompts::plan_prompt(target_language_name)}),
        json!({"role": "user", "content": prompts::plan_turn(&context)}),
    ];
    let profile_msgs = vec![
        json!({"role": "system", "content": prompts::profile_prompt(target_language_name)}),
        json!({"role": "user", "content": prompts::profile_turn(&context)}),
    ];

    // Each document uses a small token budget with reasoning disabled.
    let (plan_out, profile_out) = tokio::join!(
        provider.structured_validated::<TeachingPlan, _>(
            ctx.clone(),
            &plan_msgs,
            0.4,
            "TeachingPlan",
            false,
            Some(OBSERVER_MAX_TOKENS),
            |p: &TeachingPlan| p.validate(),
        ),
        provider.structured_validated::<Profile, _>(
            ctx,
            &profile_msgs,
            0.4,
            "Profile",
            false,
            Some(OBSERVER_MAX_TOKENS),
            Profile::validate,
        ),
    );

    Ok(ObserverOutput {
        plan: plan_out.map_err(|e| format!("observer plan failed: {e}"))?,
        profile: profile_out.map_err(|e| format!("observer profile failed: {e}"))?,
    })
}

#[cfg(test)]
mod persistence_tests {
    use super::*;

    #[test]
    fn list_feedback_identifies_the_exact_correction() {
        assert_eq!(validate_list("avoid", &[" ".into()]).unwrap(),
            "avoid[0] is blank; remove it. Use [] when there is no evidence.");
        assert!(validate_list("vocab_recycle", &vec!["word".into(); 11]).unwrap()
            .contains("vocab_recycle has 11 entries"));
        assert!(validate_list("interests", &["🙂".repeat(257)]).unwrap()
            .contains("interests[0] has 257 characters"));
        assert!(validate_list("avoid", &[]).is_none());
        assert!(validate_list("interests", &["🙂".repeat(256)]).is_none());
    }

    #[test]
    fn oversized_saved_memory_is_archived_and_migrated_once() {
        for combined in [false, true] {
            let directory = tempfile::tempdir().unwrap();
            let mut output = ObserverOutput { plan: TeachingPlan::default(), profile: Profile::default() };
            output.plan.session_focus = vec!["質問".repeat(200); 5];
            output.plan.energy_read = "🙂".repeat(200);
            output.plan.correction_budget = 5;
            output.plan.taught_ledger = (0..30).map(|turn| TaughtMechanic {
                mechanic: format!("Mechanic {turn}"), last_seen_turn: turn,
            }).collect();
            output.plan.recurring_errors = (0..15).map(|count| RecurringError {
                error: "Error".repeat(100), correction: "Correction".into(), seen_count: count,
            }).collect();
            output.profile.about = "語".repeat(1300);
            output.profile.level_notes = "🙂".repeat(1300);
            output.profile.interests = vec!["Interest".repeat(100); 15];
            output.profile.strengths = output.profile.interests.clone();
            output.profile.weaknesses = output.profile.interests.clone();
            output.profile.long_term_errors = output.plan.recurring_errors.clone();
            output.plan.vocab_recycle = output.profile.interests.clone();
            output.plan.avoid = output.profile.interests.clone();
            output.plan.learner_interests = output.profile.interests.clone();
            assert!(output.validate().is_some());
            assert!(!persist_documents(directory.path(), &output.plan, &output.profile).is_empty());
            let original = serde_json::to_vec_pretty(&output).unwrap();
            if combined {
                std::fs::write(directory.path().join("memory.json"), &original).unwrap();
            } else {
                std::fs::write(directory.path().join("plan.json"), serde_json::to_vec(&output.plan).unwrap()).unwrap();
                std::fs::write(directory.path().join("profile.json"), serde_json::to_vec(&output.profile).unwrap()).unwrap();
            }
            for _ in 0..2 {
                let mut faults = Vec::new();
                let (plan, profile) = load_documents(directory.path(), &mut faults);
                assert!(faults.is_empty(), "{faults:?}");
                assert!(plan.validate().is_none());
                assert!(profile.validate().is_none());
                assert_eq!(plan.session_focus.len(), 3);
                assert_eq!(plan.energy_read, "🙂".repeat(160));
                assert_eq!(plan.taught_ledger[0].last_seen_turn, 29);
                assert_eq!(plan.recurring_errors[0].seen_count, 14);
            }
            let archives: Vec<_> = std::fs::read_dir(directory.path()).unwrap()
                .map(|entry| entry.unwrap().path())
                .filter(|path| path.file_name().unwrap().to_str().unwrap().starts_with("memory-archive-"))
                .collect();
            assert_eq!(archives.len(), 1);
            assert_eq!(std::fs::read(&archives[0]).unwrap(), original);
        }
    }

    #[test]
    fn invalid_memory_preserves_the_source_and_missing_memory_uses_defaults() {
        let directory = tempfile::tempdir().unwrap();
        let mut output = ObserverOutput { plan: TeachingPlan::default(), profile: Profile::default() };
        output.plan.session_focus = vec![String::new()];
        let path = directory.path().join("memory.json");
        let raw = serde_json::to_vec(&output).unwrap();
        std::fs::write(&path, &raw).unwrap();
        let mut faults = Vec::new();
        load_documents(directory.path(), &mut faults);
        assert!(!faults.is_empty());
        assert_eq!(std::fs::read(&path).unwrap(), raw);

        let missing = directory.path().join("missing");
        let mut faults = Vec::new();
        load_documents(&missing.join("child"), &mut faults);
        assert!(faults.is_empty());
        assert!(!missing.exists());
    }

    #[test]
    fn tutor_memory_round_trips_and_corruption_remains_a_fault() {
        let directory = tempfile::tempdir().unwrap();
        let plan = TeachingPlan { session_focus: vec!["Questions".into()], ..Default::default() };
        let profile = Profile { about: "Practises Spanish".into(), ..Default::default() };
        assert!(persist_documents(directory.path(), &plan, &profile).is_empty());
        let mut faults = Vec::new();
        let (loaded_plan, loaded_profile) = load_documents(directory.path(), &mut faults);
        assert!(faults.is_empty());
        assert_eq!(loaded_plan.session_focus, plan.session_focus);
        assert_eq!(loaded_profile.about, profile.about);
        std::fs::write(directory.path().join("memory.json"), "{invalid").unwrap();
        for _ in 0..2 {
            let mut faults = Vec::new();
            load_documents(directory.path(), &mut faults);
            assert!(!faults.is_empty());
        }
        assert_eq!(std::fs::read_to_string(directory.path().join("memory.json")).unwrap(), "{invalid");
    }
}
