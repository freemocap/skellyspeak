//! Durable, content-free diagnostics; the bounded ring is only a recent-read view.
use crate::model::{AppError, ErrorCode, Result};
use serde::{Deserialize, Serialize};
use std::{
    collections::VecDeque,
    fs::{File, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
    time::{SystemTime, UNIX_EPOCH},
};

const CAPACITY: usize = 256;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticContext {
    Application,
    Conversation,
    Speech,
    Microphone,
    Settings,
    Audio,
    Navigation,
    Other,
}
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticCode {
    UiEvent,
    UiFault,
    NativeCommandFailed,
    UnhandledError,
    UnhandledRejection,
    DiagnosticBridgeFailed,
}
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticLevel {
    Debug,
    Info,
    Warn,
    Error,
}
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticCause {
    CustomTranscriptionUnconfigured,
    PlaybackDenied,
    PlaybackFailed,
    NetworkFailure,
    ResizeObserverLoop,
    ResourceLoadFailed,
    TypeError,
    ReferenceError,
    SyntaxError,
    AbortError,
    Unknown,
}
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticEvent {
    Console,
    IpcStarted,
    IpcSucceeded,
    IpcFailed,
    SettingsOpened,
    SettingsLoaded,
    SettingsSaving,
    MicrophoneAutosend,
    MicrophoneEmpty,
    ApplicationMounted,
    LanguageRegistryLoaded,
    Other,
}
#[derive(Debug, Clone, Deserialize, Serialize, ts_rs::TS)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticCommand {
    ReadSpeechAudio,
    GetUpdateChannel,
    LatestGithubRelease,
    MicStart,
    MicWave,
    MicCancel,
    MicTranscribe,
    FactoryReset,
    GetStartupState,
    GeneratePersona,
    GetSnapshot,
    ExecuteCommand,
    GetAccessSettings,
    SaveAccessSettings,
    CheckAccess,
    GetConnection,
    SaveConnection,
    VerifyOpenrouterKey,
    Disconnect,
    WatchConversation,
    HostedSignIn,
    HostedAccount,
    HostedDiagnostics,
    HostedSignOut,
    CancelSignIn,
    SelectRoute,
    GetProfile,
    GetRewardSettings,
    GetPlaybackRate,
    SavePlaybackRate,
    SaveRewardSettings,
    GetSkillEvidence,
    GetPracticeOverview,
    SaveSkillProfile,
    OpenAiWindow,
}
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FrontendDiagnostic {
    pub context: DiagnosticContext,
    pub code: DiagnosticCode,
    pub level: Option<DiagnosticLevel>,
    pub native_code: Option<ErrorCode>,
    pub fault_id: Option<u32>,
    pub command: Option<DiagnosticCommand>,
    pub cause: Option<DiagnosticCause>,
    pub event_name: Option<DiagnosticEvent>,
    pub redacted_args: Option<u32>,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticRecord {
    pub sequence: u64,
    pub recorded_at_ms: u64,
    pub event: FrontendDiagnostic,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticReceipt {
    pub sequence: u64,
    pub recorded_at_ms: u64,
}

struct Buffer {
    records: VecDeque<DiagnosticRecord>,
    sequence: u64,
}
impl Buffer {
    fn new() -> Self {
        Self {
            records: VecDeque::new(),
            sequence: 0,
        }
    }
    fn push(&mut self, event: FrontendDiagnostic, recorded_at_ms: u64) -> Result<DiagnosticRecord> {
        let sequence = self.sequence.checked_add(1).ok_or_else(unavailable)?;
        let record = DiagnosticRecord {
            sequence,
            recorded_at_ms,
            event,
        };
        self.sequence = sequence;
        if self.records.len() == CAPACITY {
            self.records.pop_front();
        }
        self.records.push_back(record.clone());
        Ok(record)
    }
    fn after(&self, sequence: Option<u64>) -> Vec<DiagnosticRecord> {
        self.records
            .iter()
            .filter(|r| sequence.is_none_or(|after| r.sequence > after))
            .cloned()
            .collect()
    }
}
fn unavailable() -> AppError {
    AppError::new(ErrorCode::Internal, "Native diagnostics are unavailable.")
}
/// Startup diagnostics must never expose an app-private path or operating-system
/// error to the UI. The stage is sufficient to make a device log actionable.
fn unavailable_at(stage: &'static str) -> AppError {
    eprintln!("Native diagnostics setup failed at {stage}.");
    AppError::new(
        ErrorCode::Internal,
        format!("Native diagnostics could not initialize ({stage})."),
    )
}
fn buffer() -> &'static Mutex<Buffer> {
    static BUFFER: OnceLock<Mutex<Buffer>> = OnceLock::new();
    BUFFER.get_or_init(|| Mutex::new(Buffer::new()))
}

fn timestamp() -> Result<u64> {
    let value = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| unavailable())?
        .as_millis();
    u64::try_from(value).map_err(|_| unavailable())
}

