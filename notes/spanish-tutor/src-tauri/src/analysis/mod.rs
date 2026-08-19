//! Language analysis lives behind this trait. Spanish first; Mandarin and
//! Levantine plug in later by implementing `Analyzer` and emitting the same IR.

use crate::ir::FeatureEvent;
use async_trait::async_trait;

pub mod spanish;

#[async_trait]
pub trait Analyzer: Send + Sync {
    fn language(&self) -> &str;
    async fn analyze(&self, text: &str) -> anyhow::Result<FeatureEvent>;
}
