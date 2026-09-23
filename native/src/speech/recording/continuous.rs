//! One live capture feeds bounded utterances into the existing transcription path.
use super::{
    continuous_policy::{ListeningSettings, POLICY},
    voice,
};
use crate::{application::Application, model::*, speech::recording::owner::RecordingOwner};
use serde::Serialize;
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, AtomicU8, Ordering},
};
use std::time::Instant;
use ts_rs::TS;

#[derive(Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ListeningTake {
    pub recording_id: String,
    pub number: u32,
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub cut_seconds: f64,
    pub state: ListeningTakeState,
    pub failure: Option<AppError>,
}
#[derive(Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum ListeningTakeState {
    Queued,
    Processing,
    Completed,
    Failed,
}

#[derive(Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ListeningStatus {
    pub recording_id: String,
    pub listening: bool,
    pub speaking: bool,
    pub queued: u32,
    pub processing: bool,
    pub completed: u32,
    pub takes: Vec<ListeningTake>,
    pub failure: Option<AppError>,
    /// The boundary choices in force now.
    pub settings: ListeningSettings,
    /// Loudest analysed frame in the latest drain, in dBFS.
    pub level_db: f64,
    /// The measured room noise and the level a frame must exceed to count as speech.
    pub noise_floor_db: f64,
    pub threshold_db: f64,
    /// Bursts that opened a take but ended shorter than the shortest take allowed.
    pub ignored_takes: u32,
}
pub(crate) struct Session {
    browser: Mutex<Option<super::browser_capture::BrowserCapture>>,
    spectrum: Mutex<Option<crate::speech::analysis::spectrogram::LiveAnalysis>>,
    status: Mutex<ListeningStatus>,
    settings: Mutex<ListeningSettings>,
    discard: AtomicBool,
    stop: AtomicU8, // 0 listen, 1 finish current, 2 discard current
    lease: Mutex<Instant>,
}
impl Session {
    pub(crate) fn new(recording_id: String, settings: ListeningSettings) -> Self {
        Self {
            browser: Mutex::new(None),
            spectrum: Mutex::new(None),
            status: Mutex::new(ListeningStatus {
                recording_id,
                listening: true,
                speaking: false,
                queued: 0,
                processing: false,
                completed: 0,
                takes: vec![],
                failure: None,
                settings,
                level_db: -120.0,
                noise_floor_db: -120.0,
                threshold_db: -120.0,
                ignored_takes: 0,
            }),
            settings: Mutex::new(settings),
            discard: AtomicBool::new(false),
            stop: AtomicU8::new(0),
            lease: Mutex::new(Instant::now()),
        }
    }
    fn fail(&self, message: &str) {
        self.error(AppError::new(ErrorCode::Conflict, message));
    }
    fn error(&self, error: AppError) {
        let mut status = self.status.lock().expect("listening status");
        if status.failure.is_none() {
            status.failure = Some(error);
        }
        self.stop.store(2, Ordering::SeqCst);
    }
}
#[tauri::command]
pub async fn mic_listen_start(
    state: tauri::State<'_, Arc<Application>>,
    owner: RecordingOwner,
    settings: ListeningSettings,
) -> Result<RecordingStarted> {
    settings
        .validate()
        .map_err(|message| AppError::new(ErrorCode::Validation, message))?;
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || start(&state, owner, settings))
        .await
        .map_err(|e| {
            crate::diagnostics::failures::join(
                &e,
                "continuous_start",
                AppError::new(ErrorCode::Conflict, "Listening could not start."),
            )
        })?
}

