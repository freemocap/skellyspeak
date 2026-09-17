/// The scheduler and inspection share these operation declarations.
pub struct Declaration {
    pub kind: &'static str,
    pub dependencies: &'static [&'static str],
    pub role: &'static str,
    pub contract_version: i32,
}
pub const PLAN: &[Declaration] = &[
    Declaration {
        kind: "skill_assessment",
        dependencies: &["persona_context"],
        role: "fast",
        contract_version: 1,
    },
    Declaration {
        kind: "lesson_review",
        dependencies: &["persona_reply"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "coach_retry_check",
        dependencies: &["persona_context"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "conversation_feedback",
        dependencies: &["persona_reply"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "reply_assistance",
        dependencies: &["persona_reply"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "persona_context",
        dependencies: &[],
        role: "local",
        contract_version: 3,
    },
    Declaration {
        kind: "persona_reply",
        dependencies: &["persona_context"],
        role: "standard",
        contract_version: 3,
    },
    Declaration {
        kind: "persona_word_gloss",
        dependencies: &["persona_reply"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "persona_speech",
        dependencies: &["persona_reply"],
        role: "speech",
        contract_version: 1,
    },
    Declaration {
        kind: "reply_translation",
        dependencies: &["persona_reply"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "user_word_gloss",
        dependencies: &["persona_context"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "user_translation",
        dependencies: &["persona_context"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "reply_explanations",
        dependencies: &["persona_reply"],
        role: "standard",
        contract_version: 1,
    },
];

pub const COACH_PLAN: &[Declaration] = &[
    Declaration {
        kind: "coach_context",
        dependencies: &[],
        role: "local",
        contract_version: 3,
    },
    Declaration {
        kind: "coach_reply",
        dependencies: &["coach_context"],
        role: "standard",
        contract_version: 3,
    },
];

pub const OPENING_PLAN: &[Declaration] = &[
    Declaration {
        kind: "reply_explanations",
        dependencies: &["persona_opening"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "persona_context",
        dependencies: &[],
        role: "local",
        contract_version: 3,
    },
    Declaration {
        kind: "persona_opening",
        dependencies: &["persona_context"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "reply_assistance",
        dependencies: &["persona_opening"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "persona_word_gloss",
        dependencies: &["persona_opening"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "persona_speech",
        dependencies: &["persona_opening"],
        role: "speech",
        contract_version: 1,
    },
    Declaration {
        kind: "reply_translation",
        dependencies: &["persona_opening"],
        role: "standard",
        contract_version: 1,
    },
];

/// Structured lesson generation uses the ordinary durable scheduler.
pub const LESSON_PLAN: &[Declaration] = &[
    Declaration {
        kind: "coach_context",
        dependencies: &[],
        role: "local",
        contract_version: 1,
    },
    Declaration {
        kind: "lesson_generate",
        dependencies: &["coach_context"],
        role: "standard",
        contract_version: 1,
    },
];

// Read retained observations without restarting their automatic producer.
pub const RETAINED: &[Declaration] = &[
    Declaration {
        kind: "coach_feedback",
        dependencies: &["persona_context"],
        role: "standard",
        contract_version: 3,
    },
    Declaration {
        kind: "coach_suggestions",
        dependencies: &[],
        role: "standard",
        contract_version: 3,
    },
    Declaration {
        kind: "coach_reaction",
        dependencies: &["persona_reply"],
        role: "standard",
        contract_version: 1,
    },
];
