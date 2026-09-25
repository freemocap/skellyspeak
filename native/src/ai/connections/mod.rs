pub(crate) mod access;
pub(crate) mod auth_errors;
pub mod credentials;
pub(crate) mod model_routing;

#[cfg(target_os = "macos")]
mod credential_cache;

#[cfg(target_os = "macos")]
mod credential_events;

pub(crate) mod configuration;
pub(crate) mod speech_routing;
