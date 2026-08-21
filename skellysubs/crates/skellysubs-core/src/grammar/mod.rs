//! Grammar analysis: the language-agnostic IR + Spanish analyzer + cards +
//! learner model + turn flow (ported from the Habla·ES reference).

pub mod analyzer;
pub mod cards;
pub mod ir;
pub mod learner;
pub mod turn;

pub use analyzer::SpanishLlmAnalyzer;
pub use cards::{Card, CardLibrary, Trigger};
pub use ir::{Construction, Feature, FeatureEvent, Token};
pub use learner::LearnerModel;
pub use turn::{run_turn, run_turn_with_reply, TutorTurn};
