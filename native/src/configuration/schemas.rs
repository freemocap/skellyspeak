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
        schema!("language.json", LanguageDocument),
        schema!("language-foundations.json", Foundations),
        schema!("learning-goals.json", Vec<Construct>),
        schema!("learning-map.json", Vec<NavigationNode>),
        schema!("teaching-policy.json", TeachingPolicy),
        schema!("conversation-topics.json", Vec<ConversationTopic>),
    ])
}