fn start(
    state: &Arc<Application>,
    owner: RecordingOwner,
    settings: ListeningSettings,
) -> Result<RecordingStarted> {
    let mut held = state
        .listening
        .lock()
        .map_err(|_| AppError::new(ErrorCode::Conflict, "Listening state unavailable."))?;
    if let Some(previous) = held.as_ref() {
        let s = previous.status.lock().expect("listening status");
        if s.listening || s.processing || s.queued > 0 {
            return Err(AppError::new(
                ErrorCode::Conflict,
                "Wait for the previous takes to finish.",
            ));
        }
    }
    let started = voice::start_capture(state, owner)?;
    let session = Arc::new(Session::new(started.recording_id.clone(), settings));
    if started.browser_capture {
        *session.browser.lock().expect("browser capture") = Some(Default::default());
    }
    *held = Some(session.clone());
    tauri::async_runtime::spawn(listen(state.clone(), session, started.recording_id.clone()));
    Ok(started)
}
fn session(state: &Application, id: &str) -> Result<Arc<Session>> {
    state
        .listening
        .lock()
        .map_err(|_| AppError::new(ErrorCode::Conflict, "Listening state unavailable."))?
        .as_ref()
        .filter(|s| s.status.lock().expect("listening status").recording_id == id)
        .cloned()
        .ok_or_else(|| {
            AppError::new(
                ErrorCode::Conflict,
                "This listening session is no longer available.",
            )
        })
}
/// Each request is acknowledged before the browser sends its next PCM chunk.
#[tauri::command]
pub async fn mic_listen_push(
    state: tauri::State<'_, Arc<Application>>,
    recording_id: String,
    sequence: u32,
    sample_rate: u32,
    samples: Vec<f32>,
) -> Result<()> {
    let session = session(&state, &recording_id)?;
    if session.stop.load(Ordering::SeqCst) != 0 {
        return Err(AppError::new(ErrorCode::Conflict, "Listening is stopping."));
    }
    let result = session
        .browser
        .lock()
        .expect("browser capture")
        .as_mut()
        .ok_or("This recording does not accept browser audio.")
        .and_then(|capture| capture.push(sequence, sample_rate, samples));
    result.map_err(|message| {
        let error = AppError::new(ErrorCode::Validation, message);
        session.error(error.clone());
        error
    })
}

/// Whether `id` names the current listening run, finished or not.
pub(super) fn is_listening_run(state: &Application, id: &str) -> bool {
    session(state, id).is_ok()
}
pub(super) fn cancel_session(state: &Application, id: &str) {
    if let Ok(session) = session(state, id) {
        session.stop.store(2, Ordering::SeqCst);
    }
}

#[tauri::command]
pub fn mic_listen_spectrogram(
    state: tauri::State<'_, Arc<Application>>,
    recording_id: String,
    after_seconds: Option<f64>,
) -> Result<Option<crate::speech::analysis::spectrogram::LiveSpectrogram>> {
    if after_seconds.is_some_and(|n| !n.is_finite() || n < 0.0) {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Invalid spectrum cursor.",
        ));
    }
    let session = session(&state, &recording_id)?;
    let spectrum = session
        .spectrum
        .lock()
        .map_err(|_| AppError::new(ErrorCode::Conflict, "Live spectrum unavailable."))?;
    Ok(spectrum
        .as_ref()
        .map(|analysis| analysis.snapshot_since(after_seconds)))
}

#[tauri::command]
pub fn mic_listen_status(
    state: tauri::State<'_, Arc<Application>>,
    recording_id: String,
) -> Result<ListeningStatus> {
    let session = session(&state, &recording_id)?;
    *session.lease.lock().expect("listening lease") = Instant::now();
    let result = session.status.lock().expect("listening status").clone();
    Ok(result)
}
#[tauri::command]
pub fn mic_listen_stop(
    state: tauri::State<'_, Arc<Application>>,
    recording_id: String,
) -> Result<()> {
    session(&state, &recording_id)?
        .stop
        .compare_exchange(0, 1, Ordering::SeqCst, Ordering::SeqCst)
        .ok();
    Ok(())
}

/// Change the pause, threshold or shortest take while listening.
#[tauri::command]
pub fn mic_listen_tune(
    state: tauri::State<'_, Arc<Application>>,
    recording_id: String,
    settings: ListeningSettings,
) -> Result<()> {
    settings
        .validate()
        .map_err(|message| AppError::new(ErrorCode::Validation, message))?;
    let session = session(&state, &recording_id)?;
    *session
        .settings
        .lock()
        .map_err(|_| AppError::new(ErrorCode::Conflict, "Listening settings unavailable."))? =
        settings;
    Ok(())
}

