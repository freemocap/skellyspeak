/// The scheduler and inspection share these operation declarations.
pub struct Declaration {
    pub kind: &'static str,
    pub dependencies: &'static [&'static str],
    pub role: &'static str,
    pub contract_version: i32,
}
pub const PLAN: &[Declaration] = &[
    Declaration {
        kind: "coach_feedback",
        dependencies: &["persona_context"],
        role: "standard",
        contract_version: 2,
    },
    Declaration {
        kind: "coach_suggestions",
        dependencies: &["persona_reply"],
        role: "standard",
        contract_version: 2,
    },
    Declaration {
        kind: "persona_context",
        dependencies: &[],
        role: "local",
        contract_version: 2,
    },
    Declaration {
        kind: "persona_reply",
        dependencies: &["persona_context"],
        role: "standard",
        contract_version: 2,
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
];

pub const COACH_PLAN: &[Declaration] = &[
    Declaration {
        kind: "coach_context",
        dependencies: &[],
        role: "local",
        contract_version: 2,
    },
    Declaration {
        kind: "coach_reply",
        dependencies: &["coach_context"],
        role: "standard",
        contract_version: 2,
    },
];
