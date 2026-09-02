//! The Observer: a reasoning-model pass that runs in the background and
//! maintains two small, learner-visible documents — the session TeachingPlan
//! and the cross-session Profile. It never talks to the learner; its only
//! job is keeping the documents accurate so the fast worker prompts can
//! steer the conversation.

use serde::{Deserialize, Serialize};
use serde_json::json;
use std::path::Path;

use crate::ai::{MaxTokens, Provider};

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
        None // the plan is advisory; an empty plan is a valid plan
    }
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


#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct ObserverOutput {
    /// The rewritten session TeachingPlan (full replacement).
    pub plan: TeachingPlan,
    /// The rewritten learner Profile (full replacement).
    pub profile: Profile,
}

impl ObserverOutput {
    pub fn validate(&self) -> Option<String> {
        None
    }
}

// ─── Persistence ─────────────────────────────────────────────────────────────

/// Load one document. A missing file is a first run. An unreadable one is a
/// fault: it is moved aside, the caller starts from defaults, and the reason
/// is pushed onto `faults` so it reaches the screen.
fn load_document<T: serde::de::DeserializeOwned + Default>(
    dir: &Path,
    name: &str,
    faults: &mut Vec<String>,
) -> T {
    let path = dir.join(name);
    let Ok(raw) = std::fs::read_to_string(&path) else {
        return T::default(); // first run — nothing to load
    };
    match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(e) => {
            let bad = dir.join(format!("{name}.bad"));
            let mut fault =
                format!("{name} could not be read ({e}), so it starts empty.");
            match std::fs::rename(&path, &bad) {
                Ok(()) => fault.push_str(&format!(" The unreadable file is kept at {}.", bad.display())),
                Err(rename_err) => {
                    fault.push_str(&format!(" It could not be moved aside either: {rename_err}."))
                }
            }
            log::error!("{fault}");
            faults.push(fault);
            T::default()
        }
    }
}

pub fn load_documents(dir: &Path, faults: &mut Vec<String>) -> (TeachingPlan, Profile) {
    (
        load_document(dir, "plan.json", faults),
        load_document(dir, "profile.json", faults),
    )
}