#[tauri::command]
pub fn mic_listen_discard(
    state: tauri::State<'_, Arc<Application>>,
    recording_id: String,
) -> Result<()> {
    session(&state, &recording_id)?
        .discard
        .store(true, Ordering::SeqCst);
    Ok(())
}

async fn listen(state: Arc<Application>, session: Arc<Session>, id: String) {
    use super::{segmentation::Segmenter, wav};
    let (tx, mut rx) = tokio::sync::mpsc::channel::<(voice::Transcription, Vec<u8>)>(
        POLICY.max_pending_takes as usize,
    );
    let consumer_state = state.clone();
    let consumer_session = session.clone();
    let consumer = tauri::async_runtime::spawn(async move {
        while let Some((request, wav)) = rx.recv().await {
            {
                let mut status = consumer_session.status.lock().expect("listening status");
                status.queued -= 1;
                status.processing = true;
                if let Some(take) = status
                    .takes
                    .iter_mut()
                    .find(|t| t.recording_id == request.id)
                {
                    take.state = ListeningTakeState::Processing;
                }
            }
            let recording_id = request.id.clone();
            let result = voice::transcribe(consumer_state.clone(), request, wav).await;
            {
                let mut status = consumer_session.status.lock().expect("listening status");
                status.processing = false;
                // Publication may have succeeded before a cleanup failure. Always refresh.
                status.completed += 1;
                if let Some(take) = status
                    .takes
                    .iter_mut()
                    .find(|t| t.recording_id == recording_id)
                {
                    take.state = if result.is_ok() {
                        ListeningTakeState::Completed
                    } else {
                        ListeningTakeState::Failed
                    };
                    take.failure = result.as_ref().err().cloned();
                }
            }
            if let Err(error) = result {
                consumer_session.error(error);
            }
        }
    });
    let mut detector: Option<Segmenter> = None;
    // Ignored bursts from detectors already replaced by a discard.
    let mut ignored_before = 0;
    let began = Instant::now();
    let mut accepted = 0;
    let mut received_samples = 0;
    loop {
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        if began.elapsed().as_secs() >= u64::from(POLICY.max_session_seconds) {
            session.fail("Listening reached its 10-minute limit. Start again to continue.");
        }
        if session
            .lease
            .lock()
            .expect("listening lease")
            .elapsed()
            .as_secs()
            >= 10
        {
            session.fail("Listening stopped because the recording view disconnected.");
        }
        if session.stop.load(Ordering::SeqCst) == 2 {
            break;
        }
        let drained = (|| -> Result<_> {
            let slot = state
                .capture
                .lock()
                .map_err(|_| AppError::new(ErrorCode::Conflict, "Microphone state unavailable."))?;
            let Some(recording) = slot.as_ref().filter(|r| r.id() == id) else {
                return Ok(None);
            };
            let mut browser = session.browser.lock().expect("browser capture");
            let (rate, pcm) = if let Some(browser) = browser.as_mut() {
                match browser.drain() {
                    Some(value) => value,
                    None => return Ok(Some((recording.request(), 0, Vec::new()))),
                }
            } else {
                #[cfg(desktop)]
                {
                    recording.drain()?
                }
                #[cfg(mobile)]
                {
                    return Err(AppError::new(
                        ErrorCode::Conflict,
                        "Browser capture is unavailable.",
                    ));
                }
            };
            Ok(Some((recording.request(), rate, pcm)))
        })();
        let (template, rate, pcm) = match drained {
            Ok(Some(value)) => value,
            Ok(None) => break,
            Err(error) => {
                session.error(error);
                break;
            }
        };
        if rate == 0 {
            if session.stop.load(Ordering::SeqCst) != 0 {
                break;
            }
            continue;
        }
        received_samples += pcm.len();
        {
            let mut spectrum = session.spectrum.lock().expect("live spectrum");
            spectrum
                .get_or_insert_with(|| {
                    crate::speech::analysis::spectrogram::LiveAnalysis::new(rate)
                })
                .push(&pcm);
        }
        if let Err(error) = template.capture_permitted(&state) {
            session.error(error);
            break;
        }
        if session.discard.swap(false, Ordering::SeqCst) {
            ignored_before += detector.as_ref().map_or(0, Segmenter::ignored);
            detector = None;
            continue;
        }
        let settings = *session.settings.lock().expect("listening settings");
        if detector.is_none() {
            match Segmenter::new(rate, settings) {
                Ok(mut value) => {
                    value.set_offset(received_samples - pcm.len());
                    detector = Some(value);
                }
                Err(error) => {
                    session.fail(&error);
                    break;
                }
            }
        }
        let detector = detector.as_mut().expect("detector initialized");
        if let Err(error) = detector.tune(settings) {
            session.fail(&error);
            break;
        }
        let mut clips = match detector.push(&pcm) {
            Ok(clips) => clips,
            Err(error) => {
                session.fail(&error);
                break;
            }
        };
        if detector.silence_expired() {
            let _ = session
                .stop
                .compare_exchange(0, 1, Ordering::SeqCst, Ordering::SeqCst);
        }
        let stopping = session.stop.load(Ordering::SeqCst) == 1;
        if stopping && let Some(clip) = detector.finish_on_stop() {
            clips.push(clip);
        }
        {
            let levels = detector.levels();
            let mut status = session.status.lock().expect("listening status");
            status.speaking = detector.speaking();
            status.settings = settings;
            status.level_db = levels.level_db;
            status.noise_floor_db = levels.noise_floor_db;
            status.threshold_db = levels.threshold_db;
            status.ignored_takes = ignored_before + detector.ignored();
        }
        for clip in clips {
            if session.stop.load(Ordering::SeqCst) == 2 {
                break;
            }
            if accepted >= POLICY.max_takes {
                session.fail("Listening reached its 100-take limit. Start again to continue.");
                break;
            }
            let wav = match wav::encode_wav(&clip.samples, rate) {
                Ok(wav) => wav,
                Err(error) => {
                    session.fail(&error);
                    break;
                }
            };
            let mut request = template.clone();
            request.id = uuid::Uuid::new_v4().to_string();
            let recording_id = request.id.clone();
            let mut status = session.status.lock().expect("listening status");
            // Hold the counter lock while sending so the consumer cannot underflow.
            if status.queued + u32::from(status.processing) >= POLICY.max_pending_takes
                || tx.try_send((request, wav)).is_err()
            {
                drop(status);
                session.fail("Processing fell behind. Listening stopped; unqueued audio was discarded. Wait for pending takes, then start again.");
                break;
            }
            status.takes.push(ListeningTake {
                recording_id,
                number: accepted + 1,
                start_seconds: clip.start_seconds,
                end_seconds: clip.end_seconds,
                cut_seconds: clip.cut_seconds,
                state: ListeningTakeState::Queued,
                failure: None,
            });
            status.queued += 1;
            accepted += 1;
        }
        if stopping || session.stop.load(Ordering::SeqCst) == 2 {
            break;
        }
    }
    // Drop the hardware before releasing UI playback exclusion.
    if let Ok(mut slot) = state.capture.lock() {
        if slot.as_ref().is_some_and(|r| r.id() == id) {
            slot.take();
        }
    } else {
        session.fail("Microphone state unavailable while stopping.");
    }
    {
        let mut s = session.status.lock().expect("listening status");
        s.listening = false;
        s.speaking = false;
    }
    drop(tx);
    if let Err(error) = consumer.await {
        session.error(crate::diagnostics::failures::join(
            &error,
            "continuous_transcription",
            AppError::new(ErrorCode::Conflict, "Take processing stopped unexpectedly."),
        ));
        let mut s = session.status.lock().expect("listening status");
        s.queued = 0;
        s.processing = false;
    }
}

#[cfg(all(test, desktop))]
#[path = "continuous_tests.rs"]
mod tests;
