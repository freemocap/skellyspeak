/// The scheduler and inspection share these operation declarations.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Activation {
    Automatic,
    Explicit,
    SpeechEnabled,
}
impl Activation {
    pub fn enabled(self, speech: bool) -> bool {
        self == Self::Automatic || (self == Self::SpeechEnabled && speech)
    }
}
pub struct Declaration {
    pub activation: Activation,
    pub kind: &'static str,
    pub dependencies: &'static [&'static str],
    pub role: &'static str,
    pub contract_version: i32,
}
pub const PLAN: &[Declaration] = &[
    Declaration { kind: "skill_evidence", activation: Activation::Automatic, dependencies: &["skill_assessment"], role: "fast", contract_version: 1 },
    Declaration {
        kind: "reply_assistance",
        activation: Activation::Explicit,
        dependencies: &["persona_reply"],
        role: "standard",
        contract_version: 2,
    },
    Declaration {
        kind: "reply_explanations",
        activation: Activation::Explicit,
        dependencies: &["persona_reply"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "skill_assessment",
        activation: Activation::Automatic,
        dependencies: &["persona_context"],
        role: "fast",
        contract_version: 1,
    },
    Declaration {
        kind: "coach_retry_check",
        activation: Activation::Explicit,
        dependencies: &["persona_context"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "conversation_feedback",
        activation: Activation::Automatic,
        dependencies: &["persona_reply"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "reply_brief",
        activation: Activation::Automatic,
        dependencies: &["persona_reply"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "persona_context",
        activation: Activation::Automatic,
        dependencies: &[],
        role: "local",
        contract_version: 3,
    },
    Declaration {
        kind: "persona_reply",
        activation: Activation::Automatic,
        dependencies: &["persona_context"],
        role: "standard",
        contract_version: 3,
    },
    Declaration {
        kind: "persona_word_gloss",
        activation: Activation::Automatic,
        dependencies: &["persona_reply"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "persona_speech",
        activation: Activation::SpeechEnabled,
        dependencies: &["persona_reply"],
        role: "speech",
        contract_version: 1,
    },
    Declaration {
        kind: "reply_translation",
        activation: Activation::Automatic,
        dependencies: &["persona_reply"],
        role: "fast",
        contract_version: 1,
    },
    Declaration {
        kind: "user_word_gloss",
        activation: Activation::Automatic,
        dependencies: &["persona_context"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "user_translation",
        activation: Activation::Automatic,
        dependencies: &["persona_context"],
        role: "fast",
        contract_version: 1,
    },
];

pub const COACH_PLAN: &[Declaration] = &[
    Declaration {
        kind: "coach_context",
        activation: Activation::Automatic,
        dependencies: &[],
        role: "local",
        contract_version: 3,
    },
    Declaration {
        kind: "coach_reply",
        activation: Activation::Automatic,
        dependencies: &["coach_context"],
        role: "standard",
        contract_version: 3,
    },
];

pub const OPENING_PLAN: &[Declaration] = &[
    Declaration {
        kind: "reply_assistance",
        activation: Activation::Explicit,
        dependencies: &["persona_opening"],
        role: "standard",
        contract_version: 2,
    },
    Declaration {
        kind: "reply_explanations",
        activation: Activation::Explicit,
        dependencies: &["persona_opening"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "persona_context",
        activation: Activation::Automatic,
        dependencies: &[],
        role: "local",
        contract_version: 3,
    },
    Declaration {
        kind: "persona_opening",
        activation: Activation::Automatic,
        dependencies: &["persona_context"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "reply_brief",
        activation: Activation::Automatic,
        dependencies: &["persona_opening"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "persona_word_gloss",
        activation: Activation::Automatic,
        dependencies: &["persona_opening"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "persona_speech",
        activation: Activation::SpeechEnabled,
        dependencies: &["persona_opening"],
        role: "speech",
        contract_version: 1,
    },
    Declaration {
        kind: "reply_translation",
        activation: Activation::Automatic,
        dependencies: &["persona_opening"],
        role: "fast",
        contract_version: 1,
    },
];

// Explicit operations and retained observations; never automatically created.
pub const RETAINED: &[Declaration] = &[
    Declaration {
        kind: "coach_feedback",
        activation: Activation::Explicit,
        dependencies: &["persona_context"],
        role: "standard",
        contract_version: 3,
    },
    Declaration {
        kind: "coach_suggestions",
        activation: Activation::Explicit,
        dependencies: &[],
        role: "standard",
        contract_version: 3,
    },
    Declaration {
        kind: "coach_reaction",
        activation: Activation::Explicit,
        dependencies: &["persona_reply"],
        role: "fast",
        contract_version: 1,
    },
];
