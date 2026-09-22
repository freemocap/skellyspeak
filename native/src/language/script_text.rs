//! Script-dependent generation guidance, not a gate on model responses.
//! Script identifiers come from the resolved language configuration.

pub(crate) fn requires_romanization(script: &str) -> bool {
    script != "latin"
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn romanization_guidance_uses_script_instead_of_language_identity() {
        assert!(!requires_romanization("latin"));
        assert!(requires_romanization("arabic"));
        assert!(requires_romanization("traditional-syllabary"));
    }
}
