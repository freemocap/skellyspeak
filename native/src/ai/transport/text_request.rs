//! Transport inputs independent of the workflow consuming the result.
use crate::ai::connections::access::ResolvedTarget;
use crate::ai::transport::provider::PromptMessage;
use crate::model::ConnectionRoute;

/// Execution identity is distinct from any message, practice item or view.
/// Output schemas are supplied through RequestOutput; publication stays with
/// the caller. This type carries no product source or publication callback.
pub struct TextRequest {
    pub decisions: Option<serde_json::Value>,
    pub temperature: f64,
    pub target: ResolvedTarget,
    pub attempt: String,
    pub operation: String,
    pub credential: String,
    pub model: String,
    pub route: ConnectionRoute,
    pub install_id: String,
    pub messages: Vec<PromptMessage>,
}