/// Write both documents. Returns every failure so the caller can surface them:
/// a lost write means the tutor forgets what it learned this session.
pub fn persist_documents(dir: &Path, plan: &TeachingPlan, profile: &Profile) -> Vec<String> {
    let mut faults = Vec::new();
    let mut write = |name: &str, raw: Result<String, serde_json::Error>| match raw {
        Ok(raw) => {
            if let Err(e) = std::fs::write(dir.join(name), raw) {
                faults.push(format!("Could not save {name}: {e}. This session's progress is not stored."));
            }
        }
        Err(e) => faults.push(format!("Could not serialize {name}: {e}.")),
    };
    write("plan.json", serde_json::to_string_pretty(plan));
    write("profile.json", serde_json::to_string_pretty(profile));
    for f in &faults {
        log::error!("{f}");
    }
    faults
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

/// Compact advisory block injected into the fast worker prompts.
pub fn directives_block(plan: &TeachingPlan, recent_mechanics: &[String]) -> String {
    let mut lines = vec!["TEACHING PLAN (advisory — steer gently, keep the conversation natural):".to_string()];
    if !plan.session_focus.is_empty() {
        lines.push(format!("- Practice focus: {}", plan.session_focus.join("; ")));
    }
    if !plan.recurring_errors.is_empty() {
        let errors: Vec<String> = plan
            .recurring_errors
            .iter()
            .map(|e| format!("\"{}\" → \"{}\" (×{})", e.error, e.correction, e.seen_count))
            .collect();
        lines.push(format!(
            "- Recast at most {} error(s) this reply, highest value first: {}",
            plan.correction_budget,
            errors.join("; ")
        ));
    } else {
        lines.push("- No errors to recast right now.".to_string());
    }
    if !plan.vocab_recycle.is_empty() {
        lines.push(format!("- Recycle vocabulary: {}", plan.vocab_recycle.join(", ")));
    }
    if !plan.avoid.is_empty() {
        lines.push(format!("- Avoid: {}", plan.avoid.join("; ")));
    }
    if !plan.learner_interests.is_empty() {
        lines.push(format!(
            "- Learner interests you can ask about: {}",
            plan.learner_interests.join(", ")
        ));
    }
    if !plan.energy_read.is_empty() {
        lines.push(format!("- Learner energy: {}", plan.energy_read));
    }
    // Anti-repetition: everything already covered by an analysis card, from
    // both the observer's ledger and the cards fired in recent turns.
    let mut taught: Vec<String> = plan.taught_ledger.iter().map(|t| t.mechanic.clone()).collect();
    for m in recent_mechanics {
        if !taught.contains(m) {
            taught.push(m.clone());
        }
    }
    if !taught.is_empty() {
        lines.push(format!(
            "- ALREADY TAUGHT (do NOT re-teach; pick something new unless the learner clearly needs review): {}",
            taught.join(" | ")
        ));
    }
    lines.join("\n")
}

/// Cheap failure budget. Both documents are a few hundred tokens; 4k is
/// generous. The point is not to constrain the output but to make a runaway
/// CHEAP — it dies in ~10s instead of burning 32k tokens over two minutes.
const OBSERVER_MAX_TOKENS: MaxTokens = MaxTokens(4_000);

/// The observer runs as **two separate structured calls**, one per document,
/// concurrently.
///
/// A single call returning `{plan, profile}` nests two objects that each
/// contain arrays of objects, and the bench shows providers cannot serve that
/// shape reliably: they either return the nested document as a JSON *string*
/// or generate until they blow the token cap (123s on gemini-2.5-flash, 73s
/// on gemini-3.1-flash-lite, non-deterministically — the same model and
/// prompt finished in 2.1s on another run).
///
/// A schema this app depends on must be boring to serve. Two flat documents
/// are; one nested wrapper is not. Running them concurrently makes the split
/// free in wall time.
fn shared_context(
    transcript: &str,
    plan: &TeachingPlan,
    profile: &Profile,
    recent_mechanics: &[String],
) -> String {
    format!(
        "CONVERSATION TRANSCRIPT:
{transcript}

         RECENTLY TAUGHT (do not re-teach): {mechanics}

         CURRENT TEACHING PLAN:
{plan}

         CURRENT PROFILE:
{profile}",
        transcript = transcript,
        mechanics = if recent_mechanics.is_empty() {
            "(none)".to_string()
        } else {
            recent_mechanics.join("; ")
        },
        plan = serde_json::to_string_pretty(plan).unwrap_or_default(),
        profile = serde_json::to_string_pretty(profile).unwrap_or_default(),
    )
}

fn observer_role(target_language_name: &str) -> String {
    format!(
        "You are the teaching coordinator for an immersive {tln} tutoring session.
         You NEVER talk to the learner. Your job is to keep one small document
         accurate so the fast tutor-workers can teach better.

         Rules:
         - ADVISORY ONLY: workers steer gently. Keep the conversation natural —
           never lecture-y, never a lesson plan.
         - Be concrete: cite actual words the learner said, not generic advice.
         - Keep it SMALL: this is injected into fast worker prompts.
         - Full replacement: emit the complete document, not diffs.
         - The learner can see it. Write it respectfully and usefully.",
        tln = target_language_name,
    )
}

pub fn plan_system_prompt(target_language_name: &str) -> String {
    format!(
        "{role}

         Rewrite the TEACHING PLAN from the latest evidence: what to practice next
         (1-3 items max), the recurring-error recast queue (with seen counts),
         vocabulary worth recycling, what to avoid (overload guard), learner
         interests worth asking about, a one-phrase energy read, the correction
         budget (1-2), and the taught-ledger (mechanics already covered — workers
         must not re-teach them).",
        role = observer_role(target_language_name),
    )
}

pub fn profile_system_prompt(target_language_name: &str) -> String {
    format!(
        "{role}

         Rewrite the learner PROFILE — durable facts that persist across sessions:
         a 2-3 sentence 'about', level notes with evidence, strengths, weaknesses,
         durable interests, and the long-term error history.",
        role = observer_role(target_language_name),
    )
}

/// Run one observer pass: both documents, concurrently, each on its own flat
/// schema. A failure in one does not cost the other.
pub async fn run_observer(
    provider: &Provider,
    ctx: crate::trace::RunContext,
    target_language_name: &str,
    transcript: &str,
    plan: &TeachingPlan,
    profile: &Profile,
    recent_mechanics: &[String],
) -> Result<ObserverOutput, String> {
    let context = shared_context(transcript, plan, profile, recent_mechanics);

    let plan_msgs = vec![
        json!({"role": "system", "content": plan_system_prompt(target_language_name)}),
        json!({"role": "user", "content": format!("{context}

Rewrite the teaching plan now.")}),
    ];
    let profile_msgs = vec![
        json!({"role": "system", "content": profile_system_prompt(target_language_name)}),
        json!({"role": "user", "content": format!("{context}

Rewrite the learner profile now.")}),
    ];

    // Reasoning OFF: summarising a short transcript into a small document is
    // not a reasoning-hard task, and with it on the model burned 123s and blew
    // the token cap thinking about it.
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
            |_: &Profile| None,
        ),
    );

    Ok(ObserverOutput {
        plan: plan_out.map_err(|e| format!("observer plan failed: {e}"))?,
        profile: profile_out.map_err(|e| format!("observer profile failed: {e}"))?,
    })
}