struct FileSink {
    directory: PathBuf,
    frontend: File,
    native: File,
}
fn private_file(path: &Path) -> std::io::Result<File> {
    let mut options = OpenOptions::new();
    options.create_new(true).append(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options.open(path)
}
impl FileSink {
    fn open(directory: &Path) -> Result<Self> {
        // Desktop paths must not traverse user-controlled symlinks. Android's
        // app-private path is supplied by the OS but conventionally includes the
        // system-owned /data/user/0 alias, so rejecting every ancestor there would
        // reject every valid app-data directory. `prepare_private_directory` still
        // rejects a symlink at the final private directory on every Unix platform.
        #[cfg(not(target_os = "android"))]
        for ancestor in directory.ancestors() {
            if let Ok(metadata) = std::fs::symlink_metadata(ancestor)
                && metadata.file_type().is_symlink()
            {
                return Err(unavailable_at("path_validation"));
            }
        }
        crate::store::prepare_private_directory(directory)
            .map_err(|_| unavailable_at("directory"))?;
        let frontend = private_file(&directory.join("diagnostics.jsonl"))
            .map_err(|_| unavailable_at("frontend_file"))?;
        let native = private_file(&directory.join("native.jsonl"))
            .map_err(|_| unavailable_at("native_file"))?;
        let mut manifest =
            private_file(&directory.join(format!("native-{}.manifest.json", std::process::id())))
                .map_err(|_| unavailable_at("manifest_file"))?;
        serde_json::to_writer(
            &mut manifest,
            &serde_json::json!({
                "version": 1, "pid": std::process::id(), "startedAtMs": timestamp()?,
                "source": "native", "streams": ["diagnostics.jsonl", "native.jsonl"],
                "retention": "no_automatic_deletion", "content": "structured_allowlisted_metadata",
            }),
        )
        .map_err(|_| unavailable_at("manifest_encoding"))?;
        manifest
            .write_all(b"\n")
            .and_then(|_| manifest.flush())
            .map_err(|_| unavailable_at("manifest_write"))?;
        Ok(Self {
            directory: directory.to_owned(),
            frontend,
            native,
        })
    }
    fn append(&mut self, source: &str, event: &serde_json::Value) -> Result<()> {
        let record = serde_json::json!({
            "recordedAtMs": timestamp()?, "run": self.directory.file_name().and_then(|n| n.to_str()),
            "pid": std::process::id(), "source": source, "event": event,
        });
        let mut bytes = serde_json::to_vec(&record).map_err(|_| unavailable())?;
        bytes.push(b'\n');
        let file = if source == "frontend" {
            &mut self.frontend
        } else {
            &mut self.native
        };
        file.write_all(&bytes)
            .and_then(|_| file.flush())
            .map_err(|_| unavailable())
    }
}
static SINK: OnceLock<Mutex<Option<FileSink>>> = OnceLock::new();
static LOG_ROOT: OnceLock<PathBuf> = OnceLock::new();
fn sink() -> Result<&'static Mutex<Option<FileSink>>> {
    SINK.get().ok_or_else(unavailable)
}

