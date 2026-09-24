//! Resolve configured recognizer availability before any microphone is opened.
use super::owner::RecordingOwner;
use crate::{
    ai::connections::{access, speech_routing},
    application::Application,
    configuration::speech::{Catalog, Task},
    model::*,
};

pub(super) struct Prepared {
    pub target: access::ResolvedTarget,
    context_hash: String,
}
impl Prepared {
    pub fn validate(
        &self,
        db: &rusqlite::Connection,
        context: &crate::configuration::LanguageContext,
    ) -> Result<()> {
        let current = access::resolve(db, access::Capability::Transcription)?;
        if current.revision != self.target.revision
            || current.route != self.target.route
            || current.url != self.target.url
            || current.credential != self.target.credential
            || context.hash != self.context_hash
        {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "Recording settings changed during speech availability checking. Start again.",
            ));
        }
        Ok(())
    }
}
pub(super) async fn prepare(state: &Application, owner: &RecordingOwner) -> Result<Prepared> {
    let (mut target, context) = {
        let store = state.lock()?;
        let scope = owner.scope(&store)?;
        let target = speech_routing::resolve(
            &store.connection,
            access::Capability::Transcription,
            &scope.language_context,
        )?;
        (target, scope.language_context)
    };
    let key = match target.credential.clone() {
        Some(id) => crate::application::read_secret(id).await?,
        None => zeroize::Zeroizing::new(String::new()),
    };
    let default = target
        .audio_resolution
        .as_ref()
        .expect("resolved transcription")
        .requested_model
        .clone();
    // Availability must consider the configured global default, including custom models.
    let mut query = target.clone();
    query.model = default.clone();
    let available = speech_routing::available(&query, &key).await?;
    let resolution = Catalog::bundled().resolve(
        Task::Transcription,
        context
            .external_tags
            .get("language_tag")
            .map(String::as_str)
            .unwrap_or_default(),
        &context.speech_routes,
        &default,
        Some(&available),
    )?;
    target.model = resolution.model.clone();
    target.audio_resolution = Some(resolution);
    Ok(Prepared {
        target,
        context_hash: context.hash,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn prepared_route_is_bound_to_access_revision_and_language_context() {
        let dir = tempfile::tempdir().unwrap();
        let mut store =
            crate::storage::store::Store::open(&dir.path().join("preflight.sqlite3")).unwrap();
        store.prepare_chat().unwrap();
        store.connection.execute("UPDATE ai_config SET route='custom',custom_config=json_set(custom_config,'$.bearerAuth',json('false'))", []).unwrap();
        let context = store.config.resolve("irish", None, "english").unwrap();
        let prepared = Prepared {
            target: speech_routing::resolve(
                &store.connection,
                access::Capability::Transcription,
                &context,
            )
            .unwrap(),
            context_hash: context.hash.clone(),
        };
        assert_eq!(prepared.target.model, "scribe_v2");
        prepared.validate(&store.connection, &context).unwrap();
        let different = store.config.resolve("spanish", None, "english").unwrap();
        assert!(prepared.validate(&store.connection, &different).is_err());
        store
            .connection
            .execute("UPDATE ai_config SET revision=revision+1", [])
            .unwrap();
        assert!(prepared.validate(&store.connection, &context).is_err());
    }
}
