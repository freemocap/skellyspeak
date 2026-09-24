use super::*;
use documents::*;
/// Authoring schemas derive from the exact deserialization contracts.
pub fn schemas() -> BTreeMap<String, serde_json::Value> {
    macro_rules! schema {
        ($name:literal,$type:ty) => {
            (
                $name.into(),
                serde_json::to_value(schemars::schema_for!($type)).expect("schema serialization"),
            )
        };
    }
    BTreeMap::from([
        schema!("language.yaml", LanguageDocument),
        schema!("teaching-guides.yaml", super::guides::GuideDocument),
        schema!("speech-routing.yaml", super::speech::Catalog),
        schema!("language-foundations.yaml", Foundations),
        schema!("learning-goals.yaml", Vec<Construct>),
        schema!("skills.yaml", super::skills::Catalog),
        schema!(
            "skill-presence.yaml",
            crate::learning::practice_assessment::Instructions
        ),
        schema!("learning-map.yaml", Vec<NavigationNode>),
        schema!("teaching-policy.yaml", TeachingPolicy),
        schema!("conversation-topics.yaml", Vec<ConversationTopic>),
        schema!("conversation-prompt.yaml", ConversationPromptContent),
    ])
}