/// Root calls this during setup before opening application state. No deletion/rotation.
pub fn initialize(fallback_root: &Path) -> Result<PathBuf> {
    if let Some(sink) = SINK.get() {
        return sink
            .lock()
            .map_err(|_| unavailable())?
            .as_ref()
            .map(|value| value.directory.clone())
            .ok_or_else(unavailable);
    }
    let custom = std::env::var_os("SKELLYSPEAK_LOG_RUN_DIR");
    let root = match custom.as_ref() {
        Some(value) => {
            let path = PathBuf::from(value);
            if !path.is_absolute() {
                return Err(unavailable_at("custom_root"));
            }
            path
        }
        None => {
            if cfg!(all(
                debug_assertions,
                not(any(target_os = "android", target_os = "ios"))
            )) {
                Path::new(env!("CARGO_MANIFEST_DIR"))
                    .parent()
                    .ok_or_else(unavailable)?
                    .join(".local/logs")
            } else {
                fallback_root.to_owned()
            }
        }
    };
    let directory = if custom.is_some() {
        root.clone()
    } else {
        root.join(format!("native-{}-{}", timestamp()?, std::process::id()))
    };
    let mut output = FileSink::open(&directory)?;
    output
        .append("native", &serde_json::json!({"code":"logging_initialized"}))
        .map_err(|_| unavailable_at("initial_record"))?;
    LOG_ROOT
        .set(root)
        .map_err(|_| unavailable_at("root_registration"))?;
    SINK.set(Mutex::new(Some(output)))
        .map_err(|_| unavailable_at("sink_registration"))?;
    #[cfg(desktop)]
    {
        log::set_logger(&NATIVE_LOGGER).map_err(|_| unavailable())?;
        log::set_max_level(log::LevelFilter::Trace);
    }
    // Panic payloads can contain provider/user data; retain only event and location.
    std::panic::set_hook(Box::new(|info| {
        let event = serde_json::json!({"code":"panic", "line":info.location().map(|l| l.line()),
            "contentRedacted":true});
        if append_native(&event).is_err() {
            eprintln!("Native panic diagnostic could not be saved.");
        }
        eprintln!("Native panic occurred; diagnostic payload redacted.");
    }));
    Ok(directory)
}
fn append_native(event: &serde_json::Value) -> Result<()> {
    sink()?
        .lock()
        .map_err(|_| unavailable())?
        .as_mut()
        .ok_or_else(unavailable)?
        .append("native", event)
}

pub fn log_root() -> Result<PathBuf> {
    LOG_ROOT.get().cloned().ok_or_else(unavailable)
}
pub fn shutdown() -> Result<()> {
    sink()?.lock().map_err(|_| unavailable())?.take();
    Ok(())
}

