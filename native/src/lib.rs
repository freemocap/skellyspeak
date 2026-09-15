pub mod ai;
pub(crate) mod application;
pub mod configuration;
pub mod conversations;
pub mod diagnostics;
pub mod language;
pub mod learning;
pub mod model;
pub mod partners;
pub mod speech;
pub mod statistics;
pub mod storage;
pub(crate) mod updates;

pub use application::run;
