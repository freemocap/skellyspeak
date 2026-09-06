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
        for list in [&self.session_focus, &self.vocab_recycle, &self.avoid, &self.learner_interests] {
            if let Some(error) = validate_list(list) { return Some(error); }
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

fn validate_list(values: &[String]) -> Option<String> {
    (values.len() > 10 || values.iter().any(|v| v.trim().is_empty() || v.chars().count() > 256))
        .then(|| "Observation lists allow at most 10 nonempty entries, each at most 256 characters".into())
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
    /// How many sessions completed.
    #[serde(default)]
    pub sessions: u32,
}

impl Profile {
    pub fn validate(&self) -> Option<String> {
        if self.about.chars().count() > 1200 || self.level_notes.chars().count() > 1200 || self.long_term_errors.len() > 10 {
            return Some("Profile prose is limited to 1200 characters per field and 10 error records".into());
        }
        for list in [&self.strengths, &self.weaknesses, &self.interests] {
            if let Some(error) = validate_list(list) { return Some(error); }
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
            log::error!("{fault}");
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
        Ok(output) => {
            if let Some(error) = output.validate() { faults.push(format!("Invalid tutor memory: {error}")); }
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
pub async fn run_observer(
    provider: &Provider,
    ctx: crate::trace::RunContext,
    target_language_name: &str,
    transcript: &str,
    plan: &TeachingPlan,
    profile: &Profile,
    recent_mechanics: &[String],
) -> Result<ObserverOutput, String> {
    let (plan_json, profile_json) = prompts::documents_json(plan, profile);
    let context = prompts::shared_context(transcript, &plan_json, &profile_json, recent_mechanics);

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
            ctx,
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
    fn tutor_memory_round_trips_and_corruption_remains_a_fault() {
        let directory = tempfile::tempdir().unwrap();
        let mut plan = TeachingPlan::default();
        plan.session_focus = vec!["Questions".into()];
        let mut profile = Profile::default();
        profile.about = "Practises Spanish".into();
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
