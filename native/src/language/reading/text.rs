//! Typed reading contracts and validated, evictable results. No view ownership.
use super::*;
use crate::ai::{results, transport::provider};
use serde_json::{Value, json};

pub struct Prepared {
    pub dispatch: TextRequest,
    pub source: Option<gloss::Source>,
    pub schema: Value,
    pub key: String,
}
impl Prepared {
    pub fn output(&self) -> provider::RequestOutput<'_> {
        if self.source.is_some() {
            gloss::request_output(self.source.as_ref(), &self.schema)
        } else {
            provider::structured_output(&self.schema)
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Stored {
    pub scope: ReadingScope,
    pub text: String,
    pub access_scope: String,
    pub gloss: Option<WordGlossView>,
    pub translation: Option<String>,
    pub explanations: Option<support::ReplyExplanations>,
}
impl Stored {
    pub fn decode(payload: &[u8]) -> Result<Self> {
        serde_json::from_slice(payload).map_err(|_| {
            AppError::new(
                ErrorCode::Storage,
                "Saved reading result has an invalid shape.",
            )
        })
    }
}
impl Request {
    pub fn text_scope(&self) -> Result<String> {
        access_scope(&self.install, &self.target, &self.model, &self.config_hash)
    }

    pub fn prepare_text(&self) -> Result<Prepared> {
        let (dispatch, source, schema) = match self.input.aid {
            ReadingAid::WordGloss => {
                let (request, source, schema) = self.word_gloss_dispatch()?;
                (request, Some(source), schema)
            }
            ReadingAid::Translation => {
                let (request, schema) = self.translation_dispatch()?;
                (request, None, schema)
            }
            ReadingAid::Explanations => {
                let (request, schema) = self.explanations_dispatch()?;
                (request, None, schema)
            }
            ReadingAid::Speech => {
                return Err(AppError::new(
                    ErrorCode::Validation,
                    "Speech is not a text result.",
                ));
            }
        };
        let mut prepared = Prepared {
            dispatch,
            source,
            schema,
            key: String::new(),
        };
        prepared.key = results::text::request_key(
            &prepared.dispatch,
            prepared.output(),
            self.input.aid.receipt_kind(),
            &json!([self.context, self.config_hash]),
        )?;
        Ok(prepared)
    }
    pub fn validate_text(
        &self,
        prepared: &Prepared,
        completion: &provider::Completion,
        metadata: &mut Value,
        previous: Option<&Stored>,
    ) -> Result<Stored> {
        let mut stored = Stored {
            scope: ReadingScope {
                language: self.context.language_id.clone(),
                variety: Some(self.context.variety_id.clone()),
                explanation: self.context.explanation_language_id.clone(),
                explanation_variety: Some(self.context.explanation_variety_id.clone()),
            },
            text: self.input.text.clone(),
            access_scope: self.text_scope()?,
            gloss: None,
            translation: None,
            explanations: None,
        };
        match self.input.aid {
            ReadingAid::WordGloss => {
                let (mut value, report) = gloss::recover_with_context(
                    prepared.source.as_ref().unwrap(),
                    completion,
                    &prepared.dispatch.operation,
                    &prepared.dispatch.attempt,
                    &self.context,
                )?;
                metadata["wordGlossValidation"] = report;
                if let Some(old) = previous.and_then(|p| p.gloss.as_ref()) {
                    value = gloss::merge_repair(old, value)?;
                }
                stored.gloss = Some(value);
            }
            ReadingAid::Translation => {
                stored.translation = Some(crate::language::translation::validate(
                    &self.input.text,
                    completion,
                )?)
            }
            ReadingAid::Explanations => {
                stored.explanations = Some(serde_json::from_value(support::validate_source(
                    &self.input.text,
                    support::EXPLANATIONS,
                    completion,
                )?)?)
            }
            ReadingAid::Speech => unreachable!(),
        }
        Ok(stored)
    }
}

fn access_scope(
    install: &str,
    target: &access::ResolvedTarget,
    model: &str,
    config_hash: &str,
) -> Result<String> {
    Ok(results::digest(&serde_json::to_vec(&json!([
        install,
        target.route,
        target.url,
        target.credential,
        model,
        config_hash
    ]))?))
}
pub(super) fn current_scope(store: &Store) -> Result<String> {
    let target = access::resolve(&store.connection, access::Capability::Chat)?;
    let model = crate::ai::connections::model_routing::target(
        &target,
        ReadingAid::WordGloss.role(),
        &crate::ai::connections::configuration::config(&store.connection)?.fast_model,
    )
    .model;
    access_scope(
        &store.snapshot()?.learner.id,
        &target,
        &model,
        store.config.hash(),
    )
}