/// Authored diagnostic code with numerical metrics only; no arbitrary error body.
pub fn native_event(code: &'static str, metrics: &[(&'static str, u64)]) {
    let event = serde_json::json!({"code":code, "metrics":metrics});
    if append_native(&event).is_err() {
        eprintln!("Native diagnostic file write failed (or logging is not initialized): {code}");
    }
}
#[cfg(desktop)]
struct NativeLogger;
#[cfg(desktop)]
static NATIVE_LOGGER: NativeLogger = NativeLogger;
#[cfg(desktop)]
impl log::Log for NativeLogger {
    fn enabled(&self, _: &log::Metadata<'_>) -> bool {
        true
    }
    fn log(&self, record: &log::Record<'_>) {
        // Target/module may be caller-controlled in dependencies: only local microphone
        // target receives an authored category; arbitrary payloads are never persisted.
        let code = if record.target() == "skellyspeak_core::audio" {
            "microphone_log"
        } else {
            "native_log"
        };
        let mut event = serde_json::json!({"code":code, "level":record.level().as_str(),
            "line":record.line(), "contentRedacted":true});
        if record.target() == "skellyspeak_core::audio" {
            let message = record.args().to_string();
            if let Some(rate) = message
                .strip_prefix("[mic] capture started at ")
                .and_then(|s| s.strip_suffix("Hz"))
                .and_then(|s| s.parse::<u32>().ok())
            {
                event["code"] = serde_json::json!("microphone_capture_started");
                event["sampleRate"] = serde_json::json!(rate);
            } else if let Some((samples, bytes)) = message
                .strip_prefix("[mic] capture finished: ")
                .and_then(|s| s.strip_suffix(" bytes of WAV"))
                .and_then(|s| s.split_once(" samples, "))
                .and_then(|(a, b)| Some((a.parse::<u64>().ok()?, b.parse::<u64>().ok()?)))
            {
                event["code"] = serde_json::json!("microphone_capture_finished");
                event["samples"] = serde_json::json!(samples);
                event["wavBytes"] = serde_json::json!(bytes);
            }
        }
        if append_native(&event).is_err() {
            eprintln!("Native log record could not be saved.");
        }
    }
    fn flush(&self) {} // Each append is flushed before returning.
}

#[tauri::command]
pub fn record_frontend_diagnostic(event: FrontendDiagnostic) -> Result<DiagnosticReceipt> {
    let timestamp = timestamp()?;
    let mut buffer = buffer().lock().map_err(|_| unavailable())?;
    // Commit to the file before publishing to the recent-read ring or acknowledging.
    let sequence = buffer.sequence.checked_add(1).ok_or_else(unavailable)?;
    let record = DiagnosticRecord {
        sequence,
        recorded_at_ms: timestamp,
        event,
    };
    let mut sink = sink()?.lock().map_err(|_| unavailable())?;
    sink.as_mut().ok_or_else(unavailable)?.append(
        "frontend",
        &serde_json::to_value(&record).map_err(|_| unavailable())?,
    )?;
    let record = buffer.push(record.event, timestamp)?;
    Ok(DiagnosticReceipt {
        sequence: record.sequence,
        recorded_at_ms: record.recorded_at_ms,
    })
}

