//! One signal-analysis path for capture, retained takes and generated speech.
use super::*;
use crate::speech::{
    analysis::{audio_inspection::AudioInspection, signal_cache},
    recording::owner::RecordingOwner,
};

impl Application {
    pub(crate) async fn inspect_audio(
        self: &Arc<Self>,
        wav: Vec<u8>,
        id: String,
        owner: RecordingOwner,
    ) -> Result<AudioInspection> {
        let (session, gate) = {
            let store = self.lock()?;
            (store.session_id.clone(), store.audio_analysis.clone())
        };
        let application = self.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let mut live = gate.0.lock().map_err(|_| internal())?;
            let digest = crate::ai::results::digest(&wav);
            let check = |store: &Store| -> Result<()> {
                if store.session_id != session {
                    return Err(AppError::new(
                        ErrorCode::SessionExpired,
                        "The audio workspace changed.",
                    ));
                }
                if !owner.available(&store.connection)? {
                    return Err(AppError::new(
                        ErrorCode::NotFound,
                        "The audio owner no longer exists.",
                    ));
                }
                Ok(())
            };
            {
                let store = application.lock()?;
                check(&store)?;
                if let Some(signal) = signal_cache::read(&store.connection, &digest)? {
                    return Ok(signal.inspection(&id, &owner));
                }
                if let Some(signal) = live.get(&digest) {
                    signal_cache::save(&store.connection, &digest, &signal)?;
                    crate::ai::results::prune(&store.connection)?;
                    store.prune_drill_audio()?;
                    return Ok(signal.inspection(&id, &owner));
                }
            }
            // No store lock during WAV decoding and spectral calculation.
            let signal = signal_cache::compute(&wav)?;
            #[cfg(test)]
            {
                live.computations += 1;
            }
            let store = application.lock()?;
            check(&store)?;
            signal_cache::save(&store.connection, &digest, &signal)?;
            crate::ai::results::prune(&store.connection)?;
            store.prune_drill_audio()?;
            live.insert(digest, signal.clone())?;
            Ok(signal.inspection(&id, &owner))
        })
        .await
        .map_err(|cause| {
            crate::diagnostics::failures::join(&cause, "audio_analysis_worker", internal())
        })?
    }
}

#[cfg(test)]
#[path = "tests/audio_analysis.rs"]
mod tests;
