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
        dependencies: &["partner_context"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "coach_suggestions",
        dependencies: &["partner_reply"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "partner_context",
        dependencies: &[],
        role: "local",
        contract_version: 1,
    },
    Declaration {
        kind: "partner_reply",
        dependencies: &["partner_context"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "partner_word_gloss",
        dependencies: &["partner_reply"],
        role: "standard",
        contract_version: 1,
    },
    Declaration {
        kind: "partner_speech",
        dependencies: &["partner_reply"],
        role: "speech",
        contract_version: 1,
    },
    Declaration {
        kind: "reply_translation",
        dependencies: &["partner_reply"],
        role: "standard",
        contract_version: 1,
    },
];

pub const COACH_PLAN: &[Declaration] = &[
    Declaration {
        kind: "coach_context",
        dependencies: &[],
        role: "local",
        contract_version: 1,
    },
    Declaration {
        kind: "coach_reply",
        dependencies: &["coach_context"],
        role: "standard",
        contract_version: 1,
    },
];
