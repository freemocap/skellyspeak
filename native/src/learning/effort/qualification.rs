//! Source-domain qualification for unit effort awards. No storage side effects.
use crate::drill::comparison::DrillComparison;
use crate::partners::partner_reaction::{PartnerReaction, ReactionKind};

/// Versioned product inclusion policy, not an accuracy or proficiency threshold.
pub const POLICY: &str = "effort-inclusion-1";
/// At least roughly one third of the normalized target survives comparison.
/// This intentionally accepts omissions and mistakes; review examples in tests.
const MIN_TARGET_ALIGNMENT: f64 = 0.35;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Qualification {
    Qualified,
    Pending,
    NotQualified,
}

pub fn understood(reaction: Option<&PartnerReaction>) -> Qualification {
    match reaction {
        None => Qualification::Pending,
        Some(reaction) if matches!(reaction.kind, ReactionKind::Understood) => {
            Qualification::Qualified
        }
        Some(_) => Qualification::NotQualified,
    }
}

/// Credit is for accepting changed wording, not opening Edit or generating a reply.
pub fn changed_revision(before: &str, after: &str) -> bool {
    !after.trim().is_empty() && before.trim() != after.trim()
}

/// A durable successful recording receipt is required by the caller. Evaluate
/// retained text evidence even when recognition confidence cannot support an
/// accuracy score. Silence and explicit no-speech evidence never earn credit.
pub fn practice(comparison: &DrillComparison, recorded: bool) -> Qualification {
    if !recorded {
        return Qualification::NotQualified;
    }
    let Some(reliability) = comparison.reliability.as_ref() else {
        return Qualification::Pending;
    };
    if reliability.speech_seconds <= 0.0
        || reliability.reason == "no_speech"
        || comparison.normalized_transcript.is_empty()
        || comparison.normalized_target.is_empty()
    {
        return Qualification::NotQualified;
    }
    // match_ratio may be withheld by the independent score-reliability policy.
    // Preserve its raw comparison; this decision is effort inclusion only.
    match comparison.character_error_rate {
        Some(rate) if rate.is_finite() && (0.0..=1.0 - MIN_TARGET_ALIGNMENT).contains(&rate) => {
            Qualification::Qualified
        }
        Some(_) => Qualification::NotQualified,
        None => Qualification::Pending,
    }
}

#[cfg(test)]
mod tests;