#[tauri::command]
pub fn read_frontend_diagnostics(after_sequence: Option<u64>) -> Result<Vec<DiagnosticRecord>> {
    Ok(buffer()
        .lock()
        .map_err(|_| unavailable())?
        .after(after_sequence))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn event() -> FrontendDiagnostic {
        FrontendDiagnostic {
            context: DiagnosticContext::Speech,
            code: DiagnosticCode::UiFault,
            level: Some(DiagnosticLevel::Error),
            native_code: Some(ErrorCode::Provider),
            fault_id: Some(7),
            command: Some(DiagnosticCommand::MicStart),
            cause: Some(DiagnosticCause::Unknown),
            event_name: Some(DiagnosticEvent::IpcFailed),
            redacted_args: Some(1),
        }
    }
    #[test]
    fn only_structured_allowlisted_fields_cross_the_bridge() {
        let valid = serde_json::to_value(event()).unwrap();
        assert!(serde_json::from_value::<FrontendDiagnostic>(valid.clone()).is_ok());
        for field in ["message", "stack", "url", "transcript", "apiKey"] {
            let mut input = valid.clone();
            input[field] = serde_json::json!("private fixture");
            assert!(serde_json::from_value::<FrontendDiagnostic>(input).is_err());
        }
        for field in [
            "context",
            "code",
            "nativeCode",
            "level",
            "command",
            "cause",
            "eventName",
        ] {
            let mut input = valid.clone();
            input[field] = serde_json::json!("private fixture");
            assert!(serde_json::from_value::<FrontendDiagnostic>(input).is_err());
        }
        let mut buffer = Buffer::new();
        let line = serde_json::to_string(&buffer.push(event(), 123).unwrap()).unwrap();
        assert!(line.contains("\"recordedAtMs\":123"));
        assert!(line.contains("\"nativeCode\":\"provider\""));
        assert!(!line.contains("private fixture"));
    }
    #[test]
    fn progression_commands_cross_the_diagnostic_bridge() {
        let temp = tempfile::tempdir().unwrap();
        let directory = temp.path().canonicalize().unwrap().join("run");
        let mut sink = FileSink::open(&directory).unwrap();
        for command in [
            "get_skill_evidence",
            "get_practice_overview",
            "save_skill_profile",
        ] {
            let mut input = serde_json::to_value(event()).unwrap();
            input["command"] = serde_json::json!(command);
            let decoded: FrontendDiagnostic = serde_json::from_value(input).unwrap();
            let value = serde_json::to_value(decoded).unwrap();
            assert_eq!(value["command"], command);
            sink.append("frontend", &value).unwrap();
            let text = std::fs::read_to_string(directory.join("diagnostics.jsonl")).unwrap();
            let last: serde_json::Value =
                serde_json::from_str(text.lines().last().unwrap()).unwrap();
            assert_eq!(last["event"]["command"], command);
        }
    }
    #[test]
    fn bounded_history_keeps_order_and_reads_have_no_side_effects() {
        let mut buffer = Buffer::new();
        for index in 0..300 {
            buffer.push(event(), index).unwrap();
        }
        assert_eq!(buffer.records.len(), CAPACITY);
        assert_eq!(buffer.after(None).first().unwrap().sequence, 45);
        for _ in 0..20 {
            assert_eq!(
                buffer
                    .after(Some(298))
                    .iter()
                    .map(|r| r.sequence)
                    .collect::<Vec<_>>(),
                vec![299, 300]
            );
        }
        assert_eq!(buffer.sequence, 300);
    }
    #[test]
    fn durable_history_exceeds_ring_and_is_immediately_readable() {
        let temp = tempfile::tempdir().unwrap();
        let directory = temp.path().canonicalize().unwrap().join("run");
        let mut sink = FileSink::open(&directory).unwrap();
        let mut ring = Buffer::new();
        for index in 0..600 {
            let record = ring.push(event(), index).unwrap();
            sink.append("frontend", &serde_json::to_value(record).unwrap())
                .unwrap();
        }
        let bytes = std::fs::read_to_string(directory.join("diagnostics.jsonl")).unwrap();
        let lines: Vec<serde_json::Value> = bytes
            .lines()
            .map(|s| serde_json::from_str(s).unwrap())
            .collect();
        assert_eq!(lines.len(), 600);
        assert_eq!(lines[0]["event"]["sequence"], 1);
        assert_eq!(lines[599]["event"]["sequence"], 600);
        assert_eq!(ring.records.len(), CAPACITY);
        assert!(FileSink::open(&directory).is_err());
        assert_eq!(
            std::fs::read_to_string(directory.join("diagnostics.jsonl")).unwrap(),
            bytes
        );
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                std::fs::metadata(&directory).unwrap().permissions().mode() & 0o777,
                0o700
            );
            assert_eq!(
                std::fs::metadata(directory.join("diagnostics.jsonl"))
                    .unwrap()
                    .permissions()
                    .mode()
                    & 0o777,
                0o600
            );
        }
    }
    #[test]
    #[cfg(unix)]
    fn symlink_and_disk_write_failures_are_explicit() {
        let temp = tempfile::tempdir().unwrap();
        let directory = temp.path().canonicalize().unwrap();
        let link = directory.join("link");
        std::os::unix::fs::symlink(&directory, &link).unwrap();
        assert!(FileSink::open(&link.join("run")).is_err());
        let mut sink = FileSink::open(&directory.join("run")).unwrap();
        // A read-only descriptor deterministically simulates failed disk writes.
        sink.frontend = File::open(directory.join("run/diagnostics.jsonl")).unwrap();
        assert!(
            sink.append("frontend", &serde_json::json!({"code":"ui_event"}))
                .is_err()
        );
    }
}
