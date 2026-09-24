//! Request execution identities, independent of product record identities.
use uuid::Uuid;

pub(crate) fn new_attempt_id() -> String {
    format!(
        "{:010}-{}",
        crate::ai::policy::refusal::now() as u64,
        Uuid::new_v4().simple()
    )
}

/// Attempt and operation identities for one execution request, in the forms every
/// dispatch uses. The hosted server refuses a grouped request whose identities have
/// any other shape.
pub(crate) fn new_execution_ids() -> (String, String) {
    (new_attempt_id(), uuid::Uuid::new_v4().simple().to_string())
}
