//! Task policy captured with each turn, independent of prompt wording.
use crate::ai::connections::access::ResolvedTarget;
pub fn target(base: &ResolvedTarget, role: &str, fast: &str) -> ResolvedTarget {
    let mut target = base.clone();
    target.model = if role == "fast" {
        fast.into()
    } else {
        base.model.clone()
    };
    target
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn declared_role_selects_model_without_changing_access() {
        let base = ResolvedTarget {
            audio_resolution: None,
            route: crate::model::ConnectionRoute::Custom,
            revision: 1,
            url: "https://example.test/v1/operations".into(),
            model: "chosen-standard".into(),
            credential: Some("test".into()),
        };
        for (role, expected) in [("standard", "chosen-standard"), ("fast", "chosen-fast")] {
            let resolved = target(&base, role, "chosen-fast");
            assert_eq!(resolved.model, expected);
            assert_eq!(resolved.url, base.url);
            assert_eq!(resolved.credential, base.credential);
            assert_eq!(resolved.route, base.route);
        }
    }
}
