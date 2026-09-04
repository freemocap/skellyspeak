//! The teaching coordinator: the slow pass that maintains what the app knows
//! about this learner.
//!
//! It never speaks to anyone. It rewrites two documents — the teaching plan
//! (what to practise next) and the profile (durable facts across sessions) —
//! and its output is injected into the fast workers' prompts as the
//! [`directives_block`]. Everything it produces is **advisory**: the learner
//! leads the conversation, and a plan that fights that is a plan the partner
//! should ignore.
//!
//! The document *shapes* live in `observer.rs`; only the words are here.

use crate::observer::{Profile, TeachingPlan};

fn role(target_language_name: &str) -> String {
    format!(
        "You are the teaching coordinator for an immersive {tln} tutoring \
         session. You NEVER talk to the learner. Your job is to keep one small \
         document accurate so the fast tutor-workers can teach better.\n\n\
         Rules:\n\
         - ADVISORY ONLY: workers steer gently, and the learner's own choice of \
           subject always wins over anything you write. Keep the conversation \
           natural — never lecture-y, never a lesson plan.\n\
         - YOU ARE DESCRIBING A PERSON, NOT WRITING A SYLLABUS. Read Freire and \
           bell hooks rather than a curriculum designer: the learner is not an \
           empty account to schedule deposits into. The best practice focus is \
           whatever they are already trying to say and cannot yet — which you \
           find by looking at what they keep returning to, not at what comes \
           next in a textbook.\n\
         - Be concrete: cite actual words the learner said, not generic advice.\n\
         - Keep it SMALL: this is injected into fast worker prompts.\n\
         - Full replacement: emit the complete document, not diffs.\n\
         - Record what the learner talks about as interests, whatever the \
           subject. You are describing a person, not approving of them.\n\
         - The learner can see it. Write it respectfully and usefully.",
        tln = target_language_name,
    )
}

pub fn plan_prompt(target_language_name: &str) -> String {
    format!(
        "{role}\n\n\
         Rewrite the TEACHING PLAN from the latest evidence: what to practice \
         next (1-3 items max), the recurring-error recast queue (with seen \
         counts), vocabulary worth recycling, what to avoid (overload guard), \
         learner interests worth asking about, a one-phrase energy read, the \
         correction budget (1-2), and the taught-ledger (mechanics already \
         covered — workers must not re-teach them).\n\
         `avoid` is an OVERLOAD guard: grammar and vocabulary that would swamp \
         them right now. It is never a list of subjects.",
        role = role(target_language_name),
    )
}

pub fn profile_prompt(target_language_name: &str) -> String {
    format!(
        "{role}\n\n\
         Rewrite the learner PROFILE — durable facts that persist across \
         sessions: a 2-3 sentence 'about', level notes with evidence, \
         strengths, weaknesses, durable interests, and the long-term error \
         history.",
        role = role(target_language_name),
    )
}

/// What both observer calls are looking at.
pub fn shared_context(
    transcript: &str,
    plan_json: &str,
    profile_json: &str,
    recent_mechanics: &[String],
) -> String {
    format!(
        "CONVERSATION TRANSCRIPT:\n{transcript}\n\n\
         RECENTLY TAUGHT (do not re-teach): {mechanics}\n\n\
         CURRENT TEACHING PLAN:\n{plan_json}\n\n\
         CURRENT PROFILE:\n{profile_json}",
        mechanics = if recent_mechanics.is_empty() {
            "(none)".to_string()
        } else {
            recent_mechanics.join("; ")
        },
    )
}

pub fn plan_turn(context: &str) -> String {
    format!("{context}\n\nRewrite the teaching plan now.")
}

pub fn profile_turn(context: &str) -> String {
    format!("{context}\n\nRewrite the learner profile now.")
}

/// The plan as the fast workers see it: a short advisory block appended to
/// their prompts.
pub fn directives_block(plan: &TeachingPlan, recent_mechanics: &[String]) -> String {
    let mut lines = vec![
        "TEACHING PLAN (advisory — steer gently, and drop any of it the moment \
         the learner takes the conversation somewhere else):"
            .to_string(),
    ];
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
        lines.push(format!(
            "- Too much for them right now (grammar and vocabulary only, never \
             a subject to dodge): {}",
            plan.avoid.join("; ")
        ));
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
            "- ALREADY TAUGHT (do NOT re-teach; pick something new unless the \
             learner clearly needs review): {}",
            taught.join(" | ")
        ));
    }
    lines.join("\n")
}

/// The documents, serialized for a prompt. Pretty-printed because a person
/// reading a trace has to be able to follow them.
pub fn documents_json(plan: &TeachingPlan, profile: &Profile) -> (String, String) {
    (
        serde_json::to_string_pretty(plan).unwrap_or_default(),
        serde_json::to_string_pretty(profile).unwrap_or_default(),
    )
}
